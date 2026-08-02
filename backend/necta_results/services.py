"""
Import service — the ONLY place raw CSVs touch the database.
Runs the exact necta_pipeline.py functions you validated in the notebook.

Field naming note:
  - SchoolCenter has no `center` ForeignKey on itself, so its identifier
    field is simply `center_id`.
  - SubjectResult and SubjectSchoolRanking both have a `center` ForeignKey
    to SchoolCenter, which caused a Django field clash (E006) with a field
    literally named `center_id`. Those two models' identifier field was
    renamed to `raw_center_id` to resolve it. SchoolCenter is unaffected.
"""
import pandas as pd
from django.db import transaction

from .models import (
    ExamSession, SchoolCenter, SubjectResult,
    NationalSubjectStat, RegionalSubjectStat, SubjectSchoolRanking,
    RegionalSummary, DistrictSummary,
)
from .necta_pipeline import (
    clean_summary, compute_rankings, clean_subjects,
    national_subject_stats, regional_subject_stats, subject_school_rankings,
    regional_summary, district_summary, national_kpis,gender_gap_regional, gender_gap_schools,
    hidden_gems, compute_headline_facts, compute_subject_headline_facts,
)


def _safe_int(val, default=None):
    try:
        if pd.isna(val):
            return default
        return int(val)
    except (TypeError, ValueError):
        return default


def _safe_float(val, default=None):
    try:
        if pd.isna(val):
            return default
        return float(val)
    except (TypeError, ValueError):
        return default


