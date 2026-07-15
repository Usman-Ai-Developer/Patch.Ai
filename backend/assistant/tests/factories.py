# backend/assistant/tests/factories.py

import factory
from django.contrib.auth.models import User
from assistant.models import Project

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True   # <-- add this line

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "testpass123")

class ProjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Project

    name = "Test Project"
    owner = factory.SubFactory(UserFactory)