# backend/builder/services/frontend/react/writers/visual_pages.py
"""
Renders a visual-builder widget tree (a plain JSON tree stored inside the
blueprint) into real JSX files for the generated React app.

This module is 100% additive: it is only invoked for a page when that page
has a `layout` tree defined (see generator.py). Pages without a `layout`
keep being generated exactly as before by write_pages.py / write_custom_pages.py.

Every generated file embeds the ORIGINAL widget tree (as a JSON comment) plus
a hash of the canonical tree together with the generated body. This lets the
visual builder detect, next time it loads the page, whether a human edited the
generated file by hand outside the builder (hash mismatch) so it can ask the
user how to reconcile instead of silently overwriting or silently going stale.
"""
import hashlib
import json
import re
from functools import partial

from ....helpers import pluralize
from .widget_manifest import WIDGET_MANIFEST


# ---------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------

def _pad(indent):
    return "  " * indent


def _jsx_attr(value):
    """Emit a JSX attribute value safely.

    Everything a user types (labels, hrefs, alt text, class names) goes
    through here, so quotes, newlines or braces can never break out of the
    string and inject code into the generated file.
    """
    return json.dumps("" if value is None else str(value), ensure_ascii=False)


def _jsx_text(value):
    """Emit JSX child text as an expression: {"..."} — `<`, `>` and `{` in
    user text stay inert instead of being parsed as markup."""
    return "{" + json.dumps("" if value is None else str(value), ensure_ascii=False) + "}"


class _RawExpr(str):
    """Marks a JS expression embedded in a style object (not a JSON literal)."""


def _prop_id(ctx, node, prop_key):
    """Property id exposed for this node+prop, if any."""
    mapping = (ctx.get("_props_by_node") or {}).get(node.get("id")) or {}
    return mapping.get(prop_key)


def _prop_expr(ctx, node, value, prop_key="text"):
    """For a node exposed as an instance property, emit
    `overrides["prop_id"] ?? "default"` instead of a literal so each instance
    can override it. Returns None when the node is not exposed."""
    prop_id = _prop_id(ctx, node, prop_key)
    if not prop_id:
        return None
    default = json.dumps("" if value is None else str(value), ensure_ascii=False)
    return f'overrides[{json.dumps(prop_id)}] ?? {default}'


def _style_attr(style):
    """Emit style={{...}} from a dict. Values may be _RawExpr, which are
    emitted as JS expressions so a number/colour property can fall back with
    `overrides["id"] ?? default`."""
    if not style:
        return ""
    parts = []
    for key, value in style.items():
        key_js = json.dumps(key)
        if isinstance(value, _RawExpr):
            parts.append(f"{key_js}: {value}")
        else:
            parts.append(f"{key_js}: {json.dumps(value, ensure_ascii=False)}")
    return " style={{" + ", ".join(parts) + "}}"


def _comment(value):
    """Escape a value for safe use inside a JSX block comment — a literal
    "*/" would otherwise end the comment and turn user text into code."""
    return str(value).replace("*/", "*\\/")


def _text(props, key="text", default=""):
    return (props or {}).get(key, default)


def _find_model(ctx, name):
    for m in ctx.get("models", []):
        if m.get("name") == name:
            return m
    return None


def _visible_fields(model, wanted):
    fields = model.get("fields", []) if model else []
    if not wanted:
        return fields
    by_name = {f["name"]: f for f in fields}
    return [by_name[n] for n in wanted if n in by_name]


def _field_input_type(field_type):
    return {
        "IntegerField": "number",
        "FloatField": "number",
        "DecimalField": "number",
        "BooleanField": "checkbox",
        "DateField": "date",
        "DateTimeField": "datetime-local",
        "EmailField": "email",
        "URLField": "url",
        "PasswordField": "password",
    }.get(field_type, "text")


# ---------------------------------------------------------------------
# Recursive tree renderer
# ---------------------------------------------------------------------

def render_children(node, ctx, indent):
    children = node.get("children") or []
    if not children:
        return ""

    parent_spec = WIDGET_MANIFEST.get(node.get("type"), {}).get("render") or {}
    if not parent_spec.get("freePositioning"):
        return "\n".join(render_node(c, ctx, indent) for c in children)

    # Free-positioning parent (currently only "Frame"): whatever the child
    # renders on its own gets wrapped in a position:absolute box driven by
    # its x/y/width/height, independent of the child's own widget type —
    # this is what lets a Frame hold literally any widget, not just
    # generic-tier ones, unlike every other container here.
    parts = []
    for c in children:
        props = c.get("props") or {}
        x, y = props.get("x", 0), props.get("y", 0)
        style_bits = [f'position: "absolute"', f'left: "{x}px"', f'top: "{y}px"']
        width, height = props.get("width"), props.get("height")
        if width not in (None, "", "auto"):
            style_bits.append(f'width: "{width}px"' if isinstance(width, (int, float)) else f'width: "{width}"')
        if height not in (None, "", "auto"):
            style_bits.append(f'height: "{height}px"' if isinstance(height, (int, float)) else f'height: "{height}"')
        wrapper_style = " style={{" + ", ".join(style_bits) + "}}"
        inner = render_node(c, ctx, indent + 1)
        parts.append(f'{_pad(indent)}<div{wrapper_style}>\n{inner}\n{_pad(indent)}</div>')
    return "\n".join(parts)


def build_page_routes(models, page_settings, custom_pages):
    """Map a route path to the component name generation writes for that page.

    Used by overlay actions: an instance/page action targets a route, and the
    page that opens it must import the target's component.
    """
    routes = {}
    for model in models or []:
        name = (model or {}).get("name")
        if name:
            routes["/" + pluralize(name.lower())] = f"{name}List"
    for page in custom_pages or []:
        path = (page or {}).get("path")
        raw = "".join(c for c in (page or {}).get("name", "Custom") if c.isalnum() or c == "_")
        if path and raw:
            routes[path] = raw[0].upper() + raw[1:] + "Page"
    return routes


