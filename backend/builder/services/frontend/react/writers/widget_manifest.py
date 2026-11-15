# backend/builder/services/frontend/react/writers/widget_manifest.py
"""
Canonical widget manifest for the Visual Builder.

This is the ONE place that defines what widget types exist, what props they
take, and (for the 16 "generic" widgets) exactly how they render. Everything
else derives from this file instead of hand-duplicating it:

  - `visual_pages.py` renders "generic" widgets with a single interpreter
    (`render_generic`) driven by the `render` spec below, instead of one
    hand-written Python function per widget.
  - `export_widget_manifest` (management command) generates
    `frontend/components/visualbuilder/WidgetMetadata.generated.js` from
    this exact data, so the canvas palette/property panel never has to be
    hand-typed to match.
  - `WidgetManifestView` exposes this over `/api/builder/widgets/` for
    tooling and the CI parity test (see builder/tests.py).

Two tiers:
  - "generic": pure layout/content widgets. Rendering is fully described by
    `render` below — tag, class template, where text/children go. Adding a
    prop or a new generic widget never requires touching render code.
  - "smart": data-bound or stateful widgets (Table, Form, Tabs, Navbar, ...).
    These need real bespoke logic on both sides (they bind to models, auth,
    tab state, etc.) so they keep hand-written renderers in `visual_pages.py`
    and hand-written Preview components in `WidgetRegistry.js`. Only their
    metadata (label/icon/category/propsSchema/defaultProps) comes from here.

`render` spec fields (generic tier only), all optional unless noted:
  kind          (required) one of: "container" | "text" | "void" | "media" | "link"
  tag           HTML tag to emit. May reference a prop with "$level" style
                tokens resolved via `tagFromProp` + `tagMap` (see Heading).
  tagFromProp   name of the prop that selects the tag (e.g. "level")
  tagMap        {prop value: tag} lookup used with tagFromProp
  classTemplate class string; "{extra}" is replaced with props.className,
                other "{propName}" tokens are replaced with that prop's value
  classMap      {propName: {value: extraClass}} — e.g. Button's variant
  classFromLevel{level: classFragment} — used by Heading alongside tagMap
  textProp      name of the prop holding the widget's inner text
  textDefault   fallback text if textProp is empty
  hrefProp      name of the prop holding a link href (uses react-router Link)
  hrefDefault   fallback href
  hrefTemplate  special-cased href that isn't a plain prop (AdminLink only;
                resolved by a small allow-list in render_generic, not eval'd)
  srcProp/altProp  for "media" kind (Image)
  titleProp     optional heading rendered before children (Card)
  selfClosing   true for void elements (hr, spacer div, img)
"""

CATEGORIES = [
    "Layout",
    "Content",
    "Data",
    "Navigation",
    "Auth",
    "Access",
    "Automation",
    "Admin",
]

_COMMON_STYLE_PROPS = {
    # x/y are only meaningful when a widget's immediate parent is a
    # free-positioning container (currently only "Frame" — see below and
    # render_children()'s freePositioning branch in visual_pages.py). For
    # every other parent (Row/Column/Grid, still real document flow)
    # they're inert: position comes from tree order, not these values.
    "x": 0,
    "y": 0,
    # width/height default to "auto" so flow-layout containers size to
    # their content by default; a numeric value still renders as a real
    # inline style when the user sets one. Frame overrides these defaults
    # (see the WIDGET_MANIFEST["Frame"] patch below) since a free-position
    # canvas needs a concrete size to place children against.
    "width": "auto",
    "height": "auto",
    "rotation": 0,
    "opacity": 1,
    "zIndex": 0,
    "backgroundColor": "transparent",
    "color": "inherit",
    "border": "none",
    "borderRadius": "0px",
    "boxShadow": "none",
    "fontSize": "inherit",
    "fontWeight": "normal",
    # A reference to a project-level named text style ("@token:<id>", see
    # design_tokens.textStyles) that overrides fontSize/fontWeight when
    # set. Empty string = no token, use fontSize/fontWeight directly.
    "textStyle": "",
    "textAlign": "left",
    "padding": "0px",
    "margin": "0px",
}


