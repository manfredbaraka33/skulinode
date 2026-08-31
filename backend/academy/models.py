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
    counts_in_division = models.BooleanField(
        default=True,
        verbose_name='Counts in Division',
        help_text='Uncheck for subsidiary subjects (e.g. GS, BAM) that do not count in A-Level division.',
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
        'academy.Student',
        on_delete=models.CASCADE,
        related_name='sms_logs',
        null=True,
        blank=True,
    )
    assessment = models.ForeignKey(
        'academy.Assessment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
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




# ── Comment System ────────────────────────────────────────────────────────────

SYSTEM_COMMENT_TEMPLATES = {
    'class_teacher': [
        {'min': 75, 'max': 100, 'text': "Hongera {name}! Umefanya vizuri muhula huu. Endelea kudumisha juhudi katika {best_subject} na {weak_subject}."},
        {'min': 65, 'max': 74,  'text': "Kazi nzuri {name}. Una uwezo wa kufanya vizuri zaidi, ongeza bidii katika {weak_subject}."},
        {'min': 50, 'max': 64,  'text': "{name} una uwezo mzuri. Ukiongeza juhudi na umakini zaidi katika {weak_subject}, utafanikiwa."},
        {'min': 30, 'max': 49,  'text': "{name} unashauriwa kuongeza bidii na ushirikiano mzuri katika masomo yako muhula ujao."},
        {'min': 0,  'max': 29,  'text': "{name} anahitaji kuweka juhudi za ziada na umakini mkubwa zaidi katika masomo yake."},
    ],
    'academic_master': [
        {'min': 75, 'max': 100, 'text': "Matokeo mazuri. {name} amepata wastani wa {avg}%. Endelea na moyo huo muhula ujao."},
        {'min': 65, 'max': 74,  'text': "Matokeo ya kuridhisha. Wastani wa {avg}% unaonyesha uwezo na fursa ya kufanya vizuri zaidi."},
        {'min': 50, 'max': 64,  'text': "Wastani wa {avg}%. {name} ana nafasi kubwa ya kuboresha matokeo yake akiongeza juhudi."},
        {'min': 30, 'max': 49,  'text': "Wastani wa {avg}%. Anahimizwa kuongeza bidii ili kufikia viwango vya juu zaidi."},
        {'min': 0,  'max': 29,  'text': "Wastani wa {avg}%. Anahitaji usimamizi wa karibu na juhudi binafsi ili kuboresha matokeo."},
    ],
    'headmaster': [
        {'min': 75, 'max': 100, 'text': "Pongezi kwa {name} kwa kushika nafasi ya {position} kati ya {total}. Endelea na juhudi hizi."},
        {'min': 65, 'max': 74,  'text': "Hongera {name} kwa nafasi ya {position} kati ya {total}. Tunakutakia mafanikio mema zaidi."},
        {'min': 50, 'max': 64,  'text': "{name} ameshika nafasi ya {position} kati ya {total}. Tunaamini ataendelea kupiga hatua."},
        {'min': 30, 'max': 49,  'text': "{name} ameshika nafasi ya {position} kati ya {total}. Anatiwa moyo kuongeza bidii muhula ujao."},
        {'min': 0,  'max': 29,  'text': "{name} ameshika nafasi ya {position} kati ya {total}. Anahimizwa kuweka umakini zaidi masomoni."},
    ],
}


def render_comment(template_text, student_name='', avg=None, grade=None,
                   best_subject=None, weak_subject=None, division=None,
                   points=None, position=None, total=None):
    """Replace {variables} in a template with actual student data."""
    t = template_text or ''
    t = t.replace('{name}',         student_name or '')
    t = t.replace('{avg}',          str(round(float(avg), 1)) if avg is not None else '-')
    t = t.replace('{grade}',        grade or '-')
    t = t.replace('{best_subject}', best_subject or '-')
    t = t.replace('{weak_subject}', weak_subject or '-')
    t = t.replace('{division}',     division or '-')
    t = t.replace('{points}',       str(int(points)) if points is not None else '-')
    t = t.replace('{position}',     str(position) if position is not None else '-')
    t = t.replace('{total}',        str(total) if total is not None else '-')
    return t


class CommentTemplate(TenantModel):
    """Per-user customised comment template for a score band + role."""
    ROLE_CHOICES = [
        ('class_teacher',  'Class Teacher'),
        ('academic_master', 'Academic Master'),
        ('headmaster',     'Head Master'),
    ]
    created_by    = models.ForeignKey('core.CustomUser', on_delete=models.CASCADE,
                                      related_name='comment_templates')
    role          = models.CharField(max_length=30, choices=ROLE_CHOICES)
    min_score     = models.DecimalField(max_digits=5, decimal_places=2)
    max_score     = models.DecimalField(max_digits=5, decimal_places=2)
    template_text = models.TextField(
        help_text='Variables: {name} {avg} {grade} {best_subject} {weak_subject} '
                  '{division} {points} {position} {total}'
    )

    class Meta:
        unique_together     = [('school', 'created_by', 'role', 'min_score')]
        ordering            = ['-min_score']
        verbose_name        = 'Comment Template'
        verbose_name_plural = 'Comment Templates'

    def __str__(self):
        return f'{self.role} ({self.min_score}–{self.max_score}%)'


class StudentComment(TenantModel):
    """Stored comment for one student × assessment × role (Level 3 = manual)."""
    ROLE_CHOICES = [
        ('class_teacher',  'Class Teacher'),
        ('academic_master', 'Academic Master'),
        ('headmaster',     'Head Master'),
    ]
    student      = models.ForeignKey(Student,    on_delete=models.CASCADE, related_name='comments')
    assessment   = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='comments',
                                     null=True, blank=True)
    snapshot     = models.ForeignKey('CombinedResultsSnapshot', on_delete=models.CASCADE,
                                     null=True, blank=True, related_name='student_comments',
                                     help_text='Set when comment belongs to combined snapshot.')
    role         = models.CharField(max_length=30, choices=ROLE_CHOICES)
    comment_text = models.TextField()
    is_manual    = models.BooleanField(default=False,
                                       help_text='True when manually overridden by the role.')
    created_by   = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL,
                                     null=True, related_name='written_comments')
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['student__last_name', 'student__first_name']
        verbose_name        = 'Student Comment'
        verbose_name_plural = 'Student Comments'

    def __str__(self):
        return f'[{self.role}] {self.student} — {self.assessment}'



