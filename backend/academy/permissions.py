"""
academy/permissions.py
----------------------
Custom DRF permission classes for premium feature gating.

Plan hierarchy (lowest → highest): free < basic < standard < pro
- IsSchoolPaid             → plan == 'pro'   (SMS, full access)
- IsSchoolPaidOrDownloadOnly → plan in ('standard', 'pro')  (PDF/CSV/report cards)
"""
from django.utils import timezone
from rest_framework.permissions import BasePermission


class IsSchoolPaid(BasePermission):
    """
    Grants access only when the requesting user's school has plan='pro' and an
    unexpired subscription.

    Rules:
    - Superusers always pass (platform management).
    - Users without a linked school are denied.
    - The school must have ``plan='pro'``.
    - If ``subscription_expires_at`` is set, it must be today or in the future.
    """

    message = (
        'Your school subscription is inactive or expired. '
        'Please contact your administrator to activate access to this feature.'
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        school = getattr(request.user, 'school', None)
        if not school:
            return False

        if school.plan != 'pro':
            return False

        if school.subscription_expires_at is not None:
            if school.subscription_expires_at < timezone.now().date():
                self.message = (
                    'Your school subscription expired on '
                    f'{school.subscription_expires_at}. '
                    'Contact your administrator to renew.'
                )
                return False

        return True


class IsSchoolPaidOrDownloadOnly(BasePermission):
    """
    Grants access when the school has plan='standard' or plan='pro'.
    Used to gate downloads, PDF generation, report cards, and publishing.
    SMS sending requires the stricter ``IsSchoolPaid`` (pro-only) permission.

    Rules:
    - Superusers always pass.
    - Users without a linked school are denied.
    - ``plan`` must be 'standard' or 'pro'.
    - If ``subscription_expires_at`` is set, it must be today or in the future.
    """

    message = (
        'Your school subscription is inactive or expired. '
        'Please contact your administrator to activate access to this feature.'
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        school = getattr(request.user, 'school', None)
        if not school:
            return False

        if school.plan not in ('standard', 'pro'):
            return False

        if school.subscription_expires_at is not None:
            if school.subscription_expires_at < timezone.now().date():
                self.message = (
                    'Your school subscription expired on '
                    f'{school.subscription_expires_at}. '
                    'Contact your administrator to renew.'
                )
                return False

        return True
