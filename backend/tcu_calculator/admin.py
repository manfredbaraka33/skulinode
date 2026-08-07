from django.contrib import admin
from .models import TCUAdmissionCycle, TCUInstitution, TCUProgramme


@admin.register(TCUAdmissionCycle)
class TCUAdmissionCycleAdmin(admin.ModelAdmin):
    list_display = ['academic_year', 'is_published', 'institution_count', 'programme_count', 'imported_at']
    list_editable = ['is_published']

    def institution_count(self, obj):
        return obj.institutions.count()

    def programme_count(self, obj):
        return TCUProgramme.objects.filter(institution__cycle=obj).count()


@admin.register(TCUInstitution)
class TCUInstitutionAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'cycle', 'programme_count','ownership','application_url']
    list_filter = ['cycle','ownership']
    list_editable = ['ownership', 'application_url']
    search_fields = ['name', 'location']

    def programme_count(self, obj):
        return obj.programmes.count()


@admin.register(TCUProgramme)
class TCUProgrammeAdmin(admin.ModelAdmin):
    list_display = ['programme_name' ,'category', 'institution', 'min_points_total', 'status', 'health_override_mismatch']
    list_filter = ['status','category', 'health_override_mismatch', 'institution__cycle']
    search_fields = ['programme_name', 'programme_code', 'institution__name']
    list_editable = ['category']