# High-Level Design (HLD) - TaskFlow Lite

## 1. System Architecture

TaskFlow Lite adheres to a clean, layered monolithic architecture executing within a single Node.js runtime process.

```mermaid
flowchart TD
    subgraph Client["Client Tier (Browser - Implemented Stage 4)"]
        UI["HTML5 / CSS3 / Vanilla JavaScript (public/)"]
        ApiClient["REST Client (Fetch API - public/js/app.js)"]
        UI <--> ApiClient
    end

    subgraph Server["Application Tier (Node.js & Express - Implemented Stage 3)"]
        Router["Express Router & Static Server (src/app.js, src/routes/)"]
        Val["Validation Middleware (src/middleware/validateRequest.js)"]
        Ctrl["Controllers Layer (src/controllers/taskController.js)"]
        Svc["Services Layer (src/services/taskService.js)"]
        Repo["Repositories Layer (src/repositories/taskRepository.js)"]

        Router --> Val
        Val --> Ctrl
        Ctrl --> Svc
        Svc --> Repo
    end

    subgraph Storage["Data Tier (Implemented Stage 1)"]
        DB[(SQLite Embedded Database)]
        Repo <--> DB
    end

    ApiClient <--> Router
```

---

## 2. Component Responsibilities

### 2.1 Client Tier (Public Assets - Implemented Stage 4)
- **HTML (`public/index.html`):** Semantic, accessible markup for task creation, filter tabs (All / Pending / Completed), and the task list.
- **CSS (`public/css/styles.css`):** Responsive stylesheet with clear visual hierarchy, accessible color contrasts, and focus rings.
- **JavaScript (`public/js/app.js`):** Vanilla JS handling user interactions, DOM updates (safe textContent construction), inline editing, and asynchronous fetch calls.

### 2.2 Application Tier (Express Backend - Implemented Stage 3)
- **Server Startup (`src/server.js`):** Reads `PORT` (default 3000), initializes persistent SQLite database, binds listener, and orchestrates graceful SIGINT/SIGTERM shutdown.
- **Express App Configuration (`src/app.js`):** Configures JSON body parser, serves static assets from `public/`, mounts `/api/health` and `/api/tasks`, mounts 404 handler, and registers centralized error handler. Supports dependency injection of `TaskService`.
- **Routes (`src/routes/taskRoutes.js`):** Declarative route routing for `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` bound to validation middleware.
- **Validation Schemas (`src/validators/taskSchemas.js`):** Zod schemas for task creation, updates, completion filter queries, and route parameter IDs.
- **Validation Middleware (`src/middleware/validateRequest.js`):** Intercepts requests, validates body/query/params, coerces values (Express 5 compatible), and formats structured 400 responses.
- **Controllers (`src/controllers/taskController.js`):** Extracts parameters, calls `TaskService`, and maps output to uniform `{ success: true, data }` responses.
- **Services (`src/services/taskService.js`):** Domain rules, sanitization, empty update guards, and repository delegation.
- **Centralized Error Handling (`src/middleware/errorHandler.js`):** Formats client/validation errors and returns a generic 500 for unexpected exceptions without leaking stack traces. Also handles 404 for unmatched routes.

### 2.3 Data Tier (SQLite - Implemented Stage 1)
- Local file database (`data/taskflow.db`) with WAL journal mode for development, and in-memory (`:memory:`) databases for automated testing.
- Table: `tasks` (`id`, `title`, `description`, `completed`, `created_at`, `updated_at`).

---

## 3. End-to-End Request Flow

### 3.1 Task Creation Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Browser as Browser (public/js/app.js)
    participant Route as Express Router (taskRoutes.js)
    participant MW as Validation Middleware (validateRequest.js)
    participant Ctrl as Task Controller (taskController.js)
    participant Svc as Task Service (taskService.js)
    participant Repo as Task Repository (taskRepository.js)
    participant DB as SQLite DB (better-sqlite3)

    User->>Browser: Enter title & click "Add Task"
    Browser->>Route: POST /api/tasks { title, description? }
    Route->>MW: validateRequest({ body: createTaskSchema })
    alt Validation Fails
        MW-->>Browser: 400 Bad Request { success: false, error: { code: "VALIDATION_ERROR", details: [...] } }
        Browser-->>User: Display notification error banner
    else Validation Passes
        MW->>Ctrl: createTask(req, res, next)
        Ctrl->>Svc: createTask(req.body)
        Svc->>Svc: Validate domain rules & sanitize strings
        Svc->>Repo: createTask({ title, description, completed: false })
        Repo->>DB: Execute INSERT prepared statement
        DB-->>Repo: Return lastInsertRowid
        Repo->>DB: SELECT * FROM tasks WHERE id = ?
        DB-->>Repo: Return inserted row
        Repo-->>Svc: Return formatted Task object
        Svc-->>Ctrl: Return Task object
        Ctrl-->>Browser: 201 Created { success: true, data: Task }
        Browser->>Browser: Prepend task to DOM list & increment counter
        Browser-->>User: Display success notification
    end
```

---

## 4. Database Overview

- **Storage Engine:** SQLite 3 via `better-sqlite3`.
- **Safety Pragmas:** `PRAGMA foreign_keys = ON;`, `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;` (file mode).
- **Timestamps:** ISO 8601 strings (`new Date().toISOString()`) written by application repository, with `DATETIME('now')` fallback at table level.
- **Booleans:** Stored as `INTEGER` (`0` or `1`), normalized to JavaScript `boolean` (`false` or `true`) by repository.
