"""academy/comment_views.py — Comment templates, generation, and per-student editing."""
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.grading import NECTA_DEFAULTS, compute_student_summary
from academy.models import (
    Assessment, CombinedStudentSnapshot, CommentTemplate, GradeConfig, Mark,
    SYSTEM_COMMENT_TEMPLATES, Stream, Student, StudentComment,
    StudentSubjectExclusion, Subject, render_comment,
)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _school(request):
    return request.user.school


def _grade_configs(school):
    configs = list(
        GradeConfig.objects.filter(school=school).order_by('-min_score')
        .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
    )
    return configs or NECTA_DEFAULTS.get(school.school_type, NECTA_DEFAULTS['ORDINARY'])


def _student_data(student, subjects, marks_map, exclusions, grade_configs, school_type):
    """Return summary + best/weak subject for comment rendering."""
    subject_results = []
    subject_scores  = {}
    for subj in subjects:
        excluded = (student.id, subj.id) in exclusions
        if excluded:
            subject_results.append({'score': None, 'excluded': True,
                                    'counts_in_division': subj.counts_in_division})
            continue
        mark  = marks_map.get((student.id, subj.id))
        score = float(mark.score) if mark and mark.score is not None else None
        subject_results.append({'score': score, 'excluded': False,
                                'counts_in_division': subj.counts_in_division})
        if score is not None:
            subject_scores[subj.name] = score

    summary = compute_student_summary(school_type, subject_results, grade_configs)
    return {
        'summary':      summary,
        'best_subject': max(subject_scores, key=subject_scores.get) if subject_scores else None,
        'weak_subject': min(subject_scores, key=subject_scores.get) if subject_scores else None,
    }


def _pick_template(user, role, school, avg):
    """
    Match template by lower bound only — avoids decimal gaps between bands.
    Templates ordered descending by min_score, so first match where avg >= min wins.
    """
    avg_f = float(avg) if avg is not None else 0.0

    # User custom templates first
    for t in CommentTemplate.objects.filter(
        school=school, created_by=user, role=role,
    ).order_by('-min_score').values('min_score', 'template_text'):
        if avg_f >= float(t['min_score']):
            return t['template_text']

    # System defaults
    for t in SYSTEM_COMMENT_TEMPLATES.get(role, []):
        if avg_f >= t['min']:
            return t['text']

    # Absolute fallback — should never reach here
    sys_tpls = SYSTEM_COMMENT_TEMPLATES.get(role, [])
    return sys_tpls[-1]['text'] if sys_tpls else '{name} — maoni hayajaandikwa.'


def _render_for_student(user, role, first_name, sd, position, total):
    """Render the final comment string for one student."""
    summary = sd['summary']
    tpl     = _pick_template(user, role, user.school, summary.get('average'))
    return render_comment(
        tpl,
        student_name = first_name,
        avg          = summary.get('average'),
        grade        = summary.get('grade'),
        best_subject = sd.get('best_subject'),
        weak_subject = sd.get('weak_subject'),
        division     = summary.get('division'),
        points       = summary.get('points'),
        position     = position,
        total        = total,
    )


# ── Views ─────────────────────────────────────────────────────────────────────

