from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_school_show_logo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='school',
            name='show_logo',
            field=models.BooleanField(
                default=False,
                help_text='When enabled, the school logo appears on printed reports and PDFs.',
                verbose_name='Show Logo on Documents',
            ),
        ),
    ]
