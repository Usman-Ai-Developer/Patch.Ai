import json
import subprocess
import textwrap
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from assistant.models import Project
from builder.models import Blueprint
from builder.services.frontend.react.writers.visual_pages import (
    render_page_code,
    build_component_source,
    build_theme_css,
    build_page_routes,
)
from builder.services.helpers import pluralize
from builder.services.frontend.react.writers.widget_manifest import WIDGET_MANIFEST, DESIGN_TOKENS
from builder.services.frontend.react.writers.visual_pages import WIDGET_RENDERERS
from builder.management.commands.export_widget_manifest import Command as ExportWidgetManifestCommand


class WidgetManifestParityTests(TestCase):
    """
    Guards the single-source-of-truth guarantee: every widget declared in
    widget_manifest.py must have a working renderer, and the checked-in
    frontend/components/visualbuilder/WidgetMetadata.generated.js must
    match what the manifest would generate right now. If this test fails,
    someone edited widget_manifest.py without running
    `python manage.py export_widget_manifest` and committing the result.
    """

    def test_every_widget_has_a_renderer(self):
        missing = [t for t in WIDGET_MANIFEST if t not in WIDGET_RENDERERS]
        self.assertEqual(missing, [], f"Widgets with no renderer: {missing}")

    def test_generic_widgets_have_a_render_spec(self):
        bad = [
            t for t, spec in WIDGET_MANIFEST.items()
            if spec["tier"] == "generic" and not spec.get("render")
        ]
        self.assertEqual(bad, [], f"Generic-tier widgets missing a render spec: {bad}")

    def test_smart_widgets_have_no_render_spec(self):
        # Smart widgets' JSX comes from a hand-written function, not the
        # generic interpreter, so they shouldn't carry a render spec that
        # would never be used (a stale one is a sign the tier was changed
        # without cleaning up the old spec).
        bad = [
            t for t, spec in WIDGET_MANIFEST.items()
            if spec["tier"] == "smart" and spec.get("render")
        ]
        self.assertEqual(bad, [], f"Smart-tier widgets with an unused render spec: {bad}")

    def test_generated_js_matches_manifest(self):
        cmd = ExportWidgetManifestCommand()
        generated = cmd._render_js()
        from pathlib import Path
        from django.conf import settings

        js_path = (
            Path(settings.BASE_DIR).parent
            / "frontend" / "components" / "visualbuilder" / "WidgetMetadata.generated.js"
        )
        if not js_path.exists():
            self.skipTest(f"{js_path} not found in this checkout layout — run with --out to verify manually.")
        on_disk = js_path.read_text(encoding="utf-8")
        self.assertEqual(
            generated, on_disk,
            "WidgetMetadata.generated.js is stale. Run "
            "`python manage.py export_widget_manifest` and commit the result.",
        )


