# 🚀 My Perfect PM — Agile Jira Clone

**My Perfect PM** is a high-performance, resource-efficient, and security-hardened agile project management web suite inspired by Jira. It is engineered specifically for developers and teams managing multiple concurrent projects on low-resource VPS environments.

---

## ✨ Features

- **Full Agile Suite**:
  - **Cross-Project Dashboard**: Real-time velocity metrics, overall completion rates, story points delivered, and health breakdown across all projects.
  - **Interactive Kanban Board**: Ultra-smooth drag-and-drop powered by `@hello-pangea/dnd` with columns: *To Do*, *In Progress*, *In Review*, and *Done*, instant optimistic UI feedback, and backend persistence.
  - **Sprint & Backlog Planning**: Active sprint tracking, sprint start/completion workflows, backlog grooming pool, and story point estimations.
  - **Rich Issue Detail Modal**: Support for User Stories, Tasks, Bugs, Epics, Subtask checklists with progress indicators, Activity & Comment stream, and Markdown descriptions.
  - **Multi-Project Management**: Unique project keys (e.g. `ALPH-101`), color themes, leads, and member assignments.
- **Multi-Tenant & Multi-User Architecture**:
  - Logical multi-tenancy via shared SQLite database scoped by `tenant_id` / `organization_id`.
  - Organization switcher and role-based permissions (`admin`, `member`, `viewer`).
- **Single Binary Deployment (`go:embed`)**:
  - React + TypeScript SPA bundle is directly embedded into the pure-Go binary at compile time.
  - Requires **zero external reverse proxy** (no separate Nginx container needed).
  - Production Docker image is only **~25MB** with **< 30MB RAM** usage!
- **Instant Out-of-the-Box Demo Seeding**:
  - Automatic bootstrap of default admin and 2 realistic demo projects (*"Alpha Core Engine"* & *"Nebula Mobile App"*) on initial startup with active sprint tasks, subtasks, and comments.

---

## 🔒 Enterprise-Grade Security

| Protection Layer | Implementation Details |
|---|---|
| **Password Hashing** | Bcrypt / Argon2id with adaptive work factors preventing timing & rainbow table attacks. |
| **Session & JWT** | **Double-Cookie Scheme**: Short-lived (60 min) Access Token and rotated Refresh Token (7 days) stored in `HttpOnly`, `SameSite=Lax` cookies, immune to JavaScript XSS theft. |
| **Anti-CSRF** | High-entropy random cryptographic token set in `csrf_token` cookie. All state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require matching `X-CSRF-Token` custom headers, verified in constant time. |
| **SQL Injection Immunity** | Pure-Go SQLite (`glebarez/sqlite`) with GORM parameterized queries and bound variables throughout. |
| **Rate Limiter** | In-memory token bucket rate limiting per client IP to mitigate brute force and DoS attempts. |
| **Security Headers** | Injected on every response: Content Security Policy (`CSP`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| **Vulnerability Scanning** | CI pipeline integrates `aquasecurity/trivy` (filesystem & container CVE scanning) and `govulncheck` to catch vulnerabilities before release. |

---

## 🚀 Quick Start

### 1. Default Admin Credentials
When you run the application for the first time with an empty database:
- **Email**: `admin@myperfectpm.local`
- **Password**: `Admin123!`
- **Sample Workspace**: `Acme Global`

### 2. Run with Docker Compose (Recommended for VPS)
```bash
docker compose up -d --build
```
Open [http://localhost:8080](http://localhost:8080) in your web browser.

### 3. Local Development Mode

#### Start Backend:
```bash
go run ./cmd/server
```
Runs on `http://localhost:8080`.

#### Start Frontend (with Vite Hot Reload):
```bash
cd web
npm install
npm run dev
```
Runs on `http://localhost:5173` with automatic API proxying to port 8080.

### 4. Build Standalone Single Binary
```bash
# Build frontend
cd web && npm run build && cd ..

# Copy dist to cmd/server/dist
cp -r web/dist/* cmd/server/dist/

# Compile single binary
CGO_ENABLED=0 go build -ldflags="-s -w" -o my-perfect-pm ./cmd/server
```

---

## 🐳 Docker Deployment Details

The multi-stage `Dockerfile` uses:
1. `node:22-alpine` to compile the TypeScript React application.
2. `golang:1.24-alpine` to embed assets and compile a static CGO-free binary.
3. `alpine:3.21` running as an unprivileged non-root user (`appuser`).

- **Image Size**: ~25 MB
- **Idle Memory**: ~18 MB
- **Persistent Data Volume**: `/app/data/pm.db`

---

## 🛠️ Tech Stack

- **Backend**: Golang 1.24+, Gin Framework, GORM
- **Database**: Pure-Go SQLite (`glebarez/sqlite`) with WAL mode
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Agile Board**: `@hello-pangea/dnd`
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions, Trivy CVE Scanner, `govulncheck`, GitHub Container Registry (GHCR)
