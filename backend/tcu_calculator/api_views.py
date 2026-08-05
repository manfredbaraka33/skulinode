from rest_framework.views import APIView
from rest_framework.response import Response

from .models import TCUAdmissionCycle, TCUInstitution
from .services import calculate_eligibility


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

        if not subjects:
            return Response({'error': 'At least one subject with a grade is required.'}, status=400)

        try:
            cycle = TCUAdmissionCycle.objects.get(pk=cycle_id, is_published=True)
        except TCUAdmissionCycle.DoesNotExist:
            return Response({'error': 'Admission cycle not found.'}, status=404)

        result = calculate_eligibility(
            student_subjects=subjects, cohort=cohort, cycle=cycle, region=region,
        )
        return Response(result)