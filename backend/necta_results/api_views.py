from django.core.paginator import Paginator
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import models

from .models import (
    ExamSession, SchoolCenter, RegionalSummary, DistrictSummary,
    NationalSubjectStat, RegionalSubjectStat, SubjectSchoolRanking,
)


class SessionsView(APIView):
    """GET /api/public/necta/sessions/"""
    permission_classes = []

    def get(self, request):
        sessions = ExamSession.objects.filter(is_published=True).order_by('-year')
        return Response([
            {'id': s.id, 'exam_level': s.exam_level, 'year': s.year, 'kpis': s.kpi_data}
            for s in sessions
        ])


class NationalKPIView(APIView):
    """GET /api/public/necta/kpis/?level=ACSEE&year=2026"""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)
        return Response(session.kpi_data)


class RankingsView(APIView):
    """
    GET /api/public/necta/rankings/?level=ACSEE&year=2026
        &region=DODOMA&district=DODOMA%20URBAN&page=1&sort=gpa
    Scope: no region/district = national. region only = regional.
    region + district = district.
    """
    permission_classes = []

    def get(self, request):
        level    = request.query_params.get('level', 'ACSEE')
        year     = request.query_params.get('year')
        region   = request.query_params.get('region')
        district = request.query_params.get('district')
        sort     = request.query_params.get('sort', 'gpa')
        page     = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 50)), 200)

        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)

        qs = SchoolCenter.objects.filter(exam_session=session, is_rankable=True)

        scope, rank_field = 'national', 'national_rank'
        if district and region:
            qs = qs.filter(region=region.upper(), district=district.upper())
            scope, rank_field = 'district', 'district_rank'
        elif region:
            qs = qs.filter(region=region.upper())
            scope, rank_field = 'regional', 'regional_rank'

        sort_map = {'gpa': 'center_gpa', 'pass_rate': '-pass_rate', 'name': 'center_name'}
        qs = qs.order_by(sort_map.get(sort, 'center_gpa'))

        paginator = Paginator(qs, page_size)
        page_obj  = paginator.get_page(page)

        results = [{
            'rank':             getattr(c, rank_field),
            'national_rank':    c.national_rank,
            'regional_rank':    c.regional_rank,
            'district_rank':    c.district_rank,
            'center_id':        c.center_id,
            'center_name':      c.center_name,
            'region':           c.region,
            'district':         c.district or None,
            'gpa':              c.center_gpa,
            'grade_label':      c.grade_label,
            'pass_rate':        c.pass_rate,
            'div1_rate':        c.div1_rate,
            'sat_total':        c.sat_total,
            'div_1_total':      c.div_1_total,
            'div_2_total':      c.div_2_total,
            'div_3_total':      c.div_3_total,
            'div_4_total':      c.div_4_total,
            'div_0_total':      c.div_0_total,
            'pass_rate_male':   c.pass_rate_male,
            'pass_rate_female': c.pass_rate_female,
        } for c in page_obj]

        return Response({
            'scope': scope, 'region': region, 'district': district,
            'total': paginator.count, 'page': page, 'total_pages': paginator.num_pages,
            'results': results,
        })


class SchoolDetailView(APIView):
    """GET /api/public/necta/school/<center_id>/?level=ACSEE&year=2026"""
    permission_classes = []

    def get(self, request, center_id):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
            center  = SchoolCenter.objects.get(exam_session=session, center_id=center_id.upper())
        except (ExamSession.DoesNotExist, SchoolCenter.DoesNotExist):
            return Response({'error': 'Not found.'}, status=404)

        subjects = list(center.subjects.values(
            'subject_name', 'registered', 'sat', 'subject_gpa', 'dropout_rate'
        ).order_by('subject_gpa'))

        subject_ranks = list(SubjectSchoolRanking.objects.filter(
            exam_session=session, center=center
        ).values('subject_name', 'national_subject_rank', 'regional_subject_rank', 'district_subject_rank'))
        rank_map = {r['subject_name']: r for r in subject_ranks}
        for s in subjects:
            r = rank_map.get(s['subject_name'], {})
            s['national_subject_rank'] = r.get('national_subject_rank')
            s['regional_subject_rank'] = r.get('regional_subject_rank')
            s['district_subject_rank'] = r.get('district_subject_rank')

        return Response({
            'center_id': center.center_id, 'center_name': center.center_name,
            'region': center.region, 'district': center.district or None,
            'gpa': center.center_gpa, 'grade_label': center.grade_label,
            'national_rank': center.national_rank, 'regional_rank': center.regional_rank,
            'district_rank': center.district_rank,
            'sat_total': center.sat_total, 'pass_rate': center.pass_rate,
            'divisions': {
                'I': center.div_1_total, 'II': center.div_2_total,
                'III': center.div_3_total, 'IV': center.div_4_total, '0': center.div_0_total,
            },
            'gender': {
                'pass_rate_male': center.pass_rate_male, 'pass_rate_female': center.pass_rate_female,
                'sat_male': center.sat_male, 'sat_female': center.sat_female,
            },
            'subjects': subjects,
        })


