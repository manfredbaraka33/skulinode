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



from django.http import HttpResponse
from .card_generator import (
    generate_school_card, generate_region_card, generate_gem_card,
    generate_gender_card, generate_subject_card, generate_compare_card,generate_head_to_head_card
)



def _necta_source_url(session, center_id):
    """
    Direct link to the official NECTA results page for this center.
    Returns None if source_base_url wasn't set for this session — NECTA's
    domain has changed across years and old years may eventually be taken
    down entirely, so a link is only shown when explicitly confirmed working
    at import time, never guessed.
    """
    if not session.source_base_url:
        return None
    base = session.source_base_url.rstrip('/')
    return f'{base}/results/{center_id.lower()}.htm'




class SchoolDetailView(APIView):
    """GET /api/necta/school/<center_id>/?level=ACSEE&year=2026 — every real CSV-backed field."""
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

        graded_total = (center.div_1_total + center.div_2_total + center.div_3_total +
                        center.div_4_total + center.div_0_total)

        return Response({
            'center_id': center.center_id, 'center_name': center.center_name,
            'exam_level': session.exam_level, 'year': session.year,
            'region': center.region, 'district': center.district or None,
            'gpa': center.center_gpa,
            'grade_letter': center.grade_letter, 'grade_label': center.grade_label,
            'national_rank': center.national_rank, 'regional_rank': center.regional_rank,
            'district_rank': center.district_rank,
            'registered_total': center.registered_total,
            'absent_total': center.absent_total,
            'sat_total': center.sat_total,
            'withheld_total': center.withheld_total,
            'clean_total': center.clean_total,
            'graded_total': graded_total,
            'total_passed': center.total_passed,
            'total_failed': center.total_failed,
            'pass_rate': center.pass_rate,
            'div1_rate': center.div1_rate,
            'divisions': {
                'I': center.div_1_total, 'II': center.div_2_total,
                'III': center.div_3_total, 'IV': center.div_4_total, '0': center.div_0_total,
            },
            'divisions_by_gender': {
                'male':   {'I': center.div_1_male,   'II': center.div_2_male,   'III': center.div_3_male,   'IV': center.div_4_male,   '0': center.div_0_male},
                'female': {'I': center.div_1_female, 'II': center.div_2_female, 'III': center.div_3_female, 'IV': center.div_4_female, '0': center.div_0_female},
            },
            'gender': {
                'pass_rate_male': center.pass_rate_male, 'pass_rate_female': center.pass_rate_female,
                'sat_male': center.sat_male, 'sat_female': center.sat_female,
                'pass_male': center.pass_male, 'pass_female': center.pass_female,
            },
            'subjects': subjects,
            'necta_source_url': _necta_source_url(session, center.center_id),
        })


class SchoolTrendView(APIView):
    """
    GET /api/necta/trend/school/<center_id>/?level=ACSEE
    All years of data for this center across published sessions of the given
    level. Returns a single-point series gracefully when only one year exists.
    """
    permission_classes = []

    def get(self, request, center_id):
        level = request.query_params.get('level', 'ACSEE')
        sessions = ExamSession.objects.filter(exam_level=level, is_published=True).order_by('year')
        points = []
        for s in sessions:
            try:
                c = SchoolCenter.objects.get(exam_session=s, center_id=center_id.upper())
                points.append({'year': s.year, 'gpa': c.center_gpa,
                               'national_rank': c.national_rank, 'pass_rate': c.pass_rate})
            except SchoolCenter.DoesNotExist:
                continue
        return Response({'center_id': center_id.upper(), 'level': level, 'points': points})


class SchoolCompareView(APIView):
    """GET /api/necta/compare/?level=&year=&centers=id1,id2,id3"""
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
            })
        return Response({'results': results})


# ── Card endpoints ─────────────────────────────────────────────────────────

class SchoolCardView(APIView):
    permission_classes = []

    def get(self, request, center_id):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
            center  = SchoolCenter.objects.get(exam_session=session, center_id=center_id.upper())
        except (ExamSession.DoesNotExist, SchoolCenter.DoesNotExist):
            return Response({'error': 'Not found.'}, status=404)
        buf = generate_school_card(center, session)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = f'attachment; filename="{center.center_id}_matokeo.png"'
        return resp


class RegionCardView(APIView):
    permission_classes = []

    def get(self, request, region):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
            region_row = RegionalSummary.objects.get(exam_session=session, region=region.upper())
        except (ExamSession.DoesNotExist, RegionalSummary.DoesNotExist):
            return Response({'error': 'Not found.'}, status=404)

        top = list(SchoolCenter.objects.filter(
            exam_session=session, region=region.upper(), is_rankable=True
        ).order_by('center_gpa').values('center_name', 'center_gpa')[:5])
        top_schools = [{'center_name': s['center_name'], 'gpa': s['center_gpa']} for s in top]

        row = {'region': region_row.region, 'national_rank': region_row.national_rank,
               'school_count': region_row.school_count, 'weighted_gpa': region_row.weighted_gpa,
               'pass_rate': region_row.pass_rate}
        buf = generate_region_card(row, top_schools, level, year)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = f'attachment; filename="{region.upper()}_matokeo.png"'
        return resp


