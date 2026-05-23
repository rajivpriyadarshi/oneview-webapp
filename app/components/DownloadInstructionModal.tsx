"use client";

import { useState } from "react";

const BROKERS = [
  { id: "groww", name: "Groww (Excel)", icon: "/broker-icons/groww.png", steps: [
    { text: "Open Groww and go to your ", highlight: "Profile" },
    { text: "Select ", highlight: "Reports" },
    { text: "Under ", highlight: "Transactions", highlight2: ", select ", highlight3: "Groww Balance Statements" },
    { text: "Choose ", highlight: "Excel" },
    { text: "Select the financial year or date range and click ", highlight: "Download" }
  ]},
  { id: "zerodha", name: "Zerodha (Excel)", icon: "/broker-icons/zerodha.png", steps: [
    { text: "Login to Zerodha Console and go to ", highlight: "Portfolio" },
    { text: "Click on ", highlight: "Holdings" },
    { text: "Select ", highlight: "Download Holdings" },
    { text: "Choose ", highlight: "Excel" },
    { text: "Download the file" }
  ]},
  { id: "fidelity", name: "Fidelity (CSV)", icon: "/broker-icons/fidelity.png", steps: [
    { text: "Login to Fidelity and navigate to ", highlight: "Accounts & Trade" },
    { text: "Select ", highlight: "Portfolio" },
    { text: "Click ", highlight: "Download" },
    { text: "Choose ", highlight: "CSV format" },
    { text: "Confirm and download" }
  ]},
  { id: "schwab", name: "Charles Schwab (CSV)", icon: "/broker-icons/shwab.png", steps: [
    { text: "Login to Schwab and go to ", highlight: "Accounts" },
    { text: "Select ", highlight: "Positions" },
    { text: "Click ", highlight: "Export" },
    { text: "Choose ", highlight: "CSV" },
    { text: "Download the file" }
  ]},
  { id: "ibkr", name: "Interactive Brokers (CSV)", icon: "/broker-icons/ibkr.png", steps: [
    { text: "Login to IBKR and navigate to ", highlight: "Portfolio" },
    { text: "Click on ", highlight: "Reports / Tax Docs" },
    { text: "Under Activity, select ", highlight: "Statements" },
    { text: "Choose ", highlight: "CSV" },
    { text: "Set the date range and click ", highlight: "Download" }
  ]},
  { id: "vested", name: "Vested (CSV)", icon: "/broker-icons/vested.png", steps: [
    { text: "Open Vested app and go to ", highlight: "Portfolio" },
    { text: "Tap on ", highlight: "Account Statement" },
    { text: "Select the ", highlight: "date range" },
    { text: "Choose ", highlight: "CSV format" },
    { text: "Tap ", highlight: "Download" }
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
              <span className="step-text">
                {step.text.split(step.highlight || "")[0]}
                {step.highlight && <strong>{step.highlight}</strong>}
                {step.text.split(step.highlight || "")[1]?.split(step.highlight2 || "")[0]}
                {step.highlight2 && <>{step.highlight2}<strong>{step.highlight3}</strong></>}
                {step.text.split(step.highlight3 || "").pop()?.replace(step.text, "")}
              </span>
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
