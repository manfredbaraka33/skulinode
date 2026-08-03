from django.urls import path
from . import api_views

urlpatterns = [
    path('sessions/',              api_views.SessionsView.as_view()),
    path('kpis/',                  api_views.NationalKPIView.as_view()),
    path('rankings/',              api_views.RankingsView.as_view()),
    path('school/<str:center_id>/', api_views.SchoolDetailView.as_view()),
    path('regions/',               api_views.RegionalComparisonView.as_view()),
    path('districts/',             api_views.DistrictComparisonView.as_view()),
    path('subjects/',              api_views.SubjectRankingsView.as_view()),
    path('subject-leaderboard/',   api_views.SubjectSchoolLeaderboardView.as_view()),
    path('headlines/',    api_views.HeadlinesView.as_view()),
    path('gender/',        api_views.GenderAnalysisView.as_view()),
    path('hidden-gems/',   api_views.HiddenGemsView.as_view()),
    # path('ownership/',     api_views.OwnershipComparisonView.as_view()),
    path('search/',        api_views.SchoolSearchView.as_view()),
    path('compare/',       api_views.SchoolCompareView.as_view()),
    path('trend/school/<str:center_id>/',   api_views.SchoolTrendView.as_view()),
    path('cards/school/<str:center_id>/',   api_views.SchoolCardView.as_view()),
    path('cards/region/<str:region>/',      api_views.RegionCardView.as_view()),
    path('cards/gem/<str:center_id>/',      api_views.GemCardView.as_view()),
    path('cards/gender/',                   api_views.GenderCardView.as_view()),
    path('cards/subject/<str:subject_name>/', api_views.SubjectCardView.as_view()),
    path('cards/compare/',                  api_views.CompareCardView.as_view()),
]