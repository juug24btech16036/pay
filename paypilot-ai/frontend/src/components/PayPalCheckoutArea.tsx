import React, { useState, useMemo } from 'react';
import {
  PayPalScriptProvider,
  PayPalButtons,
} from '@paypal/react-paypal-js';
import type { ReactPayPalScriptOptions } from '@paypal/react-paypal-js';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  CaptureOrderResponse,
  ClientIdResponse,
  CreateOrderPayload,
} from '../types';

interface PayPalCheckoutAreaProps {
  payload: CreateOrderPayload;
  clientIdInfo: ClientIdResponse | null;
  onSuccess: (captureData: CaptureOrderResponse) => void;
  onError: (errorMessage: string) => void;
  onOpenConfigModal: () => void;
}

export const PayPalCheckoutArea: React.FC<PayPalCheckoutAreaProps> = ({
  payload,
  clientIdInfo,
  onSuccess,
  onError,
  onOpenConfigModal,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const isConfigured = !!clientIdInfo?.is_configured && !!clientIdInfo?.client_id;

  // Memoize SDK options to avoid unnecessary script re-loads
  const scriptOptions: ReactPayPalScriptOptions = useMemo(
    () => ({
      clientId: clientIdInfo?.client_id || '',
      currency: payload.currency || 'USD',
      intent: 'capture',
      components: 'buttons',
      environment: (clientIdInfo?.environment === 'sandbox' ? 'sandbox' : undefined) as 'sandbox' | undefined,
    }),
    [clientIdInfo?.client_id, clientIdInfo?.environment, payload.currency]
  );

  // Handle PayPal SDK createOrder - calls our backend REST endpoint
  const handleCreateOrder = async (): Promise<string> => {
    try {
      setIsCreating(true);
      setInternalError(null);

      const response = await api.createOrder({
        amount: payload.amount,
        currency: payload.currency,
        description: payload.description,
      });

      if (!response.id) {
        throw new Error('PayPal order was created but no order ID was returned.');
      }

      return response.id;
    } catch (err: any) {
      const msg = err.message || 'Failed to initialize order with PayPal Sandbox';
      setInternalError(msg);
      onError(msg);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  // Handle PayPal SDK onApprove - captures the order via our backend REST endpoint
  const handleApprove = async (data: any): Promise<void> => {
    try {
      setIsCapturing(true);
      setInternalError(null);

      const orderId = data.orderID;
      if (!orderId) {
        throw new Error('No PayPal Order ID provided in approval callback.');
      }

      // Call our backend to perform the actual capture via PayPal REST API
      const captureResult = await api.captureOrder(orderId);

      // Verify actual status from PayPal API response
      if (captureResult.status === 'COMPLETED') {
        onSuccess(captureResult);
      } else {
        const errorMsg = `PayPal Order capture status is '${captureResult.status}' instead of 'COMPLETED'.`;
        setInternalError(errorMsg);
        onError(errorMsg);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to capture PayPal order';
      setInternalError(msg);
      onError(msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCancel = (data: any) => {
    console.info('PayPal Checkout cancelled by buyer:', data);
    setInternalError('Buyer cancelled the PayPal Checkout window.');
    setIsCreating(false);
    setIsCapturing(false);
  };

  const handleError = (error: Record<string, unknown>) => {
    console.error('PayPal Buttons SDK Error:', error);
    const msg =
      'PayPal Checkout encountered an error. Please verify your Sandbox account credentials and network connection.';
    setInternalError(msg);
    onError(msg);
    setIsCreating(false);
    setIsCapturing(false);
  };

  return (
    <div className="glass-panel checkout-area-card">
      <div className="card-header">
        <div className="header-icon-box paypal-icon-box">
          <Lock size={20} className="icon-paypal" />
        </div>
        <div>
          <h2 className="card-title">PayPal Sandbox Checkout</h2>
          <p className="card-subtitle">
            Authenticated via backend OAuth 2.0 • Zero client-side secret exposure
          </p>
        </div>
      </div>

      {/* Security Assurance Banner */}
      <div className="security-banner">
        <ShieldCheck size={16} className="security-icon" />
        <div className="security-text">
          <strong>Security Guarantee:</strong> Client Secret is isolated on the FastAPI
          backend. Order authorization runs against PayPal Sandbox REST v2 API.
        </div>
      </div>

      {/* Checkout Summary Card */}
      <div className="summary-pill-box">
        <div className="pill-left">
          <span className="pill-label">Ready to Checkout</span>
          <span className="pill-desc">{payload.description}</span>
        </div>
        <div className="pill-right">
          <span className="pill-amount font-mono">
            {payload.currency} {parseFloat(payload.amount || '0').toFixed(2)}
          </span>
        </div>
      </div>

      {/* PayPal SDK Area */}
      <div className="sdk-container">
        {!isConfigured ? (
          /* Unconfigured Onboarding State */
          <div className="unconfigured-box">
            <div className="unconfigured-header">
              <AlertTriangle size={24} className="warning-icon" />
              <h4>PayPal Sandbox Credentials Required</h4>
            </div>
            <p className="unconfigured-desc">
              Your backend needs a PayPal Sandbox Client ID and Client Secret to process live test
              transactions.
            </p>
            <div className="quick-steps">
              <div className="step-item">
                <span className="step-num">1</span>
                <span>
                  Log in to the{' '}
                  <a
                    href="https://developer.paypal.com/dashboard/applications/sandbox"
                    target="_blank"
                    rel="noreferrer"
                    className="external-link"
                  >
                    PayPal Developer Portal <ExternalLink size={12} />
                  </a>
                </span>
              </div>
              <div className="step-item">
                <span className="step-num">2</span>
                <span>Copy your Sandbox Client ID & Secret into <code>backend/.env</code></span>
              </div>
              <div className="step-item">
                <span className="step-num">3</span>
                <span>Restart backend or click Configure below</span>
              </div>
            </div>
            <button
              type="button"
              className="configure-now-btn"
              onClick={onOpenConfigModal}
            >
              <Settings size={15} />
              <span>View .env Setup Instructions</span>
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          /* Configured State: Render PayPal JavaScript SDK v5 Buttons */
          <div className="paypal-buttons-wrapper">
            {(isCreating || isCapturing) && (
              <div className="checkout-processing-overlay">
                <div className="spinner-large"></div>
                <span>
                  {isCapturing
                    ? 'Capturing payment with PayPal Sandbox...'
                    : 'Creating order with PayPal Sandbox...'}
                </span>
              </div>
            )}

            <PayPalScriptProvider
              key={`${clientIdInfo.client_id}-${payload.currency}`}
              options={scriptOptions}
            >
              <PayPalButtons
                style={{
                  layout: 'vertical',
                  color: 'gold',
                  shape: 'rect',
                  label: 'paypal',
                  height: 48,
                }}
                disabled={isCapturing}
                forceReRender={[payload.amount, payload.currency, clientIdInfo.client_id]}
                createOrder={handleCreateOrder}
                onApprove={handleApprove}
                onCancel={handleCancel}
                onError={handleError}
              />
            </PayPalScriptProvider>
          </div>
        )}
      </div>

      {internalError && (
        <div className="checkout-error-banner">
          <AlertTriangle size={16} />
          <span>{internalError}</span>
        </div>
      )}

      {/* SDK Version Architecture Note */}
      <div className="architecture-note">
        <span>Standard PayPal JS SDK v5 active • Ready for JS SDK v6 upgrade modularly</span>
      </div>
    </div>
  );
};
