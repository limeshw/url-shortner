# Drizzle URL Shortener

A production-ready URL shortener built with Node.js, Express, EJS and Drizzle ORM. This project provides user authentication, link creation and management, analytics, email flows (verify and reset password), and database migrations/seeds via Drizzle.

**Status:** Production-ready starter (example project)

**Tech stack:**
- **Runtime:** `Node.js` (v16+ recommended)
- **Web framework:** `Express`
- **ORM:** `Drizzle` (see `drizzle/schema.js`)
- **Templating:** `EJS` (views in `views/`)
- **Email templates:** MJML in `emails/`

**Files of interest**
- **App entry:** [app.js](app.js)
- **Drizzle schema & seeds:** [drizzle/schema.js](drizzle/schema.js), [drizzle/seed.js](drizzle/seed.js)
- **Routes:** [routes/auth.routes.js](routes/auth.routes.js), [routes/shortener.routes.js](routes/shortener.routes.js)
- **Controllers:** [controllers/auth.controller.js](controllers/auth.controller.js), [controllers/postshortener.controller.js](controllers/postshortener.controller.js)
- **Services:** [services/auth.services.js](services/auth.services.js), [services/shortener.services.js](services/shortener.services.js)
- **Email templates:** `emails/verify-email.mjml`, `emails/reset-password-email.mjml`

Getting started
-----------------

Prerequisites
- **Node.js** (v16+)
- Access to a database supported by your `drizzle` setup (see `drizzle.config.js`)

Install

```bash
npm install
```

Environment
- Copy and populate environment variables (example list):
  - `PORT` — server port
  - `DATABASE_URL` — connection string for your DB
  - `SESSION_SECRET` — session encryption secret
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` — SMTP credentials
  - OAuth keys (if using GitHub/Google): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Development

```bash
npm run dev    # or `node app.js` depending on scripts in package.json
```

Database
- Run Drizzle migrations located in the `drizzle/migration/` folder according to your migration tooling.
- To seed sample data, run:

```bash
node drizzle/seed.js
```

Application Overview
---------------------
- Authentication: handled with session cookies. See `middlewares/verify-auth-middleware.js` and `controllers/auth.controller.js`.
- Shortener core: link creation, editing and analytics are implemented across `routes/`, `controllers/`, `services/`, and `models/`.
- Frontend: server-rendered EJS templates are in `views/` and partials in `views/partials/`.
- Email: templates in `emails/` are compiled by the helper in `lib/get-html-from-mjml-template.js` and sent via `lib/send-email.js`.

Important commands
- Install: `npm install`
- Start (production): `npm start`
- Start (dev): `npm run dev` (if present)
- Seed DB: `node drizzle/seed.js`

Deployment notes
- Ensure environment variables are set in your host (DATABASE_URL, SESSION_SECRET, email credentials, OAuth keys).
- Configure a process manager (PM2, systemd) for production.
- If using provider-managed DB, ensure migrations are applied before running the app.

Security & best practices
- Use a strong, random `SESSION_SECRET` and keep it out of source control.
- Serve the app behind HTTPS in production.
- Rotate email credentials and OAuth secrets when necessary.

Troubleshooting
- If server fails to start, check `PORT`, `DATABASE_URL`, and `SESSION_SECRET`.
- If emails don't send, verify SMTP settings and test with a simple SMTP client.

Contributing
- Fork → branch → PR. Keep changes focused to a single concern.

License
- This project is provided as-is. Add a license file to explicitly declare terms.

Contact / Authors
- See project repository root and package.json for author/contact information.
