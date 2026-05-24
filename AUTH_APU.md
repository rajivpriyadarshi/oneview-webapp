# Wealth Core — Auth API

Base path: `/api/wealth/auth/`

All request and response bodies are JSON. All endpoints are public (no auth token required) except **Logout**.

---

## Email + Password (OTP signup)

### 1. Initiate signup

```
POST /api/wealth/auth/signup/
```

Validates fields and sends a 6-digit OTP to the provided email. The OTP expires in **10 minutes**.

**Request**
```json
{
  "name":             "Jane Smith",
  "email":            "jane@example.com",
  "password":         "mypassword123",
  "confirm_password": "mypassword123",
  "phone":            "+1 555 000 0000"   // optional
}
```

**Response `200`**
```json
{
  "message": "OTP sent to jane@example.com",
  "email": "jane@example.com"
}
```

**Error responses**

| Status | `error` value |
|--------|---------------|
| `400`  | `name, email, and password are required.` |
| `400`  | `Enter a valid email address.` |
| `400`  | `Passwords do not match.` |
| `400`  | `Password must be at least 8 characters.` |
| `400`  | `An account with this email already exists.` |
| `502`  | `Failed to send verification email. Please try again.` |

---

### 2. Verify OTP

```
POST /api/wealth/auth/signup/verify/
```

Submits the OTP. On success, creates the user account and returns an auth token.

**Request**
```json
{
  "email": "jane@example.com",
  "otp":   "482910"
}
```

**Response `201`**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id":           42,
    "email":        "jane@example.com",
    "display_name": "Jane Smith"
  }
}
```

**Error responses**

| Status | `error` value |
|--------|---------------|
| `400`  | `email and otp are required.` |
| `400`  | `No pending signup for this email. Please sign up again.` |
| `400`  | `OTP has expired. Please sign up again.` |
| `400`  | `Too many incorrect attempts. Please sign up again.` |
| `400`  | `Incorrect OTP. N attempt(s) remaining.` |

---

### 3. Resend OTP

```
POST /api/wealth/auth/signup/resend-otp/
```

Resends a fresh OTP. Rate-limited to once per **60 seconds**.

**Request**
```json
{
  "email": "jane@example.com"
}
```

**Response `200`**
```json
{
  "message": "OTP resent to jane@example.com"
}
```

**Error responses**

| Status | `error` value |
|--------|---------------|
| `400`  | `email is required.` |
| `400`  | `No pending signup for this email. Please sign up again.` |
| `429`  | `Please wait N second(s) before requesting a new code.` |
| `502`  | `Failed to resend code. Please try again.` |

---

### 4. Login

```
POST /api/wealth/auth/login/
```

**Request**
```json
{
  "email":    "jane@example.com",
  "password": "mypassword123"
}
```

**Response `200`**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id":           42,
    "email":        "jane@example.com",
    "display_name": "Jane Smith"
  }
}
```

**Error responses**

| Status | `error` value |
|--------|---------------|
| `400`  | `email and password are required.` |
| `401`  | `Invalid email or password.` |
| `401`  | `This account has been deactivated.` |

---

### 5. Logout

```
POST /api/wealth/auth/logout/
```

Requires `Authorization: Token <token>` header. Invalidates the token server-side.

**Response `204`** — no body.

---

## Google OAuth

### How it works

The frontend handles the Google sign-in UI entirely — no server-side redirect is needed.

1. Load Google's Identity Services SDK and initialise it with your **client ID**.
2. When the user completes Google sign-in, Google calls your `callback` with a signed `credential` (an ID token JWT).
3. POST that token to `/api/wealth/auth/google/`. The backend verifies it cryptographically and returns a Zinc Labs auth token.

If the Google email matches an existing email/password account the accounts are linked automatically — the same token is returned.

---

### Endpoint

```
POST /api/wealth/auth/google/
```

**Request**
```json
{
  "id_token": "<credential from Google Identity Services callback>"
}
```

**Response `200`** — existing user signed in
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id":           42,
    "email":        "jane@example.com",
    "display_name": "Jane Smith"
  },
  "created": false
}
```

**Response `201`** — new account created via Google
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id":           43,
    "email":        "jane@example.com",
    "display_name": "Jane Smith"
  },
  "created": true
}
```

**Error responses**

| Status | `error` value |
|--------|---------------|
| `400`  | `id_token is required.` |
| `401`  | `Invalid Google token: <reason>` |
| `401`  | `Google OAuth is not configured on this server.` |
| `401`  | `Google account email is not verified.` |

---

### Frontend integration

The GIS SDK is loaded with `async` — use its `onload` callback to guarantee the
`google` global is available before calling `initialize` or `renderButton`.

```html
<!-- Place this where you want the button to appear -->
<div id="google-signin-btn"></div>

<script>
  function initGoogleSignIn() {
    google.accounts.id.initialize({
      client_id: 'YOUR_GOOGLE_CLIENT_ID',
      callback: async function (response) {
        const res = await fetch('/api/wealth/auth/google/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: response.credential }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error(data.error);
          return;
        }

        const { token, user, created } = await res.json();
        // Store token identically to the email/password login flow
        localStorage.setItem('auth_token', token);

        if (created) {
          // New user — redirect to onboarding
        } else {
          // Returning user — redirect to dashboard
        }
      },
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { theme: 'outline', size: 'large', width: 352 }
    );
  }
</script>
<script src="https://accounts.google.com/gsi/client" onload="initGoogleSignIn()" async></script>
```

---

### Google Cloud Console setup

In your OAuth 2.0 Client ID settings:

- **Authorized JavaScript origins** — add every origin your frontend runs on:
  ```
  http://localhost:3000
  https://yourdomain.com
  ```
- **Authorized redirect URIs** — not required for this flow.

> Changes to authorized origins can take up to 5 minutes to propagate.

---

## Using the auth token

All authenticated API calls must include the token as a Bearer/Token header:

```
Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b
```

The token does not expire automatically. It is invalidated on logout.

---

## Signup flow summary

```
Email/password flow:
  POST /signup/       → OTP sent
  POST /signup/verify/ → token returned (201)
  POST /signup/resend-otp/  → if needed

Google flow:
  Google SDK → id_token
  POST /google/       → token returned (200 or 201)

Login (returning user):
  POST /login/        → token returned (200)
  POST /google/       → token returned (200)
```