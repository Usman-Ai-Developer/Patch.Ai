# patch/ — AI code assistant web app

Upload a project as a `.zip`, describe a change in chat, and Groq edits the files
directly on disk. Three-pane workspace: file tree, code viewer, chat. Dashboard
lists past projects so you can pick up where you left off.

## How it works (token-conscious by design)
1. You upload a `.zip` → Django extracts it into `backend/project_workspaces/<project_id>/`.
2. You type an instruction in chat.
3. Backend sends Groq the **file tree only** (paths, no content) + a short list of
   remembered facts about the project + your instruction — not the whole codebase.
4. Groq runs a tool-calling loop: it calls `read_file(path)` for whichever specific
   files it actually needs (and can ask for more mid-conversation, e.g. after seeing
   an import), then finishes by calling `propose_edits` with **targeted old-text →
   new-text replacements**, not full file rewrites. `create`/`rewrite` are only used
   for brand-new files or genuinely sweeping changes.
5. Backend validates every replacement — the "old" text must match exactly once in
   the current file, or the edit is rejected with a reason (logged back to you in
   chat) rather than silently corrupting the file.
6. Any durable facts Groq flags (stack choices, conventions, prior decisions) get
   stored in `ProjectFact` and resent on future turns — small and cheap, instead of
   resending the whole conversation transcript forever.
7. Projects, chat history, and remembered facts all persist in the database, so
   closing the tab and coming back later via the dashboard picks up exactly where
   you left off. Re-uploading a `.zip` to an existing project **merges** — files in
   the zip overwrite the current version, new files get added, but files missing
   from the zip are left alone (nothing gets silently deleted).

## Run it locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # then fill in GROQ_API_KEY
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Visit `http://localhost:3000`.

## Known limitations (worth knowing before you demo or extend this)
- **No diff approval step.** Edits apply immediately once `propose_edits` is called —
  good for speed, risky if Groq misunderstands the instruction. Natural next feature:
  show the proposed replacements and require a click to apply.
- **No undo/version history.** Consider wrapping the workspace dir in a git repo on
  upload and committing after every applied change — gives you free undo via `git revert`.
- **"replace" ops need genuinely unique old-text.** If a file has repeated boilerplate
  blocks, Groq may fail a replace and get told to retry with more context — usually
  self-corrects within the same turn, but watch backend logs if edits keep failing.
- **No rolling chat summarization yet.** History is capped at the last ~6 raw turns;
  `ProjectFact` covers durable facts, but very long conversations will still lose
  fine-grained context beyond that window. Worth adding a periodic summarization pass
  if sessions get long.
- **Binary files are uploaded but never sent to the LLM** (by extension allowlist in
  `settings.py`), so image/asset changes aren't supported yet.
- **No auth yet, but the seam is there.** `Project.owner` is a nullable FK to the user
  model already — wiring up login later is a migration + view permission checks, not
  a redesign. Right now anyone with the URL can open any project.
- **CORS is wide open** (`CORS_ALLOW_ALL_ORIGINS = True`) — tighten before deploying
  anywhere public.
- **`llama-3.3-70b-versatile` doesn't support Groq's prompt caching yet** (only Kimi K2
  and gpt-oss-20b do, as of this build). Switching models is a one-line env var change
  if the cost/quality tradeoff is worth it later.

## Suggested next features, roughly in order of value
1. Diff preview + approve/reject before applying
2. Git-backed undo history per project
3. Rolling chat summarization once conversations get long
4. A lightweight file-relevance filter (embeddings or a small trained classifier) ahead
   of the tool-calling loop, so Groq doesn't even see the full tree for huge projects
5. Syntax highlighting in the code viewer (currently plain `<pre>`)
6. Streaming the assistant's response instead of waiting for the full result
