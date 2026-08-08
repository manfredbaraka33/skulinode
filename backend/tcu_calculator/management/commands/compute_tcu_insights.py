"""
Computes and caches TCU insights for a cycle. Run once after import/enrich,
and again any time enrichment data changes (e.g. after adding categories).

Usage: python manage.py compute_tcu_insights --year="2026/2027"
"""
from django.core.management.base import BaseCommand
from tcu_calculator.models import TCUAdmissionCycle
from tcu_calculator.insights import compute_tcu_insights


class Command(BaseCommand):
    help = 'Compute and cache TCU insights for a given cycle'

    def add_arguments(self, parser):
        parser.add_argument('--year', required=True)

    def handle(self, *args, **options):
        try:
            cycle = TCUAdmissionCycle.objects.get(academic_year=options['year'])
        except TCUAdmissionCycle.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"No cycle found for {options['year']}."))
            return

        insights = compute_tcu_insights(cycle)
        cycle.insights_data = insights
        cycle.save(update_fields=['insights_data'])

        self.stdout.write(self.style.SUCCESS(
            f"Computed insights for {cycle}: {insights['total_programmes_analyzed']} programmes analyzed."
        ))