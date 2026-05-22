"""NECTA Tanzania grading utilities — school-type aware."""

# ── NECTA preset grade boundaries per school level ────────────────────────────
# Admins may override these via GradeConfig, but the labels/points follow NECTA.

NECTA_DEFAULTS = {
    # O-Level (CSEE): A≥75, B≥65, C≥50, D≥30, F<30
    'ORDINARY': [
        {'grade_label': 'A', 'min_score': 75, 'max_score': 100, 'points': 1, 'remarks': 'Excellent'},
        {'grade_label': 'B', 'min_score': 65, 'max_score': 74,  'points': 2, 'remarks': 'Very Good'},
        {'grade_label': 'C', 'min_score': 50, 'max_score': 64,  'points': 3, 'remarks': 'Good'},
        {'grade_label': 'D', 'min_score': 30, 'max_score': 49,  'points': 4, 'remarks': 'Average'},
        {'grade_label': 'F', 'min_score':  0, 'max_score': 29,  'points': 5, 'remarks': 'Fail'},
    ],
    # A-Level (ACSEE): A≥80, B≥70, C≥60, D≥50, E≥40, F<40
    'ADVANCED': [
        {'grade_label': 'A', 'min_score': 80, 'max_score': 100, 'points': 1, 'remarks': 'Excellent'},
        {'grade_label': 'B', 'min_score': 70, 'max_score': 79,  'points': 2, 'remarks': 'Very Good'},
        {'grade_label': 'C', 'min_score': 60, 'max_score': 69,  'points': 3, 'remarks': 'Good'},
        {'grade_label': 'D', 'min_score': 50, 'max_score': 59,  'points': 4, 'remarks': 'Average'},
        {'grade_label': 'E', 'min_score': 40, 'max_score': 49,  'points': 5, 'remarks': 'Average'},
        {'grade_label': 'F', 'min_score':  0, 'max_score': 39,  'points': 0, 'remarks': 'Fail'},
    ],
    # Primary (SFNA/PSLE): A≥80, B≥60, C≥45, D≥30, F<30
    'PRIMARY': [
        {'grade_label': 'A', 'min_score': 80, 'max_score': 100, 'points': 1, 'remarks': 'Excellent'},
        {'grade_label': 'B', 'min_score': 60, 'max_score': 79,  'points': 2, 'remarks': 'Very Good'},
        {'grade_label': 'C', 'min_score': 45, 'max_score': 59,  'points': 3, 'remarks': 'Good'},
        {'grade_label': 'D', 'min_score': 30, 'max_score': 44,  'points': 4, 'remarks': 'Average'},
        {'grade_label': 'F', 'min_score':  0, 'max_score': 29,  'points': 5, 'remarks': 'Fail'},
    ],
}
NECTA_DEFAULTS['COMBINED'] = NECTA_DEFAULTS['ORDINARY']


# ── Grade helpers ─────────────────────────────────────────────────────────────

def get_grade(score) -> str:
    """Legacy helper (O-Level NECTA defaults). Use get_grade_from_configs() for new code."""
    if score is None:
        return '-'
    s = float(score)
    for row in NECTA_DEFAULTS['ORDINARY']:
        if s >= float(row['min_score']):
            return row['grade_label']
    return 'F'


def get_grade_from_configs(score, configs: list) -> str:
    """
    Return the grade label for *score* using the provided configs list.
    configs must be sorted descending by min_score (highest first).
    """
    if score is None:
        return '-'
    s = float(score)
    for row in configs:
        if s >= float(row['min_score']):
            return row['grade_label']
    return configs[-1]['grade_label'] if configs else 'F'


def get_gpa(grade: str) -> int | None:
    """Legacy — uses O-Level defaults."""
    return {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5}.get(grade)


# ── NECTA Points helpers ──────────────────────────────────────────────────────

def get_points_o_level(subject_gpas: list) -> int:
    """
    O-Level aggregate: sum of best 7 subject points (lower = better).
    subject_gpas is a list of ints/None, one per subject taken.
    """
    valid = sorted([g for g in subject_gpas if g is not None and g > 0])
    return sum(valid[:7])


def get_points_a_level(subject_gpas: list) -> int:
    """
    A-Level aggregate: sum of best 3 principal subject points (lower = better).
    Excludes F (points=0) and subsidiary subjects (not modelled separately here).
    """
    valid = sorted([g for g in subject_gpas if g is not None and g > 0])
    return sum(valid[:3])


# ── Division helpers ──────────────────────────────────────────────────────────

def get_division_o_level(points: int) -> str:
    """O-Level division from aggregate points (best 7 subjects)."""
    if points <= 17: return 'Division I'
    if points <= 21: return 'Division II'
    if points <= 25: return 'Division III'
    if points <= 33: return 'Division IV'
    return 'Division 0'


def get_division_a_level(points: int) -> str:
    """A-Level division from aggregate points (best 3 principal subjects)."""
    if points <= 9:  return 'Division I'
    if points <= 12: return 'Division II'
    if points <= 15: return 'Division III'
    if points <= 19: return 'Division IV'
    return 'Division 0'


def get_division(avg_gpa: float) -> str:
    """Legacy helper kept for backward compatibility."""
    if avg_gpa <= 2.0: return 'Division I'
    if avg_gpa <= 3.0: return 'Division II'
    if avg_gpa <= 3.5: return 'Division III'
    if avg_gpa <= 4.0: return 'Division IV'
    return 'Fail'