@transaction.atomic
def import_summary_csv(file_obj, exam_session: ExamSession):
    """Import + clean + rank the summary CSV."""
    df = pd.read_csv(file_obj)
    df = clean_summary(df)
    df = compute_rankings(df)

    SchoolCenter.objects.filter(exam_session=exam_session).delete()

    centers = []
    for _, row in df.iterrows():
        centers.append(SchoolCenter(
            exam_session=exam_session,
            center_id=row['center_id'],          # SchoolCenter: field is center_id (unchanged)
            center_name=row['center_name'],
            center_type=row['center_type'],
            region=row['region'] or '',
            region_verified=bool(row['region_verified']),
            district=row.get('district') or '',
            district_known=bool(row.get('district_known', False)),
            # ownership_type=row.get('ownership_type') or 'UNKNOWN',
            registered_total=_safe_int(row.get('registered_total')),
            absent_total=_safe_int(row.get('absent_total')),
            sat_total=_safe_int(row.get('sat_total')),
            withheld_total=_safe_int(row.get('withheld_total')),
            clean_total=_safe_int(row.get('clean_total')),
            total_passed=_safe_int(row.get('total_passed')),
            total_failed=_safe_int(row.get('total_failed')),
            center_gpa=_safe_float(row.get('center_gpa')),
            grade_letter=row.get('grade_letter') or '',
            grade_label=row.get('grade_label') or '',
            pass_rate=_safe_float(row.get('pass_rate')),
            div1_rate=_safe_float(row.get('div1_rate')),
            div_1_female=_safe_int(row.get('div_1_female'), 0),
            div_2_female=_safe_int(row.get('div_2_female'), 0),
            div_3_female=_safe_int(row.get('div_3_female'), 0),
            div_4_female=_safe_int(row.get('div_4_female'), 0),
            div_0_female=_safe_int(row.get('div_0_female'), 0),
            div_1_male=_safe_int(row.get('div_1_male'), 0),
            div_2_male=_safe_int(row.get('div_2_male'), 0),
            div_3_male=_safe_int(row.get('div_3_male'), 0),
            div_4_male=_safe_int(row.get('div_4_male'), 0),
            div_0_male=_safe_int(row.get('div_0_male'), 0),
            div_1_total=_safe_int(row.get('div_1_total'), 0),
            div_2_total=_safe_int(row.get('div_2_total'), 0),
            div_3_total=_safe_int(row.get('div_3_total'), 0),
            div_4_total=_safe_int(row.get('div_4_total'), 0),
            div_0_total=_safe_int(row.get('div_0_total'), 0),
            sat_female=_safe_int(row.get('sat_female'), 0),
            sat_male=_safe_int(row.get('sat_male'), 0),
            pass_female=_safe_int(row.get('pass_female'), 0),
            pass_male=_safe_int(row.get('pass_male'), 0),
            pass_rate_female=_safe_float(row.get('pass_rate_female')),
            pass_rate_male=_safe_float(row.get('pass_rate_male')),
            is_rankable=bool(row['is_rankable']),
            national_rank=_safe_int(row.get('national_rank')),
            regional_rank=_safe_int(row.get('regional_rank')),
            district_rank=_safe_int(row.get('district_rank')),
            center_url=row.get('center_url') or '',
        ))
    
    SchoolCenter.objects.bulk_create(centers, batch_size=500)

    # Regional summary
    reg_df = regional_summary(df)
    RegionalSummary.objects.filter(exam_session=exam_session).delete()
    RegionalSummary.objects.bulk_create([
        RegionalSummary(
            exam_session=exam_session, region=r['region'],
            school_count=int(r['school_count']), total_sat=int(r['total_sat']),
            total_passed=int(r['total_passed']),
            weighted_gpa=_safe_float(r['weighted_gpa']),
            pass_rate=_safe_float(r['pass_rate']),
            div1_count=int(r['div1_count']), national_rank=int(r['national_rank']),
        ) for _, r in reg_df.iterrows()
    ])

    # District summary
    dist_df = district_summary(df)
    DistrictSummary.objects.filter(exam_session=exam_session).delete()
    if not dist_df.empty:
        DistrictSummary.objects.bulk_create([
            DistrictSummary(
                exam_session=exam_session, region=r['region'], district=r['district'],
                school_count=int(r['school_count']), total_sat=int(r['total_sat']),
                total_passed=int(r['total_passed']),
                weighted_gpa=_safe_float(r['weighted_gpa']),
                pass_rate=_safe_float(r['pass_rate']),
                div1_count=int(r['div1_count']), national_rank=int(r['national_rank']),
            ) for _, r in dist_df.iterrows()
        ])

    # exam_session.kpi_data = national_kpis(df)
    # exam_session.save(update_fields=['kpi_data'])

    # return {'centers_imported': len(centers), 'kpis': exam_session.kpi_data}
    # Ownership summary
    # own_df = ownership_summary(df)
    # OwnershipSummary.objects.filter(exam_session=exam_session).delete()
    # OwnershipSummary.objects.bulk_create([
    #     OwnershipSummary(
    #         exam_session=exam_session, ownership_type=r['ownership_type'],
    #         school_count=int(r['school_count']), total_sat=int(r['total_sat']),
    #         weighted_gpa=_safe_float(r['weighted_gpa']), pass_rate=_safe_float(r['pass_rate']),
    #     ) for _, r in own_df.iterrows()
    # ])

    # Gender gap analysis
    gender_regional_df = gender_gap_regional(df)
    gender_schools_df   = gender_gap_schools(df, top_n=10)

    # Hidden gems
    gems_df = hidden_gems(df, top_n=10)

    # Headline facts (region/gender/gem facts now; subject facts merged later)
    headline_facts = compute_headline_facts(df, reg_df, gender_regional_df, gems_df)

    exam_session.kpi_data = national_kpis(df)
    exam_session.kpi_data['headlines'] = headline_facts
    exam_session.kpi_data['gender_gap_regions'] = gender_regional_df.to_dict('records')
    exam_session.kpi_data['gender_gap_schools'] = gender_schools_df.to_dict('records')
    exam_session.kpi_data['hidden_gems'] = gems_df.to_dict('records')
    exam_session.save(update_fields=['kpi_data'])

    return {'centers_imported': len(centers), 'kpis': exam_session.kpi_data}


