from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include


# Customize the Django Admin text
admin.site.site_header = "SkuliNode Admin"       # Changes the main title at the top of the page
admin.site.site_title = "SkuliNode Admin Portal"    # Changes the title in the browser tab
admin.site.index_title = "Welcome to the SkuliNode Admin Portal"


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
]

if not settings.USE_CLOUDINARY:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

