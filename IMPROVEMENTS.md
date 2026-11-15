# Improvements — 2026-11-15

A focused hardening pass over `patch/`. Every change below is small, local, and
verified by the test suite or the production build. Nothing was refactored for
style; the goal was to stop silent data loss, make failed operations recoverable,
and remove the rough edges that break non-Windows deployments.

## Verification

```powershell
cd backend
.\env\Scripts\python.exe -m pytest -q -o addopts="" --reuse-db -p no:cacheprovider
# 52 passed

cd ..\frontend
npm run build
# ✓ Compiled successfully — 9 routes
```

Note: the test suite writes into `backend/project_workspaces/` and runs Node, so
it needs normal filesystem access. Use `-o addopts=""` to skip coverage, whose
`.coverage` erase step fails on a read-only/denied file.

---

## 1. Data loss: designers no longer wipe other apps' models

`ApiDesigner`, `AdminDesigner`, and `PermissionsDesigner` receive only the
**current app's** model list but wrote it back as the whole blueprint list.
Saving API/Admin/Permissions for one app silently deleted every other app's
models — and the next Generate then dropped their code.

- `frontend/components/builder/ApiDesigner.js`
- `frontend/components/builder/AdminDesigner.js`
- `frontend/components/builder/PermissionsDesigner.js`

Each now merges the edited model back into `blueprintData.models`, leaving other
apps untouched (matched by identity, with name+app as a fallback).

## 2. Dead "delete" actions

`useConfirm()` returns `{ confirm, ConfirmDialog }`; the dialog **must** be
rendered or the promise never settles. Five call sites destructured only
`confirm`, so their buttons did nothing at all.

- `frontend/components/builder/AppDetails.js` (Delete App)
- `frontend/components/builder/ModelDesigner.js` (Delete Model)
- `frontend/components/builder/PagesDesigner.js` (Remove custom page)
- `frontend/components/builder/NavigationDesigner.js` (Remove nav item)

## 3. Toggling a model page no longer deletes custom nav links

`PagesDesigner.toggleModelPage` rebuilt navigation from model paths only, dropping
`/about`-style custom entries on every click. It now removes/rebuilds only the
model entries and preserves everything else.

## 4. Apply is now all-or-nothing

`POST /apply/` wrote each operation in sequence and, on the first failure, left
the earlier writes on disk while marking the message `failed` — and because apply
only accepts `pending` messages, the partial result could never be retried.

- `backend/assistant/file_ops.py`: new `snapshot_paths()` / `restore_paths()`.
- `backend/assistant/views.py`: `ApplyOperationsView` snapshots every touched
  file, rolls back on failure, and leaves the message `pending` so the user can
  fix and retry.
- Regression test: `test_apply_rolls_back_when_one_operation_fails`.

## 5. Zip imports record POSIX paths

`extract_zip_to_workspace` used `str(Path(member))`, which turns `sub/file.txt`
into `sub\file.txt` on Windows. Every later lookup (`?path=sub/file.txt`,
directory delete, the file tree) missed those files.

- `backend/assistant/file_ops.py`: normalises separators and strips `./`, while
  still opening the original archive member name.
- Regression test: `test_extract_zip_normalises_windows_separators`.

## 6. Directory delete no longer removes sibling prefix matches

`path__startswith="app"` also matched `app2/...`, deleting unrelated DB rows.
Now it matches the exact path or `app/`-prefixed children.

- `backend/assistant/views.py` (`DirectoryDeleteView`)
- Regression test: `test_delete_directory_keeps_sibling_with_shared_prefix`

## 7. `stop_preview_if_running` exists

Both `assistant.views` and the builder sync writer imported this function; it was
never defined, so the `ImportError` silently disabled stopping the preview before
a file sync — the exact file-lock case the retry loop was added for.

- `backend/preview/views.py`: added the helper on top of `process_registry.kill`.

## 8. Chat history exposes message status again

`ChatMessageSerializer` omitted `status`, so reloaded conversations could never
show pending/applied/rejected badges.

- `backend/assistant/serializers.py`

## 9. Auth flow fixes

- `frontend/lib/api.js`: **single-flight refresh.** The backend rotates *and*
  blacklists refresh tokens; concurrent 401s each refreshed, the loser was
  blacklisted, and the user was logged out mid-session.
- `frontend/lib/api.js`: `parseResponse` read the body twice after a JSON parse
  failure (body already consumed → throw). It now reads text once.
