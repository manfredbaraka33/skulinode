from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_alter_school_school_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='show_logo',
            field=models.BooleanField(
                default=True,
                help_text='When enabled, the school logo appears on printed reports and PDFs.',
                verbose_name='Show Logo on Documents',
            ),
        ),
    ]
