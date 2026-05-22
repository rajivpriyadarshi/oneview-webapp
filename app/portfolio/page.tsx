"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import PortfolioSummary from "../components/PortfolioSummary";
import PortfolioExposure from "../components/PortfolioExposure";
import HoldingsTable from "../components/HoldingsTable";
import { listPortfolios, type Portfolio } from "../lib/portfoliosApi";
import {
  getPortfolioById,
  getAccountsByPortfolioId,
  getPortfolioValuation,
  getAccountHoldings,
  type PortfolioValuation,
  type HoldingPosition,
  type Account,
} from "../lib/portfolioDataApi";
import "./portfolio.css";

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [holdings, setHoldings] = useState<HoldingPosition[]>([]);
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

  const fetchPortfolioData = useCallback(async (portfolio: Portfolio, accountFilter: number | "all") => {
    setLoading(true);
    try {
      const [portfolioDetail, valuationData, accountsList] = await Promise.all([
        getPortfolioById(portfolio.id),
        getPortfolioValuation(portfolio.id),
        getAccountsByPortfolioId(portfolio.id),
      ]);

      console.log("Portfolio detail:", portfolioDetail);
      setValuation(valuationData);
      setAccounts(accountsList);

      const targetAccounts = accountFilter === "all"
        ? accountsList.filter((a) => a.is_active)
        : accountsList.filter((a) => a.id === accountFilter && a.is_active);

      const allHoldings: HoldingPosition[] = [];

      await Promise.all(
        targetAccounts.map(async (account) => {
          try {
            const snapshot = await getAccountHoldings(portfolio.id, account.id);
            if (Array.isArray(snapshot)) {
              allHoldings.push(...snapshot);
            } else if (snapshot?.positions_json) {
              allHoldings.push(...snapshot.positions_json);
            } else if (snapshot?.positions) {
              allHoldings.push(...snapshot.positions);
            } else if (snapshot && typeof snapshot === "object" && "results" in snapshot) {
              const results = (snapshot as { results: unknown }).results;
              if (Array.isArray(results)) {
                for (const item of results) {
                  if (item.positions_json) {
                    allHoldings.push(...item.positions_json);
                  } else if (item.positions) {
                    allHoldings.push(...item.positions);
                  }
                }
              }
            }
          } catch (e) {
            console.error("Holdings fetch failed for account", account.id, e);
          }
        }),
      );

      setHoldings(allHoldings);
    } catch (error) {
      console.error("Failed to fetch portfolio data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPortfolio) {
      fetchPortfolioData(selectedPortfolio, selectedAccountId);
    }
  }, [selectedPortfolio, selectedAccountId, fetchPortfolioData]);

  const handleAccountChange = (accountId: number | "all") => {
    setSelectedAccountId(accountId);
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
          valuation={valuation}
          loading={loading}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={handleAccountChange}
          portfolios={portfolios}
          selectedPortfolio={selectedPortfolio}
          onPortfolioChange={handlePortfolioChange}
        />
        <PortfolioExposure holdings={holdings} />
        <HoldingsTable holdings={holdings} loading={loading} />
      </main>
    </div>
  );
}
