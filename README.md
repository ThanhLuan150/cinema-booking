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

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in the environment variables in `cinema-be/.env`:

| Variable | Description |
| --- | --- |
| `PORT` | Port the API runs on, default `8000` |
| `MONGODB_URI` | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/cinema_booking` |
| `JWT_SECRET` | Secret string used to sign JWTs |
| `JWT_EXPIRES_IN` | JWT expiration time, e.g. `7d` |
| `CORS_ORIGIN` | Frontend domain allowed to call the API, defaults to `http://localhost:5173` (change to `http://localhost:3000` since the current Vite config runs on port 3000) |
| `CLOUDINARY_*` | Cloudinary settings used to store movie poster images |
| `SMTP_*`, `MAIL_FROM` | Email sending configuration |
| `MOMO_*` | MoMo payment gateway configuration |

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

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in the environment variable in `cinema-fe/.env`:

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the backend API, e.g. `http://localhost:8000/api` |

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
