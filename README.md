# Movie Booking (Cinema)

A full-stack movie ticket booking platform for a **multi-branch cinema chain**: a public site for customers to browse movies and book seats, plus an internal back office for cinema companies, branch admins, and on-site staff — all driven by a permission-based RBAC system.

- **cinema-be**: Node.js + Express + MongoDB (Mongoose), JWT auth (access + refresh cookie), Socket.IO realtime, MoMo payment integration, Cloudinary image hosting, Nodemailer OTP emails.
- **cinema-fe**: React 18 + TypeScript + Vite, Redux Toolkit + TanStack Query, Tailwind, i18next (10 languages), Formik + Zod forms.

> This document describes the **actual current UX/behavior** of the app (routes, permissions, screens) as implemented in the code — not a spec. See [`cinema-be/src/seed/seedRbac.js`](cinema-be/src/seed/seedRbac.js) and [`cinema-be/src/seed/seedPositions.js`](cinema-be/src/seed/seedPositions.js) for the source of truth on permissions.

---

## 1. Prerequisites

- Node.js >= 18 (20.x recommended)
- npm (backend) and Yarn 3.x / Berry (frontend, via `.yarnrc.yml`)
- A running MongoDB instance (local or MongoDB Atlas)

## 2. Install & run the Backend (`cinema-be`)

```bash
cd cinema-be
npm install
cp .env.example .env
```

Fill in `.env` (Mongo URI, JWT secrets, CORS origin, Cloudinary, SMTP, MoMo — see [`cinema-be/.env.example`](cinema-be/.env.example)).

```bash
npm run dev     # dev mode, auto-reload
npm start        # production mode
npm run seed     # optional: seed sample movies/cinemas + RBAC roles/permissions/positions
npm test         # backend test suite (Jest)
```

The API runs by default at `http://127.0.0.1:8000/api`. `GET /health` is a liveness check.

## 3. Install & run the Frontend (`cinema-fe`)

```bash
cd cinema-fe
yarn install
cp .env.example .env   # set VITE_API_BASE_URL to the backend API URL
yarn dev
```

The frontend runs by default at `http://localhost:3000` (see `vite.config.ts`). `cinema-be`'s `CORS_ORIGIN` must match it.

```bash
yarn build && yarn preview   # production build
yarn test                     # frontend test suite (Vitest)
```

## 4. Running both together

```bash
# Terminal 1
cd cinema-be && npm run dev
```

```bash
# Terminal 2
cd cinema-fe && yarn dev
```

---

## 5. System overview

### 5.1 Org model

```
Company  ──1:N──▶  Branch (a.k.a. "Cinema")  ──1:N──▶  Room  ──1:N──▶  Seat
                         │
                         ├──1:N──▶ Schedule (showtime) ──1:N──▶ Ticket
                         ├──1:N──▶ Employee (staff account + Position)
                         ├──1:N──▶ Combo (concessions), Voucher
                         └── owned by one Account (the "Branch Admin")
```

- A **Company** is the legal entity that owns one or more **Branches**. Only Super Admin manages companies.
- A **Branch** ("cinema") is a physical theater location with rooms, seats, showtimes, staff, combos and vouchers. Each branch has exactly one **owner account** (Branch Admin).
- **Movies, Actors, Directors, Categories** are a shared catalog, not owned by any branch — any branch can schedule any movie.
- A **Booking** = one or more **Tickets** (seats) for a **Schedule**, optionally with **Combos** and a **Voucher**, paid via MoMo (online) or cash (staff counter sale), producing an **Invoice**.

### 5.2 Accounts & roles

Every account has one numeric `role` (stored in the JWT):

