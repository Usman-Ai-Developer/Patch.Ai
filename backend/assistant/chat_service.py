"""Shared logic for processing one instruction."""
from .models import ChatMessage, ProjectFact
from .serializers import ChatMessageSerializer
from . import file_ops, groq_service


def process_instruction(project, instruction: str, history: list[dict] | None = None) -> dict:
    """Runs one instruction, computes diffs, stores pending message."""
    ChatMessage.objects.create(project=project, role="user", content=instruction)

    known_facts = list(project.facts.values_list("content", flat=True))

    try:
        result = groq_service.run_chat_turn(project, instruction, history or [], known_facts)
    except RuntimeError as e:
        msg = ChatMessage.objects.create(project=project, role="assistant", content=str(e), file_ops=[], status="failed")
        return {"message": ChatMessageSerializer(msg).data, "error": str(e), "failed_ops": []}

    operations = result.get("operations", [])
    diffs = []
    failed_ops = []
    for op in operations:
        diff = file_ops.compute_operation_diff(project, op)
        diffs.append(diff)
        if diff.get("error"):
            failed_ops.append({**op, "reason": diff["error"]})

    # Build summary and append failure note if any
    summary = result.get("summary", "")
    if failed_ops:
        summary += "\n\n⚠️ Some operations could not be applied. Please review the diffs and try again."

    assistant_msg = ChatMessage.objects.create(
        project=project,
        role="assistant",
        content=summary,
        file_ops=operations,
        status="failed" if failed_ops else "pending",
    )

    for fact in result.get("facts", []):
        if fact and not ProjectFact.objects.filter(project=project, content=fact).exists():
            ProjectFact.objects.create(project=project, content=fact)

    return {
        "message": ChatMessageSerializer(assistant_msg).data,
        "pending_ops": operations if not failed_ops else [],
        "diffs": diffs,
        "files_read": result.get("files_read", []),
        "failed_ops": failed_ops,
    }