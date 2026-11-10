import React, { useState } from 'react';
import {
  CheckCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  RotateCcw,
  User,
  Hash,
} from 'lucide-react';
import type { CaptureOrderResponse } from '../types';

interface TransactionStatusProps {
  captureData: CaptureOrderResponse | null;
  onReset: () => void;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  captureData,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!captureData) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(captureData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel transaction-status-card">
      {/* Top Banner */}
      <div className="status-hero-banner">
        <div className="hero-icon-container">
          <CheckCircle size={32} className="success-hero-icon" />
          <div className="hero-glow"></div>
        </div>
        <div className="hero-text-block">
          <div className="hero-status-row">
            <span className="hero-status-title">Payment Successfully Captured</span>
            <span className="status-pill status-completed">
              {captureData.status}
            </span>
          </div>
          <p className="hero-subtitle">
            Verified by official PayPal Sandbox REST API v2 response
          </p>
        </div>
        <button
          type="button"
          className="reset-button"
          onClick={onReset}
          title="Start a new transaction"
        >
          <RotateCcw size={16} />
          <span>New Payment</span>
        </button>
      </div>

      {/* Main Details Grid */}
      <div className="receipt-grid">
        {/* Amount Box */}
        <div className="receipt-stat-card amount-card">
          <span className="stat-label">Captured Amount</span>
          <div className="stat-value font-mono">
            {captureData.currency} {parseFloat(captureData.amount || '0').toFixed(2)}
          </div>
          <span className="stat-sub">Settled in PayPal Sandbox</span>
        </div>

        {/* Capture ID */}
        <div className="receipt-stat-card">
          <div className="stat-header-row">
            <Hash size={14} className="stat-icon" />
            <span className="stat-label">Capture ID</span>
          </div>
          <div className="stat-value-mono font-mono">
            {captureData.capture_id || 'N/A'}
          </div>
          <span className="stat-sub">Unique PayPal Capture identifier</span>
        </div>

        {/* Order ID */}
        <div className="receipt-stat-card">
          <div className="stat-header-row">
            <Receipt size={14} className="stat-icon" />
            <span className="stat-label">PayPal Order ID</span>
          </div>
          <div className="stat-value-mono font-mono">{captureData.id}</div>
          <span className="stat-sub">Order approval reference</span>
        </div>

        {/* Buyer Info */}
        <div className="receipt-stat-card">
          <div className="stat-header-row">
            <User size={14} className="stat-icon" />
            <span className="stat-label">Payer Account</span>
          </div>
          <div className="stat-value font-sans">
            {captureData.payer_name || 'Sandbox Buyer'}
          </div>
          <span className="stat-sub font-mono">
            {captureData.payer_email || 'sandbox-buyer@paypal.com'}
          </span>
        </div>
      </div>

      {/* Raw Response Collapsible */}
      <div className="raw-json-section">
        <div className="raw-json-header">
          <button
            type="button"
            className="toggle-json-btn"
            onClick={() => setShowRawJson(!showRawJson)}
          >
            <span>Inspect PayPal Sandbox Response Payload</span>
            {showRawJson ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            type="button"
            className="copy-json-btn"
            onClick={handleCopyJson}
            title="Copy JSON response"
          >
            {copied ? (
              <>
                <Check size={14} className="text-success" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>

        {showRawJson && (
          <div className="raw-json-body">
            <pre className="font-mono">
              {JSON.stringify(captureData.details || captureData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
