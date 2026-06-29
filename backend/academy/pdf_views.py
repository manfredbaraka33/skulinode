"""
academy/pdf_views.py
--------------------
Server-side PDF generation using ReportLab.

Endpoints
---------
GET  /api/v1/academy/results/pdf/          ?assessment=&stream=
GET  /api/v1/academy/marks/pdf/            ?subject=&stream=&assessment=
POST /api/v1/academy/report-cards/pdf/    {assessment, stream, comments:{}, student_id?}
"""
import io
import os
from datetime import date

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academy.permissions import IsSchoolPaid, IsSchoolPaidOrDownloadOnly
from academy.combined import build_combined_results_data, CombinedResultsValidationError

from academy.grading import NECTA_DEFAULTS, compute_student_summary, get_grade_from_configs
from academy.models import (
    Assessment,
    GradeConfig,
    Mark,
    Stream,
    Student,
    StudentSubjectExclusion,
    Subject,
    SubjectAssignment,
)
from core.models import School


# ── Brand palette ──────────────────────────────────────────────────────────────
NAVY        = colors.HexColor('#1e3a5f')
GOLD        = colors.HexColor('#c4a014')
BLUE_MID    = colors.HexColor('#2563eb')
LIGHT_BG    = colors.HexColor('#f0f6ff')
BORDER_BLUE = colors.HexColor('#dbeafe')
SLATE_GREY  = colors.HexColor('#64748b')
ROW_ALT     = colors.HexColor('#f8faff')
G_GREEN     = colors.HexColor('#166534')
G_TEAL      = colors.HexColor('#0f766e')
G_AMBER     = colors.HexColor('#92400e')
G_ORANGE    = colors.HexColor('#c2410c')
G_PURPLE    = colors.HexColor('#7e22ce')
G_RED       = colors.HexColor('#b91c1c')

GRADE_COLORS = {
    'A': G_GREEN, 'B': G_TEAL, 'C': G_AMBER,
    'D': G_ORANGE, 'E': G_PURPLE, 'S': colors.HexColor('#4338ca'), 'F': G_RED,
    '-': SLATE_GREY,
}
GRADE_HEX = {
    'A': '#166534', 'B': '#0f766e', 'C': '#92400e',
    'D': '#c2410c', 'E': '#7e22ce', 'S': '#4338ca', 'F': '#b91c1c', '-': '#64748b',
}
GRADE_COMMENT = {
    'A': 'Excellent', 'B': 'Very Good', 'C': 'Good', 'D': 'Average',
    'E': 'Below Average', 'F': 'Improve',
}
DIV_COLORS = {
    'Division I':   colors.HexColor('#166534'),
    'Division II':  colors.HexColor('#0f766e'),
    'Division III': colors.HexColor('#92400e'),
    'Division IV':  colors.HexColor('#c2410c'),
    'Division 0':   colors.HexColor('#b91c1c'),
    'Fail':         colors.HexColor('#b91c1c'),
}
DIV_HEX = {
    'Division I':   '#166534',
    'Division II':  '#0f766e',
    'Division III': '#92400e',
    'Division IV':  '#c2410c',
    'Division 0':   '#b91c1c',
    'Fail':         '#b91c1c',
}


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _school_of(request):
    return request.user.school


def _make_subject_codes(subjects):
    """Generate unique 3-letter codes per subject name."""
    codes = {}
    used = {}
    for i, name in enumerate(subjects):
        parts = name.split()
        first = ''.join(c for c in (parts[0] if parts else '')) if True else ''
        first = ''.join(c for c in first if c.isalpha())
        base = first[:3].upper() or f'S{i + 1}'
        code = base
        n = 2
        while code in used:
            code = base[:2] + str(n)
            n += 1
        used[code] = True
        codes[name] = code
    return codes


# GPA point weights — O-Level and A-Level
_GPA_MAP_ORD = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5}
_GPA_MAP_ADV = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 5}


def _gpa_color_hex(gpa: float) -> str:
    """Return a hex colour string matching the frontend gpaColor() function."""
    if gpa <= 1.5:  return '#166534'   # green-700
    if gpa <= 2.5:  return '#0f766e'   # teal-700
    if gpa <= 3.5:  return '#92400e'   # amber-800
    if gpa <= 4.0:  return '#c2410c'   # orange-700
    return '#b91c1c'                   # red-700


def _build_analytics(subjects, students, school_type):
    """Compute per-subject analytics identical to frontend buildAnalytics."""
    grade_set = ['A', 'B', 'C', 'D', 'E', 'F'] if school_type == 'ADVANCED' else ['A', 'B', 'C', 'D', 'F']
    gpa_map   = _GPA_MAP_ADV if school_type == 'ADVANCED' else _GPA_MAP_ORD
    rows = []
    for subj in subjects:
        scores  = []
        gc      = {g: 0 for g in grade_set}
        gpa_sum = 0
        for st in students:
            d = st['subjects'].get(subj)
            if not d or d.get('excluded') or d.get('score') is None:
                continue
            scores.append(float(d['score']))
            g = d.get('grade', '-')
            if g in gc:
                gc[g] += 1
            gpa_sum += gpa_map.get(g, 5)
        sat = len(scores)
        avg = round(sum(scores) / sat, 1) if sat else None
        high = max(scores) if sat else None
        low = min(scores) if sat else None
        passes = sat - gc.get('F', 0)
        pass_rate = f"{round((passes / sat) * 100)}%" if sat else '–'
        gpa = round(gpa_sum / sat, 2) if sat else None
        rows.append({
            'subj': subj,
            'sat': sat,
            'gc': gc,
            'grade_set': grade_set,
            'avg': f'{avg}' if avg is not None else '–',
            'high': f'{int(high)}' if high is not None else '–',
            'low': f'{int(low)}' if low is not None else '–',
            'pass_rate': pass_rate,
            'gpa': gpa,
        })
    return rows


def _build_combined_analytics(subjects, students, school_type):
    """Compute per-subject analytics from combined-mode final subject scores."""
    grade_set = ['A', 'B', 'C', 'D', 'E', 'F'] if school_type == 'ADVANCED' else ['A', 'B', 'C', 'D', 'F']
    gpa_map = _GPA_MAP_ADV if school_type == 'ADVANCED' else _GPA_MAP_ORD
    rows = []
    for subj in subjects:
        scores = []
        gc = {g: 0 for g in grade_set}
        gpa_sum = 0
        for st in students:
            d = (st.get('subjects') or {}).get(subj)
            if not d or d.get('excluded') or d.get('excluded_for_no_marks'):
                continue
            score = d.get('final_score')
            if score is None:
                continue
            grade = d.get('grade', '-')
            scores.append(float(score))
            if grade in gc:
                gc[grade] += 1
            gpa_sum += gpa_map.get(grade, 5)
        sat = len(scores)
        avg = round(sum(scores) / sat, 1) if sat else None
        high = max(scores) if sat else None
        low = min(scores) if sat else None
        passes = sat - gc.get('F', 0)
        pass_rate = f"{round((passes / sat) * 100)}%" if sat else '–'
        gpa = round(gpa_sum / sat, 2) if sat else None
        rows.append({
            'subj': subj,
            'sat': sat,
            'gc': gc,
            'grade_set': grade_set,
            'avg': f'{avg}' if avg is not None else '–',
            'high': f'{high:.1f}' if high is not None else '–',
            'low': f'{low:.1f}' if low is not None else '–',
            'pass_rate': pass_rate,
            'gpa': gpa,
        })
    return rows


def _fetch_results_data(request):
    """
    Load all results data — shared between ResultsPDFView and ReportCardsPDFView.
    Returns a dict with school, subjects (names), students (rows), stream/assessment info.
    """
    assessment_id = request.query_params.get('assessment') or request.data.get('assessment')
    stream_id = request.query_params.get('stream') or request.data.get('stream')

    school = _school_of(request)
    school_type = school.school_type

    grade_configs = list(
        GradeConfig.objects.filter(school=school).order_by('-min_score')
        .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
    )
    if not grade_configs:
        grade_configs = NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

    subjects_qs = Subject.objects.filter(
        school=school,
        assignments__stream_id=stream_id,
    ).distinct()
    subjects = list(subjects_qs)
    subject_ids = [s.id for s in subjects]

    students_list = list(
        Student.objects.filter(school=school, stream_id=stream_id)
        .order_by('gender', 'last_name', 'first_name')
    )
    exclusions = set(
        StudentSubjectExclusion.objects.filter(
            school=school, student__in=students_list, subject__in=subjects
        ).values_list('student_id', 'subject_id')
    )
    marks_map = {
        (m.student_id, m.subject_id): m
        for m in Mark.objects.filter(
            school=school, assessment_id=assessment_id,
            student__in=students_list, subject_id__in=subject_ids,
        )
    }

    rows = []
    for student in students_list:
        subj_data = {}
        subject_results = []
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
            'subjects': subj_data,
            'total_score': summary['total_score'],
            'total_possible': summary['total_possible'],
            'average': summary['average'],
            'grade': summary['grade'],
            'grade_remarks': summary['grade_remarks'],
            'points': summary['points'],
            'division': summary['division'],
        })

    # Rank: PRIMARY → by total_score desc; O/A level → by average desc (points asc tiebreaker)
    if school_type == 'PRIMARY':
        rows_ranked = sorted(
            [r for r in rows if r['total_score'] is not None],
            key=lambda r: -r['total_score'],
        )
        rows_unranked = [r for r in rows if r['total_score'] is None]
    else:
        rows_ranked = sorted(
            [r for r in rows if r['average'] is not None],
            key=lambda r: (-(r['average'] or 0), (r['points'] or 999)),
        )
        rows_unranked = [r for r in rows if r['average'] is None]

    total_students = len(rows)
    for i, r in enumerate(rows_ranked, 1):
        r['rank'] = i
        r['total_students'] = total_students
    for r in rows_unranked:
        r['rank'] = None
        r['total_students'] = total_students

    all_rows = rows_ranked + rows_unranked

    # Stream & assessment labels
    try:
        stream_obj = Stream.objects.select_related('class_level').get(pk=stream_id)
        stream_label = f"{stream_obj.class_level.name} {stream_obj.name}".strip()
    except Stream.DoesNotExist:
        stream_label = ''
    try:
        assessment_obj = Assessment.objects.get(pk=assessment_id)
        assessment_name = assessment_obj.name
        assessment_year = str(assessment_obj.academic_year)
    except Assessment.DoesNotExist:
        assessment_name = ''
        assessment_year = ''

    return {
        'school': school,
        'school_type': school_type,
        'subjects': [s.name for s in subjects],
        'subject_codes': {s.name: s.code for s in subjects},
        'students': all_rows,
        'stream_label': stream_label,
        'assessment_name': assessment_name,
        'assessment_year': assessment_year,
        'grade_configs': grade_configs,
    }


def _combined_payload(request):
    stream_id = request.data.get('stream')
    assessments = request.data.get('assessments')
    treat_missing_as_zero = bool(request.data.get('treat_missing_as_zero', False))
    single_student_id = request.data.get('student_id')
    return stream_id, assessments, treat_missing_as_zero, single_student_id


# ── ReportLab building blocks ──────────────────────────────────────────────────

