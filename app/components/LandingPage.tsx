"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getStoredAuthToken } from "../lib/session";
import { trackingEventsMap } from "../constants/trackingEventsMap";
import useAnalytics from "../hooks/useAnalytics";

export function LandingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const { trackPage, trackClick } = useAnalytics();

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      router.replace("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  useEffect(() => {
    trackPage({
      pageName: trackingEventsMap.landingPage.PAGE,
    });
  }, []);

  if (isChecking) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-white font-satoshi" style={{ fontFeatureSettings: "'ss03' on" }}>
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/Hero-bg.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Header */}
      <header className="flex justify-between items-center px-8 lg:px-16 py-6 relative z-10 animate-[fadeInDown_0.6s_ease-out_both]">
        <div className="flex items-center gap-3">
          <img src="/Logo.png" alt="Meridian" className="h-6 w-auto block" />
        </div>

        <div className="flex items-center gap-4">
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start pt-12 px-8 lg:px-16 relative z-10">
        <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
            <h1 className="mb-1 font-serif text-[42px] lg:text-[56px] font-normal leading-[120%] tracking-[-0.04em] animate-[fadeInUp_0.7s_ease-out_0.2s_both]">
              <span className="text-black">Get a unified view of your holdings in </span>
              <span className="text-[#7F4E0B]">US and India</span>
            </h1>

            <p className="mb-[24px] max-w-md text-[16px] lg:text-[18px] font-normal leading-[135%] lg:leading-[27px] text-black/70 animate-[fadeInUp_0.7s_ease-out_0.5s_both]">
              Meridian lets you create a unified view of all your investments across
              different regions
            </p>

            <Link
              href="/auth"
              className="mb-6 inline-flex items-center gap-2 rounded-full bg-black px-[32px] py-[16px] text-[16px] font-semibold leading-6 text-white transition-colors hover:bg-gray-800 animate-[fadeInUp_0.7s_ease-out_0.8s_both]"
              onClick={() =>
                trackClick({
                  buttonName: trackingEventsMap.landingPage.CLICK_SEE_ONEVIEW,
                  pageName: trackingEventsMap.landingPage.PAGE,
                })
              }
            >
              Try Meridian
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M12 19L19 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <p className="flex items-center justify-center lg:justify-start gap-1.5 text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-black/70 animate-[fadeInUp_0.7s_ease-out_1.0s_both]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z" fill="#128044"/>
                <path d="M10 15.17L7.41 12.59L6 14L10 18L18 10L16.59 8.59L10 15.17Z" fill="white"/>
              </svg>
              Your data stays encrypted • 100% Safe and Secure
            </p>
          </div>

          {/* Right Column - Video */}
          <div className="relative lg:pl-8 animate-[fadeInUp_0.8s_ease-out_0.4s_both]">
            <div className="relative rounded-[60px] bg-gradient-to-b from-white/5 via-[#FFFCF5] to-white/5 p-4 shadow-2xl bg-blend-overlay">
              <div className="rounded-[60px] p-1 overflow-hidden bg-[#FFFCF5]">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="block h-auto w-full rounded-[60px]"
                >
                  <source src="/Hero-Explainer.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mt-[120px] px-8 pb-8 lg:px-16">
        <div className="mx-auto max-w-7xl border-t border-black/10 pt-8">
          <div className="grid grid-cols-1 items-center gap-6 text-center md:grid-cols-3 md:text-left">
            <p className="text-[13.23px] leading-[19.84px] tracking-[0px] text-black/55">Copyright 2026. Meridian by Zinc</p>

            <div className="flex justify-center">
              <Image src="/zinc-full.png" alt="Zinc" width={80} height={22} className="h-5 w-auto" />
            </div>

            <div className="flex items-center justify-center gap-5 text-[13.23px] leading-[19.84px] tracking-[0px] text-black/60 md:justify-end">
              <Link href="/privacy" className="transition-colors hover:text-black">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-black">
                Terms
              </Link>
              <span className="text-black/20">|</span>
              <a
                href="https://www.linkedin.com/company/zincmoney/"
                target="_blank"
                rel="noreferrer"
                aria-label="Zinc on LinkedIn"
                className="text-black transition-opacity hover:opacity-100 opacity-100"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.67969 5.83218C4.67969 5.26248 5.15309 4.80078 5.73719 4.80078H18.0222C18.6063 4.80078 19.0797 5.26248 19.0797 5.83218V18.1694C19.0797 18.7391 18.6063 19.2008 18.0222 19.2008H5.73719C5.15309 19.2008 4.67969 18.7391 4.67969 18.1694V5.83218ZM9.12839 16.8554V10.3529H6.96749V16.8554H9.12839ZM8.04839 9.46458C8.80169 9.46458 9.27059 8.96598 9.27059 8.34138C9.25709 7.70328 8.80259 7.21818 8.06279 7.21818C7.32299 7.21818 6.83969 7.70418 6.83969 8.34138C6.83969 8.96598 7.30859 9.46458 8.03399 9.46458H8.04839ZM12.4656 16.8554V13.2239C12.4656 13.0295 12.48 12.8351 12.5376 12.6965C12.6933 12.3086 13.0488 11.9063 13.6464 11.9063C14.4285 11.9063 14.7408 12.5021 14.7408 13.3769V16.8554H16.9017V13.1258C16.9017 11.1278 15.8361 10.199 14.4141 10.199C13.2675 10.199 12.7536 10.829 12.4656 11.2727V11.2952H12.4512L12.4656 11.2727V10.3529H10.3056C10.3326 10.9631 10.3056 16.8554 10.3056 16.8554H12.4656Z" fill="#000000" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
