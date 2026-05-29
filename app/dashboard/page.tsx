"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
} from "../store/api";

export default function DashboardPage() {
  const { trackPage, trackClick, trackSectionScroll } = useAnalytics();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const [currency, setCurrency] = useState("INR");
  const sectionInViewRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
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

  const { data: portfolios = [] } = useListPortfoliosQuery();

  const activePortfolioId = selectedPortfolioId ?? portfolios[0]?.id ?? null;
  const selectedPortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null;

  const { data: accounts = [] } = useGetAccountsByPortfolioIdQuery(activePortfolioId!, {
    skip: !activePortfolioId,
  });

  const accountIds = useMemo(
    () => (selectedAccountId === "all" ? [] : [selectedAccountId]),
    [selectedAccountId],
  );

  const { fromDate, toDate } = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return {
      fromDate: thirtyDaysAgo.toISOString().split("T")[0],
      toDate: today.toISOString().split("T")[0],
    };
  }, []);

  const { data: portfolioView, isLoading: viewLoading } = useGetPortfolioViewQuery(
    { accountIds, currency },
    { skip: !activePortfolioId },
  );

  const { data: valuationsData, isFetching: valuationsFetching } = useGetValuationsViewQuery(
    { accountIds, currency, fromDate, toDate },
    { skip: !activePortfolioId },
  );

  const valuationSeries = valuationsFetching ? [] : (valuationsData?.price_series ?? []);
  const loading = viewLoading || !portfolioView;

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
      <div className="flex min-h-screen overflow-x-hidden bg-[var(--background)]">
        <Sidebar />
        <main className="box-border w-full max-w-full flex-1 overflow-x-hidden pt-[80px] sm:pt-[40px] md:ml-16 px-6 sm:px-[60px]">
          <DashboardHeader updatedAt={selectedPortfolio?.updated_at} />
          {loading && !portfolioView ? (
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
          ) : (
            <>
              <PortfolioSummary
                portfolioView={portfolioView ?? null}
                loading={loading}
                chartLoading={valuationsFetching}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={handleAccountChange}
                portfolios={portfolios}
                selectedPortfolio={selectedPortfolio}
                onPortfolioChange={handlePortfolioChange}
                currency={currency}
                onCurrencyChange={handleCurrencyChange}
                valuationSeries={valuationSeries}
              />
              <PortfolioExposure portfolioView={portfolioView ?? null} />
              <HoldingsTable positions={portfolioView?.positions || []} loading={loading} />
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
