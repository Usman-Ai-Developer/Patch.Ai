from django.urls import path
from .views import PreviewView, PreviewStatusView, PreviewStopView


urlpatterns = [
    path("projects/<uuid:project_id>/preview/", PreviewView.as_view(), name="preview"),
    path("projects/<uuid:project_id>/preview/status/", PreviewStatusView.as_view(), name="preview-status"),
    path("projects/<uuid:project_id>/preview/stop/", PreviewStopView.as_view(), name="preview-stop"),
]