class RegionalComparisonView(APIView):
    """GET /api/public/necta/regions/?level=ACSEE&year=2026"""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        regions = list(RegionalSummary.objects.filter(exam_session=session).order_by('national_rank').values(
            'region', 'school_count', 'weighted_gpa', 'pass_rate', 'div1_count', 'national_rank',
        ))
        return Response({'results': regions})


class DistrictComparisonView(APIView):
    """GET /api/public/necta/districts/?level=ACSEE&year=2026&region=DODOMA"""
    permission_classes = []

    def get(self, request):
        level  = request.query_params.get('level', 'ACSEE')
        year   = request.query_params.get('year')
        region = request.query_params.get('region')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        qs = DistrictSummary.objects.filter(exam_session=session)
        if region:
            qs = qs.filter(region=region.upper())

        results = list(qs.order_by('national_rank').values(
            'region', 'district', 'school_count', 'weighted_gpa', 'pass_rate', 'div1_count', 'national_rank',
        ))
        return Response({'region': region, 'results': results})


class SubjectRankingsView(APIView):
    """
    GET /api/public/necta/subjects/?level=ACSEE&year=2026&region=DODOMA
    Subject-centric: how each SUBJECT performed. (Not school ranking.)
    """
    permission_classes = []

    def get(self, request):
        level  = request.query_params.get('level', 'ACSEE')
        year   = request.query_params.get('year')
        region = request.query_params.get('region')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if region:
            qs = RegionalSubjectStat.objects.filter(exam_session=session, region=region.upper()).order_by(
                'regional_rank'
            ).values('subject_name', 'weighted_gpa', 'total_sat', 'regional_rank')
            scope = 'regional'
        else:
            qs = NationalSubjectStat.objects.filter(exam_session=session).order_by('national_rank').values(
                'subject_name', 'weighted_gpa', 'total_sat', 'avg_dropout_rate', 'centers_offering', 'national_rank'
            )
            scope = 'national'

        return Response({'scope': scope, 'region': region, 'results': list(qs)})


class SubjectSchoolLeaderboardView(APIView):
    """
    GET /api/public/necta/subject-leaderboard/
        ?level=ACSEE&year=2026&subject=BIOLOGY&region=DODOMA&district=DODOMA%20URBAN
        &page=1&page_size=20

    School-centric: "Top N schools in Biology" — nested national/regional/district.
    """
    permission_classes = []

    def get(self, request):
        level    = request.query_params.get('level', 'ACSEE')
        year     = request.query_params.get('year')
        subject  = request.query_params.get('subject')
        region   = request.query_params.get('region')
        district = request.query_params.get('district')
        page     = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)

        if not subject:
            return Response({'error': 'subject parameter is required.'}, status=400)

        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)

        qs = SubjectSchoolRanking.objects.filter(exam_session=session, subject_name=subject.upper())

        scope, rank_field = 'national', 'national_subject_rank'
        if district and region:
            qs = qs.filter(region=region.upper(), district=district.upper())
            scope, rank_field = 'district', 'district_subject_rank'
        elif region:
            qs = qs.filter(region=region.upper())
            scope, rank_field = 'regional', 'regional_subject_rank'

        qs = qs.order_by(rank_field).select_related('center')

        paginator = Paginator(qs, page_size)
        page_obj  = paginator.get_page(page)

        results = [{
            'rank':        getattr(c, rank_field),
            'center_id':   c.center_id,
            'center_name': c.center.center_name if c.center else c.center_id,
            'region':      c.region,
            'district':    c.district or None,
            'subject_gpa': c.subject_gpa,
            'sat':         c.sat,
        } for c in page_obj]

        return Response({
            'subject': subject.upper(), 'scope': scope, 'region': region, 'district': district,
            'total': paginator.count, 'page': page, 'total_pages': paginator.num_pages,
            'results': results,
        })


