from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academy', '0006_gradeconfig'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gradeconfig',
            name='grade_label',
            field=models.CharField(max_length=10, verbose_name='Grade'),
        ),
    ]
