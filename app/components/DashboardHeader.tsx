"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile } from "../lib/realAuthApi";

type Props = {
  updatedAt?: string;
};

function formatLastUpdated(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `Last updated: ${month} ${day}, ${year} at ${time}`;
}

export default function DashboardHeader({ updatedAt }: Props) {
  const [userName, setUserName] = useState("");
  const subtitle = 'See the consolidated view of all your investments';//formatLastUpdated(updatedAt);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        const name = profile.name?.trim().split(/\s+/)[0] || "";
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <h1 className="dashboard-title">Welcome {userName ? `${userName}` : ""}</h1>
        {subtitle && <p className="dashboard-subtitle">{subtitle}</p>}
      </div>
      <Link href="/documents-vault" className="add-more-btn">
        <PlusIcon />
        Add statements
      </Link>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