def _apply_action(jsx, node, ctx):
    """Wrap a rendered widget in its prototype click action.

    `display: contents` keeps the wrapper layout-neutral, so adding an action
    never changes the page's flex/grid structure.
    """
    action = (node.get("props") or {}).get("action")
    if not isinstance(action, dict):
        return jsx
    kind = action.get("type")
    target = action.get("target") or ""
    flags = ctx.get("_flags")
    if flags is None:
        return jsx

    if kind == "navigate" and target:
        flags["navigate"] = True
        return (
            f'<span style={{{{display: "contents"}}}} '
            f"onClick={{() => navigate({json.dumps(target)})}}>{jsx}</span>"
        )
    if kind == "url" and target:
        return (
            f'<span style={{{{display: "contents"}}}} '
            f'onClick={{() => window.open({json.dumps(target)}, "_blank", "noopener")}}>'
            f"{jsx}</span>"
        )
    if kind == "overlay" and target:
        # Overlays need a page-level route registry and modal host; inside a
        # component file they are not generated (the action is ignored).
        if ctx.get("_component_mode"):
            return jsx
        component = (ctx.get("page_routes") or {}).get(target)
        if component:
            flags["overlays"][component] = {
                "transition": action.get("transition") or "dissolve",
                "duration": action.get("duration") or 240,
            }
            return (
                f'<span style={{{{display: "contents"}}}} '
                f"onClick={{() => setOverlayPage({json.dumps(component)})}}>{jsx}</span>"
            )
    if kind == "variant" and target:
        variant_name = (ctx.get("_variant_lookup") or {}).get(target)
        if variant_name:
            flags["set_variant"] = True
            return (
                f'<span style={{{{display: "contents"}}}} '
                f"onClick={{() => setVariant({json.dumps(variant_name)})}}>{jsx}</span>"
            )
    return jsx


def _apply_visibility(jsx, node, ctx):
    """Boolean `visible` property: an instance can hide this node without
    touching the shared master tree."""
    prop_id = _prop_id(ctx, node, "visible")
    if not prop_id:
        return jsx
    return f'{{overrides[{json.dumps(prop_id)}] !== false && (\n{jsx}\n)}}'


def _apply_condition(jsx, node, ctx):
    """Conditional rendering bound to a boolean component property.

    A node with props.condition = {propertyId, equals} only renders when the
    instance's boolean override matches `equals` (default: shown when on)."""
    condition = (node.get("props") or {}).get("condition")
    if not isinstance(condition, dict):
        return jsx
    prop_id = condition.get("propertyId")
    if not prop_id:
        return jsx
    if str(condition.get("equals", "true")).lower() == "false":
        expr = f'overrides[{json.dumps(prop_id)}] === false'
    else:
        expr = f'overrides[{json.dumps(prop_id)}] !== false'
    return f"{{{expr} && (\n{jsx}\n)}}"


def render_node(node, ctx, indent=2):
    if not isinstance(node, dict):
        return f"{_pad(indent)}{{/* invalid node */}}"
    ntype = node.get("type", "Text")
    fn = WIDGET_RENDERERS.get(ntype)
    if fn is None:
        return f"{_pad(indent)}{{/* Unsupported widget type: {_comment(ntype)} */}}"
    try:
        rendered = _apply_action(fn(node, ctx, indent), node, ctx)
        rendered = _apply_visibility(rendered, node, ctx)
        return _apply_condition(rendered, node, ctx)
    except Exception as exc:  # never let one bad widget break the whole page
        return f"{_pad(indent)}{{/* Failed to render widget '{_comment(ntype)}': {_comment(exc)} */}}"


# ---------------------------------------------------------------------
# Generic widget interpreter — drives EVERY "generic"-tier widget
# (Row, Column, Grid, Card, Section, Divider, Spacer, Heading, Text,
# Image, Button, Link, Icon, Badge, NavLink, AdminLink) from the single
# declarative spec in widget_manifest.py. Adding a prop or a new generic
# widget means editing the manifest only — never this function.
# ---------------------------------------------------------------------

def _resolve_class_template(template, props, spec):
    extra = props.get("className", "")
    tokens = dict(props)
    tokens["extra"] = extra

    if "classFromLevel" in spec:
        level = props.get(spec.get("tagFromProp", "level"), 2)
        tokens["levelClass"] = spec["classFromLevel"].get(level, spec["classFromLevel"].get(2, ""))

    if "classMap" in spec:
        for prop_name, value_map in spec["classMap"].items():
            value = props.get(prop_name)
            tokens[f"{prop_name}Class"] = value_map.get(value, spec.get("classMapDefault", ""))

    try:
        cls = template.format(**{k: tokens.get(k, "") for k in _template_keys(template)})
    except (KeyError, ValueError):
        cls = template
    # Empty tokens leave dangling fragments like `gap-` or `text-`; emitting
    # them produces invalid Tailwind utilities, so drop the whole fragment.
    return " ".join(p for p in cls.split() if not p.endswith("-"))


def _template_keys(template):
    import string
    return [name for _, name, _, _ in string.Formatter().parse(template) if name]


# Common style props (see widget_manifest._COMMON_STYLE_PROPS) that every
# generic widget carries but that aren't part of any classTemplate. These
# are real inline styles on the generated element — x/y were retired along
# with free positioning, so nothing here implies position:absolute.
_STYLE_PROP_MAP = {
    # propKey: (cssProperty, valueIsDefault)
    "backgroundColor": ("backgroundColor", "transparent"),
    "color": ("color", "inherit"),
    "border": ("border", "none"),
    "borderRadius": ("borderRadius", "0px"),
    "boxShadow": ("boxShadow", "none"),
    "fontSize": ("fontSize", "inherit"),
    "fontWeight": ("fontWeight", "normal"),
    "textAlign": ("textAlign", "left"),
    "padding": ("padding", "0px"),
    "margin": ("margin", "0px"),
}