| Role | Code | Who |
|---|---|---|
| `0` | **Super Admin** | Platform operator — manages the whole system |
| `1` | **Customer** | Public end-user who books tickets |
| `2` | **Branch Admin** ("Owner") | Manages one or more branches on behalf of a Company |
| `3` | **Employee** | On-site staff at one branch, with a **Position** (Ticket Staff, Cashier, Combo Staff, Ticket Checker, Customer Service, Security, Cleaning Staff, Maintenance Staff) that determines exactly what they can do |

### 5.3 Permission model (RBAC)

Authorization is **not** hardcoded per role in the routes — every protected route is gated by `requirePermission('<module>.<action>')` (see [`cinema-be/src/middleware/permission.js`](cinema-be/src/middleware/permission.js)):

1. The account's `role` resolves to a `Role` document (`SUPER_ADMIN` / `CUSTOMER` / `BRANCH_ADMIN` / `EMPLOYEE`).
2. `RolePermission` looks up whether that role has the requested permission code, and its **scope**: `ALL` (any branch) or `BRANCH` (own branch(es) only) or `OWN` (own records only).
3. For an `EMPLOYEE` with no direct role permission, the middleware falls back to the account's **Position** (`Employee.position_id` → `PositionPermission`) — so two employees at the same branch can have different capabilities depending on whether they're a Cashier, a Ticket Checker, etc.
4. `requireBranchAccess` / `requireBranchOwnership` additionally enforce that a `BRANCH`-scoped user can only touch **their own branch's** data (Super Admin bypasses this).

The frontend mirrors this: `GET /api/user/permissions` returns the caller's resolved permission codes, consumed via the [`usePermissions()`](cinema-fe/src/hooks/usePermissions.ts) hook to conditionally render nav items/buttons (e.g. an Employee only sees "Counter Sale" if they have `booking.create`, and "Check-in" if they have `ticket.checkin`). Coarser page-level guarding uses [`RequireRole`](cinema-fe/src/app/RequireRole.tsx) with role groups from [`constants/roles.ts`](cinema-fe/src/constants/roles.ts):

- `ADMIN_ONLY_ROLES` = `[Super Admin]`
- `MANAGEMENT_ROLES` = `[Super Admin, Branch Admin]`
- `EMPLOYEE_ONLY_ROLES` = `[Employee]`
- `STAFF_ROLES` = `[Super Admin, Branch Admin, Employee]`

---

## 6. End-to-end flows

### 6.1 Registration & login (Customer)

1. **Register** (`/Register`) → email + password → backend checks the email isn't taken → account created **unverified** and an OTP is emailed.
2. **Verify** (`/verifycode`) → 6-digit OTP (with resend) → account activated.
3. **Complete profile** (`/UserInfo`) → name/phone saved.
4. **Login** (`/Login`) → `POST /api/Login` issues a short-lived **access token** (returned to the client, kept in Redux + localStorage) and a long-lived **refresh token** (httpOnly cookie). `POST /api/refresh-token` silently renews the access token; `POST /api/logout` clears the cookie.
5. Forgot/([`/ForgotPassword`](cinema-fe/src/features/auth/pages/ForgotPasswordPage.tsx)) → OTP email → **Reset password** (`/ResetPassword`). Logged-in users can also **Change password** (`/ChangePassword`).
6. **Profile** (`/Profile`) — view/edit name, phone, avatar.

### 6.2 Booking a ticket (Customer)

