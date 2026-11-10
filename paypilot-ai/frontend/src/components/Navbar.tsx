import React from 'react';
import { Bot, CheckCircle2, AlertCircle, Shield, Sparkles } from 'lucide-react';
import type { BackendHealthResponse } from '../types';

interface NavbarProps {
  health: BackendHealthResponse | null;
  loadingHealth: boolean;
  onOpenConfigModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  loadingHealth,
  onOpenConfigModal,
}) => {
  const isConnected = !!health && health.status === 'ok';
  const isPaypalReady = !!health?.paypal_configured;

  return (
    <header className="navbar-container">
      <div className="navbar-content">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-logo-icon">
            <Bot className="brand-icon" size={24} />
            <span className="brand-glow-dot"></span>
          </div>
          <div className="brand-text-block">
            <div className="brand-title-row">
              <span className="brand-name">PayPilot</span>
              <span className="brand-ai-badge">
                <Sparkles size={11} className="sparkle-icon" /> AI
              </span>
            </div>
            <span className="brand-tagline">PayPal AI Hackathon 2026</span>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="navbar-actions">
          {/* Environment Tag */}
          <div className="env-badge">
            <Shield size={14} className="badge-icon" />
            <span>Sandbox Mode</span>
          </div>

          {/* Backend Health Indicator */}
          <div className={`health-badge ${isConnected ? 'online' : 'offline'}`}>
            <span className="health-dot pulse-indicator"></span>
            <span className="health-label">
              {loadingHealth
                ? 'Connecting...'
                : isConnected
                ? 'Backend Live'
                : 'Backend Offline'}
            </span>
          </div>

          {/* PayPal Credentials Status */}
          <button
            type="button"
            className={`config-status-button ${
              isPaypalReady ? 'ready' : 'unconfigured'
            }`}
            onClick={onOpenConfigModal}
            title="PayPal Sandbox Configuration"
          >
            {isPaypalReady ? (
              <>
                <CheckCircle2 size={15} className="status-icon" />
                <span>Sandbox Ready</span>
              </>
            ) : (
              <>
                <AlertCircle size={15} className="status-icon" />
                <span>Configure PayPal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
