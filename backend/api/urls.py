from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from core.views import (
    ChangeOwnPasswordView,
    CheckSchoolVerificationView,
    CustomTokenObtainPairView,
    RegisterSchoolView,
    RegisterUserView,
    SchoolDetailView,
    SchoolListView,
    StaffDetailView,
    StaffListCreateView,
    StaffResetPasswordView,
    UserProfileView,
    SignatureUploadView
)
from api.views import FeedbackCreateView

urlpatterns = [
    # JWT auth endpoints
    path('auth/token/',                CustomTokenObtainPairView.as_view(),       name='token_obtain_pair'),
    path('auth/token/refresh/',        TokenRefreshView.as_view(),               name='token_refresh'),
    path('auth/token/verify/',         TokenVerifyView.as_view(),                name='token_verify'),
    path('auth/register/',             RegisterUserView.as_view(),               name='register'),
    path('auth/register-school/',      RegisterSchoolView.as_view(),             name='register_school'),
    path('auth/check-verification/',   CheckSchoolVerificationView.as_view(),    name='check_verification'),

    # Core app endpoints
    path('user/profile/',          UserProfileView.as_view(),          name='user_profile'),
    path('user/change-password/',  ChangeOwnPasswordView.as_view(),    name='user_change_password'),
    path('school/',                SchoolDetailView.as_view(),         name='school_detail'),
    path('schools/',               SchoolListView.as_view(),           name='school_list'),

    # Staff management (school admin only)
    path('users/',              StaffListCreateView.as_view(),       name='staff_list_create'),
    path('users/<int:pk>/',     StaffDetailView.as_view(),           name='staff_detail'),
    path('users/<int:pk>/reset-password/', StaffResetPasswordView.as_view(), name='staff_reset_password'),

    # Academy app
    path('academy/', include('academy.urls')),

    # Feedback
    path('feedback/', FeedbackCreateView.as_view(), name='feedback_create'),

    # Signature
    path('auth/signature/', SignatureUploadView.as_view(), name='signature_upload'),
]
