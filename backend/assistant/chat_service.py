"""Shared logic for processing one instruction against a project, used by
both the ongoing chat endpoint and project creation (when a message is sent
alongside the first upload)."""
from .models import ChatMessage, ProjectFact
from .serializers import ChatMessageSerializer
from . import file_ops, groq_service


def process_instruction(project, instruction: str, history: list[dict] | None = None) -> dict:
    """Runs one instruction through Groq's tool-calling loop, applies the
    resulting edits, stores facts, and logs both sides of the exchange as
    ChatMessage rows. Returns a dict ready to merge into an API response."""
    ChatMessage.objects.create(project=project, role="user", content=instruction)

    known_facts = list(project.facts.values_list("content", flat=True))

    try:
        result = groq_service.run_chat_turn(project, instruction, history or [], known_facts)
    except RuntimeError as e:
        msg = ChatMessage.objects.create(project=project, role="assistant", content=str(e), file_ops=[])
        return {"message": ChatMessageSerializer(msg).data, "error": str(e), "failed_ops": []}

    applied, failed = file_ops.apply_patch_operations(project, result.get("operations", []))

    for fact in result.get("facts", []):
        if fact and not ProjectFact.objects.filter(project=project, content=fact).exists():
            ProjectFact.objects.create(project=project, content=fact)

    summary = result.get("summary", "")
    if failed:
        failed_note = "; ".join(f"{f['path']} ({f['reason']})" for f in failed)
        summary += f"\n\n({len(failed)} edit(s) could not be applied: {failed_note})"

    assistant_msg = ChatMessage.objects.create(project=project, role="assistant", content=summary, file_ops=applied)
    project.save(update_fields=["last_active_at"])

    return {
        "message": ChatMessageSerializer(assistant_msg).data,
        "files_read": result.get("files_read", []),
        "failed_ops": failed,
    }
