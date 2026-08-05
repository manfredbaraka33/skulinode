import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.permissions import IsSchoolPaid, IsSchoolPaidOrDownloadOnly
from academy.combined import build_combined_results_data, CombinedResultsValidationError

from academy.grading import (
    get_division, get_grade, get_gpa,
    get_grade_from_configs, compute_student_summary,
    NECTA_DEFAULTS,
)
from academy.models import (
    Assessment, ClassLevel, GradeConfig, Mark, ResultsPublication, SMSLog,
    Stream, Student, StudentSubjectExclusion, Subject, SubjectAssignment,
)
from academy.serializers import (
    AssessmentSerializer,
    BulkMarkSerializer,
    BulkStudentRowSerializer,
    ClassLevelSerializer,
    GradeConfigSerializer,
    MarkSerializer,
    StreamSerializer,
    StudentSerializer,
    StudentSubjectExclusionSerializer,
    SubjectAssignmentSerializer,
    SubjectSerializer,
)
from core.models import CustomUser


def school_of(request):
    return request.user.school


# ── ClassLevel ────────────────────────────────────────────────────────────────

class ClassLevelListCreateView(ListCreateAPIView):
    serializer_class = ClassLevelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClassLevel.objects.filter(school=school_of(self.request))


class ClassLevelDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ClassLevelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClassLevel.objects.filter(school=school_of(self.request))


# ── Stream ────────────────────────────────────────────────────────────────────

class StreamListCreateView(ListCreateAPIView):
    serializer_class = StreamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Stream.objects.filter(school=school_of(self.request)).select_related('class_level')
        class_level = self.request.query_params.get('class_level')
        if class_level:
            qs = qs.filter(class_level_id=class_level)
        return qs


class StreamDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = StreamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Stream.objects.filter(school=school_of(self.request))


# ── Subject ───────────────────────────────────────────────────────────────────

class SubjectListCreateView(ListCreateAPIView):
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Subject.objects.filter(school=school_of(self.request))


class SubjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Subject.objects.filter(school=school_of(self.request))


# ── SubjectAssignment ─────────────────────────────────────────────────────────

class SubjectAssignmentListCreateView(ListCreateAPIView):
    serializer_class = SubjectAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SubjectAssignment.objects.filter(
            school=school_of(self.request)
        ).select_related('teacher', 'subject', 'stream__class_level')
        teacher = self.request.query_params.get('teacher')
        stream = self.request.query_params.get('stream')
        if teacher:
            qs = qs.filter(teacher_id=teacher)
        if stream:
            qs = qs.filter(stream_id=stream)
        return qs


class SubjectAssignmentDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SubjectAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SubjectAssignment.objects.filter(school=school_of(self.request))


class MyAssignmentsView(APIView):
    """Teacher: list their own subject assignments."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assignments = SubjectAssignment.objects.filter(
            school=school_of(request),
            teacher=request.user,
        ).select_related('subject', 'stream__class_level')
        return Response(SubjectAssignmentSerializer(assignments, many=True).data)


# ── Assessment ────────────────────────────────────────────────────────────────

class AssessmentListCreateView(ListCreateAPIView):
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Assessment.objects.filter(school=school_of(self.request))


class AssessmentDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Assessment.objects.filter(school=school_of(self.request))


class AssessmentToggleView(APIView):
    """Toggle is_active on an assessment."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            assessment = Assessment.objects.get(pk=pk, school=school_of(request))
        except Assessment.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        assessment.is_active = not assessment.is_active
        assessment.save(update_fields=['is_active'])
        return Response(AssessmentSerializer(assessment).data)


# ── Student ───────────────────────────────────────────────────────────────────

class StudentListCreateView(ListCreateAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Student.objects.filter(school=school_of(self.request)).select_related('stream__class_level')
        stream = self.request.query_params.get('stream')
        if stream:
            qs = qs.filter(stream_id=stream)
        return qs.order_by('gender','first_name')
    
    def list(self, request, *args, **kwargs):
        # 4. ADDED: Check for ?all=true to bypass pagination safely
        if request.query_params.get('all') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'count':   queryset.count(),
                'results': serializer.data,
            })
            
        # Otherwise, perform standard paginated listing
        return super().list(request, *args, **kwargs)


class StudentDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Student.objects.filter(school=school_of(self.request))


class StudentSubjectExclusionListCreateView(ListCreateAPIView):
    serializer_class = StudentSubjectExclusionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = StudentSubjectExclusion.objects.filter(school=school_of(self.request))
        student = self.request.query_params.get('student')
        if student:
            qs = qs.filter(student_id=student)
        return qs


class StudentSubjectExclusionDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = StudentSubjectExclusionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return StudentSubjectExclusion.objects.filter(school=school_of(self.request))


# ── Marks ─────────────────────────────────────────────────────────────────────

class MarkListView(APIView):
    """
    GET /api/v1/academy/marks/?subject=&stream=&assessment=
    Returns students in the stream with their current marks for the given subject+assessment.
    Excludes students who have a StudentSubjectExclusion for this subject.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subject_id = request.query_params.get('subject')
        stream_id = request.query_params.get('stream')
        assessment_id = request.query_params.get('assessment')

        if not all([subject_id, stream_id, assessment_id]):
            return Response({'error': 'subject, stream, assessment required.'}, status=400)

        school = school_of(request)

        # Excluded students for this subject
        excluded_ids = set(
            StudentSubjectExclusion.objects.filter(
                school=school, subject_id=subject_id
            ).values_list('student_id', flat=True)
        )

        students = Student.objects.filter(
            school=school, stream_id=stream_id
        ).exclude(id__in=excluded_ids).order_by('gender','first_name')

        # Fetch existing marks
        marks_map = {
            m.student_id: m
            for m in Mark.objects.filter(
                school=school,
                subject_id=subject_id,
                assessment_id=assessment_id,
                student__in=students,
            )
        }

        rows = []
        for s in students:
            mark = marks_map.get(s.id)
            rows.append({
                'student_id': s.id,
                'student_name': s.display_name,
                'gender': s.gender,
                'mark_id': mark.id if mark else None,
                'score': str(mark.score) if mark and mark.score is not None else None,
                'grade': get_grade(mark.score if mark else None),
                'is_submitted': mark.is_submitted if mark else False,
                'is_returned': mark.is_returned if mark else False,
            })

        return Response(rows)


class MarkBulkSaveView(APIView):
    """
    POST /api/v1/academy/marks/bulk/
    Save/update marks for a subject+stream+assessment. Marks not yet submitted can be updated.
    Body: {subject, assessment, stream, marks: [{student_id, score},...]}
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        school = school_of(request)
        subject_id = request.data.get('subject')
        assessment_id = request.data.get('assessment')
        marks_data = request.data.get('marks', [])

        for row in marks_data:
            student_id = row.get('student_id')
            score_raw = row.get('score')
            score = Decimal(str(score_raw)) if score_raw not in (None, '', 'null') else None

            Mark.objects.update_or_create(
                school=school,
                student_id=student_id,
                subject_id=subject_id,
                assessment_id=assessment_id,
                defaults={
                    'teacher': request.user,
                    'score': score,
                    'is_returned': False,
                }
            )

        return Response({'message': 'Marks saved.'})


