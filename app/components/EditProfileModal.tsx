"use client";

import { useState } from "react";
import { updateUserProfile, type UserProfile } from "../lib/profileApi";
import "./EditProfileModal.css";

type Props = {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedProfile: UserProfile) => void;
};

export default function EditProfileModal({ profile, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  // const [mobileNumber, setMobileNumber] = useState("");

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserProfile({ display_name: displayName });
      onSave(updated);
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="edit-profile-overlay" onClick={onClose} />
      <div className="edit-profile-modal">
        <div className="edit-profile-header">
          <div>
            <h2 className="edit-profile-title">Edit profile</h2>
            <p className="edit-profile-subtitle">Add or change information about yourself</p>
          </div>
          <button className="edit-profile-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="edit-profile-form">
          <div className="edit-profile-field">
            <label className="edit-profile-label">Full name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="edit-profile-input"
              placeholder="Enter your full name"
            />
          </div>

          <div className="edit-profile-field">
            <label className="edit-profile-label">Registered email address</label>
            <div className="edit-profile-email-wrapper">
              <input
                type="email"
                value={profile.email}
                disabled
                className="edit-profile-input edit-profile-input-disabled"
              />
              <VerifiedIcon />
            </div>
          </div>

          {/* Mobile number field - commented out for now */}
          {/* <div className="edit-profile-field">
            <label className="edit-profile-label">Mobile number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="edit-profile-input"
              placeholder="Enter your mobile number"
            />
            <p className="edit-profile-hint">An OTP will be sent to this mobile number</p>
          </div> */}
        </div>

        <button
          className="edit-profile-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#10B981" />
      <path
        d="M6 10L8.5 12.5L14 7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
