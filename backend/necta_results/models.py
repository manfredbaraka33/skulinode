from django.db import models


class ExamSession(models.Model):
    EXAM_LEVELS = [
        ('ACSEE', 'ACSEE (Form 6)'),
        ('CSEE',  'CSEE (Form 4)'),
        ('PSLE',  'PSLE (Standard 7)'),
        ('FTNA',  'FTNA (Form 2)'),
    ]
    exam_level   = models.CharField(max_length=10, choices=EXAM_LEVELS)
    year         = models.PositiveSmallIntegerField()
    is_published = models.BooleanField(default=False)
    imported_at  = models.DateTimeField(auto_now_add=True)
    kpi_data     = models.JSONField(default=dict, blank=True)
    source_base_url = models.URLField(
        blank=True,
        help_text='e.g. https://onlinesys.necta.go.tz/results/2025/csee/ — '
                   'NECTA has changed domains across years; set this manually per '
                   'session at import time. Leave blank to hide the source link entirely.'
    )

    class Meta:
        unique_together = ['exam_level', 'year']
        ordering = ['-year']

    def __str__(self):
        return f'{self.exam_level} {self.year}'


class SchoolCenter(models.Model):
    CENTER_TYPES = [('SCHOOL', 'School'), ('PRIVATE', 'Private Candidates')]

    exam_session    = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='centers')
    center_id       = models.CharField(max_length=20, db_index=True)
    center_name     = models.CharField(max_length=300)
    center_type     = models.CharField(max_length=10, choices=CENTER_TYPES)
    region          = models.CharField(max_length=100, db_index=True)
    region_verified = models.BooleanField(default=False)
    district        = models.CharField(max_length=100, blank=True, db_index=True)
    district_known  = models.BooleanField(default=False)

    # ownership_type = models.CharField(
    #     max_length=15,
    #     choices=[('GOVERNMENT', 'Government'), ('PRIVATE', 'Private'), ('UNKNOWN', 'Unknown')],
    #     default='UNKNOWN',
    #     db_index=True,
    # )

    registered_total = models.IntegerField(null=True)
    absent_total     = models.IntegerField(null=True)
    sat_total        = models.IntegerField(null=True)
    withheld_total   = models.IntegerField(null=True)
    clean_total      = models.IntegerField(null=True)
    total_passed     = models.IntegerField(null=True)
    total_failed     = models.IntegerField(null=True)

    center_gpa   = models.FloatField(null=True, db_index=True)
    grade_letter = models.CharField(max_length=2, blank=True)
    grade_label  = models.CharField(max_length=30, blank=True)
    pass_rate    = models.FloatField(null=True)
    div1_rate    = models.FloatField(null=True)

    div_1_female = models.IntegerField(default=0)
    div_2_female = models.IntegerField(default=0)
    div_3_female = models.IntegerField(default=0)
    div_4_female = models.IntegerField(default=0)
    div_0_female = models.IntegerField(default=0)
    div_1_male   = models.IntegerField(default=0)
    div_2_male   = models.IntegerField(default=0)
    div_3_male   = models.IntegerField(default=0)
    div_4_male   = models.IntegerField(default=0)
    div_0_male   = models.IntegerField(default=0)
    div_1_total  = models.IntegerField(default=0)
    div_2_total  = models.IntegerField(default=0)
    div_3_total  = models.IntegerField(default=0)
    div_4_total  = models.IntegerField(default=0)
    div_0_total  = models.IntegerField(default=0)

    sat_female       = models.IntegerField(default=0)
    sat_male         = models.IntegerField(default=0)
    pass_female      = models.IntegerField(default=0)
    pass_male        = models.IntegerField(default=0)
    pass_rate_female = models.FloatField(null=True)
    pass_rate_male   = models.FloatField(null=True)

    is_rankable   = models.BooleanField(default=False)
    national_rank = models.IntegerField(null=True, db_index=True)
    regional_rank = models.IntegerField(null=True)
    district_rank = models.IntegerField(null=True)

    center_url = models.URLField(blank=True)

    class Meta:
        unique_together = ['exam_session', 'center_id']
        indexes = [
            models.Index(fields=['exam_session', 'is_rankable', 'center_gpa']),
            models.Index(fields=['exam_session', 'region', 'center_gpa']),
            models.Index(fields=['exam_session', 'region', 'district', 'center_gpa']),
        ]

    def __str__(self):
        return f'{self.center_id} — {self.center_name}'


