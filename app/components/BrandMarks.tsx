export function OneviewBrand() {
  return (
    <header className="brand">
      <OneviewMark />
      <span>Oneview</span>
    </header>
  );
}

export function ZincBrand() {
  return (
    <footer className="zinc-brand" aria-label="by Zinc">
      <span>by</span>
      <ZincMark />
      <strong>ZINC</strong>
    </footer>
  );
}

export function OneviewMark() {
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
