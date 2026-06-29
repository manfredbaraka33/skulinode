"""
academy/finance_views.py
Handles FeeDefinition (Ada/Mchango), FeePhase (awamu), StudentFeeRecord, debt reports.
"""
import csv
import io
from datetime import date

from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.models import FeeDefinition, FeePhase, Student, StudentFeeRecord


def _school(request):
    return request.user.school


def _is_finance(user):
    return user.role in ('ADMIN', 'BURSAR') or 'BURSAR' in (user.roles or [])


# ── Serializers ────────────────────────────────────────────────────────────────

def _ser_phase(p):
    return {
        'id':              p.id,
        'name':            p.name,
        'amount':          float(p.amount),
        'due_date':        str(p.due_date) if p.due_date else None,
        'order':           p.order,
        'can_edit_amount': p.can_edit_amount,
        'definition':      p.definition_id,
    }


def _ser_definition(d, include_phases=True):
    data = {
        'id':            d.id,
        'name':          d.name,
        'category':      d.category,
        'category_label': d.get_category_display(),
        'academic_year': d.academic_year,
        'applies_to':    d.applies_to,
        'stream':        d.stream_id,
        'notes':         d.notes,
        'is_active':     d.is_active,
    }
    if include_phases:
        data['phases'] = [_ser_phase(p) for p in d.phases.all()]
    return data


def _ser_record(r):
    return {
        'id':                r.id,
        'student_id':        r.student_id,
        'student_name':      r.student.display_name,
        'admission_number':  r.student.admission_number,
        'stream':            f"{r.student.stream.class_level.name} {r.student.stream.name}".strip(),
        'definition_id':     r.definition_id,
        'definition_name':   r.definition.name,
        'definition_category': r.definition.category,
        'phase_id':          r.phase_id,
        'phase_name':        r.phase.name,
        'phase_order':       r.phase.order,
        'academic_year':     r.definition.academic_year,
        'amount_expected':   float(r.amount_expected),
        'amount_paid':       float(r.amount_paid),
        'balance':           float(r.balance),
        'last_payment_date': str(r.last_payment_date) if r.last_payment_date else None,
        'notes':             r.notes,
        'updated_at':        r.updated_at.isoformat(),
    }


# ── Fee Definitions ────────────────────────────────────────────────────────────

