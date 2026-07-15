import uuid
from django.conf import settings
from django.db import models


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    # nullable now so no login is required yet; wiring auth later is just
    # "stop allowing null" + a migration, not a redesign.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.CASCADE, related_name="projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_active_at"]

    def __str__(self):
        return self.name


class ProjectFile(models.Model):
    """Mirrors a file's current state on disk so the frontend can render a tree
    without re-walking the filesystem on every request."""
    project = models.ForeignKey(Project, related_name="files", on_delete=models.CASCADE)
    path = models.CharField(max_length=1024)  # relative path within project workspace
    size_bytes = models.IntegerField(default=0)
    is_binary = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("project", "path")

    def __str__(self):
        return self.path


class ChatMessage(models.Model):
    ROLE_CHOICES = [("user", "user"), ("assistant", "assistant"), ("system", "system")]

    project = models.ForeignKey(Project, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    # summary of file operations applied as a result of this message, e.g.
    # [{"op": "replace", "path": "app/views.py"}, {"op": "create", "path": "app/utils.py"}]
    file_ops = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class ProjectFact(models.Model):
    """Small, durable memory about a project that the model itself decided was
    worth keeping (e.g. 'uses PostgreSQL, not SQLite'). Cheap to resend every
    turn since these are short one-liners, not full transcripts."""
    project = models.ForeignKey(Project, related_name="facts", on_delete=models.CASCADE)
    content = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
