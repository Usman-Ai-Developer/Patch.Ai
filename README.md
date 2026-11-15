# 🧩 patch/ – AI-Powered Code Assistant

**patch/** is an open-source, full-stack AI code assistant that lets developers describe code changes in natural language and have them applied directly to project files.

It works like a pair programmer that understands your codebase, retrieves only the relevant context, and performs precise file modifications through a conversational interface.

![patch/ workspace screenshot](https://via.placeholder.com/1200x600/0A0E14/3B82F6?text=patch%2F+Workspace)

---

## 🚀 Key Features

- **Natural Language Chat** – Tell the assistant what to change (e.g., *“add input validation to the signup form”*) and it proposes targeted edits.
- **Intelligent File Context** – The AI sees only the file tree upfront, then reads specific files on-demand, minimising token usage and keeping responses fast.
- **Safe, Targeted Edits** – Uses exact-text replacement (`replace`), file creation (`create`), full rewrites (`rewrite`) or deletion (`delete`) – all verified for uniqueness and safety before touching disk.
- **Project & File Management** – Upload a `.zip` or individual files, browse the file tree, view code, download any file or the whole project, rename and delete projects – all with a modern, responsive UI.
- **Version-Aware** – Each chat turn is logged with a changelog of operations, and the assistant remembers facts about your project (e.g., *“uses PostgreSQL, not SQLite”*) for continuity.
- **Authentication & Ownership** – JWT-secured endpoints with per-user project isolation, ready for multi-tenant use.
- **Modern Dark Theme** – Gradient backgrounds, brand-blue accents, and a sleek IDE-inspired workspace.

---

## 🧠 How It Works

1. **Upload** your project as a `.zip` (or individual files).
2. **Chat** – type a change request in the chat panel.
3. **The AI** receives the file tree and any remembered facts, reads only the files it needs using the `read_file` tool, and proposes a set of operations (`replace`, `create`, `rewrite`, `delete`).
4. **The Backend** validates each operation (e.g., ensuring a `replace` finds exactly one match) and applies the changes safely.
5. **You** see the result instantly – the file tree updates, changed files are reflected in the workspace, and the chat shows a summary of what was done.

Projects, chat history, and remembered facts persist between sessions, allowing you to continue working where you left off.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---------|------------|
| **Backend** | Django 4.2, Django REST Framework, JWT (SimpleJWT) |
| **AI** | Groq-hosted LLaMA models via structured tool-calling |
| **Database** | PostgreSQL (production) / SQLite (development) |
| **Cache/WebSocket** | Redis (optional) |
| **Frontend** | Next.js 14, React 18, Tailwind CSS |
| **Containerisation** | Docker & Docker Compose |
| **Testing** | pytest (backend), Jest (frontend) |
| **Deployment** | Render, Oracle Cloud, or any Docker-compatible host |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional, recommended)
- PostgreSQL (optional, if not using Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/Usman-Ai-Developer/patch.git
cd patch
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-api-key

DEBUG=True
DB_PASSWORD=postgres
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

For the frontend:

```bash
cd frontend
cp .env.local.example .env.local
```

Set:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run with Docker

```bash
docker compose up --build
```

This starts:

- PostgreSQL
- Redis
- Django Backend
- Next.js Frontend

Open:

```text
http://localhost:3000
```

Stop containers:

```bash
docker compose down
```

### 4. Run Locally

#### Backend

```bash
cd backend

python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate

python manage.py runserver
```

#### Frontend

```bash
cd frontend

npm install

npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🧪 Testing

### Backend

```bash
cd backend

pytest --cov=assistant --cov-report=term-missing
```

### Frontend

```bash
cd frontend

npm test
```

---

## 📡 API Overview

All endpoints are available under `/api/`.

Authentication is required for most endpoints.

| Endpoint | Method | Description |
|----------|----------|-------------|
| `/api/token/` | POST | Login |
| `/api/token/refresh/` | POST | Refresh token |
| `/api/signup/` | POST | Register user |
| `/api/projects/` | GET | List projects |
| `/api/projects/create/` | POST | Create project |
| `/api/projects/<uuid>/` | GET/PUT/DELETE | Manage project |
| `/api/projects/<uuid>/download/` | GET | Download project |
| `/api/projects/<uuid>/files/` | GET | Project file tree |
| `/api/projects/<uuid>/file-content/` | GET | Read file |
| `/api/projects/<uuid>/files/download/` | GET | Download file |
| `/api/projects/<uuid>/files/delete/` | DELETE | Delete file |
| `/api/projects/<uuid>/sync/` | POST | Sync uploaded zip |
| `/api/projects/<uuid>/chat/` | POST | Send instruction |
| `/api/projects/<uuid>/chat/history/` | GET | Retrieve chat history |
| `/api/projects/<uuid>/builder/render-code/` | POST | Render a widget tree to `.jsx` (no file written) |


---

## 🎨 Visual Builder

`/project/<id>/visual-builder` is a no-code canvas that compiles to real code.

- **Design** – drag widgets from the palette, nest them, free-position inside a
  Frame, resize with snap-to-guides, align/distribute/group, reorder layers.
- **Edit text in place** – double-click a Text/Heading/Button and type; Enter
  commits, Escape cancels.
- **Reusable components** – turn any selection into a component with the
  **Component** button, then drag instances from the palette's Components
  section. **Double-click an instance** to edit its master (every instance
  updates); **Detach** turns one back into editable widgets.
- **Instance properties & variants** – in master mode, **Expose** a text/image
  as a property and **Variant** to fork the layout; each instance then picks a
  variant and overrides its exposed properties without touching the master.
- **See the code** – the **Code** button opens a live panel showing the exact
  `.jsx` file that generation will write (copy, download, or regenerate).
- **Breakpoints** – preview the canvas at desktop, tablet (768 px) and mobile
  (390 px) widths.
- **Autosave** – the layout is persisted 2.5 s after you stop editing.
- **Generate** – **Save & Generate Code** writes the React component into the
  project workspace, embedding the design tree so the canvas can detect drift.

Shortcuts: `⌘/Ctrl+Z` undo, `⌘/Ctrl+Shift+Z` redo, `⌘/Ctrl+C/V` copy/paste,
`⌘/Ctrl+D` duplicate, double-click to edit text, arrows nudge (Shift = 10 px) or
reorder, `Delete` removes the selection, `⌘/Ctrl+0` reset zoom,
`⌘/Ctrl+=`/`-` zoom.

---

## 📌 Known Limitations

- No diff approval step before edits are applied.
- No undo/version history.
- `replace` operations require unique text matches.
- Long conversations eventually lose fine-grained context.
- Binary files are never sent to the LLM.
- Production deployments should tighten CORS settings.

---

## 🔮 Suggested Next Features

1. Diff preview + approve/reject workflow.
2. Git-backed undo history.
3. Rolling chat summarisation.
4. File relevance filtering before tool-calling.
5. Syntax highlighting in the code viewer.
6. Streaming assistant responses.

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch:

```bash
git checkout -b feature/my-feature
```

3. Commit your changes:

```bash
git commit -m "Add my feature"
```

4. Push your branch:

```bash
git push origin feature/my-feature
```

5. Open a Pull Request.

---


## 💬 Support

For bug reports, questions, or feature requests, please open an issue on GitHub.