# ── Finance Module (TZ Context) ───────────────────────────────────────────────

class FeeDefinition(TenantModel):
    """
    Defines one type of fee or contribution for a school year.
    ADA     = school fees paid in awamu (installments/phases)
    MCHANGO = flat one-time contribution (exam fee, library, sports, etc.)
    """
    CATEGORY = [('ADA', 'Ada ya Shule'), ('MCHANGO', 'Mchango Mwingine')]
    APPLIES  = [('ALL', 'Wanafunzi Wote'), ('STREAM', 'Mkondo Maalum')]

    name          = models.CharField(max_length=200,
                                     help_text='e.g. Ada ya Shule 2026, Ada ya Mtihani')
    category      = models.CharField(max_length=10, choices=CATEGORY, default='ADA')
    academic_year = models.PositiveIntegerField(default=2026)
    applies_to    = models.CharField(max_length=10, choices=APPLIES, default='ALL')
    stream        = models.ForeignKey('academy.Stream', on_delete=models.SET_NULL,
                                      null=True, blank=True,
                                      help_text='Set only when applies_to=STREAM')
    notes         = models.TextField(blank=True)
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ['-academic_year', 'category', 'name']
        verbose_name = 'Fee Definition'

    def __str__(self):
        return f'{self.name} ({self.academic_year}) [{self.get_category_display()}]'


class FeePhase(TenantModel):
    """
    An installment (awamu) of an ADA-type FeeDefinition.
    MCHANGO definitions skip phases — the amount is on the definition itself via
    a single auto-created phase named 'Mchango'.
    """
    definition = models.ForeignKey(FeeDefinition, on_delete=models.CASCADE,
                                   related_name='phases')
    name       = models.CharField(max_length=100,
                                   help_text='e.g. Awamu ya Kwanza, Muhula 1')
    amount     = models.DecimalField(max_digits=12, decimal_places=2)
    due_date   = models.DateField(null=True, blank=True)
    order      = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering        = ['definition', 'order']
        unique_together = [('school', 'definition', 'name')]
        verbose_name    = 'Fee Phase / Awamu'

    def __str__(self):
        return f'{self.definition.name} — {self.name} (TZS {self.amount})'

    @property
    def can_edit_amount(self):
        """True only if no payments have been recorded yet."""
        return not self.records.filter(amount_paid__gt=0).exists()


