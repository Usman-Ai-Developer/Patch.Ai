# backend/assistant/tests/test_file_ops_apply.py

import pytest
from pathlib import Path
from assistant.file_ops import apply_patch_operations, project_dir
from assistant.tests.factories import ProjectFactory

@pytest.mark.django_db
def test_create_operation():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    ops = [
        {"op": "create", "path": "newfile.txt", "content": "Hello, world!"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 1
    assert len(failed) == 0
    file_path = workspace / "newfile.txt"
    assert file_path.exists()
    assert file_path.read_text() == "Hello, world!"

@pytest.mark.django_db
def test_replace_operation():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    file_path = workspace / "test.txt"
    file_path.write_text("Hello world\nThis is a test.")
    ops = [
        {"op": "replace", "path": "test.txt", "old": "world", "new": "there"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 1
    assert len(failed) == 0
    assert file_path.read_text() == "Hello there\nThis is a test."

@pytest.mark.django_db
def test_replace_fails_if_not_unique():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    file_path = workspace / "test.txt"
    file_path.write_text("foo\nbar\nfoo")
    ops = [
        {"op": "replace", "path": "test.txt", "old": "foo", "new": "baz"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 0
    assert len(failed) == 1
    assert "matched 2 times" in failed[0]["reason"]

@pytest.mark.django_db
def test_replace_old_not_found():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    file_path = workspace / "test.txt"
    file_path.write_text("Hello world")
    ops = [
        {"op": "replace", "path": "test.txt", "old": "goodbye", "new": "hello"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 0
    assert len(failed) == 1
    assert "old text not found" in failed[0]["reason"]

@pytest.mark.django_db
def test_rewrite_operation():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    file_path = workspace / "test.txt"
    file_path.write_text("Old content")
    ops = [
        {"op": "rewrite", "path": "test.txt", "content": "Brand new content"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 1
    assert len(failed) == 0
    assert file_path.read_text() == "Brand new content"

@pytest.mark.django_db
def test_delete_operation():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # <-- fix
    file_path = workspace / "test.txt"
    file_path.write_text("to be deleted")
    ops = [
        {"op": "delete", "path": "test.txt"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 1
    assert len(failed) == 0
    assert not file_path.exists()

@pytest.mark.django_db
def test_unknown_operation():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # optional
    ops = [
        {"op": "unknown", "path": "test.txt"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 0
    assert len(failed) == 1
    assert "unknown op" in failed[0]["reason"]

@pytest.mark.django_db
def test_unsafe_path():
    project = ProjectFactory()
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)  # optional
    ops = [
        {"op": "create", "path": "../../etc/passwd", "content": "hack"}
    ]
    applied, failed = apply_patch_operations(project, ops)
    assert len(applied) == 0
    assert len(failed) == 1
    assert "unsafe path" in failed[0]["reason"]