from decimal import Decimal, InvalidOperation

from academy.grading import NECTA_DEFAULTS, compute_student_summary, get_grade_from_configs
from academy.models import Assessment, GradeConfig, Mark, Student, StudentSubjectExclusion, Subject, Stream


class CombinedResultsValidationError(Exception):
    pass


def _normalize_assessment_weights(raw_items):
    if not isinstance(raw_items, list):
        raise CombinedResultsValidationError('assessments must be a list.')

    normalized = []
    seen = set()
    for item in raw_items:
        if not isinstance(item, dict):
            raise CombinedResultsValidationError('Each assessment entry must be an object.')

        assessment_id = item.get('assessment_id') or item.get('id')
        weight = item.get('weight')

        if assessment_id in (None, ''):
            raise CombinedResultsValidationError('assessment_id is required for each selected assessment.')
        if assessment_id in seen:
            raise CombinedResultsValidationError('Duplicate assessments are not allowed.')

        try:
            weight_dec = Decimal(str(weight))
        except (InvalidOperation, TypeError):
            raise CombinedResultsValidationError('Each selected assessment must have a numeric weight.')

        if weight_dec <= 0:
            raise CombinedResultsValidationError('Each selected assessment weight must be greater than 0.')

        seen.add(assessment_id)
        normalized.append({'assessment_id': int(assessment_id), 'weight': weight_dec})

    if len(normalized) < 2:
        raise CombinedResultsValidationError('Select at least two assessments in combined mode.')

    total = sum(i['weight'] for i in normalized)
    if total != Decimal('100'):
        raise CombinedResultsValidationError('Combined weights must total exactly 100%.')

    return normalized