- `frontend/lib/api.js`: downloads go through the refresh path instead of failing
  outright when the access token expires.
- `backend/assistant/views.py`: signup now runs `AUTH_PASSWORD_VALIDATORS`
  (previously `create_user` bypassed them entirely).

## 10. Packaging / cross-platform

- `Navbar` → `navbar` imports (3 pages) and `Breadcrumb` → `BreadCrumb`: these
  only resolved on Windows' case-insensitive filesystem and would break a Linux
  or Vercel build.
- `frontend/components/TerminalPanel.js`: the terminal WebSocket host is derived
  from `NEXT_PUBLIC_WS_URL` / `NEXT_PUBLIC_API_URL` instead of a hardcoded
  `:8001`. Local `.env.local` (8001) and Docker (8000) now both work.
- `backend/pytest.ini`: collects `builder/tests.py`, `preview/tests.py`,
  `terminal/tests.py` again (it was pinned to `assistant/tests`), while excluding
  the generated `writers/tests.py` scaffold.
- `backend/builder/tests.py`: Node is invoked with a `file://` URL; the bare
  Windows path raised `ERR_UNSUPPORTED_ESM_URL_SCHEME`, failing parity tests.
- `frontend/components/visualbuilder/WidgetMetadata.generated.js` regenerated
  from `widget_manifest.py` (token values were already identical; the checked-in
  copy was missing the generated comment block).

## 11. Generator correctness

- `backend/builder/services/generator.py`: generated `requirements.txt` now
  includes `django-filter` (every generated `views.py` imports it).
- `backend/builder/services/backend/django/writers/views.py`: `Is{Model}Owner` is
  added to the import set when an API uses `IsOwner`, not only when the role
  matrix is enabled.
- `backend/builder/services/backend/django/writers/permissions.py`: emits
  `Is{Model}Owner` for `IsOwner` APIs even with the role matrix disabled.
- `backend/builder/views.py`: `DeleteAppView` rejects app names that resolve
  outside the project workspace (`..`, absolute paths) before `rmtree`.
- `backend/assistant/views.py`: the project-root guard now compares resolved
  paths (a symlinked/case-varied path could previously pass and be `rmtree`d).

---

## Still open (deliberately not changed)

Ordered by risk. These need design decisions or larger changes, not a patch.

1. **Arbitrary code execution is by design, but unbounded.** `run_command` uses
   `shell=True` on model output; the terminal is a full host shell; preview runs
   `pip install` / `npm install` into the server's own virtualenv and binds
   `0.0.0.0` with `DEBUG=True`. Needs containerisation or an explicit
   `ALLOW_RUN_COMMAND` / sandbox policy.
2. **Generated projects still have broken edges**: `ForeignKey` without
   `on_delete`, nested serializers referencing classes defined later, the `users`
   auth app's `urls.py` being deleted after generation, singular/plural route
   mismatches between frontend and backend, and `Table.jsx` written twice.
3. **Frontend route protection is client-side only** (no `middleware.js`), tokens
   live in `localStorage`, and `isAuthenticated()` does not check expiry.
4. **No throttling** on `/api/token/`, `/api/signup/`, or the Groq-backed
   `/api/chat/`; the WebSocket passes the JWT in the query string and does not
   validate `Origin`.
5. **Coverage gaps**: `preview/`, `terminal/`, and most builder views have no
   tests; generator output is untested end to end.
6. **Dead code / stale artifacts**: `syntax_check.py` and legacy
   `apply_operations` are unused; `LandingPage.js`, `SyncBanner.js`, `AppNode.js`
   are imported nowhere; `components/builder/CustomPages.py` is a stray duplicate
   of a backend writer; `backend backup/`, `frontend backup/`, `htmlcov/`, and
   `codeassistant.zip` sit in the tree; there is no git repository, so none of
   the above has version history or revert.

---

# Visual Builder 2.0 — no-code canvas that generates code

The visual builder is now a design tool first and a generator second: what you
see on the canvas is rendered from the same function that writes the file.

## Live code panel (new)

- **`POST /api/projects/<uuid>/builder/render-code/`** (`backend/builder/views.py`,
  `RenderPageCodeView`) renders a widget tree to a complete `.jsx` file without
  touching disk. It validates the tree (depth ≤ 60, ≤ 5000 nodes, ≤ 1 MB),
  enforces project ownership, and returns `{code, hash, component_name}`.
