from django.urls import path

from academy.pdf_views import MarkSheetPDFView, ReportCardsPDFView, ResultsPDFView
from academy.views import (
    AssessmentDetailView,
    AssessmentListCreateView,
    AssessmentToggleView,
    ClassLevelDetailView,
    ClassLevelListCreateView,
    ClassRoomDetailView,
    ClassRoomListCreateView,
    GradeConfigDetailView,
    GradeConfigListCreateView,
    GradeConfigResetView,
    MarkBulkSaveView,
    MarkListView,
    MarkSubmitView,
    MarkUnlockView,
    MyAssignmentsView,
    PublishResultsView,
    ResultsView,
    SendSMSView,
    StreamDetailView,
    StreamListCreateView,
    StudentBulkUploadView,
    StudentDetailView,
    StudentListCreateView,
    StudentSubjectExclusionDetailView,
    StudentSubjectExclusionListCreateView,
    SubjectAnalyticsView,
    SubjectAssignmentDetailView,
    SubjectAssignmentListCreateView,
    SubjectDetailView,
    SubjectListCreateView,
    SubmissionStatsView,
)

urlpatterns = [
    # Class levels & streams (raw)
    path('class-levels/',               ClassLevelListCreateView.as_view(),               name='class_level_list'),
    path('class-levels/<int:pk>/',      ClassLevelDetailView.as_view(),                   name='class_level_detail'),
    path('streams/',                    StreamListCreateView.as_view(),                   name='stream_list'),
    path('streams/<int:pk>/',           StreamDetailView.as_view(),                       name='stream_detail'),

    # Classes (user-friendly ClassLevel+Stream combo endpoint)
    path('classes/',                    ClassRoomListCreateView.as_view(),                name='classroom_list'),
    path('classes/<int:pk>/',           ClassRoomDetailView.as_view(),                    name='classroom_detail'),

    # Subjects
    path('subjects/',                   SubjectListCreateView.as_view(),                  name='subject_list'),
    path('subjects/<int:pk>/',          SubjectDetailView.as_view(),                      name='subject_detail'),

    # Subject assignments
    path('assignments/',                SubjectAssignmentListCreateView.as_view(),        name='assignment_list'),
    path('assignments/<int:pk>/',       SubjectAssignmentDetailView.as_view(),            name='assignment_detail'),
    path('my-assignments/',             MyAssignmentsView.as_view(),                      name='my_assignments'),

    # Assessments
    path('assessments/',                AssessmentListCreateView.as_view(),               name='assessment_list'),
    path('assessments/<int:pk>/',       AssessmentDetailView.as_view(),                   name='assessment_detail'),
    path('assessments/<int:pk>/toggle/', AssessmentToggleView.as_view(),                  name='assessment_toggle'),

    # Students
    path('students/',                   StudentListCreateView.as_view(),                  name='student_list'),
    path('students/<int:pk>/',          StudentDetailView.as_view(),                      name='student_detail'),
    path('students/bulk/',              StudentBulkUploadView.as_view(),                  name='student_bulk'),
    path('subject-exclusions/',         StudentSubjectExclusionListCreateView.as_view(),  name='exclusion_list'),
    path('subject-exclusions/<int:pk>/', StudentSubjectExclusionDetailView.as_view(),     name='exclusion_detail'),

    # Marks
    path('marks/',                      MarkListView.as_view(),                           name='mark_list'),
    path('marks/bulk/',                 MarkBulkSaveView.as_view(),                       name='mark_bulk'),
    path('marks/submit/',               MarkSubmitView.as_view(),                         name='mark_submit'),
    path('marks/unlock/',               MarkUnlockView.as_view(),                         name='mark_unlock'),

    # Results & analytics
    path('results/',                    ResultsView.as_view(),                            name='results'),
    path('analytics/',                  SubjectAnalyticsView.as_view(),                   name='analytics'),
    path('submission-stats/',           SubmissionStatsView.as_view(),                    name='submission_stats'),
    path('publish/',                    PublishResultsView.as_view(),                     name='publish_results'),
    path('send-sms/',                   SendSMSView.as_view(),                            name='send_sms'),

    # Grade config
    path('grade-configs/',              GradeConfigListCreateView.as_view(),              name='grade_config_list'),
    path('grade-configs/reset/',        GradeConfigResetView.as_view(),                   name='grade_config_reset'),
    path('grade-configs/<int:pk>/',     GradeConfigDetailView.as_view(),                  name='grade_config_detail'),

    # PDF generation (ReportLab backend)
    path('results/pdf/',                ResultsPDFView.as_view(),                         name='results_pdf'),
    path('marks/pdf/',                  MarkSheetPDFView.as_view(),                       name='marksheet_pdf'),
    path('report-cards/pdf/',           ReportCardsPDFView.as_view(),                     name='report_cards_pdf'),
]

