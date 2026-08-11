from django import forms
from django.contrib import admin
from django.urls import path, reverse
from django.shortcuts import render, redirect
from django.contrib import messages
from django.utils.html import format_html

from .models import (
    ExamSession, SchoolCenter, RegionalSummary, DistrictSummary,
    NationalSubjectStat, SubjectSchoolRanking,
)
from .services import import_summary_csv, import_subjects_csv


class CSVUploadForm(forms.Form):
    csv_file = forms.FileField(label='CSV File')


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display  = ['exam_level', 'year', 'is_published','source_base_url', 'center_count',
                     'kpi_summary', 'import_links', 'imported_at']
    list_editable = ['is_published','source_base_url']

    def center_count(self, obj):
        return obj.centers.filter(is_rankable=True).count()
    center_count.short_description = 'Schools'

    def kpi_summary(self, obj):
        k = obj.kpi_data
        if not k:
            return '—'
        return format_html(
            'GPA: {} | Pass: {}% | Districts known: {}',
            k.get('national_weighted_gpa', '—'),
            k.get('national_pass_rate', '—'),
            k.get('schools_with_district', 0),
        )
    kpi_summary.short_description = 'National KPIs'

    def import_links(self, obj):
        return format_html(
            '<a href="{}">Upload Summary CSV</a> | <a href="{}">Upload Subjects CSV</a>',
            reverse('admin:import-summary-csv', args=[obj.pk]),
            reverse('admin:import-subjects-csv', args=[obj.pk]),
        )
    import_links.short_description = 'Import Data'

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('<int:session_id>/import-summary/',
                 self.admin_site.admin_view(self.import_summary_view),
                 name='import-summary-csv'),
            path('<int:session_id>/import-subjects/',
                 self.admin_site.admin_view(self.import_subjects_view),
                 name='import-subjects-csv'),
        ]
        return custom + urls

    def import_summary_view(self, request, session_id):
        session = ExamSession.objects.get(pk=session_id)
        if request.method == 'POST':
            form = CSVUploadForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    result = import_summary_csv(request.FILES['csv_file'], session)
                    k = result['kpis']
                    messages.success(
                        request,
                        f"Imported {result['centers_imported']} centers. "
                        f"National GPA: {k.get('national_weighted_gpa')}, "
                        f"Pass rate: {k.get('national_pass_rate')}%. "
                        f"Unverified regions: {k.get('unverified_regions')}. "
                        f"Schools with district: {k.get('schools_with_district')}/{result['centers_imported']}."
                    )
                except Exception as e:
                    messages.error(request, f'Import failed: {e}')
                return redirect('admin:necta_results_examsession_changelist')
        else:
            form = CSVUploadForm()
        return render(request, 'admin/csv_upload.html', {'form': form, 'title': f'Upload Summary CSV — {session}'})

    def import_subjects_view(self, request, session_id):
        session = ExamSession.objects.get(pk=session_id)
        if request.method == 'POST':
            form = CSVUploadForm(request.POST, request.FILES)
            if form.is_valid():
                try:
                    result = import_subjects_csv(request.FILES['csv_file'], session)
                    messages.success(request, f"Imported {result['subject_rows_imported']} subject rows.")
                except Exception as e:
                    messages.error(request, f'Import failed: {e}')
                return redirect('admin:necta_results_examsession_changelist')
        else:
            form = CSVUploadForm()
        return render(request, 'admin/csv_upload.html', {'form': form, 'title': f'Upload Subjects CSV — {session}'})



@admin.register(SchoolCenter)
class SchoolCenterAdmin(admin.ModelAdmin):
    list_display  = ['center_id', 'center_name', 'center_type','exam_session', 'region', 'district',
                     'region_verified', 'center_gpa', 'national_rank', 'is_rankable']
    list_filter   = ['exam_session', 'center_type', 'region_verified', 'is_rankable', 'region']
    search_fields = ['center_id', 'center_name']
    list_editable = ['district']



@admin.register(RegionalSummary)
class RegionalSummaryAdmin(admin.ModelAdmin):
    list_display = ['region', 'exam_session', 'school_count', 'weighted_gpa', 'pass_rate', 'national_rank']
    list_filter  = ['exam_session']


@admin.register(DistrictSummary)
class DistrictSummaryAdmin(admin.ModelAdmin):
    list_display = ['district', 'region', 'exam_session', 'school_count', 'weighted_gpa', 'national_rank']
    list_filter  = ['exam_session', 'region']


@admin.register(NationalSubjectStat)
class NationalSubjectStatAdmin(admin.ModelAdmin):
    list_display = ['subject_name', 'exam_session', 'weighted_gpa', 'total_sat', 'national_rank']
    list_filter  = ['exam_session']


@admin.register(SubjectSchoolRanking)
class SubjectSchoolRankingAdmin(admin.ModelAdmin):
    list_display  = ['subject_name', 'raw_center_id', 'region', 'district', 'subject_gpa',
                     'national_subject_rank', 'regional_subject_rank', 'district_subject_rank']
    list_filter   = ['exam_session', 'subject_name', 'region']
    search_fields = ['raw_center_id', 'subject_name']


# from .models import OwnershipSummary   # add to existing import line

# @admin.register(OwnershipSummary)
# class OwnershipSummaryAdmin(admin.ModelAdmin):
#     list_display = ['ownership_type', 'exam_session', 'school_count', 'weighted_gpa', 'pass_rate']
#     list_filter  = ['exam_session', 'ownership_type']