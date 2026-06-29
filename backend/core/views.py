from rest_framework import parsers, status
from rest_framework.exceptions import NotFound
from rest_framework.generics import (
    CreateAPIView, ListAPIView, RetrieveUpdateAPIView,
    ListCreateAPIView, RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser

from core.models import CustomUser, School
from core.serializers import (
    CustomTokenObtainPairSerializer,
    SchoolRegistrationSerializer,
    SchoolSerializer,
    StaffCreateSerializer,
    StaffSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


class IsSchoolAdmin(BasePermission):
    """Allow access only to users with the ADMIN role who belong to a school."""

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == CustomUser.Role.ADMIN
            and request.user.school_id is not None
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """Returns JWT access and refresh tokens with custom SkuliNode claims."""

    serializer_class = CustomTokenObtainPairSerializer


class RegisterUserView(CreateAPIView):
    """Create a new user account. Open to unauthenticated requests."""

    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            {'message': 'User registered successfully.', 'user_id': instance.id},
            status=status.HTTP_201_CREATED,
        )


class UserProfileView(RetrieveUpdateAPIView):
    """Retrieve or partially update the currently authenticated user's profile."""

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class SchoolListView(ListAPIView):
    """List all active schools."""

    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated]
    queryset = School.objects.filter(is_active=True)


class RegisterSchoolView(APIView):
    """
    Genesis endpoint — registers a new school tenant and its first admin user
    in a single atomic operation. Publicly accessible (no auth required).

    POST /api/v1/auth/register-school/
    """

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = SchoolRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        school = result['school']
        admin = result['admin']

        return Response(
            {
                'message': 'School registered successfully. Your account is pending admin verification.',
                'school_id': school.id,
                'school_name': school.name,
                'admin_id': admin.id,
                'admin_email': admin.email,
                'admin_username': admin.username,
            },
            status=status.HTTP_201_CREATED,
        )


class CheckSchoolVerificationView(APIView):
    """
    GET /api/v1/auth/check-verification/?username=<username>

    Public endpoint — returns whether the school that owns a given username
    has been verified by the admin. Used by the pending-verification page to
    poll for approval without exposing any sensitive data.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        username = request.query_params.get('username', '').strip()
        if not username:
            return Response({'verified': False})

        try:
            user = CustomUser.objects.select_related('school').get(username=username)
        except CustomUser.DoesNotExist:
            return Response({'verified': False})

        verified = bool(user.school and user.school.is_verified)
        return Response({'verified': verified})


class StaffListCreateView(ListCreateAPIView):
    """
    GET  /api/v1/users/  — list all staff in the admin's school
    POST /api/v1/users/  — create a new staff member in the admin's school
    """

    permission_classes = [IsSchoolAdmin]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StaffCreateSerializer
        return StaffSerializer

    def get_queryset(self):
        return CustomUser.objects.filter(
            school=self.request.user.school
        ).order_by('last_name', 'first_name')


class StaffDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH /api/v1/users/{id}/  — retrieve or update a staff member
    DELETE        /api/v1/users/{id}/  — deactivate (set is_active=False) a staff member
    """

    serializer_class = StaffSerializer
    permission_classes = [IsSchoolAdmin]

    def get_queryset(self):
        return CustomUser.objects.filter(school=self.request.user.school)

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: deactivate rather than drop the record."""
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class StaffResetPasswordView(APIView):
    """
    POST /api/v1/users/{id}/reset-password/
    Body: { "password": "newpassword" }
    Admin resets a staff member's password.
    """

    permission_classes = [IsSchoolAdmin]

    def post(self, request, pk, *args, **kwargs):
        try:
            user = CustomUser.objects.get(pk=pk, school=request.user.school)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        password = request.data.get('password', '')
        if len(password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)


class ChangeOwnPasswordView(APIView):
    """
    POST /api/v1/user/change-password/
    Body: { "old_password": "...", "new_password": "..." }
    Any authenticated user changes their own password.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not old_password or not new_password:
            return Response(
                {'error': 'Both old_password and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(old_password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if old_password == new_password:
            return Response(
                {'error': 'New password must differ from the current password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class SchoolDetailView(RetrieveUpdateAPIView):
    """
    GET   /api/v1/school/  — retrieve the authenticated user's school details.
    PATCH /api/v1/school/  — update editable school fields (name, contact, location, logo).
    """

    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_object(self):
        school = self.request.user.school
        if not school:
            raise NotFound('No school is linked to this account.')
        return school

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class SignatureUploadView(APIView):
    """
    POST /api/v1/auth/signature/
    Upload or replace the current user's signature image.
    DELETE /api/v1/auth/signature/
    Remove the signature.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('signature')
        if not file:
            return Response({'error': 'No file provided.'}, status=400)
            
        allowed = ['image/jpeg', 'image/png', 'image/webp']
        if file.content_type not in allowed:
            return Response({'error': 'Only JPEG, PNG or WEBP allowed.'}, status=400)
        if file.size > 2 * 1024 * 1024:
            return Response({'error': 'File must be under 2MB.'}, status=400)
            
        user = request.user
        if user.signature:
            try:
                user.signature.delete(save=False)
            except Exception:
                pass

        from PIL import Image
        import io
        from django.core.files.base import ContentFile

        try:
            with Image.open(file) as img:
                # 1. Convert to RGBA and apply simple color-based background removal
                img = img.convert("RGBA")
                datas = img.getdata()
                newData = []
                for item in datas:
                    # If pixel is mostly white/light (background), make it transparent
                    if item[0] > 200 and item[1] > 200 and item[2] > 200:
                        newData.append((255, 255, 255, 0))
                    else:
                        # Convert dark ink pixels to pure black for the "superfine" look
                        newData.append((0, 0, 0, 255))
                
                img.putdata(newData)

                # 2. Save as high-quality transparent PNG
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                buffer.seek(0)
                processed_file = ContentFile(buffer.getvalue(), name=f"{user.id}_signature.png")
                
                user.signature = processed_file
        except Exception:
            # Fallback to original file if processing fails
            user.signature = file

        user.save(update_fields=['signature'])
        
        return Response({
            'signature_url': request.build_absolute_uri(user.signature.url)
            if user.signature else None
        })

    def delete(self, request):
        user = request.user
        if user.signature:
            try:
                user.signature.delete(save=False)
            except Exception:
                pass
            user.signature = None
            user.save(update_fields=['signature'])
        return Response({'deleted': True})