class MarkSubmitView(APIView):
    """
    POST /api/v1/academy/marks/submit/
    Lock (submit) all marks for a subject+stream+assessment.
    Body: {subject, assessment, stream}
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        school = school_of(request)
        subject_id = request.data.get('subject')
        assessment_id = request.data.get('assessment')
        stream_id = request.data.get('stream')

        count = Mark.objects.filter(
            school=school,
            subject_id=subject_id,
            assessment_id=assessment_id,
            student__stream_id=stream_id,
            is_submitted=False,
        ).update(is_submitted=True, submitted_at=timezone.now(), is_returned=False)

        return Response({'message': f'{count} marks submitted.'})


class MarkUnlockView(APIView):
    """
    POST /api/v1/academy/marks/unlock/
    Admin only — reset submitted marks to draft for a subject+stream+assessment.
    Body: {subject, assessment, stream}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.role == 'ADMIN' or 'ADMIN' in (request.user.roles or [])):
            return Response({'error': 'Only admins can unlock submitted marks.'}, status=403)
        school = school_of(request)
        subject_id = request.data.get('subject')
        assessment_id = request.data.get('assessment')
        stream_id = request.data.get('stream')
        if not subject_id or not assessment_id or not stream_id:
            return Response({'error': 'subject, assessment and stream are required.'}, status=400)

        count = Mark.objects.filter(
            school=school,
            subject_id=subject_id,
            assessment_id=assessment_id,
            student__stream_id=stream_id,
            is_submitted=True,
        ).update(is_submitted=False, submitted_at=None, is_returned=True)

        return Response({'message': f'{count} marks unlocked for re-editing.'})


# ── Results ───────────────────────────────────────────────────────────────────

