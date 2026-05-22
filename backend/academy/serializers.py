from django.utils import timezone
from rest_framework import serializers

from academy.grading import get_grade, get_gpa, get_division, get_grade_comment
from academy.models import (
    Assessment, ClassLevel, GradeConfig, Mark, Stream, Student,
    StudentSubjectExclusion, Subject, SubjectAssignment,
)


# ── GradeConfig ──────────────────────────────────────────────────────────────

class GradeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeConfig
        fields = ['id', 'school', 'grade_label', 'min_score', 'max_score', 'points', 'remarks']
        read_only_fields = ['id']


# ── Lookups ───────────────────────────────────────────────────────────────────

class ClassLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassLevel
        fields = ['id', 'school', 'name', 'code', 'level']
        read_only_fields = ['id']


class StreamSerializer(serializers.ModelSerializer):
    class_level_name = serializers.CharField(source='class_level.name', read_only=True)
    class_level_level = serializers.CharField(source='class_level.level', read_only=True)
    display_label = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Stream
        fields = [
            'id', 'school', 'name', 'class_level', 'class_level_name',
            'class_level_level', 'display_label', 'student_count',
        ]
        read_only_fields = ['id', 'class_level_name', 'class_level_level', 'display_label', 'student_count']

    def get_display_label(self, obj):
        return f"{obj.class_level.name} {obj.name}".strip()

    def get_student_count(self, obj):
        return obj.students.count()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'school', 'name', 'code']
        read_only_fields = ['id']


# ── Assessments ───────────────────────────────────────────────────────────────

class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = ['id', 'school', 'name', 'academic_year', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


# ── Subject Assignments ───────────────────────────────────────────────────────

class SubjectAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    stream_label = serializers.SerializerMethodField()

    class Meta:
        model = SubjectAssignment
        fields = [
            'id', 'school', 'teacher', 'teacher_name',
            'subject', 'subject_name', 'stream', 'stream_label', 'academic_year',
        ]
        read_only_fields = ['id', 'teacher_name', 'subject_name', 'stream_label']

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() or obj.teacher.email

    def get_stream_label(self, obj):
        return f"{obj.stream.class_level.name} {obj.stream.name}".strip()


# ── Students ──────────────────────────────────────────────────────────────────

class StudentSerializer(serializers.ModelSerializer):
    stream_label = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'school', 'first_name', 'middle_name', 'last_name',
            'gender', 'parent_phone', 'stream', 'stream_label',
            'admission_number', 'display_name', 'created_at',
        ]
        read_only_fields = ['id', 'stream_label', 'display_name', 'created_at']

    def get_stream_label(self, obj):
        return f"{obj.stream.class_level.name} {obj.stream.name}".strip()


class StudentSubjectExclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentSubjectExclusion
        fields = ['id', 'school', 'student', 'subject']
        read_only_fields = ['id']


# ── Bulk student upload ─────────────────────────────────────────────────────

class BulkStudentRowSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    middle_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    last_name = serializers.CharField(max_length=100)
    gender = serializers.ChoiceField(choices=[('M', 'M'), ('F', 'F')])
    class_label = serializers.CharField()  # display label, e.g. 'Form I A' or 'Form I'
    admission_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    parent_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')


# ── Marks ─────────────────────────────────────────────────────────────────────

class MarkSerializer(serializers.ModelSerializer):
    grade = serializers.SerializerMethodField()
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_gender = serializers.CharField(source='student.gender', read_only=True)

    class Meta:
        model = Mark
        fields = [
            'id', 'school', 'student', 'student_name', 'student_gender',
            'subject', 'assessment', 'teacher', 'score', 'grade',
            'is_submitted', 'submitted_at',
        ]
        read_only_fields = ['id', 'grade', 'student_name', 'student_gender', 'is_submitted', 'submitted_at']

    def get_grade(self, obj):
        return get_grade(obj.score)


class BulkMarkSerializer(serializers.Serializer):
    """Save multiple marks at once: [{student, score}, ...]"""
    subject = serializers.IntegerField()
    assessment = serializers.IntegerField()
    stream = serializers.IntegerField()
    marks = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField(allow_null=True))
    )


# ── Results ───────────────────────────────────────────────────────────────────

class StudentResultSerializer(serializers.Serializer):
    """Computed result row for the live standings table."""
    student_id = serializers.IntegerField()
    display_name = serializers.CharField()
    gender = serializers.CharField()
    subjects = serializers.DictField()   # {subject_name: {score, grade}}
    total_score = serializers.FloatField(allow_null=True)
    total_possible = serializers.FloatField()
    average = serializers.FloatField(allow_null=True)
    total_gpa = serializers.FloatField(allow_null=True)
    division = serializers.CharField(allow_null=True)
    rank = serializers.IntegerField(allow_null=True)
    subjects_count = serializers.IntegerField()

