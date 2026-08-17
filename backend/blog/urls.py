from django.urls import path
from . import api_views

urlpatterns = [
    path('categories/',       api_views.BlogCategoriesView.as_view()),
    path('list/',             api_views.BlogListView.as_view()),
    path('post/<slug:slug>/', api_views.BlogDetailView.as_view()),
]