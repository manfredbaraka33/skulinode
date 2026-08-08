"""
tcu_calculator/insights.py
Analytical layer over already-imported TCU data — no scraping, no LLM,
pure aggregation over the 978 programme rows already in the DB. Computed
once per cycle (via management command), cached as JSON on the cycle
record, served instantly from there afterward.
"""
from collections import defaultdict
from django.db.models import Avg, Count, Min, Max


def compute_tcu_insights(cycle):
    from .models import TCUProgramme

    programmes = TCUProgramme.objects.filter(
        institution__cycle=cycle, status='ok', min_points_total__isnull=False
    ).select_related('institution')

    total = programmes.count()

    # ── Category breakdown ──
    category_stats = defaultdict(lambda: {'count': 0, 'points_sum': 0.0, 'points_n': 0})
    for p in programmes:
        cat = p.category or 'NYINGINE'
        category_stats[cat]['count'] += 1
        category_stats[cat]['points_sum'] += p.min_points_total
        category_stats[cat]['points_n'] += 1

    category_breakdown = []
    for cat, stats in category_stats.items():
        avg_points = round(stats['points_sum'] / stats['points_n'], 2) if stats['points_n'] else None
        category_breakdown.append({
            'category': cat,
            'programme_count': stats['count'],
            'avg_min_points': avg_points,
            'pct_of_total': round(stats['count'] / total * 100, 1) if total else 0,
        })
    category_breakdown.sort(key=lambda x: -x['programme_count'])

    # ── Ownership breakdown ──
    ownership_stats = defaultdict(lambda: {'count': 0, 'points_sum': 0.0, 'points_n': 0})
    for p in programmes:
        own = p.institution.ownership or 'UNKNOWN'
        ownership_stats[own]['count'] += 1
        ownership_stats[own]['points_sum'] += p.min_points_total
        ownership_stats[own]['points_n'] += 1

    ownership_breakdown = [{
        'ownership': own,
        'programme_count': stats['count'],
        'avg_min_points': round(stats['points_sum'] / stats['points_n'], 2) if stats['points_n'] else None,
    } for own, stats in ownership_stats.items()]

    # ── Most competitive programmes (highest min_points, i.e. hardest to enter) ──
    most_competitive = list(programmes.order_by('-min_points_total').values(
        'programme_name', 'institution__name', 'min_points_total', 'category', 'capacity'
    )[:10])

    # ── Hidden opportunities: low min_points AND decent capacity ──
    # (genuinely accessible programmes, not just "anything with low points" —
    # capacity filter avoids surfacing tiny/obscure 5-seat programmes)
    hidden_opportunities = list(
        programmes.filter(capacity__gte=50)
        .order_by('min_points_total')
        .values('programme_name', 'institution__name', 'min_points_total', 'category', 'capacity')[:10]
    )

    # ── Largest capacity programmes (most seats available nationally, by programme name) ──
    by_programme_name = defaultdict(lambda: {'total_capacity': 0, 'institution_count': 0, 'min_points_list': []})
    for p in programmes.exclude(capacity__isnull=True):
        entry = by_programme_name[p.programme_name]
        entry['total_capacity'] += p.capacity
        entry['institution_count'] += 1
        entry['min_points_list'].append(p.min_points_total)

    most_available = []
    for name, data in by_programme_name.items():
        most_available.append({
            'programme_name': name,
            'total_capacity': data['total_capacity'],
            'offered_at_n_institutions': data['institution_count'],
            'avg_min_points': round(sum(data['min_points_list']) / len(data['min_points_list']), 2),
        })
    most_available.sort(key=lambda x: -x['total_capacity'])
    most_available = most_available[:10]

    # ── National points distribution summary ──
    points_agg = programmes.aggregate(
        avg=Avg('min_points_total'), min=Min('min_points_total'), max=Max('min_points_total')
    )

    return {
        'total_programmes_analyzed': total,
        'points_summary': {
            'national_avg': round(points_agg['avg'], 2) if points_agg['avg'] else None,
            'lowest': points_agg['min'],
            'highest': points_agg['max'],
        },
        'category_breakdown': category_breakdown,
        'ownership_breakdown': ownership_breakdown,
        'most_competitive': most_competitive,
        'hidden_opportunities': hidden_opportunities,
        'most_available': most_available,
    }