def _css_var_name(token_id):
    """CSS custom property for a design-token colour (modes swap its value)."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "-", str(token_id))
    return f"--c-{safe}"


def build_theme_css(design_tokens):
    """Emit the app's CSS variables for every mode.

    Light values live on :root; dark values are applied via [data-theme="dark"]
    (explicit switch) and via prefers-color-scheme unless the user forced light.
    """
    colors = [
        c for c in (design_tokens or {}).get("colors", [])
        if isinstance(c, dict) and c.get("id") and c.get("value")
    ]
    if not colors:
        return ""

    def block(pairs):
        return "\n".join(f"  {name}: {value};" for name, value in pairs)

    light = [(_css_var_name(c["id"]), c.get("value")) for c in colors]
    dark = [(_css_var_name(c["id"]), c.get("dark") or c.get("value")) for c in colors]

    return f"""/* Generated design variables — edit them in the Visual Builder's Tokens panel. */
:root {{
{block(light)}
}}

[data-theme="dark"] {{
{block(dark)}
}}

@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
{block([(name, value) for name, value in dark])}
  }}
}}
"""


def _resolve_color_token(value, tokens):
    """backgroundColor/color can hold a literal CSS value OR a reference to
    a project-level named swatch: "@token:<id>" (see design_tokens.colors,
    edited via the Tokens panel). Token references resolve to a CSS variable
    so light/dark modes work in the generated app; unresolved references render
    nothing rather than leaking the raw "@token:..." string into generated CSS."""
    if not isinstance(value, str) or not value.startswith("@token:"):
        return value
    token_id = value[len("@token:"):]
    for swatch in (tokens or {}).get("colors", []):
        if swatch.get("id") == token_id:
            return f"var({_css_var_name(token_id)})"
    return None


def _inline_style(props, tokens=None, ctx=None, node=None):
    """Build a JSX `style={{...}}` string from a node's common style props,
    skipping anything left at its default so generated markup stays clean.
    Width/height only render when set to a real value (not "auto"/blank).
    Rotation only renders as a transform when non-zero. Opacity only when
    not 1. backgroundColor/color/textStyle may reference a named design
    token instead of a literal value — see _resolve_color_token above and
    the textStyle handling below. When a colour/size prop is exposed as an
    instance property, its value is emitted as an expression with a fallback
    instead of a literal. This is the single place both the generated app and
    the canvas mock renderer (GenericPreview.js) derive style from."""
    style = {}
    for prop_key, (css_prop, default) in _STYLE_PROP_MAP.items():
        value = props.get(prop_key)
        if prop_key in ("backgroundColor", "color"):
            value = _resolve_color_token(value, tokens)
        if value in (None, "", default):
            continue
        prop_id = _prop_id(ctx, node, css_prop) if (ctx is not None and node is not None) else None
        if prop_id:
            style[css_prop] = _RawExpr(
                f'overrides[{json.dumps(prop_id)}] ?? {json.dumps(str(value), ensure_ascii=False)}'
            )
        else:
            style[css_prop] = value

    # A textStyle token, when set, overrides fontSize/fontWeight wholesale
    # (the two are edited together as one named style, not independently).
    text_style_ref = props.get("textStyle")
    if isinstance(text_style_ref, str) and text_style_ref.startswith("@token:"):
        token_id = text_style_ref[len("@token:"):]
        match = next((t for t in (tokens or {}).get("textStyles", []) if t.get("id") == token_id), None)
        if match:
            style.pop("fontSize", None)
            style.pop("fontWeight", None)
            if match.get("fontSize"):
                style["fontSize"] = match["fontSize"]
            if match.get("fontWeight"):
                style["fontWeight"] = match["fontWeight"]

    width = props.get("width")
    if width not in (None, "", "auto"):
        style["width"] = f"{width}px" if isinstance(width, (int, float)) else width
    height = props.get("height")
    if height not in (None, "", "auto"):
        style["height"] = f"{height}px" if isinstance(height, (int, float)) else height

    # Auto-layout sizing modes (Figma-style Hug / Fill / Fixed). "hug" sizes
    # the box to its contents, "fill" stretches it to the parent, and "fixed"
    # keeps the explicit width/height above.
    width_mode = props.get("widthMode")
    if width_mode == "hug":
        style["width"] = "fit-content"
    elif width_mode == "fill":
        style["width"] = "100%"
    height_mode = props.get("heightMode")
    if height_mode == "hug":
        style["height"] = "fit-content"
    elif height_mode == "fill":
        style["height"] = "100%"

    # Auto-layout controls. Inline styles override the manifest's Tailwind
    # classes, so Row/Column keep their defaults but any container can switch
    # direction, disable wrapping or use an exact pixel gap.
    if props.get("flexDirection") in ("row", "column"):
        style["flexDirection"] = props["flexDirection"]
    if props.get("flexWrap") in ("wrap", "nowrap"):
        style["flexWrap"] = props["flexWrap"]
    gap_px = props.get("gapPx")
    if gap_px not in (None, "", "auto"):
        style["gap"] = f"{gap_px}px" if isinstance(gap_px, (int, float)) else gap_px

    rotation = props.get("rotation")
    if rotation not in (None, 0, "0"):
        style["transform"] = f"rotate({rotation}deg)"

    opacity = props.get("opacity")
    if opacity not in (None, 1, "1") and opacity != "":
        style["opacity"] = opacity

    return _style_attr(style)


def _resolve_href(props, spec, ctx):
    if spec.get("hrefTemplate") == "admin-url":
        # AdminLink is the one generic widget with a non-prop href: it points
        # at the generated app's own API base URL, not something a user types.
        return '{`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/admin/`}'
    href_prop = spec.get("hrefProp")
    if href_prop:
        return props.get(href_prop) or spec.get("hrefDefault", "")
    return spec.get("hrefDefault", "")


def render_generic(node, ctx, indent, spec):
    props = node.get("props", {})

    if spec["kind"] == "container":
        cls = _resolve_class_template(spec["classTemplate"], props, spec)
        style = _inline_style(props, ctx.get("design_tokens"), ctx, node)
        tag = spec["tag"]
        title_prop = spec.get("titleProp")
        title = props.get(title_prop, "") if title_prop else ""
        title_html = (
            f'{_pad(indent + 1)}<h3 className="text-lg font-semibold mb-3">{_jsx_text(title)}</h3>\n'
            if title else ""
        )
        inner = render_children(node, ctx, indent + 1)
        return (
            f'{_pad(indent)}<{tag} className={_jsx_attr(cls)}{style}>\n'
            f'{title_html}{inner}\n'
            f'{_pad(indent)}</{tag}>'
        )

    if spec["kind"] == "void":
        cls = _resolve_class_template(spec["classTemplate"], props, spec)
        style = _inline_style(props, ctx.get("design_tokens"), ctx, node)
        return f'{_pad(indent)}<{spec["tag"]} className={_jsx_attr(cls)}{style} />'

    if spec["kind"] == "text":
        cls = _resolve_class_template(spec["classTemplate"], props, spec)
        style = _inline_style(props, ctx.get("design_tokens"), ctx, node)
        if "tagFromProp" in spec:
            level = props.get(spec["tagFromProp"], 2)
            tag = spec["tagMap"].get(level, spec["tagMap"].get(2))
        else:
            tag = spec["tag"]
        text = _text(props, spec.get("textProp", "text"), spec.get("textDefault", ""))
        expr = _prop_expr(ctx, node, text)
        child = "{" + expr + "}" if expr else _jsx_text(text)
        return f'{_pad(indent)}<{tag} className={_jsx_attr(cls)}{style}>{child}</{tag}>'

    if spec["kind"] == "media":
        cls = _resolve_class_template(spec["classTemplate"], props, spec)
        style = _inline_style(props, ctx.get("design_tokens"), ctx, node)
        src = props.get(spec.get("srcProp", "src"), "")
        alt = props.get(spec.get("altProp", "alt"), "")
        src_expr = _prop_expr(ctx, node, src)
        src_attr = "src={" + src_expr + "}" if src_expr else f"src={_jsx_attr(src)}"
        return (
            f'{_pad(indent)}<img {src_attr} alt={_jsx_attr(alt)} '
            f'className={_jsx_attr(cls)}{style} />'
        )

    if spec["kind"] == "link":
        cls = _resolve_class_template(spec["classTemplate"], props, spec)
        style = _inline_style(props, ctx.get("design_tokens"), ctx, node)
        text = _text(props, spec.get("textProp", "text"), spec.get("textDefault", ""))
        expr = _prop_expr(ctx, node, text)
        child = "{" + expr + "}" if expr else _jsx_text(text)
        href = _resolve_href(props, spec, ctx)
        new_tab_attrs = ' target="_blank" rel="noopener noreferrer"' if spec.get("newTab") else ""

        if spec.get("hrefTemplate"):
            # Special-cased href (currently only AdminLink) -> plain <a>.
            return (
                f'{_pad(indent)}<a href={href}{new_tab_attrs} '
                f'className={_jsx_attr(cls)}{style}>{child}</a>'
            )
        if not href and spec.get("tag") == "button":
            # Button with no href -> real <button>, not a Link.
            return (
                f'{_pad(indent)}<button type="button" className={_jsx_attr(cls)}{style}>'
                f'{child}</button>'
            )
        link_tag = spec.get("linkTag", "Link")
        return (
            f'{_pad(indent)}<{link_tag} to={_jsx_attr(href)} '
            f'className={_jsx_attr(cls)}{style}>{child}</{link_tag}>'
        )

    return f'{_pad(indent)}{{/* Unknown generic render kind: {spec["kind"]} */}}'


# ---------------------------------------------------------------------
# Smart widgets — Tabs needs runtime tab-switching state, so it stays
# hand-written like the model-bound widgets below.
# ---------------------------------------------------------------------

def render_tabs(node, ctx, indent):
    props = node.get("props", {})
    tabs = props.get("tabs") or []
    children = node.get("children") or []
    # JSON array literal: tab labels are user text and must not be able to
    # terminate the string or inject expressions.
    labels = json.dumps([str(t) for t in tabs] or ["Tab 1"], ensure_ascii=False)
    panels = "\n".join(
        f'{_pad(indent + 3)}{{active === {i} && (\n'
        f"{render_node(child, ctx, indent + 4)}\n"
        f"{_pad(indent + 3)})}}"
        for i, child in enumerate(children)
    )
    return (
        f"{_pad(indent)}<VisualTabs labels={{{labels}}}>\n"
        f'{_pad(indent + 1)}{{(active) => (\n'
        f"{_pad(indent + 2)}<>\n"
        f"{panels}\n"
        f"{_pad(indent + 2)}</>\n"
        f"{_pad(indent + 1)})}}\n"
        f"{_pad(indent)}</VisualTabs>"
    )


# ---------------------------------------------------------------------
# Data-bound widgets (the ones that mirror your Model/API designers)
# ---------------------------------------------------------------------

def render_table(node, ctx, indent):
    props = node.get("props", {})
    model_name = props.get("model")
    model = _find_model(ctx, model_name)
    if not model:
        return f'{_pad(indent)}{{/* Table widget: model "{_comment(model_name)}" not found */}}'
    plural = pluralize(model_name.lower())
    fields = _visible_fields(model, props.get("fields"))
    field_names = [f["name"] for f in fields] or ["id"]
    cols = json.dumps([{"key": n, "label": n} for n in field_names], ensure_ascii=False)
    show_actions = props.get("showActions", True)

    return f"""{_pad(indent)}<VisualBoundTable
{_pad(indent + 1)}endpoint={_jsx_attr(f"/{ctx['app_name']}/{plural}/")}
{_pad(indent + 1)}columns={{{cols}}}
{_pad(indent + 1)}showActions={{{"true" if show_actions else "false"}}}
{_pad(indent + 1)}editBasePath={_jsx_attr("/" + model_name.lower())}
{_pad(indent)}/>"""


def render_form(node, ctx, indent):
    props = node.get("props", {})
    model_name = props.get("model")
    mode = props.get("mode", "create")
    model = _find_model(ctx, model_name)
    if not model:
        return f'{_pad(indent)}{{/* Form widget: model "{_comment(model_name)}" not found */}}'
    plural = pluralize(model_name.lower())
    fields = _visible_fields(model, props.get("fields"))
    field_specs = []
    for f in fields:
        if f.get("type") in ("ForeignKey", "OneToOneField", "ManyToManyField"):
            continue  # relation fields need picker UX; kept out of the generic auto-form for correctness
        options = f.get("options") or {}
        field_specs.append({
            "name": f["name"],
            "type": _field_input_type(f.get("type", "CharField")),
            "label": f["name"].replace("_", " ").title(),
            # The model designer stores requiredness as blank=False; there is
            # no "required" key, which is why every generated field used to be
            # optional.
            "required": options.get("blank") is False,
        })
    if not field_specs:
        field_specs = [{"name": "name", "type": "text", "label": "Name", "required": False}]
    fields_js = json.dumps(field_specs, ensure_ascii=False)
    return f"""{_pad(indent)}<VisualBoundForm
{_pad(indent + 1)}endpoint={_jsx_attr(f"/{ctx['app_name']}/{plural}/")}
{_pad(indent + 1)}mode={_jsx_attr(mode)}
{_pad(indent + 1)}fields={{{fields_js}}}
{_pad(indent + 1)}redirectTo={_jsx_attr("/" + model_name.lower())}
{_pad(indent)}/>"""


def render_detail_view(node, ctx, indent):
    props = node.get("props", {})
    model_name = props.get("model")
    model = _find_model(ctx, model_name)
    if not model:
        return f'{_pad(indent)}{{/* DetailView widget: model "{_comment(model_name)}" not found */}}'
    plural = pluralize(model_name.lower())
    fields = _visible_fields(model, props.get("fields"))
    field_names = [f["name"] for f in fields] or ["id"]
    fields_js = json.dumps(field_names, ensure_ascii=False)
    return f"""{_pad(indent)}<VisualBoundDetail
{_pad(indent + 1)}endpoint={_jsx_attr(f"/{ctx['app_name']}/{plural}/")}
{_pad(indent + 1)}fields={{{fields_js}}}
{_pad(indent)}/>"""


def render_stat_card(node, ctx, indent):
    props = node.get("props", {})
    model_name = props.get("model")
    label = props.get("label") or (model_name or "Total")
    if model_name and _find_model(ctx, model_name):
        plural = pluralize(model_name.lower())
        return f"""{_pad(indent)}<VisualStatCard
{_pad(indent + 1)}label={_jsx_attr(label)}
{_pad(indent + 1)}endpoint={_jsx_attr(f"/{ctx['app_name']}/{plural}/")}
{_pad(indent)}/>"""
    value = props.get("value", "0")
    return (
        f'{_pad(indent)}<div className="bg-surface border border-line rounded-lg p-4">\n'
        f'{_pad(indent + 1)}<div className="text-2xl font-bold">{_jsx_text(value)}</div>\n'
        f'{_pad(indent + 1)}<div className="text-sm text-subtext">{_jsx_text(label)}</div>\n'
        f"{_pad(indent)}</div>"
    )


def render_data_list(node, ctx, indent):
    props = node.get("props", {})
    model_name = props.get("model")
    model = _find_model(ctx, model_name)
    if not model:
        return f'{_pad(indent)}{{/* DataList widget: model "{_comment(model_name)}" not found */}}'
    plural = pluralize(model_name.lower())
    field = props.get("titleField") or (model.get("fields", [{"name": "id"}])[0]["name"])
    return f"""{_pad(indent)}<VisualDataList
{_pad(indent + 1)}endpoint={_jsx_attr(f"/{ctx['app_name']}/{plural}/")}
{_pad(indent + 1)}titleField={_jsx_attr(field)}
{_pad(indent + 1)}linkBasePath={_jsx_attr("/" + model_name.lower())}
{_pad(indent)}/>"""


# ---------------------------------------------------------------------
# Navigation widgets
# ---------------------------------------------------------------------

def render_navbar(node, ctx, indent):
    return f"{_pad(indent)}<Navbar title={_jsx_attr(ctx.get('project_name', 'App'))} />"


def render_sidebar(node, ctx, indent):
    return f"{_pad(indent)}<Sidebar />"


# NavLink is generic-tier (see widget_manifest.py) — rendered by render_generic.

# ---------------------------------------------------------------------
# Auth widgets — link out to the already-generated Login/Signup pages
# rather than re-implementing auth forms a second time.
# ---------------------------------------------------------------------

def render_login_cta(node, ctx, indent):
    return f'{_pad(indent)}<Link to="/login" className="text-brand-100 hover:underline">Go to Login</Link>'


def render_signup_cta(node, ctx, indent):
    return f'{_pad(indent)}<Link to="/signup" className="text-brand-100 hover:underline">Go to Signup</Link>'


# ---------------------------------------------------------------------
# Access-control widget.
# NOTE: this is a *visual/documentation* aid only. Your Permissions
# designer already enforces real access control server-side via DRF
# permission classes, which is the correct place for it. This widget
# does not fabricate client-side auth state that the backend doesn't
# expose (no such role/session endpoint exists), so it renders its
# children as-is with a visible "Visible to: <roles>" badge + comment.
# ---------------------------------------------------------------------

def render_role_gate(node, ctx, indent):
    props = node.get("props", {})
    roles = props.get("roles") or []
    roles_label = ", ".join(str(r) for r in roles) if roles else "Everyone"
    inner = render_children(node, ctx, indent + 1)
    return (
        f"{_pad(indent)}{{/* Visible to role(s): {_comment(roles_label)}. Enforced server-side by your Permissions designer. */}}\n"
        f'{_pad(indent)}<div className="relative">\n'
        f'{_pad(indent + 1)}<span className="absolute -top-2 -left-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">{_jsx_text(roles_label)}</span>\n'
        f"{inner}\n"
        f"{_pad(indent)}</div>"
    )


# ---------------------------------------------------------------------
# Automation placeholders.
# AI Actions and Workflows are marked "Coming soon" in this platform's
# own designers (no backend execution engine exists for them yet). To
# avoid inventing a fake feature, these widgets render clearly-labeled
# placeholder buttons rather than pretending to call something real.
# ---------------------------------------------------------------------

def render_ai_action_button(node, ctx, indent):
    props = node.get("props", {})
    label = props.get("label", "AI Action")
    return (
        f"{_pad(indent)}{{/* TODO: wire this button once AI Actions are implemented in the AI Actions Designer */}}\n"
        f'{_pad(indent)}<button type="button" disabled title="AI Actions are not implemented yet" '
        f'className="px-4 py-2 rounded-lg font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed">'
        f"{_jsx_text(f'✨ {label}')}</button>"
    )


def render_workflow_trigger_button(node, ctx, indent):
    props = node.get("props", {})
    label = props.get("label", "Run Workflow")
    return (
        f"{_pad(indent)}{{/* TODO: wire this button once Workflows are implemented in the Workflows Designer */}}\n"
        f'{_pad(indent)}<button type="button" disabled title="Workflows are not implemented yet" '
        f'className="px-4 py-2 rounded-lg font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed">'
        f"{_jsx_text(f'🔄 {label}')}</button>"
    )


# ---------------------------------------------------------------------
# Reusable components ("instances")
#
# A component master lives in blueprint.data.frontend.components as
# {id, name, tree}. A page references it with an {type: "Instance",
# props: {componentId}} node:
#   * in a page file it becomes <Name /> + an import of the generated
#     component (real code reuse, not a copy);
#   * inside a component file nested instances are inlined, so component
#     files can never form an import cycle. A genuine cycle stops at a
#     comment instead of recursing forever.
# ---------------------------------------------------------------------

_INSTANCE_TYPE = "Instance"


_RESERVED_COMPONENT_NAMES = {
    "React", "Link", "Navbar", "Sidebar", "VisualTabs",
    "VisualBoundTable", "VisualBoundForm", "VisualBoundDetail",
    "VisualStatCard", "VisualDataList",
}


def _component_name(raw):
    """Valid, unique-ish PascalCase React component name for a master."""
    cleaned = re.sub(r"[^A-Za-z0-9_$]", "", str(raw or "")) or "Component"
    if cleaned[0].isdigit():
        cleaned = "_" + cleaned
    name = cleaned[0].upper() + cleaned[1:]
    # A component called "Navbar" would clash with the generated Navbar import.
    if name in _RESERVED_COMPONENT_NAMES:
        name = "Cmp" + name
    return name


def _component_index(ctx):
    index = {}
    for comp in ctx.get("components") or []:
        if isinstance(comp, dict) and comp.get("id"):
            index[comp["id"]] = comp
    return index


def _find_variant(comp, variant_id):
    for variant in comp.get("variants") or []:
        if isinstance(variant, dict) and variant.get("id") == variant_id:
            return variant
    return None


def render_instance(node, ctx, indent):
    props = node.get("props") or {}
    comp_id = props.get("componentId")
    comp = _component_index(ctx).get(comp_id)
    if not comp:
        return f'{_pad(indent)}{{/* Instance: component "{_comment(comp_id)}" not found */}}'

    variant = _find_variant(comp, props.get("variantId"))

    if ctx.get("_inline_instances"):
        visited = set(ctx.get("_visited") or ())
        if comp_id in visited:
            return (
                f"{_pad(indent)}"
                f"{{/* Cyclic component reference: {_comment(comp.get('name'))} */}}"
            )
        nested = {**ctx, "_visited": visited | {comp_id}}
        tree = (variant or {}).get("tree") or comp.get("tree") or {}
        return render_node(tree, nested, indent)

    name = _component_name(comp.get("name"))
    attrs = []
    if variant and variant.get("name"):
        # The generated component switches on the variant's display name.
        attrs.append(f"variant={_jsx_attr(variant.get('name'))}")
    overrides = props.get("overrides") or {}
    if isinstance(overrides, dict):
        clean = {str(k): str(v) for k, v in overrides.items() if str(k)}
        if clean:
            attrs.append("overrides={" + json.dumps(clean, ensure_ascii=False) + "}")
    attr_str = (" " + " ".join(attrs)) if attrs else ""
    return f"{_pad(indent)}<{name}{attr_str} />"


def _collect_instance_names(tree, ctx):
    """Component names referenced directly by `tree` (used for page imports)."""
    names = set()
    index = _component_index(ctx)
    stack = [tree]
    while stack:
        node = stack.pop()
        if not isinstance(node, dict):
            continue
        if node.get("type") == _INSTANCE_TYPE:
            comp = index.get((node.get("props") or {}).get("componentId"))
            if comp:
                names.add(_component_name(comp.get("name")))
        children = node.get("children") or []
        if isinstance(children, list):
            stack.extend(children)
    return names


# AdminLink is generic-tier (see widget_manifest.py) — rendered by render_generic.

# ---------------------------------------------------------------------
# Renderer table — built from the manifest so it can never drift from it.
# Generic-tier types all route through the one interpreter above; smart-tier
# types map to their hand-written function by name. If a smart type in the
# manifest has no matching function here, `_SMART_RENDER_FUNCS[type]` raises
# KeyError at import time (see the assertion below) instead of silently
# rendering "Unsupported widget" at generation time.
# ---------------------------------------------------------------------

_SMART_RENDER_FUNCS = {
    "Tabs": render_tabs,
    "Table": render_table,
    "Form": render_form,
    "DetailView": render_detail_view,
    "StatCard": render_stat_card,
    "DataList": render_data_list,
    "Navbar": render_navbar,
    "Sidebar": render_sidebar,
    "LoginCta": render_login_cta,
    "SignupCta": render_signup_cta,
    "RoleGate": render_role_gate,
    "AiActionButton": render_ai_action_button,
    "WorkflowTriggerButton": render_workflow_trigger_button,
}

WIDGET_RENDERERS = {}
for _type, _spec in WIDGET_MANIFEST.items():
    if _spec["tier"] == "generic":
        WIDGET_RENDERERS[_type] = partial(render_generic, spec=_spec["render"])
    else:
        if _type not in _SMART_RENDER_FUNCS:
            raise RuntimeError(
                f"widget_manifest.py declares '{_type}' as tier='smart' but "
                f"visual_pages.py has no matching renderer in _SMART_RENDER_FUNCS. "
                f"Add one or change its tier."
            )
        WIDGET_RENDERERS[_type] = _SMART_RENDER_FUNCS[_type]
del _type, _spec

# Instances are a builder concept, not a manifest widget: they only exist
# because a page references a reusable component master.
WIDGET_RENDERERS[_INSTANCE_TYPE] = render_instance


# ---------------------------------------------------------------------
# File assembly
# ---------------------------------------------------------------------

def _collect_imports(body, instance_names=()):
    """Imports needed by a rendered body.

    Detection is body-based rather than tree-based so that inlined component
    instances pull in exactly the imports their rendered markup needs.
    """
    imports = ["import React from 'react';", "import { Link } from 'react-router-dom';"]
    if any(marker in body for marker in (
        "<VisualBoundTable", "<VisualBoundForm", "<VisualBoundDetail",
        "<VisualStatCard", "<VisualDataList",
    )):
        imports.append(
            "import { VisualBoundTable, VisualBoundForm, VisualBoundDetail, "
            "VisualStatCard, VisualDataList } from '../components/visual/VisualDataWidgets';"
        )
    if "<VisualTabs" in body:
        imports.append("import VisualTabs from '../components/visual/VisualTabs';")
    if "<Navbar" in body:
        imports.append("import Navbar from '../components/Navbar';")
    if "<Sidebar" in body:
        imports.append("import Sidebar from '../components/Sidebar';")
    for name in sorted(instance_names):
        imports.append(f"import {name} from '../components/visual/{name}';")
    return imports


def _render_overlay_blocks(overlays):
    """Modal markup for overlay actions, one conditional block per target."""
    blocks = []
    for name in sorted(overlays or {}):
        spec = overlays[name] or {}
        transition = spec.get("transition")
        if transition not in ("instant", "dissolve", "slide", "push"):
            transition = "dissolve"
        try:
            duration = int(spec.get("duration") or 240)
        except (TypeError, ValueError):
            duration = 240
        blocks.append(
            "      {overlayPage === " + json.dumps(name) + " && (\n"
            "        <div\n"
            '          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"\n'
            '          data-transition="' + transition + '"\n'
            "          style={{ animationDuration: " + json.dumps(f"{duration}ms") + " }}\n"
            "          onClick={() => setOverlayPage(null)}\n"
            "        >\n"
            '          <div\n'
            '            className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl"\n'
            "            onClick={(event) => event.stopPropagation()}\n"
            "          >\n"
            '            <button type="button" className="absolute right-2 top-2 rounded px-2 py-1 text-sm" onClick={() => setOverlayPage(null)}>\n'
            "              Close\n"
            "            </button>\n"
            "            <" + name + " />\n"
            "          </div>\n"
            "        </div>\n"
            "      )}"
        )
    return "\n".join(blocks)


def build_page_source(component_name, tree, ctx):
    """Build a full .jsx file source string for one visual page.

    The same function backs both code generation and the builder's
    render-code endpoint, so what the canvas previews is byte-identical to the
    file generation writes.
    """
    # Component names come from user-entered page/model names; force a valid
    # JS identifier instead of emitting a syntax error.
    safe_component = re.sub(r"[^A-Za-z0-9_$]", "", component_name or "") or "VisualPage"
    if safe_component[0].isdigit():
        safe_component = "_" + safe_component

    # Canonical JSON: stable key order, no incidental whitespace, so the same
    # tree always produces the same schema block and hash.
    tree_json = json.dumps(tree, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    # Per-page render context: prototype flags must not leak between pages.
    local_ctx = {**ctx, "_flags": {"navigate": False, "overlays": {}}}
    body = render_node(tree, local_ctx, indent=2)
    overlays = local_ctx["_flags"].get("overlays") or {}
    # Hash the tree AND the body: a change to either means the file on disk no
    # longer matches the builder state.
    digest = hashlib.sha256((tree_json + "\n" + body).encode("utf-8")).hexdigest()[:16]
    # The schema lives inside a block comment, so a literal "*/" in the JSON
    # would end the comment early and turn the rest of it into code.
    schema_json = tree_json.replace("*/", "*\\/")

    imports = _collect_imports(body, _collect_instance_names(tree, local_ctx))
    if overlays:
        # Overlays need state, and each target page is imported from the same
        # pages directory.
        imports[0] = "import React, { useState } from 'react';"
        for name in sorted(overlays):
            imports.append(f"import {name} from './{name}';")
    needs_navigate = bool(local_ctx["_flags"].get("navigate"))
    if needs_navigate:
        imports.append("import { useNavigate } from 'react-router-dom';")

    hooks = []
    if overlays:
        hooks.append("  const [overlayPage, setOverlayPage] = useState(null);")
    if needs_navigate:
        hooks.append("  const navigate = useNavigate();")
    hook = ("\n".join(hooks) + "\n") if hooks else ""

    if overlays:
        page_body = "    <>\n" + body + "\n" + _render_overlay_blocks(overlays) + "\n    </>"
    else:
        page_body = body

    return f"""/* @visual-builder-schema
{schema_json}
@visual-builder-hash {digest}
@end-visual-builder */
{chr(10).join(imports)}

