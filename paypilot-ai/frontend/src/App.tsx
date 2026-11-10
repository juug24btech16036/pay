import React, { useEffect, useState, useCallback } from 'react';
import {
  Navbar,
} from './components/Navbar';
import {
  AIPaymentRequest,
} from './components/AIPaymentRequest';
import {
  PayPalCheckoutArea,
} from './components/PayPalCheckoutArea';
import {
  TransactionStatus,
} from './components/TransactionStatus';
import {
  RecentTransactions,
} from './components/RecentTransactions';
import {
  ConfigHelperModal,
} from './components/ConfigHelperModal';
import { api } from './services/api';
import type {
  BackendHealthResponse,
  CaptureOrderResponse,
  ClientIdResponse,
  CreateOrderPayload,
  TransactionRecord,
} from './types';
import {
  AlertCircle,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
  // Backend & PayPal SDK state
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [clientIdInfo, setClientIdInfo] = useState<ClientIdResponse | null>(null);

  // Active transaction builder state
  const [payload, setPayload] = useState<CreateOrderPayload>({
    amount: '25.00',
    currency: 'USD',
    description: 'Autonomous AI Cloud Compute credits (100k inference tokens)',
  });

  // Completed transaction & status
  const [captureData, setCaptureData] = useState<CaptureOrderResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // UI Modals and notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Load backend status and transactions
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingHealth(true);
      const [healthData, clientData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getClientId().catch(() => null),
      ]);
      setHealth(healthData);
      setClientIdInfo(clientData);
    } catch (err: any) {
      console.warn('Backend connection notice:', err);
    } finally {
      setLoadingHealth(false);
    }

    try {
      setLoadingTransactions(true);
      const txs = await api.getTransactions();
      setTransactions(txs);
    } catch {
      // Backend may be starting up
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const txs = await api.getTransactions();
      setTransactions(txs);
    } catch (err: any) {
      console.error('Failed to refresh transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCaptureSuccess = (data: CaptureOrderResponse) => {
    setCaptureData(data);
    setErrorMessage(null);
    refreshTransactions();
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
  };

  const handleReset = () => {
    setCaptureData(null);
    setErrorMessage(null);
  };

  return (
    <div className="app-shell">
      {/* Top Fintech Navigation */}
      <Navbar
        health={health}
        loadingHealth={loadingHealth}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
      />

      {/* Global Toast Notification */}
      {errorMessage && (
        <div className="global-error-toast">
          <AlertCircle size={18} className="toast-icon" />
          <span className="toast-message">{errorMessage}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Dashboard Container */}
      <main className="dashboard-main">
        {/* Hero Section */}
        <section className="hero-banner">
          <div className="hero-tag-row">
            <span className="hero-pill">
              <Zap size={13} className="hero-pill-icon" /> PayPal AI Hackathon
            </span>
            <span className="hero-pill architecture-pill">
              <Cpu size={13} className="hero-pill-icon" /> FastAPI + React + PayPal REST v2
            </span>
          </div>
          <h1 className="hero-title">
            Intelligent Payment Routing &amp; Checkout Dashboard
          </h1>
          <p className="hero-desc">
            PayPilot AI orchestrates intelligent agent-assisted payment flows. Securely authorizes
            orders with the PayPal Sandbox REST API via OAuth 2.0 backend credentials with zero client-side secret exposure.
          </p>
        </section>

        {/* Dashboard Core Grid */}
        <section className="dashboard-grid">
          {/* Left Column: AI Payment Request Area */}
          <div className="grid-col left-col">
            <AIPaymentRequest
              currentPayload={payload}
              onPayloadChange={setPayload}
              disabled={!!captureData}
            />
          </div>

          {/* Right Column: PayPal Checkout or Captured Transaction Status */}
          <div className="grid-col right-col">
            {captureData ? (
              <TransactionStatus
                captureData={captureData}
                onReset={handleReset}
              />
            ) : (
              <PayPalCheckoutArea
                payload={payload}
                clientIdInfo={clientIdInfo}
                onSuccess={handleCaptureSuccess}
                onError={handleError}
                onOpenConfigModal={() => setIsConfigModalOpen(true)}
              />
            )}
          </div>
        </section>

        {/* Full-width Section: Recent Transactions */}
        <section className="recent-section">
          <RecentTransactions
            transactions={transactions}
            isLoading={loadingTransactions}
            onRefresh={refreshTransactions}
          />
        </section>

        {/* Architecture Specs Highlight */}
        <section className="architecture-cards-grid">
          <div className="arch-card glass-panel">
            <div className="arch-card-icon">
              <Zap size={18} />
            </div>
            <h3>OAuth 2.0 Backend Vault</h3>
            <p>
              Secret stays strictly in Python memory. Access tokens cached securely with automatic expiry renewal.
            </p>
          </div>
          <div className="arch-card glass-panel">
            <div className="arch-card-icon">
              <Layers size={18} />
            </div>
            <h3>PayPal Orders v2 API</h3>
            <p>
              Full implementation of order creation, buyer approval, and server-side capture via official Sandbox endpoints.
            </p>
          </div>
          <div className="arch-card glass-panel">
            <div className="arch-card-icon">
              <Cpu size={18} />
            </div>
            <h3>AI-Ready Architecture</h3>
            <p>
              Structured payment schemas ready for autonomous agent function calling and future PayPal JS SDK v6 upgrade.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <span>PayPilot AI &copy; 2026 &bull; PayPal AI Hackathon Project</span>
          </div>
          <div className="footer-right">
            <span className="footer-env">Sandbox API Base: https://api-m.sandbox.paypal.com</span>
          </div>
        </div>
      </footer>

      {/* Configuration Assistant Modal */}
      <ConfigHelperModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        isConfigured={!!clientIdInfo?.is_configured}
      />
    </div>
  );
};

export default App;
