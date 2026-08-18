"""
academy/sms_admin_views.py
Admin-facing SMS tracking and resend endpoints — lets a school admin see
exactly which parent notifications failed and retry them individually or
in bulk, without re-running the whole broadcast.
"""
from django.core.paginator import Paginator
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.models import SMSLog
from academy.sms import send_sms
from academy.permissions import IsSchoolPaid


def _school_of(request):
    return request.user.school


class SMSLogListView(APIView):
    """
    GET /api/v1/academy/sms-logs/?status=&assessment=&page=
    Paginated list of SMS attempts for this school, most recent first.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school_of(request)
        status_filter = request.query_params.get('status')
        assessment_id = request.query_params.get('assessment')
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 30)), 100)

        qs = SMSLog.objects.filter(school=school).select_related('student', 'assessment')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if assessment_id:
            qs = qs.filter(assessment_id=assessment_id)

        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)

        results = [{
            'id': log.id,
            'parent_phone': log.parent_phone,
            'student_name': log.student.display_name if log.student else None,
            'student_id': log.student_id,
            'assessment_name': log.assessment.name if log.assessment else None,
            'assessment_id': log.assessment_id,
            'message': log.message,
            'status': log.status,
            'error': log.error,
            'created_at': log.created_at.isoformat(),
        } for log in page_obj]

        # Summary counts — shown at the top of the tracking page
        summary = {
            'total': qs.count(),
            'sent': qs.filter(status='sent').count(),
            'failed': qs.filter(status='failed').count(),
            'dry_run': qs.filter(status='dry_run').count(),
        }

        return Response({
            'summary': summary,
            'total': paginator.count,
            'page': page,
            'total_pages': paginator.num_pages,
            'results': results,
        })


class SMSLogResendView(APIView):
    """
    POST /api/v1/academy/sms-logs/<pk>/resend/
    Re-attempts a single failed SMS using its original phone + message text.
    Creates a NEW SMSLog row (keeps the failed one as history) rather than
    mutating the old record, so you always have an audit trail.
    """
    permission_classes = [IsAuthenticated, IsSchoolPaid]

    def post(self, request, pk):
        school = _school_of(request)
        try:
            log = SMSLog.objects.get(pk=pk, school=school)
        except SMSLog.DoesNotExist:
            return Response({'error': 'SMS log not found.'}, status=404)

        result = send_sms(
            log.parent_phone, log.message, school=school,
            student=log.student, assessment=log.assessment,
        )
        return Response({
            'success': result['success'],
            'error': result['error'],
            'message': 'SMS imetumwa upya.' if result['success'] else 'Kutuma upya kumeshindikana.',
        })


class SMSLogBulkResendView(APIView):
    """
    POST /api/v1/academy/sms-logs/bulk-resend/
    Body: { assessment_id?: int }  — if omitted, retries ALL failed SMS for the school.
    Resends every 'failed' log matching the filter. Used for the
    "Tuma Upya Zote Zilizoshindikana" button.
    """
    permission_classes = [IsAuthenticated, IsSchoolPaid]

    def post(self, request):
        school = _school_of(request)
        assessment_id = request.data.get('assessment_id')

        qs = SMSLog.objects.filter(school=school, status='failed')
        if assessment_id:
            qs = qs.filter(assessment_id=assessment_id)

        failed_logs = list(qs)
        resent = 0
        still_failed = 0

        for log in failed_logs:
            result = send_sms(
                log.parent_phone, log.message, school=school,
                student=log.student, assessment=log.assessment,
            )
            if result['success']:
                resent += 1
            else:
                still_failed += 1

        return Response({
            'attempted': len(failed_logs),
            'resent': resent,
            'still_failed': still_failed,
        })