class ResultsView(APIView):
    """
    GET /api/v1/academy/results/?assessment=&stream=
    Live standings for all students in a stream for an assessment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assessment_id = request.query_params.get('assessment')
        stream_id = request.query_params.get('stream')

        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)

        school = school_of(request)
        school_type = school.school_type  # 'PRIMARY', 'ORDINARY', 'ADVANCED', 'COMBINED'

        # Non-admins (teachers) may only view published results
        is_admin = request.user.role == 'ADMIN' or 'ADMIN' in (request.user.roles or [])
        if not is_admin:
            is_published = ResultsPublication.objects.filter(
                school=school, assessment_id=assessment_id, stream_id=stream_id,
            ).exists()
            if not is_published:
                return Response(
                    {'error': 'Results have not been published yet.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # School-specific grade configs (sorted descending by min_score)
        grade_configs = list(
            GradeConfig.objects.filter(school=school).order_by('-min_score')
            .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
        )
        if not grade_configs:
            grade_configs = NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

        # Subjects taught in this stream (via SubjectAssignment)
        subjects_qs = Subject.objects.filter(
            school=school,
            assignments__stream_id=stream_id,
        ).distinct()
        subjects = list(subjects_qs)
        subject_ids = [s.id for s in subjects]

        # All students in the stream
        students = list(
            Student.objects.filter(school=school, stream_id=stream_id)
            .order_by('gender', 'last_name', 'first_name')
        )

        # Exclusions
        exclusions = set(
            StudentSubjectExclusion.objects.filter(
                school=school, student__in=students, subject__in=subjects
            ).values_list('student_id', 'subject_id')
        )

        # All marks
        marks_map = {}
        for m in Mark.objects.filter(
            school=school,
            assessment_id=assessment_id,
            student__in=students,
            subject_id__in=subject_ids,
        ):
            marks_map[(m.student_id, m.subject_id)] = m

        rows = []
        for student in students:
            subj_data = {}
            subject_results = []  # for compute_student_summary

            for subj in subjects:
                excluded = (student.id, subj.id) in exclusions
                if excluded:
                    subj_data[subj.name] = {'score': None, 'grade': '-', 'excluded': True}
                    subject_results.append({'score': None, 'excluded': True, 'counts_in_division': subj.counts_in_division})
                    continue
                mark = marks_map.get((student.id, subj.id))
                score = float(mark.score) if mark and mark.score is not None else None
                grade = get_grade_from_configs(score, grade_configs) if score is not None else '-'
                subj_data[subj.name] = {'score': score, 'grade': grade, 'excluded': False}
                subject_results.append({'score': score, 'excluded': False, 'counts_in_division': subj.counts_in_division})

            summary = compute_student_summary(school_type, subject_results, grade_configs)

            rows.append({
                'student_id': student.id,
                'display_name': student.display_name,
                'gender': student.gender,
                'admission_number': student.admission_number,
                'parent_phone': student.parent_phone,
                'subjects': subj_data,
                # school-type-aware summary fields
                'total_score': summary['total_score'],
                'total_possible': summary['total_possible'],
                'average': summary['average'],
                'grade': summary['grade'],          # grade of average (PRIMARY main metric)
                'grade_remarks': summary['grade_remarks'],
                'points': summary['points'],         # NECTA aggregate (O/A level)
                'division': summary['division'],
                'subjects_count': len([r for r in subject_results if not r['excluded'] and r['score'] is not None]),
            })

        # Rank: PRIMARY → by total_score desc; O/A level → by average desc (points asc tiebreaker)
        if school_type == 'PRIMARY':
            rows_ranked = [r for r in rows if r['total_score'] is not None]
            rows_unranked = [r for r in rows if r['total_score'] is None]
            rows_ranked.sort(key=lambda r: -r['total_score'])
        else:
            rows_ranked = [r for r in rows if r['average'] is not None]
            rows_unranked = [r for r in rows if r['average'] is None]
            rows_ranked.sort(key=lambda r: (-(r['average'] or 0), (r['points'] or 999)))

        total_students = len(students)
        for i, r in enumerate(rows_ranked, 1):
            r['rank'] = i
            r['total_students'] = total_students
        for r in rows_unranked:
            r['rank'] = None
            r['total_students'] = total_students

        return Response({
            'school_type': school_type,
            'subjects': [s.name for s in subjects],
            'subject_codes': {s.name: s.code for s in subjects},
            'students': rows_ranked + rows_unranked,
        })

        # All students in the stream
        students = list(
            Student.objects.filter(school=school, stream_id=stream_id)
            .order_by('gender', 'last_name', 'first_name')
        )

        # Exclusions
        exclusions = set(
            StudentSubjectExclusion.objects.filter(
                school=school, student__in=students, subject__in=subjects
            ).values_list('student_id', 'subject_id')
        )

class SubjectAnalyticsView(APIView):
    """
    GET /api/v1/academy/analytics/?assessment=&stream=&subject=
    Grade distribution and GPA for one subject.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assessment_id = request.query_params.get('assessment')
        stream_id = request.query_params.get('stream')
        subject_id = request.query_params.get('subject')

        if not all([assessment_id, stream_id, subject_id]):
            return Response({'error': 'assessment, stream, subject required.'}, status=400)

        school = school_of(request)
        excluded_ids = set(
            StudentSubjectExclusion.objects.filter(
                school=school, subject_id=subject_id, student__stream_id=stream_id
            ).values_list('student_id', flat=True)
        )
        marks = Mark.objects.filter(
            school=school, assessment_id=assessment_id,
            subject_id=subject_id, student__stream_id=stream_id,
        ).exclude(student_id__in=excluded_ids).select_related('student')

        grade_dist = {'A': {'boys': 0, 'girls': 0}, 'B': {'boys': 0, 'girls': 0},
                      'C': {'boys': 0, 'girls': 0}, 'D': {'boys': 0, 'girls': 0},
                      'F': {'boys': 0, 'girls': 0}}
        gpa_sum = 0
        count = 0
        for m in marks:
            if m.score is None:
                continue
            grade = get_grade(m.score)
            key = 'boys' if m.student.gender == 'M' else 'girls'
            grade_dist[grade][key] += 1
            gpa_sum += get_gpa(grade)
            count += 1

        mean_gpa = round(gpa_sum / count, 2) if count else None
        pass_rate = round(
            sum(v['boys'] + v['girls'] for g, v in grade_dist.items() if g != 'F') / count * 100, 1
        ) if count else 0

        return Response({
            'grade_distribution': grade_dist,
            'mean_gpa': mean_gpa,
            'pass_rate': pass_rate,
            'total_scored': count,
        })