def _widget(category, label, icon, is_container, default_props, props_schema, tier, render=None):
    return {
        "category": category,
        "label": label,
        "icon": icon,
        "isContainer": is_container,
        "defaultProps": {**default_props, **_COMMON_STYLE_PROPS},
        "propsSchema": props_schema,
        "tier": tier,
        "render": render,
    }


WIDGET_MANIFEST = {
    # ─── Layout (generic) ────────────────────────────────────────────

    # Frame: the one free-positioning container (Figma-style manual
    # canvas). Every other container here is real document flow — Frame is
    # the deliberate exception, and its children get position:absolute via
    # x/y (see render_children()'s freePositioning branch in
    # visual_pages.py). Nesting a flow container (Row/Column/Grid) inside a
    # Frame is fine — a Frame's *own* children are free-positioned, but a
    # nested Row/Column/Grid still lays out *its* children in flow, same
    # as anywhere else.
    "Frame": _widget(
        "Layout", "Frame", "crop_free", True,
        {"backgroundColor": "#ffffff"},
        [{"key": "width", "label": "Width", "type": "number"},
         {"key": "height", "label": "Height", "type": "number"}], "generic",
        render={"kind": "container", "tag": "div",
                "classTemplate": "relative overflow-hidden border border-line {extra}",
                "freePositioning": True},
    ),
    "Row": _widget(
        "Layout", "Row", "view_column", True,
        {"gap": 4, "align": "stretch", "justify": "start"},
        [{"key": "gap", "label": "Gap", "type": "number"},
         {"key": "align", "label": "Align items", "type": "select",
          "options": ["start", "center", "end", "stretch"]},
         {"key": "justify", "label": "Justify content", "type": "select",
          "options": ["start", "center", "end", "between", "around"]}], "generic",
        render={"kind": "container", "tag": "div",
                "classTemplate": "flex flex-row flex-wrap gap-{gap} {alignClass} {justifyClass} {extra}",
                "classMap": {
                    "align": {"start": "items-start", "center": "items-center",
                              "end": "items-end", "stretch": "items-stretch"},
                    "justify": {"start": "justify-start", "center": "justify-center",
                                "end": "justify-end", "between": "justify-between",
                                "around": "justify-around"},
                }},
    ),
    "Column": _widget(
        "Layout", "Column", "view_agenda", True,
        {"gap": 4, "align": "stretch", "justify": "start"},
        [{"key": "gap", "label": "Gap", "type": "number"},
         {"key": "align", "label": "Align items", "type": "select",
          "options": ["start", "center", "end", "stretch"]},
         {"key": "justify", "label": "Justify content", "type": "select",
          "options": ["start", "center", "end", "between", "around"]}], "generic",
        render={"kind": "container", "tag": "div",
                "classTemplate": "flex flex-col gap-{gap} {alignClass} {justifyClass} {extra}",
                "classMap": {
                    "align": {"start": "items-start", "center": "items-center",
                              "end": "items-end", "stretch": "items-stretch"},
                    "justify": {"start": "justify-start", "center": "justify-center",
                                "end": "justify-end", "between": "justify-between",
                                "around": "justify-around"},
                }},
    ),
    "Grid": _widget(
        "Layout", "Grid", "grid_view", True,
        {"columns": 3, "gap": 4, "align": "stretch", "justify": "start"},
        [{"key": "columns", "label": "Columns", "type": "number"},
         {"key": "gap", "label": "Gap", "type": "number"},
         {"key": "align", "label": "Align items", "type": "select",
          "options": ["start", "center", "end", "stretch"]},
         {"key": "justify", "label": "Justify items", "type": "select",
          "options": ["start", "center", "end", "between", "around"]}], "generic",
        render={"kind": "container", "tag": "div",
                "classTemplate": "grid grid-cols-1 md:grid-cols-{columns} gap-{gap} {alignClass} {justifyClass} {extra}",
                "classMap": {
                    "align": {"start": "items-start", "center": "items-center",
                              "end": "items-end", "stretch": "items-stretch"},
                    "justify": {"start": "justify-start", "center": "justify-center",
                                "end": "justify-end", "between": "justify-between",
                                "around": "justify-around"},
                }},
    ),
    "Card": _widget(
        "Layout", "Card", "dashboard_customize", True, {"title": "Card title"},
        [{"key": "title", "label": "Title", "type": "text"}], "generic",
        render={"kind": "container", "tag": "div",
                "classTemplate": "bg-surface border border-line rounded-lg p-4 {extra}",
                "titleProp": "title"},
    ),
    "Section": _widget(
        "Layout", "Section", "web", True, {}, [], "generic",
        render={"kind": "container", "tag": "section", "classTemplate": "py-6 {extra}"},
    ),
    "Divider": _widget(
        "Layout", "Divider", "horizontal_rule", False, {}, [], "generic",
        render={"kind": "void", "tag": "hr", "classTemplate": "border-line my-4"},
    ),
    "Spacer": _widget(
        "Layout", "Spacer", "space_bar", False, {"size": 4},
        [{"key": "size", "label": "Size", "type": "number"}], "generic",
        render={"kind": "void", "tag": "div", "classTemplate": "h-{size}"},
    ),

    # ─── Content (generic) ─────────────────────────────────────────────
    "Heading": _widget(
        "Content", "Heading", "title", False, {"text": "Heading", "level": 2},
        [{"key": "text", "label": "Text", "type": "text"},
         {"key": "level", "label": "Level (1-4)", "type": "number"}], "generic",
        render={"kind": "text", "tagFromProp": "level",
                "tagMap": {1: "h1", 2: "h2", 3: "h3", 4: "h4"},
                "classFromLevel": {1: "text-3xl", 2: "text-2xl", 3: "text-xl", 4: "text-lg"},
                "classTemplate": "{levelClass} font-bold {extra}",
                "textProp": "text", "textDefault": "Heading"},
    ),
    "Text": _widget(
        "Content", "Text", "notes", False, {"text": "Some text"},
        [{"key": "text", "label": "Text", "type": "textarea"}], "generic",
        render={"kind": "text", "tag": "p",
                "classTemplate": "text-on-surface-variant {extra}",
                "textProp": "text", "textDefault": "Text"},
    ),
    "Image": _widget(
        "Content", "Image", "image", False,
        {"src": "https://placehold.co/400x200", "alt": ""},
        [{"key": "src", "label": "Image URL", "type": "text"},
         {"key": "alt", "label": "Alt text", "type": "text"}], "generic",
        render={"kind": "media", "srcProp": "src", "altProp": "alt",
                "classTemplate": "max-w-full h-auto rounded-lg {extra}"},
    ),
    "Button": _widget(
        "Content", "Button", "smart_button", False,
        {"label": "Button", "variant": "primary", "href": ""},
        [{"key": "label", "label": "Label", "type": "text"},
         {"key": "variant", "label": "Variant", "type": "select",
          "options": ["primary", "secondary", "danger"]},
         {"key": "href", "label": "Link to (optional)", "type": "text"}], "generic",
        render={"kind": "link", "tag": "button", "linkTag": "Link",
                "hrefProp": "href", "textProp": "label", "textDefault": "Button",
                "classTemplate": "px-4 py-2 rounded-lg font-medium transition {variantClass}",
                "classMap": {"variant": {
                    "primary": "bg-brand-100 text-white hover:opacity-90",
                    "secondary": "bg-surface border border-line hover:bg-surface-container",
                    "danger": "bg-red-600 text-white hover:bg-red-700",
                }}, "classMapDefault": "bg-brand-100 text-white hover:opacity-90"},
    ),
    "Link": _widget(
        "Content", "Link", "link", False, {"label": "Link", "href": "/"},
        [{"key": "label", "label": "Label", "type": "text"},
         {"key": "href", "label": "Href", "type": "text"}], "generic",
        render={"kind": "link", "linkTag": "Link", "hrefProp": "href", "hrefDefault": "/",
                "textProp": "label", "textDefault": "Link",
                "classTemplate": "text-brand-100 hover:underline {extra}"},
    ),
    "Icon": _widget(
        "Content", "Icon", "emoji_symbols", False, {"name": "star"},
        [{"key": "name", "label": "Material icon name", "type": "text"}], "generic",
        render={"kind": "text", "tag": "span",
                "classTemplate": "material-symbols-outlined {extra}",
                "textProp": "name", "textDefault": "star"},
    ),
    "Badge": _widget(
        "Content", "Badge", "new_releases", False, {"label": "Badge"},
        [{"key": "label", "label": "Label", "type": "text"}], "generic",
        render={"kind": "text", "tag": "span",
                "classTemplate": "inline-block text-xs px-2 py-1 rounded-full bg-brand-100/10 text-brand-100 {extra}",
                "textProp": "label", "textDefault": "Badge"},
    ),

    # ─── Data (smart — model-bound, needs real API wiring) ─────────────
    "Table": _widget(
        "Data", "Table", "table_rows", False,
        {"model": "", "fields": [], "showActions": True},
        [{"key": "model", "label": "Model", "type": "model"},
         {"key": "fields", "label": "Fields (empty = all)", "type": "fieldList"},
         {"key": "showActions", "label": "Show Edit/Delete", "type": "boolean"}], "smart",
    ),
    "Form": _widget(
        "Data", "Form", "dynamic_form", False,
        {"model": "", "mode": "create", "fields": []},
        [{"key": "model", "label": "Model", "type": "model"},
         {"key": "mode", "label": "Mode", "type": "select", "options": ["create", "edit"]},
         {"key": "fields", "label": "Fields (empty = all)", "type": "fieldList"}], "smart",
    ),
    "DetailView": _widget(
        "Data", "Detail View", "description", False, {"model": "", "fields": []},
        [{"key": "model", "label": "Model", "type": "model"},
         {"key": "fields", "label": "Fields (empty = all)", "type": "fieldList"}], "smart",
    ),
    "StatCard": _widget(
        "Data", "Stat Card", "monitoring", False, {"model": "", "label": "Total"},
        [{"key": "model", "label": "Model (count of records)", "type": "model"},
         {"key": "label", "label": "Label", "type": "text"}], "smart",
    ),
    "DataList": _widget(
        "Data", "Data List", "list", False, {"model": "", "titleField": ""},
        [{"key": "model", "label": "Model", "type": "model"},
         {"key": "titleField", "label": "Title field", "type": "field"}], "smart",
    ),

    # ─── Layout (smart — needs tab-switching state) ─────────────────────
    "Tabs": _widget(
        "Layout", "Tabs", "tab", True, {"tabs": ["Tab 1", "Tab 2"]},
        [{"key": "tabs", "label": "Tab labels (comma separated)", "type": "list"}], "smart",
    ),

    # ─── Navigation (mixed) ──────────────────────────────────────────
    "Navbar": _widget(
        "Navigation", "Navbar", "web_asset", False, {}, [], "smart",
    ),
    "Sidebar": _widget(
        "Navigation", "Sidebar", "side_navigation", False, {}, [], "smart",
    ),
    "NavLink": _widget(
        "Navigation", "Nav Link", "chevron_right", False, {"label": "Link", "href": "/"},
        [{"key": "label", "label": "Label", "type": "text"},
         {"key": "href", "label": "Href", "type": "text"}], "generic",
        render={"kind": "link", "linkTag": "Link", "hrefProp": "href", "hrefDefault": "/",
                "textProp": "label", "textDefault": "Link",
                "classTemplate": "block px-3 py-2 rounded hover:bg-surface-container"},
    ),

    # ─── Auth (smart — fixed links into generated auth pages) ──────────
    "LoginCta": _widget(
        "Auth", "Login Link", "login", False, {}, [], "smart",
    ),
    "SignupCta": _widget(
        "Auth", "Signup Link", "person_add", False, {}, [], "smart",
    ),

    # ─── Access control (smart — documentation-only overlay) ───────────
    "RoleGate": _widget(
        "Access", "Role Gate", "shield", True, {"roles": []},
        [{"key": "roles", "label": "Visible to role(s)", "type": "roleList"}], "smart",
    ),

    # ─── Automation (smart — disabled placeholders) ─────────────────────
    "AiActionButton": _widget(
        "Automation", "AI Action Button", "auto_awesome", False, {"label": "AI Action"},
        [{"key": "label", "label": "Label", "type": "text"}], "smart",
    ),
    "WorkflowTriggerButton": _widget(
        "Automation", "Workflow Trigger", "sync", False, {"label": "Run Workflow"},
        [{"key": "label", "label": "Label", "type": "text"}], "smart",
    ),

    # ─── Admin (generic — special-cased href, still declarative) ───────
    "AdminLink": _widget(
        "Admin", "Admin Link", "admin_panel_settings", False, {"label": "Open Admin"},
        [{"key": "label", "label": "Label", "type": "text"}], "generic",
        render={"kind": "link", "tag": "a", "hrefTemplate": "admin-url",
                "newTab": True, "textProp": "label", "textDefault": "Open Admin",
                "classTemplate": "px-4 py-2 rounded-lg font-medium bg-surface border border-line hover:bg-surface-container inline-block"},
    ),
}

