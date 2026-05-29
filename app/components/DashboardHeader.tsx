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
  const subtitle = 'See the unified view of all your investments';//formatLastUpdated(updatedAt);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        const name = profile.display_name?.trim().split(/\s+/)[0] || "";
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-['ButlerPro'] text-[32px] font-medium leading-[38.4px] tracking-[-0.04em] text-black">
          Welcome {userName ? `${userName}` : ""}
        </h1>
        {subtitle && <p className="m-0 font-['Satoshi'] text-sm font-medium leading-[21px] tracking-[-0.02em] text-black/70">{subtitle}</p>}
      </div>
      <Link
        href="/documents-vault"
        className="inline-flex cursor-pointer justify-center items-center gap-3 rounded-full 
        border-[1px] border-black/10 bg-transparent px-[24px] py-[16px] font-satoshi 
        text-base font-bold leading-6 tracking-[-0.04em] text-black transition hover:bg-black/[0.02]"
      >
        <PlusIcon />
        Add statements
      </Link>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