@transaction.atomic
def import_subjects_csv(file_obj, exam_session: ExamSession):
    """Import subject rows + compute national/regional/school-leaderboard aggregates."""
    df = pd.read_csv(file_obj)

    # NOTE: SchoolCenter's field really is `center_id` — only SubjectResult
    # and SubjectSchoolRanking use `raw_center_id`. This .values() call and
    # center_map below both reference SchoolCenter, so `center_id` is correct.
    centers_qs = SchoolCenter.objects.filter(exam_session=exam_session).values(
        'center_id', 'region', 'district', 'district_known', 'center_type', 'region_verified'
    )
    summary_lookup = pd.DataFrame(centers_qs)
    if summary_lookup.empty:
        raise ValueError('Import the summary CSV for this session first.')

    df = clean_subjects(df, summary_lookup)

    SubjectResult.objects.filter(exam_session=exam_session).delete()
    center_map = {c.center_id: c for c in SchoolCenter.objects.filter(exam_session=exam_session)}

    rows = []
    for _, row in df.iterrows():
        rows.append(SubjectResult(
            exam_session=exam_session,
            center=center_map.get(row['center_id']),
            raw_center_id=row['center_id'],   # SubjectResult: renamed field due to FK clash
            subject_code=row.get('subject_code') or '',
            subject_name=row['subject_name'],
            registered=_safe_int(row.get('registered')),
            sat=_safe_int(row.get('sat')),
            subject_gpa=_safe_float(row.get('subject_gpa')),
            dropout_rate=_safe_float(row.get('dropout_rate')),
        ))
    SubjectResult.objects.bulk_create(rows, batch_size=1000)

    # Subject-centric national aggregate
    nat_df = national_subject_stats(df)
    NationalSubjectStat.objects.filter(exam_session=exam_session).delete()
    NationalSubjectStat.objects.bulk_create([
        NationalSubjectStat(
            exam_session=exam_session, subject_name=r['subject_name'],
            total_registered=int(r['total_registered']), total_sat=int(r['total_sat']),
            weighted_gpa=_safe_float(r['weighted_gpa']),
            avg_dropout_rate=_safe_float(r['avg_dropout_rate']),
            centers_offering=int(r['centers_offering']), national_rank=int(r['national_rank']),
        ) for _, r in nat_df.iterrows()
    ])

    # Subject-centric regional aggregate
    reg_df = regional_subject_stats(df)
    RegionalSubjectStat.objects.filter(exam_session=exam_session).delete()
    RegionalSubjectStat.objects.bulk_create([
        RegionalSubjectStat(
            exam_session=exam_session, region=r['region'], subject_name=r['subject_name'],
            total_registered=int(r['total_registered']), total_sat=int(r['total_sat']),
            weighted_gpa=_safe_float(r['weighted_gpa']), regional_rank=int(r['regional_rank']),
        ) for _, r in reg_df.iterrows()
    ])

    # School-centric subject leaderboard ("Top 10 schools in Biology")
    school_rank_df = subject_school_rankings(df)
    SubjectSchoolRanking.objects.filter(exam_session=exam_session).delete()
    SubjectSchoolRanking.objects.bulk_create([
        SubjectSchoolRanking(
            exam_session=exam_session,
            center=center_map.get(r['center_id']),
            raw_center_id=r['center_id'],   # SubjectSchoolRanking: renamed field due to FK clash
            subject_name=r['subject_name'],
            region=r['region'],
            district=r.get('district') or '',
            subject_gpa=_safe_float(r['subject_gpa']),
            sat=_safe_int(r['sat']),
            registered=_safe_int(r['registered']),
            national_subject_rank=_safe_int(r['national_subject_rank']),
            regional_subject_rank=_safe_int(r['regional_subject_rank']),
            district_subject_rank=_safe_int(r['district_subject_rank']),
        ) for _, r in school_rank_df.iterrows()
    ], batch_size=1000)

    # Merge subject-related headline facts into the already-computed kpi_data
    subject_facts = compute_subject_headline_facts(df, nat_df)
    exam_session.kpi_data['headlines'] = {
        **exam_session.kpi_data.get('headlines', {}),
        **subject_facts,
    }
    exam_session.save(update_fields=['kpi_data'])

    return {'subject_rows_imported': len(rows)}