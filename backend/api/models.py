from django.db import models
from core.models import School


class Feedback(models.Model):
    """Feedback submitted by school users to the SkuliNode platform team."""

    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    school = models.ForeignKey(
        School,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback',
        verbose_name='School',
    )
    name = models.CharField(max_length=150, blank=True, verbose_name='Sender Name')
    email = models.EmailField(blank=True, verbose_name='Sender Email')
    subject = models.CharField(max_length=200, blank=True, verbose_name='Subject')
    message = models.TextField(verbose_name='Message')
    rating = models.IntegerField(
        choices=RATING_CHOICES,
        null=True,
        blank=True,
        verbose_name='Rating (1–5)',
        help_text='Optional star rating from 1 (poor) to 5 (excellent).',
    )
    submitted_at = models.DateTimeField(auto_now_add=True, verbose_name='Submitted At')

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = 'Feedback'
        verbose_name_plural = 'Feedback'

    def __str__(self):
        school_name = self.school.name if self.school else 'Unknown'
        return f"{school_name} — {self.subject or 'No subject'} ({self.submitted_at:%Y-%m-%d})"
