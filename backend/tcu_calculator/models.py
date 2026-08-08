from django.db import models


class TCUAdmissionCycle(models.Model):
    """One row per academic year's guidebook import (e.g. '2026/2027')."""
    academic_year = models.CharField(max_length=20, unique=True)
    is_published  = models.BooleanField(default=False)
    imported_at   = models.DateTimeField(auto_now_add=True)
    guidebook_pdf = models.FileField(upload_to='tcu_guidebooks/', null=True, 
                                     max_length=255,
                                     blank=True,
                                     help_text='The official TCU admission guidebook PDF for this cycle')
    
    insights_data = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-academic_year']

    def __str__(self):
        return f'TCU Cycle {self.academic_year}'


class TCUInstitution(models.Model):
    cycle    = models.ForeignKey(TCUAdmissionCycle, on_delete=models.CASCADE, related_name='institutions')
    name     = models.CharField(max_length=300, db_index=True)
    location = models.CharField(max_length=150, blank=True)

    OWNERSHIP_CHOICES = [
        ('GOVERNMENT', 'Serikali'), ('PRIVATE', 'Binafsi'), ('UNKNOWN', 'Haijulikani'),
    ]
    ownership       = models.CharField(max_length=15, choices=OWNERSHIP_CHOICES, default='UNKNOWN')
    application_url = models.URLField(null=True, blank=True)

    class Meta:
        unique_together = ['cycle', 'name','location']
        ordering = ['name']

    def __str__(self):
        return f'{self.name}, {self.location}-({self.cycle})' if self.location else self.name


class TCUProgramme(models.Model):
    STATUS_CHOICES = [
        ('ok', 'OK'),
        ('incomplete_source', 'Incomplete Source'),
        ('needs_review', 'Needs Review'),
    ]

    CATEGORY_CHOICES = [
        ('ELIMU',      'Elimu'),
        ('AFYA',       'Afya na Sayansi ya Tiba'),
        ('UHANDISI',   'Uhandisi na Teknolojia'),
        ('BIASHARA',   'Biashara na Uchumi'),
        ('SHERIA',     'Sheria'),
        ('KILIMO',     'Kilimo na Mifugo'),
        ('JAMII',      'Sayansi ya Jamii na Binadamu'),
        ('SANAA',      'Sanaa na Ubunifu'),
        ('TEHAMA',     'TEHAMA'),
        ('UTAWALA',    'Utawala wa Umma'),
        ('NYINGINE',   'Nyingine'),
    ]

    institution   = models.ForeignKey(TCUInstitution, on_delete=models.CASCADE, related_name='programmes')
    programme_name = models.CharField(max_length=300, db_index=True)
    programme_code  = models.CharField(max_length=30, blank=True)
    min_points_total = models.FloatField(null=True, blank=True)
    capacity        = models.IntegerField(null=True, blank=True)
    duration_years  = models.IntegerField(null=True, blank=True)
    category        = models.CharField(max_length=15, choices=CATEGORY_CHOICES, blank=True, default='')

    # List of {"subjects": [...], "count_needed": int, "min_grade": str|null}
    slots = models.JSONField(default=list)

    raw_requirement_text     = models.TextField(blank=True)
    status                   = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ok')
    matched_health_override  = models.CharField(max_length=100, blank=True)
    health_override_mismatch = models.BooleanField(default=False)
    override_note            = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['institution', 'status']),
            models.Index(fields=['status', 'min_points_total']),
        ]
        ordering = ['institution__name', 'programme_name']

    def __str__(self):
        return f'{self.programme_name} @ {self.institution.name}'