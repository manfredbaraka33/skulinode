from django.contrib import admin

from academy.models import ClassLevel, Stream, Subject, SubjectAssignment


@admin.register(ClassLevel)
class ClassLevelAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'level', 'school']
    list_filter = ['level', 'school']
    search_fields = ['name', 'code']


@admin.register(Stream)
class StreamAdmin(admin.ModelAdmin):
    list_display = ['name', 'class_level', 'school']
    list_filter = ['school', 'class_level__level']
    search_fields = ['name']


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'school']
    list_filter = ['school']
    search_fields = ['name', 'code']


@admin.register(SubjectAssignment)
class SubjectAssignmentAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'subject', 'stream', 'academic_year', 'school']
    list_filter = ['academic_year', 'school', 'subject']
    search_fields = ['teacher__email', 'subject__name', 'stream__name']
