from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academy', '0003_smslog_resultspublication'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stream',
            name='name',
            field=models.CharField(
                blank=True,
                help_text='e.g. A, B, East — leave blank for no stream',
                max_length=50,
                verbose_name='Stream Name',
            ),
        ),
    ]