- **`frontend/components/visualbuilder/CodePanel.js`** shows that file next to
  the canvas: line-numbered, read-only, debounced at 400 ms with a request-
  sequence guard so a slow render can never overwrite a newer one. Copy,
  Download `.jsx`, Regenerate, and Save & Generate (wired to the existing
  generate action).
- The preview is **byte-identical** to generation because both call
  `build_page_source` / `render_page_code` in `visual_pages.py`.

## Generated code is now injection-safe

`visual_pages.py` used to interpolate user text straight into JSX. Now:

- text children are emitted as JSON-escaped expressions (`{"..."}`), so `<`,
  `>` and `{` can never become markup;
- attributes (`className`, `href`, `src`, `alt`, `title`, labels, mode) go
  through `_jsx_attr`, so quotes and newlines cannot break out;
- inline styles are built as a dict and emitted with `json.dumps`;
- the schema JSON in the `/* @visual-builder-schema */` header escapes `*/`, so
  a widget label can no longer terminate the comment and inject code;
- component names are forced to valid JS identifiers;
- the hash now covers the canonical tree **and** the body, and the tree JSON is
  canonical (`sort_keys`, no whitespace), so the same design always hashes the
  same way;
- empty class tokens (`gap-`, `text-`) are dropped instead of emitting invalid
  Tailwind utilities;
- `Form` fields now honour `blank=False` (previously every generated field was
  optional because the writer looked for a `required` key that never existed).

## Canvas (Figma-style interactions)

- **Snap-to-guides**: dragging or resizing a free-positioned node snaps to the
  frame and sibling edges/centres within 6 screen px, with live guide lines.
  Threshold is zoom-corrected and the unsnapped position is preserved when
  nothing is near.
- **Arrow-key nudging**: 1 px, 10 px with Shift, for free-positioned selections.
  Flow-layout nodes keep the existing arrow = reorder behaviour.
- **Delete/Backspace** removes the selection (never the root, never while typing).
- **Fit to view** (plus existing zoom in/out/reset) in the floating zoom control.
- **Breakpoint preview**: Desktop / Tablet (768 px) / Mobile (390 px) artboard
  widths, design-time only — generated code is unchanged and responsive.
- **Autosave**: 2.5 s after the canvas goes idle the layout is persisted; the
  toolbar's dirty/synced badges reflect it.

## Tests added

- `VisualPageRenderTests` — escaping, schema-comment injection, component-name
  sanitising, stable/sensitive hash, form requiredness.
- `RenderPageCodeViewTests` — 200 + hash, missing tree, oversized tree, and
  cross-user 404.
- Full suite: **61 passed**; `npm run build` compiles all 9 routes.

## Still not Figma

Honest gaps: no component instances/variants, no multiplayer cursors, no
per-breakpoint style overrides (the breakpoint switcher is a preview, not an
override system), no inline text editing on canvas, and Prototype/Comment/Draw
tools remain stubs in the toolbar.

---

# Visual Builder 3.0 — inline text + reusable components

## Inline text editing

Double-click any text-bearing widget on the canvas (Text, Heading, Button, Link,
Badge, NavLink, …) and edit its text in place; `Enter` or blur commits, `Escape`
cancels. Canvas shortcuts are suppressed while the field has focus, and the
widget's preview is hidden behind the editor so it reads as in-place editing
([CanvasNode.js](frontend/components/visualbuilder/CanvasNode.js)).

## Reusable components (instances)

- **Create**: select one element → **Component** in the toolbar → name it. The
  master is stored in `blueprint.data.frontend.components` and the selection is
  replaced by a compact `Instance` node — one atomic PUT, no partial state.
- **Place**: the palette now has a **Components** section; drag a master onto
  the canvas (or into a Frame) like any other widget.
- **Canvas**: an instance renders its master read-only (no accidental edits to
  the shared tree), with explicit **Missing component**, **Empty component** and
  **Cyclic component reference** placeholders instead of crashes.
- **Detach**: select an instance → **Detach** to replace it with an editable
  copy of the master.
- **Code**: pages import real component files —
  `src/components/visual/<Name>.jsx`, rendered as `<Name />`. Nested instances
  inside a master are inlined so the import graph stays acyclic; a true cycle
  terminates in a comment instead of recursing. Names that would shadow
  generated imports (`Navbar`, `VisualTabs`, …) are prefixed with `Cmp`.

Tests: **65 passed** (4 new component-codegen tests: import + usage, missing
component, nested inlining, cycle termination). `npm run build` compiles all
routes.

## Master editing mode