class FeeDefinitionListCreateView(APIView):
    """GET/POST /api/v1/academy/fee-definitions/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = FeeDefinition.objects.filter(school=school).prefetch_related('phases')
        year     = request.query_params.get('academic_year')
        category = request.query_params.get('category')
        if year:     qs = qs.filter(academic_year=year)
        if category: qs = qs.filter(category=category)
        return Response([_ser_definition(d) for d in qs])

    def post(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school = _school(request)
        d = FeeDefinition.objects.create(
            school        = school,
            name          = request.data.get('name', ''),
            category      = request.data.get('category', 'ADA'),
            academic_year = request.data.get('academic_year', date.today().year),
            applies_to    = request.data.get('applies_to', 'ALL'),
            stream_id     = request.data.get('stream') or None,
            notes         = request.data.get('notes', ''),
            is_active     = bool(request.data.get('is_active', True)),
        )
        # For MCHANGO: auto-create a single phase
        if d.category == 'MCHANGO':
            amount = request.data.get('amount', 0)
            FeePhase.objects.create(
                school=school, definition=d,
                name='Mchango', amount=amount, order=1,
            )
        return Response(_ser_definition(d), status=201)


class FeeDefinitionDetailView(APIView):
    """GET/PATCH/DELETE /api/v1/academy/fee-definitions/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        try:
            return FeeDefinition.objects.prefetch_related('phases').get(
                pk=pk, school=_school(request))
        except FeeDefinition.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        return Response(_ser_definition(obj))

    def patch(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        # Always editable: name, notes, is_active, applies_to, stream
        for f in ('name', 'notes', 'is_active', 'applies_to'):
            if f in request.data:
                setattr(obj, f, request.data[f])
        obj.stream_id = request.data.get('stream') or obj.stream_id
        obj.save()
        return Response(_ser_definition(obj))

    def delete(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        # Block delete if any payment has been recorded
        if StudentFeeRecord.objects.filter(
            definition=obj, amount_paid__gt=0
        ).exists():
            return Response({
                'error': 'Haiwezekani kufuta — kuna malipo yaliyorekodiwa tayari.'
            }, status=400)
        obj.delete()
        return Response(status=204)


# ── Fee Phases ─────────────────────────────────────────────────────────────────

class FeePhaseListCreateView(APIView):
    """GET/POST /api/v1/academy/fee-phases/?definition="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        qs = FeePhase.objects.filter(school=school)
        defn_id = request.query_params.get('definition')
        if defn_id: qs = qs.filter(definition_id=defn_id)
        return Response([_ser_phase(p) for p in qs])

    def post(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school  = _school(request)
        defn_id = request.data.get('definition')
        try:
            defn = FeeDefinition.objects.get(pk=defn_id, school=school)
        except FeeDefinition.DoesNotExist:
            return Response({'error': 'Fee definition not found.'}, status=404)
        p = FeePhase.objects.create(
            school     = school,
            definition = defn,
            name       = request.data.get('name', ''),
            amount     = request.data.get('amount', 0),
            due_date   = request.data.get('due_date') or None,
            order      = request.data.get('order', defn.phases.count() + 1),
        )
        return Response(_ser_phase(p), status=201)


class FeePhaseDetailView(APIView):
    """PATCH/DELETE /api/v1/academy/fee-phases/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        try:
            return FeePhase.objects.get(pk=pk, school=_school(request))
        except FeePhase.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        # Name/due_date/order: always editable
        for f in ('name', 'due_date', 'order'):
            if f in request.data:
                setattr(obj, f, request.data[f] or None if f == 'due_date' else request.data[f])
        # Amount: editable only if no payments yet
        if 'amount' in request.data:
            if obj.can_edit_amount:
                obj.amount = request.data['amount']
            else:
                return Response({
                    'error': 'Kiasi hakiwezi kubadilishwa — kuna malipo yaliyorekodiwa tayari.'
                             ' Ongeza rekodi ya marekebisho badala yake.',
                    'can_edit_amount': False,
                }, status=400)
        obj.save()
        return Response(_ser_phase(obj))

    def delete(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        obj = self._get(request, pk)
        if not obj: return Response({'error': 'Not found.'}, status=404)
        if not obj.can_edit_amount:
            return Response({
                'error': 'Haiwezekani kufuta — kuna malipo yaliyorekodiwa.'
            }, status=400)
        obj.delete()
        return Response(status=204)


# ── Student Fee Records ────────────────────────────────────────────────────────

class StudentFeeRecordListView(APIView):
    """GET /api/v1/academy/fee-records/?definition=&stream=&academic_year="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school    = _school(request)
        defn_id   = request.query_params.get('definition')
        stream_id = request.query_params.get('stream')
        year      = request.query_params.get('academic_year')

        qs = StudentFeeRecord.objects.filter(
            school=school
        ).select_related('student__stream__class_level', 'definition', 'phase')

        if defn_id:   qs = qs.filter(definition_id=defn_id)
        if stream_id: qs = qs.filter(student__stream_id=stream_id)
        if year:      qs = qs.filter(definition__academic_year=year)

        return Response([_ser_record(r) for r in qs])


class FeeRecordGenerateView(APIView):
    """
    POST /api/v1/academy/fee-records/generate/
    Body: { definition }
    Auto-creates one StudentFeeRecord per eligible student per phase.
    Safe to call multiple times (idempotent via get_or_create).
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school  = _school(request)
        defn_id = request.data.get('definition')
        try:
            defn = FeeDefinition.objects.prefetch_related('phases').get(
                pk=defn_id, school=school)
        except FeeDefinition.DoesNotExist:
            return Response({'error': 'Fee definition not found.'}, status=404)

        phases = list(defn.phases.all())
        if not phases:
            return Response({'error': 'Ongeza awamu kwanza kabla ya kutengeneza rekodi.'}, status=400)

        students = Student.objects.filter(school=school)
        if defn.applies_to == 'STREAM' and defn.stream_id:
            students = students.filter(stream_id=defn.stream_id)

        created = 0
        for phase in phases:
            for student in students:
                _, was_created = StudentFeeRecord.objects.get_or_create(
                    school=school, student=student, phase=phase,
                    defaults={
                        'definition':      defn,
                        'amount_expected': phase.amount,
                        'amount_paid':     0,
                        'recorded_by':     request.user,
                    },
                )
                if was_created: created += 1

        return Response({'created': created, 'definition': defn.name})


class FeeRecordPaymentView(APIView):
    """
    POST /api/v1/academy/fee-records/<pk>/payment/
    Body: { amount_paid, payment_date?, notes? }
    Adds to existing paid amount.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        try:
            record = StudentFeeRecord.objects.get(pk=pk, school=_school(request))
        except StudentFeeRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        try:
            amount = float(request.data.get('amount_paid', 0))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid amount.'}, status=400)
        if amount <= 0:
            return Response({'error': 'Kiasi lazima kiwe zaidi ya sifuri.'}, status=400)
        
        import decimal

        amount = decimal.Decimal(str(amount))

        record.amount_paid       += amount
        record.last_payment_date  = request.data.get('payment_date') or date.today()
        if request.data.get('notes'):
            existing = record.notes
            record.notes = f"{existing}\n{request.data['notes']}".strip() if existing else request.data['notes']
        record.recorded_by = request.user
        record.save()
        return Response(_ser_record(record))


class FeeRecordUpdateView(APIView):
    """PATCH /api/v1/academy/fee-records/<pk>/ — override expected/paid directly."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        try:
            record = StudentFeeRecord.objects.get(pk=pk, school=_school(request))
        except StudentFeeRecord.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        for f in ('amount_expected', 'amount_paid', 'notes'):
            if f in request.data:
                setattr(record, f, request.data[f])
        if 'payment_date' in request.data:
            record.last_payment_date = request.data['payment_date'] or None
        record.recorded_by = request.user
        record.save()
        return Response(_ser_record(record))


# ── Debt Report ────────────────────────────────────────────────────────────────

class FeeDebtReportView(APIView):
    """
    GET /api/v1/academy/fee-reports/?stream=&academic_year=&include_all_years=
    Returns per-student debt summary.
    include_all_years=true → show historical debts too.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school      = _school(request)
        stream_id   = request.query_params.get('stream')
        year        = request.query_params.get('academic_year', date.today().year)
        all_years   = request.query_params.get('include_all_years', 'false').lower() == 'true'

        qs = StudentFeeRecord.objects.filter(
            school=school,
        ).select_related('student__stream__class_level', 'definition', 'phase')

        if stream_id: qs = qs.filter(student__stream_id=stream_id)
        if not all_years: qs = qs.filter(definition__academic_year=year)

        student_map = {}
        for rec in qs:
            sid = rec.student_id
            if sid not in student_map:
                student_map[sid] = {
                    'student_id':   sid,
                    'name':         rec.student.display_name,
                    'admission_no': rec.student.admission_number,
                    'stream':       f"{rec.student.stream.class_level.name} {rec.student.stream.name}".strip(),
                    'current':      [],
                    'historical':   [],
                    'total_expected': 0,
                    'total_paid':     0,
                }
            entry = {
                'record_id':    rec.id,
                'definition':   rec.definition.name,
                'category':     rec.definition.category,
                'phase':        rec.phase.name,
                'year':         rec.definition.academic_year,
                'expected':     float(rec.amount_expected),
                'paid':         float(rec.amount_paid),
                'balance':      float(rec.balance),
            }
            bucket = 'current' if str(rec.definition.academic_year) == str(year) else 'historical'
            student_map[sid][bucket].append(entry)
            student_map[sid]['total_expected'] += float(rec.amount_expected)
            student_map[sid]['total_paid']     += float(rec.amount_paid)

        rows = []
        for s in student_map.values():
            s['total_balance'] = s['total_expected'] - s['total_paid']
            rows.append(s)
        rows.sort(key=lambda r: -r['total_balance'])

        return Response({
            'academic_year':   year,
            'total_students':  len(rows),
            'debtors':         sum(1 for r in rows if r['total_balance'] > 0),
            'cleared':         sum(1 for r in rows if r['total_balance'] <= 0),
            'total_expected':  sum(r['total_expected'] for r in rows),
            'total_paid':      sum(r['total_paid']     for r in rows),
            'total_balance':   sum(r['total_balance']  for r in rows),
            'students':        rows,
        })


class FeeDebtReportCSVView(APIView):
    """GET /api/v1/academy/fee-reports/csv/?stream=&academic_year="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_finance(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        school    = _school(request)
        stream_id = request.query_params.get('stream')
        year      = request.query_params.get('academic_year', date.today().year)

        qs = StudentFeeRecord.objects.filter(
            school=school,
              definition__academic_year=year,
              definition__isnull=False,
        ).select_related('student__stream__class_level', 'definition', 'phase').order_by(
            'student__stream__class_level__name', 'student__last_name',
            'definition__category', 'phase__order',
        )
        if stream_id: qs = qs.filter(student__stream_id=stream_id)

        buf    = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            'Student Name', 'Admission No', 'Stream',
            'Category', 'Fee Name', 'Phase / Awamu',
            'Expected (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'Last Payment',
        ])
        for rec in qs:
            writer.writerow([
                rec.student.display_name,
                rec.student.admission_number or '',
                f"{rec.student.stream.class_level.name} {rec.student.stream.name}".strip(),
                rec.definition.get_category_display(),
                rec.definition.name,
                rec.phase.name,
                float(rec.amount_expected),
                float(rec.amount_paid),
                float(rec.balance),
                rec.last_payment_date or '',
            ])

        response = HttpResponse(buf.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="madeni_{year}.csv"'
        )
        return response