class CombinedResultsView(APIView):
    """
    POST /api/v1/academy/results/combined/
    Body: {
      stream,
      assessments: [{assessment_id, weight}, ...],
      treat_missing_as_zero: false
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        is_admin = request.user.role == 'ADMIN' or 'ADMIN' in (request.user.roles or [])
        if not is_admin:
            return Response({'error': 'Only admins can generate combined results.'}, status=403)

        stream_id = request.data.get('stream')
        assessments = request.data.get('assessments')
        treat_missing_as_zero = bool(request.data.get('treat_missing_as_zero', False))

        if not stream_id:
            return Response({'error': 'stream is required.'}, status=400)

        try:
            payload = build_combined_results_data(
                school=school_of(request),
                stream_id=stream_id,
                assessment_weights=assessments,
                treat_missing_as_zero=treat_missing_as_zero,
            )
        except CombinedResultsValidationError as exc:
            return Response({'error': str(exc)}, status=400)

        return Response(payload)


# ── Submission stats ──────────────────────────────────────────────────────────

class SubmissionStatsView(APIView):
    """
    GET /api/v1/academy/submission-stats/?assessment=&stream=
    Per-subject submission completion for a given stream + assessment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assessment_id = request.query_params.get('assessment')
        stream_id = request.query_params.get('stream')

        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)

        school = school_of(request)

        # Subjects for this stream
        subjects = Subject.objects.filter(
            school=school,
            assignments__stream_id=stream_id,
        ).distinct()

        # Students in stream
        total_students = Student.objects.filter(school=school, stream_id=stream_id).count()

        stats = []
        for subj in subjects:
            excluded_ids = set(
                StudentSubjectExclusion.objects.filter(
                    school=school, subject=subj, student__stream_id=stream_id
                ).values_list('student_id', flat=True)
            )
            eligible = total_students - len(excluded_ids)
            submitted = Mark.objects.filter(
                school=school,
                subject=subj,
                assessment_id=assessment_id,
                student__stream_id=stream_id,
                is_submitted=True,
            ).exclude(student_id__in=excluded_ids).count()

            stats.append({
                'subject_name': subj.name,
                'subject_id': subj.id,
                'submitted_count': submitted,
                'total_students': eligible,
            })

        return Response(stats)


# ── Publish results ───────────────────────────────────────────────────────────

class PublishResultsView(APIView):
    """
    GET    /api/v1/academy/publish/?assessment=&stream=  — check publication status
    POST   /api/v1/academy/publish/                      — publish results (admin, paid only)
    DELETE /api/v1/academy/publish/                      — unpublish results (admin, paid only)
    """
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """POST/DELETE require an active subscription; GET is always open."""
        if self.request.method in ('POST', 'DELETE'):
            return [IsAuthenticated(), IsSchoolPaidOrDownloadOnly()]
        return [IsAuthenticated()]

    def _is_admin(self, user):
        return user.role == 'ADMIN' or 'ADMIN' in (user.roles or [])

    def get(self, request):
        school = school_of(request)
        assessment_id = request.query_params.get('assessment')
        stream_id = request.query_params.get('stream')
        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)
        pub = ResultsPublication.objects.filter(
            school=school, assessment_id=assessment_id, stream_id=stream_id,
        ).select_related('published_by').first()
        if pub:
            return Response({
                'is_published': True,
                'published_at': pub.published_at,
                'published_by': pub.published_by.get_full_name() if pub.published_by else None,
            })
        return Response({'is_published': False})

    def post(self, request):
        if not self._is_admin(request.user):
            return Response({'error': 'Only admins can publish results.'}, status=403)
        school = school_of(request)
        assessment_id = request.data.get('assessment')
        stream_id = request.data.get('stream')
        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)
        pub, created = ResultsPublication.objects.get_or_create(
            school=school,
            assessment_id=assessment_id,
            stream_id=stream_id,
            defaults={'published_by': request.user},
        )
        return Response({
            'published': True,
            'published_at': pub.published_at,
            'already_published': not created,
        })

    def delete(self, request):
        if not self._is_admin(request.user):
            return Response({'error': 'Only admins can unpublish results.'}, status=403)
        school = school_of(request)
        assessment_id = request.data.get('assessment')
        stream_id = request.data.get('stream')
        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)
        deleted, _ = ResultsPublication.objects.filter(
            school=school, assessment_id=assessment_id, stream_id=stream_id,
        ).delete()
        if deleted:
            return Response({'unpublished': True})
        return Response({'error': 'Results are not currently published.'}, status=404)