def _logo_image(school, size_mm=30):
    """Return an Image flowable for the school logo, or None if unavailable.

    Returns None when show_logo is False, when there is no logo saved, or when
    the image cannot be loaded from the local filesystem or remote storage.
    """
    if not getattr(school, 'show_logo', True):
        return None
    if not school.logo or not school.logo.name:
        return None
    # 1. Try local file path (works for non-Cloudinary / DEBUG setups)
    try:
        logo_path = school.logo.path
        if os.path.exists(logo_path):
            return Image(logo_path, width=size_mm * mm, height=size_mm * mm)
    except Exception:
        pass
    # 2. Fallback: download from remote storage URL (Cloudinary, S3, etc.)
    try:
        import urllib.request
        url = school.logo.url
        with urllib.request.urlopen(url, timeout=10) as response:  # nosec B310
            img_bytes = io.BytesIO(response.read())
        return Image(img_bytes, width=size_mm * mm, height=size_mm * mm)
    except Exception:
        pass
    return None


def _signature_image(user, width_mm=45, height_mm=18):
    """Return an Image flowable for a user's signature, or None."""
    if not user or not user.signature or not user.signature.name:
        return None
    try:
        path = user.signature.path
        if os.path.exists(path):
            return Image(path, width=width_mm * mm, height=height_mm * mm)
    except Exception:
        pass
    try:
        import urllib.request
        url = user.signature.url
        with urllib.request.urlopen(url, timeout=10) as resp:
            img_bytes = io.BytesIO(resp.read())
        return Image(img_bytes, width=width_mm * mm, height=height_mm * mm)
    except Exception:
        pass
    return None



def _school_header(school, title, usable_width, compact=False):
    """
    Two-column header: logo left, school name + location + report title right.
    Underlined with a thick NAVY rule + GOLD accent.
    Pass compact=True for reduced sizes on report cards.
    """
    name_style = ParagraphStyle(
        'sn', fontName='Helvetica-Bold', fontSize=12 if compact else 14,
        textColor=NAVY, alignment=TA_CENTER, spaceAfter=1 if compact else 2,
    )
    loc_style = ParagraphStyle(
        'sl', fontName='Helvetica', fontSize=8,
        textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=1 if compact else 2,
    )
    title_style = ParagraphStyle(
        'st', fontName='Helvetica-Bold', fontSize=9 if compact else 11,
        textColor=NAVY, alignment=TA_CENTER,
    )

    name_p = Paragraph(school.name.upper(), name_style)
    loc_parts = [p for p in [school.ward, school.district, school.region] if p]
    loc_p = Paragraph(', '.join(loc_parts), loc_style) if loc_parts else Spacer(1, 4)

    contacts = [
        f'{school.po_box}' if school.po_box else None,
        school.phone or None,
        school.email or None,
    ]
    contact_text = ' | '.join(c for c in contacts if c)
    contact_p = Paragraph(contact_text, loc_style) if contact_text else Spacer(1, 2)

    reg_p = Paragraph(
        f'Reg. No: {school.registration_number}',
        ParagraphStyle('sr', fontName='Helvetica', fontSize=8,
                       textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=2),
    ) if school.registration_number else Spacer(1, 2)

    title_p = Paragraph(title.upper(), title_style)

    logo_img = _logo_image(school, size_mm=26 if compact else 40)
    if logo_img is None:
        # No logo (or show_logo=False): single-column layout, text spans full width
        tbl = Table(
            [[[name_p, loc_p, contact_p, reg_p, title_p]]],
            colWidths=[usable_width],
        )
        tbl.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('LINEBELOW', (0, 0), (-1, 0), 2.5, NAVY),
            ('LINEBELOW', (0, 0), (-1, 0), 1.5, GOLD),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4 if compact else 8),
            ('TOPPADDING', (0, 0), (-1, 0), 2 if compact else 4),
        ]))
        return tbl

    col1_w = (36 if compact else 50) * mm
    col2_w = usable_width - col1_w
    tbl = Table(
        [[logo_img, [name_p, loc_p, contact_p, reg_p, title_p]]],
        colWidths=[col1_w, col2_w],
    )
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('LINEBELOW', (0, 0), (-1, 0), 2.5, NAVY),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, GOLD),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4 if compact else 8),
        ('TOPPADDING', (0, 0), (-1, 0), 2 if compact else 4),
    ]))
    return tbl


def _meta_table(pairs, usable_width, cols=3):
    """Key-value metadata in a light-blue box, N columns wide."""
    cell_style = ParagraphStyle(
        'meta', fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#1e293b'),
    )
    cells = []
    row = []
    for i, (k, v) in enumerate(pairs):
        row.append(Paragraph(f'<b>{k}:</b> {v}', cell_style))
        if len(row) == cols or i == len(pairs) - 1:
            while len(row) < cols:
                row.append('')
            cells.append(row)
            row = []

    tbl = Table(cells, colWidths=[usable_width / cols] * cols)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def _section_heading(text, compact=False):
    return Paragraph(
        text,
        ParagraphStyle(
            'sh', fontName='Helvetica-Bold', fontSize=9,
            textColor=NAVY, spaceBefore=4 if compact else 7, spaceAfter=2 if compact else 3,
        ),
    )


def _footer(usable_width):
    return Paragraph(
        f'Generated by SkuliNode &nbsp;|&nbsp; {date.today().strftime("%d %B %Y")}',
        ParagraphStyle(
            'ft', fontName='Helvetica-Oblique', fontSize=7,
            textColor=SLATE_GREY, alignment=TA_CENTER, spaceBefore=6,
        ),
    )


def _gradient_bar(usable_width):
    """A thin navy-to-blue decorative bar (simulated as a flat navy rule)."""
    return HRFlowable(width='100%', thickness=5, color=NAVY, spaceAfter=0, spaceBefore=0)


# ── Results PDF ────────────────────────────────────────────────────────────────

