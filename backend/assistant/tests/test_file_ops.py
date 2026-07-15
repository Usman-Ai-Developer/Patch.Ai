import pytest
import zipfile
from io import BytesIO
from pathlib import Path
from django.conf import settings
from assistant.file_ops import (
    _safe_join, project_dir, write_loose_files,
    extract_zip_to_workspace, sync_project_files_table,
    read_single_file, list_text_file_paths
)
from assistant.models import ProjectFile
from assistant.tests.factories import ProjectFactory


@pytest.mark.django_db
def test_safe_join_allowed():
    base = Path("/tmp/project")
    rel = "sub/file.txt"
    expected = base / rel
    result = _safe_join(base, rel)
    assert result == expected.resolve()


@pytest.mark.django_db
def test_safe_join_blocks_escape():
    base = Path("/tmp/project")
    with pytest.raises(ValueError, match="Unsafe path rejected"):
        _safe_join(base, "../../etc/passwd")


@pytest.mark.django_db
def test_project_dir_creation():
    project = ProjectFactory()
    pdir = project_dir(project)
    assert pdir == Path(settings.PROJECTS_ROOT) / str(project.id)
    assert pdir.parent.exists()


@pytest.mark.django_db
def test_write_loose_files():
    project = ProjectFactory()

    class MockFile:
        def __init__(self, name, content):
            self.name = name
            self._content = content

        def chunks(self):
            yield self._content.encode()

    files = [MockFile("test.txt", "hello")]
    written = write_loose_files(project, files)
    assert written == ["test.txt"]
    workspace = project_dir(project)
    assert (workspace / "test.txt").exists()
    assert (workspace / "test.txt").read_text() == "hello"


@pytest.mark.django_db
def test_extract_zip_to_workspace():
    project = ProjectFactory()
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("file1.txt", "content1")
        zf.writestr("sub/file2.txt", "content2")
        zf.writestr("__MACOSX/.DS_Store", "ignored")
    zip_buffer.seek(0)

    written = extract_zip_to_workspace(project, zip_buffer)
    # Normalise paths for Windows compatibility (backslashes -> forward slashes)
    normalized_written = [p.replace("\\", "/") for p in written]
    assert "file1.txt" in normalized_written
    assert "sub/file2.txt" in normalized_written
    workspace = project_dir(project)
    assert (workspace / "file1.txt").exists()
    assert (workspace / "sub/file2.txt").exists()
    assert not (workspace / "__MACOSX").exists()


@pytest.mark.django_db
def test_sync_project_files_table():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "test.py").write_text("print('hello')")
    (workspace / "image.png").write_text("fake image")
    sync_project_files_table(project, ["test.py", "image.png"])
    files = ProjectFile.objects.filter(project=project)
    assert files.count() == 2
    py_file = files.get(path="test.py")
    assert py_file.is_binary is False
    img_file = files.get(path="image.png")
    assert img_file.is_binary is True
    assert img_file.size_bytes == 10


@pytest.mark.django_db
def test_read_single_file():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "test.txt").write_text("content")

    content = read_single_file(project, "test.txt")
    assert content == "content"

    # Test unsafe path
    assert read_single_file(project, "../../etc/passwd") is None

    # Test non-existent file
    assert read_single_file(project, "missing.txt") is None


@pytest.mark.django_db
def test_list_text_file_paths():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "a.py").write_text("")
    (workspace / "b.png").write_text("")

    ProjectFile.objects.create(project=project, path="a.py", is_binary=False)
    ProjectFile.objects.create(project=project, path="b.png", is_binary=True)

    paths = list_text_file_paths(project)
    assert paths == ["a.py"]