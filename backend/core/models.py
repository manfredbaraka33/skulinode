from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class CustomUserManager(BaseUserManager):
    """Custom manager — username is the unique identifier for authentication."""

    def create_user(self, username, email='', password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set.')
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email='', password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, email, password, **extra_fields)


class School(models.Model):
    """Top-level tenant model. Every piece of data in the system belongs to a School."""

    class SchoolType(models.TextChoices):
        PRIMARY = 'PRIMARY', 'Primary School'
        ORDINARY = 'ORDINARY', 'Ordinary Secondary — O-Level'
        ADVANCED = 'ADVANCED', 'Advanced Secondary — A-Level'
        COMBINED = 'COMBINED', 'Combined Ordinary & Advanced (O+A Level)'

    name = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='School Name',
        help_text='The official registered school name.',
    )
    registration_number = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Registration Number',
        help_text='The official NECTA/MoE registration number (e.g. "S.0123" for secondary, "PS-0123" for primary).',
    )
    school_type = models.CharField(
        max_length=20,
        choices=SchoolType.choices,
        default=SchoolType.PRIMARY,
        verbose_name='School Type',
    )
    region = models.CharField(
        max_length=100,
        verbose_name='Region',
        help_text='The administrative region in Tanzania (e.g. "Mwanza", "Dar es Salaam").',
    )
    district = models.CharField(
        max_length=100,
        verbose_name='District',
    )
    ward = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Ward',
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name='Phone Number')
    email = models.EmailField(blank=True, verbose_name='School Email')
    website = models.URLField(blank=True, verbose_name='Website')
    po_box = models.CharField(max_length=50, blank=True, verbose_name='P.O. Box')
    logo = models.ImageField(upload_to='school_logos/', null=True, blank=True, verbose_name='Logo')
    show_logo = models.BooleanField(
        default=False,
        verbose_name='Show Logo on Documents',
        help_text='When enabled, the school logo appears on printed reports and PDFs.',
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Is Active',
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Is Verified',
        help_text=(
            'Manually toggled by admin after reviewing the school registration. '
            'Unverified schools are blocked from logging in.'
        ),
    )

    PLAN_CHOICES = [
        ('free', 'Free'),
        ('basic', 'Basic'),
        ('standard', 'Standard'),
        ('pro', 'Pro'),
    ]
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default='free',
        verbose_name='Plan',
        help_text='Subscription plan that controls feature access for this school.',
    )
    subscription_expires_at = models.DateField(
        null=True,
        blank=True,
        verbose_name='Subscription Expires At',
        help_text='Leave blank for no expiry limit.',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Created At',
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Updated At',
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'School'
        verbose_name_plural = 'Schools'

    def __str__(self):
        return f"{self.name} ({self.registration_number})"


class CustomUser(AbstractUser):
    """All users across all tenants. Isolated by the school foreign key."""

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'School Admin'
        TEACHER = 'TEACHER', 'Teacher'
        PARENT = 'PARENT', 'Parent/Guardian'
        STUDENT = 'STUDENT', 'Student'

    objects = CustomUserManager()

    email = models.EmailField(
        unique=True,
        verbose_name='Email Address',
        help_text='Used as the login identifier.',
    )
    school = models.ForeignKey(
        School,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        verbose_name='School',
        help_text='Null only for system-level superusers.',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        verbose_name='Role',
    )
    roles = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Additional Roles',
        help_text='Extra roles this user holds (e.g. an admin who also teaches).',
    )
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        verbose_name='Phone Number',
        help_text='e.g. +255712345678',
    )
    national_id = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='National ID',
        help_text='Tanzanian NIDA number.',
    )
    date_of_birth = models.DateField(
        null=True,
        blank=True,
        verbose_name='Date of Birth',
    )
    profile_picture = models.ImageField(
        upload_to='profiles/',
        null=True,
        blank=True,
        verbose_name='Profile Picture',
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Is Verified',
        help_text='Email/phone verification status.',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Created At',
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Updated At',
    )

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    @property
    def full_name(self):
        """Return the user's full name."""
        return f"{self.first_name} {self.last_name}".strip()

    def has_role(self, role_code):
        """Return True if this user holds the given role (primary or additional)."""
        return self.role == role_code or role_code in (self.roles or [])

    class Meta:
        ordering = ['last_name', 'first_name']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.full_name} <{self.email}> [{self.get_role_display()}]"
