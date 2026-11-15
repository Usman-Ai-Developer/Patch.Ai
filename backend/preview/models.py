from django.db import models


class PreviewServer(models.Model):
    """
    Persisted record of a running (or last-known) preview server for a
    project, replacing the old in-memory `_running_servers` dict in
    preview/views.py.

    The old dict lived in one worker process's memory: a second gunicorn/
    uwsgi worker (or a reload/restart of the same one) had no idea a
    preview was already running, so it could spawn a duplicate on the same
    port, or report "not running" for a server that was still alive and
    holding a port. Storing pid+port here instead means any worker, and
    any request after a restart, can ask the OS "is this pid still alive"
    and "is this port still listening" and get the right answer — the
    actual subprocess.Popen handle can't survive a restart anyway, but we
    never needed the handle itself, only pid + port to check liveness and
    to kill it.

    One row per project. `get_or_create`-style upsert is done in
    preview/process_registry.py, not here — this is deliberately a plain
    data model with no business logic.
    """
    project = models.OneToOneField(
        "assistant.Project", on_delete=models.CASCADE, related_name="preview_server"
    )
    backend_pid = models.IntegerField(null=True, blank=True)
    backend_port = models.IntegerField(null=True, blank=True)
    frontend_pid = models.IntegerField(null=True, blank=True)
    frontend_port = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PreviewServer(project={self.project_id}, backend_pid={self.backend_pid}, frontend_pid={self.frontend_pid})"
