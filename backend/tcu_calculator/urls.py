from django.urls import path
from . import api_views

urlpatterns = [
    path('cycles/',       api_views.TCUCyclesView.as_view()),
    path('institutions/', api_views.TCUInstitutionsView.as_view()),
    path('calculate/',    api_views.TCUCalculateView.as_view()),
    path('cycles/',              api_views.TCUCyclesView.as_view()),
    path('institutions/',        api_views.TCUInstitutionsView.as_view()),
    path('calculate/',           api_views.TCUCalculateView.as_view()),
    path('insights/',            api_views.TCUInsightsView.as_view()),
    path('guidebook/',           api_views.TCUGuidebookDownloadView.as_view()),
    path('compare-programmes/',  api_views.TCUProgrammeCompareView.as_view()),
    path('search-programmes/',   api_views.TCUProgrammeSearchView.as_view()),
]