from django.urls import path
from . import api_views

urlpatterns = [
    path('cycles/',       api_views.TCUCyclesView.as_view()),
    path('institutions/', api_views.TCUInstitutionsView.as_view()),
    path('calculate/',    api_views.TCUCalculateView.as_view()),
]