1. Browse: **Home**, **Playing now** (`/Playing`), **Upcoming** (`/Upcoming`), **Cinemas** (`/Cinemas`), movie detail (`/Detail/:id`), branch detail (`/Cinema/:id`) — filter by search/category/country/date/branch. Like a movie (♥) and favorite a branch while browsing.
2. **Movie detail** → reviews & star ratings (create/edit own review, reply, react 👍/❤️, report someone else's) and actor/director cast info.
3. Click **Book Now** on a movie → `/BookTicket/:id` — pick a date, then an available showtime for that date (login required; redirected to `/Login` otherwise).
4. → `/BookSeat` — interactive seat grid (Standard/VIP/Couple), select seat(s), optionally add **Combos** (popcorn/drinks) and apply a **Voucher** code (validated live, discount previewed). Every seat's price comes from the backend's Pricing Rule engine (branch/room type/seat type/movie category/day type/holiday/showtime/membership) — the frontend never computes it.
5. **Checkout** via MoMo — creates a pending invoice, redirects to MoMo, and on return (`/PaymentResult`) confirms/finalizes the booking (also confirmed asynchronously via MoMo's IPN webhook). A QR code (ticket code) is generated for check-in.
6. **My Bookings** (`/MyBookings`) — booking history, ticket QR/print, **cancel** a booking (only allowed if the showtime is more than 2 hours away).

### 6.3 Super Admin — platform management (`/AdminDashboard` + sidebar)

Everything below is Super-Admin-only (`user.*`, `branch.*`, `company.*`, `movie.*`, `actor.*`, `director.*`, `review.moderate`, `booking.admin`, `dashboard.viewSystem`, …):

- **Dashboard** (`/AdminDashboard`) — system-wide revenue, ticket sales, occupancy charts.
- **Users** (`/ShowUser`) — list/search all accounts; **block/unblock**, **delete**, **approve** pending staff accounts, reassign a user's role.
- **Movies** (`/Show`) — full CRUD (poster/trailer upload to Cloudinary), assign categories/actors/directors.
- **Schedules** (`/ShowSchedule`) — showtimes across every branch (create/update/cancel/delete).
- **Cinemas/Branches** (`/AdminCinemas`) — approve a pending branch, block/delete a branch, and create a **Branch Admin** account for a company (spins up the branch's owner login in one step).
- **Companies** — create/update/delete the parent legal entities that own branches (`company.*` permissions; no dedicated nav item is wired up in the current sidebar, but the API/back office concept is fully implemented).
- **Actors** (`/AdminActors`) / **Directors** (`/AdminDirectors`) — shared catalog CRUD.
- **Transactions** (`/AdminTransactions`) — every invoice system-wide, with **refund** (reopens the seat).
- **Reviews** (`/AdminReviews`) — moderate (hide) any review/reply across the platform.

### 6.4 Branch Admin — "Owner" back office (`/OwnerDashboard` + sidebar)

A Branch Admin manages the branch(es) they own (branch-scoped everywhere via `requireBranchOwnership`):

- **Dashboard** (`/OwnerDashboard`) — revenue/tickets/occupancy for their own branch(es).
- **Movies / Schedules** — same screens as admin, but scoped to movies they added / showtimes at their branches.
- **Cinemas** (`/OwnerCinemas`) — their branch(es) and status (pending/active/disabled/maintenance); edit branch contact/operating info.
- **Rooms** (`/OwnerCinemas/:branchId/Rooms`) — create/delete rooms, **generate a seat map** (rows × seats-per-row, with VIP/Couple row overrides), edit individual seat type/lock state.
- **Combos** (`/OwnerCombos`) — CRUD concession items per branch, activate/deactivate.
- **Vouchers** (`/OwnerVouchers`) — CRUD discount codes (fixed or percentage, min order value) per branch.
- **Bookings lookup** (`/OwnerBookings`) — look up any invoice by ticket code for their branch.
- **Employees** (`/OwnerEmployees`) — hire staff (email/password/name/phone + assign a **Position**), deactivate/reactivate, reset an employee's password.

### 6.5 Employee — on-site staff (`/EmployeeDashboard`)

What an employee sees is driven entirely by their resolved permissions (via Position), not a fixed menu:

- **Dashboard** — today's showtimes at their branch; "Sell tickets" / "Check-in" buttons only appear if the employee holds `booking.create` / `ticket.checkin` respectively.
- **Counter Sale** (`/EmployeeCounterSale`, needs `booking.create` + `payment.create`) — pick a showtime, select seats from the live seat grid, optionally look up a registered customer by email, take a cash/in-person payment, and issue the ticket(s).
- **Check-in** (`/EmployeeCheckIn`, needs `ticket.checkin`) — scan/enter a ticket code, view the booking (movie/branch/showtime/seat/paid status), and mark it **checked in** at the door.

Position-based capability matrix (from [`seedPositions.js`](cinema-be/src/seed/seedPositions.js)):

| Position | Can do |
|---|---|
| **Ticket Staff** | Book/sell tickets, cancel bookings, take payment |
| **Cashier** | Sell tickets, sell combos, take payment |
| **Combo Staff** | Sell/manage combo orders, take payment |
| **Ticket Checker** | Door check-in only |
| **Customer Service** | Read-only: schedules, bookings, tickets |
| **Security / Cleaning / Maintenance** | No system permissions (staff records exist for HR tracking only) |

### 6.6 Realtime updates

Socket.IO pushes live updates without polling: Super Admin sockets join an `admin` room, Branch Admin sockets join `owner:<accountId>` — e.g. approving a branch or changing its status invalidates the owner's cached cinema list instantly (see `realtimeSlice` / `RealtimeBridge`).

---

## 7. Key API surfaces (see route files for full detail)

| Area | Base path | Notes |
|---|---|---|
| Auth | `/api/Login`, `/register`, `/verify`, `/account`, `/forgot-password`, `/reset-password`, `/change-password` | OTP-gated registration, JWT + refresh cookie |
| Catalog | `/api/movie`, `/api/cat`, `/api/actor`, `/api/director`, `/api/movieActor`, `/api/movieDirector`, `/api/movieCat` | Public reads, Super-Admin-only writes |
| Org | `/api/company`, `/api/cinema` (alias `/api/branch`), `/api/room`, `/api/seat`, `/api/employee`, `/api/position` | Company → Branch → Room → Seat, staffing |
| Scheduling & booking | `/api/schedule`, `/api/ticket`, `/api/scheduleId`, `/api/bookseat/:id`, `/api/bookticket/:id`, `/api/MomoPayment`, `/api/invoice/*` | Showtime → ticket generation → booking → payment → check-in |
| Commerce | `/api/combo`, `/api/voucher` | Concessions and discounts, branch-scoped |
| Pricing | `/api/pricingRule`, `/api/pricingHoliday` | Pricing Rule CRUD (priority, effective dates, branch scope) driving the ticket pricing engine; never trust a client-sent price |
| Social | `/api/review`, `/api/like`, `/api/cinema/favorite` | Ratings/replies/reactions, movie likes, branch favorites |
| Ops | `/api/users`, `/api/block/:id`, `/api/owner/dashboard`, `/api/admin/dashboard`, `/api/admin/invoices` | Admin/owner back-office data |

---

## 8. Project structure

```
cinema-be/
  src/
    controllers/   one per resource, thin HTTP layer
    repositories/   MongoDB/Mongoose queries
    models/         Mongoose schemas (Account, Role, Permission, Company, Branch, Room, Seat,
                     Movie, Schedule, Ticket, Invoice, Combo, Voucher, Review, Employee, Position, …)
    routes/         Express routers — every write route documents its required permission inline
    middleware/     auth (JWT), permission (RBAC), ownership (branch scoping), upload, errorHandler
    seed/           seedRbac (roles/permissions), seedPositions, sample data seeders
    utils/          mailer, MoMo client, pricing, pagination, sockets, OTP, tokens

cinema-fe/
  src/
    app/            router, store, RequireRole guard
    features/       one folder per domain — admin, owner, employee, booking, auth, movies, home, …
                     each with api/ hooks/ pages/ store/ types/
    components/     shared layout (Header, AdminLayout, …) and UI kit (Button, Modal, DataTable, …)
    hooks/          usePermissions, redux hooks
    locales/        en, vi, zh, ja, ko, th, ru, fr, de, hi — full i18next translations
```
