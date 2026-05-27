"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getStoredAuthToken } from "../lib/session";

export function LandingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      router.replace("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  if (isChecking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/Hero_bg.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Header */}
      <header className="flex justify-between items-center px-8 lg:px-16 py-6 relative z-10">
        <div className="flex items-center gap-3">
          <img src="/Logo.png" alt="Meridian" className="h-10 w-auto block" />
          <span className="text-[#9CA3AF] text-[20px] font-medium leading-none">by</span>
          <svg
            width="59"
            height="19"
            viewBox="0 0 59 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-auto block"
          >
            <g clipPath="url(#clip0_8069_13857)">
              <path d="M16.5085 9.54132L12.8887 11.6385V7.62891L16.5085 9.54132Z" fill="#9CA3AF"/>
              <path d="M3.60189 7.41608L3.60822 11.5995L0.0244141 9.65039L3.60189 7.41608Z" fill="#9CA3AF"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M8.55032 18.766L16.5276 14.1603V10.1682L12.3607 12.5776L12.3242 2.1825L8.54399 0L8.55032 18.766ZM7.95174 0.0397955L0 4.63069L0 8.97128L4.1378 6.41183L4.1378 16.5856L4.16533 16.6014L4.1378 16.6172V16.6315L6.76883 18.1045L7.95807 18.791L7.95174 0.0397955Z" fill="#9CA3AF"/>
              <path d="M45.7258 14.8392H43.747L37.7933 5.83314V14.8392H35.8145V2.76172H37.7933L43.747 11.7504V2.76172H45.7258V14.8392Z" fill="#9CA3AF"/>
              <path d="M33.7143 2.76172V14.8392H31.7451V2.76172H33.7143Z" fill="#9CA3AF"/>
              <path d="M24.0442 13.1188H29.6454V14.8392H21.7031V13.2926L27.287 4.4821H21.7031V2.76172H29.6454V4.30833L24.0442 13.1188Z" fill="#9CA3AF"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M58.5203 12.3475C57.4272 13.8979 55.6225 14.9106 53.5813 14.9106C50.2459 14.9106 47.542 12.2067 47.542 8.87129C47.542 5.5359 50.2459 2.83203 53.5813 2.83203C55.4436 2.83203 57.1091 3.67502 58.2169 5.00024L56.8656 6.12874C56.0967 5.11683 54.9114 4.4683 53.5818 4.4683C51.264 4.4683 49.385 6.43892 49.385 8.8698C49.385 11.3007 51.264 13.2713 53.5818 13.2713C55.0331 13.2713 56.3124 12.4986 57.066 11.3241L58.5203 12.3475Z" fill="#9CA3AF"/>
            </g>
            <defs>
              <clipPath id="clip0_8069_13857">
                <rect width="58.5207" height="18.791" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/auth" className="text-gray-700 hover:text-black transition-colors font-medium">
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            Try Meridian
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M12 19L19 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start pt-12 px-8 lg:px-16 relative z-10">
        <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          {/* Left Column - Text Content */}
          <div className="pt-8">
            <h1 className="font-[family-name:var(--font-butler)] font-medium mb-8" style={{ fontSize: '72px', lineHeight: '86.40px' }}>
              <div className="text-black">
                Get a single view
              </div>
              <div className="text-black">
                of your holdings in
              </div>
              <div className="text-[#7F4E0B]">
                US and India
              </div>
            </h1>

            <p className="max-w-md font-[family-name:var(--font-geist)] mb-8" style={{ color: 'rgba(0, 0, 0, 0.70)', fontSize: '18px', fontWeight: 400, lineHeight: '27px' }}>
              Meridian lets you create a single view of all your investments across
              different regions
            </p>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-black rounded-full hover:bg-gray-800 transition-colors font-[family-name:var(--font-inter)] mb-8"
              style={{ color: 'white', fontSize: '16px', fontWeight: 600, lineHeight: '24px', paddingLeft: '24px', paddingRight: '24px', paddingTop: '16px', paddingBottom: '16px' }}
            >
              See your Oneview
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M12 19L19 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <p className="font-[family-name:var(--font-geist)]" style={{ color: 'rgba(0, 0, 0, 0.70)', fontSize: '14px', fontWeight: 400, lineHeight: '21px' }}>
              Your data stays encrypted • 100% Safe and Secure
            </p>
          </div>

          {/* Right Column - Video */}
          <div className="relative lg:pl-8">
            <div className="relative rounded-[40px] shadow-2xl bg-gradient-to-b from-white/5 via-[#FFFCF5] to-white/5 p-4" style={{ backgroundBlendMode: 'overlay' }}>
              <div className="rounded-[36px] overflow-hidden bg-[#FFFCF5]">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto block rounded-[36px]"
                  style={{ clipPath: 'inset(2px 2px round 36px)' }}
                >
                  <source src="/Hero-Explainer.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
