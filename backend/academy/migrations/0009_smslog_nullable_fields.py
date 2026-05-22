import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academy', '0008_mark_is_returned'),
        ('core', '0003_customuser_roles_school_email_school_logo_and_more'),
    ]

    operations = [
        # Make school nullable (override tenant default for standalone logging)
        migrations.AlterField(
            model_name='smslog',
            name='school',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='smslog_records',
                to='core.school',
                verbose_name='School',
            ),
        ),
        # Make student nullable (send_sms is a standalone utility)
        migrations.AlterField(
            model_name='smslog',
            name='student',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sms_logs',
                to='academy.student',
            ),
        ),
        # Add dry_run to status choices
        migrations.AlterField(
            model_name='smslog',
            name='status',
            field=models.CharField(
                choices=[
                    ('queued', 'Queued'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                    ('dry_run', 'Dry Run'),
                ],
                default='queued',
                max_length=10,
            ),
        ),
        # Add message_id field
        migrations.AddField(
            model_name='smslog',
            name='message_id',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        # Add error field
        migrations.AddField(
            model_name='smslog',
            name='error',
            field=models.TextField(blank=True, null=True),
        ),
    ]
