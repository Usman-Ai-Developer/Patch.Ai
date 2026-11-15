from django.contrib import admin
from .models import PreviewServer


@admin.register(PreviewServer)
class PreviewServerAdmin(admin.ModelAdmin):
    # Mainly useful for spotting orphaned rows in production — a row with
    # no live pid should self-clean the next time its project's status is
    # checked (process_registry.get_status), but this view is handy for
    # manually confirming that, or for killing something stuck via the
    # admin action below without shelling into the box.
    list_display = ("project", "backend_pid", "backend_port", "frontend_pid", "frontend_port", "updated_at")
    readonly_fields = ("started_at", "updated_at")
    actions = ["kill_selected"]

    @admin.action(description="Kill selected preview servers")
    def kill_selected(self, request, queryset):
        from . import process_registry
        for entry in queryset:
            process_registry.kill(entry.project_id)
        self.message_user(request, f"Killed {queryset.count()} preview server(s).")
