# necta_results/sitemap_views.py
from django.http import HttpResponse
from django.views import View
from .models import SchoolCenter, ExamSession


class SitemapView(View):
    """
    GET /sitemap.xml
    Auto-generated from live data — includes static pages plus every
    published school profile, so Google can discover each one directly
    without needing to crawl through the rankings table first.
    """
    def get(self, request):
        base_url = "https://skulinode.co.tz"

        static_pages = [
            {"loc": "/", "priority": "1.0", "changefreq": "weekly"},
            {"loc": "/necta", "priority": "0.9", "changefreq": "weekly"},
            {"loc": "/tcu", "priority": "0.9", "changefreq": "monthly"},
            {"loc": "/past-papers", "priority": "0.8", "changefreq": "weekly"},
        ]

        urls_xml = []
        for page in static_pages:
            urls_xml.append(f"""
  <url>
    <loc>{base_url}{page['loc']}</loc>
    <changefreq>{page['changefreq']}</changefreq>
    <priority>{page['priority']}</priority>
  </url>""")

        # Every published school gets its own sitemap entry — this is what
        # makes individual school pages independently discoverable/indexable,
        # not just reachable by clicking through the rankings table.
        published_sessions = ExamSession.objects.filter(is_published=True)
        centers = SchoolCenter.objects.filter(
            exam_session__in=published_sessions, is_rankable=True
        ).values_list('center_id', flat=True).distinct()

        for center_id in centers:
            urls_xml.append(f"""
  <url>
    <loc>{base_url}/necta/shule/{center_id}</loc>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>""")

        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{''.join(urls_xml)}
</urlset>"""

        return HttpResponse(xml_content, content_type="application/xml")