from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academy', '0007_alter_gradeconfig_grade_label'),
    ]

    operations = [
        migrations.AddField(
            model_name='mark',
            name='is_returned',
            field=models.BooleanField(
                default=False,
                help_text='Admin has unlocked these marks for correction by the teacher.',
                verbose_name='Returned by Admin',
            ),
        ),
    ]
