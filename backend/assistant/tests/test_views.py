import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch
from assistant.tests.factories import UserFactory, ProjectFactory
from assistant.models import Project, ProjectFile, ChatMessage
from assistant.file_ops import project_dir


@pytest.mark.django_db
class TestProjectViews:
    def setup_method(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.client.force_authenticate(user=self.user)

    def test_list_projects(self):
        ProjectFactory(owner=self.user)
        ProjectFactory()  # another user
        url = reverse("project-list")
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_create_project_with_message(self):
        url = reverse("project-create")
        data = {"message": "Create a new project"}
        response = self.client.post(url, data)
        assert response.status_code == 201
        assert Project.objects.filter(owner=self.user).count() == 1
        assert Project.objects.get(owner=self.user).name == "Create a new project"

    def test_create_project_with_name(self):
        url = reverse("project-create")
        data = {"message": "Hi", "name": "Custom Name"}
        response = self.client.post(url, data)
        assert response.status_code == 201
        assert Project.objects.get(owner=self.user).name == "Custom Name"

    def test_create_project_with_zip(self):
        import zipfile
        from io import BytesIO
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            zf.writestr("test.txt", "content")
        zip_buffer.seek(0)
        zip_file = SimpleUploadedFile("project.zip", zip_buffer.read(), content_type="application/zip")
        url = reverse("project-create")
        response = self.client.post(url, {"message": "with zip", "zip": zip_file}, format="multipart")
        assert response.status_code == 201
        project = Project.objects.get(owner=self.user)
        workspace = project_dir(project)
        assert (workspace / "test.txt").exists()

    def test_delete_project(self):
        project = ProjectFactory(owner=self.user)
        url = reverse("project-detail", kwargs={"project_id": project.id})
        response = self.client.delete(url)
        assert response.status_code == 204
        assert not Project.objects.filter(id=project.id).exists()

    def test_update_project(self):
        project = ProjectFactory(owner=self.user, name="Old Name")
        url = reverse("project-detail", kwargs={"project_id": project.id})
        data = {"name": "New Name"}
        response = self.client.put(url, data, format="json")
        assert response.status_code == 200
        project.refresh_from_db()
        assert project.name == "New Name"

    def test_download_project(self):
        project = ProjectFactory(owner=self.user)
        workspace = project_dir(project)
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "dummy.txt").write_text("test")
        url = reverse("project-download", kwargs={"project_id": project.id})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/zip"

    def test_file_tree(self):
        project = ProjectFactory(owner=self.user)
        ProjectFile.objects.create(project=project, path="test.txt", size_bytes=10)
        url = reverse("file-tree", kwargs={"project_id": project.id})
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["path"] == "test.txt"

    def test_file_content(self):
        project = ProjectFactory(owner=self.user)
        workspace = project_dir(project)
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "test.txt").write_text("hello")
        ProjectFile.objects.create(project=project, path="test.txt", size_bytes=5)
        url = reverse("file-content", kwargs={"project_id": project.id})
        response = self.client.get(url, {"path": "test.txt"})
        assert response.status_code == 200
        assert response.json()["content"] == "hello"

    def test_file_download(self):
        project = ProjectFactory(owner=self.user)
        workspace = project_dir(project)
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "test.txt").write_text("download me")
        ProjectFile.objects.create(project=project, path="test.txt", size_bytes=11)
        url = reverse("file-download", kwargs={"project_id": project.id})
        response = self.client.get(url, {"path": "test.txt"})
        assert response.status_code == 200
        # FileResponse uses streaming_content, not content
        content = b"".join(response.streaming_content)
        assert content == b"download me"

    def test_file_delete(self):
        project = ProjectFactory(owner=self.user)
        workspace = project_dir(project)
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "test.txt").write_text("delete me")
        ProjectFile.objects.create(project=project, path="test.txt", size_bytes=9)
        url = f"{reverse('file-delete', kwargs={'project_id': project.id})}?path=test.txt"
        response = self.client.delete(url)
        assert response.status_code == 204
        assert not (workspace / "test.txt").exists()
        assert not ProjectFile.objects.filter(project=project, path="test.txt").exists()

    def test_sync_project(self):
        project = ProjectFactory(owner=self.user)
        workspace = project_dir(project)
        workspace.mkdir(parents=True, exist_ok=True)
        import zipfile
        from io import BytesIO
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            zf.writestr("new.txt", "sync content")
        zip_buffer.seek(0)
        zip_file = SimpleUploadedFile("sync.zip", zip_buffer.read(), content_type="application/zip")
        url = reverse("sync-project", kwargs={"project_id": project.id})
        response = self.client.post(url, {"file": zip_file}, format="multipart")
        assert response.status_code == 200
        assert (workspace / "new.txt").exists()
        assert ProjectFile.objects.filter(project=project, path="new.txt").exists()

    def test_chat_history(self):
        project = ProjectFactory(owner=self.user)
        ChatMessage.objects.create(project=project, role="user", content="hi")
        ChatMessage.objects.create(project=project, role="assistant", content="hello")
        url = reverse("chat-history", kwargs={"project_id": project.id})
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2

    def test_chat_endpoint(self):
        project = ProjectFactory(owner=self.user)
        url = reverse("chat", kwargs={"project_id": project.id})
        with patch("assistant.chat_service.groq_service.run_chat_turn") as mock_run:
            mock_run.return_value = {
                "summary": "OK",
                "operations": [],
                "facts": [],
                "files_read": []
            }
            response = self.client.post(url, {"message": "test"}, format="json")
            assert response.status_code == 200
            assert "message" in response.json()