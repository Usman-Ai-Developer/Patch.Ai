# backend/assistant/tests/test_groq_service.py

import pytest
import json
from unittest.mock import patch, MagicMock
from assistant.groq_service import run_chat_turn
from assistant.tests.factories import ProjectFactory

@pytest.mark.django_db
@patch("assistant.groq_service.Groq")
def test_run_chat_turn_propose_edits(mock_groq):
    project = ProjectFactory()
    mock_client = MagicMock()
    mock_groq.return_value = mock_client

    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_message = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "propose_edits"
    mock_tool_call.function.arguments = json.dumps({
        "summary": "Test summary",
        "operations": [{"op": "create", "path": "test.txt", "content": "Hello"}],
        "facts": ["fact1"]
    })
    mock_message.tool_calls = [mock_tool_call]
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    result = run_chat_turn(project, "do something", [], [])
    assert result["summary"] == "Test summary"
    assert len(result["operations"]) == 1
    assert result["facts"] == ["fact1"]
    assert result["files_read"] == []

@pytest.mark.django_db
@patch("assistant.groq_service.Groq")
def test_run_chat_turn_read_file(mock_groq):
    project = ProjectFactory()
    # Create a file in the workspace
    from assistant.file_ops import project_dir
    workspace = project_dir(project)
    workspace.mkdir(parents=True, exist_ok=True)
    test_file = workspace / "test.py"
    test_file.write_text("print('hello')")

    mock_client = MagicMock()
    mock_groq.return_value = mock_client

    # First call: read_file
    mock_response_read = MagicMock()
    mock_choice_read = MagicMock()
    mock_message_read = MagicMock()
    mock_tool_read = MagicMock()
    mock_tool_read.function.name = "read_file"
    mock_tool_read.function.arguments = json.dumps({"path": "test.py"})
    mock_message_read.tool_calls = [mock_tool_read]
    mock_choice_read.message = mock_message_read
    mock_response_read.choices = [mock_choice_read]

    # Second call: propose_edits
    mock_response_propose = MagicMock()
    mock_choice_propose = MagicMock()
    mock_message_propose = MagicMock()
    mock_tool_propose = MagicMock()
    mock_tool_propose.function.name = "propose_edits"
    mock_tool_propose.function.arguments = json.dumps({
        "summary": "Read file",
        "operations": []
    })
    mock_message_propose.tool_calls = [mock_tool_propose]
    mock_choice_propose.message = mock_message_propose
    mock_response_propose.choices = [mock_choice_propose]

    mock_client.chat.completions.create.side_effect = [mock_response_read, mock_response_propose]

    result = run_chat_turn(project, "show test.py", [], [])
    assert result["summary"] == "Read file"
    assert "test.py" in result["files_read"]

@pytest.mark.django_db
@patch("assistant.groq_service.Groq")
def test_run_chat_turn_invalid_json(mock_groq):
    project = ProjectFactory()
    mock_client = MagicMock()
    mock_groq.return_value = mock_client

    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_message = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "propose_edits"
    mock_tool_call.function.arguments = "{invalid json"
    mock_message.tool_calls = [mock_tool_call]
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    result = run_chat_turn(project, "do something", [], [])
    assert result["summary"] == "Model returned malformed edit data."
    assert result["operations"] == []

@pytest.mark.django_db
@patch("assistant.groq_service.Groq")
def test_run_chat_turn_max_iterations(mock_groq):
    project = ProjectFactory()
    mock_client = MagicMock()
    mock_groq.return_value = mock_client

    # Simulate read_file calls looping until max iterations
    def create_response(*args, **kwargs):
        mock_resp = MagicMock()
        mock_choice = MagicMock()
        mock_message = MagicMock()
        mock_tool = MagicMock()
        mock_tool.function.name = "read_file"
        mock_tool.function.arguments = json.dumps({"path": "test.txt"})
        mock_message.tool_calls = [mock_tool]
        mock_choice.message = mock_message
        mock_resp.choices = [mock_choice]
        return mock_resp

    mock_client.chat.completions.create.side_effect = create_response

    result = run_chat_turn(project, "keep reading", [], [])
    assert result["summary"] == "Reached the maximum number of file lookups without finishing. Try a more specific instruction."