class ResultsPDFView(APIView):
    """
    GET /api/v1/academy/results/pdf/?assessment=&stream=
    Returns a landscape A4 PDF: standings + subject key + NECTA-style analytics.
    Requires an active school subscription.
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def get(self, request):
        assessment_id = request.query_params.get('assessment')
        stream_id = request.query_params.get('stream')
        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)

        data = _fetch_results_data(request)
        school = data['school']
        school_type = data['school_type']
        subjects = data['subjects']
        students = data['students']
        is_primary = school_type == 'PRIMARY'
        grade_labels = ['A', 'B', 'C', 'D', 'E', 'F'] if school_type == 'ADVANCED' else ['A', 'B', 'C', 'D', 'F']
        sub_codes = data['subject_codes']   # use admin-registered subject codes
        analytics = _build_analytics(subjects, students, school_type)

        buf = io.BytesIO()
        page_size = landscape(A4)
        MARGIN = 10 * mm
        doc = SimpleDocTemplate(
            buf,
            pagesize=page_size,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=MARGIN,
            title=f"Results — {data['stream_label']} — {data['assessment_name']}",
        )
        W = page_size[0] - 2 * MARGIN  # usable width in points
        story = []

        # ── Top accent bar ──
        story.append(_gradient_bar(W))
        story.append(Spacer(1, 4))

        # ── School header ──
        story.append(_school_header(school, 'Class Performance Results', W))
        story.append(Spacer(1, 5))

        # ── Meta info ──
        story.append(_meta_table([
            ('Class', data['stream_label']),
            ('Assessment', data['assessment_name']),
            ('Academic Year', data['assessment_year']),
            ('School Type', school_type),
            ('Total Students', str(len(students))),
            ('Date Printed', date.today().strftime('%d %B %Y')),
        ], W))
        story.append(Spacer(1, 6))

        # ── Section A: Standings table ──
        story.append(_section_heading('A. STUDENT STANDINGS'))

        header_row = ['#', 'Student Name', 'G']
        header_row += [sub_codes[s] for s in subjects]
        header_row += ['Total', 'Avg']
        if is_primary:
            header_row += ['Grade']
        else:
            header_row += ['Pts', 'Division']

        # Column widths
        # Fixed: rank=8, name=42, gender=6, total=12, avg=12, grade=14 / pts=10+div=22
        fixed_pts = (8 + 42 + 6 + 12 + 12) * mm
        tail_pts = 14 * mm if is_primary else (10 + 22) * mm
        subj_budget = W - fixed_pts - tail_pts
        n_subj = max(len(subjects), 1)
        subj_w = min(max(subj_budget / n_subj, 13 * mm), 24 * mm)

        col_widths = [8 * mm, 42 * mm, 6 * mm]
        col_widths += [subj_w] * len(subjects)
        col_widths += [12 * mm, 12 * mm]
        if is_primary:
            col_widths += [14 * mm]
        else:
            col_widths += [10 * mm, 22 * mm]

        tbl_data = [header_row]
        for r in students:
            row = [str(r['rank'] or '–'), r['display_name'], r['gender'] or '']
            for subj in subjects:
                d = r['subjects'].get(subj, {})
                if d.get('excluded'):
                    row.append('–')
                elif d.get('score') is not None:
                    row.append(f"{int(d['score']) if float(d['score']) == int(d['score']) else d['score']}({d.get('grade', '-')})")
                else:
                    row.append('–')
            row.append(str(r['total_score']) if r['total_score'] is not None else '–')
            row.append(str(r['average']) if r['average'] is not None else '–')
            if is_primary:
                row.append(r['grade'] or '–')
            else:
                row.append(str(r['points']) if r['points'] is not None else '–')
                row.append(r['division'] or '–')
            tbl_data.append(row)

        standings_tbl = Table(tbl_data, colWidths=col_widths, repeatRows=1)
        ts = [
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, 0), 5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
            # Data
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),       # rank
            ('ALIGN', (2, 1), (-1, -1), 'CENTER'),       # gender onwards
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ]
        # Colour the grade/division column per student
        grade_col = len(header_row) - 1 if is_primary else len(header_row) - 2
        for i, r in enumerate(students, 1):
            g = r.get('grade') or '-'
            c = GRADE_COLORS.get(g, SLATE_GREY)
            ts.append(('TEXTCOLOR', (grade_col, i), (grade_col, i), c))
            ts.append(('FONTNAME', (grade_col, i), (grade_col, i), 'Helvetica-Bold'))
        standings_tbl.setStyle(TableStyle(ts))
        story.append(standings_tbl)
        story.append(Spacer(1, 4))

        # ── Subject key ──
        key_para_style = ParagraphStyle(
            'kp', fontName='Helvetica', fontSize=7,
            textColor=colors.HexColor('#1e293b'),
        )
        key_items = [
            Paragraph(f'<b>{sub_codes[s]}</b> = {s}', key_para_style)
            for s in subjects
        ]
        # Arrange in rows of 6
        COLS_KEY = 6
        key_rows = []
        chunk = []
        for item in key_items:
            chunk.append(item)
            if len(chunk) == COLS_KEY:
                key_rows.append(chunk)
                chunk = []
        if chunk:
            chunk += [''] * (COLS_KEY - len(chunk))
            key_rows.append(chunk)

        if key_rows:
            kt = Table(key_rows, colWidths=[W / COLS_KEY] * COLS_KEY)
            kt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(kt)
            story.append(Spacer(1, 6))

        # ── Section B: Division summary by gender (O/A-level) ──
        if not is_primary:
            div_order  = ['Division I', 'Division II', 'Division III', 'Division IV', 'Division 0']
            dg_tally   = {d: {'M': 0, 'F': 0, 'total': 0} for d in div_order}
            for st in students:
                d = st.get('division')
                g = st.get('gender', 'F')
                if d and d in dg_tally:
                    dg_tally[d]['M' if g == 'M' else 'F'] += 1
                    dg_tally[d]['total'] += 1
            active_divs = [d for d in div_order if dg_tally[d]['total'] > 0]
            if active_divs:
                story.append(_section_heading('B. DIVISION SUMMARY BY GENDER'))
                lbl_s = ParagraphStyle('dgl', fontName='Helvetica-Bold', fontSize=8, alignment=0)
                val_s = ParagraphStyle('dgv', fontName='Helvetica',      fontSize=8, alignment=1)
                dg_rows = [[
                    Paragraph('<font color="white"><b>Division</b></font>',  lbl_s),
                    Paragraph('<font color="white"><b>Boys (M)</b></font>',  val_s),
                    Paragraph('<font color="white"><b>Girls (F)</b></font>', val_s),
                    Paragraph('<font color="white"><b>Total</b></font>',     val_s),
                ]]
                tot_m = tot_f = tot_t = 0
                for d in active_divs:
                    row = dg_tally[d]
                    hx  = DIV_HEX.get(d, '#64748b')
                    tot_m += row['M'];  tot_f += row['F'];  tot_t += row['total']
                    dg_rows.append([
                        Paragraph(f'<font color="{hx}"><b>{d}</b></font>', lbl_s),
                        Paragraph(f'<font color="#1d4ed8">{row["M"]}</font>',  val_s),
                        Paragraph(f'<font color="#be185d">{row["F"]}</font>',  val_s),
                        Paragraph(f'<b>{row["total"]}</b>',                   val_s),
                    ])
                dg_rows.append([
                    Paragraph('<b>Total</b>', lbl_s),
                    Paragraph(f'<font color="#1d4ed8"><b>{tot_m}</b></font>', val_s),
                    Paragraph(f'<font color="#be185d"><b>{tot_f}</b></font>', val_s),
                    Paragraph(f'<b>{tot_t}</b>', val_s),
                ])
                col_w = 45 * mm
                dg_tbl = Table(dg_rows, colWidths=[col_w] * 4, hAlign='LEFT')
                dg_tbl.setStyle(TableStyle([
                    ('BACKGROUND',   (0, 0),  (-1, 0),  NAVY),
                    ('LINEBELOW',    (0, 0),  (-1, 0),  1,    GOLD),
                    ('FONTSIZE',     (0, 0),  (-1, -1), 8),
                    ('ALIGN',        (1, 0),  (-1, -1), 'CENTER'),
                    ('ALIGN',        (0, 0),  (0, -1),  'LEFT'),
                    ('TOPPADDING',   (0, 0),  (-1, -1), 4),
                    ('BOTTOMPADDING',(0, 0),  (-1, -1), 4),
                    ('LEFTPADDING',  (0, 0),  (-1, -1), 6),
                    ('GRID',         (0, 0),  (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                    ('ROWBACKGROUNDS',(0, 1), (-1, -2), [colors.white, ROW_ALT]),
                    ('BACKGROUND',   (0, -1), (-1, -1), LIGHT_BG),
                    ('LINEABOVE',    (0, -1), (-1, -1), 1,    BORDER_BLUE),
                ]))
                story.append(dg_tbl)
                story.append(Spacer(1, 6))

        # ── Section C: Subject analytics ──
        story.append(_section_heading('C. CLASS PERFORMANCE SUMMARY'))

        an_header = ['Subject', 'Sat'] + grade_labels + ['Pass%', 'Avg', 'High', 'Low', 'GPA']
        an_data   = [an_header]
        subj_cell_style = ParagraphStyle(
            'as', fontName='Helvetica', fontSize=7,
        )
        gpa_cell_style = ParagraphStyle(
            'gpas', fontName='Helvetica-Bold', fontSize=7, alignment=1,
        )
        for row in analytics:
            arow = [
                Paragraph(f'<b>{sub_codes[row["subj"]]}</b> {row["subj"]}', subj_cell_style),
                str(row['sat']),
            ]
            for g in row['grade_set']:
                arow.append(str(row['gc'].get(g, 0)))
            # GPA cell — coloured like the HTML
            if row['gpa'] is not None:
                hex_c = _gpa_color_hex(row['gpa'])
                gpa_cell = Paragraph(
                    f'<font color="{hex_c}">{row["gpa"]:.2f}</font>',
                    gpa_cell_style,
                )
            else:
                gpa_cell = '–'
            arow += [row['pass_rate'], row['avg'], row['high'], row['low'], gpa_cell]
            an_data.append(arow)

        # Analytics column widths
        an_grade_w = 10 * mm
        an_col_ws = [55 * mm, 10 * mm] + [an_grade_w] * len(grade_labels) + [13 * mm, 13 * mm, 13 * mm, 13 * mm, 13 * mm]

        at = Table(an_data, colWidths=an_col_ws, repeatRows=1)
        at_style = [
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, 0), 5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 1), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        # Colour grade header labels
        for gi, g in enumerate(grade_labels):
            col = 2 + gi
            at_style.append(('TEXTCOLOR', (col, 0), (col, 0), GRADE_COLORS.get(g, SLATE_GREY)))
        # Pass% and score columns
        pass_col = 2 + len(grade_labels)
        at_style += [
            ('TEXTCOLOR', (pass_col, 1), (pass_col, -1), G_GREEN),
            ('FONTNAME', (pass_col, 1), (pass_col, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (pass_col + 2, 1), (pass_col + 2, -1), G_GREEN),   # high
            ('TEXTCOLOR', (pass_col + 3, 1), (pass_col + 3, -1), G_RED),     # low
            # GPA column header — bold gold
            ('TEXTCOLOR', (pass_col + 4, 0), (pass_col + 4, 0), GOLD),
            ('BACKGROUND', (pass_col + 4, 1), (pass_col + 4, -1), colors.HexColor('#f0fdf4')),
        ]
        at.setStyle(TableStyle(at_style))
        story.append(at)

        # ── Centre GPA bar (O/A-level only) ──
        if not is_primary:
            gpa_map_c = _GPA_MAP_ADV if school_type == 'ADVANCED' else _GPA_MAP_ORD
            total_pts  = sum(gpa_map_c.get(g, 5) * cnt
                             for row in analytics
                             for g, cnt in row['gc'].items())
            total_paps = sum(row['sat'] for row in analytics)
            centre_gpa = round(total_pts / total_paps, 2) if total_paps else None
            if centre_gpa is not None:
                cg = centre_gpa
                centre_grade = ('A' if cg <= 1.50 else 'B' if cg <= 2.50
                                else 'C' if cg <= 3.50 else 'D' if cg <= 4.50 else 'F')
                cgpa_hex   = _gpa_color_hex(cg)
                cgrade_hex = GRADE_HEX.get(centre_grade, '#64748b')
                cgpa_para  = Paragraph(
                    f'<b>Centre GPA:</b>  '
                    f'<font color="{cgpa_hex}"><b>{cg:.2f}</b></font>  '
                    f'Grade: <font color="{cgrade_hex}"><b>{centre_grade}</b></font>  '
                    f'<font color="#94a3b8"><i>(lower is better · 1.00 = all A\'s · 5.00 = all F\'s)</i></font>',
                    ParagraphStyle('cgpa', fontName='Helvetica', fontSize=8,
                                   leftPadding=8, rightPadding=8,
                                   topPadding=5, bottomPadding=5),
                )
                cgpa_tbl = Table([[cgpa_para]], colWidths=[W])
                cgpa_tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
                    ('BOX', (0, 0), (-1, -1), 0.5, BORDER_BLUE),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                story.append(Spacer(1, 3))
                story.append(cgpa_tbl)

        # ── Division summary (O/A level) ──
        if not is_primary:
            div_counts = {}
            for st in students:
                d = st.get('division')
                if d:
                    div_counts[d] = div_counts.get(d, 0) + 1
            if div_counts:
                story.append(Spacer(1, 4))
                order = ['Division I', 'Division II', 'Division III', 'Division IV', 'Fail']
                div_cells = []
                for dn in order:
                    cnt = div_counts.get(dn, 0)
                    if cnt:
                        c = DIV_COLORS.get(dn, SLATE_GREY)
                        div_cells.append(
                            Paragraph(
                                f'<font color="{GRADE_HEX.get(dn[0], "#64748b")}"><b>{dn}:</b> {cnt}</font>',
                                ParagraphStyle('dc', fontName='Helvetica', fontSize=8),
                            )
                        )
                if div_cells:
                    # pad to full row
                    while len(div_cells) % 5:
                        div_cells.append('')
                    div_tbl = Table([div_cells], colWidths=[W / len(div_cells) if div_cells else W] * len(div_cells))
                    div_tbl.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
                        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_BLUE),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ]))
                    story.append(div_tbl)

        # ── Footer ──
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceBefore=6))
        story.append(_footer(W))
        story.append(Spacer(1, 3))
        story.append(_gradient_bar(W))

        doc.build(story)
        buf.seek(0)
        safe = lambda s: s.replace(' ', '_').replace('/', '-')
        filename = f"results_{safe(data['stream_label'])}_{safe(data['assessment_name'])}.pdf"
        resp = HttpResponse(buf.read(), content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="{filename}"'
        return resp


# ── Mark Sheet PDF ─────────────────────────────────────────────────────────────

class MarkSheetPDFView(APIView):
    """
    GET /api/v1/academy/marks/pdf/?subject=&stream=&assessment=
    Returns a portrait A4 subject performance report (teacher's mark sheet).
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def get(self, request):
        subject_id = request.query_params.get('subject')
        stream_id = request.query_params.get('stream')
        assessment_id = request.query_params.get('assessment')

        if not all([subject_id, stream_id, assessment_id]):
            return Response({'error': 'subject, stream, assessment required.'}, status=400)

        school = _school_of(request)

        # Subject
        try:
            subject = Subject.objects.get(pk=subject_id, school=school)
        except Subject.DoesNotExist:
            return Response({'error': 'Subject not found.'}, status=404)

        # Stream
        try:
            stream_obj = Stream.objects.select_related('class_level').get(pk=stream_id, school=school)
            stream_label = f"{stream_obj.class_level.name} {stream_obj.name}".strip()
        except Stream.DoesNotExist:
            return Response({'error': 'Stream not found.'}, status=404)

        # Assessment
        try:
            assessment_obj = Assessment.objects.get(pk=assessment_id, school=school)
            assessment_name = assessment_obj.name
            assessment_year = str(assessment_obj.academic_year)
        except Assessment.DoesNotExist:
            return Response({'error': 'Assessment not found.'}, status=404)

        # Excluded students
        excluded_ids = set(
            StudentSubjectExclusion.objects.filter(
                school=school, subject_id=subject_id
            ).values_list('student_id', flat=True)
        )

        students = list(
            Student.objects.filter(school=school, stream_id=stream_id)
            .exclude(id__in=excluded_ids)
            .order_by('gender', 'last_name', 'first_name')
        )

        marks_map = {
            m.student_id: m
            for m in Mark.objects.filter(
                school=school, subject_id=subject_id,
                assessment_id=assessment_id, student__in=students,
            )
        }

        grade_configs = list(
            GradeConfig.objects.filter(school=school).order_by('-min_score')
            .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
        )
        if not grade_configs:
            grade_configs = NECTA_DEFAULTS.get(school.school_type, NECTA_DEFAULTS['ORDINARY'])
        gpa_map = {c['grade_label']: c['points'] for c in grade_configs}

        rows = []
        for st in students:
            mark = marks_map.get(st.id)
            score = float(mark.score) if mark and mark.score is not None else None
            g = get_grade_from_configs(score, grade_configs) if score is not None else '-'
            rows.append({
                'name': st.display_name,
                'gender': st.gender,
                'score': score,
                'grade': g,
                'is_submitted': mark.is_submitted if mark else False,
            })

        # Stats
        scored = [r for r in rows if r['score'] is not None]
        grade_set = [c['grade_label'] for c in grade_configs] if grade_configs else ['A', 'B', 'C', 'D', 'F']
        dist = {g: 0 for g in grade_set}
        gender_stats = {
            'M': {'dist': {g: 0 for g in grade_set}, 'scores': []},
            'F': {'dist': {g: 0 for g in grade_set}, 'scores': []},
        }
        for r in scored:
            if r['grade'] in dist:
                dist[r['grade']] += 1
            gk = 'M' if r['gender'] == 'M' else 'F'
            if r['grade'] in gender_stats[gk]['dist']:
                gender_stats[gk]['dist'][r['grade']] += 1
            gender_stats[gk]['scores'].append(r['score'])

        n = len(scored)
        avg_score = round(sum(r['score'] for r in scored) / n, 1) if n else None
        total_gpa_pts = sum(gpa_map.get(r['grade'], 5) for r in scored)
        avg_gpa = round(total_gpa_pts / n, 2) if n else None
        fail_label = grade_configs[-1]['grade_label'] if grade_configs else 'F'
        passes = sum(dist.get(g, 0) for g in grade_set if g != fail_label)
        pass_rate = round((passes / n) * 100) if n else 0

        def _gender_avg(gk):
            sc = gender_stats[gk]['scores']
            return round(sum(sc) / len(sc), 1) if sc else None

        def _gender_pass(gk):
            d = gender_stats[gk]['dist']
            total = sum(d.values())
            p = sum(d.get(g, 0) for g in ['A', 'B', 'C', 'D'])
            return round((p / total) * 100) if total else 0

        # ── Build PDF ──
        buf = io.BytesIO()
        MARGIN = 12 * mm
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=MARGIN,
            title=f"{subject.name} — {stream_label} — {assessment_name}",
        )
        W = A4[0] - 2 * MARGIN
        story = []

        story.append(_gradient_bar(W))
        story.append(Spacer(1, 4))
        story.append(_school_header(school, 'Subject Performance Report', W))
        story.append(Spacer(1, 5))
        story.append(_meta_table([
            ('Subject', subject.name),
            ('Class / Stream', stream_label),
            ('Assessment', assessment_name),
            ('Academic Year', assessment_year),
            ('Teacher', request.user.get_full_name() or request.user.email),
            ('Total Students', str(len(rows))),
        ], W))
        story.append(Spacer(1, 6))

        # ── Marks table ──
        story.append(_section_heading('A. STUDENT MARKS'))
        marks_header = ['#', 'Student Name', 'Gender', 'Score /100', 'Grade', 'Status']
        marks_data = [marks_header]
        for i, r in enumerate(rows, 1):
            sc_str = f"{r['score']:.0f}" if r['score'] is not None else '–'
            status_str = '✓ Submitted' if r['is_submitted'] else 'Draft'
            marks_data.append([
                str(i),
                r['name'],
                'Male' if r['gender'] == 'M' else ('Female' if r['gender'] == 'F' else (r['gender'] or '')),
                sc_str,
                r['grade'],
                status_str,
            ])

        marks_col_ws = [8 * mm, 65 * mm, 20 * mm, 22 * mm, 18 * mm, 20 * mm]
        mt = Table(marks_data, colWidths=marks_col_ws, repeatRows=1)
        mt_style = [
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, 0), 5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('ALIGN', (2, 1), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ]
        # Grade column colour per row
        for i, r in enumerate(rows, 1):
            g = r['grade']
            c = GRADE_COLORS.get(g, SLATE_GREY)
            mt_style += [
                ('TEXTCOLOR', (4, i), (4, i), c),
                ('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'),
            ]
        # Green for submitted, grey for draft
        for i, r in enumerate(rows, 1):
            c = G_GREEN if r['is_submitted'] else SLATE_GREY
            mt_style.append(('TEXTCOLOR', (5, i), (5, i), c))
        mt.setStyle(TableStyle(mt_style))
        story.append(mt)
        story.append(Spacer(1, 7))

        # ── Analytics ──
        story.append(_section_heading('B. PERFORMANCE ANALYTICS'))

        # Summary stats — 2-row × 4-col table (no nested tables)
        _anlbl = ParagraphStyle('anlbl', fontName='Helvetica', fontSize=7,
                                textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=2)
        _col_w = W / 4
        stats_tbl = Table(
            [
                [Paragraph('Entries', _anlbl), Paragraph('Class Average', _anlbl),
                 Paragraph('Mean GPA', _anlbl), Paragraph('Pass Rate', _anlbl)],
                [
                    Paragraph(f'{n} / {len(rows)}',
                              ParagraphStyle('anv1', fontName='Helvetica-Bold', fontSize=13,
                                             textColor=BLUE_MID, alignment=TA_CENTER)),
                    Paragraph(f'{avg_score}/100' if avg_score is not None else '\u2013',
                              ParagraphStyle('anv2', fontName='Helvetica-Bold', fontSize=13,
                                             textColor=G_GREEN, alignment=TA_CENTER)),
                    Paragraph(str(avg_gpa) if avg_gpa is not None else '\u2013',
                              ParagraphStyle('anv3', fontName='Helvetica-Bold', fontSize=13,
                                             textColor=G_AMBER, alignment=TA_CENTER)),
                    Paragraph(f'{pass_rate}%',
                              ParagraphStyle('anv4', fontName='Helvetica-Bold', fontSize=13,
                                             textColor=G_TEAL, alignment=TA_CENTER)),
                ],
            ],
            colWidths=[_col_w] * 4,
        )
        stats_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_BLUE),
            ('GRID', (0, 0), (-1, -1), 0.25, BORDER_BLUE),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(stats_tbl)
        story.append(Spacer(1, 6))

        # Grade distribution — flat table with Overall / Boys / Girls rows
        _cat_w = 42 * mm
        _g_w = (W - _cat_w) / max(len(grade_set), 1)
        _gh = ParagraphStyle('gh', fontName='Helvetica-Bold', fontSize=7, alignment=TA_CENTER)
        _gc = ParagraphStyle('gc', fontName='Helvetica', fontSize=7, alignment=TA_CENTER)
        _gl = ParagraphStyle('gl', fontName='Helvetica-Bold', fontSize=7, textColor=NAVY)

        def _dist_rows(label, d, total):
            cnt_row = [Paragraph(label, _gl)]
            pct_row = [Paragraph(f'n={total}', ParagraphStyle('gn', fontName='Helvetica',
                                                               fontSize=7, textColor=SLATE_GREY))]
            for g in grade_set:
                cnt = d.get(g, 0)
                pct = round((cnt / total) * 100) if total else 0
                cnt_row.append(Paragraph(str(cnt),
                    ParagraphStyle(f'gc{g}', fontName='Helvetica-Bold', fontSize=8,
                                   textColor=GRADE_COLORS.get(g, SLATE_GREY), alignment=TA_CENTER)))
                pct_row.append(Paragraph(f'{pct}%', _gc))
            return cnt_row, pct_row

        ov_c, ov_p = _dist_rows('Overall', dist, n)
        m_c, m_p = _dist_rows(f'Boys ({len(gender_stats["M"]["scores"])})',
                               gender_stats['M']['dist'], len(gender_stats['M']['scores']))
        f_c, f_p = _dist_rows(f'Girls ({len(gender_stats["F"]["scores"])})',
                               gender_stats['F']['dist'], len(gender_stats['F']['scores']))

        dist_hdr = [
            Paragraph('Category', ParagraphStyle('dh', fontName='Helvetica-Bold', fontSize=7,
                                                  textColor=colors.white))
        ] + [
            Paragraph(f'<b>{g}</b>',
                      ParagraphStyle(f'dg{g}', fontName='Helvetica-Bold', fontSize=7,
                                     textColor=GRADE_COLORS.get(g, colors.white), alignment=TA_CENTER))
            for g in grade_set
        ]
        dist_data = [dist_hdr, ov_c, ov_p, m_c, m_p, f_c, f_p]
        dist_tbl = Table(dist_data, colWidths=[_cat_w] + [_g_w] * len(grade_set))
        dist_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (0, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
            ('LINEBELOW', (0, 2), (-1, 2), 1.5, BORDER_BLUE),
            ('LINEBELOW', (0, 4), (-1, 4), 0.5, BORDER_BLUE),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(dist_tbl)

        # Gender comparison (if both genders present)
        m_sc = gender_stats['M']['scores']
        f_sc = gender_stats['F']['scores']
        if m_sc and f_sc:
            story.append(Spacer(1, 6))
            m_avg = _gender_avg('M')
            f_avg = _gender_avg('F')
            m_pass = _gender_pass('M')
            f_pass = _gender_pass('F')
            gap = abs(m_avg - f_avg) if m_avg and f_avg else None
            gc_header = ['Metric', 'Boys', 'Girls', 'Gap']
            gc_data = [gc_header,
                       ['Count', str(len(m_sc)), str(len(f_sc)), '–'],
                       ['Avg Score', f'{m_avg}' if m_avg else '–', f'{f_avg}' if f_avg else '–',
                        f'{gap:.1f} pts' if gap else '–'],
                       ['Pass Rate', f'{m_pass}%', f'{f_pass}%', f'{abs(m_pass - f_pass)}%']]
            gc_tbl = Table(gc_data, colWidths=[W / 4] * 4)
            gc_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
                ('TEXTCOLOR', (1, 2), (1, -1), colors.HexColor('#1d4ed8')),
                ('TEXTCOLOR', (2, 2), (2, -1), colors.HexColor('#be185d')),
                ('FONTNAME', (1, 2), (-1, -1), 'Helvetica-Bold'),
            ]))
            story.append(_section_heading('C. GENDER PERFORMANCE COMPARISON'))
            story.append(gc_tbl)

        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceBefore=6))
        story.append(_footer(W))
        story.append(Spacer(1, 3))
        story.append(_gradient_bar(W))

        doc.build(story)
        buf.seek(0)
        safe = lambda s: s.replace(' ', '_').replace('/', '-')
        filename = f"marksheet_{safe(subject.name)}_{safe(stream_label)}_{safe(assessment_name)}.pdf"
        resp = HttpResponse(buf.read(), content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="{filename}"'
        return resp


def _stat_box(label, value, color_hex):
    """A small KPI box as a nested table."""
    inner = Table(
        [[
            Paragraph(label, ParagraphStyle('sl', fontName='Helvetica', fontSize=7,
                                             textColor=SLATE_GREY, alignment=TA_CENTER)),
            Paragraph(f'<font color="{color_hex}"><b>{value}</b></font>',
                      ParagraphStyle('sv', fontName='Helvetica-Bold', fontSize=14,
                                     alignment=TA_CENTER)),
        ]],
        colWidths=None,
    )
    inner = Table(
        [[Paragraph(label, ParagraphStyle('sl2', fontName='Helvetica', fontSize=7,
                                          textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=2)),
          Paragraph(f'<font size="14" color="{color_hex}"><b>{value}</b></font>',
                    ParagraphStyle('sv2', fontName='Helvetica-Bold', alignment=TA_CENTER))]],
        colWidths=None,
    )
    # Simpler: just return a Paragraph nested table
    cell = Table(
        [[Paragraph(label, ParagraphStyle('slb', fontName='Helvetica', fontSize=7,
                                          textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=1)),
          Paragraph(value, ParagraphStyle('svb', fontName='Helvetica-Bold', fontSize=14,
                                          textColor=colors.HexColor(color_hex), alignment=TA_CENTER))]],
    )
    return cell


def _grade_dist_table(title, dist_dict, total, width):
    """A distribution table showing A/B/C/D/F counts + bar. Returns a Table flowable."""
    GRADE_BAR_COLORS = {
        'A': G_GREEN, 'B': G_TEAL, 'C': G_AMBER, 'D': G_ORANGE, 'F': G_RED,
    }
    title_p = Paragraph(
        title,
        ParagraphStyle('dt', fontName='Helvetica-Bold', fontSize=8, textColor=NAVY,
                       alignment=TA_CENTER, spaceAfter=3),
    )
    rows = [[title_p]]
    for g in ['A', 'B', 'C', 'D', 'F']:
        cnt = dist_dict.get(g, 0)
        pct = round((cnt / total) * 100) if total else 0
        bar_w = max(width * 0.4 * pct / 100, 0)
        bar_row = Table(
            [[
                Paragraph(f'<b>{g}</b>', ParagraphStyle('gl', fontName='Helvetica-Bold',
                                                         fontSize=8, textColor=NAVY)),
                _bar_cell(bar_w, width * 0.5, GRADE_BAR_COLORS.get(g, SLATE_GREY)),
                Paragraph(f'{cnt}', ParagraphStyle('gc', fontName='Helvetica', fontSize=8,
                                                    textColor=colors.HexColor('#1e293b'),
                                                    alignment=TA_CENTER)),
                Paragraph(f'{pct}%', ParagraphStyle('gp', fontName='Helvetica', fontSize=7,
                                                     textColor=SLATE_GREY)),
            ]],
            colWidths=[8 * mm, width * 0.5, 8 * mm, 10 * mm],
        )
        bar_row.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        rows.append([bar_row])

    outer = Table(rows, colWidths=[width])
    outer.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return outer


def _bar_cell(fill_w, total_w, bar_color):
    """A simple bar chart cell implemented as a nested Table."""
    if fill_w <= 0:
        filled = Table([['']], colWidths=[total_w])
        filled.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        return filled
    rest_w = max(total_w - fill_w, 0)
    cells = [['']]
    widths = [fill_w]
    if rest_w > 0:
        cells[0].append('')
        widths.append(rest_w)
    tbl = Table(cells, colWidths=widths)
    style_cmds = [
        ('BACKGROUND', (0, 0), (0, 0), bar_color),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    if rest_w > 0:
        style_cmds.append(('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#e2e8f0')))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


# ── Report Cards PDF ───────────────────────────────────────────────────────────

class ReportCardsPDFView(APIView):
    """
    POST /api/v1/academy/report-cards/pdf/
    Body: {assessment, stream, student_id?}    -- student_id is optional; omit to generate all students.
    Returns a portrait A4 PDF with one report card per page.
    Requires an active school subscription.
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def post(self, request):
        assessment_id = request.data.get('assessment')
        stream_id = request.data.get('stream')
        single_student_id = request.data.get('student_id')

        if not assessment_id or not stream_id:
            return Response({'error': 'assessment and stream are required.'}, status=400)

        data = _fetch_results_data(request)
        # Fetch stored comments for this stream + assessment
        from academy.models import StudentComment as SC
        comments_map = {}
        for sc in SC.objects.filter(
            school=data['school'],
            assessment_id=assessment_id,
            student__stream_id=stream_id,
        ):
            comments_map.setdefault(sc.student_id, {})[sc.role] = sc.comment_text
        school = data['school']
        school_type = data['school_type']
        subjects = data['subjects']
        is_primary = school_type == 'PRIMARY'
        students = data['students']

        # Filter to single student if requested
        if single_student_id:
            students = [s for s in students if str(s['student_id']) == str(single_student_id)]

        buf = io.BytesIO()
        MARGIN = 10 * mm
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=MARGIN,
            title=f"Report Cards — {data['stream_label']} — {data['assessment_name']}",
        )
        W = A4[0] - 2 * MARGIN
        story = []

        for si, student in enumerate(students):
            if si > 0:
                story.append(PageBreak())

            story.append(_gradient_bar(W))
            story.append(Spacer(1, 2))
            story.append(_school_header(school, 'Academic Progress Report', W, compact=True))
            story.append(Spacer(1, 3))

            # Student info
            info_pairs = [
                ('Student Name', student['display_name']),
                ('Class / Stream', data['stream_label']),
                ('Assessment', data['assessment_name']),
                ('Academic Year', data['assessment_year']),
            ]
            if student.get('admission_number'):
                info_pairs.append(('Adm. No.', student['admission_number']))
            if student.get('rank'):
                info_pairs.append(('Class Position', f"{student['rank']} / {student['total_students']}"))
            story.append(_meta_table(info_pairs, W, cols=2))
            story.append(Spacer(1, 3))

            # Marks table
            story.append(_section_heading('ACADEMIC PERFORMANCE', compact=True))
            m_header = ['#', 'Subject', 'Marks', 'Out Of', 'Grade', 'Remarks']
            m_data = [m_header]
            row_idx = 0
            for subj in subjects:
                d = student['subjects'].get(subj, {})
                if d.get('excluded'):
                    continue
                row_idx += 1
                score = d.get('score')
                g = d.get('grade', '-') if score is not None else '-'
                score_str = f"{score:.0f}" if score is not None and score == int(score) else (f"{score}" if score is not None else '–')
                remark = GRADE_COMMENT.get(g, '–')
                m_data.append([str(row_idx), subj, score_str, '100', g, remark])

            # Total row
            total_score = student.get('total_score')
            total_possible = student.get('total_possible') or (row_idx * 100)
            avg = student.get('average')
            if is_primary:
                g_overall = student.get('grade', '–') or '–'
                total_extras = [f'{g_overall}', f'Avg: {avg}']
            else:
                total_extras = [f'Avg: {avg}', f"Pts: {student.get('points', '–')} | {student.get('division', '–')}"]

            m_data.append(['', 'TOTAL', str(total_score) if total_score is not None else '–',
                           str(total_possible), total_extras[0], total_extras[1]])

            m_col_ws = [8 * mm, 65 * mm, 18 * mm, 16 * mm, 18 * mm, W - (8 + 65 + 18 + 16 + 18) * mm]
            mt = Table(m_data, colWidths=m_col_ws, repeatRows=1)
            mt_style = [
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, 0), 5),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
                ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
                ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
                ('TOPPADDING', (0, 1), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
                ('ALIGN', (2, 1), (4, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ROW_ALT]),
                # Total row
                ('BACKGROUND', (0, -1), (-1, -1), NAVY),
                ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ]
            # Colour grade cells
            for di, subj in enumerate([s for s in subjects if not student['subjects'].get(s, {}).get('excluded')], 1):
                d = student['subjects'].get(subj, {})
                g = d.get('grade', '-') if d.get('score') is not None else '-'
                c = GRADE_COLORS.get(g, SLATE_GREY)
                mt_style += [
                    ('TEXTCOLOR', (4, di), (4, di), c),
                    ('FONTNAME', (4, di), (4, di), 'Helvetica-Bold'),
                ]
            mt.setStyle(TableStyle(mt_style))
            story.append(mt)
            story.append(Spacer(1, 4))

            # Ranking callout
            if student.get('rank'):
                avg_val = student.get('average', '–')
                avg_grade = student.get('grade') or '–'
                rank_text = (
                    f"Amekuwa nafasi ya <b>{student['rank']}</b> kati ya wanafunzi "
                    f"<b>{student['total_students']}</b>, akiwa na wastani wa alama "
                    f"<b>{avg_val}({avg_grade})</b>"
                )
                if is_primary:
                    rank_text += '.'
                else:
                    rank_text += f" — <b>{student.get('division', '–')}</b> ya <b>{student.get('points', '–')}</b>."

                rank_tbl = Table(
                    [[Paragraph(rank_text, ParagraphStyle('rt', fontName='Helvetica', fontSize=9,
                                                           textColor=colors.HexColor('#1e293b')))]],
                    colWidths=[W],
                )
                rank_tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffbeb')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#fde68a')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(rank_tbl)
                story.append(Spacer(1, 4))

            # Staff sections — full-width stacked rows: comment line then signature line
            staff_labels = [
                'Mwalimu wa Darasa',
                'Mwalimu wa Taaluma',
                'Mkuu wa Shule',
            ]
            lbl_style = ParagraphStyle('lbl', fontName='Helvetica-Bold', fontSize=8,
                                        textColor=SLATE_GREY, spaceAfter=4)
            sub_style = ParagraphStyle('sub', fontName='Helvetica', fontSize=7,
                                        textColor=colors.HexColor('#94a3b8'), spaceAfter=2)

            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'),
                                    spaceBefore=3, spaceAfter=3))

        

            student_comments = comments_map.get(student['student_id'], {})
            role_map = {
                'Mwalimu wa Darasa':  student_comments.get('class_teacher', ''),
                'Mwalimu wa Taaluma': student_comments.get('academic_master', ''),
                'Mkuu wa Shule':      student_comments.get('headmaster', ''),
            }

            # 1. Fetch the Class Master specifically for this stream
            from academy.models import ClassMasterAssignment
            class_master_assignment = ClassMasterAssignment.objects.filter(
                stream_id=stream_id, 
                academic_year=data['assessment_year'] # Use the year from your context
            ).first()

            # 2. Map the official labels to the actual users stored in the school
            sig_user_map = {
                'Mwalimu wa Darasa': class_master_assignment.teacher if class_master_assignment else None,
                'Mwalimu wa Taaluma': school.academic_master,
                'Mkuu wa Shule': school.headmaster,
            }

            comment_w = W * 0.64
            sig_w = W - comment_w
            for label in staff_labels:
                comment_text = role_map.get(label, '')
                sig_img = _signature_image(sig_user_map.get(label))
                staff_row = Table(
                    [
                        [Paragraph(label, lbl_style), ''],
                        [Paragraph('Maoni / Comment:', sub_style), Paragraph('Sahihi / Signature:', sub_style)],
                        [
                            Paragraph(comment_text, ParagraphStyle(
                                'cmt', fontName='Helvetica', fontSize=8,
                                textColor=colors.HexColor('#1e293b'),
                            )) if comment_text else '',
                            sig_img or '',
                        ],
                    ],
                    colWidths=[comment_w, sig_w],
                    rowHeights=[None, None, 22],
                )
                staff_row.setStyle(TableStyle([
                    ('SPAN',         (0, 0), (1, 0)),
                    ('BOX',          (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('BACKGROUND',   (0, 0), (-1, -1), colors.HexColor('#fafafa')),
                    ('TOPPADDING',   (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING',(0, 0), (-1, -1), 2),
                    ('LEFTPADDING',  (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('LINEBEFORE',   (1, 1), (1, 2), 0.5, colors.HexColor('#e2e8f0')),
                    # underline for comment
                    ('LINEBELOW',    (0, 2), (0, 2), 0.75, colors.HexColor('#cbd5e1')),
                    # solid underline for signature
                    ('LINEBELOW',    (1, 2), (1, 2), 1.5,  colors.HexColor('#334155')),
                ]))
                story.append(staff_row)
                story.append(Spacer(1, 3))

            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceBefore=2))
            story.append(_footer(W))
            story.append(Spacer(1, 3))
            story.append(_gradient_bar(W))

        doc.build(story)
        buf.seek(0)
        safe = lambda s: s.replace(' ', '_').replace('/', '-')
        if single_student_id and students:
            fn = f"report_card_{safe(students[0]['display_name'])}_{safe(data['assessment_name'])}.pdf"
        else:
            fn = f"report_cards_{safe(data['stream_label'])}_{safe(data['assessment_name'])}.pdf"
        resp = HttpResponse(buf.read(), content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="{fn}"'
        return resp


class CombinedResultsPDFView(APIView):
    """
    POST /api/v1/academy/results/combined/pdf/
    Body: {stream, assessments:[{assessment_id, weight}], treat_missing_as_zero}
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def post(self, request):
        stream_id, assessments, treat_missing_as_zero, _ = _combined_payload(request)
        if not stream_id:
            return Response({'error': 'stream is required.'}, status=400)

        try:
            combined = build_combined_results_data(
                school=_school_of(request),
                stream_id=stream_id,
                assessment_weights=assessments,
                treat_missing_as_zero=treat_missing_as_zero,
            )
            
        except CombinedResultsValidationError as exc:
            return Response({'error': str(exc)}, status=400)

        if combined.get('requires_confirmation'):
            return Response(combined, status=200)

        students = combined['students']
        school_type = combined['school_type']
        is_primary = school_type == 'PRIMARY'
        assessments_meta = combined['assessments']
        subjects = combined['subjects']
        sub_codes = combined.get('subject_codes') or _make_subject_codes(subjects)
        grade_labels = ['A', 'B', 'C', 'D', 'E', 'F'] if school_type == 'ADVANCED' else ['A', 'B', 'C', 'D', 'F']
        analytics = _build_combined_analytics(subjects, students, school_type)

        buf = io.BytesIO()
        page_size = landscape(A4)
        margin = 10 * mm
        doc = SimpleDocTemplate(
            buf,
            pagesize=page_size,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
            title='Combined Results',
        )
        width = page_size[0] - 2 * margin
        story = [
            _gradient_bar(width),
            Spacer(1, 4),
            _school_header(_school_of(request), 'Combined Results', width),
            Spacer(1, 5),
            _meta_table([
                ('Class', combined['stream_label']),
                ('Mode', 'Combined Assessments'),
                ('Assessments', ', '.join([f"{a['name']} ({a['weight']}%)" for a in assessments_meta])),
                ('Total Students', str(len(students))),
                ('Date Printed', date.today().strftime('%d %B %Y')),
            ], width),
            Spacer(1, 6),
            _section_heading('A. COMBINED STANDINGS'),
        ]

        # Match HTML combined table: subject-wise columns, then total/overall and grade or points/division.
        header = ['Pos', 'Student', 'G'] + [sub_codes.get(s, s) for s in subjects] + ['Total', 'Overall Avg']
        if is_primary:
            header += ['Grade']
        else:
            header += ['Pts', 'Division']

        table_data = [header]
        for st in students:
            row = [str(st.get('rank') or '–'), st.get('display_name', ''), st.get('gender') or '–']
            subj_map = st.get('subjects', {})
            for subj in subjects:
                d = subj_map.get(subj) or {}
                if d.get('excluded') or d.get('excluded_for_no_marks'):
                    row.append('–')
                    continue
                fs = d.get('final_score')
                row.append(f'{float(fs):.1f}' if fs is not None else '–')

            total_score = st.get('total_score')
            avg_score = st.get('average')
            row.append(f'{float(total_score):.1f}' if total_score is not None else '–')
            row.append(f'{float(avg_score):.1f}' if avg_score is not None else '–')

            if is_primary:
                row.append(st.get('grade') or '–')
            else:
                row.append(str(st.get('points')) if st.get('points') is not None else '–')
                row.append(st.get('division') or '–')
            table_data.append(row)

        fixed_mm = 8 + 45 + 8 + 13 + 14 + (12 if is_primary else 22)
        n_subject_cols = max(len(subjects), 1)
        subject_w = max((width - (fixed_mm * mm)) / n_subject_cols, 9 * mm)
        col_widths = [8 * mm, 45 * mm, 8 * mm] + [subject_w] * len(subjects) + [13 * mm, 14 * mm]
        if is_primary:
            col_widths += [12 * mm]
        else:
            col_widths += [10 * mm, 12 * mm]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(table)

        if subjects:
            subject_key = '  |  '.join([f"{sub_codes.get(s, s)} = {s}" for s in subjects])
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                f'<b>Subject Key:</b> {subject_key}',
                ParagraphStyle('csubkey', fontName='Helvetica', fontSize=7, textColor=SLATE_GREY),
            ))

        # ── Section B: Division summary by gender (O/A-level) ──
        if not is_primary:
            div_order = ['Division I', 'Division II', 'Division III', 'Division IV', 'Division 0']
            dg_tally = {d: {'M': 0, 'F': 0, 'total': 0} for d in div_order}
            for st in students:
                d = st.get('division')
                g = st.get('gender', 'F')
                if d and d in dg_tally:
                    dg_tally[d]['M' if g == 'M' else 'F'] += 1
                    dg_tally[d]['total'] += 1
            active_divs = [d for d in div_order if dg_tally[d]['total'] > 0]
            if active_divs:
                story.append(Spacer(1, 6))
                story.append(_section_heading('B. DIVISION SUMMARY BY GENDER'))
                lbl_s = ParagraphStyle('cdgl', fontName='Helvetica-Bold', fontSize=8, alignment=0)
                val_s = ParagraphStyle('cdgv', fontName='Helvetica', fontSize=8, alignment=1)
                dg_rows = [[
                    Paragraph('<font color="white"><b>Division</b></font>', lbl_s),
                    Paragraph('<font color="white"><b>Boys (M)</b></font>', val_s),
                    Paragraph('<font color="white"><b>Girls (F)</b></font>', val_s),
                    Paragraph('<font color="white"><b>Total</b></font>', val_s),
                ]]
                tot_m = tot_f = tot_t = 0
                for d in active_divs:
                    row = dg_tally[d]
                    hx = DIV_HEX.get(d, '#64748b')
                    tot_m += row['M']; tot_f += row['F']; tot_t += row['total']
                    dg_rows.append([
                        Paragraph(f'<font color="{hx}"><b>{d}</b></font>', lbl_s),
                        Paragraph(f'<font color="#1d4ed8">{row["M"]}</font>', val_s),
                        Paragraph(f'<font color="#be185d">{row["F"]}</font>', val_s),
                        Paragraph(f'<b>{row["total"]}</b>', val_s),
                    ])
                dg_rows.append([
                    Paragraph('<b>Total</b>', lbl_s),
                    Paragraph(f'<font color="#1d4ed8"><b>{tot_m}</b></font>', val_s),
                    Paragraph(f'<font color="#be185d"><b>{tot_f}</b></font>', val_s),
                    Paragraph(f'<b>{tot_t}</b>', val_s),
                ])
                col_w = 45 * mm
                dg_tbl = Table(dg_rows, colWidths=[col_w] * 4, hAlign='LEFT')
                dg_tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                    ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                    ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ROW_ALT]),
                    ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
                    ('LINEABOVE', (0, -1), (-1, -1), 1, BORDER_BLUE),
                ]))
                story.append(dg_tbl)

        # ── Section C: Class performance summary ──
        story.append(Spacer(1, 6))
        story.append(_section_heading('C. CLASS PERFORMANCE SUMMARY'))
        an_header = ['Subject', 'Sat'] + grade_labels + ['Pass%', 'Avg', 'High', 'Low', 'GPA']
        an_data = [an_header]
        subj_cell_style = ParagraphStyle('cas', fontName='Helvetica', fontSize=7)
        gpa_cell_style = ParagraphStyle('cgpas', fontName='Helvetica-Bold', fontSize=7, alignment=1)
        for row in analytics:
            arow = [
                Paragraph(f'<b>{sub_codes.get(row["subj"], row["subj"])}</b> {row["subj"]}', subj_cell_style),
                str(row['sat']),
            ]
            for g in row['grade_set']:
                arow.append(str(row['gc'].get(g, 0)))
            if row['gpa'] is not None:
                hex_c = _gpa_color_hex(row['gpa'])
                gpa_cell = Paragraph(f'<font color="{hex_c}">{row["gpa"]:.2f}</font>', gpa_cell_style)
            else:
                gpa_cell = '–'
            arow += [row['pass_rate'], row['avg'], row['high'], row['low'], gpa_cell]
            an_data.append(arow)

        an_grade_w = 10 * mm
        an_col_ws = [55 * mm, 10 * mm] + [an_grade_w] * len(grade_labels) + [13 * mm, 13 * mm, 13 * mm, 13 * mm, 13 * mm]
        at = Table(an_data, colWidths=an_col_ws, repeatRows=1)
        at_style = [
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, 0), 5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 1), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        for gi, g in enumerate(grade_labels):
            col = 2 + gi
            at_style.append(('TEXTCOLOR', (col, 0), (col, 0), GRADE_COLORS.get(g, SLATE_GREY)))
        pass_col = 2 + len(grade_labels)
        at_style += [
            ('TEXTCOLOR', (pass_col, 1), (pass_col, -1), G_GREEN),
            ('FONTNAME', (pass_col, 1), (pass_col, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (pass_col + 2, 1), (pass_col + 2, -1), G_GREEN),
            ('TEXTCOLOR', (pass_col + 3, 1), (pass_col + 3, -1), G_RED),
            ('TEXTCOLOR', (pass_col + 4, 0), (pass_col + 4, 0), GOLD),
            ('BACKGROUND', (pass_col + 4, 1), (pass_col + 4, -1), colors.HexColor('#f0fdf4')),
        ]
        at.setStyle(TableStyle(at_style))
        story.append(at)

        # ── Centre GPA bar (O/A-level only) ──
        if not is_primary and analytics:
            gpa_map_c = _GPA_MAP_ADV if school_type == 'ADVANCED' else _GPA_MAP_ORD
            total_points = 0
            total_papers = 0
            for row in analytics:
                sat = row.get('sat', 0)
                if not sat:
                    continue
                total_papers += sat
                for g, cnt in row['gc'].items():
                    total_points += gpa_map_c.get(g, 5) * cnt
            if total_papers > 0:
                class_gpa = round(total_points / total_papers, 2)
                if class_gpa <= 1.5:
                    class_grade = 'A'
                elif class_gpa <= 2.5:
                    class_grade = 'B'
                elif class_gpa <= 3.5:
                    class_grade = 'C'
                elif class_gpa <= 4.5:
                    class_grade = 'D'
                else:
                    class_grade = 'F'
                ctbl = Table([[f'Centre GPA: {class_gpa:.2f}', f'Grade {class_grade}']], colWidths=[width * 0.7, width * 0.3])
                ctbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('TEXTCOLOR', (0, 0), (0, 0), colors.HexColor(_gpa_color_hex(class_gpa))),
                    ('TEXTCOLOR', (1, 0), (1, 0), GRADE_COLORS.get(class_grade, SLATE_GREY)),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]))
                story.append(Spacer(1, 5))
                story.append(ctbl)

        story.append(Spacer(1, 6))
        story.append(_footer(width))

        doc.build(story)
        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="combined_results.pdf"'
        return response