class CommentTemplateListView(APIView):
    """
    GET  /api/v1/academy/comment-templates/?role=
    POST /api/v1/academy/comment-templates/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs   = CommentTemplate.objects.filter(school=_school(request), created_by=request.user)
        role = request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        from academy.serializers import CommentTemplateSerializer
        return Response(CommentTemplateSerializer(qs, many=True).data)

    def post(self, request):
        from academy.serializers import CommentTemplateSerializer
        school = _school(request)
        obj, created = CommentTemplate.objects.update_or_create(
            school=school, created_by=request.user,
            role=request.data.get('role'), min_score=request.data.get('min_score'),
            defaults={
                'max_score':     request.data.get('max_score'),
                'template_text': request.data.get('template_text', ''),
            },
        )
        return Response(
            CommentTemplateSerializer(obj).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CommentTemplateDetailView(APIView):
    """PUT/DELETE /api/v1/academy/comment-templates/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _obj(self, request, pk):
        try:
            return CommentTemplate.objects.get(pk=pk, school=_school(request),
                                               created_by=request.user)
        except CommentTemplate.DoesNotExist:
            return None

    def put(self, request, pk):
        from academy.serializers import CommentTemplateSerializer
        obj = self._obj(request, pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)
        for f in ('min_score', 'max_score', 'template_text', 'role'):
            if f in request.data:
                setattr(obj, f, request.data[f])
        obj.save()
        return Response(CommentTemplateSerializer(obj).data)

    def delete(self, request, pk):
        obj = self._obj(request, pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SystemCommentTemplatesView(APIView):
    """GET /api/v1/academy/comment-templates/system/ — raw system defaults."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SYSTEM_COMMENT_TEMPLATES)


class GenerateCommentsView(APIView):
    """
    POST /api/v1/academy/comments/generate/
    Body: { stream, assessment, role, overwrite_manual: false }
    Auto-generate comments for all students. Skips is_manual unless overwrite_manual=True.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        school        = _school(request)
        school_type   = school.school_type
        stream_id     = request.data.get('stream')
        assessment_id = request.data.get('assessment')
        role          = request.data.get('role')
        overwrite     = bool(request.data.get('overwrite_manual', False))

        snapshot_id = request.data.get('snapshot')
        if not all([stream_id, role]):
            return Response({'error': 'stream and role are required.'}, status=400)
        if not assessment_id and not snapshot_id:
            return Response({'error': 'Either assessment or snapshot is required.'}, status=400)

        # Role authorization
        from academy.models import ClassMasterAssignment
        is_admin = request.user.role == 'ADMIN' or 'ADMIN' in (request.user.roles or [])
        if role == 'class_teacher' and not is_admin:
            try:
                aobj = Assessment.objects.get(pk=assessment_id, school=school)
                year = aobj.academic_year
            except Assessment.DoesNotExist:
                year = 2026
            if not ClassMasterAssignment.objects.filter(
                school=school, teacher=request.user,
                stream_id=stream_id, academic_year=year,
            ).exists():
                return Response({
                    'error': 'Lazima uwe mwalimu wa darasa hili ili uzalishe maoni.'
                }, status=403)
        elif role in ('academic_master', 'headmaster') and not is_admin:
            return Response({
                'error': 'Wasimamizi tu wanaweza kuzalisha maoni ya taaluma au mkuu.'
            }, status=403)

        grade_configs = _grade_configs(school)
        subjects  = list(Subject.objects.filter(school=school,
                                                assignments__stream_id=stream_id).distinct())
        students  = list(Student.objects.filter(school=school, stream_id=stream_id))
        exclusions = set(
            StudentSubjectExclusion.objects.filter(
                school=school, student__in=students, subject__in=subjects,
            ).values_list('student_id', 'subject_id')
        )
        
        if snapshot_id:
            data_map = {}
            for cs in CombinedStudentSnapshot.objects.filter(
                school=school, snapshot_id=snapshot_id, student__in=students
            ):
                # Safely extract scores to find best and weak subjects
                scores = {
                    subj: data.get('final_score', 0) 
                    for subj, data in cs.subject_data.items() 
                    if isinstance(data, dict) and data.get('final_score') is not None
                }
                
                data_map[cs.student_id] = {
                    'summary': {
                        'total_score': cs.total_score,
                        'average': cs.average,
                        'points': cs.points,
                        'grade': cs.grade,
                        'division': cs.division,
                        'position': cs.rank,
                        'total': cs.total_students
                    },
                    'best_subject': max(scores, key=scores.get) if scores else None,
                    'weak_subject': min(scores, key=scores.get) if scores else None,
                }
        else:
            # Existing logic for standard assessments
            marks_map = {
                (m.student_id, m.subject_id): m
                for m in Mark.objects.filter(
                    school=school, assessment_id=assessment_id, student__in=students,
                    subject_id__in=[s.id for s in subjects],
                )
            }
            # Build summaries and rank students ONLY for standard assessments
            data_map = {
                st.id: _student_data(st, subjects, marks_map, exclusions, grade_configs, school_type)
                for st in students
            }

        if school_type == 'PRIMARY':
            ranked = sorted(
                [s for s in students if data_map[s.id]['summary'].get('total_score') is not None],
                key=lambda s: -(data_map[s.id]['summary']['total_score'] or 0),
            )
        else:
            ranked = sorted(
                [s for s in students if data_map[s.id]['summary'].get('average') is not None],
                key=lambda s: (
                    -(data_map[s.id]['summary']['average'] or 0),
                    data_map[s.id]['summary'].get('points') or 999,
                ),
            )
        rank_map = {st.id: (i + 1, len(students)) for i, st in enumerate(ranked)}

        generated = skipped = 0
        for st in students:
            existing = StudentComment.objects.filter(
                school=school, student=st, assessment_id=assessment_id, role=role,
            ).first()
            if existing and existing.is_manual and not overwrite:
                skipped += 1
                continue

            pos, total = rank_map.get(st.id, (None, len(students)))
            text = _render_for_student(request.user, role, st.first_name, data_map[st.id], pos, total)

            StudentComment.objects.update_or_create(
                school=school, student=st, assessment_id=assessment_id or None,
                snapshot_id=snapshot_id or None, role=role,
                defaults={'comment_text': text, 'is_manual': False, 'created_by': request.user},
            )
            generated += 1

        return Response({'generated': generated, 'skipped_manual': skipped})



class CommentClearView(APIView):
    """DELETE /api/v1/academy/comments/clear/?assessment=&stream=&role= (or ?snapshot=&role=)"""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        school        = _school(request)
        role          = request.query_params.get('role')
        assessment_id = request.query_params.get('assessment')
        stream_id     = request.query_params.get('stream')
        snapshot_id   = request.query_params.get('snapshot')

        if not role:
            return Response({'error': 'role is required.'}, status=400)

        if snapshot_id:
            deleted, _ = StudentComment.objects.filter(
                school=school, snapshot_id=snapshot_id, role=role,
            ).delete()
        else:
            if not assessment_id or not stream_id:
                return Response({'error': 'assessment and stream are required (or snapshot).'}, status=400)
            deleted, _ = StudentComment.objects.filter(
                school=school, assessment_id=assessment_id,
                student__stream_id=stream_id, role=role,
            ).delete()

        return Response({'deleted': deleted})




class StudentCommentListView(APIView):
    """
    GET /api/v1/academy/comments/list/?assessment=&stream=&role=
    All stored comments for a stream + assessment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from academy.serializers import StudentCommentSerializer
        school        = _school(request)
        assessment_id = request.query_params.get('assessment')
        stream_id     = request.query_params.get('stream')
        role          = request.query_params.get('role')
        
        snapshot_id = request.query_params.get('snapshot')
        if snapshot_id:
            qs = StudentComment.objects.filter(
                school=school, snapshot_id=snapshot_id,
            ).select_related('student')
        else:
            if not assessment_id or not stream_id:
                return Response({'error': 'assessment and stream are required.'}, status=400)
            qs = StudentComment.objects.filter(
                school=school, assessment_id=assessment_id, student__stream_id=stream_id,
            ).select_related('student')
        if role:
            qs = qs.filter(role=role)
        return Response(StudentCommentSerializer(qs, many=True).data)


class StudentCommentSaveView(APIView):
    """
    POST /api/v1/academy/comments/         — upsert (create or update)
    PUT  /api/v1/academy/comments/<pk>/    — update, marks as manual
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from academy.serializers import StudentCommentSerializer
        school        = _school(request)
        student_id    = request.data.get('student')
        assessment_id = request.data.get('assessment')
        role          = request.data.get('role')
        snapshot_id   = request.data.get('snapshot')

        if not student_id or not role:
            return Response({'error': 'student and role are required.'}, status=400)
        if not assessment_id and not snapshot_id:
            return Response({'error': 'Either assessment or snapshot is required.'}, status=400)

        from academy.models import ClassMasterAssignment, Student as Stu
        is_admin = request.user.role == 'ADMIN' or 'ADMIN' in (request.user.roles or [])
        if role == 'class_teacher' and not is_admin:
            try:
                sobj = Stu.objects.get(pk=student_id, school=school)
                if assessment_id:
                    aobj = Assessment.objects.get(pk=assessment_id, school=school)
                    year = aobj.academic_year
                else:
                    year = 2026
                if not ClassMasterAssignment.objects.filter(
                    school=school, teacher=request.user,
                    stream_id=sobj.stream_id, academic_year=year,
                ).exists():
                    return Response({'error': 'Lazima uwe mwalimu wa darasa la mwanafunzi huyu.'}, status=403)
            except (Stu.DoesNotExist, Assessment.DoesNotExist):
                return Response({'error': 'Mwanafunzi au tathmini haikupatikana.'}, status=404)
        elif role in ('academic_master', 'headmaster') and not is_admin:
            return Response({'error': 'Wasimamizi tu wanaweza kuandika maoni ya taaluma au mkuu.'}, status=403)

        snapshot_id = request.data.get('snapshot')
        obj, created = StudentComment.objects.update_or_create(
            school=school, student_id=student_id,
            assessment_id=assessment_id or None,
            snapshot_id=snapshot_id or None,
            role=role,
            defaults={
                'comment_text': request.data.get('comment_text', ''),
                'is_manual':    bool(request.data.get('is_manual', True)),
                'created_by':   request.user,
            },
        )
        return Response(
            StudentCommentSerializer(obj).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def put(self, request, pk):
        from academy.serializers import StudentCommentSerializer
        try:
            obj = StudentComment.objects.get(pk=pk, school=_school(request))
        except StudentComment.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        obj.comment_text = request.data.get('comment_text', obj.comment_text)
        obj.is_manual    = True
        obj.created_by   = request.user
        obj.save()
        return Response(StudentCommentSerializer(obj).data)


class CommentPreviewView(APIView):
    """
    POST /api/v1/academy/comments/preview/
    Body: { student, assessment, role, template_text? }
    Render a comment for one student — used when editing templates.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school        = _school(request)
        school_type   = school.school_type
        student_id    = request.data.get('student')
        assessment_id = request.data.get('assessment')
        role          = request.data.get('role')
        custom_tpl    = request.data.get('template_text')

        if not all([student_id, assessment_id, role]):
            return Response({'error': 'student, assessment, role required.'}, status=400)

        try:
            student = Student.objects.get(pk=student_id, school=school)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=404)

        grade_configs = _grade_configs(school)
        subjects   = list(Subject.objects.filter(school=school,
                                                  assignments__stream_id=student.stream_id).distinct())
        exclusions = set(
            StudentSubjectExclusion.objects.filter(
                school=school, student=student, subject__in=subjects,
            ).values_list('student_id', 'subject_id')
        )
        marks_map = {
            (m.student_id, m.subject_id): m
            for m in Mark.objects.filter(school=school, assessment_id=assessment_id, student=student)
        }

        sd      = _student_data(student, subjects, marks_map, exclusions, grade_configs, school_type)
        summary = sd['summary']

        if custom_tpl:
            rendered = render_comment(
                custom_tpl, student_name=student.first_name,
                avg=summary.get('average'), grade=summary.get('grade'),
                best_subject=sd['best_subject'], weak_subject=sd['weak_subject'],
                division=summary.get('division'), points=summary.get('points'),
            )
        else:
            rendered = _render_for_student(request.user, role, student.first_name, sd, None, None)

        return Response({
            'comment':      rendered,
            'student_name': student.display_name,
            'avg':          summary.get('average'),
            'grade':        summary.get('grade'),
            'best_subject': sd['best_subject'],
            'weak_subject': sd['weak_subject'],
        })