class GemCardView(APIView):
    permission_classes = []

    def get(self, request, center_id):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        gems = session.kpi_data.get('hidden_gems', [])
        gem = next((g for g in gems if g['center_id'] == center_id.upper()), None)
        if not gem:
            return Response({'error': 'Gem not found.'}, status=404)

        buf = generate_gem_card(gem, level, year)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = f'attachment; filename="{center_id.upper()}_kito.png"'
        return resp


class GenderCardView(APIView):
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        national = session.kpi_data.get('headlines', {}).get('national_gender')
        by_region = session.kpi_data.get('gender_gap_regions', [])
        if not national:
            return Response({'error': 'No gender data available.'}, status=404)

        buf = generate_gender_card(national, by_region, level, year)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = 'attachment; filename="kijinsia_matokeo.png"'
        return resp


class SubjectCardView(APIView):
    permission_classes = []

    def get(self, request, subject_name):
        level  = request.query_params.get('level', 'ACSEE')
        year   = request.query_params.get('year')
        region = request.query_params.get('region')
        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        qs = SubjectSchoolRanking.objects.filter(exam_session=session, subject_name=subject_name.upper())
        if region:
            qs = qs.filter(region=region.upper()).order_by('regional_subject_rank')
            scope_label = f'Mkoa wa {region}'
        else:
            qs = qs.order_by('national_subject_rank')
            scope_label = 'Kitaifa'

        rows = [{'rank': c.regional_subject_rank if region else c.national_subject_rank,
                 'center_name': c.center.center_name if c.center else c.center_id,
                 'subject_gpa': c.subject_gpa} for c in qs.select_related('center')[:8]]
        if not rows:
            return Response({'error': 'No data.'}, status=404)

        buf = generate_subject_card(subject_name.upper(), rows, level, year, scope_label)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = f'attachment; filename="{subject_name}_matokeo.png"'
        return resp


class CompareCardView(APIView):
    permission_classes = []

    def get(self, request):
        level   = request.query_params.get('level', 'ACSEE')
        year    = request.query_params.get('year')
        centers = request.query_params.get('centers', '')
        ids = [c.strip().upper() for c in centers.split(',') if c.strip()][:4]

        try:
            session = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        schools = []
        for cid in ids:
            try:
                c = SchoolCenter.objects.get(exam_session=session, center_id=cid)
                schools.append({'center_name': c.center_name, 'region': c.region,
                                'gpa': c.center_gpa, 'national_rank': c.national_rank,
                                'pass_rate': c.pass_rate})
            except SchoolCenter.DoesNotExist:
                continue

        if len(schools) < 2:
            return Response({'error': 'Need at least 2 valid schools.'}, status=400)

        buf = generate_compare_card(schools, level, year)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = 'attachment; filename="ulinganisho.png"'
        return resp



class HeadToHeadCardView(APIView):
    """GET /api/necta/cards/head-to-head/?level=&year=&center_a=&center_b="""
    permission_classes = []

    def get(self, request):
        level = request.query_params.get('level', 'ACSEE')
        year  = request.query_params.get('year')
        center_a_id = request.query_params.get('center_a')
        center_b_id = request.query_params.get('center_b')

        if not center_a_id or not center_b_id:
            return Response({'error': 'center_a and center_b are both required.'}, status=400)

        try:
            session  = ExamSession.objects.get(exam_level=level, year=year, is_published=True)
            school_a = SchoolCenter.objects.get(exam_session=session, center_id=center_a_id.upper())
            school_b = SchoolCenter.objects.get(exam_session=session, center_id=center_b_id.upper())
        except (ExamSession.DoesNotExist, SchoolCenter.DoesNotExist):
            return Response({'error': 'One or both schools not found.'}, status=404)

        best_a = school_a.subjects.filter(subject_gpa__isnull=False).order_by('subject_gpa').first()
        best_b = school_b.subjects.filter(subject_gpa__isnull=False).order_by('subject_gpa').first()
        best_subject_a = {'subject_name': best_a.subject_name, 'subject_gpa': best_a.subject_gpa} if best_a else None
        best_subject_b = {'subject_name': best_b.subject_name, 'subject_gpa': best_b.subject_gpa} if best_b else None

        buf = generate_head_to_head_card(school_a, school_b, session, best_subject_a, best_subject_b)
        resp = HttpResponse(buf.read(), content_type='image/png')
        resp['Content-Disposition'] = f'attachment; filename="h2h_{school_a.center_id}_vs_{school_b.center_id}.png"'
        return resp