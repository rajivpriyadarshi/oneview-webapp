# Oneview Webapp

## Run configuration

Install dependencies:

```bash
npm install
```

Run the development server. Next.js loads `.env.development` automatically:

```bash
npm run dev
```

Run development server on all interfaces:

```bash
npm run dev:host
```

Create a production build. Next.js loads `.env.production` automatically:

```bash
npm run build:prod
```

Run the production server after building:

```bash
npm run start:prod
```

Use `.env.local`, `.env.development.local`, or `.env.production.local` for private machine-specific overrides. Those files are ignored by git.

`NEXT_PUBLIC_API_BASE_URL` should include the wealth API prefix, for example:

```text
https://labs-sbox.zinc.money/api/wealth
```

`NEXT_PUBLIC_AI_AGENT_SLUG` is optional and defaults to:

```text
wealth-advisor
```

Authenticated requests send:

```text
Authorization: Token <token>
```

## Google login

Clicking the Google button redirects to `NEXT_PUBLIC_GOOGLE_AUTH_START_URL` with:

- `redirect_uri`: `${window.location.origin}/auth/google/callback`
- `state`: browser-generated CSRF state

After Google auth completes, the backend should redirect to:

```text
/auth/google/callback?auth_token=<session-token>&state=<same-state>
```

The callback also accepts `token` as an alias for `auth_token`. If the callback receives `error`, a missing token, or a mismatched `state`, it returns the user to the login screen.
