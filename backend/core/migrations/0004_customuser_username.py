import django.contrib.auth.validators
from django.db import migrations, models


def populate_usernames(apps, schema_editor):
    """Set username = email-prefix for every existing user. Append a counter on collision."""
    CustomUser = apps.get_model('core', 'CustomUser')
    used = set()
    # Process in a deterministic order so collisions are resolved consistently.
    for user in CustomUser.objects.order_by('id'):
        base = (user.email or '').split('@')[0].lower()
        # Strip characters not allowed by UnicodeUsernameValidator.
        base = ''.join(c for c in base if c.isalnum() or c in '._+-@') or 'user'
        username = base
        counter = 1
        while username in used:
            username = f'{base}{counter}'
            counter += 1
        user.username = username
        user.save(update_fields=['username'])
        used.add(username)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_customuser_roles_school_email_school_logo_and_more'),
    ]

    operations = [
        # 1. Add the column as nullable so existing rows don't violate NOT NULL.
        migrations.AddField(
            model_name='customuser',
            name='username',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        # 2. Backfill from email prefixes.
        migrations.RunPython(populate_usernames, migrations.RunPython.noop),
        # 3. Tighten to unique + not-null (matches AbstractUser definition).
        migrations.AlterField(
            model_name='customuser',
            name='username',
            field=models.CharField(
                error_messages={'unique': 'A user with that username already exists.'},
                max_length=150,
                unique=True,
                validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                verbose_name='username',
            ),
        ),
    ]
