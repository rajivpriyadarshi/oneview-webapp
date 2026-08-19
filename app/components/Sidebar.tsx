"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredAdvisorProfile, clearAuthToken } from "../lib/session";
import { useCrmLogoutMutation } from "../store/api";

const ACTIVE_COLOR = "#804D13";
const INACTIVE_COLOR = "rgba(0,0,0,0.70)";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [initial, setInitial] = useState("N");
  const [showLogout, setShowLogout] = useState(false);
  const [crmLogout, { isLoading: isLoggingOut }] = useCrmLogoutMutation();

  useEffect(() => {
    const advisor = getStoredAdvisorProfile();
    if (advisor?.name) setInitial(advisor.name.trim()[0].toUpperCase());
  }, []);

  async function handleLogout() {
    try {
      await crmLogout().unwrap();
    } catch {
      // proceed even if API fails
    } finally {
      clearAuthToken();
      router.replace("/auth");
    }
  }

  const nav = [
    { href: "/clients", label: "Home", icon: <HomeIcon /> },
    { href: "/clients/list", label: "Clients", icon: <UserIcon /> },
  ];

  return (
    <aside style={{
      width: 80, height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 210,
      background: "#F8F8F8", borderRight: "1px solid rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", alignItems: "flex-start", paddingBottom: 20,
    }}>
      {/* Logo */}
      <div style={{ alignSelf: "stretch", height: 97, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <ZincLogo />
      </div>

      {/* Nav + avatar */}
      <div style={{ flex: 1, alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 7px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link key={label} href={href} aria-label={label} style={{ textDecoration: "none" }}>
                <div style={{ padding: 8 }}>
                  <div style={{
                    padding: 8, borderRadius: 11,
                    background: active ? "#F1ECE1" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IconWrapper active={active}>{icon}</IconWrapper>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Avatar */}
        <button
          onClick={() => setShowLogout(true)}
          style={{
            width: 40, height: 40, borderRadius: "50%", background: ACTIVE_COLOR,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            border: "none", cursor: "pointer",
          }}
        >
          <span style={{ color: "white", fontSize: 15, fontFamily: "Inter", fontWeight: 600, lineHeight: 1 }}>
            {initial}
          </span>
        </button>
      </div>

      {/* Logout confirmation dialog */}
      {showLogout && (
        <div
          onClick={() => setShowLogout(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 20, padding: "32px 28px",
              width: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              display: "flex", flexDirection: "column", gap: 8,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Log out?</div>
            <div style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
              You'll need to sign in again to access your clients.
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{
                padding: "12px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: ACTIVE_COLOR, color: "white",
                fontSize: 15, fontWeight: 600,
                opacity: isLoggingOut ? 0.7 : 1,
              }}
            >
              {isLoggingOut ? "Logging out…" : "Yes, log out"}
            </button>
            <button
              onClick={() => setShowLogout(false)}
              style={{
                padding: "12px 0", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)",
                cursor: "pointer", background: "white", color: "#374151",
                fontSize: 15, fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function IconWrapper({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", color: active ? ACTIVE_COLOR : INACTIVE_COLOR }}>
      {children}
    </span>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 7.04386C2 6.66095 2 6.4695 2.04935 6.29319C2.09307 6.13701 2.16491 5.99012 2.26135 5.85973C2.37022 5.71252 2.52135 5.59498 2.82359 5.3599L7.34513 1.84315C7.57935 1.66099 7.69646 1.5699 7.82577 1.53489C7.93987 1.504 8.06013 1.504 8.17423 1.53489C8.30354 1.5699 8.42065 1.66099 8.65487 1.84315L13.1764 5.35991C13.4787 5.59499 13.6298 5.71252 13.7386 5.85973C13.8351 5.99012 13.9069 6.13701 13.9506 6.29319C14 6.4695 14 6.66095 14 7.04386V11.8671C14 12.6139 14 12.9872 13.8547 13.2725C13.7268 13.5233 13.5229 13.7273 13.272 13.8552C12.9868 14.0005 12.6134 14.0005 11.8667 14.0005H4.13333C3.3866 14.0005 3.01323 14.0005 2.72801 13.8552C2.47713 13.7273 2.27316 13.5233 2.14532 13.2725C2 12.9872 2 12.6139 2 11.8671V7.04386Z"
        stroke="currentColor" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.3307 14C13.3307 13.0696 13.3307 12.6044 13.2159 12.2259C12.9574 11.3736 12.2904 10.7067 11.4382 10.4482C11.0596 10.3333 10.5944 10.3333 9.66406 10.3333H6.33073C5.40035 10.3333 4.93517 10.3333 4.55663 10.4482C3.70437 10.7067 3.03742 11.3736 2.77889 12.2259C2.66406 12.6044 2.66406 13.0696 2.66406 14M10.9974 5C10.9974 6.65685 9.65425 8 7.9974 8C6.34054 8 4.9974 6.65685 4.9974 5C4.9974 3.34315 6.34054 2 7.9974 2C9.65425 2 10.9974 3.34315 10.9974 5Z"
        stroke="currentColor" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4.66667 10L6.66667 8L4.66667 6M8.66667 10H11.3333M5.2 14H10.8C11.9201 14 12.4802 14 12.908 13.782C13.2843 13.5903 13.5903 13.2843 13.782 12.908C14 12.4802 14 11.9201 14 10.8V5.2C14 4.0799 14 3.51984 13.782 3.09202C13.5903 2.71569 13.2843 2.40973 12.908 2.21799C12.4802 2 11.9201 2 10.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V10.8C2 11.9201 2 12.4802 2.21799 12.908C2.40973 13.2843 2.71569 13.5903 3.09202 13.782C3.51984 14 4.0799 14 5.2 14Z"
        stroke="currentColor" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4.06551 7.48554C4.02408 7.21849 4.00258 6.94491 4.00258 6.66634C4.00258 3.72082 6.4061 1.33301 9.371 1.33301C12.3359 1.33301 14.7394 3.72082 14.7394 6.66634C14.7394 7.33172 14.6168 7.96864 14.3927 8.55601C14.3462 8.678 14.3229 8.73899 14.3123 8.78661C14.3019 8.8338 14.2978 8.86699 14.2967 8.91531C14.2955 8.96407 14.3022 9.01779 14.3154 9.12522L14.5838 11.3054C14.6128 11.5414 14.6274 11.6594 14.5881 11.7452C14.5537 11.8203 14.4926 11.88 14.4167 11.9127C14.33 11.9499 14.2124 11.9327 13.9771 11.8982L11.8536 11.5869C11.7427 11.5707 11.6873 11.5626 11.6368 11.5629C11.5868 11.5631 11.5523 11.5668 11.5034 11.5771C11.454 11.5875 11.3908 11.6111 11.2646 11.6584C10.6757 11.879 10.0375 11.9997 9.371 11.9997C9.09221 11.9997 8.81838 11.9786 8.55104 11.9379M5.09032 14.6663C7.06692 14.6663 8.66927 13.0247 8.66927 10.9997C8.66927 8.97463 7.06692 7.33301 5.09032 7.33301C3.11373 7.33301 1.51138 8.97463 1.51138 10.9997C1.51138 11.4067 1.57612 11.7983 1.69564 12.1642C1.74616 12.3188 1.77142 12.3961 1.77971 12.449C1.78836 12.5041 1.78988 12.5351 1.78666 12.5908C1.78357 12.6442 1.77021 12.7045 1.7435 12.8252L1.33594 14.6663L3.33247 14.3937C3.44145 14.3788 3.49594 14.3713 3.54352 14.3717C3.59362 14.372 3.62021 14.3747 3.66934 14.3845C3.71601 14.3938 3.78538 14.4183 3.92412 14.4673C4.28967 14.5963 4.68201 14.6663 5.09032 14.6663Z"
        stroke="currentColor" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ZincLogo() {
  return (
    <svg width="38" height="43" viewBox="0 0 38 43" fill="none">
      <path d="M37.7754 21.8323L29.4922 26.6314V17.4561L37.7754 21.8323Z" fill="#050505"/>
      <path d="M8.24112 16.9682L8.2556 26.5413L0.0546875 22.0811L8.24112 16.9682Z" fill="#050505"/>
      <path d="M18.21 42.999L15.5098 41.4404L9.46875 38.0576V38.0244L9.53125 37.9883L9.46875 37.9521L9.46875 14.6719L0 20.5283L0 10.5967L18.1963 0.0898437L18.21 42.999ZM28.2012 4.99414L28.2852 28.7812L37.8203 23.2676V32.4033L19.5654 42.9424L19.5508 0L28.2012 4.99414Z" fill="#050505"/>
    </svg>
  );
}
