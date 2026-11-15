from django.urls import path
from .views import (
    StartProjectView, BlueprintDetailView, GenerateCodeView,
    AppsStructureView, CreateAppView, DeleteAppView, CreateSuperuserView,
    EnableAuthView, ResetDatabaseView, WidgetManifestView, RenderPageCodeView
)

urlpatterns = [
    path('builder/widgets/', WidgetManifestView.as_view(), name='widget-manifest'),
    path('projects/<uuid:project_id>/builder/render-code/', RenderPageCodeView.as_view(), name='render-page-code'),
    path('projects/<uuid:project_id>/builder/start/', StartProjectView.as_view(), name='start-project'),
    path('projects/<uuid:project_id>/builder/blueprint/', BlueprintDetailView.as_view(), name='blueprint-detail'),
    path('projects/<uuid:project_id>/builder/generate/', GenerateCodeView.as_view(), name='generate-code'),
    path('projects/<uuid:project_id>/builder/apps/', AppsStructureView.as_view(), name='apps-structure'),
    path('projects/<uuid:project_id>/builder/create-app/', CreateAppView.as_view(), name='create-app'),
    path('projects/<uuid:project_id>/builder/delete-app/', DeleteAppView.as_view(), name='delete-app'),
    path('projects/<uuid:project_id>/builder/create-superuser/', CreateSuperuserView.as_view(), name='create-superuser'),
    path('projects/<uuid:project_id>/builder/enable-auth/', EnableAuthView.as_view(), name='enable-auth'),
    path('projects/<uuid:project_id>/builder/reset-database/', ResetDatabaseView.as_view(), name='reset-database'),  # <-- new
]