"""
necta_pipeline.py
Shared preprocessing logic — imported by both the Jupyter notebook and the
Django import service. Test in the notebook; the same functions run in production.
"""
import re
import numpy as np
import pandas as pd
from difflib import get_close_matches

CANONICAL_REGIONS = [
    'ARUSHA', 'DAR ES SALAAM', 'DODOMA', 'GEITA', 'IRINGA', 'KAGERA',
    'KATAVI', 'KIGOMA', 'KILIMANJARO', 'LINDI', 'MANYARA', 'MARA',
    'MBEYA', 'MOROGORO', 'MTWARA', 'MWANZA', 'NJOMBE', 
    'PEMBA NORTH', 'PEMBA SOUTH', 'PWANI', 'RUKWA', 'RUVUMA', 
    'SHINYANGA', 'SIMIYU', 'SINGIDA', 'SONGWE', 'TABORA', 'TANGA', 
    'UNGUJA NORTH', 'UNGUJA SOUTH', 'UNGUJA URBAN WEST',
    'KASKAZINI PEMBA', 'KUSINI PEMBA', 'KASKAZINI UNGUJA', 
    'KUSINI UNGUJA', 'MJINI MAGHARIBI'
]


def clean_region(raw_region):
    if pd.isna(raw_region):
        return None, False
    text = str(raw_region).split('\n')[0].strip().upper()
    text = re.sub(r'\s+', ' ', text)
    if text in CANONICAL_REGIONS:
        return text, True
    close = get_close_matches(text, CANONICAL_REGIONS, n=1, cutoff=0.7)
    if close:
        return close[0], True
    return text, False


def parse_grade(raw_grade):
    if pd.isna(raw_grade):
        return None, None
    match = re.search(r'GRADE\s+([A-F])\s*\(([^)]+)\)', str(raw_grade), re.I)
    if match:
        return match.group(1).upper(), match.group(2).strip().upper()
    return None, None



def derive_center_type(center_id):
    if pd.isna(center_id):
        return 'UNKNOWN'
    prefix = str(center_id).strip().upper()[0]
    return 'PRIVATE' if prefix == 'P' else 'SCHOOL'


