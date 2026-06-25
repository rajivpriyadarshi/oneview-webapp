"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { BrokerStatementJob } from "../lib/documentsApi";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import PortfolioSummary from "../components/PortfolioSummary";
import PortfolioExposure from "../components/PortfolioExposure";
import HoldingsTable from "../components/HoldingsTable";
import { MeridianLogo } from "../components/MeridianLogo";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";
import { getUserProfile, updateUserProfile } from "../lib/profileApi";
import {
  useListPortfoliosQuery,
  useGetAccountsByPortfolioIdQuery,
  useGetPortfolioViewQuery,
  useGetValuationsViewQuery,
  useListBrokerStatementJobsQuery,
  useListCurrenciesQuery,
} from "../store/api";
import { useAppDispatch } from "../store/hooks";
import { dismissTray } from "../store/uploadTraySlice";

export default function DashboardPage() {
  console.log("[Dashboard] Component mounting");
  const dispatch = useAppDispatch();
  const { trackPage, trackClick, trackSectionScroll } = useAnalytics();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const [currency, setCurrency] = useState("USD");
  const { data: apiCurrencies = [] } = useListCurrenciesQuery();
  const CURRENCY_SYMBOL_FALLBACKS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹" };
  const currencySymbol = useMemo(() => {
    const match = apiCurrencies.find((c) => c.currency_code === currency);
    return match?.symbol ?? CURRENCY_SYMBOL_FALLBACKS[currency] ?? currency;
  }, [apiCurrencies, currency]);
  const [isPendingDocsModalOpen, setIsPendingDocsModalOpen] = useState(false);
  const [excludedHoldings, setExcludedHoldings] = useState<import("../lib/portfolioDataApi").PortfolioViewPosition[]>([]);
  const sectionInViewRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    console.log("[Dashboard] Component mounted");
    trackPage({
      pageName: trackingEventsMap.dashboardPage.PAGE,
    });
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-analytics-section]"));
    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionName = entry.target.getAttribute("data-analytics-section");
          if (!sectionName) {
            return;
          }

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!sectionInViewRef.current[sectionName]) {
              sectionInViewRef.current[sectionName] = true;
              trackSectionScroll({
                pageName: trackingEventsMap.dashboardPage.PAGE,
                params: {
                  section_name: sectionName,
                },
              });
            }
            return;
          }

          sectionInViewRef.current[sectionName] = false;
        });
      },
      { threshold: [0.5] },
    );

    sections.forEach((section) => observer.observe(section));

    sections.forEach((section) => {
      const sectionName = section.getAttribute("data-analytics-section");
      if (!sectionName || sectionInViewRef.current[sectionName]) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, viewportHeight);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;

      if (ratio >= 0.5) {
        sectionInViewRef.current[sectionName] = true;
        trackSectionScroll({
          pageName: trackingEventsMap.dashboardPage.PAGE,
          params: {
            section_name: sectionName,
          },
        });
      }
    });

    return () => {
      sectionInViewRef.current = {};
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    getUserProfile()
      .then((profile) => {
        setCurrency(profile.base_currency);
      })
      .catch((error) => {
        console.error("Failed to fetch profile:", error);
        // Fall back to INR if profile fetch fails
        setCurrency("INR");
      });
  }, []);

  const { data: portfolios = [], isSuccess: portfoliosLoaded } = useListPortfoliosQuery();
  const { data: brokerJobs } = useListBrokerStatementJobsQuery();
  console.log("[Dashboard] Portfolios data:", portfolios);

  const router = useRouter();
  useEffect(() => {
    const hasReviewJobs = brokerJobs?.some(j => j.status === "needs_review");
    if (portfoliosLoaded && portfolios.length === 0 && !hasReviewJobs) {
      router.replace("/onboarding/documents");
    }
  }, [portfoliosLoaded, portfolios.length, brokerJobs, router]);

  const activePortfolioId = selectedPortfolioId ?? portfolios[0]?.id ?? null;
  const selectedPortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null;
  console.log("[Dashboard] Active portfolio ID:", activePortfolioId);

  const { data: accounts = [] } = useGetAccountsByPortfolioIdQuery(activePortfolioId!, {
    skip: !activePortfolioId,
  });
  console.log("[Dashboard] Accounts data:", accounts);

  const accountIds = useMemo(
    () => (selectedAccountId === "all" ? [] : [selectedAccountId]),
    [selectedAccountId],
  );


  const { data: portfolioView, isLoading: viewLoading, isFetching: viewFetching } = useGetPortfolioViewQuery(
    { accountIds, currency },
    { skip: !activePortfolioId },
  );
  console.log("[Dashboard] Portfolio view:", portfolioView, "Loading:", viewLoading);

  const { data: valuationsData, isFetching: valuationsFetching } = useGetValuationsViewQuery(
    { accountIds, currency },
    { skip: !activePortfolioId },
  );
  console.log("[Dashboard] Valuations data:", valuationsData);

  const valuationSeries = valuationsFetching ? [] : (valuationsData?.price_series ?? []);
  const loading = viewLoading || !portfolioView;
  const isPortfolioEmpty = !loading && (portfolioView?.positions?.length ?? 0) === 0;
  const allUnderReview = !!brokerJobs?.length &&
    brokerJobs.some(j => j.status === "needs_review") &&
    accounts.length === 0;
  console.log("[Dashboard] Loading:", loading, "Empty:", isPortfolioEmpty);

  useEffect(() => {
    if (allUnderReview) dispatch(dismissTray());
  }, [allUnderReview, dispatch]);

  const handleAccountChange = (accountId: number | "all") => {
    const selectedAccountName =
      accountId === "all"
        ? "All accounts"
        : (accounts.find((account) => account.id === accountId)?.name ?? String(accountId));

    trackClick({
      buttonName: trackingEventsMap.dashboardPage.CLICK_ACCOUNT_FILTER,
      pageName: trackingEventsMap.dashboardPage.PAGE,
      params: {
        account_id: accountId,
        selected_value: selectedAccountName,
      },
    });
    setSelectedAccountId(accountId);
  };

  const handleCurrencyChange = async (curr: string) => {
    if (curr === currency) {
      return;
    }

    trackClick({
      buttonName: trackingEventsMap.dashboardPage.CLICK_CURRENCY_TOGGLE,
      pageName: trackingEventsMap.dashboardPage.PAGE,
      params: {
        current_currency: currency,
        switched_to_currency: curr,
      },
    });
    setCurrency(curr);
    try {
      await updateUserProfile({ base_currency: curr });
    } catch (error) {
      console.error("Failed to update currency:", error);
    }
  };

  const handlePortfolioChange = (portfolioId: number) => {
    setSelectedPortfolioId(portfolioId);
    setSelectedAccountId("all");
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen overflow-x-hidden bg-transparent relative">
        <div style={{ position: "fixed", top: "-10%", right: "-10%", bottom: "-10%", left: "-10%", zIndex: 0, pointerEvents: "none", opacity: 0.5 }}>
          <Image src="/Hero_bg.png" alt="" fill className="object-cover" priority />
        </div>
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="relative z-[1] box-border w-full max-w-full flex-1 overflow-x-hidden pt-[120px] pb-[80px] md:pb-0 md:ml-16 px-6 sm:px-[60px]">
          {viewLoading && !portfolioView ? (
            <div className="flex h-[calc(100vh-160px)] flex-col items-center justify-center gap-4">
              <div className="relative mb-8 inline-flex items-center justify-center">
                <svg width="56" height="56" viewBox="0 0 31 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-20 w-20">
                  <path d="M3.55566 19.2666L3.33398 19.0469C1.79851 17.5218 0.752098 16.778 0.75 15.0156C0.747877 13.1987 1.77395 12.5155 3.33594 10.9443L3.54883 10.7305L3.55371 10.4287C3.56565 9.75637 3.53559 9.03195 3.52832 8.39746C3.52077 7.73813 3.53667 7.12803 3.62598 6.56641C3.79824 5.48349 4.23581 4.60664 5.37109 3.98926C6.26131 3.50516 6.97931 3.54877 8.22852 3.55176H8.22949L10.4287 3.55273H10.7402L10.9609 3.33105C11.7884 2.49861 12.2767 1.90995 12.8818 1.45801C13.4184 1.05731 14.0208 0.795588 14.9854 0.750977C16.8439 0.800709 17.4383 1.72263 19.0312 3.32812L19.2422 3.54102L19.542 3.5498C20.114 3.56646 20.7109 3.54403 21.2666 3.53027C21.8349 3.5162 22.3742 3.51095 22.8887 3.55273C23.9102 3.63577 24.7531 3.89868 25.4121 4.58008C25.9392 5.12504 26.1796 5.61135 26.3027 6.12695C26.4015 6.54047 26.4298 6.98665 26.4375 7.54297L26.4404 8.1377L26.4375 10.4238V10.7363L26.6582 10.9561L27.9121 12.2031V12.2041C28.3805 12.6742 28.7118 13.0827 28.9307 13.5137C29.1436 13.9333 29.2666 14.4079 29.2686 15.0303C29.2743 16.7295 28.1437 17.5781 26.6602 19.0498L26.4395 19.2686L26.4385 19.5791C26.4364 19.994 26.4359 20.4088 26.4385 20.8232C26.4432 22.8812 26.6241 24.2269 25.4248 25.4033C24.8828 25.9351 24.3829 26.1807 23.8506 26.3057C23.2833 26.4388 22.6606 26.4419 21.8164 26.4414L19.582 26.4375H19.293L19.0781 26.6309C18.669 27 18.3221 27.3656 18.0166 27.6826C17.7035 28.0075 17.4377 28.2771 17.1582 28.5039C16.6396 28.9246 16.0559 29.2133 15.0576 29.249C13.1906 29.2341 12.5489 28.2719 10.9492 26.6631L10.7344 26.4473L10.4307 26.4424L9.91797 26.4414C9.75103 26.4426 9.59416 26.4435 9.44043 26.4414C8.35863 26.4267 7.51557 26.5037 6.65234 26.3945C5.85675 26.2939 5.17593 26.039 4.5752 25.4131C4.04762 24.8633 3.80726 24.3671 3.68555 23.8418C3.55556 23.2807 3.55289 22.667 3.55273 21.8213L3.55566 19.5791V19.2666Z" stroke="black" strokeWidth="1.5" className="stroke-black/15"/>
                  <path d="M3.55566 19.2666L3.33398 19.0469C1.79851 17.5218 0.752098 16.778 0.75 15.0156C0.747877 13.1987 1.77395 12.5155 3.33594 10.9443L3.54883 10.7305L3.55371 10.4287C3.56565 9.75637 3.53559 9.03195 3.52832 8.39746C3.52077 7.73813 3.53667 7.12803 3.62598 6.56641C3.79824 5.48349 4.23581 4.60664 5.37109 3.98926C6.26131 3.50516 6.97931 3.54877 8.22852 3.55176H8.22949L10.4287 3.55273H10.7402L10.9609 3.33105C11.7884 2.49861 12.2767 1.90995 12.8818 1.45801C13.4184 1.05731 14.0208 0.795588 14.9854 0.750977C16.8439 0.800709 17.4383 1.72263 19.0312 3.32812L19.2422 3.54102L19.542 3.5498C20.114 3.56646 20.7109 3.54403 21.2666 3.53027C21.8349 3.5162 22.3742 3.51095 22.8887 3.55273C23.9102 3.63577 24.7531 3.89868 25.4121 4.58008C25.9392 5.12504 26.1796 5.61135 26.3027 6.12695C26.4015 6.54047 26.4298 6.98665 26.4375 7.54297L26.4404 8.1377L26.4375 10.4238V10.7363L26.6582 10.9561L27.9121 12.2031V12.2041C28.3805 12.6742 28.7118 13.0827 28.9307 13.5137C29.1436 13.9333 29.2666 14.4079 29.2686 15.0303C29.2743 16.7295 28.1437 17.5781 26.6602 19.0498L26.4395 19.2686L26.4385 19.5791C26.4364 19.994 26.4359 20.4088 26.4385 20.8232C26.4432 22.8812 26.6241 24.2269 25.4248 25.4033C24.8828 25.9351 24.3829 26.1807 23.8506 26.3057C23.2833 26.4388 22.6606 26.4419 21.8164 26.4414L19.582 26.4375H19.293L19.0781 26.6309C18.669 27 18.3221 27.3656 18.0166 27.6826C17.7035 28.0075 17.4377 28.2771 17.1582 28.5039C16.6396 28.9246 16.0559 29.2133 15.0576 29.249C13.1906 29.2341 12.5489 28.2719 10.9492 26.6631L10.7344 26.4473L10.4307 26.4424L9.91797 26.4414C9.75103 26.4426 9.59416 26.4435 9.44043 26.4414C8.35863 26.4267 7.51557 26.5037 6.65234 26.3945C5.85675 26.2939 5.17593 26.039 4.5752 25.4131C4.04762 24.8633 3.80726 24.3671 3.68555 23.8418C3.55556 23.2807 3.55289 22.667 3.55273 21.8213L3.55566 19.5791V19.2666Z" stroke="black" strokeWidth="1.5" fill="none" className="[stroke-dasharray:1_300] [stroke-dashoffset:0] [stroke-linecap:round] [stroke-linejoin:round] animate-draw-stroke"/>
                </svg>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <MeridianLogo width={26} height={26} />
                </div>
              </div>
              <p className="m-0 text-sm text-black/50">Loading your portfolio</p>
            </div>
          ) : allUnderReview ? (
            <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center gap-0 text-center">
              <div className="mb-[32px]">
                <Image src="/nothing.png" alt="" width={120} height={120} aria-hidden="true" />
              </div>
              <h2 className="m-0 max-w-[500px] font-['ButlerPro'] text-[40px] font-normal leading-[110%] tracking-[-0.03em] text-black">
                We couldn&apos;t process your statements with full accuracy. Our team is reviewing them.
              </h2>
              <p className="mt-[16px] font-satoshi text-[15px] font-normal leading-[150%] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
                This may take 3-4 hours. We&apos;ll notify you as soon as your dashboard is ready
              </p>
              <Link
                href="/documents-vault"
                className="mt-[32px] inline-flex cursor-pointer items-center gap-[10px] rounded-full border border-black/10 bg-white px-[24px] py-[14px] font-satoshi text-[15px] font-semibold leading-[24px] tracking-[-0.02em] text-black transition hover:bg-black/5"
                style={{ fontFeatureSettings: "'ss03' on" }}
              >
                <PlusIcon />
                Add more statements
              </Link>
            </div>
          ) : (
            <>
              <DashboardHeader
                updatedAt={selectedPortfolio?.updated_at}
                asOfDate={portfolioView?.as_of_date ? new Date(portfolioView.as_of_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined}
                currency={currency}
                apiCurrencies={apiCurrencies}
                onCurrencyChange={handleCurrencyChange}
                onMenuOpen={() => setSidebarOpen(true)}
              />
              {brokerJobs?.some(j => j.status === "needs_review") && (() => {
                const pendingCount = brokerJobs.filter(j => j.status === "needs_review").length;
                return (
                <button
                  type="button"
                  className="mb-4 w-full flex items-center gap-2 px-4 py-4 rounded-2xl text-left cursor-pointer border-0 hover:brightness-95 transition-all"
                  style={{ background: "#DED7D1" }}
                  onClick={() => setIsPendingDocsModalOpen(true)}
                >
                  <div className="flex-shrink-0 w-[42px] h-[42px] rounded-full flex items-center justify-center" style={{ background: "#35230C" }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.9999 8.24997V11.9166M10.9999 15.5833H11.0091M9.73065 3.56738L2.19117 16.5901C1.77298 17.3124 1.56389 17.6736 1.59479 17.97C1.62174 18.2286 1.7572 18.4635 1.96745 18.6164C2.20849 18.7916 2.62581 18.7916 3.46046 18.7916H18.5394C19.3741 18.7916 19.7914 18.7916 20.0324 18.6164C20.2427 18.4635 20.3781 18.2286 20.4051 17.97C20.436 17.6736 20.2269 17.3124 19.8087 16.5901L12.2692 3.56738C11.8525 2.84764 11.6442 2.48778 11.3724 2.36691C11.1353 2.26148 10.8646 2.26148 10.6275 2.36691C10.3557 2.48778 10.1473 2.84765 9.73065 3.56738Z" stroke="white" strokeWidth="1.83333" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <span className="font-satoshi text-[16px] max-[768px]:text-[14px] font-medium leading-[130%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
                      We couldn&apos;t process {pendingCount} of your statement{pendingCount !== 1 ? "s" : ""} with full accuracy. Our team is reviewing them.
                    </span>
                    <span className="font-satoshi text-[14px] max-[768px]:text-[12px] font-normal leading-[140%] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
                      This may take 3-4 hours. We&apos;ll notify you as soon as this is resolved.
                    </span>
                  </div>
                  <svg className="md:hidden flex-shrink-0" width="8" height="14" viewBox="0 0 8 14" fill="none">
                    <path d="M1 1L7 7L1 13" stroke="#2f2b2c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="hidden md:inline-flex flex-shrink-0 font-satoshi text-[14px] font-medium leading-[150%] tracking-[-0.28px] text-black border border-black/15 rounded-full px-[22px] py-[12px] bg-white hover:bg-black/[0.04] transition-colors whitespace-nowrap" style={{ fontFeatureSettings: "'ss03' on" }}>
                    See details
                  </span>
                </button>
                );
              })()}
              <PortfolioSummary
                portfolioView={portfolioView ?? null}
                loading={loading}
                valuesRefetching={viewFetching}
                chartLoading={valuationsFetching}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={handleAccountChange}
                portfolios={portfolios}
                selectedPortfolio={selectedPortfolio}
                onPortfolioChange={handlePortfolioChange}
                currency={currency}
                currencySymbol={currencySymbol}
                onCurrencyChange={handleCurrencyChange}
                valuationSeries={valuationSeries}
                onExcludedHoldingsClick={setExcludedHoldings}
              />
              {isPortfolioEmpty ? (
                <section className="flex min-h-[calc(100vh-220px)] w-full items-center justify-center text-center">
                  <div className="mx-auto flex w-full max-w-[520px] flex-col items-center justify-center">
                    <div className="">
                      <Image src="/nothing.png" alt="" width={168} height={168} aria-hidden="true" />
                    </div>
                    <h2 className="mt-[40px] font-['ButlerPro'] text-[24px] font-medium leading-[120%] tracking-[-0.04em] text-black">
                      Nothing to show in your unified view!
                    </h2>
                    <p className="mt-[8px] font-satoshi text-[14px] font-medium leading-[150%] tracking-[-0.02em] text-black/70">
                      Upload your statements to create your unified view
                    </p>
                    <Link
                      href="/documents-vault"
                      className="mt-[34px] inline-flex cursor-pointer items-center gap-[10px] rounded-full border border-black/10 px-[24px] py-[16px] font-satoshi text-[16px] font-bold leading-[24px] tracking-[-0.04em] text-black transition hover:bg-black/5"
                    >
                      <PlusIcon />
                      Add statements
                    </Link>
                  </div>
                </section>
              ) : (
                <>
                  <PortfolioExposure portfolioView={portfolioView ?? null} currency={currency} apiCurrencies={apiCurrencies} />
                  <HoldingsTable positions={portfolioView?.positions || []} loading={loading} apiCurrencies={apiCurrencies} baseCurrency={portfolioView?.currency} />
                </>
              )}
            </>
          )}
        </main>
      </div>
      {isPendingDocsModalOpen && (
        <PendingDocumentsModal
          jobs={(brokerJobs ?? []).filter((j) => j.status === "needs_review")}
          onClose={() => setIsPendingDocsModalOpen(false)}
        />
      )}
      {excludedHoldings.length > 0 && (
        <ExcludedHoldingsModal
          positions={excludedHoldings}
          onClose={() => setExcludedHoldings([])}
        />
      )}
    </ProtectedRoute>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${day}, ${year} at ${time}`;
}

function getFileType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["xls", "xlsx"].includes(ext)) return "xls";
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  return "csv";
}

function FileIcon({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string; docBg: string; docFold: string }> = {
    pdf: { bg: "#e31b2f", text: "white", docBg: "#F5E6E8", docFold: "#E8CDD1" },
    xls: { bg: "#217346", text: "white", docBg: "#E6F2EC", docFold: "#C9E4D5" },
    csv: { bg: "#22a768", text: "white", docBg: "#E8F5EE", docFold: "#C9E8D7" },
    file: { bg: "#6b7280", text: "white", docBg: "#E5E7EB", docFold: "#D1D5DB" },
  };
  const { bg, text, docBg, docFold } = colors[type] ?? colors.file;
  return (
    <div className="relative flex-shrink-0">
      <svg width="28" height="34" viewBox="0 0 48 56" fill="none">
        <path d="M4 4C4 1.79086 5.79086 0 8 0H30L44 14V52C44 54.2091 42.2091 56 40 56H8C5.79086 56 4 54.2091 4 52V4Z" fill={docBg} />
        <path d="M30 0L44 14H34C31.7909 14 30 12.2091 30 10V0Z" fill={docFold} />
        <rect x="8" y="36" width="28" height="14" rx="2" fill={bg} />
      </svg>
      <span className="absolute bottom-[5px] left-1/2 -translate-x-1/2 text-[5px] font-bold uppercase" style={{ color: text }}>
        {type === "xlsx" ? "xls" : type}
      </span>
    </div>
  );
}

function PendingDocumentsModal({ jobs, onClose }: { jobs: BrokerStatementJob[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[560px] mx-4 rounded-[32px] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-docs-title"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-black/10">
          <div>
            <h2
              id="pending-docs-title"
              className="m-0 font-satoshi text-[18px] font-bold leading-[130%] tracking-[-0.02em] text-black"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              Statements under review
            </h2>
            <p
              className="m-0 mt-1 font-satoshi text-[13px] font-normal leading-[150%] tracking-[-0.02em] text-black/50"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              {jobs.length} statement{jobs.length !== 1 ? "s" : ""} pending manual review
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-black/50 transition hover:bg-black/10"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto px-8 py-6 space-y-3">
          {jobs.length === 0 ? (
            <p className="text-center font-satoshi text-[14px] text-black/50 py-8" style={{ fontFeatureSettings: "'ss03' on" }}>
              No pending statements
            </p>
          ) : (
            jobs.map((job) => (
              <div key={job.job_id} className="flex items-center gap-4 rounded-[20px] bg-[#f6f6f6] px-4 py-4">
                <FileIcon type={getFileType(job.original_filename)} />
                <div className="flex-1 min-w-0">
                  <p
                    className="m-0 font-satoshi text-[14px] font-medium leading-[130%] tracking-[-0.02em] text-black truncate"
                    style={{ fontFeatureSettings: "'ss03' on" }}
                    title={job.original_filename}
                  >
                    {job.original_filename}
                  </p>
                  <p
                    className="m-0 mt-0.5 font-satoshi text-[12px] font-normal leading-[150%] text-black/40"
                    style={{ fontFeatureSettings: "'ss03' on" }}
                  >
                    Uploaded {formatDate(job.created_at)}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-3 py-1 font-satoshi text-[12px] font-semibold"
                  style={{ background: "#DED7D1", color: "#5C3D1A", fontFeatureSettings: "'ss03' on" }}
                >
                  Under review
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ExcludedHoldingsModal({
  positions,
  onClose,
}: {
  positions: import("../lib/portfolioDataApi").PortfolioViewPosition[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[560px] mx-4 rounded-[32px] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excluded-holdings-title"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-black/10">
          <div>
            <h2
              id="excluded-holdings-title"
              className="m-0 font-satoshi text-[18px] font-bold leading-[130%] tracking-[-0.02em] text-black"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              Holdings excluded from analysis
            </h2>
            <p
              className="m-0 mt-1 font-satoshi text-[13px] font-normal leading-[150%] tracking-[-0.02em] text-black/50"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              These holdings have no cost basis and are excluded from gain/loss calculations
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-black/50 transition hover:bg-black/10"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto px-8 py-6 space-y-2">
          {positions.map((p) => (
            <div key={p.ticker || p.isin || p.name} className="flex items-center gap-4 rounded-[16px] bg-[#f6f6f6] px-4 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.06]">
                <span className="font-satoshi text-[11px] font-bold text-black/50">
                  {(p.ticker || p.name || "?").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="m-0 font-satoshi text-[14px] font-medium leading-[130%] tracking-[-0.02em] text-black truncate"
                  style={{ fontFeatureSettings: "'ss03' on" }}
                >
                  {p.name || p.ticker || p.isin}
                </p>
                {p.ticker && p.ticker !== p.name && (
                  <p className="m-0 mt-0.5 font-satoshi text-[12px] text-black/40" style={{ fontFeatureSettings: "'ss03' on" }}>
                    {p.ticker} · {p.currency}
                  </p>
                )}
              </div>
              <span
                className="flex-shrink-0 rounded-full px-3 py-1 font-satoshi text-[12px] font-semibold"
                style={{ background: "#FEF3C7", color: "#92400E", fontFeatureSettings: "'ss03' on" }}
              >
                No cost basis
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
