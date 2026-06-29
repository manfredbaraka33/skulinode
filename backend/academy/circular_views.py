"""academy/circular_views.py — CRUD for TermCircular."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.models import Stream, TermCircular


def _school(request):
    return request.user.school


def _is_admin(user):
    return user.role == 'ADMIN' or 'ADMIN' in (user.roles or [])


def _serialize(c):
    return {
        'id':                 c.id,
        'title':              c.title,
        'academic_year':      c.academic_year,
        'stream':             c.stream_id,
        'closing_date':       str(c.closing_date)  if c.closing_date  else None,
        'opening_date':       str(c.opening_date)  if c.opening_date  else None,
        'school_motto':       c.school_motto,
        'items':              c.items,
        'show_fee_statement': c.show_fee_statement,
        'updated_at':         c.updated_at.isoformat(),
        'created_at':         c.created_at.isoformat(),
    }


class CircularListCreateView(APIView):
    """GET/POST /api/v1/academy/circulars/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = TermCircular.objects.filter(school=school)
        stream_id = request.query_params.get('stream')
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        return Response([_serialize(c) for c in qs])

    def post(self, request):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school = _school(request)
        c = TermCircular.objects.create(
            school        = school,
            title         = request.data.get('title', 'End of Term Circular'),
            academic_year = request.data.get('academic_year', 2026),
            stream_id     = request.data.get('stream') or None,
            closing_date  = request.data.get('closing_date') or None,
            opening_date  = request.data.get('opening_date') or None,
            school_motto  = request.data.get('school_motto', ''),
            items         = request.data.get('items', []),
            show_fee_statement = bool(request.data.get('show_fee_statement', True)),
            created_by    = request.user,
        )
        return Response(_serialize(c), status=201)


class CircularDetailView(APIView):
    """GET/PUT/DELETE /api/v1/academy/circulars/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        try:
            return TermCircular.objects.get(pk=pk, school=_school(request))
        except TermCircular.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        return Response(_serialize(obj))

    def put(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        for f in ('title', 'academic_year', 'school_motto', 'items', 'show_fee_statement'):
            if f in request.data:
                setattr(obj, f, request.data[f])
        obj.stream_id    = request.data.get('stream')    or None
        obj.closing_date = request.data.get('closing_date') or None
        obj.opening_date = request.data.get('opening_date') or None
        obj.save()
        return Response(_serialize(obj))

    def delete(self, request, pk):
        if not _is_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        obj.delete()
        return Response(status=204)