class CombinedReportCardsPDFView(APIView):
    """
    POST /api/v1/academy/report-cards/combined/pdf/
    Body: {stream, assessments:[{assessment_id, weight}], treat_missing_as_zero, student_id?}
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def post(self, request):

        stream_id = None
        data = {'assessment_year': None, 'assessment_name': 'Report Card'}
        # Snapshot mode — load from stored combined results, no weights re-entry needed
        snapshot_id = request.data.get('snapshot_id')
        if snapshot_id:
            from academy.models import CombinedResultsSnapshot
            school = _school_of(request)
            try:
                snap = CombinedResultsSnapshot.objects.get(pk=snapshot_id, school=school)
                stream_id = snap.stream_id
            except CombinedResultsSnapshot.DoesNotExist:
                return Response({'error': 'Snapshot not found.'}, status=404)
            try:
                stream_obj  = Stream.objects.select_related('class_level').get(pk=snap.stream_id)
                stream_label = f"{stream_obj.class_level.name} {stream_obj.name}".strip()
            except Stream.DoesNotExist:
                stream_label = ''
            single_student_id  = request.data.get('student_id')
            treat_missing_as_zero = snap.treat_missing_as_zero
            qs = snap.student_results.select_related('student').order_by('rank')
            if single_student_id:
                qs = qs.filter(student_id=single_student_id)

            from academy.models import StudentComment as SC
            snap_comments_map = {}
            for sc_obj in SC.objects.filter(school=school, snapshot_id=snapshot_id):
                snap_comments_map.setdefault(sc_obj.student_id, {})[sc_obj.role] = sc_obj.comment_text

            combined = {
                'stream_label': stream_label,
                'school_type':  snap.school_type,
                'subjects':     snap.subjects,
                'assessments':  snap.components,
                'students': [{
                    'student_id':       sr.student_id,
                    'display_name':     sr.student.display_name,
                    'admission_number': sr.student.admission_number,
                    'gender':           sr.student.gender,
                    'rank':             sr.rank,
                    'total_students':   sr.total_students,
                    'total_score':      float(sr.total_score) if sr.total_score is not None else None,
                    'average':          float(sr.average) if sr.average is not None else None,
                    'grade':            sr.grade,
                    'grade_remarks':    sr.grade_remarks,
                    'points':           sr.points,
                    'division':         sr.division,
                    # Convert JSON string keys back to int for PDF lookup compatibility
                    'subjects': {
                        subj: {
                            **sdata,
                            'assessment_scores': {
                                int(k) if str(k).isdigit() else k: v
                                for k, v in (sdata.get('assessment_scores') or {}).items()
                            }
                        } for subj, sdata in sr.subject_data.items()
                    },
                    'assessment_averages': {
                        int(k) if str(k).isdigit() else k: v
                        for k, v in sr.assessment_averages.items()
                    },
                } for sr in list(qs)],
            }
            data = {'assessment_year': snap.academic_year, 'assessment_name': 'Snapshot'}
        else:
            stream_id, assessments, treat_missing_as_zero, single_student_id = _combined_payload(request)
            if not stream_id:
                return Response({'error': 'stream is required.'}, status=400)
            try:
                combined = build_combined_results_data(
                    school=_school_of(request),
                    stream_id=stream_id,
                    assessment_weights=assessments,
                    treat_missing_as_zero=treat_missing_as_zero,
                )
                from django.utils import timezone
                data = {'assessment_year': request.data.get('year') or timezone.now().year, 'assessment_name': 'Combined'}
            except CombinedResultsValidationError as exc:
                return Response({'error': str(exc)}, status=400)
            if combined.get('requires_confirmation'):
                return Response(combined, status=200)


        assessments_meta = combined['assessments']
        students = combined['students']
        if single_student_id:
            students = [s for s in students if str(s['student_id']) == str(single_student_id)]

        school = _school_of(request)
        school_type = combined['school_type']
        is_primary = school_type == 'PRIMARY'

        buf = io.BytesIO()
        margin = 10 * mm
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
            title='Combined Report Cards',
        )
        width = A4[0] - 2 * margin
        story = []

        from django.utils import timezone
        target_year = data.get('assessment_year') or timezone.now().year

        

        # 1. Fetch the Class Master specifically for this stream
        from academy.models import ClassMasterAssignment

        # DEBUG
        print(f"DEBUG: Looking for assignment with Stream ID: {stream_id} and Year: {target_year}")
        
        # Check if ANY record exists for this stream at all
        exists_check = ClassMasterAssignment.objects.filter(stream_id=stream_id).exists()
        print(f"DEBUG: Does any record exist for this stream? {exists_check}")

        class_master_assignment = ClassMasterAssignment.objects.filter(
            stream_id=stream_id, 
            academic_year=target_year # Use the year from your context
        ).first()
        
        

        # 2. Map the official labels to the actual users stored in the school
        sig_user_map = {
            'Mwalimu wa Darasa': class_master_assignment.teacher if class_master_assignment else None,
            'Mwalimu wa Taaluma': school.academic_master,
            'Mkuu wa Shule': school.headmaster,
            
        }

        # DEBUGGING: Print to your console to see what is happening
        print(f"DEBUG: Target Year: {target_year}")
        print(f"DEBUG: Assignment Found: {bool(class_master_assignment)}")
        if class_master_assignment:
            print(f"DEBUG: Teacher assigned: {class_master_assignment.teacher}")
            print(f"DEBUG: Signature exists: {bool(class_master_assignment.teacher.signature if class_master_assignment.teacher else False)}")

        for i, student in enumerate(students):
            if i > 0:
                story.append(PageBreak())

            story.append(_gradient_bar(width))
            story.append(Spacer(1, 2))
            story.append(_school_header(school, 'Academic Progress Report', width, compact=True))
            story.append(Spacer(1, 3))

            info = [
                ('Student Name', student['display_name']),
                ('Class / Stream', combined['stream_label']),
                ('Assessment Mode', 'Combined'),
                ('Assessments', ', '.join([f"{a['name']} ({a['weight']}%)" for a in assessments_meta])),
            ]
            if student.get('admission_number'):
                info.append(('Adm. No.', student['admission_number']))
            if student.get('rank'):
                info.append(('Class Position', f"{student['rank']} / {student['total_students']}"))
            story.append(_meta_table(info, width, cols=2))
            story.append(Spacer(1, 3))

            story.append(_section_heading('ACADEMIC PERFORMANCE', compact=True))
            header = ['#', 'Subject'] + [f"{a['name']} ({a['weight']}%)" for a in assessments_meta] + ['Final', 'Grade', 'Remarks']
            rows = [header]

            printable_subjects = []
            for subject_name in combined['subjects']:
                detail = student['subjects'].get(subject_name, {})
                if detail.get('excluded'):
                    continue
                printable_subjects.append((subject_name, detail))

            for row_idx, (subject_name, detail) in enumerate(printable_subjects, 1):
                row = [str(row_idx), subject_name]
                for a in assessments_meta:
                    score = detail.get('assessment_scores', {}).get(a['id'])
                    row.append('0' if score is None and treat_missing_as_zero else (f'{score:.0f}' if isinstance(score, float) and score.is_integer() else (str(score) if score is not None else '–')))
                final_score = detail.get('final_score')
                grade = detail.get('grade') or '-'
                remarks = detail.get('remarks') or '-'
                row.extend([
                    f'{final_score:.2f}' if final_score is not None else '–',
                    grade,
                    remarks,
                ])
                rows.append(row)

            summary_grade = student.get('grade') or '–'
            summary_div = student.get('division') or summary_grade
            rows.append([
                '',
                'AVERAGE',
                *[
                    (f"{student.get('assessment_averages', {}).get(a['id'], {}).get('raw_average'):.2f}"
                     if student.get('assessment_averages', {}).get(a['id'], {}).get('raw_average') is not None else '–')
                    for a in assessments_meta
                ],
                f"{student.get('average'):.2f}" if student.get('average') is not None else '–',
                summary_grade,
                (student.get('grade_remarks') or '–') if is_primary else f"Pts: {student.get('points') or '–'} | Div: {summary_div}",
            ])

            fixed = (8 + 48 + 16 + 14 + 34) * mm
            n_assess = max(len(assessments_meta), 1)
            assess_w = max((width - fixed) / n_assess, 18 * mm)
            col_widths = [8 * mm, 48 * mm] + [assess_w] * len(assessments_meta) + [16 * mm, 14 * mm, width - (8 + 48) * mm - (assess_w * len(assessments_meta)) - 16 * mm - 14 * mm]

            table = Table(rows, colWidths=col_widths, repeatRows=1)
            style = [
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ALIGN', (2, 1), (-2, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'CENTER'),
                ('ALIGN', (1, 1), (1, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ROW_ALT]),
                ('BACKGROUND', (0, -1), (-1, -1), NAVY),
                ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]
            for row_idx, (_, detail) in enumerate(printable_subjects, 1):
                grade = detail.get('grade') or '-'
                style.append(('TEXTCOLOR', (-2, row_idx), (-2, row_idx), GRADE_COLORS.get(grade, SLATE_GREY)))
                style.append(('FONTNAME', (-2, row_idx), (-2, row_idx), 'Helvetica-Bold'))
            table.setStyle(TableStyle(style))
            story.append(table)
            story.append(Spacer(1, 5))

            if student.get('rank'):
                summary_text = (
                    f"Amekuwa nafasi ya <b>{student['rank']}</b> kati ya wanafunzi <b>{student['total_students']}</b>, "
                    f"akiwa na wastani wa alama <b>{student.get('average', '–')}</b>."
                )
                if not is_primary:
                    summary_text += f" Division: <b>{student.get('division') or '–'}</b>."
                summary_box = Table(
                    [[Paragraph(summary_text, ParagraphStyle('crt', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#1e293b')))]],
                    colWidths=[width],
                )
                summary_box.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffbeb')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#fde68a')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(summary_box)

            # Staff sections — aligned with single-assessment report card design
            staff_labels = [
                'Mwalimu wa Darasa',
                'Mwalimu wa Taaluma',
                'Mkuu wa Shule',
            ]
            lbl_style = ParagraphStyle('clbl', fontName='Helvetica-Bold', fontSize=8,
                                       textColor=SLATE_GREY, spaceAfter=4)
            sub_style = ParagraphStyle('csub', fontName='Helvetica', fontSize=7,
                                       textColor=colors.HexColor('#94a3b8'), spaceAfter=2)

            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'),
                                    spaceBefore=3, spaceAfter=3))
                                    

            comment_w = width * 0.64
            sig_w = width - comment_w
            # Build comment map for this student (snapshot or empty)
            _student_comments = snap_comments_map.get(student['student_id'], {}) if snapshot_id else {}
            _role_map = {
                'Mwalimu wa Darasa':  _student_comments.get('class_teacher', ''),
                'Mwalimu wa Taaluma': _student_comments.get('academic_master', ''),
                'Mkuu wa Shule':      _student_comments.get('headmaster', ''),
            }

            for label in staff_labels:
                sig_img      = _signature_image(sig_user_map.get(label))
                comment_text = _role_map.get(label, '')
                staff_row = Table(
                    [
                        [Paragraph(label, lbl_style), ''],
                        [Paragraph('Maoni / Comment:', sub_style), Paragraph('Sahihi / Signature:', sub_style)],
                        [
                            Paragraph(comment_text, ParagraphStyle(
                                'ccmt', fontName='Helvetica', fontSize=8,
                                textColor=colors.HexColor('#1e293b'),
                            )) if comment_text else '',
                            sig_img or '',
                        ],
                    ],
                    colWidths=[comment_w, sig_w],
                    rowHeights=[None, None, 22],
                )
                staff_row.setStyle(TableStyle([
                    ('SPAN', (0, 0), (1, 0)),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('LINEBEFORE', (1, 1), (1, 2), 0.5, colors.HexColor('#e2e8f0')),
                    ('LINEBELOW', (0, 2), (0, 2), 0.75, colors.HexColor('#cbd5e1')),
                    ('LINEBELOW', (1, 2), (1, 2), 1.5, colors.HexColor('#334155')),
                ]))
                story.append(staff_row)
                story.append(Spacer(1, 3))

            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceBefore=2))

            story.append(Spacer(1, 3))
            story.append(_footer(width))
            story.append(Spacer(1, 2))
            story.append(_gradient_bar(width))

        doc.build(story)
        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="combined_report_cards.pdf"'
        return response

# ── Term Circular PDF ──────────────────────────────────────────────────────────

class CircularPDFView(APIView):
    """
    POST /api/v1/academy/circulars/<pk>/pdf/
    Body: { stream, student_id? }
    Generates a printable end-of-term circular per student.
    """
    permission_classes = [IsAuthenticated, IsSchoolPaidOrDownloadOnly]

    def post(self, request, pk):
        from academy.models import StudentFeeRecord, TermCircular
        from core.models import CustomUser as CU

        school = _school_of(request)

        try:
            circ = TermCircular.objects.get(pk=pk, school=school)
        except TermCircular.DoesNotExist:
            return Response({'error': 'Circular not found.'}, status=404)

        stream_id         = request.data.get('stream') or circ.stream_id
        single_student_id = request.data.get('student_id')

        if not stream_id:
            return Response({'error': 'stream is required.'}, status=400)

        students = list(
            Student.objects.filter(school=school, stream_id=stream_id)
            .order_by('last_name', 'first_name')
        )
        if single_student_id:
            students = [s for s in students if str(s.id) == str(single_student_id)]

        try:
            stream_obj  = Stream.objects.select_related('class_level').get(pk=stream_id)
            stream_label = f"{stream_obj.class_level.name} {stream_obj.name}".strip()
        except Stream.DoesNotExist:
            stream_label = ''

        # Fee records — current year + historical debts
        fee_map = {}
        if circ.show_fee_statement:
            for rec in StudentFeeRecord.objects.filter(
                school=school,
                  student__stream_id=stream_id,
                  definition__isnull=False,
            ).select_related('definition', 'phase'):
                is_current = str(rec.definition.academic_year) == str(circ.academic_year)
                bucket     = 'current' if is_current else 'historical'
                sid        = rec.student_id
                if sid not in fee_map:
                    fee_map[sid] = {'current': [], 'historical': []}
                fee_map[sid][bucket].append({
                    'name':     f"{rec.definition.name} — {rec.phase.name}",
                    'year':     rec.definition.academic_year,
                    'expected': float(rec.amount_expected),
                    'paid':     float(rec.amount_paid),
                    'balance':  float(rec.balance),
                })

        # Head of school user + signature
        hos_user = CU.objects.filter(school=school, role='ADMIN').first()
        hos_name = hos_user.get_full_name() if hos_user else 'Mkuu wa Shule'
        hos_sig  = _signature_image(hos_user) if hos_user else None

        buf    = io.BytesIO()
        MARGIN = 15 * mm
        doc    = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=MARGIN,
            title=f"{circ.title}",
        )
        W     = A4[0] - 2 * MARGIN
        story = []

        italic_style = ParagraphStyle(
            'motto', fontName='Helvetica-Oblique', fontSize=9,
            textColor=SLATE_GREY, alignment=TA_CENTER, spaceAfter=4,
        )
        item_heading_style = ParagraphStyle(
            'ih', fontName='Helvetica-Bold', fontSize=10,
            textColor=NAVY, spaceBefore=8, spaceAfter=3,
        )
        item_body_style = ParagraphStyle(
            'ib', fontName='Helvetica', fontSize=9,
            textColor=colors.HexColor('#1e293b'), leading=14, spaceAfter=4,
        )
        date_label_style = ParagraphStyle(
            'dl', fontName='Helvetica-Bold', fontSize=9,
            textColor=SLATE_GREY,
        )
        date_value_style = ParagraphStyle(
            'dv', fontName='Helvetica-Bold', fontSize=11,
            textColor=NAVY,
        )
        sig_label_style = ParagraphStyle(
            'sl', fontName='Helvetica', fontSize=8,
            textColor=SLATE_GREY, spaceAfter=2,
        )
        hos_name_style = ParagraphStyle(
            'hn', fontName='Helvetica-Bold', fontSize=9,
            textColor=colors.HexColor('#1e293b'),
        )
        small_style = ParagraphStyle(
            'sm', fontName='Helvetica', fontSize=8,
            textColor=SLATE_GREY,
        )

        def _fmt_date(d):
            if not d: return '—'
            months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
            return f"{d.day} {months[d.month - 1]} {d.year}"

        for si, student in enumerate(students):
            if si > 0:
                story.append(PageBreak())

            # ── Top bar ──
            story.append(_gradient_bar(W))
            story.append(Spacer(1, 3))

            # ── School header ──
            story.append(_school_header(school, circ.title, W, compact=True))
            story.append(Spacer(1, 4))

            # ── School motto ──
            if circ.school_motto:
                story.append(Paragraph(f'"{circ.school_motto}"', italic_style))
                story.append(HRFlowable(width='60%', thickness=0.5,
                                        color=colors.HexColor('#dbeafe'),
                                        spaceBefore=2, spaceAfter=6, hAlign='CENTER'))

            # ── Student info box ──
            story.append(_meta_table([
                ('Jina',         student.display_name),
                ('Darasa',       stream_label),
                ('Nambari',      student.admission_number or '—'),
                ('Mwaka',        str(circ.academic_year)),
            ], W, cols=2))
            story.append(Spacer(1, 8))

            # ── Term dates ──
            if circ.closing_date or circ.opening_date:
                dates_data = [[
                    [Paragraph('TAREHE YA KUFUNGA', date_label_style),
                     Paragraph(_fmt_date(circ.closing_date), date_value_style)],
                    [Paragraph('TAREHE YA KUFUNGUA', date_label_style),
                     Paragraph(_fmt_date(circ.opening_date), date_value_style)],
                ]]
                dates_tbl = Table(dates_data, colWidths=[W / 2, W / 2])
                dates_tbl.setStyle(TableStyle([
                    ('BACKGROUND',    (0, 0), (-1, -1), LIGHT_BG),
                    ('BOX',           (0, 0), (-1, -1), 1.5, NAVY),
                    ('LINEBETWEEN',   (0, 0), (0, -1),  0.5, BORDER_BLUE),
                    ('TOPPADDING',    (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('LEFTPADDING',   (0, 0), (-1, -1), 12),
                    ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                story.append(dates_tbl)
                story.append(Spacer(1, 12))

            # ── Dynamic content items ──
            for item in (circ.items or []):
                heading = (item.get('heading') or '').strip()
                content = (item.get('content') or '').strip()
                if heading:
                    story.append(Paragraph(heading.upper(), item_heading_style))
                    story.append(HRFlowable(width='100%', thickness=0.5,
                                            color=BORDER_BLUE, spaceAfter=4))
                if content:
                    for line in content.split('\n'):
                        if line.strip():
                            story.append(Paragraph(f'{line.strip()}' if not line.startswith('•') else line, item_body_style))

            story.append(Spacer(1, 6))

            # ── Fee statement ──
            if circ.show_fee_statement:
                student_fees = fee_map.get(student.id, [])
                story.append(Paragraph('HALI YA ADA / FEE STATEMENT', item_heading_style))
                story.append(HRFlowable(width='100%', thickness=0.5,
                                        color=BORDER_BLUE, spaceAfter=4))
                student_fee_data = fee_map.get(student.id, {'current': [], 'historical': []})
                current_fees     = student_fee_data.get('current', [])
                historical_fees  = [f for f in student_fee_data.get('historical', []) if f['balance'] > 0]
                all_fees         = current_fees + historical_fees

                if all_fees:
                    fee_header = ['Kipengele / Item', 'Inayotarajiwa', 'Imelipwa', 'Salio']
                    fee_data   = [fee_header]
                    total_exp = total_paid = total_bal = 0
                    
                    for f in current_fees:
                        fee_data.append([
                            f['name'],
                            f"TZS {f['expected']:,.0f}",
                            f"TZS {f['paid']:,.0f}",
                            f"TZS {f['balance']:,.0f}",
                        ])
                        total_exp += f['expected']; total_paid += f['paid']; total_bal += f['balance']
                        
                    if historical_fees:
                        fee_data.append(['── MADENI YA AWALI ──', '', '', ''])
                        for f in historical_fees:
                            fee_data.append([
                                f"{f['name']} ({f['year']})",
                                f"TZS {f['expected']:,.0f}",
                                f"TZS {f['paid']:,.0f}",
                                f"TZS {f['balance']:,.0f}",
                            ])
                            total_exp += f['expected']; total_paid += f['paid']; total_bal += f['balance']
                            
                    # We only calculate and append JUMLA once here.
                    # The duplicate loop over `all_fees` has been completely removed.
                    fee_data.append(['JUMLA', f"TZS {total_exp:,.0f}",
                                     f"TZS {total_paid:,.0f}", f"TZS {total_bal:,.0f}"])

                    col_ws = [W * 0.40, W * 0.20, W * 0.20, W * 0.20]
                    fee_tbl = Table(fee_data, colWidths=col_ws)
                    fee_style = [
                        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                        ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
                        ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE',   (0, 0), (-1, -1), 8),
                        ('ALIGN',      (1, 0), (-1, -1), 'RIGHT'),
                        ('ALIGN',      (0, 0), (0, -1),  'LEFT'),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                        ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
                        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e2e8f0')),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ROW_ALT]),
                        ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
                        ('FONTNAME',   (0, -1), (-1, -1), 'Helvetica-Bold'),
                        ('LINEABOVE',  (0, -1), (-1, -1), 1, NAVY),
                    ]
                    if total_bal > 0:
                        fee_style.append(('TEXTCOLOR', (3, -1), (3, -1), G_RED))
                    else:
                        fee_style.append(('TEXTCOLOR', (3, -1), (3, -1), G_GREEN))
                    fee_tbl.setStyle(TableStyle(fee_style))
                    story.append(fee_tbl)
                else:
                    story.append(Paragraph('Hakuna rekodi za ada.', small_style))
                story.append(Spacer(1, 8))

            

            # ── Signature block ──
            story.append(HRFlowable(width='100%', thickness=0.5,
                                    color=colors.HexColor('#e2e8f0'), spaceBefore=4, spaceAfter=6))

            sig_col_w = 60 * mm
            sig_content = [
                Paragraph('Sahihi / Signature:', sig_label_style),
                hos_sig if hos_sig else Spacer(1, 22 * mm),
                HRFlowable(width=sig_col_w, thickness=1.5,
                           color=colors.HexColor('#334155'), spaceAfter=3),
                Paragraph(hos_name, hos_name_style),
                Paragraph('Mkuu wa Shule / Head of School', sig_label_style),
            ]
            sig_tbl = Table([[sig_content, '']], colWidths=[sig_col_w, W - sig_col_w])
            sig_tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(sig_tbl)

            # ── Footer ──
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width='100%', thickness=0.5,
                                    color=colors.HexColor('#e2e8f0'), spaceBefore=4))
            story.append(_footer(W))
            story.append(Spacer(1, 3))
            story.append(_gradient_bar(W))

        doc.build(story)
        buf.seek(0)
        safe    = lambda s: s.replace(' ', '_').replace('/', '-')
        fn      = f"circular_{safe(circ.title)}_{safe(stream_label)}.pdf"
        resp    = HttpResponse(buf.read(), content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="{fn}"'
        return resp