# ── Remarks ───────────────────────────────────────────────────────────────────

GRADE_COMMENT = {
    'A': 'Excellent', 'B': 'Very Good', 'C': 'Good',
    'D': 'Average',   'E': 'Average',   'F': 'Fail',
}


def get_grade_comment(grade: str) -> str:
    return GRADE_COMMENT.get(grade, '')


# ── Centre / Class GPA ────────────────────────────────────────────────────────

# Valid NECTA grade keys and their O-Level point weights (lower = better).
_GRADE_POINTS: dict[str, int] = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5}


def calculate_centre_gpa(grade_counts: dict) -> dict:
    """
    Calculate the NECTA Centre (Class) GPA from aggregated grade counts.

    The formula is:
        Centre GPA = (A×1 + B×2 + C×3 + D×4 + F×5) / Total exam papers sat

    A lower GPA indicates better overall school performance.

    Args:
        grade_counts: Mapping of grade label → count of papers awarded that grade
                      across **all** students and **all** subjects.
                      Example: {'A': 12, 'B': 45, 'C': 80, 'D': 22, 'F': 5}
                      Unknown / null values are silently ignored.

    Returns:
        A dict with:
            'centre_gpa'  (float | None) — GPA rounded to 2 d.p.; None when no
                                           valid papers are present.
            'centre_grade' (str | None)  — School performance tier:
                                           A (1.00–1.50), B (1.51–2.50),
                                           C (2.51–3.50), D (3.51–4.50),
                                           F (4.51–5.00).

    Example:
        >>> calculate_centre_gpa({'A': 10, 'B': 20, 'C': 30, 'D': 10, 'F': 5})
        {'centre_gpa': 2.87, 'centre_grade': 'C'}
    """
    total_points = 0
    total_papers = 0

    for grade, count in grade_counts.items():
        pts = _GRADE_POINTS.get(str(grade).upper())
        if pts is None or not count:          # skip invalid keys and zero/null counts
            continue
        n = int(count)
        total_points += pts * n
        total_papers += n

    if total_papers == 0:
        return {'centre_gpa': None, 'centre_grade': None}

    gpa = round(total_points / total_papers, 2)

    if gpa <= 1.50:
        grade = 'A'
    elif gpa <= 2.50:
        grade = 'B'
    elif gpa <= 3.50:
        grade = 'C'
    elif gpa <= 4.50:
        grade = 'D'
    else:
        grade = 'F'

    return {'centre_gpa': gpa, 'centre_grade': grade}


# ── School-type-aware summary computation ─────────────────────────────────────

def compute_student_summary(school_type: str, subject_results: list, configs: list | None = None) -> dict:
    """
    Given a school_type and a list of per-subject dicts:
        [{'score': float|None, 'points': int|None, 'excluded': bool}, ...]

    Returns a summary dict with keys that vary by school type:

    PRIMARY:
        total_score      — sum of all non-excluded scored subjects
        total_possible   — count_of_scored * 100
        average          — total_score / count_scored (1 decimal)
        grade            — grade for the average score
        grade_remarks    — remarks string

    ORDINARY / COMBINED:
        total_score      — sum of all scored subjects
        total_possible   — count_of_scored * 100
        average          — 1-decimal average
        points           — NECTA aggregate: best 7 subject GPA points
        division         — Division I…IV/0

    ADVANCED:
        total_score      — sum of all scored subjects
        total_possible   — count_of_scored * 100
        average          — 1-decimal average
        points           — NECTA aggregate: best 3 principal subject GPA points
        division         — Division I…IV/0
    """
    defaults = configs if configs else NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

    scored = [r for r in subject_results if not r.get('excluded') and r.get('score') is not None]
    if not scored:
        return {
            'total_score': None, 'total_possible': 0, 'average': None,
            'grade': None, 'grade_remarks': None, 'points': None, 'division': None,
        }

    total_score = sum(r['score'] for r in scored)
    total_possible = len(scored) * 100
    average = round(total_score / len(scored), 1)

    # Grade of the average (useful for PRIMARY; also returned for O/A level)
    avg_grade = get_grade_from_configs(average, defaults)
    avg_remarks = next((row['remarks'] for row in defaults if row['grade_label'] == avg_grade), '')

    if school_type == 'PRIMARY':
        return {
            'total_score': round(total_score, 1),
            'total_possible': total_possible,
            'average': average,
            'grade': avg_grade,
            'grade_remarks': avg_remarks,
            'points': None,
            'division': None,
        }

    # O-Level / A-Level / Combined — compute NECTA aggregate points
    gpa_list = []
    for r in scored:
        g = get_grade_from_configs(r['score'], defaults)
        pts = next((row['points'] for row in defaults if row['grade_label'] == g), None)
        if pts is not None:
            gpa_list.append(pts)

    if school_type == 'ADVANCED':
        points = get_points_a_level(gpa_list)
        division = get_division_a_level(points) if gpa_list else None
    else:
        points = get_points_o_level(gpa_list)
        division = get_division_o_level(points) if gpa_list else None

    return {
        'total_score': round(total_score, 1),
        'total_possible': total_possible,
        'average': average,
        'grade': avg_grade,
        'grade_remarks': avg_remarks,
        'points': points,
        'division': division,
    }

