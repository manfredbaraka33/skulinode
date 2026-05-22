from django.core.management.base import BaseCommand

from academy.sms import send_sms


class Command(BaseCommand):
    help = 'Send a test SMS via the configured NextSMS provider.'

    def handle(self, *args, **options):
        phone = '255752303770'
        message = 'SkuliNode test - Uko good Manfred... SMS working!'

        self.stdout.write(f'Sending test SMS to {phone} …')
        result = send_sms(phone, message)
        self.stdout.write(str(result))

        if result['success']:
            self.stdout.write(self.style.SUCCESS('SMS sent successfully.'))
        else:
            self.stdout.write(self.style.ERROR(f'SMS failed: {result["error"]}'))
