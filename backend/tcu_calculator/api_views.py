from rest_framework.views import APIView
from rest_framework.response import Response

from .models import TCUAdmissionCycle, TCUInstitution,TCUProgramme
from .services import calculate_eligibility
from django.http import HttpResponseRedirect


class TCUCyclesView(APIView):
    """GET /api/tcu/cycles/"""
    permission_classes = []

    def get(self, request):
        cycles = TCUAdmissionCycle.objects.filter(is_published=True)
        return Response([{'id': c.id, 'academic_year': c.academic_year} for c in cycles])


class TCUInstitutionsView(APIView):
    """GET /api/tcu/institutions/?cycle_id=1 — for the region/institution filter dropdown"""
    permission_classes = []

    def get(self, request):
        cycle_id = request.query_params.get('cycle_id')
        qs = TCUInstitution.objects.filter(cycle_id=cycle_id) if cycle_id else TCUInstitution.objects.filter(
            cycle__is_published=True
        )
        return Response([{'id': i.id, 'name': i.name, 'location': i.location} for i in qs])


class TCUCalculateView(APIView):
    """
    POST /api/tcu/calculate/
    Body: {
      "cycle_id": 1,
      "cohort": "2016_ONWARDS",
      "subjects": [{"subject": "Physics", "grade": "B"}, ...],
      "region": "Dar es Salaam" (optional)
    }
    """
    permission_classes = []

    def post(self, request):
        cycle_id = request.data.get('cycle_id')
        cohort   = request.data.get('cohort', '2016_ONWARDS')
        subjects = request.data.get('subjects', [])
        region   = request.data.get('region')
        ownership = request.data.get('ownership')
        category  = request.data.get('category')

        if not subjects:
            return Response({'error': 'At least one subject with a grade is required.'}, status=400)

        try:
            cycle = TCUAdmissionCycle.objects.get(pk=cycle_id, is_published=True)
        except TCUAdmissionCycle.DoesNotExist:
            return Response({'error': 'Admission cycle not found.'}, status=404)

        result = calculate_eligibility(
            student_subjects=subjects, cohort=cohort, cycle=cycle, region=region, ownership=ownership, category=category,
        )
        return Response(result)







class TCUInsightsView(APIView):
    """GET /api/tcu/insights/?cycle_id=1"""
    permission_classes = []

    def get(self, request):
        cycle_id = request.query_params.get('cycle_id')
        try:
            cycle = TCUAdmissionCycle.objects.get(pk=cycle_id, is_published=True)
        except TCUAdmissionCycle.DoesNotExist:
            return Response({'error': 'Cycle not found.'}, status=404)
        return Response(cycle.insights_data)


class TCUGuidebookDownloadView(APIView):
    """GET /api/tcu/guidebook/?cycle_id=1"""
    permission_classes = []

    def get(self, request):
        cycle_id = request.query_params.get('cycle_id')
        try:
            cycle = TCUAdmissionCycle.objects.get(pk=cycle_id, is_published=True)
        except TCUAdmissionCycle.DoesNotExist:
            return Response({'error': 'Cycle not found.'}, status=404)
        if not cycle.guidebook_pdf:
            return Response({'error': 'Guidebook not uploaded yet.'}, status=404)
        return HttpResponseRedirect(cycle.guidebook_pdf.url)


class TCUProgrammeCompareView(APIView):
    """
    GET /api/tcu/compare-programmes/?cycle_id=1&programme_ids=12,45
    Side-by-side comparison of exactly 2 programmes (can be same or
    different institutions), including per-slot subject requirements
    laid out for direct visual diffing.
    """
    permission_classes = []

    def get(self, request):
        cycle_id = request.query_params.get('cycle_id')
        ids_param = request.query_params.get('programme_ids', '')
        ids = [i.strip() for i in ids_param.split(',') if i.strip()][:2]

        if len(ids) != 2:
            return Response({'error': 'Exactly 2 programme_ids are required.'}, status=400)

        try:
            cycle = TCUAdmissionCycle.objects.get(pk=cycle_id, is_published=True)
        except TCUAdmissionCycle.DoesNotExist:
            return Response({'error': 'Cycle not found.'}, status=404)

        programmes = TCUProgramme.objects.filter(
            id__in=ids, institution__cycle=cycle
        ).select_related('institution')

        if programmes.count() != 2:
            return Response({'error': 'One or both programmes not found.'}, status=404)

        results = [{
            'id': p.id,
            'programme_name': p.programme_name,
            'programme_code': p.programme_code,
            'category': p.get_category_display() if p.category else None,
            'institution_name': p.institution.name,
            'institution_location': p.institution.location,
            'institution_ownership': p.institution.get_ownership_display(),
            'application_url': p.institution.application_url,
            'min_points_total': p.min_points_total,
            'capacity': p.capacity,
            'duration_years': p.duration_years,
            'slots': p.slots,
        } for p in programmes]

        return Response({'results': results})


class TCUProgrammeSearchView(APIView):
    """GET /api/tcu/search-programmes/?cycle_id=1&q=nursing — powers the compare-picker."""
    permission_classes = []

    def get(self, request):
        cycle_id = request.query_params.get('cycle_id')
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'results': []})

        qs = TCUProgramme.objects.filter(
            institution__cycle_id=cycle_id, status='ok'
        ).filter(programme_name__icontains=q).select_related('institution')[:15]

        return Response({'results': [{
            'id': p.id, 'programme_name': p.programme_name,
            'institution_name': p.institution.name,
            'min_points_total': p.min_points_total,
        } for p in qs]})