export default function {safe_component}() {{
{hook}  return (
{page_body}
  );
}}
"""


def render_page_code(tree, ctx, component_name="VisualPage"):
    """Render a page's full .jsx source without writing anything to disk.

    Used by the builder's render-code API so the studio can show the exact
    code that "Save & generate" would produce.
    """
    return build_page_source(component_name, tree, ctx)


def write_visual_pages(pages_dir, models, app_name, project_name, page_settings, custom_pages, roles, design_tokens=None, components=None, components_dir=None):
    """
    Overwrite/create page files for any model page or custom page that has a
    `layout` widget tree defined. Pages without a layout are left untouched
    here (write_pages.py / write_custom_pages.py already handled them).

    Reusable component masters are written too (when `components_dir` is
    given) so page imports resolve; nested instances are inlined inside those
    files to keep the import graph acyclic.
    """
    ctx = {
        "models": models, "app_name": app_name, "project_name": project_name,
        "roles": roles or [], "design_tokens": design_tokens or {},
        "components": components or [],
        "page_routes": build_page_routes(models, page_settings, custom_pages),
    }
    written = []

    if components and components_dir is not None:
        written.extend(write_visual_components(components_dir, components, ctx))

    page_settings = page_settings or {}
    for model_name, settings in page_settings.items():
        layout = (settings or {}).get("layout")
        if not layout:
            continue
        component_name = f"{model_name}List"
        source = build_page_source(component_name, layout, ctx)
        path = pages_dir / f"{component_name}.jsx"
        path.write_text(source, encoding="utf-8")
        written.append(str(path))

    for page in custom_pages or []:
        layout = page.get("layout")
        if not layout:
            continue
        raw_name = "".join(c for c in page.get("name", "Custom") if c.isalnum() or c == "_") or "Custom"
        name = raw_name[0].upper() + raw_name[1:]
        component_name = f"{name}Page"
        source = build_page_source(component_name, layout, ctx)
        path = pages_dir / f"{component_name}.jsx"
        path.write_text(source, encoding="utf-8")
        written.append(str(path))

    return written


def build_component_source(component, ctx):
    """Build the .jsx file for one reusable component master.

    Signature: ({ variant = "Default", overrides = {} }). `variant` selects a
    variant tree, `overrides` fills the exposed properties. Nested instances
    are inlined instead of imported so component files never form a circular
    import; a real cycle terminates at a comment.
    """
    name = _component_name(component.get("name"))
    properties = [
        p for p in (component.get("properties") or [])
        if isinstance(p, dict) and p.get("nodeId") and p.get("id")
    ]
    # nodeId -> {css/text prop key: property id}; one node can expose several
    # typed properties (text, colour, number, visible toggle).
    props_by_node = {}
    for prop in properties:
        ptype = prop.get("type") or "text"
        key = prop.get("prop") or ("text" if ptype == "text" else ptype)
        props_by_node.setdefault(prop["nodeId"], {})[key] = prop["id"]
    variants = [
        v for v in (component.get("variants") or [])
        if isinstance(v, dict) and v.get("tree")
    ]
    variant_lookup = {
        v.get("id"): v.get("name")
        for v in variants
        if v.get("id") and v.get("name")
    }
    flags = {"navigate": False, "overlays": {}, "set_variant": False}
    inner_ctx = {
        **ctx,
        "_inline_instances": True,
        "_component_mode": True,
        "_props_by_node": props_by_node,
        "_flags": flags,
        "_variant_lookup": variant_lookup,
    }
    default_body = render_node(component.get("tree") or {}, inner_ctx, indent=4)

    bodies = [default_body]
    blocks = []
    for variant in variants:
        variant_name = variant.get("name") or "Variant"
        body = render_node(variant["tree"], inner_ctx, indent=6)
        bodies.append(body)
        blocks.append((variant_name, body))

    imports = _collect_imports("\n".join(bodies))
    interactive = bool(flags.get("set_variant"))
    if interactive:
        # A component that switches its own variant needs local state.
        imports[0] = "import React, { useState } from 'react';"
    needs_navigate = bool(flags.get("navigate"))
    if needs_navigate:
        imports.append("import { useNavigate } from 'react-router-dom';")
    hook_parts = []
    if interactive:
        hook_parts.append("  const [variant, setVariant] = useState(initialVariant);")
    if needs_navigate:
        hook_parts.append("  const navigate = useNavigate();")
    hook = ("\n".join(hook_parts) + "\n") if hook_parts else ""

    if not blocks:
        return (
            f"{chr(10).join(imports)}\n\n"
            f"export default function {name}({{ overrides = {{}} }} = {{}}) {{\n"
            f"{hook}  return (\n"
            f"{default_body}\n"
            f"  );\n"
            f"}}\n"
        )

    variant_blocks = []
    for variant_name, body in blocks:
        variant_blocks.append(
            f"  if (variant === {json.dumps(variant_name, ensure_ascii=False)}) {{\n"
            f"    return (\n"
            f"{body}\n"
            f"    );\n"
            f"  }}\n"
        )
    signature = (
        'variant: initialVariant = "Default", overrides = {}'
        if interactive
        else 'variant = "Default", overrides = {}'
    )
    return (
        f"{chr(10).join(imports)}\n\n"
        f"export default function {name}({{ {signature} }} = {{}}) {{\n"
        f"{hook}"
        f"{''.join(variant_blocks)}\n"
        f"  return (\n"
        f"{default_body}\n"
        f"  );\n"
        f"}}\n"
    )


def write_visual_components(components_dir, components, ctx):
    """Write one file per component master into src/components/visual/."""
    components_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for comp in components or []:
        if not isinstance(comp, dict) or not comp.get("tree"):
            continue
        name = _component_name(comp.get("name"))
        path = components_dir / f"{name}.jsx"
        path.write_text(build_component_source(comp, ctx), encoding="utf-8")
        written.append(str(path))
    return written