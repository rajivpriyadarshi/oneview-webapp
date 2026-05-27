"use client";

import { useState } from "react";
import { ReactNode } from "react";

type Step = {
  text: string;
  highlight?: string;
  highlight2?: string;
  highlight3?: string;
};

type Broker = {
  id: string;
  name: string;
  icon: string;
  steps: Step[];
};

const BROKERS: Broker[] = [
  { id: "groww", name: "Groww", icon: "/broker-icons/groww.png", steps: [
    { text: "Log in to your Groww app or visit the ", highlight: "Groww Platform website" },
    { text: "Tap on your ", highlight: "profile icon", highlight2: " (top-right on web, bottom-right on mobile)" },
    { text: "Select ", highlight: "Reports" },
    { text: "Under Holdings or Transactions, tap on ", highlight: "Holdings & Demat Statement", highlight2: " or ", highlight3: "Demat Report" },
    { text: "Select the desired date and click ", highlight: "Download" }
  ]},
  { id: "zerodha", name: "Zerodha", icon: "/broker-icons/zerodha.png", steps: [
    { text: "Log in to ", highlight: "Zerodha Console" },
    { text: "Navigate to ", highlight: "Portfolio", highlight2: " > ", highlight3: "Holdings" },
    { text: "Click the ", highlight: "XLSX button", highlight2: " next to Download option" },
    { text: "To get a specific date, select your preferred date before downloading" },
    { text: "Download the file (historical data available from April 2017)" }
  ]},
  { id: "fidelity", name: "Fidelity - Web", icon: "/broker-icons/fidelity.png", steps: [
    { text: "Go to ", highlight: "Fidelity", highlight2: " and sign in to your account" },
    { text: "Click on ", highlight: "Accounts & Trade", highlight2: " tab at the top, then select ", highlight3: "Statements" },
    { text: "Choose the specific ", highlight: "account and date range", highlight2: " you need" },
    { text: "Click the ", highlight: "download icon", highlight2: " (downward arrow) to the right of the statement" },
    { text: "Select ", highlight: "PDF format", highlight2: " and save it to your computer" }
  ]},
  { id: "fidelity-mobile", name: "Fidelity - Mobile", icon: "/broker-icons/fidelity.png", steps: [
    { text: "Open the ", highlight: "Fidelity Investments app", highlight2: " and log in" },
    { text: "Go to the ", highlight: "Accounts tab", highlight2: " in the main menu" },
    { text: "Select the specific account (e.g., ", highlight: "brokerage or retirement", highlight2: ")" },
    { text: "Tap on ", highlight: "Documents", highlight2: " or ", highlight3: "Statements" },
    { text: "Filter by date range and select the statement you want to view" },
    { text: "Tap the document to open, then select the ", highlight: "share/export icon", highlight2: " to download or save" }
  ]},
  { id: "schwab", name: "Charles Schwab", icon: "/broker-icons/shwab.png", steps: [
    { text: "Go to Charles Schwab and log in with your ", highlight: "User ID and Password" },
    { text: "Navigate to ", highlight: "Accounts", highlight2: " > ", highlight3: "Statements & Tax Forms" },
    { text: "Ensure you have the ", highlight: "Statements tab", highlight2: " selected (not Tax Forms)" },
    { text: "Choose the specific ", highlight: "account", highlight2: " and select the ", highlight3: "statement period or date range" },
    { text: "Click the ", highlight: "PDF icon or Download button", highlight2: " to save the statement" }
  ]},
  { id: "ibkr", name: "Interactive Brokers - Web", icon: "/broker-icons/ibkr.png", steps: [
    { text: "Go to ", highlight: "Interactive Brokers Client Portal", highlight2: " and log in" },
    { text: "Click the ", highlight: "Menu", highlight2: " in the top left corner, then go to ", highlight3: "Performance & Reports > Statements" },
    { text: "If managing multiple accounts, choose from the ", highlight: "Account Selector" },
    { text: "Under Default or Custom Statements, click ", highlight: "gear icon or blue Run arrow", highlight2: " next to ", highlight3: "Activity Statement" },
    { text: "Configure ", highlight: "Period, Format, and Language", highlight2: " (Daily/Monthly/Year to Date/Custom for Period, PDF or CSV for Format)" },
    { text: "Click ", highlight: "Run or View", highlight2: " - file will automatically save to your device" }
  ]},
  { id: "ibkr-mobile", name: "Interactive Brokers - Mobile", icon: "/broker-icons/ibkr.png", steps: [
    { text: "Tap the ", highlight: "Account menu icon", highlight2: " (three horizontal lines) in the top left corner" },
    { text: "Tap ", highlight: "Statements & Tax", highlight2: " > ", highlight3: "Activity Statement" },
    { text: "Select your desired ", highlight: "Period, Format (PDF/HTML), and Date" },
    { text: "Tap ", highlight: "Download", highlight2: " to save the file to your mobile device" }
  ]},
  { id: "vested", name: "Vested", icon: "/broker-icons/vested.png", steps: [
    { text: "Log in to your ", highlight: "Vested account", highlight2: " via the web platform or mobile app" },
    { text: "Go to the ", highlight: "Profile", highlight2: " section" },
    { text: "Select ", highlight: "Tax Documents or Transactions", highlight2: " to find and export your reports" },
    { text: "Download your detailed ", highlight: "holding, tax, and trade reports" }
  ]}
];

