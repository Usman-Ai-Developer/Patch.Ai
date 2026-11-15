from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("assistant", "0002_chatmessage_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="PreviewServer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("backend_pid", models.IntegerField(blank=True, null=True)),
                ("backend_port", models.IntegerField(blank=True, null=True)),
                ("frontend_pid", models.IntegerField(blank=True, null=True)),
                ("frontend_port", models.IntegerField(blank=True, null=True)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("project", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="preview_server",
                    to="assistant.project",
                )),
            ],
        ),
    ]