def build_combined_results_data(school, stream_id, assessment_weights, treat_missing_as_zero=False):
    selected = _normalize_assessment_weights(assessment_weights)

    school_type = school.school_type
    grade_configs = list(
        GradeConfig.objects.filter(school=school).order_by('-min_score')
        .values('grade_label', 'min_score', 'max_score', 'points', 'remarks')
    )
    if not grade_configs:
        grade_configs = NECTA_DEFAULTS.get(school_type, NECTA_DEFAULTS['ORDINARY'])

    stream_obj = Stream.objects.select_related('class_level').filter(school=school, pk=stream_id).first()
    if not stream_obj:
        raise CombinedResultsValidationError('Invalid stream selected.')

    assessments_qs = Assessment.objects.filter(
        school=school,
        id__in=[x['assessment_id'] for x in selected],
    )
    assessments_map = {a.id: a for a in assessments_qs}
    if len(assessments_map) != len(selected):
        raise CombinedResultsValidationError('One or more selected assessments are invalid.')

    subjects = list(
        Subject.objects.filter(school=school, assignments__stream_id=stream_id)
        .distinct()
        .order_by('name')
    )
    subject_ids = [s.id for s in subjects]

    students = list(
        Student.objects.filter(school=school, stream_id=stream_id)
        .order_by('gender', 'last_name', 'first_name')
    )

    exclusions = set(
        StudentSubjectExclusion.objects.filter(
            school=school,
            student__in=students,
            subject__in=subjects,
        ).values_list('student_id', 'subject_id')
    )

    marks_map = {}
    for m in Mark.objects.filter(
        school=school,
        assessment_id__in=[x['assessment_id'] for x in selected],
        student__in=students,
        subject_id__in=subject_ids,
    ):
        marks_map[(m.assessment_id, m.student_id, m.subject_id)] = float(m.score) if m.score is not None else None

    ordered_assessments = []
    for item in selected:
        a = assessments_map[item['assessment_id']]
        ordered_assessments.append({
            'id': a.id,
            'name': a.name,
            'academic_year': str(a.academic_year),
            'weight': float(item['weight']),
            'weight_decimal': item['weight'],
        })

    missing_map = {a['id']: set() for a in ordered_assessments}
    rows = []

    for student in students:
        excluded_subjects = []
        assessment_averages = {}
        subjects_detail = {}
        final_subject_results = []

        for subj in subjects:
            if (student.id, subj.id) in exclusions:
                subjects_detail[subj.name] = {
                    'excluded': True,
                    'assessment_scores': {},
                    'final_score': None,
                    'grade': '-',
                    'remarks': '-',
                }
                continue

            scores_by_assessment = {}
            has_any_mark = False
            missing_ids = []
            for a in ordered_assessments:
                score = marks_map.get((a['id'], student.id, subj.id))
                if score is None:
                    missing_ids.append(a['id'])
                else:
                    has_any_mark = True
                scores_by_assessment[a['id']] = score

            if not has_any_mark:
                excluded_subjects.append(subj.name)
                subjects_detail[subj.name] = {
                    'excluded': False,
                    'excluded_for_no_marks': True,
                    'assessment_scores': scores_by_assessment,
                    'final_score': None,
                    'grade': '-',
                    'remarks': '-',
                }
                continue

            weighted_sum = 0.0
            for a in ordered_assessments:
                raw_score = scores_by_assessment[a['id']]
                if raw_score is None:
                    missing_map[a['id']].add(student.display_name)
                    if treat_missing_as_zero:
                        raw_score = 0.0
                    else:
                        raw_score = None
                if raw_score is None:
                    continue
                weighted_sum += raw_score * (float(a['weight_decimal']) / 100.0)

            final_score = round(weighted_sum, 2)
            grade = get_grade_from_configs(final_score, grade_configs)
            remark = next((row['remarks'] for row in grade_configs if row['grade_label'] == grade), '')

            subjects_detail[subj.name] = {
                'excluded': False,
                'excluded_for_no_marks': False,
                'assessment_scores': scores_by_assessment,
                'final_score': final_score,
                'grade': grade,
                'remarks': remark,
            }
            final_subject_results.append({
                'score': final_score,
                'excluded': False,
                'counts_in_division': subj.counts_in_division,
            })

        for a in ordered_assessments:
            marks_for_assessment = []
            for subj in subjects:
                detail = subjects_detail.get(subj.name)
                if not detail or detail.get('excluded') or detail.get('excluded_for_no_marks'):
                    continue
                score = detail['assessment_scores'].get(a['id'])
                if score is None:
                    if treat_missing_as_zero:
                        marks_for_assessment.append(0.0)
                else:
                    marks_for_assessment.append(float(score))

            raw_avg = round(sum(marks_for_assessment) / len(marks_for_assessment), 2) if marks_for_assessment else None
            weighted_avg = round(raw_avg * (float(a['weight_decimal']) / 100.0), 2) if raw_avg is not None else None
            assessment_averages[a['id']] = {
                'raw_average': raw_avg,
                'weighted_average': weighted_avg,
            }

        summary = compute_student_summary(school_type, final_subject_results, grade_configs)
        final_weighted_average = 0.0
        has_any_assessment_avg = False
        for a in ordered_assessments:
            weighted_avg = assessment_averages[a['id']]['weighted_average']
            if weighted_avg is not None:
                has_any_assessment_avg = True
                final_weighted_average += weighted_avg

        rows.append({
            'student_id': student.id,
            'display_name': student.display_name,
            'gender': student.gender,
            'admission_number': student.admission_number,
            'parent_phone': student.parent_phone,
            'assessment_averages': assessment_averages,
            'final_weighted_average': round(final_weighted_average, 2) if has_any_assessment_avg else None,
            'subjects': subjects_detail,
            'excluded_subjects': excluded_subjects,
            'has_excluded_subjects': bool(excluded_subjects),
            'total_score': summary['total_score'],
            'total_possible': summary['total_possible'],
            'average': summary['average'],
            'grade': summary['grade'],
            'grade_remarks': summary['grade_remarks'],
            'points': summary['points'],
            'division': summary['division'],
        })

    missing_payload = []
    for a in ordered_assessments:
        student_names = sorted(missing_map[a['id']])
        if student_names:
            missing_payload.append({
                'assessment_id': a['id'],
                'assessment_name': a['name'],
                'students': student_names,
            })

    if missing_payload and not treat_missing_as_zero:
        return {
            'requires_confirmation': True,
            'missing_marks': missing_payload,
            'assessments': [
                {
                    'id': a['id'],
                    'name': a['name'],
                    'academic_year': a['academic_year'],
                    'weight': a['weight'],
                }
                for a in ordered_assessments
            ],
            'stream_label': f'{stream_obj.class_level.name} {stream_obj.name}'.strip(),
        }

    if school_type == 'PRIMARY':
        ranked = [r for r in rows if r['total_score'] is not None]
        unranked = [r for r in rows if r['total_score'] is None]
        ranked.sort(key=lambda r: -r['total_score'])
    else:
        ranked = [r for r in rows if r['average'] is not None]
        unranked = [r for r in rows if r['average'] is None]
        ranked.sort(key=lambda r: (-(r['average'] or 0), (r['points'] or 999)))

    total_students = len(rows)
    for i, r in enumerate(ranked, 1):
        r['rank'] = i
        r['total_students'] = total_students
    for r in unranked:
        r['rank'] = None
        r['total_students'] = total_students

    return {
        'requires_confirmation': False,
        'school_type': school_type,
        'subjects': [s.name for s in subjects],
        'subject_codes': {s.name: s.code for s in subjects},
        'students': ranked + unranked,
        'assessments': [
            {
                'id': a['id'],
                'name': a['name'],
                'academic_year': a['academic_year'],
                'weight': a['weight'],
            }
            for a in ordered_assessments
        ],
        'stream_label': f'{stream_obj.class_level.name} {stream_obj.name}'.strip(),
        'missing_marks': missing_payload,
    }
