import pytest
from unittest.mock import patch, MagicMock
from assistant.chat_service import process_instruction
from assistant.tests.factories import ProjectFactory
from assistant.models import ChatMessage, ProjectFact

@pytest.mark.django_db
@patch("assistant.chat_service.groq_service.run_chat_turn")
def test_process_instruction_success(mock_run_chat_turn):
    project = ProjectFactory()
    instruction = "Add a new file"
    history = []

    mock_run_chat_turn.return_value = {
        "summary": "Created newfile.txt",
        "operations": [{"op": "create", "path": "newfile.txt", "content": "Hello"}],
        "facts": ["uses Python"],
        "files_read": []
    }

    result = process_instruction(project, instruction, history)

    assert "message" in result
    msg = result["message"]
    assert msg["role"] == "assistant"
    assert "Created newfile.txt" in msg["content"]
    assert ProjectFact.objects.filter(project=project, content="uses Python").exists()
    assert ChatMessage.objects.filter(project=project, role="user", content=instruction).exists()
    assistant_msg = ChatMessage.objects.get(role="assistant")
    assert len(assistant_msg.file_ops) == 1
    assert assistant_msg.file_ops[0]["op"] == "create"

@pytest.mark.django_db
@patch("assistant.chat_service.groq_service.run_chat_turn")
def test_process_instruction_runtime_error(mock_run_chat_turn):
    project = ProjectFactory()
    mock_run_chat_turn.side_effect = RuntimeError("Something went wrong")

    result = process_instruction(project, "break it", [])

    assert "error" in result
    assert result["error"] == "Something went wrong"
    assert ChatMessage.objects.filter(project=project, role="assistant").exists()

@pytest.mark.django_db
@patch("assistant.chat_service.groq_service.run_chat_turn")
def test_process_instruction_with_failed_ops(mock_run_chat_turn):
    project = ProjectFactory()
    # Create a file that will fail replace
    from assistant.file_ops import project_dir
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "test.txt").write_text("hello")

    mock_run_chat_turn.return_value = {
        "summary": "Update test",
        "operations": [
            {"op": "replace", "path": "test.txt", "old": "world", "new": "there"}  # fails
        ],
        "facts": [],
        "files_read": []
    }

    result = process_instruction(project, "update", [])
    assert "message" in result
    msg = result["message"]
    # The summary should now include the failure note
    assert "could not be applied" in msg["content"]
    assert result["failed_ops"] is not None
    assert len(result["failed_ops"]) > 0

@pytest.mark.django_db
@patch("assistant.chat_service.groq_service.run_chat_turn")
def test_process_instruction_with_known_facts(mock_run_chat_turn):
    project = ProjectFactory()
    # Pre-create a fact
    ProjectFact.objects.create(project=project, content="uses Django")
    mock_run_chat_turn.return_value = {
        "summary": "OK",
        "operations": [],
        "facts": [],
        "files_read": []
    }
    process_instruction(project, "hello", [])
    # Verify the known_facts list was passed to groq_service
    # We can check the call args
    args, kwargs = mock_run_chat_turn.call_args
    assert args[3] == ["uses Django"]  # known_facts is the 4th arg