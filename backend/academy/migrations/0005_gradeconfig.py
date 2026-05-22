from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academy', '0004_stream_name_blank'),
        ('core', '0003_customuser_roles_school_email_school_logo_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='GradeConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('school', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='gradeconfig_records',
                    to='core.school',
                    verbose_name='School',
                )),
                ('grade_label', models.CharField(
                    choices=[('A','A'),('B','B'),('C','C'),('D','D'),('E','E'),('F','F')],
                    max_length=2,
                    verbose_name='Grade',
                )),
                ('min_score', models.DecimalField(decimal_places=2, max_digits=5, verbose_name='Min Score')),
                ('max_score', models.DecimalField(decimal_places=2, max_digits=5, verbose_name='Max Score')),
                ('points', models.PositiveSmallIntegerField(
                    help_text='GPA points for this grade (NECTA O-Level: A=1, B=2, C=3, D=4, F=5)',
                    verbose_name='Points',
                )),
                ('remarks', models.CharField(blank=True, max_length=50, verbose_name='Remarks')),
            ],
            options={
                'verbose_name': 'Grade Configuration',
                'verbose_name_plural': 'Grade Configurations',
                'ordering': ['-min_score'],
                'unique_together': {('school', 'grade_label')},
            },
        ),
    ]
