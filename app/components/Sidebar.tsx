"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken } from "../lib/session";
import { MeridianLogo } from "./MeridianLogo";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    clearAuthToken();
    router.push("/");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <MeridianLogo width={41} height={40} />
      </div>

      <nav className="sidebar-nav">
        <Link href="/dashboard" className={`sidebar-btn ${pathname === "/dashboard" ? "active" : ""}`} aria-label="Home">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M3 10.5L12 3l9 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 9.5V19a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V9.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <Link href="/documents-vault" className={`sidebar-btn ${pathname === "/documents-vault" ? "active" : ""}`} aria-label="Document Vault">
          <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
            <path
              d="M14.286 7.143V4.85728C14.286 3.65717 14.286 3.05711 14.0524 2.59873C13.847 2.19553 13.5192 1.86771 13.116 1.66227C12.6576 1.42871 12.0575 1.42871 10.8574 1.42871H6.28599C5.08588 1.42871 4.48582 1.42871 4.02744 1.66227C3.62424 1.86771 3.29642 2.19553 3.09098 2.59873C2.85742 3.05711 2.85742 3.65717 2.85742 4.85728V12.2859C2.85742 13.486 2.85742 14.086 3.09098 14.5444C3.29642 14.9476 3.62424 15.2754 4.02744 15.4809C4.48582 15.7144 5.08588 15.7144 6.28599 15.7144H7.50028M9.28599 7.85728H5.71456M7.85742 10.7144H5.71456M11.4288 5.00014H5.71456M13.7503 12.143V10.893C13.7503 10.2026 13.1906 9.643 12.5003 9.643C11.8099 9.643 11.2503 10.2026 11.2503 10.893V12.143M11.1431 15.0001H13.8574C14.2575 15.0001 14.4575 15.0001 14.6103 14.9223C14.7447 14.8538 14.8539 14.7445 14.9224 14.6101C15.0003 14.4573 15.0003 14.2573 15.0003 13.8573V13.2859C15.0003 12.8858 15.0003 12.6858 14.9224 12.533C14.8539 12.3986 14.7447 12.2893 14.6103 12.2208C14.4575 12.143 14.2575 12.143 13.8574 12.143H11.1431C10.7431 12.143 10.5431 12.143 10.3903 12.2208C10.2559 12.2893 10.1466 12.3986 10.0781 12.533C10.0003 12.6858 10.0003 12.8858 10.0003 13.2859V13.8573C10.0003 14.2573 10.0003 14.4573 10.0781 14.6101C10.1466 14.7445 10.2559 14.8538 10.3903 14.9223C10.5431 15.0001 10.7431 15.0001 11.1431 15.0001Z"
              stroke="currentColor"
              strokeWidth="1.71429"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </nav>

      <div className="sidebar-avatar">
        <button className="avatar-btn" onClick={() => setShowMenu(!showMenu)}>
          <div className="vault-avatar" />
        </button>
        {showMenu && (
          <>
            <div
              className="avatar-popover-backdrop"
              onClick={() => setShowMenu(false)}
            />
            <div className="avatar-popover">
              <button className="popover-item" onClick={handleLogout}>
                <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
                  <path
                    d="M12.333 12.333L15.666 9m0 0L12.333 5.667M15.666 9H6.333M6.333 2.333H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 00-.874.874c-.218.428-.218.988-.218 2.108v7.934c0 1.12 0 1.68.218 2.108a2 2 0 00.874.874c.428.218.988.218 2.108.218h1.133"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
