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
    path('api/public/necta/', include('necta_results.urls')),
    path('api/tcu/', include('tcu_calculator.urls')),

]

# Always serve local media files from MEDIA_ROOT.
# When Cloudinary is active, new uploads return absolute Cloudinary URLs so this
# route is only hit for files that were saved locally before Cloudinary was enabled.
# On platforms without a dedicated media proxy (Railway, Render, etc.) Django serves it;
# behind nginx/Caddy, the web server intercepts /media/ before Django.
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