# ── Send SMS ──────────────────────────────────────────────────────────────────

class SendSMSView(APIView):
    """
    POST /api/v1/academy/send-sms/
    Send result-notification SMS to parents of selected students.
    Body: {student_ids: [...], assessment_id: <int>}
    Returns: {sent: int, failed: int, dry_run: bool}
    """
    permission_classes = [IsAuthenticated, IsSchoolPaid]

    def post(self, request):
        from collections import defaultdict
        from academy.sms import send_sms
        from django.conf import settings

        school = school_of(request)
        student_ids = request.data.get('student_ids', [])
        assessment_id = request.data.get('assessment_id')

        if not student_ids:
            return Response({'error': 'No students selected.'}, status=400)
        if not assessment_id:
            return Response({'error': 'assessment_id is required.'}, status=400)

        try:
            assessment = Assessment.objects.get(id=assessment_id, school=school)
        except Assessment.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        school_type = school.school_type

        # Grade configs (fall back to NECTA defaults)
        grade_configs = list(
            GradeConfig.objects.filter(school=school).order_by('-min_score')
            .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
        ) or NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

        # Selected students
        selected_students = list(Student.objects.filter(school=school, id__in=student_ids))
        stream_ids = list({s.stream_id for s in selected_students if s.stream_id})

        # ALL students in those streams — needed for accurate rank computation
        all_stream_students = list(
            Student.objects.filter(school=school, stream_id__in=stream_ids)
        )

        # Subject assignments per stream
        stream_subjects = {}
        for sa in SubjectAssignment.objects.filter(
            school=school, stream_id__in=stream_ids,
        ).select_related('subject'):
            stream_subjects.setdefault(sa.stream_id, []).append(sa.subject)

        # Marks and exclusions for all stream students (single round-trip each)
        marks_map = {}
        for m in Mark.objects.filter(
            school=school, assessment=assessment, student__in=all_stream_students
        ):
            marks_map[(m.student_id, m.subject_id)] = m

        exclusions = set(
            StudentSubjectExclusion.objects.filter(
                school=school, student__in=all_stream_students
            ).values_list('student_id', 'subject_id')
        )

        def _build_summary(student):
            subjects = stream_subjects.get(student.stream_id, [])
            subject_results = [
                {
                    'score': float(marks_map[(student.id, subj.id)].score)
                        if marks_map.get((student.id, subj.id)) and
                           marks_map[(student.id, subj.id)].score is not None
                        else None,
                    'excluded': (student.id, subj.id) in exclusions,
                    'counts_in_division': subj.counts_in_division,
                }
                for subj in subjects
            ]
            return compute_student_summary(school_type, subject_results, grade_configs)

        # Compute summaries and rank within each stream
        summary_cache = {}
        rank_map = {}  # {student_id: (rank, stream_total)}

        by_stream = defaultdict(list)
        for s in all_stream_students:
            by_stream[s.stream_id].append(s)

        for sid, stream_students in by_stream.items():
            pairs = [(s, _build_summary(s)) for s in stream_students]
            for s, summ in pairs:
                summary_cache[s.id] = summ

            total = len(stream_students)
            if school_type == 'PRIMARY':
                ranked = sorted(
                    [(s, summ) for s, summ in pairs if summ['total_score'] is not None],
                    key=lambda x: -x[1]['total_score'],
                )
            else:
                ranked = sorted(
                    [(s, summ) for s, summ in pairs if summ['average'] is not None],
                    key=lambda x: (-(x[1]['average'] or 0), (x[1]['points'] or 999)),
                )
            for pos, (s, _) in enumerate(ranked, start=1):
                rank_map[s.id] = (pos, total)

        # Send SMS to each selected student who has a parent phone
        sent = 0
        failed = 0

        for student in selected_students:
            if not student.parent_phone:
                continue

            summary = summary_cache.get(student.id) or _build_summary(student)
            rank_info = rank_map.get(student.id)

            average = summary['average'] if summary['average'] is not None else '-'
            grade = summary['grade'] or '-'
            avg_display = f"{average}({grade})"

            nafasi = f"Nafasi {rank_info[0]}/{rank_info[1]}, " if rank_info else ""

            if school_type == 'PRIMARY':
                detail = f"{nafasi}Wastani {avg_display}"
            else:
                division = summary['division'] or '-'
                points = summary['points']
                pts_str = f" ya {int(points)}" if points is not None else ""
                detail = f"{nafasi}Wastani {avg_display}, {division}{pts_str}"

            message = (
                f"Matokeo ya {student.first_name} {student.last_name}"
                f" - {school.name}.\n"
                f"{assessment.name}: {detail}. -SkuliNode"
            )

            result = send_sms(student.parent_phone, message, school=school)
            if result['success']:
                sent += 1
            else:
                failed += 1

        return Response({
            'sent': sent,
            'failed': failed,
            'dry_run': settings.SMS_DRY_RUN,
        })


