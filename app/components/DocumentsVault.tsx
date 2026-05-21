import { OneviewMark } from "./BrandMarks";

const documents = [
  {
    filename: "Fidelity holdings Mar 2024-Apr 2025.xls",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Plaid",
    size: "20 KB",
    account: "Fidelity",
    type: "xls",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Manual",
    size: "20 KB",
    account: "Zerodha",
    type: "xls",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Manual",
    size: "20 KB",
    account: "Zerodha",
    type: "png",
  },
  {
    filename: "HDFC statement XXXXXX0032 (FY24-25).pdf",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Manual",
    size: "20 KB",
    account: "HDFC bank",
    type: "pdf",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Manual",
    size: "20 KB",
    account: "Zerodha",
    type: "docx",
  },
  {
    filename: "Fidelity holdings Mar 2024-Apr 2025.xls",
    uploadedOn: "Oct 22, 2025 at 9:30 AM",
    uploadedBy: "Plaid",
    size: "20 KB",
    account: "Fidelity",
    type: "xls",
  },
];

export function DocumentsVault() {
  return (
    <main className="vault-page">
      <aside className="vault-sidebar" aria-label="Main navigation">
        <div className="vault-logo">
          <OneviewMark />
        </div>
        <nav className="vault-nav">
          <button type="button" aria-label="Analytics">
            <TrendIcon />
          </button>
          <button className="active" type="button" aria-label="Documents vault">
            <DocumentsIcon />
          </button>
        </nav>
        <div className="vault-avatar" aria-label="User avatar" />
      </aside>

      <section className="vault-content">
        <header className="vault-header">
          <h1>Documents vault</h1>
          <p>Total 8 files across 3 accounts</p>
        </header>

        <div className="vault-summary-grid">
          <VaultPanel title="Linked accounts" action="Add new" />
          <VaultPanel title="Import from statements" action="Add new" />
        </div>

        <section className="statements-card" aria-labelledby="statements-title">
          <div className="statements-header">
            <h2 id="statements-title">
              <StackIcon />
              Added statements
            </h2>
            <button className="group-button" type="button">
              <span>Group by:</span>
              <strong>Account</strong>
              <ChevronDownIcon />
            </button>
          </div>

          <div className="documents-table" role="table" aria-label="Added statements">
            <div className="table-head" role="row">
              <div role="columnheader">
                <span className="checkbox" />
              </div>
              <div role="columnheader">Filename</div>
              <div role="columnheader">Uploaded on <SortIcon /></div>
              <div role="columnheader">Uploaded by <SortIcon /></div>
              <div role="columnheader">Size <SortIcon /></div>
              <div role="columnheader">Account <SortIcon className="sort-active" /></div>
              <div role="columnheader">Status <SortIcon /></div>
              <div role="columnheader">Actions</div>
            </div>

            {documents.map((document, index) => (
              <div className="table-row" role="row" key={`${document.filename}-${index}`}>
                <div role="cell">
                  <span className="checkbox" />
                </div>
                <div className="file-cell" role="cell">
                  <FileIcon type={document.type} />
                  <span>{document.filename}</span>
                </div>
                <div role="cell">{document.uploadedOn}</div>
                <div role="cell">{document.uploadedBy}</div>
                <div role="cell">{document.size}</div>
                <div role="cell">{document.account}</div>
                <div role="cell">
                  <span className="status-pill">Processing</span>
                </div>
                <div className="actions-cell" role="cell">
                  <button type="button" aria-label={`Download ${document.filename}`}>
                    <DownloadIcon />
                  </button>
                  <button type="button" aria-label={`Preview ${document.filename}`}>
                    <EyeIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function VaultPanel({ title, action }: { title: string; action: string }) {
  return (
    <section className="vault-panel">
      <header>
        <h2>
          <StackIcon />
          {title}
        </h2>
        <button type="button">
          <PlusIcon />
          {action}
        </button>
      </header>
    </section>
  );
}

function FileIcon({ type }: { type: string }) {
  const label = type.toUpperCase();
  return <span className={`file-icon file-${type}`}>{label}</span>;
}

function StackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
      <path d="m5 11 7 3.7 7-3.7M5 15l7 3.7 7-3.7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 19V5M4 19h16M8 15l3-3 3 2 4-6" />
      <path d="M16 8h2v2" />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 4h7l3 3v7H7V4Z" />
      <path d="M14 4v4h4M5 10h4M5 14h4M7 18h11M15 15l3 3 3-5" />
    </svg>
  );
}

function SortIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 15v3h14v-3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
    </svg>
  );
}
