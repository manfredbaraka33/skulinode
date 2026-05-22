"""
academy/permissions.py
----------------------
Custom DRF permission classes for premium feature gating.
"""
from django.utils import timezone
from rest_framework.permissions import BasePermission


class IsSchoolPaid(BasePermission):
    """
    Grants access only when the requesting user's school has an active, unexpired subscription.

    Rules:
    - Superusers always pass (platform management).
    - Users without a linked school are denied.
    - The school must have ``is_paid=True``.
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

        if not school.is_paid:
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
    Grants access when the school has either ``is_paid`` or ``is_paid_without_sms``
    set to True.  Used to gate downloads, PDF generation, and publishing.
    SMS sending requires the stricter ``IsSchoolPaid`` permission.

    Rules:
    - Superusers always pass.
    - Users without a linked school are denied.
    - ``is_paid`` OR ``is_paid_without_sms`` must be True.
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

        if not (school.is_paid or school.is_paid_without_sms):
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
