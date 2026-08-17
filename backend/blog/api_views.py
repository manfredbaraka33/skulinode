from django.core.paginator import Paginator
from django.db.models import F, Q
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import BlogPost, BlogCategory


class BlogCategoriesView(APIView):
    """GET /api/blog/categories/ — only categories that have at least one published post."""
    permission_classes = []

    def get(self, request):
        categories = BlogCategory.objects.filter(posts__is_published=True).distinct()
        return Response([{
            'id': c.id, 'name': c.name, 'slug': c.slug,
            'post_count': c.posts.filter(is_published=True).count(),
        } for c in categories])


class BlogListView(APIView):
    """GET /api/blog/list/?category=&q=&page="""
    permission_classes = []

    def get(self, request):
        category = request.query_params.get('category')
        q = request.query_params.get('q', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 10)), 30)

        qs = BlogPost.objects.filter(is_published=True).select_related('category')
        if category:
            qs = qs.filter(category__slug=category)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))

        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)

        results = [{
            'id': p.id, 'title': p.title, 'slug': p.slug, 'excerpt': p.excerpt,
            'cover_image': p.cover_image.url if p.cover_image else None,
            'category': p.category.name if p.category else None,
            'category_slug': p.category.slug if p.category else None,
            'published_at': p.published_at.isoformat() if p.published_at else None,
            'view_count': p.view_count,
        } for p in page_obj]

        return Response({
            'total': paginator.count, 'page': page, 'total_pages': paginator.num_pages,
            'results': results,
        })


class BlogDetailView(APIView):
    """GET /api/blog/post/<slug>/ — also increments view_count."""
    permission_classes = []

    def get(self, request, slug):
        try:
            post = BlogPost.objects.select_related('category').get(slug=slug, is_published=True)
        except BlogPost.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        BlogPost.objects.filter(pk=post.pk).update(view_count=F('view_count') + 1)

        return Response({
            'id': post.id, 'title': post.title, 'slug': post.slug,
            'body': post.body, 'excerpt': post.excerpt,
            'cover_image': post.cover_image.url if post.cover_image else None,
            'category': post.category.name if post.category else None,
            'category_slug': post.category.slug if post.category else None,
            'published_at': post.published_at.isoformat() if post.published_at else None,
            'view_count': post.view_count + 1,
        })