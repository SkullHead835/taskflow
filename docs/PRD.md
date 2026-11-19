# Product Requirements Document (PRD) - TaskFlow Lite

## 1. Project Overview
**TaskFlow Lite** is a minimal, lightweight, beginner-friendly task management web application. It provides users with a clean, distraction-free interface to create, review, update, complete, and delete tasks. The application is built using a simple, dependable technology stack: Node.js, Express.js, SQLite via `better-sqlite3`, Vanilla JavaScript, CSS, and HTML, validated via Zod and tested using Node's native test runner (`node --test`).

---

## 2. Problem Statement
Many task management systems are overly complex, difficult to maintain, and weighed down by heavy dependencies, complex build pipelines, and superfluous features. Developers and learners need a small, reliable, self-contained reference application that demonstrates clean architecture (Repository -> Service -> Controller) with zero build-tool friction and minimal resource usage.

---

## 3. Goals & Objectives
- **Simplicity:** Deliver core task tracking without bloat or unnecessary configuration.
- **Architectural Discipline:** Maintain a clear separation of concerns: Repository (data access) -> Service (business rules) -> Controller (HTTP).
- **Data Integrity:** Strict input validation with Zod and atomic persistent storage with SQLite.
- **Lightweight Testing:** Automated unit and integration testing using Node.js's native test runner without third-party test harnesses.

---

## 4. Target Scope & Core Features

### 4.1 Agreed Feature Scope
1. **Create Task:** Add a new task with a required title and optional description.
2. **View Tasks:** View all tasks in chronological order.
3. **Edit Task:** Update task title and/or description.
4. **Delete Task:** Remove a task by its ID.
5. **Toggle Status:** Mark tasks as completed or pending (active).
6. **Filter Tasks:** Filter task list by completion status (all, active/pending, completed).

---

## 5. Functional Requirements

| ID | Requirement | Description | Status |
|---|---|---|---|
| FR-01 | Create Task | Accepts `title` (required, non-empty) and optional `description`. Sets `completed` to `false` (0) by default. | **Implemented** (Repo & DB) |
| FR-02 | Read Tasks | Retrieves tasks with optional completion status filter (`completed=true` / `completed=false`). | **Implemented** (Repo & DB) |
| FR-03 | Read Task by ID | Retrieves a single task by its positive integer ID; returns `null` if nonexistent. | **Implemented** (Repo & DB) |
| FR-04 | Update Task | Allows updating `title`, `description`, or `completed`. Updates `updated_at` timestamp. Rejects empty update payloads. | **Implemented** (Repo & DB) |
| FR-05 | Delete Task | Deletes task by ID; returns confirmation of deletion. | **Implemented** (Repo & DB) |
| FR-06 | Business Logic Layer | Validates business constraints, disallows invalid updates, and coordinates with repository. | **Implemented** (Stage 2) |
| FR-07 | Input Validation | Validates incoming payloads and parameters using Zod schemas via middleware. | **Implemented** (Stage 2) |
| FR-08 | REST API Endpoints | Express route handlers for task CRUD operations. | **Implemented** (Stage 3) |
| FR-09 | Web Interface | Lightweight Vanilla JS / CSS interface for managing tasks. | **Implemented** (Stage 4) |

---

## 6. Data Model

The data layer uses a single SQLite table: **`tasks`**

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique task identifier |
| `title` | TEXT | NOT NULL | Task title (non-empty string) |
| `description` | TEXT | NULLABLE | Optional details |
| `completed` | INTEGER | NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)) | Status (0 = pending/active, 1 = completed; mapped to boolean in JS) |
| `created_at` | TEXT | NOT NULL DEFAULT (DATETIME('now')) | Timestamp of creation (ISO 8601 string via app, SQLite DATETIME fallback) |
| `updated_at` | TEXT | NOT NULL DEFAULT (DATETIME('now')) | Timestamp of last update (ISO 8601 string via app, SQLite DATETIME fallback) |

---

## 7. Non-Functional Requirements

- **Performance:** Local API endpoints respond in < 50ms under typical loads.
- **Lightweight Dependencies:** Core runtime constrained to `express`, `better-sqlite3`, and `zod`.
- **Reliability:** Parameterized prepared SQL statements for all database operations to eliminate SQL injection.
- **Maintainability:** Layered architecture with dependency injection for testability.
- **Cross-Platform:** Works on Windows, macOS, and Linux on Node.js v20+.

---

## 8. Explicitly Out-of-Scope Features
- Task priorities (low, medium, high)
- Categories and tags
- Due dates and reminders
- In-progress or multi-state workflows
- User authentication and multi-user tenancy
- Comments, subtasks, or attachments
- External third-party integrations
