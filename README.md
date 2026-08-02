# Movie Booking (Cinema)

A movie ticket booking application with 2 parts:

- **cinema-be**: Node.js + Express + MongoDB (API)
- **cinema-fe**: React + Vite + TypeScript (Web)

## Prerequisites

- Node.js >= 18 (20.x recommended)
- npm (for the backend) and Yarn 3.x / Berry (for the frontend, already configured via `.yarnrc.yml`)
- A running MongoDB instance (local or MongoDB Atlas)

## 1. Install & run the Backend (`cinema-be`)

```bash
cd cinema-be
npm install
```

Create a `.env` file from the example, then fill in the required values (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, etc.):

```bash
cp .env.example .env
```

Run the server in dev mode (auto-reload on changes):

```bash
npm run dev
```

Or run in production mode:

```bash
npm start
```

The API runs by default at `http://127.0.0.1:8000/api`.

### Seed sample data (optional)

```bash
npm run seed
```

### Run backend tests

```bash
npm test
```

## 2. Install & run the Frontend (`cinema-fe`)

```bash
cd cinema-fe
yarn install
```

Create a `.env` file from the example, then set `VITE_API_BASE_URL` to the backend API URL (e.g. `http://localhost:8000/api`):

```bash
cp .env.example .env
```

Run the dev server:

```bash
yarn dev
```

The frontend runs by default at `http://localhost:3000` (configured in `vite.config.ts`).

### Production build

```bash
yarn build
yarn preview
```

### Run frontend tests

```bash
yarn test
```

## 3. Running both together

Open 2 separate terminals:

```bash
# Terminal 1
cd cinema-be && npm run dev
```

```bash
# Terminal 2
cd cinema-fe && yarn dev
```

Then open the frontend at `http://localhost:3000`; it will call the API at the address set in `VITE_API_BASE_URL`.

**Note:** make sure `CORS_ORIGIN` in `cinema-be/.env` matches the address the frontend is running on (`http://localhost:3000`) to avoid CORS errors.
