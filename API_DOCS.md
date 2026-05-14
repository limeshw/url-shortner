# 🔗 URL Shortener — Full API Documentation

> **Base URL:** `http://localhost:3000`  
> **Stack:** Node.js · Express.js · MySQL · Drizzle ORM · EJS  
> **Authentication:** Cookie-based JWT (access token + refresh token)

---

## 📑 Table of Contents

1. [Setup & Environment](#1-setup--environment)
2. [Authentication Overview](#2-authentication-overview)
3. [Auth Endpoints](#3-auth-endpoints)
4. [URL Shortener Endpoints](#4-url-shortener-endpoints)
5. [Validation Rules](#5-validation-rules)
6. [Database Schema](#6-database-schema)
7. [Error Reference](#7-error-reference)
8. [Quick Reference Table](#8-quick-reference-table)
9. [Testing with cURL](#9-testing-with-curl)

---

## 1. Setup & Environment

### Install dependencies
```bash
npm install
```

### Configure `.env`
Copy `.env.example` → `.env` and fill in values:

```env
PORT=3000
DATABASE_URL=mysql://root:"YourPassword"@localhost:3306/YourDB_Name
JWT_SECRET=your_jwt_secret_here
RESEND_API_KEY=re_xxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GITHUB_CLIENT_ID=Iv1.xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxx
```

### Database setup
```bash
npm run db:generate   # generate migration files
npm run db:migrate    # apply migrations to MySQL
npm run db:seed       # (optional) seed test data
```

### Start server
```bash
npm run dev    # development (auto-reload)
npm start      # production
```

---

## 2. Authentication Overview

This app uses **cookie-based JWT authentication**:

| Cookie | Purpose | Lifetime |
|---|---|---|
| `access_token` | Authenticate every request | Short (minutes) |
| `refresh_token` | Auto-renew access token | Long (days) |

- Cookies are **set automatically** on login/register.
- Every protected route reads the `access_token` cookie.
- If `access_token` is expired, the middleware **auto-refreshes** using `refresh_token`.
- When testing with **Postman**, enable **"Send cookies"** or use the Cookie Manager tab.
- When testing with **cURL**, use `-c cookies.txt` to save and `-b cookies.txt` to send cookies.

---

## 3. Auth Endpoints

---

### POST `/register`

Creates a new user account, logs them in, and sends an email verification link.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | 3–100 characters |
| `email` | string | ✅ | Valid email, max 100 chars |
| `password` | string | ✅ | 6–100 characters |

**cURL Example:**
```bash
curl -c cookies.txt -X POST http://localhost:3000/register \
  -d "name=John Doe&email=john@example.com&password=secret123"
```

**Success:** Sets `access_token` + `refresh_token` cookies → Redirects `302` to `/`

**Failures:**

| Condition | Flash Error |
|---|---|
| Validation fails | e.g. "Name must be at least 3 characters long." |
| Email already registered | "User already exists" |

---

### GET `/register`

Returns the HTML registration page. Redirects to `/` if already logged in.

---

### POST `/login`

Authenticates a user with email and password.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | ✅ | Valid email format |
| `password` | string | ✅ | 6–100 characters |

**cURL Example:**
```bash
curl -c cookies.txt -X POST http://localhost:3000/login \
  -d "email=john@example.com&password=secret123"
```

**Success:** Sets cookies → Redirects `302` to `/`

**Failures:**

| Condition | Flash Error |
|---|---|
| Validation fails | Validation message |
| User not found | "Invalid Email or Password" |
| Wrong password | "Invalid Email or Password" |
| OAuth-only account (no password set) | "You have created account using social login. Please login with your social account." |

---

### GET `/login`

Returns the HTML login page. Redirects to `/` if already logged in.

---

### GET `/logout`

🔒 **Auth required**

Invalidates the session, clears auth cookies, redirects to `/login`.

**cURL Example:**
```bash
curl -b cookies.txt http://localhost:3000/logout
```

---

### GET `/me`

Returns a plain-text/HTML response showing the current user's name and email. Useful for quickly testing if auth is working.

**cURL Example:**
```bash
curl -b cookies.txt http://localhost:3000/me
```

**Response (logged in):**
```html
<h1>Hey John Doe - john@example.com</h1>
```

**Response (not logged in):**
```
Not logged in
```

---

### GET `/profile`

🔒 **Auth required**

Returns the user's profile page including their short links list.

**cURL Example:**
```bash
curl -b cookies.txt http://localhost:3000/profile
```

**View receives:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "isEmailValid": true,
  "hasPassword": true,
  "avatarUrl": "uploads/avatar/1715000000_0.5.jpg",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "links": [ ...short link objects... ]
}
```

---

### GET `/edit-profile`

🔒 **Auth required**

Returns the edit profile HTML form, pre-filled with current name and avatar.

---

### POST `/edit-profile`

🔒 **Auth required**

Updates the user's display name and/or avatar image.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | 3–100 characters |
| `avatar` | file | ❌ | Image files only, max **5 MB** |

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/edit-profile \
  -F "name=Jane Doe" \
  -F "avatar=@/path/to/photo.jpg"
```

**Success:** Redirects to `/profile`

**Note:** Avatar files saved to `public/uploads/avatar/`. Accessible at `http://localhost:3000/uploads/avatar/<filename>`.

---

### GET `/verify-email`

🔒 **Auth required** (unverified users only)

Shows email verification page. Redirects to `/` if email already verified.

---

### POST `/resend-verification-link`

🔒 **Auth required** (unverified users only)

Sends a new email verification link to the user's email address.

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/resend-verification-link
```

**Success:** Sends email → Redirects to `/verify-email`

---

### GET `/verify-email-token`

Verifies the user's email using the token from the verification email link.

**Query Parameters:**

| Param | Type | Required | Rules |
|---|---|---|---|
| `token` | string | ✅ | Exactly 8 characters |
| `email` | string | ✅ | Valid email format |

**cURL Example:**
```bash
curl "http://localhost:3000/verify-email-token?token=abc12345&email=john@example.com"
```

**Success:** Marks email as verified → Redirects to `/profile`

**Failure:** Plain text: `"Verification link Invalid or Expired."`

---

### GET `/change-password`

🔒 **Auth required**

Returns the change password HTML form.

---

### POST `/change-password`

🔒 **Auth required**

Updates the user's password after verifying the current one.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `currentPassword` | string | ✅ | Must not be empty |
| `newPassword` | string | ✅ | 6–100 characters |
| `confirmPassword` | string | ✅ | Must match `newPassword` |

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/change-password \
  -d "currentPassword=oldpass&newPassword=newpass123&confirmPassword=newpass123"
```

**Success:** Redirects to `/profile`

**Failures:**

| Condition | Flash Error |
|---|---|
| Validation fails | Validation message |
| Current password wrong | "Current Password that you entered is Invalid." |

---

### GET `/reset-password`

Shows the forgot password form (enter email to receive reset link).

---

### POST `/reset-password`

Sends a password reset email if the email exists in the database.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | ✅ | Valid email format |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/reset-password \
  -d "email=john@example.com"
```

**Success:** Sends reset email (if user exists) → Redirects back to `/reset-password` with a "check your inbox" message.

> **Security:** The response is identical whether or not the email exists (prevents email enumeration).

---

### GET `/reset-password/:token`

Validates the reset token from the email link and shows the new password form.

| Param | Description |
|---|---|
| `:token` | The reset token from the email link |

**cURL Example:**
```bash
curl "http://localhost:3000/reset-password/abc123xyz"
```

**Success:** Renders new password form.

**Failure:** Renders `auth/wrong-reset-password-token` error page.

---

### POST `/reset-password/:token`

Submits the new password using the reset token.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `newPassword` | string | ✅ | 6–100 characters |
| `confirmPassword` | string | ✅ | Must match `newPassword` |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/reset-password/abc123xyz \
  -d "newPassword=mynewpass123&confirmPassword=mynewpass123"
```

**Success:** Clears reset tokens, updates password → Redirects to `/login`

**Failure:** Renders error page if token is invalid/expired.

---

### GET `/set-password`

🔒 **Auth required** (OAuth users without a password)

Shows the set password form. Only for users who registered via Google/GitHub.

---

### POST `/set-password`

🔒 **Auth required**

Sets a local password for OAuth users who don't have one yet.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `newPassword` | string | ✅ | 6–100 characters |
| `confirmPassword` | string | ✅ | Must match `newPassword` |

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/set-password \
  -d "newPassword=mypass123&confirmPassword=mypass123"
```

**Success:** Redirects to `/profile`

**Failure:** Flash error: `"You already have your Password, Instead Change your password"`

---

### GET `/google`

Initiates Google OAuth login flow. Redirects the browser to Google's consent screen.

> **Requires:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
> Add `http://localhost:3000/google/callback` as an authorized redirect URI in Google Cloud Console.

---

### GET `/google/callback`

Handles the OAuth callback from Google (called automatically by Google).

**Behavior:**
- Google account already linked → logs in existing user
- Same email exists (manual account) → links Google OAuth to that account
- New user → creates account, then logs in

**Success:** Redirects to `/`

**Failure:** Redirects to `/login` with flash error about invalid attempt.

---

### GET `/github`

Initiates GitHub OAuth login flow. Redirects the browser to GitHub's authorization page.

> **Requires:** `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.
> Add `http://localhost:3000/github/callback` as a callback URL in your GitHub OAuth App.

---

### GET `/github/callback`

Handles the OAuth callback from GitHub (called automatically by GitHub).

**Behavior:** Same as Google — links or creates account, then logs in.

**Success:** Redirects to `/`

**Failure:** Redirects to `/login` with flash error.

---

## 4. URL Shortener Endpoints

---

### GET `/`

🔒 **Auth required**

Lists all short links for the authenticated user with pagination (10 per page).

**Query Parameters:**

| Param | Type | Default | Rules |
|---|---|---|---|
| `page` | integer | `1` | Min: 1; auto-corrects invalid values to 1 |

**cURL Example:**
```bash
curl -b cookies.txt "http://localhost:3000/?page=1"
```

**View receives:**
- `links` — Array of short link objects (max 10)
- `host` — The server hostname
- `currentPage` — Current page number
- `totalPages` — Total number of pages

**Short Link Object:**
```json
{
  "id": 1,
  "url": "https://www.github.com",
  "shortCode": "gh",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "userId": 1
}
```

---

### POST `/`

🔒 **Auth required**

Creates a new short link.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `url` | string | ✅ | Valid URL, max 1024 characters |
| `shortCode` | string | ❌ | 2–50 characters. If omitted, a random 8-char hex code is auto-generated. |

**cURL Example — custom short code:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/ \
  -d "url=https://github.com&shortCode=gh"
```

**cURL Example — auto-generated code:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/ \
  -d "url=https://github.com"
```

**Success:** Redirects to `/`

**Failure:** Flash error: `"Url with that shortcode already exists, please choose another"`

---

### GET `/:shortCode`

🔓 **Public** — No authentication required

Redirects the browser to the original long URL.

| Param | Description |
|---|---|
| `:shortCode` | The short code (e.g. `gh`, `abc123ff`) |

**cURL Example:**
```bash
curl -L http://localhost:3000/gh
```

**Success:** `302 Found` → Redirects to the original URL.

**Failure:** `404` plain text: `"404 error occurred"`

> **Browser usage:** Simply visit `http://localhost:3000/yourShortCode`

---

### GET `/edit/:id`

🔒 **Auth required**

Shows the edit form for a specific short link.

| Param | Type | Description |
|---|---|---|
| `:id` | integer | Database ID of the short link |

**cURL Example:**
```bash
curl -b cookies.txt http://localhost:3000/edit/1
```

**Success:** Renders `edit-shortLink` view with `id`, `url`, `shortCode`, `errors`.

**Failure:** Redirects to `/404` if ID is invalid or link not found.

---

### POST `/edit/:id`

🔒 **Auth required**

Updates the URL and/or short code of an existing link.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Rules |
|---|---|---|---|
| `url` | string | ✅ | Valid URL |
| `shortCode` | string | ✅ | 2–50 characters, must be unique |

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/edit/1 \
  -d "url=https://github.com/explore&shortCode=ghexplore"
```

**Success:** Redirects to `/`

**Failures:**

| Condition | Result |
|---|---|
| Short code already exists | Flash error: "Shortcode already exists, please choose another" → Redirects to `/edit/:id` |
| Invalid ID / not found | Redirects to `/404` |

---

### POST `/delete/:id`

🔒 **Auth required**

Permanently deletes a short link.

| Param | Type | Description |
|---|---|---|
| `:id` | integer | Database ID of the short link |

**cURL Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/delete/1
```

**Success:** Redirects to `/`

**Failure:** Redirects to `/404` if ID is invalid.

---

## 5. Validation Rules

| Field | Rules |
|---|---|
| `name` | String, trimmed, min 3, max 100 chars |
| `email` | Valid email, trimmed, max 100 chars |
| `password` (login/register) | Min 6, max 100 chars |
| `currentPassword` | Required, min 1 char |
| `newPassword` | Min 6, max 100 chars |
| `confirmPassword` | Must equal `newPassword` |
| `url` (short link) | Valid URL format, max 1024 chars |
| `shortCode` | Trimmed, min 2, max 50 chars, must be unique |
| `page` (query param) | Positive integer ≥ 1, defaults to `1` on invalid input |
| Email verify `token` | Exactly 8 characters |

---

## 6. Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `name` | VARCHAR(255) | Required |
| `email` | VARCHAR(255) | Required, Unique |
| `password` | VARCHAR(255) | Nullable (OAuth users have no password) |
| `avatar_url` | TEXT | Optional |
| `is_email_valid` | BOOLEAN | Default: `false` |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto-updated |

### `short_link`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `url` | VARCHAR(255) | Original long URL |
| `short_code` | VARCHAR(20) | Unique short code |
| `user_id` | INT FK | → `users.id` |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto-updated |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `user_id` | INT FK | → `users.id` (cascade delete) |
| `valid` | BOOLEAN | Default: `true` |
| `user_agent` | TEXT | Client browser info |
| `ip` | VARCHAR(255) | Client IP |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto-updated |

### `oauth_accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `user_id` | INT FK | → `users.id` (cascade delete) |
| `provider` | ENUM | `google` or `github` |
| `provider_account_id` | VARCHAR(255) | Unique per provider |
| `created_at` | TIMESTAMP | Auto |

### `is_email_valid` (verify email tokens)
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `user_id` | INT FK | → `users.id` (cascade delete) |
| `token` | VARCHAR(8) | 8-char token |
| `expires_at` | TIMESTAMP | Default: now + 1 day |
| `created_at` | TIMESTAMP | Auto |

### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK Auto | Primary key |
| `user_id` | INT FK Unique | → `users.id` (cascade delete) |
| `token_hash` | TEXT | Hashed reset token |
| `expires_at` | TIMESTAMP | Default: now + 1 hour |
| `created_at` | TIMESTAMP | Auto |

---

## 7. Error Reference

| Status | Meaning |
|---|---|
| `302` | Redirect — most success and failure paths redirect |
| `404` | Short code not found |
| `500` | Internal server error |

> **Note:** This app uses **flash messages** for form errors. They are stored in the session and displayed on the redirected page — not returned as JSON. When testing manually, follow the redirect to see the error message.

---

## 8. Quick Reference Table

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | Dashboard with paginated links |
| POST | `/` | ✅ | Create new short link |
| GET | `/:shortCode` | ❌ | Redirect to original URL |
| GET | `/edit/:id` | ✅ | Edit short link form |
| POST | `/edit/:id` | ✅ | Update short link |
| POST | `/delete/:id` | ✅ | Delete short link |
| GET | `/register` | ❌ | Registration page |
| POST | `/register` | ❌ | Create new user account |
| GET | `/login` | ❌ | Login page |
| POST | `/login` | ❌ | Authenticate user |
| GET | `/logout` | ✅ | Logout and clear session |
| GET | `/me` | ❌ | Show current user info |
| GET | `/profile` | ✅ | User profile page |
| GET | `/edit-profile` | ✅ | Edit profile form |
| POST | `/edit-profile` | ✅ | Update name + avatar |
| GET | `/verify-email` | ✅ | Email verification page |
| POST | `/resend-verification-link` | ✅ | Resend verification email |
| GET | `/verify-email-token` | ❌ | Verify email token (from link) |
| GET | `/change-password` | ✅ | Change password form |
| POST | `/change-password` | ✅ | Update password |
| GET | `/reset-password` | ❌ | Forgot password form |
| POST | `/reset-password` | ❌ | Send password reset email |
| GET | `/reset-password/:token` | ❌ | Reset password form |
| POST | `/reset-password/:token` | ❌ | Submit new password |
| GET | `/set-password` | ✅ | Set password (OAuth users) |
| POST | `/set-password` | ✅ | Save password for OAuth user |
| GET | `/google` | ❌ | Initiate Google OAuth |
| GET | `/google/callback` | ❌ | Google OAuth callback |
| GET | `/github` | ❌ | Initiate GitHub OAuth |
| GET | `/github/callback` | ❌ | GitHub OAuth callback |

---

## 9. Testing with cURL

### Full flow from scratch

```bash
# Step 1: Register
curl -c cookies.txt -X POST http://localhost:3000/register \
  -d "name=Test User&email=test@example.com&password=testpass123"

# Step 2: Verify auth
curl -b cookies.txt http://localhost:3000/me

# Step 3: Create a short link (custom code)
curl -b cookies.txt -X POST http://localhost:3000/ \
  -d "url=https://github.com&shortCode=gh"

# Step 4: Create a short link (auto code)
curl -b cookies.txt -X POST http://localhost:3000/ \
  -d "url=https://www.youtube.com"

# Step 5: Follow a short link
curl -L http://localhost:3000/gh

# Step 6: View dashboard (page 1)
curl -b cookies.txt "http://localhost:3000/?page=1"

# Step 7: Edit a link (ID = 1)
curl -b cookies.txt -X POST http://localhost:3000/edit/1 \
  -d "url=https://github.com/explore&shortCode=ghexplore"

# Step 8: Delete a link (ID = 1)
curl -b cookies.txt -X POST http://localhost:3000/delete/1

# Step 9: Logout
curl -b cookies.txt http://localhost:3000/logout
```

### Postman Tips

1. Go to **Settings** → enable **"Automatically follow redirects"**
2. Open the **Cookies** tab and ensure cookie capture is enabled
3. Send `POST /login` with form body — Postman stores cookies automatically
4. All subsequent requests carry the cookies

**Content-Type headers to use:**

| Endpoint | Content-Type |
|---|---|
| Login, Register, most forms | `application/x-www-form-urlencoded` |
| `/edit-profile` (with avatar) | `multipart/form-data` |
