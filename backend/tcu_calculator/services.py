"""
tcu_calculator/services.py
The runtime eligibility calculator. Pure Python, zero LLM involvement here —
all rule-extraction/verification already happened offline (pipeline_constants
+ the pre-imported TCUProgramme.slots data). This engine only does arithmetic
and combinatorial matching, which must be 100% deterministic and auditable.
"""
from itertools import combinations
from .pipeline_constants import GRADE_POINT_SCALES, normalize_subject


def grade_to_points(grade: str, scale: dict):
    if not grade:
        return None
    return scale.get(grade.strip().upper())


def _valid_candidates_for_slot(slot, student_subjects, scale):
    """
    Returns list of (subject_name, points) pairs from the student's own
    subjects that satisfy this slot's subject list AND minimum grade,
    ready to be chosen from during the assignment search.
    """
    allowed = {normalize_subject(s) for s in slot.get('subjects', [])}
    min_grade = slot.get('min_grade')
    min_points_required = grade_to_points(min_grade, scale) if min_grade else None

    valid = []
    for s in student_subjects:
        if normalize_subject(s['subject']) not in allowed:
            continue
        pts = grade_to_points(s['grade'], scale)
        if pts is None:
            continue
        if min_points_required is not None and pts < min_points_required:
            continue
        valid.append((s['subject'], pts))
    return valid


def _best_assignment(slots, student_subjects, scale):
    """
    Finds the subject-to-slot assignment (no subject reused across slots)
    that satisfies every slot's count_needed and maximizes total points.
    Slot counts are always tiny (1-4 slots, few candidates each), so a
    straightforward recursive search over combinations is efficient and
    fully deterministic — no heuristics, no approximation.

    Returns (feasible: bool, total_points: float, assignment: list) where
    assignment is [{"slot_subjects": [...], "chosen_subject": str, "grade_points": float}, ...]
    """
    slot_candidates = []
    for slot in slots:
        candidates = _valid_candidates_for_slot(slot, student_subjects, scale)
        count_needed = slot.get('count_needed', 1)
        if len(candidates) < count_needed:
            return False, 0.0, []  # this slot can never be satisfied — programme infeasible
        # Every combination of count_needed candidates for this slot
        combos = list(combinations(candidates, count_needed))
        slot_candidates.append({'slot': slot, 'combos': combos})

    best_total = -1
    best_assignment = None

    def backtrack(slot_idx, used_subjects, current_assignment, current_total):
        nonlocal best_total, best_assignment
        if slot_idx == len(slot_candidates):
            if current_total > best_total:
                best_total = current_total
                best_assignment = list(current_assignment)
            return

        entry = slot_candidates[slot_idx]
        for combo in entry['combos']:
            combo_subjects = {c[0] for c in combo}
            if combo_subjects & used_subjects:
                continue  # a subject can't fill two slots at once
            combo_points = sum(c[1] for c in combo)
            current_assignment.append({
                'slot_subjects': entry['slot']['subjects'],
                'chosen': [{'subject': c[0], 'grade_points': c[1]} for c in combo],
            })
            backtrack(slot_idx + 1, used_subjects | combo_subjects,
                      current_assignment, current_total + combo_points)
            current_assignment.pop()

    backtrack(0, frozenset(), [], 0.0)

    if best_assignment is None:
        return False, 0.0, []
    return True, best_total, best_assignment


def evaluate_programme(programme, student_subjects, cohort):
    """
    Returns a result dict for one programme given a student's subjects.
    student_subjects: [{"subject": "Physics", "grade": "B"}, ...]
    cohort: one of "PRE_2014" | "2014_2015" | "2016_ONWARDS"
    """
    scale = GRADE_POINT_SCALES[cohort]

    if programme.status != 'ok' or not programme.slots:
        return {
            'eligible': False,
            'reason': 'incomplete_data',
            'achieved_points': None,
            'required_points': programme.min_points_total,
        }

    feasible, total_points, assignment = _best_assignment(programme.slots, student_subjects, scale)

    if not feasible:
        return {
            'eligible': False,
            'reason': 'missing_required_subjects',
            'achieved_points': None,
            'required_points': programme.min_points_total,
        }

    min_required = programme.min_points_total or 0
    eligible = total_points >= min_required
    margin = round(total_points - min_required, 2)

    return {
        'eligible': eligible,
        'reason': 'ok' if eligible else 'below_minimum_points',
        'achieved_points': round(total_points, 2),
        'required_points': min_required,
        'margin': margin,
        'assignment': assignment,
    }


def calculate_eligibility(student_subjects, cohort, cycle, region=None,ownership=None, category=None,
                          min_capacity=None, close_miss_threshold=1.0):
    """
    Main entry point. Evaluates every published programme in the given
    cycle against the student's subjects.

    Returns three buckets:
      - eligible: programmes the student qualifies for right now
      - close_miss: programmes within `close_miss_threshold` points below
        the requirement — genuinely useful "almost there" guidance
      - ineligible: everything else (not shown by default in the UI,
        but returned for completeness/debugging)
    """
    from .models import TCUProgramme

    qs = TCUProgramme.objects.filter(
        institution__cycle=cycle, status='ok'
    ).select_related('institution')

    if region:
        qs = qs.filter(institution__location__icontains=region)
    if ownership:
        qs = qs.filter(institution__ownership=ownership)
    if category:
        qs = qs.filter(category=category)

    eligible, close_miss, ineligible = [], [], []

    for programme in qs:
        result = evaluate_programme(programme, student_subjects, cohort)
        row = {
            'programme_id': programme.id,
            'programme_name': programme.programme_name,
            'programme_code': programme.programme_code,
            'category': programme.get_category_display() if programme.category else None,
            'institution_name': programme.institution.name,
            'institution_ownership': programme.institution.get_ownership_display(),
            'institution_location': programme.institution.location,
            'application_url': programme.institution.application_url,
            'min_points_total': programme.min_points_total,
            'capacity': programme.capacity,
            'duration_years': programme.duration_years,
            **result,
        }

        if result['eligible']:
            eligible.append(row)
        elif result['reason'] == 'below_minimum_points' and result.get('achieved_points') is not None:
            gap = programme.min_points_total - result['achieved_points']
            if gap <= close_miss_threshold:
                row['points_gap'] = round(gap, 2)
                close_miss.append(row)
            else:
                ineligible.append(row)
        else:
            ineligible.append(row)

    eligible.sort(key=lambda r: -(r['margin'] or 0))
    close_miss.sort(key=lambda r: r['points_gap'])

    return {
        'eligible_count': len(eligible),
        'close_miss_count': len(close_miss),
        'eligible': eligible,
        'close_miss': close_miss,
    }