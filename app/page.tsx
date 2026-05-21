export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <header className="brand">
          <OneviewMark />
          <span>Oneview</span>
        </header>

        <form className="login-card">
          <h1 id="login-title">Get started</h1>

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              name="email"
              defaultValue="naksh.mehta@gmail.com"
              autoComplete="email"
              aria-label="Email address"
            />
          </label>

          <label className="field password-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              defaultValue="secret"
              autoComplete="current-password"
              aria-label="Password"
            />
            <button
              className="visibility-button"
              type="button"
              aria-label="Show password"
            >
              <EyeClosedIcon />
            </button>
          </label>

          <button className="continue-button" type="submit">
            Continue
          </button>

          <p className="terms">
            By continuing, you agree to Zinc&apos;s Consumer{" "}
            <a href="#">Terms</a> and <a href="#">Usage Policy</a>, and
            acknowledge their <a href="#">Privacy Policy</a>.
          </p>
        </form>

        <footer className="zinc-brand" aria-label="by Zinc">
          <span>by</span>
          <ZincMark />
          <strong>ZINC</strong>
        </footer>
      </section>
    </main>
  );
}

function OneviewMark() {
  return (
    <svg
      aria-hidden="true"
      className="oneview-mark"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M32 5.5 38.1 10l7.5-.8 3.1 6.9 6.9 3.1-.8 7.5 4.7 6.1-4.7 6.1.8 7.5-6.9 3.1-3.1 6.9-7.5-.8-6.1 4.9-6.1-4.9-7.5.8-3.1-6.9-6.9-3.1.8-7.5-4.7-6.1 4.7-6.1-.8-7.5 6.9-3.1 3.1-6.9 7.5.8L32 5.5Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="21"
        y="21"
        width="22"
        height="22"
        rx="6"
        transform="rotate(45 32 32)"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 10c1.7 3.4 4.7 5.1 9 5.1S19.3 13.4 21 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.1 14.1 4.8 16M10 15.5l-.4 2.2M14 15.5l.4 2.2M17.9 14.1l1.3 1.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ZincMark() {
  return (
    <svg
      aria-hidden="true"
      className="zinc-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 2 4 9v14l12 7 12-7V9L16 2Z" fill="currentColor" />
      <path
        d="M16 6v20M10 12l6-4 6 4M10 20l6 4 6-4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".72"
      />
    </svg>
  );
}
