from abc import ABC, abstractmethod
from pathlib import Path

class BaseFrontendGenerator(ABC):
    """Abstract base class for frontend generators."""

    def __init__(self, project, blueprint, workspace):
        self.project = project
        self.blueprint = blueprint
        self.workspace = Path(workspace)
        self.models = blueprint.data.get('models', [])

    @abstractmethod
    def generate(self):
        """Generate all frontend files."""
        pass

    def get_project_name(self):
        return self.blueprint.data.get('project_name', self.project.name)

    def get_app_name(self):
        return self.blueprint.data.get('app_name', 'api')