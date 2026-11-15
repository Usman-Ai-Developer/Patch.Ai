from pathlib import Path
from ..base import BaseFrontendGenerator
from .writers import (
    write_package_json,
    write_vite_config,
    write_index_html,
    write_main_jsx,
    write_theme_css,
    write_app_jsx,
    write_api_client,
    write_pages,
    write_components,
    write_tailwind_config,
    write_postcss_config,
    write_layout,
    write_sidebar,
    write_dashboard,
    write_route_utils,
    write_forms,
    write_tables,
    write_custom_pages,
    write_visual_pages,
    write_visual_runtime,
    write_login_page,
    write_signup_page,
    write_landing_page,
    write_auth_layout,
)

class ReactGenerator(BaseFrontendGenerator):
    def __init__(self, project, blueprint, workspace):
        super().__init__(project, blueprint, workspace)
        self.frontend_dir = self.workspace / "frontend"
        self.src_dir = self.frontend_dir / "src"
        self.api_dir = self.src_dir / "api"
        self.pages_dir = self.src_dir / "pages"
        self.components_dir = self.src_dir / "components"
        self.hooks_dir = self.src_dir / "hooks"
        self.utils_dir = self.src_dir / "utils"
        self.types_dir = self.src_dir / "types"

        self.frontend_config = blueprint.data.get('frontend', {})
        enabled_pages = self.frontend_config.get('pages', {}).get('enabled', [])
        self.custom_pages = self.frontend_config.get('pages', {}).get('custom', [])
        self.page_settings = self.frontend_config.get('pages', {}).get('settings', {})

        all_models = blueprint.data.get('models', [])
        if enabled_pages:
            self.models = [m for m in all_models if m['name'] in enabled_pages]
        else:
            self.models = all_models

        self.app_name = blueprint.data.get('app_name', 'api')
        self.project_name = blueprint.data.get('project_name', self.project.name)
        self.settings = blueprint.data.get('settings', {})
        self.roles = blueprint.data.get('roles', [])   # <-- roles already available
        self.design_tokens = self.frontend_config.get('designTokens', {})

    def generate(self):
        self.frontend_dir.mkdir(parents=True, exist_ok=True)
        self.src_dir.mkdir(parents=True, exist_ok=True)
        self.api_dir.mkdir(parents=True, exist_ok=True)
        self.pages_dir.mkdir(parents=True, exist_ok=True)
        self.components_dir.mkdir(parents=True, exist_ok=True)
        self.hooks_dir.mkdir(parents=True, exist_ok=True)
        self.utils_dir.mkdir(parents=True, exist_ok=True)
        self.types_dir.mkdir(parents=True, exist_ok=True)

        write_package_json(self.frontend_dir)
        write_vite_config(self.frontend_dir)
        write_index_html(self.frontend_dir, self.project_name)
        write_main_jsx(self.src_dir)
        write_theme_css(self.src_dir, self.design_tokens)
        write_app_jsx(self.src_dir, self.project_name, self.models, self.frontend_config, self.custom_pages)
        write_layout(self.src_dir, self.models)
        write_sidebar(self.src_dir, self.models, self.frontend_config, self.custom_pages)
        write_dashboard(self.pages_dir, self.models)
        write_route_utils(self.utils_dir, self.models, self.frontend_config, self.custom_pages)
        write_api_client(self.api_dir, self.models, self.app_name)
        write_forms(self.components_dir, self.models)
        write_tables(self.components_dir, self.models)
        write_pages(self.pages_dir, self.models, self.app_name, self.page_settings)
        write_custom_pages(self.pages_dir, self.custom_pages)

        # ─── Visual Builder pages ───────────────────────────────────────
        # Overwrites/creates any page (model page or custom page) that has
        # a `layout` widget tree defined. Pages without a layout are left
        # exactly as written above — this is purely additive.
        visual_written = write_visual_pages(
            self.pages_dir,
            self.models,
            self.app_name,
            self.project_name,
            self.page_settings,
            self.custom_pages,
            self.roles,
            self.design_tokens,
            components=self.frontend_config.get("components", []),
            components_dir=self.components_dir,
        )
        if visual_written:
            write_visual_runtime(self.components_dir)

        write_components(self.components_dir, self.models, self.app_name)

        # ─── Write auth pages ───────────────────────────────────────────
        write_login_page(self.pages_dir)
        write_signup_page(self.pages_dir, self.roles)   # <-- FIXED
        write_landing_page(self.pages_dir)
        write_auth_layout(self.src_dir)

        write_tailwind_config(self.frontend_dir)
        write_postcss_config(self.frontend_dir)

        print(f"[INFO] React frontend generated at {self.frontend_dir}")
        return True