# ── Classes (ClassLevel + Stream combo) ───────────────────────────────────────

def _auto_code(school, class_name):
    """Generate a unique ClassLevel code for this school based on the class name."""
    base = re.sub(r'[^A-Z0-9]', '', class_name.upper())[:18] or 'CLS'
    code = base
    suffix = 2
    while ClassLevel.objects.filter(school=school, code=code).exists():
        code = f"{base}{suffix}"
        suffix += 1
    return code


class ClassRoomListCreateView(APIView):
    """
    GET  /api/v1/academy/classes/   — list all streams (= classes) with extended info
    POST /api/v1/academy/classes/   — create a ClassLevel+Stream combo
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        streams = (
            Stream.objects.filter(school=school_of(request))
            .select_related('class_level')
            .order_by('class_level__name', 'name')
        )
        return Response(StreamSerializer(streams, many=True).data)

    def post(self, request):
        school = school_of(request)
        class_name = request.data.get('class_name', '').strip()
        stream_name = request.data.get('stream_name', '').strip()
        level = request.data.get('level', ClassLevel.Level.SECONDARY_O)

        if not class_name:
            return Response({'class_name': ['Class name is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create the ClassLevel (case-insensitive name match)
        try:
            class_level = ClassLevel.objects.get(school=school, name__iexact=class_name)
        except ClassLevel.DoesNotExist:
            class_level = ClassLevel.objects.create(
                school=school,
                name=class_name,
                code=_auto_code(school, class_name),
                level=level,
            )

        # Check for duplicate stream within this ClassLevel
        if Stream.objects.filter(school=school, class_level=class_level, name__iexact=stream_name).exists():
            label = f"{class_name} {stream_name}".strip()
            return Response(
                {'stream_name': [f'"{label}" already exists.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stream = Stream.objects.create(school=school, class_level=class_level, name=stream_name)
        return Response(StreamSerializer(stream).data, status=status.HTTP_201_CREATED)


class ClassRoomDetailView(APIView):
    """
    PATCH  /api/v1/academy/classes/<pk>/  — edit a class
    DELETE /api/v1/academy/classes/<pk>/  — delete a class (cascades to students)
    """
    permission_classes = [IsAuthenticated]

    def _get_stream(self, request, pk):
        try:
            return Stream.objects.select_related('class_level').get(pk=pk, school=school_of(request))
        except Stream.DoesNotExist:
            return None

    def patch(self, request, pk):
        stream = self._get_stream(request, pk)
        if not stream:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        school = school_of(request)
        class_name = request.data.get('class_name', stream.class_level.name).strip()
        stream_name = request.data.get('stream_name', stream.name).strip()
        level = request.data.get('level', stream.class_level.level)

        if not class_name:
            return Response({'class_name': ['Class name is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create ClassLevel with this name
        try:
            class_level = ClassLevel.objects.get(school=school, name__iexact=class_name)
        except ClassLevel.DoesNotExist:
            class_level = ClassLevel.objects.create(
                school=school,
                name=class_name,
                code=_auto_code(school, class_name),
                level=level,
            )

        # Check duplicate (excluding self)
        if (Stream.objects.filter(school=school, class_level=class_level, name__iexact=stream_name)
                .exclude(pk=pk).exists()):
            label = f"{class_name} {stream_name}".strip()
            return Response({'error': f'"{label}" already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        stream.class_level = class_level
        stream.name = stream_name
        stream.save()
        return Response(StreamSerializer(stream).data)

    def delete(self, request, pk):
        stream = self._get_stream(request, pk)
        if not stream:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        stream.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Student Bulk Upload ────────────────────────────────────────────────────────

class StudentBulkUploadView(APIView):
    """
    POST /api/v1/academy/students/bulk/
    Body: { students: [{ first_name, last_name, middle_name, gender, class_label,
                          admission_number, parent_phone }, ...] }
    Returns: { created: N, errors: [{row, error}, ...] }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = school_of(request)
        rows = request.data.get('students', [])

        if not isinstance(rows, list) or not rows:
            return Response({'error': 'No student data provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build display-label → stream lookup (case-insensitive)
        streams = Stream.objects.filter(school=school).select_related('class_level')
        stream_lookup = {
            f"{s.class_level.name} {s.name}".strip().lower(): s
            for s in streams
        }

        created = 0
        errors = []

        for i, row in enumerate(rows):
            row_num = i + 1
            class_label = (row.get('class_label') or '').strip().lower()
            stream = stream_lookup.get(class_label)

            if not stream:
                errors.append({'row': row_num, 'error': f'Class "{row.get("class_label")}" not found. Check spelling.'})
                continue

            data = {
                'first_name': (row.get('first_name') or '').strip(),
                'middle_name': (row.get('middle_name') or '').strip(),
                'last_name': (row.get('last_name') or '').strip(),
                'gender': (row.get('gender') or '').strip().upper(),
                'parent_phone': (row.get('parent_phone') or '').strip(),
                'admission_number': (row.get('admission_number') or '').strip(),
                'stream': stream.id,
                'school': school.id,
            }

            serializer = StudentSerializer(data=data)
            if serializer.is_valid():
                try:
                    serializer.save()
                    created += 1
                except Exception as e:
                    errors.append({'row': row_num, 'error': str(e)})
            else:
                msg = '; '.join(
                    f"{k}: {', '.join(v) if isinstance(v, list) else v}"
                    for k, v in serializer.errors.items()
                )
                errors.append({'row': row_num, 'error': msg})

        resp_status = status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED
        return Response({'created': created, 'errors': errors}, status=resp_status)


# ── GradeConfig ───────────────────────────────────────────────────────────────

class GradeConfigListCreateView(ListCreateAPIView):
    """
    GET  /api/v1/academy/grade-configs/  — list school's grade configs
    POST /api/v1/academy/grade-configs/  — create a grade config row
    """
    serializer_class = GradeConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GradeConfig.objects.filter(school=school_of(self.request)).order_by('-min_score')

    def perform_create(self, serializer):
        serializer.save(school=school_of(self.request))


class GradeConfigDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET/PATCH/DELETE /api/v1/academy/grade-configs/<pk>/
    """
    serializer_class = GradeConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GradeConfig.objects.filter(school=school_of(self.request))


class GradeConfigResetView(APIView):
    """
    POST /api/v1/academy/grade-configs/reset/
    Delete all existing configs for this school and re-seed from NECTA defaults.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = school_of(request)
        school_type = school.school_type
        defaults = NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

        GradeConfig.objects.filter(school=school).delete()
        for row in defaults:
            GradeConfig.objects.create(
                school=school,
                grade_label=row['grade_label'],
                min_score=row['min_score'],
                max_score=row['max_score'],
                points=row.get('points'),
                remarks=row.get('remarks', ''),
            )

        configs = GradeConfig.objects.filter(school=school).order_by('-min_score')
        return Response(GradeConfigSerializer(configs, many=True).data)

