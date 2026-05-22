export default function HomeHeader() {
  return (
    <header className="home-header">
      <div className="home-header-left">
        <h1 className="home-title">Good morning, Arjun!</h1>
        <p className="home-subtitle">Last updated: May 16, 2026 at 4:05 PM</p>
      </div>
      <button className="upload-btn">
        <UploadIcon />
        Upload statements
      </button>
    </header>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M7 8L12 3L17 8M12 3V15"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
