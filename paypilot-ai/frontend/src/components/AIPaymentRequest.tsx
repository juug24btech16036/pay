import React, { useState } from 'react';
import {
  Bot,
  DollarSign,
  Sparkles,
  RefreshCw,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { CreateOrderPayload, ParseIntentResponse } from '../types';

interface AIPaymentRequestProps {
  currentPayload: CreateOrderPayload;
  onPayloadChange: (payload: CreateOrderPayload) => void;
  disabled?: boolean;
}

const PRESET_SCENARIOS = [
  {
    title: 'AI Compute Credits',
    amount: '25.00',
    currency: 'USD',
    description: 'Autonomous GPU cluster credits (100k inference tokens)',
    category: 'Compute',
  },
  {
    title: 'PayPilot Copilot Pro',
    amount: '49.00',
    currency: 'USD',
    description: 'Monthly autonomous payment routing & dispute guardian subscription',
    category: 'Subscription',
  },
  {
    title: 'Agent Workflow Execution',
    amount: '5.50',
    currency: 'USD',
    description: 'Single-run multi-agent automated financial reconciliation task',
    category: 'Micro-pay',
  },
  {
    title: 'Global FX Liquidity',
    amount: '120.00',
    currency: 'EUR',
    description: 'Cross-border supplier settlement with smart FX hedge',
    category: 'Cross-Border',
  },
];

const CURRENCIES = [
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£' },
  { code: 'CAD', label: 'CAD ($)', symbol: 'CA$' },
  { code: 'AUD', label: 'AUD ($)', symbol: 'AU$' },
  { code: 'JPY', label: 'JPY (¥)', symbol: '¥' },
];

export const AIPaymentRequest: React.FC<AIPaymentRequestProps> = ({
  currentPayload,
  onPayloadChange,
  disabled = false,
}) => {
  const [amount, setAmount] = useState(currentPayload.amount);
  const [currency, setCurrency] = useState(currentPayload.currency);
  const [description, setDescription] = useState(currentPayload.description);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [lastParsed, setLastParsed] = useState<ParseIntentResponse | null>(null);

  const handleApplyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setAmount(preset.amount);
    setCurrency(preset.currency);
    setDescription(preset.description);
    setErrorMsg(null);
    setClarificationQuestion(null);
    setLastParsed(null);
    onPayloadChange({
      amount: preset.amount,
      currency: preset.currency,
      description: preset.description,
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    setErrorMsg(null);
    onPayloadChange({
      amount: val,
      currency,
      description,
    });
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrency(val);
    onPayloadChange({
      amount,
      currency: val,
      description,
    });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);
    onPayloadChange({
      amount,
      currency,
      description: val,
    });
  };

  const handleParsePrompt = async () => {
    const trimmed = agentPrompt.trim();
    if (!trimmed || isLoading || disabled) return;

    setIsLoading(true);
    setErrorMsg(null);
    setClarificationQuestion(null);
    setLastParsed(null);

    try {
      const response = await api.parsePaymentPrompt(trimmed);
      setLastParsed(response);

      if (response.needs_clarification) {
        // If clarification is needed, display question and DO NOT overwrite payment form with invented defaults.
        setClarificationQuestion(
          response.clarification_question ||
            'Payment details are incomplete or ambiguous. Please specify the exact amount and currency.'
        );
      } else {
        // If parsing succeeds, populate the existing amount, currency, and description fields
        const newAmount = response.amount || amount;
        const newCurrency = response.currency || currency;
        const newDesc = response.description || description;

        if (response.amount) setAmount(response.amount);
        if (response.currency) setCurrency(response.currency);
        if (response.description) setDescription(response.description);

        onPayloadChange({
          amount: newAmount,
          currency: newCurrency,
          description: newDesc,
        });
      }
    } catch (err: any) {
      console.error('Failed to parse payment prompt:', err);
      const message =
        err?.message ||
        'Unable to parse payment prompt. Please verify your backend and network connection.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Approximate PayPal Sandbox fee calculation for display
  const numericAmount = parseFloat(amount) || 0;
  const estimatedFee = (numericAmount * 0.0349 + 0.49).toFixed(2);
  const estimatedNet = Math.max(0, numericAmount - parseFloat(estimatedFee)).toFixed(2);

  return (
    <div className="glass-panel payment-request-card">
      <div className="card-header">
        <div className="header-icon-box ai-icon-box">
          <Bot size={20} className="icon-ai" />
        </div>
        <div>
          <h2 className="card-title">AI Payment Request</h2>
          <p className="card-subtitle">
            Configure transaction parameters or query the PayPilot intelligent prompt assistant
          </p>
        </div>
      </div>

      {/* AI Prompt Assistant Bar */}
      <div className="ai-prompt-box">
        <div className="ai-prompt-label">
          <Sparkles size={14} className="sparkle-icon" />
          <span>PayPilot AI Copilot (Gemini Natural Language Parser)</span>
        </div>
        <div className="ai-input-row">
          <input
            id="ai-prompt-input"
            type="text"
            className="ai-prompt-input"
            placeholder="e.g. 'Pay $25 for autonomous cloud inference tokens'"
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleParsePrompt();
              }
            }}
            disabled={disabled || isLoading}
          />
          <button
            id="ai-parse-button"
            type="button"
            className="ai-prompt-button"
            onClick={handleParsePrompt}
            disabled={disabled || !agentPrompt.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw size={15} className="spinner" />
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Parse</span>
              </>
            )}
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="ai-status-notice ai-status-loading">
            <RefreshCw size={14} className="spinner" />
            <span>Analyzing financial intent with Google Gemini Flash...</span>
          </div>
        )}

        {/* Clarification Needed Notice */}
        {clarificationQuestion && (
          <div className="ai-status-notice ai-status-clarification">
            <div className="ai-notice-header">
              <HelpCircle size={16} className="notice-icon warning-icon" />
              <strong>Clarification Needed</strong>
            </div>
            <p className="ai-notice-message">{clarificationQuestion}</p>
            {lastParsed?.explanation && (
              <span className="ai-notice-subtext">{lastParsed.explanation}</span>
            )}
          </div>
        )}

        {/* AI Intent Extraction Success Banner */}
        {!clarificationQuestion && lastParsed && !lastParsed.needs_clarification && (
          <div className="ai-status-notice ai-status-success">
            <div className="ai-notice-header">
              <CheckCircle2 size={16} className="notice-icon success-icon" />
              <span className="ai-intent-pill">{lastParsed.intent}</span>
              <span className="ai-extracted-value">
                {lastParsed.currency} {lastParsed.amount}
              </span>
            </div>
            {lastParsed.explanation && (
              <p className="ai-notice-message">{lastParsed.explanation}</p>
            )}
          </div>
        )}

        {/* Parser Error Banner */}
        {errorMsg && (
          <div className="ai-status-notice ai-status-error">
            <div className="ai-notice-header">
              <AlertCircle size={16} className="notice-icon error-icon" />
              <strong>AI Parsing Notice</strong>
              <button
                type="button"
                className="ai-notice-dismiss"
                onClick={() => setErrorMsg(null)}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            <p className="ai-notice-message">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Presets Grid */}
      <div className="presets-section">
        <span className="section-label">
          <Layers size={13} /> Quick Hackathon Scenarios
        </span>
        <div className="presets-grid">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className={`preset-chip ${
                amount === preset.amount && currency === preset.currency ? 'active' : ''
              }`}
              onClick={() => handleApplyPreset(preset)}
              disabled={disabled}
            >
              <div className="preset-top">
                <span className="preset-title">{preset.title}</span>
                <span className="preset-tag">{preset.category}</span>
              </div>
              <div className="preset-bottom">
                <span className="preset-price">
                  {preset.currency} {preset.amount}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Structured Payment Form */}
      <div className="form-grid">
        {/* Amount Field */}
        <div className="form-group amount-group">
          <label htmlFor="amount-input" className="form-label">
            Payment Amount
          </label>
          <div className="input-with-icon">
            <DollarSign size={17} className="input-icon" />
            <input
              id="amount-input"
              type="number"
              step="0.01"
              min="0.01"
              max="100000"
              className="text-input font-mono"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Currency Field */}
        <div className="form-group currency-group">
          <label htmlFor="currency-select" className="form-label">
            Currency (Default: USD)
          </label>
          <select
            id="currency-select"
            className="select-input font-mono"
            value={currency}
            onChange={handleCurrencyChange}
            disabled={disabled}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description Field */}
        <div className="form-group description-group">
          <label htmlFor="description-input" className="form-label">
            Payment Description
          </label>
          <textarea
            id="description-input"
            rows={2}
            maxLength={127}
            className="textarea-input"
            placeholder="Describe payment or purpose..."
            value={description}
            onChange={handleDescriptionChange}
            disabled={disabled}
          />
          <div className="field-hint">
            <span>Passes directly into PayPal purchase units</span>
            <span>{description.length}/127</span>
          </div>
        </div>
      </div>

      {/* Financial Summary Breakdown */}
      <div className="financial-breakdown">
        <div className="breakdown-row">
          <span className="breakdown-label">Transaction Subtotal</span>
          <span className="breakdown-val font-mono">
            {currency} {numericAmount.toFixed(2)}
          </span>
        </div>
        <div className="breakdown-row text-muted">
          <span className="breakdown-label">Est. PayPal Processing Fee</span>
          <span className="breakdown-val font-mono">
            ~ {currency} {estimatedFee}
          </span>
        </div>
        <div className="breakdown-row text-muted">
          <span className="breakdown-label">Est. Net Settlement</span>
          <span className="breakdown-val font-mono text-success">
            ~ {currency} {estimatedNet}
          </span>
        </div>
        <div className="breakdown-divider"></div>
        <div className="breakdown-row total-row">
          <span className="breakdown-label">Total to Authorize</span>
          <span className="breakdown-val total-val font-mono">
            {currency} {numericAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {errorMsg && <div className="form-error-banner">{errorMsg}</div>}
    </div>
  );
};