class SubjectResult(models.Model):
    """Raw center-subject rows."""
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='subject_results')
    center       = models.ForeignKey(SchoolCenter, on_delete=models.CASCADE, related_name='subjects', null=True)
    raw_center_id    = models.CharField(max_length=20, db_index=True)
    subject_code = models.CharField(max_length=10, blank=True)
    subject_name = models.CharField(max_length=150, db_index=True)
    registered   = models.IntegerField(null=True)
    sat          = models.IntegerField(null=True)
    subject_gpa  = models.FloatField(null=True)
    dropout_rate = models.FloatField(null=True)

    class Meta:
        indexes = [models.Index(fields=['exam_session', 'subject_name'])]


class NationalSubjectStat(models.Model):
    """Subject-centric: how the SUBJECT performed nationally."""
    exam_session     = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='subject_stats')
    subject_name     = models.CharField(max_length=150, db_index=True)
    total_registered = models.IntegerField()
    total_sat        = models.IntegerField()
    weighted_gpa     = models.FloatField(null=True)
    avg_dropout_rate = models.FloatField(null=True)
    centers_offering = models.IntegerField()
    national_rank    = models.IntegerField(null=True)

    class Meta:
        unique_together = ['exam_session', 'subject_name']


class RegionalSubjectStat(models.Model):
    """Subject-centric aggregate, split by region."""
    exam_session     = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='regional_subject_stats')
    region           = models.CharField(max_length=100, db_index=True)
    subject_name     = models.CharField(max_length=150, db_index=True)
    total_registered = models.IntegerField()
    total_sat        = models.IntegerField()
    weighted_gpa     = models.FloatField(null=True)
    regional_rank    = models.IntegerField(null=True)

    class Meta:
        unique_together = ['exam_session', 'region', 'subject_name']


class SubjectSchoolRanking(models.Model):
    """
    School-centric: which SCHOOLS excel at a given subject.
    Powers "Top 10 schools in Biology — national/regional/district".
    """
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='subject_school_rankings')
    center       = models.ForeignKey(SchoolCenter, on_delete=models.CASCADE, related_name='subject_rankings', null=True)
    raw_center_id    = models.CharField(max_length=20, db_index=True)
    subject_name = models.CharField(max_length=150, db_index=True)
    region       = models.CharField(max_length=100, db_index=True)
    district     = models.CharField(max_length=100, blank=True, db_index=True)

    subject_gpa = models.FloatField()
    sat         = models.IntegerField(null=True)
    registered  = models.IntegerField(null=True)

    national_subject_rank = models.IntegerField(null=True, db_index=True)
    regional_subject_rank = models.IntegerField(null=True)
    district_subject_rank = models.IntegerField(null=True)

    class Meta:
        unique_together = ['exam_session', 'center_id', 'subject_name']
        indexes = [
            models.Index(fields=['exam_session', 'subject_name', 'national_subject_rank']),
            models.Index(fields=['exam_session', 'subject_name', 'region', 'regional_subject_rank']),
            models.Index(fields=['exam_session', 'subject_name', 'region', 'district', 'district_subject_rank']),
        ]


class RegionalSummary(models.Model):
    exam_session  = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='regional_summaries')
    region        = models.CharField(max_length=100, db_index=True)
    school_count  = models.IntegerField()
    total_sat     = models.IntegerField()
    total_passed  = models.IntegerField()
    weighted_gpa  = models.FloatField(null=True)
    pass_rate     = models.FloatField(null=True)
    div1_count    = models.IntegerField()
    national_rank = models.IntegerField(null=True)

    class Meta:
        unique_together = ['exam_session', 'region']


class DistrictSummary(models.Model):
    exam_session  = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='district_summaries')
    region        = models.CharField(max_length=100, db_index=True)
    district      = models.CharField(max_length=100, db_index=True)
    school_count  = models.IntegerField()
    total_sat     = models.IntegerField()
    total_passed  = models.IntegerField()
    weighted_gpa  = models.FloatField(null=True)
    pass_rate     = models.FloatField(null=True)
    div1_count    = models.IntegerField()
    national_rank = models.IntegerField(null=True)

    class Meta:
        unique_together = ['exam_session', 'region', 'district']




# class OwnershipSummary(models.Model):
#     """
#     Government vs Private aggregate per session. Rows will initially all be
#     'UNKNOWN' until ownership_type is populated by the scraper — the model
#     and pipeline are ready for real data the moment it arrives, no rework needed.
#     """
#     exam_session   = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='ownership_summaries')
#     ownership_type = models.CharField(max_length=15)
#     school_count   = models.IntegerField()
#     total_sat      = models.IntegerField()
#     weighted_gpa   = models.FloatField(null=True)
#     pass_rate      = models.FloatField(null=True)

#     class Meta:
#         unique_together = ['exam_session', 'ownership_type']