"""academy/combined_views.py — Class master assignments + combined results snapshots."""
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.models import (
    ClassMasterAssignment, CombinedResultsSnapshot, CombinedStudentSnapshot,
    Stream, Student, Assessment,
)


def _school(request):
    return request.user.school


def _is_admin(user):
    return user.role == 'ADMIN' or 'ADMIN' in (user.roles or [])


# ── Class Master Assignments ──────────────────────────────────────────────────

class ClassMasterListCreateView(APIView):
    """GET/POST /api/v1/academy/class-masters/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = ClassMasterAssignment.objects.filter(school=school).select_related(
            'teacher', 'stream__class_level'
        )
        year = request.query_params.get('academic_year')
        stream_id = request.query_params.get('stream')
        if year:
            qs = qs.filter(academic_year=year)
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        return Response([{
            'id': a.id,
            'teacher_id': a.teacher_id,
            'teacher_name': a.teacher.get_full_name() or a.teacher.username,
            'stream_id': a.stream_id,
            'stream_label': f"{a.stream.class_level.name} {a.stream.name}".strip(),
            'academic_year': a.academic_year,
        } for a in qs])

    def post(self, request):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school = _school(request)
        stream_id  = request.data.get('stream')
        teacher_id = request.data.get('teacher')
        year       = request.data.get('academic_year', 2026)
        if not stream_id or not teacher_id:
            return Response({'error': 'stream and teacher are required.'}, status=400)
        obj, created = ClassMasterAssignment.objects.update_or_create(
            school=school, stream_id=stream_id, academic_year=year,
            defaults={'teacher_id': teacher_id},
        )
        return Response({'id': obj.id, 'teacher_id': obj.teacher_id,
                         'stream_id': obj.stream_id, 'academic_year': obj.academic_year},
                        status=201 if created else 200)


class ClassMasterDetailView(APIView):
    """DELETE /api/v1/academy/class-masters/<pk>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        try:
            obj = ClassMasterAssignment.objects.get(pk=pk, school=_school(request))
        except ClassMasterAssignment.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        obj.delete()
        return Response(status=204)


class MyClassMasterStreamsView(APIView):
    """GET /api/v1/academy/my-class-master-streams/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ClassMasterAssignment.objects.filter(
            school=_school(request), teacher=request.user,
        ).select_related('stream__class_level')
        year = request.query_params.get('academic_year')
        if year:
            qs = qs.filter(academic_year=year)
        return Response([{
            'id': a.id,
            'stream_id': a.stream_id,
            'stream_label': f"{a.stream.class_level.name} {a.stream.name}".strip(),
            'academic_year': a.academic_year,
        } for a in qs])


# ── Combined Results Snapshots ────────────────────────────────────────────────

class CombinedSnapshotListView(APIView):
    """GET /api/v1/academy/combined-snapshots/?stream="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = CombinedResultsSnapshot.objects.filter(school=school, is_published=True)
        stream_id = request.query_params.get('stream')
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        return Response([{
            'id': s.id,
            'name': s.name,
            'stream_id': s.stream_id,
            'academic_year': s.academic_year,
            'components': s.components,
            'school_type': s.school_type,
            'created_at': s.created_at.isoformat(),
            'student_count': s.student_results.count(),
        } for s in qs])


