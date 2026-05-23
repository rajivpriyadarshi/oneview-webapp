"use client";

import Link from "next/link";
import Image from "next/image";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" fill="white" />
            </svg>
          </div>
          <span className="text-xl font-semibold">Oneview</span>
          <span className="text-gray-400 text-sm ml-1">by</span>
          <span className="text-gray-600 text-sm font-medium ml-1">ZINC</span>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-700 hover:text-black transition-colors">
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            Try Oneview
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 12h14m-7-7l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center px-8 lg:px-16">
        <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8">
            <div className="inline-block bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium">
              Title
            </div>

            <h1 className="space-y-2">
              <div className="text-5xl lg:text-6xl font-serif leading-tight">
                Get a single view
              </div>
              <div className="text-5xl lg:text-6xl font-serif leading-tight">
                of your holdings in
              </div>
              <div className="text-5xl lg:text-6xl font-serif leading-tight text-amber-700">
                US and India
              </div>
            </h1>

            <p className="text-gray-600 text-lg max-w-lg">
              Oneview lets you create a single view of all your investments across
              different regions
            </p>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-medium hover:bg-gray-800 transition-colors text-lg"
            >
              See your Oneview
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12h14m-7-7l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <p className="text-gray-500 text-sm">
              Your data stays encrypted • 100% Safe and Secure
            </p>
          </div>

          {/* Right Column - App Preview */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-[40px] p-8 shadow-2xl">
              {/* Floating Brand Icons */}
              <div className="absolute -left-4 top-20 w-16 h-16 bg-red-500 rounded-2xl shadow-lg transform -rotate-12 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
              </div>

              <div className="absolute -left-8 top-[45%] w-20 h-20 bg-red-600 rounded-2xl shadow-lg transform rotate-6 flex items-center justify-center text-white font-bold text-2xl">
                K
              </div>

              <div className="absolute left-4 bottom-12 w-16 h-16 bg-green-600 rounded-full shadow-lg flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>

              <div className="absolute -right-4 top-16 w-16 h-16 bg-purple-600 rounded-2xl shadow-lg transform rotate-12 flex items-center justify-center text-white font-bold">
                up
              </div>

              <div className="absolute -right-8 top-[40%] w-20 h-20 bg-blue-400 rounded-2xl shadow-lg transform -rotate-6 flex items-center justify-center text-white font-bold text-lg">
                charles
                <br />
                SCHWAB
              </div>

              <div className="absolute right-4 bottom-20 w-16 h-16 bg-blue-500 rounded-full shadow-lg flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7v10l10 5 10-5V7l-10-5z" />
                </svg>
              </div>

              <div className="absolute -right-4 bottom-32 w-16 h-16 bg-indigo-900 rounded-2xl shadow-lg transform rotate-6 flex items-center justify-center text-white font-bold text-xl">
                V
              </div>

              {/* Phone Mockup */}
              <div className="relative mx-auto w-[280px] bg-black rounded-[40px] p-3 shadow-2xl">
                <div className="bg-white rounded-[32px] overflow-hidden">
                  {/* Phone Header */}
                  <div className="bg-white px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2" />
                          <circle cx="12" cy="12" r="3" fill="white" />
                        </svg>
                      </div>
                      <div className="flex gap-2">
                        <button className="text-gray-400 text-sm">↻</button>
                        <button className="text-gray-400 text-sm">⋮</button>
                        <button className="text-gray-400 text-sm">👤</button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-semibold">Your investments</h2>
                      <button className="text-sm flex items-center gap-1">
                        + Add more
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Last updated May 18, 2026 at 4:05 PM</p>
                  </div>

                  {/* Card Content */}
                  <div className="px-4 pb-4">
                    <div className="bg-gray-900 rounded-2xl p-4 text-white">
                      <div className="text-xs text-gray-400 mb-1">Total portfolio value</div>
                      <div className="text-3xl font-bold mb-2">₹49.2L</div>
                      <div className="text-sm text-green-400 mb-4">+₹131,692(+1%)</div>

                      {/* Chart placeholder */}
                      <div className="h-24 bg-gradient-to-t from-amber-900/30 to-transparent rounded-lg mb-4"></div>

                      <div className="text-xs text-gray-400 mb-3">Prices as of May 18, 2026</div>

                      <div className="flex gap-2 text-xs">
                        <button className="bg-gray-800 text-white px-3 py-1 rounded-full">
                          All accounts ˅
                        </button>
                        <button className="bg-gray-800 text-white px-3 py-1 rounded-full">
                          INR ˅
                        </button>
                      </div>
                    </div>

                    <button className="mt-3 w-full text-sm text-gray-600 flex items-center justify-center gap-1 py-2">
                      📊 Portfolio Exposure
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
