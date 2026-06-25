"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MeridianLogo } from "./MeridianLogo";
import { getUserProfile, type UserProfile } from "../lib/profileApi";

const CHART_COLORS = [
  "#FE5D26", "#388DE8", "#CE8016", "#6438E8", "#59886B",
  "#444444", "#FFC75F", "#9EDE73", "#184D47", "#D2DB20",
  "#939191", "#76FDB0", "#2F2B2C", "#FFB2FC", "#B0EDFF",
  "#A3A1FB", "#7A2783", "#F46396"
];

type SidebarProps = { open?: boolean; onOpenChange?: (open: boolean) => void };

export default function Sidebar({ open, onOpenChange }: SidebarProps = {}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (typeof open === "boolean") setIsOpen(open);
  }, [open]);

  const closeSidebar = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  useEffect(() => {
    // Load cached profile from localStorage
    const cachedProfile = localStorage.getItem('userProfile');
    if (cachedProfile) {
      try {
        setProfile(JSON.parse(cachedProfile));
      } catch (error) {
        console.error("Failed to parse cached profile:", error);
      }
    }

    const fetchProfile = () => {
      getUserProfile()
        .then((data) => {
          setProfile(data);
          // Cache the profile in localStorage
          localStorage.setItem('userProfile', JSON.stringify(data));
        })
        .catch((error) => console.error("Failed to fetch profile:", error));
    };

    // Initial fetch
    fetchProfile();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchProfile();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || "U";
  };

  const getColorFromName = (name: string) => {
    const asciiSum = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return CHART_COLORS[asciiSum % CHART_COLORS.length];
  };

  const initials = profile ? getInitials(profile.display_name) : "U";
  const avatarColor = profile ? getColorFromName(profile.display_name) : CHART_COLORS[0];

  return (
    <>
      {isOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      ) : null}

      <aside className={`sidebar${isOpen ? " is-open" : ""}`}>
        <Link href="/dashboard" className="sidebar-logo" onClick={closeSidebar} aria-label="Go to Dashboard">
          <MeridianLogo width={36} height={36} />
        </Link>

        <nav className="sidebar-nav">
          <Link href="/dashboard" className={`sidebar-btn ${pathname === "/dashboard" ? "active" : ""}`} aria-label="Home" onClick={closeSidebar}>
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
          <Link href="/documents-vault" className={`sidebar-btn ${pathname === "/documents-vault" ? "active" : ""}`} aria-label="Document Vault" onClick={closeSidebar}>
            <svg viewBox="0 0 18 18" fill="none" width="20" height="20">
              <path
                d="M14.286 7.143V4.85728C14.286 3.65717 14.286 3.05711 14.0524 2.59873C13.847 2.19553 13.5192 1.86771 13.116 1.66227C12.6576 1.42871 12.0575 1.42871 10.8574 1.42871H6.28599C5.08588 1.42871 4.48582 1.42871 4.02744 1.66227C3.62424 1.86771 3.29642 2.19553 3.09098 2.59873C2.85742 3.05711 2.85742 3.65717 2.85742 4.85728V12.2859C2.85742 13.486 2.85742 14.086 3.09098 14.5444C3.29642 14.9476 3.62424 15.2754 4.02744 15.4809C4.48582 15.7144 5.08588 15.7144 6.28599 15.7144H7.50028M9.28599 7.85728H5.71456M7.85742 10.7144H5.71456M11.4288 5.00014H5.71456M13.7503 12.143V10.893C13.7503 10.2026 13.1906 9.643 12.5003 9.643C11.8099 9.643 11.2503 10.2026 11.2503 10.893V12.143M11.1431 15.0001H13.8574C14.2575 15.0001 14.4575 15.0001 14.6103 14.9223C14.7447 14.8538 14.8539 14.7445 14.9224 14.6101C15.0003 14.4573 15.0003 14.2573 15.0003 13.8573V13.2859C15.0003 12.8858 15.0003 12.6858 14.9224 12.533C14.8539 12.3986 14.7447 12.2893 14.6103 12.2208C14.4575 12.143 14.2575 12.143 13.8574 12.143H11.1431C10.7431 12.143 10.5431 12.143 10.3903 12.2208C10.2559 12.2893 10.1466 12.3986 10.0781 12.533C10.0003 12.6858 10.0003 12.8858 10.0003 13.2859V13.8573C10.0003 14.2573 10.0003 14.4573 10.0781 14.6101C10.1466 14.7445 10.2559 14.8538 10.3903 14.9223C10.5431 15.0001 10.7431 15.0001 11.1431 15.0001Z"
                stroke="currentColor"
                strokeWidth="1.71429"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link href="/chat" className={`sidebar-btn ${pathname === "/chat" ? "active" : ""}`} aria-label="Chat" onClick={closeSidebar}>
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path
                d="M21 11.5C21 15.6421 16.9706 19 12 19C10.8206 19 9.69413 18.8109 8.66189 18.4671L4 20L5.3382 16.4306C3.89274 15.1239 3 13.3984 3 11.5C3 7.35786 7.02944 4 12 4C16.9706 4 21 7.35786 21 11.5Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 11.5H8.51M12 11.5H12.01M15.5 11.5H15.51"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </nav>

        <div className="sidebar-avatar">
          <Link href="/profile" className="avatar-btn" onClick={closeSidebar}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill={avatarColor} />
              <text
                x="16"
                y="16"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: "#FFF",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "-0.48px",
                }}
              >
                {initials}
              </text>
            </svg>
          </Link>
        </div>
      </aside>
    </>
  );
}
