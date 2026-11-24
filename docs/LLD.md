# Low-Level Design (LLD) - TaskFlow

## 1. Module Responsibilities

The codebase follows the Controller-Service-Repository pattern with centralized schema validation, error handling, rate limiting, and a Vanilla JS frontend:

```
src/
├── config/
│   ├── database.js            # [Implemented] SQLite connection, safety pragmas, table DDL, migrations
│   └── env.js                 # [Implemented] Centralized environment configuration and native .env loader
├── repositories/
│   └── taskRepository.js      # [Implemented] Parameterized SQL prepared statements, relational LEFT JOINs
├── services/
│   └── taskService.js         # [Implemented] Business rules, domain validation, category validation
├── utils/
│   └── sanitize.js            # [Implemented] Server-side HTML/script injection sanitizer
├── errors/
│   └── appError.js            # [Implemented] Typed application domain errors (AppError, BadRequestError, NotFoundError)
├── validators/
│   └── taskSchemas.js         # [Implemented] Zod schemas for request body, query, and params
├── middleware/
│   ├── security.js            # [Implemented] Security headers (CSP, nosniff) and sliding-window rate limiting
│   ├── validateRequest.js     # [Implemented] Express validation middleware (compatible with Express 5)
│   └── errorHandler.js        # [Implemented] Centralized error handler and 404 route handler
├── controllers/
│   └── taskController.js      # [Implemented] HTTP request handling and standard JSON responses
├── routes/
│   └── taskRoutes.js          # [Implemented] Express task and category route declarations
├── app.js                     # [Implemented] Express app factory and middleware configuration
└── server.js                  # [Implemented] Server entrypoint, port binding, and graceful shutdown

public/
├── index.html                 # [Implemented] Semantic HTML5 dashboard layout
├── css/
│   └── styles.css             # [Implemented] Pure Vanilla CSS styling (responsive, category badges)
└── js/
    └── app.js                 # [Implemented] Client app, safe DOM operations, hash router, API integration
```

---

## 2. API Endpoint Specification

Base Path: `/api`

### 2.1 Health Endpoint
| Method | Endpoint | Description | Request Body | Success Response | Error Codes |
|---|---|---|---|---|---|
| `GET` | `/api/health` | Service health status | None | `200 OK`<br>`{ "success": true, "data": { "status": "healthy", "service": "TaskFlow Lite" } }` | None |

### 2.2 Task Endpoints
All task operations reside under `/api/tasks`:

| Method | Endpoint | Description | Request Body / Query | Success Response | Error Status Codes |
|---|---|---|---|---|---|
| `GET` | `/api/tasks` | List all tasks (supports completion filter) | Query: `?completed=true` or `?completed=false` (optional) | `200 OK`<br>`{ "success": true, "data": [ Task ] }` | `400 Bad Request`<br>`500 Internal Error` |
| `GET` | `/api/tasks/:id` | Retrieve single task by ID | Route Param: `:id` (positive integer) | `200 OK`<br>`{ "success": true, "data": Task }` | `400 Bad Request`<br>`404 Not Found`<br>`500 Internal Error` |
| `POST` | `/api/tasks` | Create a new task | `{ "title": "string", "description"?: "string" }` | `201 Created`<br>`{ "success": true, "data": Task }` | `400 Bad Request`<br>`500 Internal Error` |
| `PATCH` | `/api/tasks/:id` | Partially or fully update a task | Route Param: `:id`<br>Body: `{ "title"?: "string", "description"?: "string", "completed"?: boolean }` *(at least one editable field required)* | `200 OK`<br>`{ "success": true, "data": Task }` | `400 Bad Request`<br>`404 Not Found`<br>`500 Internal Error` |
| `DELETE` | `/api/tasks/:id` | Delete a task by ID | Route Param: `:id` (positive integer) | `200 OK`<br>`{ "success": true, "data": { "message": "Task deleted successfully" } }` | `400 Bad Request`<br>`404 Not Found`<br>`500 Internal Error` |

---

## 3. Database Schema

### Table: `tasks`
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
```

#### Timestamps & Field Formatting
- **`id`**: Auto-incrementing positive integer.
- **`title`**: Non-empty text string.
- **`description`**: Optional nullable text string.
- **`completed`**: Stored as `INTEGER` (0 = active/pending, 1 = completed); mapped to JavaScript `boolean` (`false` / `true`) by the repository.
- **`created_at` & `updated_at`**: Timestamps written as ISO 8601 strings (`new Date().toISOString()`), with a table-level fallback of `DATETIME('now')`.

---

## 4. Input Validation (Zod Schemas)

Located in `src/validators/taskSchemas.js`:

- **`createTaskSchema`**:
  - `title`: String, trimmed, min 1 character (required).
  - `description`: String, trimmed, optional/nullable.
  - `completed`: Boolean, optional.
- **`updateTaskSchema`**:
  - `title`: String, trimmed, min 1 character (optional).
  - `description`: String, trimmed, optional/nullable.
  - `completed`: Boolean (optional).
  - Refinement: Must contain at least one editable field (`title`, `description`, or `completed`).
- **`filterTasksSchema`**:
  - `completed`: Boolean or string enum (`'true'`, `'false'`, `'1'`, `'0'`), transformed to boolean.
- **`taskIdParamSchema`**:
  - `id`: Coerced to positive integer (`id > 0`).

---

## 5. Centralized Error Handling

### 5.1 Response Structure
All error responses adhere to the standard schema:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error explanation",
    "details": []
  }
}
```

### 5.2 Error Codes & HTTP Statuses
- **`400 Bad Request`**:
  - Code `VALIDATION_ERROR`: Zod schema failures (with structured `details` array).
  - Code `BAD_REQUEST`: Malformed JSON payloads or domain rule rejections.
- **`404 Not Found`**:
  - Code `NOT_FOUND`: Resource with given ID does not exist, or unmatched route.
- **`500 Internal Server Error`**:
  - Code `INTERNAL_SERVER_ERROR`: Unhandled exceptions. Message is generic; stack traces are never exposed.

---

## 6. Frontend Architecture (`public/`)

- **State Container:** Single state object in `app.js` holding `currentFilter`, `tasks`, `isLoading`, and `notificationTimeout`.
- **DOM Safety:** Strict prohibition of `innerHTML` when rendering user-supplied strings; all dynamic task text is bound via `.textContent` and standard DOM element constructors.
- **Inline Editing:** Dynamically swaps task card elements for an inline `<form>` with auto-focused input, cancelling or submitting directly via `PATCH /api/tasks/:id`.
- **Feedback & States:** Loading spinner, zero-task empty states, empty-filter states, and auto-dismissing notification toasts.
