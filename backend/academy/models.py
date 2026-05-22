from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class TenantModel(models.Model):
    """Abstract base model that binds every record to a School (tenant)."""

    school = models.ForeignKey(
        'core.School',
        on_delete=models.CASCADE,
        related_name='%(class)s_records',
        verbose_name='School',
    )

    class Meta:
        abstract = True


class ClassLevel(TenantModel):
    """A year/form level within a school (e.g. Form 1, Standard 3)."""

    class Level(models.TextChoices):
        PRIMARY = 'PRIMARY', 'Primary'
        SECONDARY_O = 'SECONDARY_O', 'Secondary O-Level'
        SECONDARY_A = 'SECONDARY_A', 'Secondary A-Level'

    name = models.CharField(
        max_length=100,
        verbose_name='Class Name',
        help_text='e.g. Form 1, Standard 3',
    )
    code = models.CharField(
        max_length=20,
        verbose_name='Class Code',
        help_text='e.g. F1, STD3',
    )
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        verbose_name='Level',
    )

    class Meta:
        ordering = ['school', 'level', 'name']
        verbose_name = 'Class Level'
        verbose_name_plural = 'Class Levels'
        unique_together = [('school', 'code')]

    def __str__(self):
        return f"{self.name} ({self.code}) — {self.school}"


class Stream(TenantModel):
    """A class stream/section (Mkondo) within a ClassLevel (e.g. Form 1A)."""

    name = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Stream Name',
        help_text='e.g. A, B, East — leave blank for no stream',
    )
    class_level = models.ForeignKey(
        ClassLevel,
        on_delete=models.CASCADE,
        related_name='streams',
        verbose_name='Class Level',
    )

    class Meta:
        ordering = ['class_level', 'name']
        verbose_name = 'Mkondo'
        verbose_name_plural = 'Mikondo'
        unique_together = [('school', 'class_level', 'name')]

    def __str__(self):
        return f"{self.class_level.name} {self.name} — {self.school}"


class Subject(TenantModel):
    """An academic subject offered by a school (e.g. Physics, Kiswahili)."""

    name = models.CharField(
        max_length=150,
        verbose_name='Subject Name',
        help_text='e.g. Physics, Kiswahili',
    )
    code = models.CharField(
        max_length=20,
        verbose_name='Subject Code',
        help_text='e.g. PHY, KIS',
    )

    class Meta:
        ordering = ['school', 'name']
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'
        unique_together = [('school', 'code')]

    def __str__(self):
        return f"{self.name} ({self.code}) — {self.school}"


class Assessment(TenantModel):
    """An exam/test event created by the admin (e.g. Mid-term Test, Annual Exam)."""

    name = models.CharField(max_length=100, verbose_name='Assessment Name')
    academic_year = models.PositiveIntegerField(default=2026, verbose_name='Academic Year')
    is_active = models.BooleanField(
        default=False,
        verbose_name='Is Active',
        help_text='Only active assessments are visible for mark entry.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['academic_year', 'name']
        verbose_name = 'Assessment'
        verbose_name_plural = 'Assessments'
        unique_together = [('school', 'name', 'academic_year')]

    def __str__(self):
        return f"{self.name} ({self.academic_year})"


class Student(TenantModel):
    """A student enrolled in the school."""

    GENDER = [('M', 'Male'), ('F', 'Female')]

    first_name = models.CharField(max_length=100, verbose_name='First Name')
    middle_name = models.CharField(max_length=100, blank=True, verbose_name='Middle Name')
    last_name = models.CharField(max_length=100, verbose_name='Last Name')
    gender = models.CharField(max_length=1, choices=GENDER, verbose_name='Gender')
    parent_phone = models.CharField(max_length=20, blank=True, verbose_name='Parent Phone')
    stream = models.ForeignKey(
        Stream,
        on_delete=models.CASCADE,
        related_name='students',
        verbose_name='Class/Stream',
    )
    admission_number = models.CharField(max_length=50, blank=True, verbose_name='Admission No.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['stream', 'last_name', 'first_name']
        verbose_name = 'Student'
        verbose_name_plural = 'Students'

    @property
    def full_name(self):
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return ' '.join(parts)

    @property
    def display_name(self):
        """Juma A. Said format."""
        if self.middle_name:
            return f"{self.first_name} {self.middle_name[0]}. {self.last_name}"
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name


class StudentSubjectExclusion(TenantModel):
    """Records subjects a student does NOT take (all stream subjects taken by default)."""

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exclusions')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)

    class Meta:
        unique_together = [('school', 'student', 'subject')]
        verbose_name = 'Subject Exclusion'
        verbose_name_plural = 'Subject Exclusions'

    def __str__(self):
        return f"{self.student} excluded from {self.subject.name}"


class Mark(TenantModel):
    """A student's score for a subject in an assessment."""

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='marks')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='marks')
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='marks')
    teacher = models.ForeignKey(
        'core.CustomUser', on_delete=models.SET_NULL, null=True, related_name='entered_marks'
    )
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_submitted = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_returned = models.BooleanField(
        default=False,
        verbose_name='Returned by Admin',
        help_text='Admin has unlocked these marks for correction by the teacher.',
    )

    class Meta:
        unique_together = [('school', 'student', 'subject', 'assessment')]
        ordering = ['student__last_name', 'student__first_name']
        verbose_name = 'Mark'
        verbose_name_plural = 'Marks'

    def get_grade(self):
        if self.score is None:
            return '-'
        s = float(self.score)
        if s >= 75: return 'A'
        if s >= 65: return 'B'
        if s >= 50: return 'C'
        if s >= 30: return 'D'
        return 'F'

    def get_gpa(self):
        return {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5}.get(self.get_grade())

    def __str__(self):
        return f"{self.student} — {self.subject.name} — {self.get_grade()}"


