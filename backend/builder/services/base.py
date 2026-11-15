from abc import ABC, abstractmethod
from pathlib import Path
from assistant.file_ops import project_dir

class BaseGenerator(ABC):
    """
    Abstract base class for all framework generators.
    Each framework (Django, Node.js, Laravel, etc.) must implement these methods.
    """

    def __init__(self, project, blueprint):
        self.project = project
        self.blueprint = blueprint
        self.workspace = project_dir(project)

    @abstractmethod
    def generate(self):
        """Generate the entire project for the chosen framework."""
        pass

    @abstractmethod
    def write_requirements(self):
        """Write dependency files (requirements.txt, package.json, etc.)."""
        pass

    @abstractmethod
    def install_dependencies(self):
        """Install dependencies (pip install, npm install, etc.)."""
        pass

    @abstractmethod
    def run_migrations(self):
        """Run database migrations (if applicable)."""
        pass

    # ─── Common helper methods ──────────────────────────────────────────
    def get_workspace(self) -> Path:
        """Return the workspace directory for the project."""
        return self.workspace

    def get_project_name(self) -> str:
        """Return the project name from the blueprint or fallback."""
        return self.blueprint.data.get('project_name', self.project.name)

    def get_app_name(self) -> str:
        """Return the initial app name from the blueprint."""
        return self.blueprint.data.get('app_name', 'api')