from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from core.models import CustomUser, School


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ['name', 'registration_number', 'school_type', 'region', 'is_active', 'is_paid', 'is_paid_without_sms', 'subscription_expires_at']
    list_filter = ['school_type', 'region', 'is_active', 'is_paid', 'is_paid_without_sms']
    search_fields = ['name', 'registration_number']
    list_editable = ['is_paid', 'is_paid_without_sms', 'subscription_expires_at']
    list_display_links = ['name']


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'full_name', 'school', 'role', 'is_active', 'is_verified']
    list_filter = ['role', 'is_active', 'is_verified', 'school__school_type']
    search_fields = ['email', 'first_name', 'last_name', 'national_id']
    ordering = ['email']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('SkuliNode Profile', {
            'fields': ('school', 'role', 'phone_number', 'national_id', 'date_of_birth', 'is_verified'),
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )
