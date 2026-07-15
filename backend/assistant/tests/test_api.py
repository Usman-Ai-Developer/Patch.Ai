# backend/assistant/tests/test_api.py

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from assistant.tests.factories import UserFactory, ProjectFactory
from assistant.models import Project

@pytest.mark.django_db
def test_project_list_requires_auth():
    client = APIClient()
    url = reverse("project-list")  # requires name in urls
    response = client.get(url)
    assert response.status_code == 401

@pytest.mark.django_db
def test_project_list_returns_owned_projects():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)
    own = ProjectFactory(owner=user)
    other = ProjectFactory()  # another user
    url = reverse("project-list")
    response = client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(own.id)