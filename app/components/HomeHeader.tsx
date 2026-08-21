"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGetProfileQuery } from "../store/api";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatLastUpdated(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `Last updated: ${month} ${day}, ${year} at ${time}`;
}

export default function HomeHeader() {
  const { data: profile } = useGetProfileQuery();
  const [greeting, setGreeting] = useState("Welcome");

  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || "";
  const lastUpdated = "";

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <header className="home-header">
      <div className="home-header-left">
        <h1 className="home-title">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h1>
        {lastUpdated && <p className="home-subtitle">{lastUpdated}</p>}
      </div>
      <Link href="/documents-vault" className="upload-btn">
        <UploadIcon />
        Upload statements
      </Link>
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
