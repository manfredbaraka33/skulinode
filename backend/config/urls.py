from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve


# Customize the Django Admin text
admin.site.site_header = "SkuliNode Admin"       # Changes the main title at the top of the page
admin.site.site_title = "SkuliNode Admin Portal"    # Changes the title in the browser tab
admin.site.index_title = "Welcome to the SkuliNode Admin Portal"


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
]

# Serve local media files regardless of DEBUG setting.
# In production behind nginx/Caddy, the web server handles /media/ before Django.
# On platforms without a dedicated media proxy (e.g. Railway, Render), Django serves it.
# Cloudinary uploads bypass this entirely — their URLs are absolute Cloudinary links.
if not settings.USE_CLOUDINARY:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