class StudentFeeRecord(TenantModel):
    """
    Tracks one student's payment progress for one phase (or one mchango).
    ADA:     one record per student per phase
    MCHANGO: one record per student per definition (phase = single auto phase)
    """
    student           = models.ForeignKey(Student, on_delete=models.CASCADE,
                                           related_name='fee_records')
    definition        = models.ForeignKey(FeeDefinition, on_delete=models.PROTECT,
                                           related_name='records',null=True, blank=True)
    phase             = models.ForeignKey(FeePhase, on_delete=models.PROTECT,
                                           related_name='records',null=True, blank=True)
    amount_expected   = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_payment_date = models.DateField(null=True, blank=True)
    recorded_by       = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL,
                                           null=True, blank=True)
    notes             = models.TextField(blank=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('school', 'student', 'phase')]
        ordering        = ['student__last_name', 'definition__category', 'phase__order']
        verbose_name    = 'Student Fee Record'

    @property
    def balance(self):
        return self.amount_expected - self.amount_paid

    def __str__(self):
        # Safely get names, providing defaults if None
        def_name = self.definition.name if self.definition else "No Definition"
        phase_name = self.phase.name if self.phase else "No Phase"
        return f'{self.student} — {def_name} / {phase_name} — bal {self.balance}'




# ── Class Master Assignments ──────────────────────────────────────────────────

class ClassMasterAssignment(TenantModel):
    """One teacher is class master per stream per academic year."""
    teacher = models.ForeignKey(
        'core.CustomUser', on_delete=models.CASCADE,
        related_name='class_master_assignments',
    )
    stream = models.ForeignKey(
        Stream, on_delete=models.CASCADE,
        related_name='class_master_assignments',
    )
    academic_year = models.PositiveIntegerField(default=2026)

    class Meta:
        unique_together = [('school', 'stream', 'academic_year')]
        ordering = ['stream__class_level__name', 'stream__name']
        verbose_name = 'Class Master Assignment'

    def __str__(self):
        return f'{self.teacher} → {self.stream} ({self.academic_year})'


# ── Combined Results Snapshots ────────────────────────────────────────────────

class CombinedResultsSnapshot(TenantModel):
    """Stored snapshot of published combined results — avoids re-entering weights."""
    name          = models.CharField(max_length=200)
    stream        = models.ForeignKey(Stream, on_delete=models.CASCADE,
                                      related_name='combined_snapshots')
    academic_year = models.PositiveIntegerField(default=2026)
    components    = models.JSONField(default=list)   # [{id, name, weight}]
    subjects      = models.JSONField(default=list)   # ordered subject names
    treat_missing_as_zero = models.BooleanField(default=False)
    school_type   = models.CharField(max_length=20, default='ORDINARY')
    published_by  = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL,
                                       null=True, related_name='combined_snapshots')
    created_at    = models.DateTimeField(auto_now_add=True)
    is_published  = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Combined Results Snapshot'

    def __str__(self):
        return f'{self.name} — {self.stream}'


class CombinedStudentSnapshot(TenantModel):
    """Per-student result within a CombinedResultsSnapshot."""
    snapshot     = models.ForeignKey(CombinedResultsSnapshot, on_delete=models.CASCADE,
                                      related_name='student_results')
    student      = models.ForeignKey(Student, on_delete=models.CASCADE,
                                      related_name='combined_snapshots')
    rank         = models.IntegerField(null=True, blank=True)
    total_students = models.IntegerField(default=0)
    total_score  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    average      = models.DecimalField(max_digits=6,  decimal_places=2, null=True, blank=True)
    grade        = models.CharField(max_length=10, blank=True)
    grade_remarks = models.CharField(max_length=100, blank=True)
    points       = models.IntegerField(null=True, blank=True)
    division     = models.CharField(max_length=50, blank=True)
    subject_data = models.JSONField(default=dict)        # {subj_name: {final_score, grade, assessment_scores, ...}}
    assessment_averages = models.JSONField(default=dict) # {assessment_id: {raw_average}}

    class Meta:
        unique_together = [('school', 'snapshot', 'student')]
        ordering = ['rank']
        verbose_name = 'Combined Student Snapshot'



# ── Term Circular ─────────────────────────────────────────────────────────────

class TermCircular(TenantModel):
    """
    A reusable end-of-term circular template.
    Generated as a printable document per student, pulling fee data automatically.
    """
    title         = models.CharField(max_length=200, default='End of Term Circular')
    academic_year = models.PositiveIntegerField(default=2026)
    stream        = models.ForeignKey(Stream, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='circulars',
                                      help_text='Target stream. Leave blank for school-wide.')
    closing_date  = models.DateField(null=True, blank=True)
    opening_date  = models.DateField(null=True, blank=True)
    school_motto  = models.CharField(max_length=300, blank=True)
    items         = models.JSONField(default=list,
                                     help_text='[{heading: str, content: str}, ...]')
    show_fee_statement = models.BooleanField(default=True)
    created_by    = models.ForeignKey('core.CustomUser', on_delete=models.SET_NULL,
                                      null=True, related_name='circulars')
    updated_at    = models.DateTimeField(auto_now=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'Term Circular'

    def __str__(self):
        return f'{self.title} ({self.academic_year}) — {self.school}'