import re

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.models import CustomUser, School

# Accepted NECTA/MoE registration number patterns:
#   Secondary:  S.NNNN  or  SS.NNNN  (e.g. S.0123, SS.0123)
#   Primary:    PS-NNNN  or  P-NNNN  (e.g. PS-0123, P-0123)
#   A-Level:    AS.NNNN
_REG_NO_PATTERN = re.compile(
    r'^(S{1,2}\.\d{4,6}|AS\.\d{4,6}|PS?-\d{4,6})$',
    re.IGNORECASE,
)


class SchoolLogoField(serializers.ImageField):
    """
    ImageField that is resilient to missing local files.

    - Cloudinary / remote URLs (absolute): returned as-is — always accessible.
    - Local files that exist on disk: built into an absolute URL.
    - Local files that no longer exist (ephemeral storage, deleted): returns None
      so the frontend shows the placeholder instead of a broken image icon.
    """

    def to_representation(self, value):
        if not value or not value.name:
            return None
        try:
            url = value.url
        except Exception:
            return None

        # Absolute URL means Cloudinary / S3 / external CDN — always reachable.
        if url.startswith('http://') or url.startswith('https://'):
            return url

        # Relative URL means local FileSystemStorage — only return it when the
        # file actually exists on disk (cloud platforms wipe files on restart).
        import os
        try:
            if not os.path.exists(value.path):
                return None
        except Exception:
            pass

        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class SchoolSerializer(serializers.ModelSerializer):
    """Serializer for the School tenant model."""

    logo = SchoolLogoField(required=False, allow_null=True)

    class Meta:
        model = School
        fields = '__all__'
        read_only_fields = ['id', 'is_active', 'created_at', 'updated_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for creating a new CustomUser account."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'first_name', 'last_name', 'role', 'school']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only profile serializer with nested school details."""

    school = SchoolSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'signature',
            'school',
            'role',
            'roles',
            'phone_number',
            'date_of_birth',
            'profile_picture',
            'is_verified',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'email', 'full_name', 'is_verified', 'created_at', 'updated_at']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT pair serializer with extra SkuliNode claims embedded in the token."""

    def validate(self, attrs):
        User = get_user_model()
        username = attrs.get(self.username_field, '').strip()
        password = attrs.get('password', '')

        # --- Meaningful pre-flight checks (username enumeration acceptable in school SaaS) ---
        try:
            user = User.objects.select_related('school').get(username=username)
        except User.DoesNotExist:
            raise AuthenticationFailed({
                'code': 'user_not_found',
                'message': 'No account found with this username.',
            })

        if not user.check_password(password):
            raise AuthenticationFailed({
                'code': 'invalid_password',
                'message': 'Incorrect password. Please try again.',
            })

        if not user.is_active:
            raise AuthenticationFailed({
                'code': 'account_inactive',
                'message': 'This account has been deactivated. Contact your school administrator.',
            })

        # Superusers (platform staff) bypass school verification entirely.
        if not user.is_superuser and user.school_id is not None:
            if not user.school.is_verified:
                raise PermissionDenied(detail={
                    'code': 'school_pending_verification',
                    'message': (
                        'Your school registration is pending admin verification. '
                        'You will receive access once approved.'
                    ),
                })

        # All checks passed — let SimpleJWT generate & return the token pair.
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['user_id'] = user.id
        token['username'] = user.username
        token['email'] = user.email
        token['full_name'] = user.full_name
        token['role'] = user.role
        token['roles'] = user.roles
        token['school_id'] = user.school_id
        token['school_name'] = user.school.name if user.school else ''
        token['is_superuser'] = user.is_superuser
        token['school_is_verified'] = user.school.is_verified if user.school else True
        return token


class StaffCreateSerializer(serializers.ModelSerializer):
    """
    Used by school admins to create staff accounts (teachers, academic officers, etc.)
    within their own school. The school is injected from request.user.school.
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'roles', 'phone_number']
        read_only_fields = ['id']

    def validate_username(self, value):
        value = value.strip().lower()
        if CustomUser.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_role(self, value):
        # Admins cannot create super-level accounts
        if value not in (CustomUser.Role.ADMIN, CustomUser.Role.TEACHER,
                         CustomUser.Role.PARENT, CustomUser.Role.STUDENT,
                         CustomUser.Role.BURSAR
                         ):
            raise serializers.ValidationError('Invalid role.')
        return value

    def validate_roles(self, value):
        valid = {r.value for r in CustomUser.Role}
        for r in value:
            if r not in valid:
                raise serializers.ValidationError(f'Invalid role value: {r}')
        return value

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def create(self, validated_data):
        school = self.context['request'].user.school
        password = validated_data.pop('password')
        user = CustomUser(school=school, **validated_data)
        user.set_password(password)
        user.save()
        return user


