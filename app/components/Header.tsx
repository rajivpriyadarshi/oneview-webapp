"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearAuthToken } from "../lib/session";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showAddMoreBtn?: boolean;
  showUploadBtn?: boolean;
}

export default function Header({
  title = "Your investments",
  subtitle = "Last updated: May 16, 2026 at 4:05 PM",
  showAddMoreBtn = false,
  showUploadBtn = false,
}: HeaderProps) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    clearAuthToken();
    router.push("/");
  };

  return (
    <header className="dashboard-header-fixed">
      <div className="dashboard-header-container">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">{title}</h1>
          <p className="dashboard-subtitle">{subtitle}</p>
        </div>
        <div className="dashboard-header-right">
          {showAddMoreBtn && (
            <Link href="/documents-vault" className="add-more-btn">
              <PlusIcon />
              Add documents
            </Link>
          )}
          {showUploadBtn && (
            <button className="upload-btn">
              <UploadIcon />
              Upload statements
            </button>
          )}
          <div className="header-profile-menu">
            <button
              className="header-avatar-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Profile menu"
            >
              <div className="header-avatar-placeholder" />
            </button>
            {showProfileMenu && (
              <>
                <div className="profile-menu-backdrop" onClick={() => setShowProfileMenu(false)} />
                <div className="profile-menu-dropdown">
                  <button className="profile-menu-item" onClick={handleLogout}>
                    <LogoutIcon />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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

function LogoutIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
      <path
        d="M12.333 12.333L15.666 9m0 0L12.333 5.667M15.666 9H6.333M6.333 2.333H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 00-.874.874c-.218.428-.218.988-.218 2.108v7.934c0 1.12 0 1.68.218 2.108a2 2 0 00.874.874c.428.218.988.218 2.108.218h1.133"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