class PublishCombinedResultsView(APIView):
    """
    POST /api/v1/academy/combined-snapshots/publish/
    Stores combined results as a reusable snapshot after publishing.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if not _is_admin(request.user):
            return Response({'error': 'Only admins can publish combined results.'}, status=403)

        school        = _school(request)
        name          = (request.data.get('name') or '').strip()
        stream_id     = request.data.get('stream')
        academic_year = request.data.get('academic_year', 2026)
        components    = request.data.get('components', [])
        subjects      = request.data.get('subjects', [])
        treat_missing = bool(request.data.get('treat_missing_as_zero', False))
        school_type   = request.data.get('school_type') or school.school_type
        students_data = request.data.get('students', [])

        if not stream_id:
            return Response({'error': 'stream is required.'}, status=400)

        if not name:
            parts = [f"{c.get('name','')} ({c.get('weight','')}%)" for c in components]
            name = 'Combined: ' + ' + '.join(parts)

        snap, created = CombinedResultsSnapshot.objects.update_or_create(
            school=school, stream_id=stream_id, name=name,
            defaults={
                'academic_year': academic_year,
                'components': components,
                'subjects': subjects,
                'treat_missing_as_zero': treat_missing,
                'school_type': school_type,
                'published_by': request.user,
                'is_published': True,
            }
        )

        snap.student_results.all().delete()
        to_create = []
        total = len(students_data)
        for st in students_data:
            try:
                student = Student.objects.get(pk=st['student_id'], school=school)
            except Student.DoesNotExist:
                continue
            to_create.append(CombinedStudentSnapshot(
                school=school,
                snapshot=snap,
                student=student,
                rank=st.get('rank'),
                total_students=total,
                total_score=st.get('total_score'),
                average=st.get('average'),
                grade=st.get('grade') or '',
                grade_remarks=st.get('grade_remarks') or '',
                points=st.get('points'),
                division=st.get('division') or '',
                subject_data=st.get('subjects', {}),
                assessment_averages=st.get('assessment_averages', {}),
            ))
        CombinedStudentSnapshot.objects.bulk_create(to_create)

        return Response({
            'id': snap.id,
            'name': snap.name,
            'student_count': len(to_create),
            'created': created,
        }, status=201 if created else 200)


class CombinedSnapshotDetailView(APIView):
    """GET/DELETE /api/v1/academy/combined-snapshots/<pk>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        school = _school(request)
        try:
            snap = CombinedResultsSnapshot.objects.get(pk=pk, school=school)
        except CombinedResultsSnapshot.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        try:
            stream_obj = Stream.objects.select_related('class_level').get(pk=snap.stream_id)
            stream_label = f"{stream_obj.class_level.name} {stream_obj.name}".strip()
        except Stream.DoesNotExist:
            stream_label = ''

        students = []
        for sr in snap.student_results.select_related('student').order_by('rank'):
            # JSON stores dict keys as strings; convert back to int for PDF compatibility
            subject_data = {}
            for subj, sdata in sr.subject_data.items():
                converted = dict(sdata)
                if isinstance(converted.get('assessment_scores'), dict):
                    converted['assessment_scores'] = {
                        int(k) if str(k).isdigit() else k: v
                        for k, v in converted['assessment_scores'].items()
                    }
                subject_data[subj] = converted

            assessment_averages = {
                int(k) if str(k).isdigit() else k: v
                for k, v in sr.assessment_averages.items()
            }

            students.append({
                'student_id': sr.student_id,
                'display_name': sr.student.display_name,
                'admission_number': sr.student.admission_number,
                'gender': sr.student.gender,
                'rank': sr.rank,
                'total_students': sr.total_students,
                'total_score': float(sr.total_score) if sr.total_score is not None else None,
                'average': float(sr.average) if sr.average is not None else None,
                'grade': sr.grade,
                'grade_remarks': sr.grade_remarks,
                'points': sr.points,
                'division': sr.division,
                'subjects': subject_data,
                'assessment_averages': assessment_averages,
            })

        return Response({
            'id': snap.id,
            'name': snap.name,
            'stream_id': snap.stream_id,
            'stream_label': stream_label,
            'academic_year': snap.academic_year,
            'components': snap.components,
            'assessments': snap.components,   # alias for ReportCard component
            'subjects': snap.subjects,
            'school_type': snap.school_type,
            'students': students,
        })

    def delete(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        try:
            snap = CombinedResultsSnapshot.objects.get(pk=pk, school=_school(request))
        except CombinedResultsSnapshot.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        snap.delete()
        return Response(status=204)