# Frame needs a concrete default size (unlike every other widget, which
# defaults to "auto" so it sizes to content) — a free-position canvas has
# nothing to size against otherwise. _widget() can't express this itself
# since _COMMON_STYLE_PROPS always wins over a widget's own defaultProps.
WIDGET_MANIFEST["Frame"]["defaultProps"]["width"] = 800
WIDGET_MANIFEST["Frame"]["defaultProps"]["height"] = 600


def generic_types():
    return [t for t, spec in WIDGET_MANIFEST.items() if spec["tier"] == "generic"]


def smart_types():
    return [t for t, spec in WIDGET_MANIFEST.items() if spec["tier"] == "smart"]


# ---------------------------------------------------------------------
# Design tokens for the 13 "smart" widgets' canvas Preview components.
#
# Generic widgets are automatically WYSIWYG — GenericPreview.js and
# render_generic() both read the same classTemplate out of WIDGET_MANIFEST
# above. Smart widgets can't work that way (their real markup lives in
# static template strings inside visual_runtime.py / visual_pages.py, not
# a per-node spec) — but their canvas Preview components in
# WidgetRegistry.js were still hand-typed with placeholder Tailwind classes
# that didn't match, so the canvas didn't look like the generated app.
#
# Each token's value here is copy-pasted verbatim from the named source
# file/component. `test_design_tokens_match_source` in builder/tests.py
# asserts every value is still a literal substring of that file, so if a
# generated component's styling changes and this file isn't updated, CI
# fails instead of the canvas silently drifting from reality again.
# ---------------------------------------------------------------------

