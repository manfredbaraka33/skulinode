from django.contrib import admin
from .models import Feedback


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['submitted_at', 'school', 'name', 'email', 'subject', 'rating']
    list_filter = ['rating', 'submitted_at', 'school__school_type']
    search_fields = ['name', 'email', 'subject', 'message', 'school__name']
    readonly_fields = ['submitted_at', 'school', 'name', 'email', 'subject', 'message', 'rating']
    date_hierarchy = 'submitted_at'

    def has_add_permission(self, request):
        return False  # Feedback is submitted via the app, not manually
