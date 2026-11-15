from django.db import models
from assistant.models import Project

class Blueprint(models.Model):
    FRAMEWORK_CHOICES = [
        ('drf', 'Django REST Framework'),
        ('nextjs', 'Next.js'),
        ('nodejs', 'Node.js'),
        ('php', 'PHP'),
    ]
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='blueprint')
    framework = models.CharField(max_length=20, choices=FRAMEWORK_CHOICES, default='drf')
    data = models.JSONField(default=dict)  # models, fields, relationships, settings
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - {self.get_framework_display()}"