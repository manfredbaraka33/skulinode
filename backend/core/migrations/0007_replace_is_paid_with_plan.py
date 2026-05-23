"""
Migration: replace is_paid / is_paid_without_sms with a single plan CharField.

Data migration logic:
  is_paid=True               → plan='pro'
  is_paid_without_sms=True   → plan='standard'  (when is_paid is False)
  both False                 → plan='free'
"""
from django.db import migrations, models


def migrate_plan_forward(apps, schema_editor):
    School = apps.get_model('core', 'School')
    for school in School.objects.all():
        if school.is_paid:
            school.plan = 'pro'
        elif school.is_paid_without_sms:
            school.plan = 'standard'
        else:
            school.plan = 'free'
        school.save(update_fields=['plan'])


def migrate_plan_backward(apps, schema_editor):
    School = apps.get_model('core', 'School')
    for school in School.objects.all():
        if school.plan == 'pro':
            school.is_paid = True
            school.is_paid_without_sms = False
        elif school.plan == 'standard':
            school.is_paid = False
            school.is_paid_without_sms = True
        else:
            school.is_paid = False
            school.is_paid_without_sms = False
        school.save(update_fields=['is_paid', 'is_paid_without_sms'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_add_is_paid_without_sms_to_school'),
    ]

    operations = [
        # 1. Add the new plan field (nullable first so existing rows can be populated)
        migrations.AddField(
            model_name='school',
            name='plan',
            field=models.CharField(
                choices=[('free', 'Free'), ('basic', 'Basic'), ('standard', 'Standard'), ('pro', 'Pro')],
                default='free',
                help_text='Subscription plan that controls feature access for this school.',
                max_length=20,
                verbose_name='Plan',
            ),
        ),
        # 2. Populate plan from old boolean fields
        migrations.RunPython(migrate_plan_forward, migrate_plan_backward),
        # 3. Remove old boolean fields
        migrations.RemoveField(model_name='school', name='is_paid'),
        migrations.RemoveField(model_name='school', name='is_paid_without_sms'),
    ]
