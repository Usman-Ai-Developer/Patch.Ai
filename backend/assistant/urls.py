from django.urls import path
from . import views

urlpatterns = [
    # Project management
    path("projects/", views.ProjectListView.as_view(), name="project-list"),
    path("projects/create/", views.CreateProjectView.as_view(), name="project-create"),
    path("projects/<uuid:project_id>/", views.ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<uuid:project_id>/download/", views.ProjectDownloadView.as_view(), name="project-download"),

    # File operations
    path("projects/<uuid:project_id>/files/", views.ProjectFileTreeView.as_view(), name="file-tree"),
    path("projects/<uuid:project_id>/file-content/", views.ProjectFileContentView.as_view(), name="file-content"),
    path("projects/<uuid:project_id>/file-content/update/", views.UpdateFileContentView.as_view(), name="update-file-content"),
    path("projects/<uuid:project_id>/files/download/", views.FileDownloadView.as_view(), name="file-download"),
    path("projects/<uuid:project_id>/files/delete/", views.FileDeleteView.as_view(), name="file-delete"),
    path("projects/<uuid:project_id>/directories/delete/", views.DirectoryDeleteView.as_view(), name="directory-delete"),
    path("projects/<uuid:project_id>/sync/", views.SyncProjectView.as_view(), name="sync-project"),

    # Chat
    path("projects/<uuid:project_id>/chat/", views.ChatView.as_view(), name="chat"),
    path("projects/<uuid:project_id>/chat/history/", views.ChatHistoryView.as_view(), name="chat-history"),

    # Apply / Reject
    path("projects/<uuid:project_id>/apply/", views.ApplyOperationsView.as_view(), name="apply-operations"),
    path("projects/<uuid:project_id>/reject/", views.RejectOperationsView.as_view(), name="reject-operations"),

    # Sync files (refresh file tree)
    path("projects/<uuid:project_id>/sync-files/", views.SyncProjectFilesView.as_view(), name="sync-files"),

    # Authentication
    path("signup/", views.SignUpView.as_view(), name="signup"),
]