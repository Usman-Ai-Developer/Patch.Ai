import os
import shutil
import zipfile
from io import BytesIO
from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Project, ProjectFile, ChatMessage
from .serializers import ProjectSerializer, ProjectFileSerializer, ChatMessageSerializer
from . import file_ops, chat_service


# ---------------------------------------------------------------------
# Project list and detail
# ---------------------------------------------------------------------
class ProjectListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = Project.objects.filter(owner=request.user)
        data = []
        for p in projects:
            data.append({
                **ProjectSerializer(p).data,
                "file_count": p.files.count(),
                "last_active_at": p.last_active_at,
            })
        return Response(data)


class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        return Response(ProjectSerializer(project).data)

    def put(self, request, project_id):
        """Update project name."""
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        name = request.data.get("name", "").strip()
        if not name:
            return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
        project.name = name
        project.save(update_fields=["name"])
        return Response(ProjectSerializer(project).data)

    def delete(self, request, project_id):
        """Delete project and its workspace folder."""
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        workspace = file_ops.project_dir(project)
        if workspace.exists():
            shutil.rmtree(workspace)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------
# Download endpoints
# ---------------------------------------------------------------------
class ProjectDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        workspace = file_ops.project_dir(project)

        if not workspace.exists():
            return Response({"error": "Project workspace not found."}, status=status.HTTP_404_NOT_FOUND)

        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for root, dirs, files in os.walk(workspace):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, workspace)
                    zip_file.write(file_path, rel_path)

        zip_buffer.seek(0)
        response = FileResponse(
            zip_buffer,
            content_type="application/zip",
            filename=f"{project.name}.zip"
        )
        return response


class FileDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        rel_path = request.query_params.get("path")
        if not rel_path:
            return Response({"error": "Missing ?path="}, status=status.HTTP_400_BAD_REQUEST)

        try:
            full_path = file_ops._safe_join(file_ops.project_dir(project), rel_path)
        except ValueError:
            return Response({"error": "Invalid file path."}, status=status.HTTP_400_BAD_REQUEST)

        if not full_path.exists() or not full_path.is_file():
            return Response({"error": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(
            open(full_path, "rb"),
            content_type="application/octet-stream",
            filename=os.path.basename(rel_path)
        )
        return response


# ---------------------------------------------------------------------
# Create project (with optional message and files)
# ---------------------------------------------------------------------
class CreateProjectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        message = (request.data.get("message") or "").strip()
        zip_file = request.FILES.get("zip")
        loose_files = request.FILES.getlist("files")

        if not message and not zip_file and not loose_files:
            return Response({"error": "Send a message and/or attach files to start a project."},
                             status=status.HTTP_400_BAD_REQUEST)

        if zip_file and not zip_file.name.endswith(".zip"):
            return Response({"error": "Archive attachments must be .zip files."},
                             status=status.HTTP_400_BAD_REQUEST)

        if not name:
            name = (message[:40] + "…") if len(message) > 40 else message
        if not name:
            name = "New Project"

        project = Project.objects.create(name=name, owner=request.user)

        try:
            written = []
            if zip_file:
                written += file_ops.extract_zip_to_workspace(project, zip_file)
            if loose_files:
                written += file_ops.write_loose_files(project, loose_files)
            if written:
                file_ops.sync_project_files_table(project, written)
        except Exception as e:
            project.delete()
            return Response({"error": f"Failed to process attachment: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)

        response_data = {
            "project": ProjectSerializer(project).data,
            "file_count": len(written) if (zip_file or loose_files) else 0,
        }

        if message:
            try:
                response_data["chat"] = chat_service.process_instruction(project, message)
            except Exception as e:
                response_data["chat_error"] = str(e)

        return Response(response_data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------
# Sync (upload .zip to existing project)
# ---------------------------------------------------------------------
class SyncProjectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        upload = request.FILES.get("file")
        if not upload or not upload.name.endswith(".zip"):
            return Response({"error": "Expected a .zip under 'file'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            paths = file_ops.extract_zip_to_workspace(project, upload)
        except Exception as e:
            return Response({"error": f"Failed to extract zip: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        file_ops.sync_project_files_table(project, paths)
        project.save(update_fields=["last_active_at"])

        return Response({
            "project": ProjectSerializer(project).data,
            "synced_files": len(paths),
            "files": ProjectFileSerializer(
                ProjectFile.objects.filter(project=project).order_by("path"), many=True
            ).data,
        })


# ---------------------------------------------------------------------
# File tree and content
# ---------------------------------------------------------------------
class ProjectFileTreeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        files = ProjectFile.objects.filter(project=project).order_by("path")
        return Response(ProjectFileSerializer(files, many=True).data)


class ProjectFileContentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        rel_path = request.query_params.get("path")
        if not rel_path:
            return Response({"error": "Missing ?path="}, status=status.HTTP_400_BAD_REQUEST)

        content = file_ops.read_single_file(project, rel_path)
        if content is None:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"path": rel_path, "content": content})


# ---------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------
class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        msgs = ChatMessage.objects.filter(project=project)
        facts = list(project.facts.values_list("content", flat=True))
        return Response({
            "messages": ChatMessageSerializer(msgs, many=True).data,
            "facts": facts,
        })


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        instruction = (request.data.get("message") or "").strip()
        if not instruction:
            return Response({"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

        history_qs = ChatMessage.objects.filter(project=project).order_by("-created_at")[:6]
        history = [
            {"role": m.role, "content": m.content}
            for m in reversed(list(history_qs))
            if m.role in ("user", "assistant")
        ]

        try:
            result = chat_service.process_instruction(project, instruction, history)
        except Exception as e:
            return Response(
                {"error": f"AI service error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            "message": result["message"],
            "files": ProjectFileSerializer(
                ProjectFile.objects.filter(project=project).order_by("path"), many=True
            ).data,
            "files_read": result.get("files_read", []),
            "failed_ops": result.get("failed_ops", []),
        })
    
class FileDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        rel_path = request.query_params.get("path")
        if not rel_path:
            return Response({"error": "Missing ?path="}, status=status.HTTP_400_BAD_REQUEST)

        try:
            full_path = file_ops._safe_join(file_ops.project_dir(project), rel_path)
        except ValueError:
            return Response({"error": "Invalid file path."}, status=status.HTTP_400_BAD_REQUEST)

        if not full_path.exists() or not full_path.is_file():
            return Response({"error": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        # Delete from disk
        os.remove(full_path)

        # Delete from database
        ProjectFile.objects.filter(project=project, path=rel_path).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

class SignUpView(APIView):
    permission_classes = []  # no auth required

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "").strip()
        password2 = request.data.get("password2", "").strip()

        if not username or not password or not password2:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if password != password2:
            return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }
        }, status=status.HTTP_201_CREATED)