from django.contrib import admin
from django.utils.html import format_html
from .models import BlogCategory, BlogPost, BlogImage


@admin.register(BlogCategory)
class BlogCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'post_count']
    prepopulated_fields = {'slug': ('name',)}

    def post_count(self, obj):
        return obj.posts.count()


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'is_published', 'published_at', 'view_count']
    list_editable = ['is_published']
    list_filter = ['is_published', 'category']
    search_fields = ['title', 'body']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['view_count', 'created_at', 'updated_at']

    fieldsets = (
        (None, {'fields': ('title', 'slug', 'category', 'cover_image')}),
        ('Maudhui (Markdown)', {
            'fields': ('body', 'excerpt'),
            'description': 'Andika kwa Markdown: ## Kichwa, **maneno mazito**, '
                           '[kiungo](url), ![picha](url). Pakia picha kwenye "Blog Images" '
                           'chini kwanza ili upate URL ya kuweka hapa.',
        }),
        ('Uchapishaji', {'fields': ('is_published', 'published_at')}),
        ('Takwimu', {'fields': ('view_count', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    class Media:
        css = {'all': ('blog/admin_wide_textarea.css',)}


@admin.register(BlogImage)
class BlogImageAdmin(admin.ModelAdmin):
    list_display = ['caption', 'preview', 'url_display', 'uploaded_at']
    readonly_fields = ['url_display']

    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height:50px;border-radius:4px;"/>', obj.image.url)
        return '—'

    def url_display(self, obj):
        if obj.image:
            return format_html(
                '<code style="user-select:all;background:#f1f5f9;padding:4px 8px;border-radius:4px;">{}</code>'
                '<br/><span style="color:#64748b;font-size:11px;">Nakili hii, weka kwenye body: '
                '![maelezo]({})</span>',
                obj.image.url, obj.image.url
            )
        return '—'
    url_display.short_description = 'URL ya Kunakili'