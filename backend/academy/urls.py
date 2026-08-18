from django.urls import path

from academy.pdf_views import (
    CombinedReportCardsPDFView,
    CombinedResultsPDFView,
    MarkSheetPDFView,
    ReportCardsPDFView,
    ResultsPDFView,
)
from academy.views import (
    AssessmentDetailView,
    AssessmentListCreateView,
    AssessmentToggleView,
    CombinedResultsView,
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

from academy.comment_views import (
    CommentTemplateListView, CommentTemplateDetailView,
    SystemCommentTemplatesView, GenerateCommentsView,
    StudentCommentListView, StudentCommentSaveView, CommentPreviewView,
    CommentClearView
)


from academy.finance_views import (
    FeeDefinitionListCreateView, FeeDefinitionDetailView,
    FeePhaseListCreateView, FeePhaseDetailView,
    StudentFeeRecordListView, FeeRecordGenerateView,
    FeeRecordPaymentView, FeeRecordUpdateView,
    FeeDebtReportView, FeeDebtReportCSVView,
)

from academy.combined_views import (
    ClassMasterListCreateView, ClassMasterDetailView, MyClassMasterStreamsView,
    CombinedSnapshotListView, PublishCombinedResultsView, CombinedSnapshotDetailView,
)

from academy.circular_views import CircularListCreateView, CircularDetailView

from academy.pdf_views import CircularPDFView

from academy.sms_admin_views import SMSLogListView, SMSLogResendView, SMSLogBulkResendView

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
    path('results/combined/',           CombinedResultsView.as_view(),                    name='results_combined'),
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
    path('results/combined/pdf/',       CombinedResultsPDFView.as_view(),                 name='results_combined_pdf'),
    path('marks/pdf/',                  MarkSheetPDFView.as_view(),                       name='marksheet_pdf'),
    path('report-cards/pdf/',           ReportCardsPDFView.as_view(),                     name='report_cards_pdf'),
    path('report-cards/combined/pdf/',  CombinedReportCardsPDFView.as_view(),             name='report_cards_combined_pdf'),

    # Comment templates (user settings)
    path('comment-templates/',           CommentTemplateListView.as_view(),    name='comment_template_list'),
    path('comment-templates/system/',    SystemCommentTemplatesView.as_view(), name='comment_template_system'),
    path('comment-templates/<int:pk>/',  CommentTemplateDetailView.as_view(),  name='comment_template_detail'),
    path('comments/clear/', CommentClearView.as_view(), name='comment_clear'),

    # Student comments
    path('comments/',                    StudentCommentSaveView.as_view(),     name='comment_save'),
    path('comments/<int:pk>/',           StudentCommentSaveView.as_view(),     name='comment_update'),
    path('comments/generate/',           GenerateCommentsView.as_view(),       name='comment_generate'),
    path('comments/list/',               StudentCommentListView.as_view(),     name='comment_list'),
    path('comments/preview/',            CommentPreviewView.as_view(),         name='comment_preview'),

# Finance — fee definitions
    path('fee-definitions/',            FeeDefinitionListCreateView.as_view(),  name='fee_def_list'),
    path('fee-definitions/<int:pk>/',   FeeDefinitionDetailView.as_view(),      name='fee_def_detail'),

    # Finance — fee phases (awamu)
    path('fee-phases/',                 FeePhaseListCreateView.as_view(),       name='fee_phase_list'),
    path('fee-phases/<int:pk>/',        FeePhaseDetailView.as_view(),           name='fee_phase_detail'),

    # Finance — student records
    path('fee-records/',                StudentFeeRecordListView.as_view(),     name='fee_record_list'),
    path('fee-records/generate/',       FeeRecordGenerateView.as_view(),        name='fee_record_generate'),
    path('fee-records/<int:pk>/payment/', FeeRecordPaymentView.as_view(),       name='fee_record_payment'),
    path('fee-records/<int:pk>/',       FeeRecordUpdateView.as_view(),          name='fee_record_update'),

    # Finance — debt reports
    path('fee-reports/',                FeeDebtReportView.as_view(),            name='fee_report'),
    path('fee-reports/csv/',            FeeDebtReportCSVView.as_view(),         name='fee_report_csv'),
    # Class master assignments
    path('class-masters/',                ClassMasterListCreateView.as_view(),  name='class_master_list'),
    path('class-masters/<int:pk>/',       ClassMasterDetailView.as_view(),      name='class_master_detail'),
    path('my-class-master-streams/',      MyClassMasterStreamsView.as_view(),   name='my_class_master_streams'),

    # Combined results snapshots
    path('combined-snapshots/',           CombinedSnapshotListView.as_view(),  name='combined_snapshot_list'),
    path('combined-snapshots/publish/',   PublishCombinedResultsView.as_view(),name='combined_snapshot_publish'),
    path('combined-snapshots/<int:pk>/',  CombinedSnapshotDetailView.as_view(),name='combined_snapshot_detail'),

    # Term circulars
    path('circulars/',            CircularListCreateView.as_view(), name='circular_list'),
    path('circulars/<int:pk>/',   CircularDetailView.as_view(),     name='circular_detail'),
    path('circulars/<int:pk>/pdf/', CircularPDFView.as_view(),      name='circular_pdf'),


    path('sms-logs/',                    SMSLogListView.as_view(),        name='sms_log_list'),
    path('sms-logs/<int:pk>/resend/',    SMSLogResendView.as_view(),      name='sms_log_resend'),
    path('sms-logs/bulk-resend/',        SMSLogBulkResendView.as_view(),  name='sms_log_bulk_resend'),
]