Double-click an instance on the canvas to edit its master in place. While in
component mode:

- the toolbar shows **Component: &lt;name&gt;** and a **Back to page** button;
- edits, autosave and **Save** persist `frontend.components[i].tree`, so the
  change reaches every instance on every page;
- the **Code** panel switches to the component file
  (`src/components/visual/<Name>.jsx`, via `as_component: true`) instead of the
  page that imports it;
- unsaved page edits are flushed before entering, and page history is reset at
  both mode boundaries so undo can never cross between the page tree and the
  master tree;
- page switching is blocked while editing a component (use **Back to page**).

## Instance properties & variants

Components now have a small design-system contract:

- **Expose a property** — in master mode, select a text or image element and
  press **Expose**. It becomes a named property (`{id, name, nodeId, prop}`)
  stored on the component master.
- **Override per instance** — selecting an instance shows an **InstancePanel**
  instead of the normal properties panel: one input per exposed property plus
  **Reset all overrides**. Values live in `props.overrides` on that instance
  only; the master is never mutated.
- **Variants** — in master mode, **Variant** snapshots the current layout as a
  new named tree. A variant switcher appears in the toolbar to edit each one,
  and the instance panel gets a **Variant** dropdown. Deltas persist to
  `frontend.components[i].variants`.
- **Canvas** applies the selected variant and the instance's overrides when
  rendering the read-only master, so a page's copy shows what it will generate.
- **Generated code**:
  - the page emits `<MyCard variant="Compact" overrides={{"p1": "Custom"}} />`;
  - the component file becomes
    `export default function MyCard({ variant = "Default", overrides = {} } = {})`,
    with an `if (variant === "Compact")` block per variant and
    `{overrides["p1"] ?? "Card body"}` for exposed text (image `src` supports the
    same `??` fallback).
- **Master savings** — adding/removing variants, exposing properties and
  editing trees all persist through the same save/autosave path, and the page
  is flushed before mode switches.

Tests: **69 passed** — variant switch + override props in a page, component
signature/`if`-blocks/`??` expressions, plus the earlier escaping, hash,
component and endpoint coverage. `npm run build` compiles all routes.

## Honest gaps

- Overrides only apply to **base-tree** node ids; a property exposed on a
  variant applies to that variant only.
- No instance overrides for styles/layout (text and image `src` only).
- No UI to delete a master, a variant or an exposed property yet.
- Nested instances are inlined rather than imported, so generated component
  files stay acyclic but are not split into sub-components.

---

# Visual Builder 4.0 — editing ergonomics & component management

## Layers are now real

- **Lock is enforced**: a locked layer renders but ignores clicks, double-click
  text editing, dragging/resizing inside a Frame, Delete and arrow nudges. It can
  only be unlocked from the Layers panel.
- **Hide works**: `hidden` nodes are not rendered on the canvas (children
  included), while still appearing in the Layers list for unhiding.

## Multi-select editing

Selecting several widgets of the same type and changing a property in the
Properties panel applies the change to **all selected widgets of that type**
(mixed selections are left alone). The panel banner says so explicitly.

## Detach keeps the instance's own look

`Detach` previously cloned the raw master tree, silently dropping the instance's
variant and overrides. It now clones the **active variant** and re-applies each
override to its node before reassigning ids.

## Component management

- **Swap component** from the instance panel (clears variant + overrides, since
  property ids are component-specific).
- **Rename / delete a component** in master mode. Delete is blocked while any
  instance (on any page, or nested in another component) still uses it.
- **Delete a variant** (blocked while an instance selects it).
- **Remove an exposed property** from the instance panel, with a warning that
  every instance stops exposing it.

## Still open

- Overrides remain text/image-only and are keyed to base-tree node ids.
- No "where used" list beyond the block-on-delete count.
- Renaming a component renames its generated file only on the next generate.

---

# Visual Builder 5.0 — auto layout & variables/modes

## Auto layout

- **Sizing modes**: `widthMode` / `heightMode` = `hug` (`fit-content`) /
  `fill` (`100%`) / `fixed` (explicit px), in the properties panel and both
  renderers.
- **Direction override** (`row`/`column`), **wrap** (`wrap`/`nowrap`) and an
  exact **px gap** (`gapPx`) on any container — inline styles that override the
  manifest's Tailwind classes without changing them.

## Variables & light/dark modes

- Token colours now render as **CSS variables** (`var(--c-<id>)`) in generated
  pages instead of baked hex values.
