# Dharohar - Simulated Folk Artist Booking Prototype

> **SIMULATED DATA - NOT REAL PAYMENTS**  
> Dharohar is a simulated booking prototype for folk artists. All artist profiles, booking negotiations, payouts, transactions, and audit records in this project are entirely fictional and for simulation and prototyping purposes only. No real banking, escrow, or payment operations are executed.

---

## Project Structure

```
PJ01/
├── backend/
│   ├── agents/            # Multi-agent negotiation modules (Organizer, Artist, Tools, LLM)
│   ├── rules/             # Rule engine and compatibility constraints
│   │   └── tests/         # Rule test suites
│   ├── trustpay/          # Simulated escrow state machine and mock provider
│   ├── audit.py           # Audit logging module
│   ├── database.py        # SQLite database connection & setup
│   ├── main.py            # FastAPI application with CORS & health endpoint
│   ├── requirements.txt   # Python backend dependencies
│   ├── seed.py            # Seed script for simulated folk artists
│   └── .env.example       # Example environment variables
├── frontend/
│   ├── src/
│   │   ├── components/    # Tab components (OrganizerChat, ArtistApprovalPanel, etc.)
│   │   ├── App.jsx        # Top banner & 4-tab container
│   │   └── main.jsx       # React DOM entry
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## Product Modes & Runtime Configurations

Dharohar operates in two distinct operational modes controlled via `.env`:

### 1. Product Mode (`DEMO_MODE=false`)
- **Default mode** for configurable development, staging, and production deployments.
- **Route Guards**: Demo-only endpoints (`/seed`, `/demo/*`) return `404 Not Found`.
- **Payment Gateway Selection (`PAYMENT_PROVIDER`)**:
  - `mock` (default): Uses `MockProvider` with in-memory simulated escrow. The frontend does NOT load the Razorpay Checkout SDK or open Checkout. The Pay button shows **"Pay (simulated)"** with a visible **"SIMULATED PAYMENT (test provider, no real money)"** indicator and executes mock escrow confirmation. `/webhooks/razorpay` returns `404 Not Found`.
  - `razorpay`: Uses `RazorpayProvider`. Requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; startup fails if missing. The frontend dynamically loads the Razorpay SDK and opens Razorpay Checkout. Webhook route `/webhooks/razorpay` processes signatures and captured events.
  - In production (`ENV=production`), `PAYMENT_PROVIDER=mock` is not selectable and fails startup immediately.
- **LLM Engine**: Scripted mock LLM is disabled; real LLMs (`gemini` or `anthropic`) are active.
- **Authentication**: Simulated OTP display is disabled.
- **Production Validation**: When `ENV=production`, the application verifies all mandatory credentials (`AUTH_SECRET`, `DATABASE_URL`, `LLM_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`), ensures `PAYMENT_PROVIDER=razorpay`, and halts if any are missing or invalid.

To run Product Mode:
```bash
# In backend/.env:
# ENV=development (or production)
# DEMO_MODE=false
uvicorn backend.main:app --reload --port 8000
```

### 2. Demo Simulation Mode (`DEMO_MODE=true`)
- Used for deterministic local demonstrations, testing, and offline prototype walk-throughs.
- **Enabled Routes**: Exposes `POST /seed`, `POST /demo/run-scenario`, `POST /demo/advance-time`, etc.
- **Payment Gateway**: Activates the in-memory `MockProvider` with time advancement and failure injection.
- **LLM Engine**: Allows scripted deterministic LLM dialog replay.
- **Authentication**: `/auth/request-otp` returns `demo_otp` in the response payload.

To run Demo Simulation Mode:
```bash
# In backend/.env:
# DEMO_MODE=true
uvicorn backend.main:app --reload --port 8000
```

---

## Configuration Variables Reference

| Variable | Type / Allowed Values | Default | Purpose | Required in Production |
| :--- | :--- | :--- | :--- | :---: |
| `ENV` | `development` \| `production` \| `test` | `development` | Runtime environment tier | Yes |
| `DEMO_MODE` | `true` \| `false` | `false` | Enables/disables demo endpoints and mock providers | No |
| `PAYMENT_PROVIDER` | `mock` \| `razorpay` | `mock` | Selects MockProvider vs RazorpayProvider (forbidden in production) | No (must be `razorpay` in prod) |
| `DATABASE_URL` | String (DB Connection URI) | `sqlite:///backend/dharohar.db` | SQLAlchemy database connection string | Yes |
| `AUTH_SECRET` | String (48+ char secret) | auto-generated | HS256 JWT token signing key | Yes |
| `LLM_PROVIDER` | `gemini` \| `anthropic` \| `scripted` | `gemini` | Unified AI provider engine | Yes |
| `LLM_API_KEY` | String | - | API key for Gemini or Anthropic | Yes |
| `LLM_MODEL` | String | `gemini-2.5-flash` | Target model identifier | No |
| `RAZORPAY_KEY_ID` | String (`rzp_test_...` / `rzp_live_...`) | - | Razorpay API Key ID | Yes |
| `RAZORPAY_KEY_SECRET` | String | - | Razorpay API Key Secret | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | String | auto-generated | Webhook signature verification secret | Yes |
| `WHATSAPP_TOKEN` | String | - | Meta WhatsApp Cloud API access token | Yes |
| `WHATSAPP_PHONE_ID` | Numeric String | - | WhatsApp business phone number ID | Yes |
| `ALLOWED_ORIGINS` | Comma-separated list | `http://localhost:5173,http://localhost:3000` | Whitelisted CORS origins | No |
| `PUBLIC_BASE_URL` | HTTPS URL | - | Public URL for webhook callbacks | No |

---

## First-Time Setup

Run these commands from the project root (`F:\PJ01`) using your Python virtual environment:

```bash
# 1. Initialize environment configuration & generate secure tokens
python -m backend.scripts.setup_env

# 2. Run system health diagnostics check
python -m backend.scripts.check_setup

# 3. Apply Alembic database migrations to head
alembic upgrade head

# 4. Create the first real operator user (production/development)
python -m backend.scripts.create_operator --name "Dharohar Operator" --phone "9876543210"

# 5. Install git pre-commit hook (scans for exposed secrets before commits)
git config core.hooksPath scripts/hooks
```

---

## Database Architecture & Alembic Migrations

Dharohar uses SQLAlchemy 2.0 with **Alembic** managing all schema migrations.

### Core Database Rules:
1. **Engine Tiering**: PostgreSQL with `psycopg` is strictly enforced when `ENV=production`. SQLite (`sqlite:///backend/dharohar.db`) is permitted only during development and automated tests. The application will raise a startup error if `ENV=production` and `DATABASE_URL` is configured with SQLite.
2. **Schema Management**: The application does not alter tables on startup (no `create_all()` in `main.py`). All tables, indexes, constraints, and triggers are managed through Alembic migrations.
3. **Integer Paise Everywhere**: All monetary values (`ArtistRow.min_fee`, `BookingRow.budget`, `TrustPayRow.amount`, `ReconciliationTicketRow.claimed_amount`) are strictly stored as integer paise (e.g. ₹25,000 is stored as `2500000`). Clear conversions to/from INR occur at API boundaries only (`// 100` and `* 100`).
4. **Append-Only Audit Logs**: The `audit_logs` table is strictly append-only. No update or delete operations are permitted. This is enforced simultaneously via:
   - Database-level triggers on SQLite (`prevent_audit_log_update`, `prevent_audit_log_delete`) and PostgreSQL (`prevent_audit_log_modification`).
   - SQLAlchemy ORM event listeners (`before_update`, `before_delete`) raising `RuntimeError`.
5. **Constraints & Indexes**:
   - `users`: Unique constraint and index on `phone`. Foreign key `artist_id` -> `artists.id`.
   - `bookings`: Foreign key `created_by_user_id` -> `users.id`.
   - `artists`: Indexes on `art_form` and `city`.
   - `audit_logs`: Foreign key `booking_id` -> `bookings.id`, index on `booking_id`.
   - `trustpay_records`: Foreign key `booking_id` -> `bookings.id`, index on `booking_id`.
   - `reconciliation_tickets`: Foreign key `booking_id` -> `bookings.id`, index on `booking_id`.
   - All tables include `created_at` and `updated_at` timestamps.

### Migration Commands:

```bash
# Apply all pending migrations to the database configured in DATABASE_URL
alembic upgrade head

# Downgrade by one revision
alembic downgrade -1

# Generate a new auto-detected migration after model changes
alembic revision --autogenerate -m "describe_changes"

# Check current migration revision status
alembic current
```

---

## Running Tests

### 1. Run Tests against SQLite (Default)
All unit and integration tests run out-of-the-box against SQLite:

```bash
python -m pytest backend
```

### 2. Run Tests against PostgreSQL (Neon or Local Postgres)
To run the full test suite against a PostgreSQL database, set `DATABASE_URL` with the `postgresql+psycopg://` driver scheme:

```bash
# On Linux / macOS / Bash:
DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require" python -m pytest backend

# On Windows (PowerShell):
$env:DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require"
python -m pytest backend
$env:DATABASE_URL=""
```

---

## Creating Real Operators

To bootstrap an administrative operator without seeding fictional accounts:

```bash
# Interactive mode (prompts for name and phone):
python -m backend.scripts.create_operator

# Non-interactive CLI mode:
python -m backend.scripts.create_operator --name "Aadya Operator" --phone "9876543210"
```

The script verifies that the phone number is not already assigned to a conflicting role and outputs the operator ID with phone numbers safely masked.

---

---

## Quick Start Guide

### 1. Backend Setup (FastAPI & SQLite)

Open a terminal in the root directory:

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (Python 3.11)
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.\venv\Scripts\activate.bat
# On macOS / Linux:
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# (Optional) Copy environment template
cp .env.example .env

# Run FastAPI server with auto-reload
uvicorn main:app --reload --port 8000
```

The backend will start at: `http://localhost:8000`  
Health check endpoint: `http://localhost:8000/health` (returns `{"status": "ok", "mode": "SIMULATED"}`)

---

### 2. Frontend Setup (React + Vite)

Open a second terminal in the root directory:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will run at: `http://localhost:5173`