class PluralizeContractTests(TestCase):
    """
    builder/services/helpers.py's pluralize() and
    frontend/components/visualbuilder/apiUtils.js's pluralize() are two
    hand-written implementations of the same rule (used to build DRF router
    paths on one side, and to preview/display those same paths on the
    other). Nothing stops them drifting apart except this test: it runs
    BOTH implementations against the shared fixture in
    tests_fixtures/pluralize_cases.json and fails if either one disagrees
    with the expected output, or if they disagree with each other.

    Requires Node.js on the test runner's PATH (it already is, since the
    same box needs it to build the generated frontend). If Node isn't
    available the test is skipped rather than failed, so it doesn't block
    a Python-only CI stage.
    """

    FIXTURE_PATH = Path(__file__).parent / "tests_fixtures" / "pluralize_cases.json"

    def _load_cases(self):
        data = json.loads(self.FIXTURE_PATH.read_text(encoding="utf-8"))
        return data["cases"]

    def _run_js_pluralize(self, words):
        """Runs the real apiUtils.js (not a re-typed copy) under Node and
        returns pluralize(word) for each word in `words`, in order."""
        api_utils_path = (
            Path(settings.BASE_DIR).parent
            / "frontend" / "components" / "visualbuilder" / "apiUtils.js"
        )
        if not api_utils_path.exists():
            self.skipTest(f"{api_utils_path} not found in this checkout layout.")

        # apiUtils.js is an ES module with a "use client" directive Next.js
        # understands but plain Node doesn't need — strip it, then import
        # the real file directly so we're testing the actual shipped code,
        # not a paraphrase of it.
        src = api_utils_path.read_text(encoding="utf-8").replace('"use client";', "")
        tmp_mjs = Path(settings.BASE_DIR) / "_pluralize_contract_tmp.mjs"
        tmp_mjs.write_text(src, encoding="utf-8")

        # Node's ESM loader needs a file:// URL; a bare "D:\..." path is
        # rejected with ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows.
        module_url = tmp_mjs.resolve().as_uri()
        script = textwrap.dedent(f"""
            import {{ pluralize }} from {json.dumps(module_url)};
            const words = {json.dumps(words)};
            console.log(JSON.stringify(words.map(pluralize)));
        """)

        try:
            result = subprocess.run(
                ["node", "--input-type=module", "-e", script],
                capture_output=True, text=True, timeout=15,
            )
        except FileNotFoundError:
            self.skipTest("Node.js not found on PATH — skipping JS/Python parity check.")
        finally:
            tmp_mjs.unlink(missing_ok=True)

        if result.returncode != 0:
            self.fail(f"Running apiUtils.js under Node failed:\n{result.stderr}")
        return json.loads(result.stdout)

    def test_python_matches_fixture(self):
        for word, expected in self._load_cases():
            with self.subTest(word=word):
                self.assertEqual(pluralize(word), expected)

    def test_js_matches_fixture(self):
        cases = self._load_cases()
        words = [c[0] for c in cases]
        expected = [c[1] for c in cases]
        got = self._run_js_pluralize(words)
        self.assertEqual(got, expected)

    def test_python_and_js_agree_with_each_other(self):
        cases = self._load_cases()
        words = [c[0] for c in cases]
        js_results = self._run_js_pluralize(words)
        py_results = [pluralize(w) for w in words]
        self.assertEqual(
            py_results, js_results,
            "pluralize() in helpers.py and apiUtils.js disagree — "
            "generated backend routes and the visual builder's endpoint "
            "preview will point at different URLs.",
        )


class DesignTokenParityTests(TestCase):
    """
    DESIGN_TOKENS in widget_manifest.py is a set of Tailwind class strings
    copied verbatim from the generated app's real components, so the
    Visual Builder canvas can style its Table/Form/DetailView/StatCard/
    DataList/Tabs/Navbar/Sidebar/auth/RoleGate/automation previews
    identically instead of approximating them. This test is what actually
    enforces "verbatim": it re-reads each token's declared source file and
    asserts the exact class string still appears in it. If a generated
    component's markup changes and DESIGN_TOKENS isn't updated to match,
    this fails instead of the canvas silently drifting from reality again.
    """

    SOURCE_DIRS = {
        "visual_runtime.py": Path(__file__).parent / "services" / "frontend" / "react" / "writers",
        "components.py": Path(__file__).parent / "services" / "frontend" / "react" / "writers",
        "sidebar.py": Path(__file__).parent / "services" / "frontend" / "react" / "writers",
        "visual_pages.py": Path(__file__).parent / "services" / "frontend" / "react" / "writers",
    }

    def test_every_token_is_verbatim_in_its_source(self):
        mismatches = []
        for key, token in DESIGN_TOKENS.items():
            source_file = self.SOURCE_DIRS.get(token["source"])
            if source_file is None:
                mismatches.append(f"{key}: unknown source file '{token['source']}'")
                continue
            path = source_file / token["source"]
            if not path.exists():
                mismatches.append(f"{key}: source file not found at {path}")
                continue
            content = path.read_text(encoding="utf-8")
            if token["value"] not in content:
                mismatches.append(
                    f"{key}: '{token['value']}' not found verbatim in {token['source']} "
                    f"— update DESIGN_TOKENS to match the real component."
                )
        self.assertEqual(mismatches, [], "\n".join(mismatches))

    def test_generated_js_includes_design_tokens(self):
        js_path = (
            Path(settings.BASE_DIR).parent
            / "frontend" / "components" / "visualbuilder" / "WidgetMetadata.generated.js"
        )
        if not js_path.exists():
            self.skipTest(f"{js_path} not found in this checkout layout.")
        content = js_path.read_text(encoding="utf-8")
        for key, token in DESIGN_TOKENS.items():
            self.assertIn(
                json.dumps(token["value"]), content,
                f"DESIGN_TOKENS['{key}'] not found in generated JS — run "
                f"`python manage.py export_widget_manifest`.",
            )


