"""
Import the merged/reconciled tcu_master_dataset.json into Django models.
Run once per admission cycle year, after the offline extraction + manual
review pipeline is complete.

Usage:
    python manage.py import_tcu_data --file=tcu_master_dataset.json --year="2026/2027"
"""
import json
import re
from django.core.management.base import BaseCommand
from django.db import transaction
import os

from tcu_calculator.models import TCUAdmissionCycle, TCUInstitution, TCUProgramme


def split_institution(raw_name: str):
    """
    'St. Augustine University of Tanzania (SAUT) Mwanza' -> ('St. Augustine University of Tanzania (SAUT)', 'Mwanza')
    'Centre for Foreign Relations (CFR) Dar es Salaam' -> ('Centre for Foreign Relations (CFR)', 'Dar es Salaam')
    """
    # Most reliable: Split exactly at the space following the acronym's closing parenthesis
    if ') ' in raw_name:
        name, location = raw_name.rsplit(') ', 1)
        # Add the closing parenthesis back to the institution name
        return name.strip() + ')', location.strip()
    
    # Fallback: If there is no parenthesis, split by the very last space
    if ' ' in raw_name:
        name, location = raw_name.rsplit(' ', 1)
        return name.strip(), location.strip()
        
    return raw_name.strip(), ''


class Command(BaseCommand):
    help = 'Import merged TCU admission dataset into the database'
  

    def add_arguments(self, parser):
        default_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),  
            'data', 'tcu_master_dataset.json'
        )
        parser.add_argument('--file', default=default_path,
                            help='Defaults to tcu_calculator/data/tcu_master_dataset.json')
        parser.add_argument('--year', required=True, help='e.g. "2026/2027"')

    @transaction.atomic
    def handle(self, *args, **options):
        with open(options['file'], encoding='utf-8') as f:
            data = json.load(f)

        cycle, _ = TCUAdmissionCycle.objects.update_or_create(
            academic_year=options['year'],
            defaults={'is_published': False},
        )

        # Clear existing data for this cycle so re-imports are idempotent
        TCUInstitution.objects.filter(cycle=cycle).delete()

        institution_cache = {}
        created = 0

        for programme in data['programmes']:
            raw_inst_name = programme.get('institution', 'Unknown Institution')
            name, location = split_institution(raw_inst_name)

            cache_key = (name, location)
            if cache_key not in institution_cache:
                inst, _ = TCUInstitution.objects.get_or_create(
                    cycle=cycle, name=name, location=location,
                )
                institution_cache[cache_key] = inst
            institution = institution_cache[cache_key]


            TCUProgramme.objects.create(
                institution=institution,
                programme_name=programme.get('programme_name', ''),
                programme_code=programme.get('programme_code') or '',
                min_points_total=programme.get('min_points_total'),
                capacity=programme.get('capacity'),
                duration_years=programme.get('duration_years'),
                slots=programme.get('slots') or [],
                raw_requirement_text=programme.get('raw_requirement_text', ''),
                status=programme.get('status', 'ok'),
                matched_health_override=programme.get('matched_health_override', '') or '',
                health_override_mismatch=bool(programme.get('health_override_mismatch', False)),
                override_note=programme.get('override_note', '') or '',
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Imported {created} programmes across {len(institution_cache)} institutions '
            f'into cycle {cycle.academic_year}.'
        ))
        self.stdout.write(self.style.WARNING(
            'Cycle is NOT published yet — set is_published=True in Django admin once verified.'
        ))