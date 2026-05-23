"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import PortfolioSummary from "../components/PortfolioSummary";
import PortfolioExposure from "../components/PortfolioExposure";
import HoldingsTable from "../components/HoldingsTable";
import { listPortfolios, type Portfolio } from "../lib/portfoliosApi";
import {
  getAccountsByPortfolioId,
  getPortfolioView,
  type Account,
  type PortfolioViewResponse,
} from "../lib/portfolioDataApi";
import "./portfolio.css";

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const [currency, setCurrency] = useState("INR");
  const [portfolioView, setPortfolioView] = useState<PortfolioViewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const allPortfolios = await listPortfolios();
        setPortfolios(allPortfolios);
        if (allPortfolios.length > 0) {
          setSelectedPortfolio(allPortfolios[0]);
        }
      } catch (error) {
        console.error("Failed to fetch portfolios:", error);
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedPortfolio) return;
    async function fetchAccounts() {
      try {
        const accountsList = await getAccountsByPortfolioId(selectedPortfolio!.id);
        setAccounts(accountsList);
      } catch (error) {
        console.error("Failed to fetch accounts:", error);
      }
    }
    fetchAccounts();
  }, [selectedPortfolio]);

  const fetchPortfolioView = useCallback(async (accountFilter: number | "all", curr: string) => {
    setLoading(true);
    try {
      const accountIds = accountFilter === "all"
        ? []
        : [accountFilter];
      const data = await getPortfolioView(accountIds, curr);
      setPortfolioView(data);
    } catch (error) {
      console.error("Failed to fetch portfolio view:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPortfolio) {
      fetchPortfolioView(selectedAccountId, currency);
    }
  }, [selectedPortfolio, selectedAccountId, currency, fetchPortfolioView]);

  const handleAccountChange = (accountId: number | "all") => {
    setSelectedAccountId(accountId);
  };

  const handleCurrencyChange = (curr: string) => {
    setCurrency(curr);
  };

  const handlePortfolioChange = (portfolioId: number) => {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (portfolio) {
      setSelectedPortfolio(portfolio);
      setSelectedAccountId("all");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <DashboardHeader />
        <PortfolioSummary
          portfolioView={portfolioView}
          loading={loading}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={handleAccountChange}
          portfolios={portfolios}
          selectedPortfolio={selectedPortfolio}
          onPortfolioChange={handlePortfolioChange}
          currency={currency}
          onCurrencyChange={handleCurrencyChange}
        />
        <PortfolioExposure portfolioView={portfolioView} />
        <HoldingsTable positions={portfolioView?.positions || []} loading={loading} />
      </main>
    </div>
  );
}
