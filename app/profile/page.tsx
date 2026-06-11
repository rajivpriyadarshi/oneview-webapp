"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken } from "../lib/session";
import { getUserProfile, updateUserProfile, type UserProfile } from "../lib/profileApi";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import EditProfileModal from "../components/EditProfileModal";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";
import "./profile.css";

const CHART_COLORS = [
  "#FE5D26", "#388DE8", "#CE8016", "#6438E8", "#59886B",
  "#444444", "#FFC75F", "#9EDE73", "#184D47", "#D2DB20",
  "#939191", "#76FDB0", "#2F2B2C", "#FFB2FC", "#B0EDFF",
  "#A3A1FB", "#7A2783", "#F46396"
];

export default function ProfilePage() {
  const router = useRouter();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"email" | "currency" | null>(null);

  useEffect(() => {
    getUserProfile()
      .then((data) => {
        setProfile(data);
        // Cache the profile in localStorage
        localStorage.setItem('userProfile', JSON.stringify(data));
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch profile:", error);
        clearAuthToken();
        router.push("/");
      });
  }, [router]);

  // Track page load
  useEffect(() => {
    if (profile) {
      trackPage({
        pageName: trackingEventsMap.profilePage.PAGE,
        params: {
          page_url: window.location.href,
          page_title: document.title,
        },
      });
    }
  }, [profile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-dropdown')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!profile) return;

    trackClick({
      buttonName: trackingEventsMap.profilePage.CLICK_CURRENCY_CHANGE,
      pageName: trackingEventsMap.profilePage.PAGE,
      params: {
        old_currency: profile.base_currency,
        new_currency: newCurrency,
      },
    });

    try {
      setOpenDropdown(null);
      const updated = await updateUserProfile({ base_currency: newCurrency });
      setProfile(updated);
      // Cache the updated profile
      localStorage.setItem('userProfile', JSON.stringify(updated));

      trackAPI({
        pageName: trackingEventsMap.profilePage.PAGE,
        params: {
          event_name: trackingEventsMap.profilePage.API_UPDATE_CURRENCY_SUCCESS,
          new_currency: newCurrency,
        },
      });
    } catch (error) {
      console.error("Failed to update currency:", error);

      trackAPI({
        pageName: trackingEventsMap.profilePage.PAGE,
        params: {
          event_name: trackingEventsMap.profilePage.API_UPDATE_CURRENCY_FAILURE,
          error: error instanceof Error ? error.message : "Update failed",
        },
      });
    }
  };

  const handleEmailPreferenceChange = async (frequency: "DAILY" | "WEEKLY" | "MONTHLY") => {
    if (!profile) return;

    trackClick({
      buttonName: trackingEventsMap.profilePage.CLICK_EMAIL_PREFERENCE_CHANGE,
      pageName: trackingEventsMap.profilePage.PAGE,
      params: {
        old_frequency: profile.mailer_frequency,
        new_frequency: frequency,
      },
    });

    try {
      setOpenDropdown(null);
      const updated = await updateUserProfile({ mailer_frequency: frequency });
      setProfile(updated);
      // Cache the updated profile
      localStorage.setItem('userProfile', JSON.stringify(updated));

      trackAPI({
        pageName: trackingEventsMap.profilePage.PAGE,
        params: {
          event_name: trackingEventsMap.profilePage.API_UPDATE_EMAIL_PREF_SUCCESS,
          new_frequency: frequency,
        },
      });
    } catch (error) {
      console.error("Failed to update email preference:", error);

      trackAPI({
        pageName: trackingEventsMap.profilePage.PAGE,
        params: {
          event_name: trackingEventsMap.profilePage.API_UPDATE_EMAIL_PREF_FAILURE,
          error: error instanceof Error ? error.message : "Update failed",
        },
      });
    }
  };

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

  const handleSignOut = () => {
    trackClick({
      buttonName: trackingEventsMap.profilePage.CLICK_SIGN_OUT,
      pageName: trackingEventsMap.profilePage.PAGE,
    });

    // Clear cached profile data
    localStorage.removeItem('userProfile');
    clearAuthToken();
    router.push("/");
  };

  if (!profile) {
    return (
      <ProtectedRoute>
        <div className="dashboard-layout">
          <Sidebar />
          <main className="dashboard-main">
            <div className="profile-page">
              <div className="profile-loading">Loading...</div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const initials = getInitials(profile.display_name);
  const avatarColor = getColorFromName(profile.display_name);

  // Map mailer_frequency to dropdown values
  const emailFrequencyMap: Record<string, "DAILY" | "WEEKLY" | "MONTHLY"> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
  };

  const reverseEmailFrequencyMap: Record<string, string> = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
  };

  const emailFrequencyLabels: Record<"daily" | "weekly" | "monthly", string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  const selectedEmailFrequency =
    (reverseEmailFrequencyMap[profile.mailer_frequency] as "daily" | "weekly" | "monthly") ||
    "weekly";

  const currencyOptions = ["USD", "INR"];

  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="profile-page">
            <div className="profile-container">
              <div className="profile-header">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="60" fill={avatarColor} />
                  <text
                    x="60"
                    y="60"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fill: "#FFF",
                      fontFamily: "Satoshi",
                      fontSize: "42px",
                      fontWeight: 400,
                      letterSpacing: "-1.84px",
                    }}
                  >
                    {initials}
                  </text>
                </svg>

                <h1 className="profile-name">{profile.display_name}</h1>
                <p className="profile-email">
                  {profile.email}
                  <button
                    type="button"
                    className="profile-email-edit"
                    onClick={() => {
                      trackClick({
                        buttonName: trackingEventsMap.profilePage.CLICK_EDIT_PROFILE,
                        pageName: trackingEventsMap.profilePage.PAGE,
                      });
                      setShowEditModal(true);
                    }}
                    aria-label="Edit profile"
                  >
                    <EditIcon />
                  </button>
                </p>
              </div>


              <div className="profile-section">
                <div className="profile-menu-item">
                  <div className="profile-menu-item-left">
                    <EmailIcon />
                    <span>Email preferences</span>
                  </div>
                  <div className="profile-dropdown">
                    <button
                      type="button"
                      className="profile-select"
                      onClick={() => {
                        if (openDropdown !== "email") {
                          trackClick({
                            buttonName: trackingEventsMap.profilePage.CLICK_EMAIL_PREFERENCE_DROPDOWN,
                            pageName: trackingEventsMap.profilePage.PAGE,
                          });
                        }
                        setOpenDropdown(openDropdown === "email" ? null : "email");
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={openDropdown === "email"}
                    >
                      {emailFrequencyLabels[selectedEmailFrequency]}
                      <ChevronDown />
                    </button>
                    {openDropdown === "email" && (
                      <div className="profile-select-menu" role="listbox">
                        {(["daily", "weekly", "monthly"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`profile-select-option${selectedEmailFrequency === value ? " is-selected" : ""
                              }`}
                            onClick={() => handleEmailPreferenceChange(emailFrequencyMap[value])}
                            role="option"
                            aria-selected={selectedEmailFrequency === value}
                          >
                            <span>{selectedEmailFrequency === value && <CheckIcon />}</span>
                            {emailFrequencyLabels[value]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>


              <div className="profile-section">
                <div className="profile-menu-item">
                  <div className="profile-menu-item-left">
                    <CurrencyIcon />
                    <span>Default currency</span>
                  </div>
                  <div className="profile-dropdown">
                    <button
                      type="button"
                      className="profile-select"
                      onClick={() => {
                        if (openDropdown !== "currency") {
                          trackClick({
                            buttonName: trackingEventsMap.profilePage.CLICK_CURRENCY_DROPDOWN,
                            pageName: trackingEventsMap.profilePage.PAGE,
                          });
                        }
                        setOpenDropdown(openDropdown === "currency" ? null : "currency");
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={openDropdown === "currency"}
                    >
                      {profile.base_currency}
                      <ChevronDown />
                    </button>
                    {openDropdown === "currency" && (
                      <div className="profile-select-menu profile-select-menu-compact" role="listbox">
                        {currencyOptions.map((currency) => (
                          <button
                            key={currency}
                            type="button"
                            className={`profile-select-option${profile.base_currency === currency ? " is-selected" : ""
                              }`}
                            onClick={() => handleCurrencyChange(currency)}
                            role="option"
                            aria-selected={profile.base_currency === currency}
                          >
                            <span>{profile.base_currency === currency && <CheckIcon />}</span>
                            {currency}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <button
                  className="profile-menu-item profile-menu-btn"
                  onClick={() => {
                    trackClick({
                      buttonName: trackingEventsMap.profilePage.CLICK_PRIVACY_POLICY,
                      pageName: trackingEventsMap.profilePage.PAGE,
                    });
                    window.open("/privacy", "_blank", "noopener,noreferrer");
                  }}
                >
                  <div className="profile-menu-item-left">
                    <ShieldIcon />
                    <span>Privacy policy</span>
                  </div>
                  <ChevronRight />
                </button>
              </div>

              <div className="profile-section">
                <button
                  className="profile-menu-item profile-menu-btn"
                  onClick={() => {
                    trackClick({
                      buttonName: trackingEventsMap.profilePage.CLICK_TERMS_CONDITIONS,
                      pageName: trackingEventsMap.profilePage.PAGE,
                    });
                    window.open("/terms", "_blank", "noopener,noreferrer");
                  }}
                >
                  <div className="profile-menu-item-left">
                    <DocumentIcon />
                    <span>Terms & Conditions</span>
                  </div>
                  <ChevronRight />
                </button>
              </div>

              <div className="profile-section">
                <button
                  className="profile-menu-item profile-menu-btn profile-signout"
                  onClick={handleSignOut}
                >
                  <div className="profile-menu-item-left">
                    <SignOutIcon />
                    <span>Sign out</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSave={(updated) => {
            setProfile(updated);
            // Cache the updated profile
            localStorage.setItem('userProfile', JSON.stringify(updated));
            // Trigger profile refresh event for sidebar
            window.dispatchEvent(new CustomEvent('profileUpdated'));
          }}
        />
      )}
    </ProtectedRoute>
  );
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M11.1699 3.97656H4.16992C3.63949 3.97656 3.13078 4.18728 2.75571 4.56235C2.38064 4.93742 2.16992 5.44613 2.16992 5.97656V19.9766C2.16992 20.507 2.38064 21.0157 2.75571 21.3908C3.13078 21.7658 3.63949 21.9766 4.16992 21.9766H18.1699C18.7004 21.9766 19.2091 21.7658 19.5841 21.3908C19.9592 21.0157 20.1699 20.507 20.1699 19.9766V12.9766" stroke="#7F4E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.6699 2.47679C19.0677 2.07896 19.6073 1.85547 20.1699 1.85547C20.7325 1.85547 21.2721 2.07896 21.6699 2.47679C22.0677 2.87461 22.2912 3.41418 22.2912 3.97679C22.2912 4.5394 22.0677 5.07896 21.6699 5.47679L12.1699 14.9768L8.16992 15.9768L9.16992 11.9768L18.6699 2.47679Z" stroke="#7F4E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10" fill="none">
      <path d="M1.5 1.5L8 8L14.5 1.5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PasswordIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 6L12 13L2 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="22" viewBox="0 0 14 22" fill="none">
      <path d="M1 15C1 17.2091 2.79086 19 5 19H9C11.2091 19 13 17.2091 13 15C13 12.7909 11.2091 11 9 11H5C2.79086 11 1 9.20914 1 7C1 4.79086 2.79086 3 5 3H9C11.2091 3 13 4.79086 13 7M7 1V21" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2.50036V21.5004M20 12.0004C20 16.9088 14.646 20.4788 12.698 21.6152C12.4766 21.7444 12.3659 21.809 12.2097 21.8425C12.0884 21.8685 11.9116 21.8685 11.7903 21.8425C11.6341 21.809 11.5234 21.7444 11.302 21.6152C9.35396 20.4788 4 16.9088 4 12.0004V7.21796C4 6.41845 4 6.01869 4.13076 5.67506C4.24627 5.3715 4.43398 5.10064 4.67766 4.88589C4.9535 4.6428 5.3278 4.50243 6.0764 4.22171L11.4382 2.21103C11.6461 2.13307 11.75 2.09409 11.857 2.07864C11.9518 2.06493 12.0482 2.06493 12.143 2.07864C12.25 2.09409 12.3539 2.13307 12.5618 2.21103L17.9236 4.22171C18.6722 4.50243 19.0465 4.6428 19.3223 4.88589C19.566 5.10064 19.7537 5.3715 19.8692 5.67506C20 6.01869 20 6.41845 20 7.21796V12.0004Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18.3591 6.64062C19.6175 7.89941 20.4744 9.50307 20.8214 11.2488C21.1685 12.9946 20.9901 14.804 20.3088 16.4484C19.6275 18.0927 18.474 19.4982 16.994 20.487C15.514 21.4758 13.7741 22.0035 11.9941 22.0035C10.2142 22.0035 8.4743 21.4758 6.99432 20.487C5.51434 19.4982 4.36079 18.0927 3.67951 16.4484C2.99823 14.804 2.81983 12.9946 3.16686 11.2488C3.51389 9.50307 4.37077 7.89941 5.62914 6.64062" stroke="#B2411F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2V12" stroke="#B2411F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.66602 0.666016H12.666L12.666 4.66602M12.666 0.666016L7.33268 5.99935M5.33268 1.99935H3.86602C2.74591 1.99935 2.18586 1.99935 1.75803 2.21734C1.38171 2.40908 1.07575 2.71504 0.884003 3.09137C0.666016 3.51919 0.666016 4.07924 0.666016 5.19935V9.46602C0.666016 10.5861 0.666016 11.1462 0.884003 11.574C1.07575 11.9503 1.38171 12.2563 1.75803 12.448C2.18586 12.666 2.74591 12.666 3.86602 12.666H8.13268C9.25279 12.666 9.81284 12.666 10.2407 12.448C10.617 12.2563 10.9229 11.9503 11.1147 11.574C11.3327 11.1462 11.3327 10.5861 11.3327 9.46602V7.99935" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
