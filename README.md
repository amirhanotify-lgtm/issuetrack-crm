# IssueTrack CRM — Full Stack

A production-ready Customer Service CRM with Issue Tracking, Analytics, and Export capabilities.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js + Express                   |
| Database  | PostgreSQL 16                       |
| Frontend  | React 18 + React Router v6          |
| Charts    | Recharts                            |
| Auth      | JWT (jsonwebtoken + bcryptjs)       |
| Export    | ExcelJS (xlsx) + PDFKit (pdf)       |
| Container | Docker + Docker Compose             |

---

## Project Structure

```
crm/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js          # PostgreSQL connection pool
│   │   │   ├── migrate.js       # Schema + triggers
│   │   │   └── seed.js          # Sample data
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT + role middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # Login, register, /me
│   │   │   ├── clients.js       # Client CRUD
│   │   │   ├── notes.js         # Notes CRUD + increment + search
│   │   │   ├── categories.js    # Category CRUD
│   │   │   ├── users.js         # User management
│   │   │   ├── reports.js       # Analytics + Excel/PDF export
│   │   │   └── activity.js      # Activity log
│   │   ├── utils/
│   │   │   ├── logger.js        # Activity logger
│   │   │   └── pagination.js    # Pagination helpers
│   │   └── index.js             # Express app + server
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js        # Sidebar + Topbar
│   │   │   ├── Modal.js         # Reusable modal
│   │   │   ├── Pagination.js    # Pagination control
│   │   │   └── Badges.js        # Status/Priority/Role badges
│   │   ├── context/
│   │   │   └── AuthContext.js   # Global auth state
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── DashboardPage.js
│   │   │   ├── ClientsPage.js
│   │   │   ├── NotesPage.js
│   │   │   ├── ReportsPage.js
│   │   │   ├── ActivityPage.js
│   │   │   ├── UsersPage.js
│   │   │   └── CategoriesPage.js
│   │   ├── utils/
│   │   │   └── api.js           # Axios instance + interceptors
│   │   ├── App.js               # Router + Auth guard
│   │   └── index.css            # Global dark theme styles
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml
```

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone / enter the project
cd crm

# 2. Start everything
docker-compose up --build -d

# 3. Run migrations + seed data (first time only)
docker exec crm_backend node src/db/migrate.js
docker exec crm_backend node src/db/seed.js

# 4. Open the app
open http://localhost:3000
```

---

## Manual Setup (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### 1. Database

```bash
createdb issuetrack_crm
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and JWT secret

npm install
node src/db/migrate.js   # Create schema
node src/db/seed.js      # Load sample data
npm run dev              # Start with nodemon
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# REACT_APP_API_URL=http://localhost:5000/api

npm install
npm start
```

---

## Test Credentials

| Role       | Email                  | Password    |
|------------|------------------------|-------------|
| Admin      | sarah@company.com      | password123 |
| Supervisor | marcus@company.com     | password123 |
| Agent      | aisha@company.com      | password123 |
| Agent      | tom@company.com        | password123 |

---

## API Reference

### Auth
| Method | Endpoint          | Auth      | Description        |
|--------|-------------------|-----------|--------------------|
| POST   | /api/auth/login   | Public    | Login → JWT token  |
| POST   | /api/auth/register| Admin     | Create user        |
| GET    | /api/auth/me      | Any       | Current user info  |

### Clients
| Method | Endpoint          | Description               |
|--------|-------------------|---------------------------|
| GET    | /api/clients      | List (paginated, search)  |
| GET    | /api/clients/:id  | Get with full note history|
| POST   | /api/clients      | Create (unique phone)     |
| PATCH  | /api/clients/:id  | Update                    |
| DELETE | /api/clients/:id  | Delete (admin)            |

### Notes
| Method | Endpoint               | Description                   |
|--------|------------------------|-------------------------------|
| GET    | /api/notes             | List (filters, paginated)     |
| GET    | /api/notes/search?q=   | Duplicate detection search    |
| GET    | /api/notes/:id         | Single note detail            |
| POST   | /api/notes             | Create note                   |
| PATCH  | /api/notes/:id         | Update note                   |
| POST   | /api/notes/:id/increment| Increment counter            |
| DELETE | /api/notes/:id         | Delete (admin/supervisor)     |

### Reports
| Method | Endpoint                    | Description         |
|--------|-----------------------------|---------------------|
| GET    | /api/reports/summary        | Full analytics      |
| GET    | /api/reports/trend          | Time-series data    |
| GET    | /api/reports/export/excel   | Download .xlsx      |
| GET    | /api/reports/export/pdf     | Download .pdf       |

### Other
| Method | Endpoint            | Description           |
|--------|---------------------|-----------------------|
| GET    | /api/categories     | All categories + tree |
| POST   | /api/categories     | Create (admin)        |
| GET    | /api/users          | List users            |
| GET    | /api/activity       | Activity log          |

---

## Query Parameters

### GET /api/notes
```
?status=Open&priority=High&category_id=2&q=payment&from=2024-01-01&to=2024-12-31&page=1&limit=20
```

### GET /api/clients
```
?q=search+term&page=1&limit=20
```

---

## Role Permissions

| Feature            | Agent | Supervisor | Admin |
|--------------------|-------|------------|-------|
| View dashboard     | ✓     | ✓          | ✓     |
| Create notes       | ✓     | ✓          | ✓     |
| Edit own notes     | ✓     | ✓          | ✓     |
| Edit any note      | ✗     | ✓          | ✓     |
| Delete notes       | ✗     | ✓          | ✓     |
| View reports       | ✗     | ✓          | ✓     |
| Export Excel/PDF   | ✗     | ✓          | ✓     |
| Manage users       | ✗     | ✗          | ✓     |
| Manage categories  | ✗     | ✗          | ✓     |

---

## Database Schema

```sql
users          → id, name, email, password, role, active
clients        → id, name, phone (UNIQUE), email, company, notes_count
categories     → id, name, parent_id (self-ref FK)
notes          → id, client_id, agent_id, category_id, title, description,
                 priority, status, counter, resolved_at, created_at, updated_at
activity_logs  → id, user_id, action, target_type, target_id, target_name, meta
```

Key indexes: `phone`, `title` (GIN full-text), `category_id`, `status`, `priority`

Auto-triggers: `updated_at` auto-update, `notes_count` sync on clients

---

## Key Features

- **Duplicate Detection** — Real-time title search while typing; prompts to increment counter
- **+1 Counter System** — One click to record a repeat occurrence
- **Role-Based Access** — Admin / Supervisor / Agent with route + API guards
- **Advanced Filters** — Status, priority, category, date range, keyword search
- **Interactive Charts** — Line, bar, pie via Recharts
- **Excel Export** — Color-coded cells via ExcelJS
- **PDF Export** — Branded report via PDFKit
- **Activity Log** — Full audit trail of all system actions
- **Pagination** — All list endpoints paginated
- **JWT Auth** — Secure with auto-logout on expiry
