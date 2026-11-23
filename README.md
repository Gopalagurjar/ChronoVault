# ChronoVault

A time-locked digital memory & message delivery platform (MERN stack). Users seal text, images or files in
**capsules** that stay encrypted until a **date**, a confirmed **life event**, or **inactivity** (dead man's switch).

```
chronovault/
  server/   Node.js + Express API, Mongoose models, Encryption module, node-cron scheduler, Nodemailer, Jest tests
  client/   React (Vite) single-page app
  render.yaml   optional Render blueprint
```

## How the security works (matches the report, Chapter 3)

| Step | What happens |
|---|---|
| Create | random 256-bit key (DEK) + random 96-bit IV per capsule; content encrypted with **AES-256-GCM** |
| Key storage | DEK is **wrapped** with the server master key (`MASTER_KEY`, kept only in an env variable). Only `IV2 | tag | ciphertext` of the DEK is stored |
| Integrity | `contentHash` = **HMAC-SHA256** of the plaintext with a separate `INTEGRITY_KEY`; GCM tag + HMAC are both checked at release |
| Unlock | node-cron runs every minute, compares **server time**, claims the capsule atomically, verifies integrity, then marks `UNLOCKED` and e-mails an unguessable link (never the content) |
| Tamper | any failed check -> `TAMPERED`, creator alerted, nothing delivered |
| Fail safe | any error leaves the capsule `LOCKED`; failed e-mail keeps it `UNLOCKED` and is retried next cycle; restart runs a catch-up pass |

Honest limit (report Section 3.5): this protects against a database-only leak or a curious database reader, **not** against
someone who controls the running server and its environment variables.

## 1. Requirements

Node.js 18+ (LTS), npm, a MongoDB database (local `mongod` or a free **MongoDB Atlas** cluster), and optionally an SMTP account.

## 2. Run it locally

### API
```bash
cd server
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run keys                  # prints MASTER_KEY, INTEGRITY_KEY, JWT_SECRET -> paste them into .env
# edit .env: set MONGODB_URI (Atlas connection string) and, optionally, the SMTP_* values
npm run dev                   # http://localhost:5000  (health check: /api/health)
```
If `SMTP_HOST` is empty the "emails" are printed in the server console, including the access link, so you can test everything without an SMTP account.

> **Back up `MASTER_KEY`.** Without it no capsule can ever be opened again.

### Web app
```bash
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5000
npm run dev                   # http://localhost:5173
```

## 3. Tests (Jest) and coverage

```bash
cd server
npm test        # = jest --coverage  (threshold: 80% statements for encryption, evaluators, scheduler)
```
Take your screenshot of this terminal output for **Figure 5.11** and copy the real Pass/Fail results into **Table 4.3**.

## 4. Quick manual test guide (maps to Table 4.3 in the report)

To avoid waiting, create a date capsule a couple of minutes ahead, or set `CRON_EXPR=*/1 * * * *` (default) and use short inactivity periods
(set `inactivityDays` to `1` and edit `lastCheckIn` in Atlas to two days ago).

| Test | How to run it |
|---|---|
| TC-01..03 | Register with valid data / the same email again / a 5-character password |
| TC-04 | Log in with a wrong password -> same generic message as for an unknown email |
| TC-05 | `curl http://localhost:5000/api/capsules` -> 401 |
| TC-06 | Create a capsule; open the `capsules` collection in Atlas: only `encryptedContent, iv, authTag, wrappedKey, contentHash`, no plaintext |
| TC-07 | Try a date in the past -> rejected |
| TC-08 | Open a LOCKED capsule's details -> metadata only |
| TC-09 | Register a second user and request the first user's capsule id -> 403 |
| TC-10/11 | Run before / after the unlock time; check status LOCKED then UNLOCKED -> DELIVERED and the console/inbox email |
| TC-12 | In Atlas change one character of `encryptedContent` of a due capsule -> status becomes TAMPERED, creator mail, nothing delivered |
| TC-13/14 | Inactivity capsule: leave it past the period / press Check-in before the period ends |
| TC-15 | Set a wrong `SMTP_PASS`; capsule stays UNLOCKED and is retried every minute until fixed |
| TC-16 | Run two server instances against one database -> the capsule is e-mailed exactly once |
| TC-17 | Stop the server past the unlock time, start it again -> processed on start-up (catch-up) |
| TC-18/19 | Open `/access/anything` -> "link is not valid". |
| TC-20/21 | Edit a LOCKED capsule's content (new IV and HMAC stored) / edit an UNLOCKED capsule -> refused (409) |
| TC-22 | Event capsule: open the confirmation link from the trusted contact's e-mail and press the button |

## 5. REST API (Appendix II of the report)

| Method and path | Auth | Purpose |
|---|---|---|
| POST `/api/auth/register` | none | Create account |
| POST `/api/auth/login` | none | Log in, returns JWT |
| POST `/api/capsules` | JWT | Create encrypted capsule |
| GET `/api/capsules` | JWT | List own capsules (metadata only) |
| GET `/api/capsules/:id` | JWT | Details (metadata only while LOCKED) |
| PUT `/api/capsules/:id` | JWT | Update a LOCKED capsule (re-encrypts if content changes) |
| DELETE `/api/capsules/:id` | JWT | Delete a LOCKED capsule |
| POST `/api/checkin` (GET for status) | JWT | Set `lastCheckIn` to server time |
| GET `/api/dashboard/stats` | JWT | Counts per status |
| GET/POST/PUT/DELETE `/api/contacts` | JWT | Manage trusted contacts |
| GET `/api/access/:token` | token | Recipient views content + integrity result |
| POST `/api/events/confirm/:token` | token | Trusted contact confirms a life event |
| GET `/api/health` | none | Uptime check |

## 6. Deploy (as in the report)

1. **MongoDB Atlas**: create a free cluster, a database user, and allow Render's IP (or `0.0.0.0/0` for a demo). Copy the connection string.
2. **Render (API)**: new Web Service from the repo, root directory `server`, build `npm install`, start `npm start`.
   Add the environment variables from `server/.env.example` (set `CLIENT_ORIGIN` to your Vercel URL). Use an always-on plan,
   or ping `https://<api>/api/health` every 5 minutes with an uptime monitor so the scheduler keeps running.
3. **Vercel (client)**: import the repo, root directory `client`, framework Vite, set `VITE_API_URL` to the Render URL.
   `vercel.json` already rewrites all paths to `index.html` so the `/access/:token` and `/confirm/:token` links work.
4. Put the live URLs into Table 5.1 of your report.

## 7. Email setup (Gmail example)
Turn on 2-step verification, create an **App password**, then use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
`SMTP_USER=<your gmail>`, `SMTP_PASS=<app password>`.

## 8. Notes
- Content limit is 5 MB (the JSON body limit is 8 MB because base64 adds about 33%).
- Passwords are hashed with bcrypt; JWTs expire after 24 h (`JWT_EXPIRES_IN`); auth and link endpoints are rate-limited.
- Recipient links expire after 30 days; only their SHA-256 hash is stored.
- The code was syntax-checked and the encryption, unlock-condition and scheduler logic were run through their unit tests,
  but it was **not run against a live MongoDB or SMTP server** in the build environment. Do a full run-through on your machine
  before recording screenshots and test results.