# from .models import OwnershipSummary   # add to existing import line

class HeadlinesView(APIView):
    """GET /api/necta/headlines/?level=ACSEE&year=2026 — the storyline data."""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)
        return Response(session.kpi_data.get('headlines', {}))


class GenderAnalysisView(APIView):
    """GET /api/necta/gender/?level=ACSEE&year=2026"""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)
        return Response({
            'national': session.kpi_data.get('headlines', {}).get('national_gender'),
            'by_region': session.kpi_data.get('gender_gap_regions', []),
            'by_school': session.kpi_data.get('gender_gap_schools', []),
        })


class HiddenGemsView(APIView):
    """GET /api/necta/hidden-gems/?level=ACSEE&year=2026"""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)
        return Response({'results': session.kpi_data.get('hidden_gems', [])})


# class OwnershipComparisonView(APIView):
#     """GET /api/necta/ownership/?level=ACSEE&year=2026"""
#     permission_classes = []

#     def get(self, request):
#         level = request.query_params.get('level', 'ACSEE')
#         year  = request.query_params.get('year')
#         try:
#             session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
#         except ExamSession.DoesNotExist:
#             return Response({'error': 'Not found.'}, status=404)
#         results = list(OwnershipSummary.objects.filter(exam_session=session).values(
#             'ownership_type', 'school_count', 'weighted_gpa', 'pass_rate', 'total_sat'
#         ))
#         return Response({'results': results})


class SchoolSearchView(APIView):
    """
    GET /api/necta/search/?q=azania&level=ACSEE&year=2026
    Powers the hero search bar — matches on school name or region.
    """
    permission_classes = []

    def get(self, request):
        q     = request.query_params.get('q', '').strip()
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')

        if len(q) < 2:
            return Response({'results': []})

        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'results': []})

        matches = SchoolCenter.objects.filter(
            exam_session=session, is_rankable=True,
        ).filter(
            models.Q(center_name__icontains=q) | models.Q(region__icontains=q)
        )[:15]

        return Response({'results': [{
            'center_id': c.center_id, 'center_name': c.center_name,
            'region': c.region, 'gpa': c.center_gpa, 'national_rank': c.national_rank,
        } for c in matches]})


class SchoolCompareView(APIView):
    """
    GET /api/necta/compare/?level=ACSEE&year=2026&centers=S0220,S0214,P0101
    Side-by-side data for the comparison tool.
    """
    permission_classes = []

    def get(self, request):
        level   = request.query_params.get('level', 'ACSEE')
        year    = request.query_params.get('year')
        centers = request.query_params.get('centers', '')
        ids = [c.strip().upper() for c in centers.split(',') if c.strip()][:4]

        if not ids:
            return Response({'error': 'centers parameter is required.'}, status=400)

        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        results = []
        for cid in ids:
            try:
                c = SchoolCenter.objects.get(exam_session=session, center_id=cid)
            except SchoolCenter.DoesNotExist:
                continue
            subjects = list(c.subjects.values('subject_name', 'subject_gpa', 'sat').order_by('subject_gpa'))
            results.append({
                'center_id': c.center_id, 'center_name': c.center_name,
                'region': c.region, 'district': c.district or None,
                'gpa': c.center_gpa, 'national_rank': c.national_rank,
                'regional_rank': c.regional_rank, 'pass_rate': c.pass_rate,
                'divisions': {
                    'I': c.div_1_total, 'II': c.div_2_total, 'III': c.div_3_total,
                    'IV': c.div_4_total, '0': c.div_0_total,
                },
                'pass_rate_male': c.pass_rate_male, 'pass_rate_female': c.pass_rate_female,
                'subjects': subjects,
            })

        return Response({'results': results})