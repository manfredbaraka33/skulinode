from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin

from core.models import CustomUser, School


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'registration_number', 'school_type', 'region',
        'is_verified', 'is_active', 'plan', 'subscription_expires_at', 'created_at',
    ]
    list_filter = ['is_verified', 'school_type', 'region', 'is_active', 'plan']
    search_fields = ['name', 'registration_number']
    list_editable = ['is_verified', 'plan', 'subscription_expires_at']
    list_display_links = ['name']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['mark_verified', 'mark_unverified']

    def save_model(self, request, obj, form, change):
        """Sync CustomUser.is_verified whenever the School record is saved."""
        super().save_model(request, obj, form, change)
        if 'is_verified' in form.changed_data:
            obj.users.all().update(is_verified=obj.is_verified)

    @admin.action(description='Mark selected schools as verified (grant login access)')
    def mark_verified(self, request, queryset):
        school_ids = list(queryset.values_list('id', flat=True))
        queryset.update(is_verified=True)
        users_updated = CustomUser.objects.filter(school_id__in=school_ids).update(is_verified=True)
        self.message_user(
            request,
            f'{len(school_ids)} school(s) verified; {users_updated} user(s) synced.',
            messages.SUCCESS,
        )

    @admin.action(description='Revoke verification for selected schools')
    def mark_unverified(self, request, queryset):
        school_ids = list(queryset.values_list('id', flat=True))
        queryset.update(is_verified=False)
        users_updated = CustomUser.objects.filter(school_id__in=school_ids).update(is_verified=False)
        self.message_user(
            request,
            f'{len(school_ids)} school(s) unverified; {users_updated} user(s) synced.',
            messages.WARNING,
        )


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