class StaffSerializer(serializers.ModelSerializer):
    """Read / update view for staff members."""

    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'roles', 'phone_number', 'is_active', 'is_verified',
            'date_of_birth', 'created_at',
        ]
        read_only_fields = ['id', 'username', 'email', 'full_name', 'created_at']


class SchoolRegistrationSerializer(serializers.Serializer):
    """
    Genesis serializer — creates a School and its first Admin user atomically.
    If either record fails to save, the entire operation is rolled back.

    Uniqueness is intentionally scoped to *verified* schools/users only.
    Unverified pending registrations do not block legitimate sign-ups.
    """

    # --- School fields ---
    school_name = serializers.CharField(max_length=255)
    registration_number = serializers.CharField(max_length=50)
    school_type = serializers.ChoiceField(choices=School.SchoolType.choices)
    region = serializers.CharField(max_length=100)
    district = serializers.CharField(max_length=100)
    ward = serializers.CharField(max_length=100, required=False, allow_blank=True)

    # --- Admin user fields ---
    email = serializers.EmailField()
    admin_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)

    def validate_registration_number(self, value):
        value = value.strip()
        if not _REG_NO_PATTERN.match(value):
            raise serializers.ValidationError(
                'Invalid registration number. '
                'Expected formats: S.NNNN (secondary), SS.NNNN, AS.NNNN (A-level), '
                'PS-NNNN or P-NNNN (primary). Example: S.0123'
            )
        # Only block if a *verified* school already holds this reg number.
        if School.objects.filter(registration_number__iexact=value, is_verified=True).exists():
            raise serializers.ValidationError(
                'A verified school with this registration number already exists.'
            )
        return value.upper()

    def validate_school_name(self, value):
        # Only block if a *verified* school already uses this name.
        if School.objects.filter(name__iexact=value.strip(), is_verified=True).exists():
            raise serializers.ValidationError(
                'A verified school with this name already exists.'
            )
        return value.strip()

    def validate_email(self, value):
        # Only block if a verified school's admin already owns this email.
        # Teacher/staff emails are intentionally not enforced here.
        if CustomUser.objects.filter(
            email__iexact=value,
            role=CustomUser.Role.ADMIN,
            school__is_verified=True,
        ).exists():
            raise serializers.ValidationError(
                'An admin account with this email already exists for a verified school.'
            )
        return value.lower()

    @transaction.atomic
    def create(self, validated_data):
        # Auto-generate a unique username from the email prefix.
        base = validated_data['email'].split('@')[0].lower()
        base = ''.join(c for c in base if c.isalnum() or c in '._+-@') or 'user'
        username = base
        counter = 1
        while CustomUser.objects.filter(username=username).exists():
            username = f'{base}{counter}'
            counter += 1

        school = School.objects.create(
            name=validated_data['school_name'],
            registration_number=validated_data['registration_number'],
            school_type=validated_data['school_type'],
            region=validated_data['region'],
            district=validated_data['district'],
            ward=validated_data.get('ward', ''),
        )

        admin_user = CustomUser.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            phone_number=validated_data.get('admin_phone', ''),
            school=school,
            role=CustomUser.Role.ADMIN,
        )

        return {'school': school, 'admin': admin_user}