- Generation writes `src/theme.css`:
  `:root` light values, `[data-theme="dark"]` dark values, plus a
  `prefers-color-scheme` fallback that respects an explicit
  `data-theme="light"`. `main.jsx` imports it.
- **Tokens panel** edits a light and a dark swatch per colour.
- The canvas has a **Dark/Light preview** toggle; it only changes design-time
  rendering — the generated app switches via `data-theme` or the OS preference.

Tests: **75 passed** (colour→var rendering, both-mode theme CSS, empty-token
fallback, auto-layout styles); `npm run build` green.

## Open in this area

- Only colour tokens are variables; numeric/string/boolean variables and more
  than two modes are not implemented.
- Text styles are still resolved at generation time, not emitted as variables.
- Generated apps have no visible theme-switch control yet (only the OS
  preference and a manual `data-theme` attribute).

---

# Visual Builder 6.0 — prototype actions, overlays & transitions

## Click actions

Any widget can carry `props.action`:

| Type | Generated behaviour |
|---|---|
| `navigate` | page gets `useNavigate()` + `const navigate = useNavigate();`, the widget is wrapped in a layout-neutral `<span style={{display: "contents"}} onClick={() => navigate("/route")}>` |
| `url` | `onClick={() => window.open("https://…", "_blank", "noopener")}` |
| none | no wrapper, no hook, no extra import |

- The renderer sets a **per-page flag**, so `useNavigate`/the hook are emitted
  only on pages that actually use navigation (verified by a test).
- Properties panel has a **Prototype action** section (type + target).
- The wrapper is `display: contents`, so adding an action cannot change the
  page's flex/grid layout.

Tests: **81 passed** (+6: navigate hook/handler, URL action, no-action page has
no hook, route registry, overlay import/state/modal/transition, unknown route
ignored); `npm run build` green.

## Overlays & transition presets

An `overlay` action resolves its target **route → component** through
`build_page_routes()` (model pages by pluralised name, custom pages by their
path). The generated page then:

- imports the target page (`import AboutPage from './AboutPage';`),
- adds `const [overlayPage, setOverlayPage] = useState(null);`,
- wraps the widget in `onClick={() => setOverlayPage("AboutPage")}`,
- renders a modal with backdrop, close button and
  `data-transition="instant|dissolve|slide|push"` plus an inline
  `animationDuration` from the action's duration.

The generated `index.css` carries the keyframes for the four presets; an
unknown target route is ignored (no import, no state) instead of emitting
broken code.

The live code panel resolves routes the same way, because the render-code
endpoint builds the same registry from the blueprint.

## Still not done in this area

- Actions are mouse-only on canvas (no keyboard activation) and the generated
  span has no button role.
- No hover/press states or interactive variants yet (phase 4).
- Overlay content is the whole target page; there is no `isOverlay` variant of
  a page.

---

# Visual Builder 7.0 — typed component properties

Component properties now carry a **type**, not just text:

| Type | Exposed from master mode | Generated code |
|---|---|---|
| text | **Text** (text/label/title prop) | `{overrides["p"] ?? "default"}` |
| color | **Color** (backgroundColor or color) | `"backgroundColor": overrides["p"] ?? "#fff"` |
| number | **Size** (fontSize) | `"fontSize": overrides["p"] ?? "16px"` |
| boolean | **Toggle** (any node) | `{overrides["p"] !== false && ( … )}` |

Implementation notes:

- Inline styles switched from JSON-only to **expression-capable**: `_style_attr`
  emits `_RawExpr` values verbatim, so a numeric/colour property can fall back
  with `??` while every literal still goes through `json.dumps`.
- Property lookups are now **per node and per prop** (`_props_by_node` maps
  `nodeId -> {prop: propertyId}`), so one element can expose text, colour, size
  and a visibility toggle at once.
- The instance panel renders the right control per type (checkbox, colour
  picker, number input, text input); colour properties store a default for the
  picker.
- Canvas applies `visible: false` overrides identically to hidden layers, so an
  instance can hide a node without touching the master.

Tests: **83 passed** (+2: typed property expressions, instance override values
reaching generated code); `npm run build` green (builder route 47.7 kB).

## Not done yet

- **Interactive variants** (click → switch variant inside the component with
  generated `useState`) — the remaining half of phase 4.
- Hover/press states.
- Number properties are only wired to `fontSize` from the UI; arbitrary numeric
  props need a picker.
- No enum property type — variants cover that use case for now.