class VisualPageRenderTests(TestCase):
    """The studio's live code panel must show exactly what generation writes,
    and user text must never be able to escape into the generated file."""

    def _ctx(self, **overrides):
        ctx = {
            "models": [{
                "name": "Task",
                "app_name": "api",
                "fields": [
                    {"name": "title", "type": "CharField", "options": {"blank": False}},
                    {"name": "done", "type": "BooleanField", "options": {}},
                ],
            }],
            "app_name": "api",
            "project_name": "Demo",
            "roles": [],
            "design_tokens": {},
        }
        ctx.update(overrides)
        return ctx

    def test_user_text_is_escaped_not_interpolated(self):
        payload = '"><script>alert(1)</script>'
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "t", "type": "Text", "props": {"text": payload}},
        ]}
        code = render_page_code(tree, self._ctx(), "DemoPage")
        body = code.split("@end-visual-builder */", 1)[1]
        # The text is emitted as a JSON-escaped JS string expression, so it
        # can never become markup or a new attribute.
        self.assertIn('{"\\"><script>', body)
        self.assertNotIn(">" + payload + "</p>", body)
        self.assertNotIn('><script>alert(1)</script></p>', body)

    def test_component_name_is_sanitised(self):
        tree = {"id": "root", "type": "Column", "props": {}, "children": []}
        code = render_page_code(tree, self._ctx(), "1 bad-name!")
        self.assertIn("export default function _1badname()", code)

    def test_schema_comment_cannot_be_terminated_early(self):
        tree = {"id": "root", "type": "Text", "props": {"text": "*/ alert(1) /*"}}
        code = render_page_code(tree, self._ctx())
        head = code.split("@end-visual-builder */")[0]
        # The only terminator in the file is the block's own closing marker;
        # the one the user typed was escaped to *\/ inside the JSON.
        self.assertEqual(head.count("*/"), 0)
        self.assertEqual(code.count("@end-visual-builder */"), 1)
        self.assertIn("*\\/", code)

    def test_hash_is_stable_and_changes_with_the_tree(self):
        tree = {"id": "root", "type": "Column", "props": {}, "children": []}
        first = render_page_code(tree, self._ctx())
        again = render_page_code(tree, self._ctx())
        self.assertEqual(first, again)
        changed = render_page_code(
            {**tree, "children": [{"id": "t", "type": "Text", "props": {"text": "hi"}}]},
            self._ctx(),
        )
        self.assertNotEqual(first.split("@visual-builder-hash ")[1][:16],
                            changed.split("@visual-builder-hash ")[1][:16])

    def test_form_fields_respect_blank_false(self):
        tree = {"id": "root", "type": "Form", "props": {"model": "Task"}, "children": []}
        code = render_page_code(tree, self._ctx())
        self.assertIn('"name": "title"', code)
        self.assertIn('"required": true', code)

    def test_auto_layout_sizing_modes(self):
        tree = {"id": "root", "type": "Column",
                "props": {"widthMode": "fill", "heightMode": "hug"}, "children": []}
        code = render_page_code(tree, self._ctx())
        self.assertIn('"width": "100%"', code)
        self.assertIn('"height": "fit-content"', code)

    def test_fixed_sizing_keeps_pixel_width(self):
        tree = {"id": "root", "type": "Column",
                "props": {"width": 320, "widthMode": "fixed"}, "children": []}
        code = render_page_code(tree, self._ctx())
        self.assertIn('"width": "320px"', code)

    def test_auto_layout_direction_wrap_and_px_gap(self):
        tree = {"id": "root", "type": "Column",
                "props": {"flexDirection": "row", "flexWrap": "nowrap", "gapPx": 12},
                "children": []}
        code = render_page_code(tree, self._ctx())
        self.assertIn('"flexDirection": "row"', code)
        self.assertIn('"flexWrap": "nowrap"', code)
        self.assertIn('"gap": "12px"', code)

    # ─── Variables & light/dark modes ────────────────────────────────

    def test_token_color_renders_as_css_variable(self):
        ctx = self._ctx(design_tokens={"colors": [
            {"id": "brand", "name": "Brand", "value": "#123456", "dark": "#abcdef"},
        ]})
        tree = {"id": "root", "type": "Text", "props": {"text": "hi", "color": "@token:brand"}}
        code = render_page_code(tree, ctx)
        self.assertIn('"color": "var(--c-brand)"', code)
        self.assertNotIn("#123456", code)

    def test_theme_css_emits_light_and_dark_modes(self):
        css = build_theme_css({"colors": [
            {"id": "brand", "value": "#123456", "dark": "#abcdef"},
        ]})
        self.assertIn("--c-brand: #123456;", css)
        self.assertIn('[data-theme="dark"]', css)
        self.assertIn("--c-brand: #abcdef;", css)
        self.assertIn("prefers-color-scheme", css)

    def test_theme_css_is_empty_without_colors(self):
        self.assertEqual(build_theme_css({}), "")
        self.assertEqual(build_theme_css(None), "")
        self.assertEqual(build_theme_css({"colors": []}), "")

    # ─── Prototype actions ───────────────────────────────────────────

    def test_navigate_action_emits_hook_and_handler(self):
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "b", "type": "Button",
             "props": {"text": "Go", "action": {"type": "navigate", "target": "/tasks"}}},
        ]}
        code = render_page_code(tree, self._ctx())
        self.assertIn("import { useNavigate } from 'react-router-dom';", code)
        self.assertIn("const navigate = useNavigate();", code)
        self.assertIn('navigate("/tasks")', code)

    def test_url_action_opens_in_new_tab(self):
        tree = {"id": "root", "type": "Text",
                "props": {"text": "docs",
                          "action": {"type": "url", "target": "https://example.com"}}}
        code = render_page_code(tree, self._ctx())
        self.assertIn('window.open("https://example.com", "_blank", "noopener")', code)
        self.assertNotIn("useNavigate", code)

    def test_actionless_page_has_no_navigation_hook(self):
        tree = {"id": "root", "type": "Column", "props": {}, "children": []}
        code = render_page_code(tree, self._ctx())
        self.assertNotIn("useNavigate", code)

    def test_page_routes_map_models_and_custom_pages(self):
        routes = build_page_routes(
            [{"name": "Task"}], {}, [{"name": "About Us", "path": "/about"}]
        )
        self.assertEqual(routes["/tasks"], "TaskList")
        self.assertEqual(routes["/about"], "AboutUsPage")

    def test_overlay_action_imports_target_and_renders_modal(self):
        ctx = self._ctx(page_routes={"/about": "AboutPage"})
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "b", "type": "Button", "props": {"text": "About", "action": {
                "type": "overlay", "target": "/about", "transition": "slide", "duration": 300}}},
        ]}
        code = render_page_code(tree, ctx)
        self.assertIn("import React, { useState } from 'react';", code)
        self.assertIn("import AboutPage from './AboutPage';", code)
        self.assertIn("const [overlayPage, setOverlayPage] = useState(null);", code)
        self.assertIn('onClick={() => setOverlayPage("AboutPage")}', code)
        self.assertIn('data-transition="slide"', code)
        self.assertIn('animationDuration: "300ms"', code)
        self.assertIn("<AboutPage />", code)

    def test_overlay_with_unknown_route_is_ignored(self):
        tree = {"id": "root", "type": "Text",
                "props": {"text": "x", "action": {"type": "overlay", "target": "/nope"}}}
        code = render_page_code(tree, self._ctx())
        self.assertNotIn("overlayPage", code)
        self.assertNotIn("useState", code)

    # ─── Typed component properties ──────────────────────────────────

    def test_typed_component_properties(self):
        comp = {
            "id": "cmp_typed", "name": "Card",
            "tree": {"id": "t", "type": "Text",
                     "props": {"text": "Hi", "fontSize": "16px", "color": "#111111"}},
            "properties": [
                {"id": "p_text", "name": "Title", "nodeId": "t", "prop": "text", "type": "text"},
                {"id": "p_fs", "name": "Font size", "nodeId": "t", "prop": "fontSize", "type": "number"},
                {"id": "p_color", "name": "Color", "nodeId": "t", "prop": "color", "type": "color"},
                {"id": "p_show", "name": "Show", "nodeId": "t", "prop": "visible", "type": "boolean"},
            ],
        }
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertIn('overrides["p_text"] ?? "Hi"', source)
        self.assertIn('overrides["p_fs"] ?? "16px"', source)
        self.assertIn('overrides["p_color"] ?? "#111111"', source)
        self.assertIn('overrides["p_show"] !== false &&', source)

    def test_instance_override_values_reach_generated_code(self):
        comp = {
            "id": "cmp_typed", "name": "Card",
            "tree": {"id": "t", "type": "Text", "props": {"text": "Hi"}},
            "properties": [
                {"id": "p_text", "name": "Title", "nodeId": "t", "prop": "text", "type": "text"},
            ],
        }
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "i", "type": "Instance", "props": {
                "componentId": "cmp_typed", "overrides": {"p_text": "Custom"}}},
        ]}
        code = render_page_code(tree, self._ctx(components=[comp]))
        self.assertIn('overrides={{"p_text": "Custom"}}', code)

    def test_interactive_variant_switches_state(self):
        comp = {
            "id": "cmp_toggle", "name": "Toggle",
            "tree": {"id": "b", "type": "Button", "props": {
                "text": "Switch", "action": {"type": "variant", "target": "v2"}}},
            "variants": [{"id": "v2", "name": "On", "tree": {
                "id": "b2", "type": "Button", "props": {"text": "On"}}}],
        }
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertIn("import React, { useState } from 'react';", source)
        self.assertIn('variant: initialVariant = "Default"', source)
        self.assertIn("const [variant, setVariant] = useState(initialVariant);", source)
        self.assertIn('setVariant("On")', source)
        self.assertIn('if (variant === "On")', source)

    def test_variant_action_with_unknown_target_is_inert(self):
        comp = {"id": "cmp_plain", "name": "Plain", "tree": {
            "id": "t", "type": "Text",
            "props": {"text": "x", "action": {"type": "variant", "target": "missing"}}}}
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertNotIn("setVariant", source)
        self.assertIn("export default function Plain(", source)

    # ─── Conditional logic ───────────────────────────────────────────

    def test_boolean_condition_gates_rendering(self):
        comp = {
            "id": "cmp_cond", "name": "Cond",
            "tree": {"id": "t", "type": "Text", "props": {
                "text": "Hi", "condition": {"propertyId": "p_show", "equals": "false"}}},
            "properties": [
                {"id": "p_show", "name": "Show", "nodeId": "t", "prop": "visible",
                 "type": "boolean"},
            ],
        }
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertIn('overrides["p_show"] === false &&', source)

    def test_condition_defaults_to_shown_when_on(self):
        comp = {
            "id": "cmp_cond2", "name": "Cond2",
            "tree": {"id": "t", "type": "Text", "props": {
                "text": "Hi", "condition": {"propertyId": "p_show"}}},
            "properties": [
                {"id": "p_show", "name": "Show", "nodeId": "t", "prop": "visible",
                 "type": "boolean"},
            ],
        }
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertIn('overrides["p_show"] !== false &&', source)

    # ─── Reusable components ─────────────────────────────────────────

    def _components(self):
        return [
            {"id": "cmp_card", "name": "My Card", "tree": {
                "id": "c1", "type": "Column", "props": {},
                "children": [{"id": "c2", "type": "Text", "props": {"text": "Card body"}}],
            }},
            {"id": "cmp_outer", "name": "Outer", "tree": {
                "id": "o1", "type": "Column", "props": {},
                "children": [{"id": "o2", "type": "Instance", "props": {"componentId": "cmp_card"}}],
            }},
            {"id": "cmp_a", "name": "A", "tree": {"id": "a1", "type": "Column", "props": {}, "children": [
                {"id": "a2", "type": "Instance", "props": {"componentId": "cmp_b"}}]}},
            {"id": "cmp_b", "name": "B", "tree": {"id": "b1", "type": "Column", "props": {}, "children": [
                {"id": "b2", "type": "Instance", "props": {"componentId": "cmp_a"}}]}},
        ]

    def test_instance_becomes_component_usage_with_import(self):
        ctx = self._ctx(components=self._components())
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "i1", "type": "Instance", "props": {"componentId": "cmp_card"}},
        ]}
        code = render_page_code(tree, ctx, "Page")
        self.assertIn("import MyCard from '../components/visual/MyCard';", code)
        self.assertIn("<MyCard />", code)
        self.assertNotIn("Card body", code)

    def test_missing_instance_is_a_comment_not_a_crash(self):
        tree = {"id": "root", "type": "Instance", "props": {"componentId": "nope"}}
        code = render_page_code(tree, self._ctx())
        self.assertIn("not found", code)
        self.assertIn("export default function", code)

    def test_component_file_inlines_nested_instances(self):
        comp = self._components()[1]  # Outer -> My Card
        source = build_component_source(comp, self._ctx(components=self._components()))
        self.assertIn("export default function Outer(", source)
        self.assertIn("Card body", source)
        self.assertNotIn("import MyCard", source)

    def test_cyclic_components_stop_with_a_comment(self):
        comp = self._components()[2]  # A -> B -> A
        source = build_component_source(comp, self._ctx(components=self._components()))
        self.assertIn("Cyclic component reference", source)

    def _property_component(self):
        comp = dict(self._components()[0])
        comp["properties"] = [{"id": "p1", "name": "Title", "nodeId": "c2", "prop": "text"}]
        comp["variants"] = [{"id": "v1", "name": "Compact", "tree": {
            "id": "v1root", "type": "Column", "props": {},
            "children": [{"id": "v1t", "type": "Text", "props": {"text": "Small"}}],
        }}]
        return comp

    def test_instance_emits_variant_and_override_props(self):
        comp = self._property_component()
        tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "i1", "type": "Instance", "props": {
                "componentId": "cmp_card", "variantId": "v1", "overrides": {"p1": "Custom"}}},
        ]}
        code = render_page_code(tree, self._ctx(components=[comp]), "Page")
        self.assertIn('variant="Compact"', code)
        # JSX object prop: outer braces are the expression, inner ones the object.
        self.assertIn('overrides={{"p1": "Custom"}}', code)

    def test_component_file_switches_variants_and_applies_overrides(self):
        comp = self._property_component()
        source = build_component_source(comp, self._ctx(components=[comp]))
        self.assertIn('export default function MyCard({ variant = "Default", overrides = {} } = {})', source)
        self.assertIn('if (variant === "Compact")', source)
        self.assertIn('overrides["p1"] ?? "Card body"', source)
        # The variant body is present too.
        self.assertIn("Small", source)


class RenderPageCodeViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="renderer", password="pw-test-12345")
        self.project = Project.objects.create(name="Render Project", owner=self.user)
        Blueprint.objects.create(project=self.project, framework="drf", data={
            "models": [],
            "app_name": "api",
            "project_name": "Render Project",
            "frontend": {"designTokens": {}},
        })
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = reverse("render-page-code", kwargs={"project_id": self.project.id})
        self.tree = {"id": "root", "type": "Column", "props": {}, "children": [
            {"id": "h", "type": "Heading", "props": {"text": "Dashboard"}},
        ]}

    def test_returns_code_and_hash(self):
        response = self.client.post(self.url, {"tree": self.tree, "component_name": "OverviewPage"},
                                    format="json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("export default function OverviewPage()", body["code"])
        self.assertEqual(len(body["hash"]), 16)
        self.assertEqual(body["component_name"], "OverviewPage")

    def test_rejects_missing_tree(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_oversized_tree(self):
        deep = {"id": "leaf", "type": "Text", "props": {"text": "x"}}
        for i in range(70):
            deep = {"id": f"n{i}", "type": "Column", "props": {}, "children": [deep]}
        response = self.client.post(self.url, {"tree": deep}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_other_users_project_is_not_found(self):
        stranger = User.objects.create_user(username="stranger", password="pw-test-12345")
        other = APIClient()
        other.force_authenticate(stranger)
        response = other.post(self.url, {"tree": self.tree}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_component_mode_renders_the_component_file(self):
        Blueprint.objects.filter(project=self.project).update(data={
            "models": [], "app_name": "api", "project_name": "Render Project",
            "frontend": {"designTokens": {}, "components": [
                {"id": "cmp1", "name": "Hero Card", "tree": {
                    "id": "h1", "type": "Column", "props": {},
                    "children": [{"id": "h2", "type": "Text", "props": {"text": "Hello"}}],
                }},
            ]},
        })
        response = self.client.post(self.url, {
            "tree": {"id": "h1", "type": "Column", "props": {}, "children": []},
            "component_name": "Hero Card",
            "as_component": True,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("export default function HeroCard(", body["code"])
        # A component file has no page schema header — it is not a page.
        self.assertNotIn("@visual-builder-schema", body["code"])
        self.assertEqual(body["file"], "src/components/visual/HeroCard.jsx")

    def test_page_mode_returns_page_file_path(self):
        response = self.client.post(
            self.url, {"tree": self.tree, "component_name": "OverviewPage"}, format="json"
        )
        self.assertEqual(response.json()["file"], "src/pages/OverviewPage.jsx")
