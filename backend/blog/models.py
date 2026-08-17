from django.db import models
from django.utils.text import slugify
from django.utils import timezone


class BlogCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(unique=True, blank=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Blog Categories'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class BlogPost(models.Model):
    title        = models.CharField(max_length=250)
    slug         = models.SlugField(unique=True, blank=True, max_length=280)
    excerpt      = models.CharField(
        max_length=300, blank=True,
        help_text='Short summary shown on the blog list page and in link previews. '
                   'Auto-generated from the body if left blank.'
    )
    body         = models.TextField(help_text='Markdown — headings with ##, bold with **text**, '
                                              'links with [text](url), images with ![alt](url)')
    cover_image  = models.ImageField(upload_to='blog/covers/%Y/', null=True, blank=True)

    category     = models.ForeignKey(BlogCategory, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='posts')

    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    view_count   = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-published_at', '-created_at']
        indexes = [models.Index(fields=['is_published', 'published_at'])]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:280]
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        if not self.excerpt and self.body:
            plain = self.body.replace('#', '').replace('*', '').replace('\n', ' ')
            self.excerpt = plain[:280].rsplit(' ', 1)[0] + '...' if len(plain) > 280 else plain
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class BlogImage(models.Model):
    """
    Standalone image upload — used for inline images within a post body.
    Upload here first to get a URL, then reference it in the Markdown body
    as ![description](url).
    """
    image      = models.ImageField(upload_to='blog/inline/%Y/')
    caption    = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.caption or f'Image {self.id}'