DESIGN_TOKENS = {
    # Source: writers/visual_runtime.py -> VisualBoundTable
    "table.wrap": {"value": "overflow-x-auto", "source": "visual_runtime.py"},
    "table.table": {"value": "min-w-full bg-panel border border-line rounded-lg", "source": "visual_runtime.py"},
    "table.headRow": {"value": "border-b border-line", "source": "visual_runtime.py"},
    "table.headCell": {"value": "px-4 py-2 text-left text-sm font-medium text-subtext", "source": "visual_runtime.py"},
    "table.bodyRow": {"value": "border-b border-line/50 hover:bg-surface-container/50", "source": "visual_runtime.py"},
    "table.cell": {"value": "px-4 py-2 text-sm", "source": "visual_runtime.py"},
    "table.editAction": {"value": "text-brand-100 hover:underline text-sm", "source": "visual_runtime.py"},
    "table.deleteAction": {"value": "text-red-500 hover:underline text-sm", "source": "visual_runtime.py"},
    "table.empty": {"value": "px-4 py-6 text-center text-subtext text-sm", "source": "visual_runtime.py"},

    # Source: writers/visual_runtime.py -> VisualBoundForm
    "form.wrap": {"value": "space-y-4 max-w-lg", "source": "visual_runtime.py"},
    "form.fieldWrap": {"value": "flex flex-col gap-1", "source": "visual_runtime.py"},
    "form.label": {"value": "text-sm font-medium text-subtext", "source": "visual_runtime.py"},
    "form.input": {
        "value": "bg-surface border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-100",
        "source": "visual_runtime.py",
    },
    "form.submit": {
        "value": "px-4 py-2 rounded-lg font-medium bg-brand-100 text-white hover:opacity-90 disabled:opacity-40",
        "source": "visual_runtime.py",
    },
    "form.error": {"value": "text-sm text-red-500", "source": "visual_runtime.py"},

    # Source: writers/visual_runtime.py -> VisualBoundDetailView
    "detail.wrap": {"value": "bg-surface border border-line rounded-lg p-4 space-y-2", "source": "visual_runtime.py"},
    "detail.row": {"value": "flex justify-between border-b border-line/40 py-1 text-sm", "source": "visual_runtime.py"},
    "detail.key": {"value": "text-subtext capitalize", "source": "visual_runtime.py"},

    # Source: writers/visual_runtime.py -> VisualBoundStatCard
    "statCard.wrap": {"value": "bg-surface border border-line rounded-lg p-4", "source": "visual_runtime.py"},
    "statCard.value": {"value": "text-2xl font-bold", "source": "visual_runtime.py"},
    "statCard.label": {"value": "text-sm text-subtext", "source": "visual_runtime.py"},

    # Source: writers/visual_runtime.py -> VisualBoundDataList
    "dataList.wrap": {"value": "divide-y divide-line", "source": "visual_runtime.py"},
    "dataList.item": {"value": "py-2", "source": "visual_runtime.py"},
    "dataList.link": {"value": "hover:text-brand-100", "source": "visual_runtime.py"},

    # Source: writers/visual_runtime.py -> VisualTabs
    "tabs.bar": {"value": "flex gap-2 border-b border-line mb-4", "source": "visual_runtime.py"},
    "tabs.tabActive": {"value": "border-brand-100 text-brand-100", "source": "visual_runtime.py"},
    "tabs.tabInactive": {"value": "border-transparent text-subtext hover:text-text", "source": "visual_runtime.py"},

    # Source: writers/components.py -> Navbar
    "navbar.wrap": {"value": "bg-panel border-b border-line p-4", "source": "components.py"},

    # Source: writers/sidebar.py -> Sidebar
    "sidebar.wrap": {
        "value": "w-64 bg-surface border-r border-line h-screen sticky top-0 overflow-y-auto p-4",
        "source": "sidebar.py",
    },

    # Source: visual_pages.py -> render_login_cta / render_signup_cta
    "auth.link": {"value": "text-brand-100 hover:underline", "source": "visual_pages.py"},

    # Source: visual_pages.py -> render_role_gate
    "roleGate.badge": {
        "value": "absolute -top-2 -left-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30",
        "source": "visual_pages.py",
    },

    # Source: visual_pages.py -> render_ai_action_button / render_workflow_trigger_button
    "automation.button": {
        "value": "px-4 py-2 rounded-lg font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed",
        "source": "visual_pages.py",
    },
}


def design_token_values():
    """{key: value} shortcut, e.g. for the frontend export."""
    return {k: v["value"] for k, v in DESIGN_TOKENS.items()}