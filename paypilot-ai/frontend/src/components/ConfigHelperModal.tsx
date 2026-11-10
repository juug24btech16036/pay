import React, { useState } from 'react';
import {
  Key,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Info,
  Terminal,
} from 'lucide-react';

interface ConfigHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export const ConfigHelperModal: React.FC<ConfigHelperModalProps> = ({
  isOpen,
  onClose,
  isConfigured,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sampleEnvText = `# PayPilot AI - PayPal Sandbox Configuration
# Create backend/.env and paste these credentials:

PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
PAYPAL_CURRENCY_DEFAULT=USD
`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(sampleEnvText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content glass-panel config-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Key size={20} className="modal-key-icon" />
            <h3>PayPal Sandbox Configuration</h3>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="config-status-alert">
            <Info size={18} />
            <div>
              <strong>Current Status: </strong>
              {isConfigured ? (
                <span className="text-success font-semibold">
                  Configured & Active in Sandbox
                </span>
              ) : (
                <span className="text-warning font-semibold">
                  Awaiting Sandbox Credentials in backend/.env
                </span>
              )}
            </div>
          </div>

          <h4 className="config-subtitle">How to get your Sandbox Credentials:</h4>
          <ol className="config-steps-list">
            <li>
              Go to the official{' '}
              <a
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noreferrer"
                className="external-link"
              >
                PayPal Developer Dashboard <ExternalLink size={12} />
              </a>
            </li>
            <li>Select <strong>Apps & Credentials</strong> &rarr; <strong>Sandbox</strong> mode.</li>
            <li>Create or select an existing REST API App (e.g. <code>Default Application</code>).</li>
            <li>Copy your <strong>Client ID</strong> and <strong>Secret</strong>.</li>
            <li>
              Create a file named <code>backend/.env</code> (or copy from <code>backend/.env.example</code>).
            </li>
            <li>Paste your credentials and restart the backend server.</li>
          </ol>

          <div className="env-snippet-container">
            <div className="env-snippet-header">
              <span className="snippet-title">
                <Terminal size={14} /> backend/.env template
              </span>
              <button
                type="button"
                className="copy-snippet-btn"
                onClick={handleCopyEnv}
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-success" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Template</span>
                  </>
                )}
              </button>
            </div>
            <pre className="env-snippet font-mono">{sampleEnvText}</pre>
          </div>

          <div className="security-reminder-box">
            <ShieldAlert size={16} className="shield-alert-icon" />
            <p>
              <strong>Security reminder:</strong> Never commit your <code>.env</code> file or client secret to GitHub. The PayPilot architecture keeps the secret strictly in Python backend memory and never passes it to the frontend bundle.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