interface DownloadInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadInstructionModal({ isOpen, onClose }: DownloadInstructionModalProps) {
  const [selectedBroker, setSelectedBroker] = useState(BROKERS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!isOpen) return null;

  function handleBrokerSelect(broker: typeof BROKERS[0]) {
    setSelectedBroker(broker);
    setDropdownOpen(false);
  }

  function renderStepText(step: Step): ReactNode {
    if (!step.highlight) {
      return step.text;
    }

    const [beforeHighlight, afterHighlight = ""] = step.text.split(step.highlight, 2);

    if (!step.highlight2) {
      return (
        <>
          {beforeHighlight}
          <strong>{step.highlight}</strong>
          {afterHighlight}
        </>
      );
    }

    const [betweenHighlightAndHighlight2, afterHighlight2 = ""] = afterHighlight.split(step.highlight2, 2);

    if (!step.highlight3) {
      return (
        <>
          {beforeHighlight}
          <strong>{step.highlight}</strong>
          {betweenHighlightAndHighlight2}
          {step.highlight2}
          {afterHighlight2}
        </>
      );
    }

    const [betweenHighlight2AndHighlight3, afterHighlight3 = ""] = afterHighlight2.split(step.highlight3, 2);

    return (
      <>
        {beforeHighlight}
        <strong>{step.highlight}</strong>
        {betweenHighlightAndHighlight2}
        {step.highlight2}
        <strong>{step.highlight3}</strong>
        {betweenHighlight2AndHighlight3}
        {afterHighlight3}
      </>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <CloseIcon />
        </button>

        <h2 className="modal-title">How to download your statements</h2>
        <p className="modal-subtitle">
          Follow the simple steps below to download your holdings statements from your broker.
        </p>

        <div className="broker-dropdown-container">
          <label className="broker-label">Select your broker</label>
          <button
            className="broker-dropdown"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            type="button"
          >
            <span className="broker-dropdown-selected">
              <img src={selectedBroker.icon} alt="" className="broker-dropdown-icon" />
              {selectedBroker.name}
            </span>
            <ChevronIcon />
          </button>
          {dropdownOpen && (
            <div className="broker-dropdown-menu">
              {BROKERS.map((broker) => (
                <button
                  key={broker.id}
                  className={`broker-dropdown-item ${broker.id === selectedBroker.id ? 'active' : ''}`}
                  onClick={() => handleBrokerSelect(broker)}
                  type="button"
                >
                  <img src={broker.icon} alt="" className="broker-dropdown-icon" />
                  {broker.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <ol className="instruction-steps">
          {selectedBroker.steps.map((step, index) => (
            <li key={index} className="instruction-step">
              <span className="step-number">{index + 1}</span>
              <span className="step-text">{renderStepText(step)}</span>
            </li>
          ))}
        </ol>

        <button className="modal-button" onClick={onClose} type="button">
          Okay, got it
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