class SubjectAssignment(TenantModel):
    """Assigns a teacher to a subject for a specific stream and academic year."""

    teacher = models.ForeignKey(
        'core.CustomUser',
        on_delete=models.CASCADE,
        related_name='subject_assignments',
        verbose_name='Teacher',
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='assignments',
        verbose_name='Subject',
    )
    stream = models.ForeignKey(
        Stream,
        on_delete=models.CASCADE,
        related_name='assignments',
        verbose_name='Mkondo (Stream)',
    )
    academic_year = models.PositiveIntegerField(
        default=2026,
        verbose_name='Academic Year',
    )

    class Meta:
        ordering = ['academic_year', 'stream', 'subject']
        verbose_name = 'Subject Assignment'
        verbose_name_plural = 'Subject Assignments'
        unique_together = [('school', 'teacher', 'subject', 'stream', 'academic_year')]

    def clean(self):
        """Ensure teacher, subject, and stream all belong to the same school."""
        errors = {}
        if self.teacher_id and self.teacher.school_id != self.school_id:
            errors['teacher'] = 'Teacher does not belong to this school.'
        if self.subject_id and self.subject.school_id != self.school_id:
            errors['subject'] = 'Subject does not belong to this school.'
        if self.stream_id and self.stream.school_id != self.school_id:
            errors['stream'] = 'Stream does not belong to this school.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.teacher} → {self.subject.name} / {self.stream} "
            f"({self.academic_year})"
        )


class ResultsPublication(TenantModel):
    """Records that an admin has published results for a stream+assessment."""

    assessment = models.ForeignKey(
        Assessment, on_delete=models.CASCADE, related_name='publications'
    )
    stream = models.ForeignKey(
        Stream, on_delete=models.CASCADE, related_name='publications'
    )
    published_by = models.ForeignKey(
        'core.CustomUser', on_delete=models.SET_NULL, null=True, related_name='publications'
    )
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('school', 'assessment', 'stream')]
        verbose_name = 'Results Publication'
        verbose_name_plural = 'Results Publications'

    def __str__(self):
        return f"{self.assessment} / {self.stream} published"


class GradeConfig(TenantModel):
    """
    Per-school grade boundaries.  If none exist the system falls back to
    NECTA defaults (see grading.NECTA_DEFAULTS).

    Admins can freely define any grade label (e.g. A, B+, C, D, E, F).
    """

    grade_label = models.CharField(max_length=10, verbose_name='Grade')
    min_score   = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Min Score')
    max_score   = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Max Score')
    points      = models.PositiveSmallIntegerField(
        verbose_name='Points',
        help_text='GPA points for this grade (NECTA O-Level: A=1, B=2, C=3, D=4, F=5)',
    )
    remarks     = models.CharField(max_length=50, blank=True, verbose_name='Remarks')

    class Meta:
        unique_together  = [('school', 'grade_label')]
        ordering         = ['-min_score']
        verbose_name     = 'Grade Configuration'
        verbose_name_plural = 'Grade Configurations'

    def __str__(self):
        return f"{self.grade_label} ({self.min_score}–{self.max_score}) [{self.school}]"


class SMSLog(TenantModel):
    """Tracks SMS messages sent to parents."""

    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('dry_run', 'Dry Run'),
    ]

    # school overridden to allow logging without a tenant context
    school = models.ForeignKey(
        'core.School',
        on_delete=models.CASCADE,
        related_name='smslog_records',
        verbose_name='School',
        null=True,
        blank=True,
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='sms_logs',
        null=True, blank=True,
    )
    assessment = models.ForeignKey(
        Assessment, on_delete=models.SET_NULL, null=True, blank=True
    )
    parent_phone = models.CharField(max_length=20)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='queued')
    message_id = models.CharField(max_length=100, null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'SMS Log'
        verbose_name_plural = 'SMS Logs'

    def __str__(self):
        return f"SMS to {self.parent_phone} [{self.status}]"
