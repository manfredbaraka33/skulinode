"""
enrich_tcu_data.py
Non-destructive patch command — updates ownership on TCUInstitution and
category on TCUProgramme for an already-imported cycle, using the offline
LLM-generated lookup files. Does NOT delete or recreate any rows, so any
manually-entered application_url values in admin are completely untouched.

Usage:
    python manage.py enrich_tcu_data --year="2026/2027"
"""
import os
import re
import json
from difflib import get_close_matches
from django.core.management.base import BaseCommand

from tcu_calculator.models import TCUAdmissionCycle, TCUInstitution, TCUProgramme


OWNERSHIP_MAP = {"Public": "GOVERNMENT", "Private": "PRIVATE"}

# Matches an abbreviation in parentheses, e.g. "Ardhi University (ARU)" -> "ARU"
CODE_PATTERN = re.compile(r"\(([A-Za-z0-9\-]{2,15})\)")


def extract_code(name: str):
    match = CODE_PATTERN.search(name)
    return match.group(1).upper() if match else None


def base_name(name: str) -> str:
    """Strip trailing ', Location' / campus suffix, keep the core institution name."""
    return name.split(",")[0].strip()


class Command(BaseCommand):
    help = 'Non-destructive enrichment: applies ownership + category lookups to existing TCU data'

    def add_arguments(self, parser):
        parser.add_argument('--year', required=True, help='e.g. "2026/2027"')

    def handle(self, *args, **options):
        try:
            cycle = TCUAdmissionCycle.objects.get(academic_year=options['year'])
        except TCUAdmissionCycle.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"No cycle found for {options['year']}."))
            return

        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
        ownership_path = os.path.join(data_dir, 'tcu_ownership_raw.json')
        category_path  = os.path.join(data_dir, 'tcu_category_lookup.json')

        # ── Ownership enrichment ──
        with open(ownership_path, encoding='utf-8') as f:
            ownership_rows = json.load(f)

        # Build two lookup dicts: by extracted code (most reliable) and by base name (fallback)
        by_code = {}
        by_name = {}
        for row in ownership_rows:
            raw_name = row.get('institution_name', '')
            ownership_raw = row.get('ownership')
            ownership = OWNERSHIP_MAP.get(ownership_raw, 'UNKNOWN')
            code = extract_code(raw_name)
            if code:
                by_code[code] = ownership
            by_name[base_name(raw_name).lower()] = ownership

        institutions = TCUInstitution.objects.filter(cycle=cycle)
        all_names_lower = list(by_name.keys())

        updated_ownership = 0
        unmatched_institutions = []

        for inst in institutions:
            code = extract_code(inst.name)
            matched_ownership = None

            if code and code in by_code:
                matched_ownership = by_code[code]
            else:
                inst_base = base_name(inst.name).lower()
                if inst_base in by_name:
                    matched_ownership = by_name[inst_base]
                else:
                    close = get_close_matches(inst_base, all_names_lower, n=1, cutoff=0.85)
                    if close:
                        matched_ownership = by_name[close[0]]

            if matched_ownership:
                inst.ownership = matched_ownership
                inst.save(update_fields=['ownership'])
                updated_ownership += 1
            else:
                unmatched_institutions.append(inst.name)

        self.stdout.write(self.style.SUCCESS(
            f"Ownership: updated {updated_ownership}/{institutions.count()} institutions."
        ))
        if unmatched_institutions:
            self.stdout.write(self.style.WARNING(
                f"{len(unmatched_institutions)} institutions unmatched (left as UNKNOWN):"
            ))
            for name in unmatched_institutions:
                self.stdout.write(f"  - {name}")

        # ── Category enrichment ──
        with open(category_path, encoding='utf-8') as f:
            category_lookup = json.load(f)

        programmes = TCUProgramme.objects.filter(institution__cycle=cycle)
        updated_category = 0
        unmatched_programmes = set()

        for prog in programmes:
            category = category_lookup.get(prog.programme_name)
            if category:
                prog.category = category
                prog.save(update_fields=['category'])
                updated_category += 1
            else:
                unmatched_programmes.add(prog.programme_name)

        self.stdout.write(self.style.SUCCESS(
            f"Category: updated {updated_category}/{programmes.count()} programmes."
        ))
        if unmatched_programmes:
            self.stdout.write(self.style.WARNING(
                f"{len(unmatched_programmes)} unique programme names had no category match "
                f"(left blank):"
            ))
            for name in list(unmatched_programmes)[:20]:
                self.stdout.write(f"  - {name}")