def clean_summary(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans the raw summary CSV. Assumes `district` column already exists
    (populated by you during scraping). If missing entirely, it's created
    as blank so downstream code never breaks.
    """
    df = df.copy()

    df['center_type'] = df['center_id'].apply(derive_center_type)

    region_results = df['region'].apply(clean_region)
    df['region']          = region_results.apply(lambda x: x[0])
    df['region_verified'] = region_results.apply(lambda x: x[1])

    if 'district' not in df.columns:
        df['district'] = ''
    df['district'] = df['district'].fillna('').astype(str).str.strip().str.upper()
    df['district_known'] = df['district'] != ''

    # Directly read existing columns from the CSV instead of parsing
    df['grade_letter'] = df['grade_letter'].fillna('').astype(str).str.strip().str.upper() if 'grade_letter' in df.columns else ''
    df['grade_label']  = df['grade_label'].fillna('').astype(str).str.strip().str.upper() if 'grade_label' in df.columns else ''

    df['is_rankable'] = (
        (df['center_type'] == 'SCHOOL') &
        (df['sat_total'].fillna(0) > 0) &
        (df['center_gpa'].notna())
    )

    # The separately-scraped 'TOTAL PASSED CANDIDATES' text field can mismatch
    # the division breakdown due to regex/parsing inconsistencies. The division
    # table is the more reliable structured source, so recompute total_passed/
    # total_failed from it directly. Division 0 is NECTA's own "failed" bucket.
    df['total_passed'] = (
        df['div_1_total'] + df['div_2_total'] + df['div_3_total'] + df['div_4_total']
    )
    df['total_failed'] = df['div_0_total']

    # graded_total = candidates who actually received a division. This can be
    # LESS than sat_total, because sat_total also counts withheld/no-CA
    # candidates who never appear in any division at all. Using sat_total as
    # the pass_rate denominator silently understates pass rate for schools
    # with zero real Div 0 failures. graded_total is the honest denominator.
    df['graded_total'] = (
        df['div_1_total'] + df['div_2_total'] + df['div_3_total'] +
        df['div_4_total'] + df['div_0_total']
    )

    df['pass_rate'] = np.where(
        df['graded_total'] > 0,
        (df['total_passed'] / df['graded_total'] * 100).round(2),
        np.nan
    )

    div_cols_f  = ['div_1_female', 'div_2_female', 'div_3_female', 'div_4_female', 'div_0_female']
    div_cols_m  = ['div_1_male',   'div_2_male',   'div_3_male',   'div_4_male',   'div_0_male']
    pass_cols_f = ['div_1_female', 'div_2_female', 'div_3_female', 'div_4_female']
    pass_cols_m = ['div_1_male',   'div_2_male',   'div_3_male',   'div_4_male']

    df['sat_female']  = df[div_cols_f].sum(axis=1)
    df['sat_male']    = df[div_cols_m].sum(axis=1)
    df['pass_female'] = df[pass_cols_f].sum(axis=1)
    df['pass_male']   = df[pass_cols_m].sum(axis=1)

    df['pass_rate_female'] = np.where(
        df['sat_female'] > 0, (df['pass_female'] / df['sat_female'] * 100).round(2), np.nan
    )
    df['pass_rate_male'] = np.where(
        df['sat_male'] > 0, (df['pass_male'] / df['sat_male'] * 100).round(2), np.nan
    )

    df['div1_rate'] = np.where(
        df['graded_total'] > 0, (df['div_1_total'] / df['graded_total'] * 100).round(2), np.nan
    )

    return df




def compute_rankings(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds national_rank, regional_rank, district_rank.
    Lower GPA = better = lower rank number.
    district_rank is only set where district is known.
    """
    df = df.copy()
    df['national_rank'] = np.nan
    df['regional_rank'] = np.nan
    df['district_rank'] = np.nan

    rankable = df[df['is_rankable']].copy()
    rankable = rankable.sort_values('center_gpa')
    rankable['national_rank'] = range(1, len(rankable) + 1)

    rankable['regional_rank'] = (
        rankable.groupby('region')['center_gpa']
        .rank(method='first', ascending=True)
        .astype(int)
    )

    has_district = rankable[rankable['district_known']].copy()
    if not has_district.empty:
        has_district['district_rank'] = (
            has_district.groupby(['region', 'district'])['center_gpa']
            .rank(method='first', ascending=True)
            .astype(int)
        )
        rankable.loc[has_district.index, 'district_rank'] = has_district['district_rank']

    df.loc[rankable.index, 'national_rank'] = rankable['national_rank']
    df.loc[rankable.index, 'regional_rank'] = rankable['regional_rank']
    df.loc[rankable.index, 'district_rank'] = rankable['district_rank']

    return df


def clean_subjects(df: pd.DataFrame, summary_clean: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans the subjects CSV and attaches region/district/center_type from
    the cleaned summary via join on center_id.
    """
    df = df.copy()
    df['subject_name'] = df['subject_name'].str.strip().str.upper()

    df['absent'] = df['registered'] - df['sat']
    df['dropout_rate'] = np.where(
        df['registered'] > 0, (df['absent'] / df['registered'] * 100).round(2), np.nan
    )

    lookup = summary_clean.set_index('center_id')[
        ['region', 'district', 'district_known', 'center_type', 'region_verified']
    ]
    df = df.join(lookup, on='center_id')

    df['is_rankable'] = (df['center_type'] == 'SCHOOL') & (df['sat'].fillna(0) > 0)

    return df


def national_subject_stats(subjects_clean: pd.DataFrame) -> pd.DataFrame:
    """
    Subject-centric: how did each SUBJECT perform nationally, weighted by
    sat count. (Not a school ranking — see subject_school_rankings for that.)
    """
    rankable = subjects_clean[subjects_clean['is_rankable']].copy()

    def _agg(g):
        total_sat = g['sat'].sum()
        weighted_gpa = (
            (g['subject_gpa'] * g['sat']).sum() / total_sat if total_sat > 0 else np.nan
        )
        return pd.Series({
            'total_registered': g['registered'].sum(),
            'total_sat':        total_sat,
            'weighted_gpa':     round(weighted_gpa, 4) if pd.notna(weighted_gpa) else np.nan,
            'avg_dropout_rate': round(g['dropout_rate'].mean(), 2),
            'centers_offering': g['center_id'].nunique(),
        })

    result = rankable.groupby('subject_name').apply(_agg).reset_index()
    result = result.sort_values('weighted_gpa')
    result['national_rank'] = range(1, len(result) + 1)
    return result


def regional_subject_stats(subjects_clean: pd.DataFrame) -> pd.DataFrame:
    """Subject-centric aggregate, split by region."""
    rankable = subjects_clean[
        subjects_clean['is_rankable'] & subjects_clean['region_verified']
    ].copy()

    def _agg(g):
        total_sat = g['sat'].sum()
        weighted_gpa = (
            (g['subject_gpa'] * g['sat']).sum() / total_sat if total_sat > 0 else np.nan
        )
        return pd.Series({
            'total_registered': g['registered'].sum(),
            'total_sat':        total_sat,
            'weighted_gpa':     round(weighted_gpa, 4) if pd.notna(weighted_gpa) else np.nan,
        })

    result = rankable.groupby(['region', 'subject_name']).apply(_agg).reset_index()
    result['regional_rank'] = (
        result.groupby('region')['weighted_gpa']
        .rank(method='first', ascending=True)
        .astype(int)
    )
    return result


def subject_school_rankings(subjects_clean: pd.DataFrame) -> pd.DataFrame:
    """
    School-centric: which SCHOOLS excel at a given subject.
    Ranked nationally, regionally, and by district (where district is known).
    This is the "Top 10 schools in Biology" leaderboard.
    """
    rankable = subjects_clean[
        subjects_clean['is_rankable'] & subjects_clean['subject_gpa'].notna()
    ].copy()

    rankable['national_subject_rank'] = (
        rankable.groupby('subject_name')['subject_gpa']
        .rank(method='first', ascending=True)
        .astype(int)
    )

    rankable['regional_subject_rank'] = (
        rankable.groupby(['subject_name', 'region'])['subject_gpa']
        .rank(method='first', ascending=True)
        .astype(int)
    )

    rankable['district_subject_rank'] = np.nan
    has_district = rankable[rankable['district_known']].copy()
    if not has_district.empty:
        has_district['district_subject_rank'] = (
            has_district.groupby(['subject_name', 'region', 'district'])['subject_gpa']
            .rank(method='first', ascending=True)
            .astype(int)
        )
        rankable.loc[has_district.index, 'district_subject_rank'] = has_district['district_subject_rank']

    return rankable[[
        'center_id', 'subject_name', 'region', 'district', 'district_known',
        'subject_gpa', 'sat', 'registered',
        'national_subject_rank', 'regional_subject_rank', 'district_subject_rank',
    ]]


def regional_summary(summary_clean: pd.DataFrame) -> pd.DataFrame:
    """One row per region — the regional comparison table."""
    rankable = summary_clean[summary_clean['is_rankable']].copy()

    def _agg(g):
        total_sat = g['sat_total'].sum()
        weighted_gpa = (
            (g['center_gpa'] * g['sat_total']).sum() / total_sat if total_sat > 0 else np.nan
        )
        total_passed = g['total_passed'].sum()
        return pd.Series({
            'school_count': len(g),
            'total_sat':    total_sat,
            'total_passed': total_passed,
            'weighted_gpa': round(weighted_gpa, 4) if pd.notna(weighted_gpa) else np.nan,
            'pass_rate':    round(total_passed / total_sat * 100, 2) if total_sat else np.nan,
            'div1_count':   g['div_1_total'].sum(),
        })

    result = rankable.groupby('region').apply(_agg).reset_index()
    result = result.sort_values('weighted_gpa')
    result['national_rank'] = range(1, len(result) + 1)
    return result


def district_summary(summary_clean: pd.DataFrame) -> pd.DataFrame:
    """One row per (region, district) — only rows with known district."""
    rankable = summary_clean[
        summary_clean['is_rankable'] & summary_clean['district_known']
    ].copy()

    if rankable.empty:
        return pd.DataFrame(columns=[
            'region', 'district', 'school_count', 'total_sat', 'total_passed',
            'weighted_gpa', 'pass_rate', 'div1_count', 'national_rank',
        ])

    def _agg(g):
        total_sat = g['sat_total'].sum()
        weighted_gpa = (
            (g['center_gpa'] * g['sat_total']).sum() / total_sat if total_sat > 0 else np.nan
        )
        total_passed = g['total_passed'].sum()
        return pd.Series({
            'school_count': len(g),
            'total_sat':    total_sat,
            'total_passed': total_passed,
            'weighted_gpa': round(weighted_gpa, 4) if pd.notna(weighted_gpa) else np.nan,
            'pass_rate':    round(total_passed / total_sat * 100, 2) if total_sat else np.nan,
            'div1_count':   g['div_1_total'].sum(),
        })

    result = rankable.groupby(['region', 'district']).apply(_agg).reset_index()
    result = result.sort_values('weighted_gpa')
    result['national_rank'] = range(1, len(result) + 1)
    return result


def national_kpis(summary_clean: pd.DataFrame) -> dict:
    """Single dict powering the top-of-page KPI cards."""
    rankable = summary_clean[summary_clean['is_rankable']]
    total_sat    = rankable['sat_total'].sum()
    total_passed = rankable['total_passed'].sum()
    weighted_gpa = (
        (rankable['center_gpa'] * rankable['sat_total']).sum() / total_sat
        if total_sat > 0 else None
    )

    return {
        'total_schools':             int(len(rankable)),
        'total_candidates_sat':      int(total_sat),
        'total_passed':              int(total_passed),
        'national_pass_rate':        round(total_passed / total_sat * 100, 2) if total_sat else None,
        'national_weighted_gpa':     round(weighted_gpa, 4) if weighted_gpa else None,
        'national_pass_rate_male':   round(
            rankable['pass_male'].sum() / rankable['sat_male'].sum() * 100, 2
        ) if rankable['sat_male'].sum() else None,
        'national_pass_rate_female': round(
            rankable['pass_female'].sum() / rankable['sat_female'].sum() * 100, 2
        ) if rankable['sat_female'].sum() else None,
        'regions_represented':       int(rankable['region'].nunique()),
        'private_centers_excluded':  int((summary_clean['center_type'] == 'PRIVATE').sum()),
        'unverified_regions':        int((~summary_clean['region_verified']).sum()),
        'schools_with_district':     int(rankable['district_known'].sum()),
    }



def gender_gap_regional(summary_clean: pd.DataFrame) -> pd.DataFrame:
    """
    Gender gap per region — pass_rate_male minus pass_rate_female, both
    directions preserved (positive = boys ahead, negative = girls ahead).
    Ranked by absolute gap size, largest first — this is the "debate" list.
    """
    rankable = summary_clean[
        summary_clean['is_rankable'] &
        summary_clean['pass_rate_male'].notna() &
        summary_clean['pass_rate_female'].notna()
    ].copy()

    def _agg(g):
        total_sat_m = g['sat_male'].sum()
        total_sat_f = g['sat_female'].sum()
        pass_rate_m = (
            round(g['pass_male'].sum() / total_sat_m * 100, 2) if total_sat_m else None
        )
        pass_rate_f = (
            round(g['pass_female'].sum() / total_sat_f * 100, 2) if total_sat_f else None
        )
        gap = round(pass_rate_m - pass_rate_f, 2) if pass_rate_m is not None and pass_rate_f is not None else None
        leader = None
        if gap is not None:
            leader = 'TIE' if abs(gap) < 0.05 else ('MALE' if gap > 0 else 'FEMALE')
        return pd.Series({
            'pass_rate_male':   pass_rate_m,
            'pass_rate_female': pass_rate_f,
            'gap':              gap,
            'leader':           leader,
            'school_count':     len(g),
        })
        # gap = round(pass_rate_m - pass_rate_f, 2) if pass_rate_m is not None and pass_rate_f is not None else None
        # return pd.Series({
        #     'pass_rate_male':   pass_rate_m,
        #     'pass_rate_female': pass_rate_f,
        #     'gap':              gap,   # positive = boys ahead, negative = girls ahead
        #     'school_count':     len(g),
        # })

    result = rankable.groupby('region').apply(_agg).reset_index()
    result['abs_gap'] = result['gap'].abs()
    result = result.sort_values('abs_gap', ascending=False)
    return result.drop(columns=['abs_gap'])


def gender_gap_schools(summary_clean: pd.DataFrame, top_n: int = 10) -> pd.DataFrame:
    """Individual schools with the widest gender performance gap, either direction."""
    rankable = summary_clean[
        summary_clean['is_rankable'] &
        (summary_clean['sat_male'] >= 5) & (summary_clean['sat_female'] >= 5)
        # require a minimum of 5 candidates per gender so the gap is meaningful,
        # not an artifact of a 1-student sample
    ].copy()

    rankable['gap'] = rankable['pass_rate_male'] - rankable['pass_rate_female']
    rankable['abs_gap'] = rankable['gap'].abs()
    result = rankable.sort_values('abs_gap', ascending=False).head(top_n)

    return result[[
        'center_id', 'center_name', 'region', 'district',
        'pass_rate_male', 'pass_rate_female', 'gap', 'sat_male', 'sat_female',
    ]]




def hidden_gems(summary_clean: pd.DataFrame, min_candidates: int = 5,
                max_candidates: int = 25, top_n: int = 10) -> pd.DataFrame:
    """
    Small schools (few candidates) punching well above their weight.
    The 'did you know' surprise story — genuinely shareable because it's
    unexpected: a tiny rural school outperforming well-known big names.
    """
    rankable = summary_clean[
        summary_clean['is_rankable'] &
        (summary_clean['sat_total'] >= min_candidates) &
        (summary_clean['sat_total'] <= max_candidates)
    ].copy()

    result = rankable.sort_values('center_gpa').head(top_n)
    return result[[
        'center_id', 'center_name', 'region', 'district',
        'center_gpa', 'sat_total', 'pass_rate', 'national_rank',
    ]]



def compute_headline_facts(summary_clean: pd.DataFrame, regional_df: pd.DataFrame,
                           gender_regional_df: pd.DataFrame,
                           gems_df: pd.DataFrame) -> dict:
    """
    Pre-computed sentences/data powering the front-page headline story and
    the 'did you know' cards. Called once at import time, cached on
    ExamSession.kpi_data — never recomputed per page view.
    """
    facts = {}

    if not regional_df.empty:
        best_region = regional_df.iloc[0]
        facts['best_region'] = {
            'region': best_region['region'],
            'weighted_gpa': best_region['weighted_gpa'],
            'pass_rate': best_region['pass_rate'],
        }

    if not gender_regional_df.empty:
        widest = gender_regional_df.iloc[0]
        facts['widest_gender_gap_region'] = {
            'region': widest['region'],
            'gap': widest['gap'],
            'pass_rate_male': widest['pass_rate_male'],
            'pass_rate_female': widest['pass_rate_female'],
            'leader': 'MALE' if widest['gap'] > 0 else 'FEMALE',
        }

    rankable = summary_clean[summary_clean['is_rankable']]
    total_sat_m = rankable['sat_male'].sum()
    total_sat_f = rankable['sat_female'].sum()
    if total_sat_m and total_sat_f:
        nat_pass_m = round(rankable['pass_male'].sum() / total_sat_m * 100, 2)
        nat_pass_f = round(rankable['pass_female'].sum() / total_sat_f * 100, 2)
        gap = round(nat_pass_m - nat_pass_f, 2)
        # Explicit tie handling — a gap this small must never declare a winner
        leader = 'TIE' if abs(gap) < 0.05 else ('MALE' if gap > 0 else 'FEMALE')
        facts['national_gender'] = {
            'pass_rate_male': nat_pass_m,
            'pass_rate_female': nat_pass_f,
            'leader': leader,
            'gap': round(abs(gap), 2),
        }    

    # rankable = summary_clean[summary_clean['is_rankable']]
    # total_sat_m = rankable['sat_male'].sum()
    # total_sat_f = rankable['sat_female'].sum()
    # if total_sat_m and total_sat_f:
    #     nat_pass_m = round(rankable['pass_male'].sum() / total_sat_m * 100, 2)
    #     nat_pass_f = round(rankable['pass_female'].sum() / total_sat_f * 100, 2)
    #     facts['national_gender'] = {
    #         'pass_rate_male': nat_pass_m,
    #         'pass_rate_female': nat_pass_f,
    #         'leader': 'MALE' if nat_pass_m > nat_pass_f else 'FEMALE',
    #         'gap': round(abs(nat_pass_m - nat_pass_f), 2),
    #     }

    if not gems_df.empty:
        top_gem = gems_df.iloc[0]
        facts['top_hidden_gem'] = {
            'center_name': top_gem['center_name'],
            'region': top_gem['region'],
            'gpa': top_gem['center_gpa'],
            'sat_total': int(top_gem['sat_total']),
            'national_rank': int(top_gem['national_rank']) if pd.notna(top_gem['national_rank']) else None,
        }

    return facts


def compute_subject_headline_facts(subjects_clean: pd.DataFrame,
                                   national_subject_df: pd.DataFrame) -> dict:
    """
    Subject-related headline facts — computed separately since subject data
    is imported after summary data. Merged into kpi_data at that later step.
    """
    facts = {}

    if not national_subject_df.empty:
        worst_dropout = national_subject_df.sort_values('avg_dropout_rate', ascending=False).iloc[0]
        facts['worst_dropout_subject'] = {
            'subject_name': worst_dropout['subject_name'],
            'avg_dropout_rate': worst_dropout['avg_dropout_rate'],
        }
        best_subject = national_subject_df.iloc[0]  # already sorted by weighted_gpa asc
        facts['best_performing_subject'] = {
            'subject_name': best_subject['subject_name'],
            'weighted_gpa': best_subject['weighted_gpa'],
        }
        worst_subject = national_subject_df.iloc[-1]
        facts['worst_performing_subject'] = {
            'subject_name': worst_subject['subject_name'],
            'weighted_gpa': worst_subject['weighted_gpa'],
        }

    return facts




# def ownership_summary(summary_clean: pd.DataFrame) -> pd.DataFrame:
#     """
#     Government vs Private performance comparison.
#     Safe to call even when ownership_type is entirely 'UNKNOWN' — it will
#     simply return a single UNKNOWN row until real ownership data is scraped.
#     """
#     rankable = summary_clean[summary_clean['is_rankable']].copy()

#     def _agg(g):
#         total_sat = g['sat_total'].sum()
#         weighted_gpa = (
#             (g['center_gpa'] * g['sat_total']).sum() / total_sat if total_sat > 0 else np.nan
#         )
#         total_passed = g['total_passed'].sum()
#         return pd.Series({
#             'school_count': len(g),
#             'total_sat':    total_sat,
#             'weighted_gpa': round(weighted_gpa, 4) if pd.notna(weighted_gpa) else np.nan,
#             'pass_rate':    round(total_passed / total_sat * 100, 2) if total_sat else np.nan,
#         })

#     result = rankable.groupby('ownership_type').apply(_agg).reset_index()
#     return result.sort_values('weighted_gpa')