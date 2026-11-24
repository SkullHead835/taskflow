# TaskFlow

A clean, beginner-friendly, and maintainable task management web application built with Node.js, Express, SQLite, and Vanilla JavaScript.

---

## 1. Project Introduction

**TaskFlow** provides a straightforward, lightweight task tracking experience with zero build-tool friction. It demonstrates clean architectural principles (Repository -> Service -> Controller -> Routes -> Vanilla UI) using standard, stable web technologies.

---

## 2. Implementation Status

| Component | Status | Details |
|---|---|---|
| Project Structure & Config |  **Implemented** | Scaffolding, `package.json`, `.gitignore` |
| Environment Configuration |  **Implemented** | Centralized config (`src/config/env.js`), `.env.example`, native env loader |
| System Documentation |  **Implemented** | Aligned PRD, HLD, and LLD in `docs/` |
| Database Layer (`src/config/database.js`) |  **Implemented** | Normalized SQLite tables (`tasks`, `categories`), foreign keys, auto-migration, seed data |
| Data Repository (`src/repositories/taskRepository.js`) |  **Implemented** | Parameterized SQL prepared statements, relational `LEFT JOIN` queries, entity mapping |
| Business Logic (`src/services/taskService.js`) |  **Implemented** | Domain rules, server-side input sanitization, category validation |
| Input Validation & Sanitization |  **Implemented** | Zod schemas, HTML/script stripping utility (`src/utils/sanitize.js`), Express 5 validation |
| Security & Rate Limiting |  **Implemented** | Standard security headers (CSP, X-Frame, nosniff) and sliding-window API rate limiting (`429`) |
| REST API Routes & Controllers |  **Implemented** | Endpoints for tasks CRUD, category listing, and health status |
| Client-Side Routing |  **Implemented** | Hash-based routing (`/#/all`, `/#/pending`, `/#/completed`) with back/forward history navigation |
| Automated Test Suites (`tests/`) |  **Implemented** | 85 automated tests across 13 test suites with >90% line coverage |
| Web UI (`public/`) |  **Implemented** | Responsive HTML5, CSS3, and Vanilla JavaScript frontend |

---

## 3. Technology Stack

- **Runtime:** Node.js (v20+ recommended, tested with v25)
- **Web Framework:** Express.js 5
- **Database:** SQLite 3 via `better-sqlite3`
- **Validation:** Zod
- **Testing:** Node.js built-in test runner (`node --test`)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (zero external UI dependencies or build steps)

---

## 4. Frontend Features

- **Dashboard Header:**
  - Application title and subtitle.
  - Live task counter badge dynamically reflecting the total number of tasks.
- **Task Creation Form:**
  - Required title input (trimmed, max 120 chars).
  - Optional description textarea (max 1000 chars).
  - Client-side validation preventing empty/whitespace submissions.
  - Buttons disabled during submission to prevent duplicate tasks.
  - Automatic form reset upon successful creation.
- **Task List & Cards:**
  - Clear list layout with title, description, and status badge.
  - Checkbox to toggle task completion between pending and completed.
  - Strikethrough visual styling for completed tasks.
  - Accessible inline task editing (title and description) with Save and Cancel actions.
  - Task deletion with confirmation prompt to prevent accidental removal.
- **Task Filtering:**
  - Filter tabs: **All**, **Pending**, and **Completed**.
  - Powered directly by backend query parameters (`/api/tasks`, `/api/tasks?completed=false`, `/api/tasks?completed=true`).
- **User Feedback & UI States:**
  - Loading spinner indicator during data fetching.
  - Empty state when no tasks exist.
  - Filter empty state when no tasks match the selected filter.
  - Toast notification banner for immediate feedback on create, edit, delete, and errors.
- **Security & Quality:**
  - Safe DOM construction (`textContent` / `document.createElement`) without unsafe `innerHTML` injection.
  - Fully responsive design for mobile, tablet, and desktop screens.
  - High-contrast accessible styling with visible focus states.

---

## 5. REST API Endpoints

Base Path: `/api`

| Method | Endpoint | Description | Request Body / Query | Status Code |
|---|---|---|---|---|
| `GET` | `/api/health` | Service health status | None | `200 OK` |
| `GET` | `/api/tasks` | List all tasks | Query: `?completed=true` or `?completed=false` (optional) | `200 OK` |
| `GET` | `/api/tasks/:id` | Get task by ID | None | `200 OK` / `404` |
| `POST` | `/api/tasks` | Create a new task | `{ "title": "string", "description"?: "string" }` | `201 Created` |
| `PATCH` | `/api/tasks/:id` | Update a task | `{ "title"?: "string", "description"?: "string", "completed"?: boolean }` | `200 OK` / `404` |
| `DELETE` | `/api/tasks/:id` | Delete a task | None | `200 OK` / `404` |

---

## 6. How to Run the Application

### Prerequisites
- Node.js (v20.x or higher)
- npm (v9.x or higher)

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
```
Starts the production HTTP server on `http://localhost:3000` (or the port specified by the `PORT` environment variable).

### Development Mode (with Live Reload)
```bash
npm run dev
```
Starts the server with Node's native file watcher (`node --watch`).

### Accessing the Web UI
Open your browser and navigate to:
```
http://localhost:3000
```
The static frontend files (`index.html`, `styles.css`, `app.js`) are served directly from the root path.

### Running Automated Tests
```bash
npm test
```
Executes all unit, schema, and API integration test suites using the Node.js native test runner.

### Code Coverage Report
```bash
npm run test:coverage
```
Generates a full line, branch, and function coverage report via Node.js native test runner.
