# Aarogya Claims Platform
 
A claims management platform with two portals on a shared API and database:
 
- **Patient portal**: submit insurance claims with a supporting document and track their progress.
- **Insurer portal**: review, filter, approve or reject claims, set an approved amount, and leave comments.
| Item | Link |
|---|---|
| **Live application** | https://aarogya-claims-seven.vercel.app |
| **API (health check)** | https://aarogya-claims-vwl1.onrender.com/api/health |
| **GitHub repository** | https://github.com/Pratham-dash/Aarogya_claims |
| **Demo (screenshots / video)** | `<add link here, or place screenshots in /docs/screenshots>` |
 
**Quick start for reviewers:** open the live application and sign in with the credentials in [section 7](#7-mock-login-credentials) (there are "demo account" buttons on the login page).
 
> The API runs on a free Render instance that sleeps when idle. If the first sign-in is slow, wait 30 to 60 seconds, or open the API health link first to wake it up.
 
---
 
## 1. Requirements coverage
 
| ID | Requirement | Status | Where |
|---|---|---|---|
| P-1 | Submit a claim (name, email, amount, description, document) | Done | `client/src/pages/SubmitClaim.jsx`, `POST /api/claims` |
| P-2 | View claims: status, submission date, approved amount | Done | `client/src/pages/PatientDashboard.jsx`, `GET /api/claims` |
| I-1 | Dashboard with filters: status, submission date, claim amount | Done | `client/src/pages/InsurerDashboard.jsx` |
| I-2 | Review panel: details + document, approve/reject, approved amount, comments | Done | `client/src/pages/ClaimReview.jsx`, `PATCH /api/claims/:id/review` |
| S-1 | Authentication, role-isolated portals | Done | JWT + role middleware (server), `ProtectedRoute` (client) |
| S-2 | API for submitting, fetching, updating claims | Done | `server/src/routes/claims.js` |
| S-3 | Database persistence | Done | MongoDB via Mongoose |
 
All 13 performance/quality items requested are implemented; see [section 8](#8-performance-and-quality-checklist).
 
---
 
## 2. Tech stack (and why these versions)
 
| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18.3 + Vite 5 + React Router 6 | React as recommended. Vite gives fast dev builds, built-in minification, and code splitting. React 18 and Router 6 are the stable, widely documented line. |
| Backend | Node.js 20 LTS + Express 4.19 | Recommended stack. Express was chosen over NestJS because it has less indirection, so stack traces are short and easy to debug. Layers are still separated (routes, middleware, models, utils). |
| Database | MongoDB (Mongoose 8) | Recommended. Works with local MongoDB, Docker, or a free Atlas cluster. |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless, simple, no session store. |
| Validation | Zod | One schema per endpoint, structured error output. |
| Images | `sharp` (server), Canvas (browser) | Compresses uploads twice: before upload and again on the server. |
 
Runtime dependencies were kept minimal: 14 on the server and 3 on the client. There is no axios (native `fetch`), no UI kit, no dotenv/nodemon alternatives beyond `dotenv` (Node's `--watch` replaces nodemon).
 
---
 
## 3. Architecture
 
```
Browser (React SPA, served from CDN)
   |  HTTPS, JSON + multipart, Authorization: Bearer <JWT>
   v
Express API -- helmet, cors, compression, morgan, rate-limit(login)
   |-- /api/auth       login, me
   |-- /api/claims     create / list / stats / detail / review     (role-checked)
   |-- /api/documents  stream stored file                          (ownership-checked)
   |-- in-memory cache (node-cache)  <- list, stats and detail responses
   v
MongoDB  (bounded connection pool)
   |-- users
   |-- claims
   `-- documents   (binary files, kept out of the claims collection)
```
 
**Request flow, patient submits a claim:** the browser downsizes the photo and posts `multipart/form-data`. The API authenticates the user, checks the `patient` role, validates fields with Zod, verifies and compresses the file (`sharp`), stores it in `documents`, creates the claim with `status: Pending`, and invalidates cached lists.
 
**Request flow, insurer reviews:** the dashboard calls `GET /api/claims?...` (paginated, filtered, served from cache when possible). Opening a claim loads `GET /api/claims/:id` and streams the document. `PATCH /api/claims/:id/review` validates the decision, updates the claim, and invalidates caches so patients see the result.
 
---
 
## 4. Data model
 
### `users`
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | required |
| `email` | String | required, unique, lower-cased |
| `passwordHash` | String | bcrypt (cost 10) |
| `role` | `patient` or `insurer` | required |
| `createdAt`, `updatedAt` | Date | |
 
### `claims` (the required fields from the brief are marked **(brief)**)
| Field | Type | Notes |
|---|---|---|
| `_id` (brief) | ObjectId | unique claim id |
| `patient` | ObjectId -> users | owner (extension: links claim to the account) |
| `name` (brief) | String | 2 to 100 chars |
| `email` (brief) | String | valid email, lower-cased |
| `claimAmount` (brief) | Number | > 0 and <= 10,000,000 |
| `description` (brief) | String | 10 to 2000 chars |
| `document` (brief) | String | URL path to the file, e.g. `/api/documents/<id>` |
| `documentId` | ObjectId -> documents | (extension) unique reference used for access checks |
| `documentName` | String | (extension) original filename, shown in the UI |
| `status` (brief) | `Pending`, `Approved` or `Rejected` | default `Pending` |
| `submissionDate` (brief) | Date | set on creation |
| `approvedAmount` (brief) | Number or null | set only when `Approved`; `null` otherwise |
| `insurerComments` (brief) | String | default `""`, max 2000 chars |
| `reviewedBy`, `reviewedAt` | ObjectId, Date | (extension) who and when the last decision was made |
| `createdAt`, `updatedAt` | Date | |
 
### `documents`
`data` (Buffer), `contentType`, `size`, `originalName`, `uploadedBy`, timestamps. It is a separate collection so listing claims never loads file bytes.
 
### Database indexes
| Index | Serves |
|---|---|
| `users.email` (unique) | login lookup |
| `claims {patient, submissionDate:-1}` | patient dashboard (default sort) |
| `claims {patient, status, submissionDate:-1}` | patient dashboard with status filter |
| `claims {status, submissionDate:-1}` | insurer status filter |
| `claims {submissionDate:-1}` | insurer date filter and default sort |
| `claims {claimAmount:1}` | insurer amount filter and sort |
| `claims {documentId:1}` (unique) | document access check |
 
Indexes are declared in `server/src/models/*.js` and built at startup (`Model.init()`) before the server accepts traffic.
 
---
 
## 5. API reference
 
Base path `/api`. All routes except `/auth/login` and `/health` need `Authorization: Bearer <token>`.
Errors always look like `{ "error": { "message": "...", "details": [{ "field": "...", "message": "..." }] } }`.
 
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness + DB status (used by hosting health checks) |
| POST | `/auth/login` | public | `{email, password}` -> `{token, user}`. Rate-limited. |
| GET | `/auth/me` | any | Validates the token, returns `{user}` |
| POST | `/claims` | patient | `multipart/form-data`: `name, email, claimAmount, description, document` -> `201 {claim}` |
| GET | `/claims` | patient (own) / insurer (all) | Query: `page`, `limit` (max 50), `status`, `dateFrom`, `dateTo` (ISO), `minAmount`, `maxAmount`, `sort` (`newest`, `oldest`, `amount_asc`, `amount_desc`) -> `{items, page, limit, total, totalPages}` |
| GET | `/claims/stats` | insurer | Counts by status and totals (cached aggregate) |
| GET | `/claims/:id` | owner patient / insurer | One claim |
| PATCH | `/claims/:id/review` | insurer | `{status, approvedAmount?, insurerComments?}` where `status` is `Approved` or `Rejected` |
| GET | `/documents/:id` | owner patient / insurer | Streams the stored file |
 
Status codes: `400` validation, `401` unauthenticated or expired token, `403` wrong role, `404` not found (also used for other patients' claims so ids can't be probed), `413` file too large, `429` too many login attempts.
 
Quick check with curl:
```bash
TOKEN=$(curl -s localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"insurer@aarogya.test","password":"Insurer@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "localhost:5000/api/claims?status=Pending&limit=5" -H "Authorization: Bearer $TOKEN"
```
 
---
 
## 6. Authentication and authorization (S-1)
 
- Seeded users (below). Passwords are bcrypt-hashed; no registration flow (allowed by the brief).
- `POST /auth/login` returns a JWT (8h, configurable) holding user id, role, name and email. Login is rate-limited (30 attempts per 15 min per IP).
- **Server enforcement:** `authenticate` verifies the token on every route; `requireRole` restricts routes (`patient` can only create and read own claims, `insurer` can only review). Patients requesting another patient's claim or file get `404`.
- **Client enforcement:** `ProtectedRoute` sends signed-out users to `/login`, and sends a user who opens the other role's URL back to their own portal. This is a UX convenience only; the server is the real boundary.
- An expired or invalid token triggers an automatic sign-out.
## 7. Mock login credentials
 
| Role | Email | Password |
|---|---|---|
| Patient | `patient@aarogya.test` | `Patient@123` |
| Patient (2nd, for isolation testing) | `patient2@aarogya.test` | `Patient@123` |
| Insurer | `insurer@aarogya.test` | `Insurer@123` |
 
Users and six demo claims are created automatically when `SEED_ON_START=true` and the database is empty, or manually with `npm run seed`. Seeding is idempotent.
 
---
 
## 8. Performance and quality checklist
 
| # | Item | Implementation |
|---|---|---|
| 1 | Split code into chunks | Every page is `React.lazy` in `App.jsx`, and Vite `manualChunks` isolates `react` and `react-router` as long-lived vendor chunks. |
| 2 | Cache API responses | **Server:** `Cache-Control: private, no-cache` plus automatic ETags (browser revalidates, gets cheap `304`s); documents are `max-age=86400, immutable`. **Client:** 15s in-memory GET cache (cleared on any write and on sign-out) and a permanent blob cache for documents. |
| 3 | Index the database | Seven indexes matched to each query shape (section 4). |
| 4 | Compress images | Browser downsizes to 1600px WebP before upload (`compressImage.js`); the server re-encodes to WebP q75, max 1600px, auto-rotated (`processUpload.js`). Responses are gzip/brotli via `compression`. PDFs are stored as-is. |
| 5 | Load skeletons | `Skeleton.jsx`: table, stat-card, page and document skeletons on every data-loading view. |
| 6 | Cache for expensive queries | `node-cache` (`utils/cache.js`) caches claim lists (with their `countDocuments`), the stats `$group` aggregate, and claim detail for 30s. It is invalidated on every create/review so results are never stale after a write. |
| 7 | Debounce input handlers | `useDebounce` (400ms) on the insurer min/max amount filters. Stale requests are cancelled with `AbortController`. |
| 8 | Add CDN | The frontend is deployed on Vercel's global edge CDN. `vercel.json` marks `/assets/*` (content-hashed) as `immutable` for one year, and `index.html` as `must-revalidate`. |
| 9 | Paginate larger lists | Server-side `skip/limit` pagination (default 10, max 50) with UI pager on both dashboards. |
| 10 | Minify JS and CSS | Vite production build (`esbuild` for JS, `cssMinify: true`) with per-route CSS splitting. |
| 11 | Defer non-critical scripts | The entry is a `type="module"` script (deferred by the browser). Pages, document preview and their CSS load on demand. There are no third-party scripts or web fonts (system font stack). |
| 12 | Remove unused dependencies | Minimal dependency lists. `npm run deps:check` (depcheck) in `server/` and `client/` verifies this. |
| 13 | Hard database connection pool | `maxPoolSize` and `minPoolSize` are set explicitly in `config/db.js` (env `DB_POOL_MAX`=20, `DB_POOL_MIN`=2), plus idle, socket and server-selection timeouts. |
 
---
 
## 9. Run locally
 
**Prerequisites:** Node.js 20+, and MongoDB (local install, Docker, or an Atlas connection string).
 
```bash
# 1. MongoDB (skip if you have Atlas or a local install)
docker run -d --name aarogya-mongo -p 27017:27017 mongo:7
 
# 2. Install
npm run install:all            # or: (cd server && npm i) && (cd client && npm i)
 
# 3. Configure the API
cp server/.env.example server/.env     # edit MONGODB_URI / JWT_SECRET if needed
 
# 4. Start (two terminals)
npm run dev:server             # API on http://localhost:5000
npm run dev:client             # App on http://localhost:5173  (proxies /api to :5000)
```
Open http://localhost:5173 and sign in with the credentials above. Demo data is seeded on first start (`SEED_ON_START=true`).
 
### Environment variables
 
**`server/.env`** (template: `server/.env.example`)
 
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | none | MongoDB connection string |
| `JWT_SECRET` | yes | none | JWT signing secret; use a long random value |
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | `development` | `production` in deployment |
| `JWT_EXPIRES_IN` | no | `8h` | Token lifetime |
| `CLIENT_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `SEED_ON_START` | no | `false` | Seed demo users/claims if empty |
| `DB_POOL_MAX` / `DB_POOL_MIN` | no | `20` / `2` | Connection pool bounds |
| `MAX_UPLOAD_MB` | no | `10` | Upload size cap |
 
**`client/.env`** (template: `client/.env.example`)
 
| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | production only | Full API base URL including `/api`. Leave empty locally. |
 
---
 
## 10. Deployment
 
The application is deployed on free tiers of three services, with the code hosted on GitHub.
 
| Part | Service | Details |
|---|---|---|
| Frontend | Vercel (global CDN) | https://aarogya-claims-seven.vercel.app. Root directory `client`, framework preset Vite, build `npm run build`, output `dist`. |
| API | Render (Web Service) | https://aarogya-claims-vwl1.onrender.com. Root directory `server`, Node 20, build `npm install`, start `npm start`, health check path `/api/health`. |
| Database | MongoDB Atlas (M0 free cluster) | Database name `aarogya_claims`; a dedicated database user; network access open to `0.0.0.0/0` because Render's free tier has no fixed IP. |
| Source | GitHub | https://github.com/Pratham-dash/Aarogya_claims (`main` branch). Pushing to `main` redeploys both Render and Vercel automatically. |
 
**Render environment variables**
 
| Key | Value |
|---|---|
| `NODE_VERSION` | `20` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | the Atlas connection string (secret, not committed) |
| `JWT_SECRET` | a long random string (secret, not committed) |
| `CLIENT_URL` | `https://aarogya-claims-seven.vercel.app` (must match the site's origin exactly: `https://`, no trailing slash) |
| `SEED_ON_START` | `true` (creates the demo users and claims if the database is empty) |
 
**Vercel environment variable:** `VITE_API_URL` = `https://aarogya-claims-vwl1.onrender.com/api`. Vite embeds this at build time, so after changing it the frontend must be redeployed.
 
**Deploying from scratch**
 
1. **Database:** create a free Atlas M0 cluster, add a database user (letters and digits only in the password), allow network access from anywhere, and copy the `mongodb+srv://` connection string with `/aarogya_claims` added before the `?`.
2. **API:** in Render choose New, Web Service, pick the repository, and use the settings and variables above. Confirm `https://<api>/api/health` returns `{"status":"ok","db":true}`.
3. **Frontend:** in Vercel import the repository, set the root directory to `client`, and add `VITE_API_URL`. Deploy.
4. **Connect them:** set `CLIENT_URL` on Render to the Vercel domain and let Render redeploy.
`render.yaml` is included as an optional Render Blueprint. It uses `npm ci`, which requires `package-lock.json` to be committed in `server/`.
 
**Operational notes**
 
- Render's free tier sleeps after about 15 minutes idle and takes roughly 30 to 60 seconds to wake up on the next request.
- The Vercel deployment-specific URLs (with random characters) change on every build. Use the stable domain above, and keep `CLIENT_URL` set to it.
---
 
## 11. Assumptions
 
Every ambiguity in the brief was resolved as follows:
 
1. **Uploaded files live in MongoDB**, not on disk, because free hosting has ephemeral filesystems. Allowed types are JPG, PNG, WebP and PDF, up to 10 MB. Images are converted to WebP.
2. **A document is required** to submit a claim (the brief lists it as a captured field).
3. **Claim ownership:** each claim is linked to the signed-in patient. Name and email are pre-filled from the account but editable, since the brief lists them as form fields. The patient dashboard shows only that patient's claims, based on account ownership, not the typed email.
4. **Currency** is INR (₹), with amounts formatted in the `en-IN` locale.
5. **Approving requires an approved amount**, which must be greater than 0 and not exceed the claimed amount (partial approvals are allowed). **Rejecting requires a comment** so the patient learns why. Rejected claims store `approvedAmount = null`.
6. **Decisions can be revised.** An insurer may reopen an approved or rejected claim and change the decision; only the latest decision, `reviewedBy` and `reviewedAt` are kept (no audit trail). The `Pending` status can only be set by a new claim.
7. **Any insurer can review any claim.** There is a single insurer role with no teams or assignment.
8. **Date filters use the insurer's local calendar days** (the browser sends the start of the "From" day and the end of the "To" day as ISO instants, both inclusive). Submission dates are stored in UTC.
9. **Token storage:** the JWT is kept in `localStorage`, which keeps the deployment simple across two domains. This is exposed to XSS; a production system would use `httpOnly` cookies.
10. **Cache scope:** the server cache is per-process, which is correct for the single instance on the free tier. Multiple instances would need a shared cache such as Redis.
11. **Insurer comments are a single note per claim** (the data model has one `Insurer Comments` string), not a comment thread.
## 12. Not completed / known limitations
 
- No automated test suite (manual checklist below). No registration, password reset or email verification (explicitly out of scope).
- Sign-out is client-side: the JWT stays valid until it expires (no server-side revocation list).
- Documents are not virus-scanned. Only type, size and file signature/decoding are validated.
- NestJS (preferred but optional) was not used; Express was chosen for debuggability.
- The free Render instance sleeps when idle, so the first request after a quiet period is slow (see section 10).
---
 
## 13. Manual test checklist
 
1. Sign in as `patient@aarogya.test`, then open `/insurer`. You should be redirected to `/patient`.
2. Submit a claim with a photo, then confirm it appears as **Pending** with the right date.
3. Sign in as `insurer@aarogya.test` and filter by status, date range and amount. Type in the amount fields and confirm one request fires after you pause.
4. Open the new claim, view the document, approve it with an amount lower than claimed, and add a comment.
5. As the patient, confirm status, approved amount and comment show up.
6. Try approving above the claimed amount, and rejecting without a comment. Both should be blocked with an inline message.
7. Sign in as `patient2@aarogya.test`. You should not see the first patient's claims. `GET /api/claims/<id>` of theirs returns `404`.
## 14. Debugging tips
 
- `GET /api/health` shows whether the API can reach MongoDB.
- The API logs every request (`morgan`). `npm run dev` restarts on file change (`node --watch`).
- All errors share one JSON shape; the browser Network tab shows the exact `field: message` pairs.
- If the frontend gets CORS errors, check that `CLIENT_URL` on the API exactly matches the site origin (no trailing slash).
- If login fails on a fresh database, confirm `SEED_ON_START=true` or run `npm run seed`.
## 15. Project structure
 
```
claims-platform/
|-- README.md
|-- render.yaml                 Render blueprint (optional, API)
|-- package.json                helper scripts (install:all, dev:server, dev:client, seed)
|-- server/
|   |-- .env.example
|   `-- src/
|       |-- index.js            boot: DB, indexes, seed, listen, graceful shutdown
|       |-- app.js              middleware stack + routes
|       |-- seed.js             demo users and claims (idempotent)
|       |-- config/             env.js (validated env), db.js (pooled connection)
|       |-- models/             User, Claim (+ indexes, DTO), Document
|       |-- middleware/         auth (JWT + roles), upload (multer), error (central handler)
|       |-- routes/             auth, claims, documents
|       `-- utils/              cache, ApiError, asyncHandler, processUpload (sharp)
`-- client/
    |-- .env.example
    |-- vercel.json             SPA rewrite + CDN cache headers
    |-- vite.config.js          chunking, minification, dev proxy
    `-- src/
        |-- main.jsx, App.jsx   routing with lazy-loaded pages
        |-- api/client.js       fetch wrapper, token, caches, error type
        |-- context/            AuthContext
        |-- hooks/              useDebounce, useClaimsQuery
        |-- components/         Layout, ProtectedRoute, Skeleton, Pagination, StatusBadge, DocumentLink, DocumentViewer
        |-- pages/              Login, PatientDashboard, SubmitClaim, InsurerDashboard, ClaimReview
        `-- utils/              format, compressImage
```
