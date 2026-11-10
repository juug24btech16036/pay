import React, { useState } from 'react';
import {
  History,
  RefreshCw,
  CheckCircle2,
  Clock,
  Shield,
} from 'lucide-react';
import type { TransactionRecord } from '../types';

interface RecentTransactionsProps {
  transactions: TransactionRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  isLoading,
  onRefresh,
}) => {
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-panel recent-transactions-card">
      <div className="card-header space-between">
        <div className="header-icon-title">
          <div className="header-icon-box history-icon-box">
            <History size={20} className="icon-history" />
          </div>
          <div>
            <h2 className="card-title">Recent Transactions</h2>
            <p className="card-subtitle">
              Verified sandbox captures processed through PayPilot AI backend
            </p>
          </div>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh transaction list"
        >
          <RefreshCw size={15} className={isLoading ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-transactions-box">
          <div className="empty-icon-circle">
            <Clock size={28} className="empty-icon" />
          </div>
          <h4 className="empty-title">No Sandbox Transactions Yet</h4>
          <p className="empty-desc">
            Complete a checkout using the PayPal Sandbox buttons above to see real captured
            transactions registered here in real time.
          </p>
        </div>
      ) : (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Description</th>
                <th>Order ID</th>
                <th>Capture ID</th>
                <th>Payer</th>
                <th>Time</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.order_id}
                  className="tx-row"
                  onClick={() => setSelectedTx(tx)}
                  title="Click to view details"
                >
                  <td>
                    <span className="badge badge-success">
                      <CheckCircle2 size={12} />
                      <span>{tx.status}</span>
                    </span>
                  </td>
                  <td className="tx-description-cell">
                    <span className="tx-desc-text">{tx.description}</span>
                  </td>
                  <td className="font-mono text-muted tx-id-cell">
                    {tx.order_id.slice(0, 10)}...
                  </td>
                  <td className="font-mono text-muted tx-id-cell">
                    {tx.capture_id ? `${tx.capture_id.slice(0, 10)}...` : 'N/A'}
                  </td>
                  <td className="text-muted tx-payer-cell">
                    {tx.payer_email || tx.payer_name || 'Sandbox Buyer'}
                  </td>
                  <td className="text-muted tx-time-cell">
                    {formatDate(tx.created_at)}
                  </td>
                  <td className="text-right font-mono tx-amount-cell">
                    <span className="tx-amount-text">
                      {tx.currency} {parseFloat(tx.amount).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Transaction Details Modal */}
      {selectedTx && (
        <div className="modal-backdrop" onClick={() => setSelectedTx(null)}>
          <div
            className="modal-content glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <Shield size={18} className="modal-shield-icon" />
                <h3>PayPal Transaction Record</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setSelectedTx(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-detail-row">
                <span className="modal-label">Status:</span>
                <span className="badge badge-success">{selectedTx.status}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">Amount:</span>
                <span className="modal-value font-mono font-bold">
                  {selectedTx.currency} {selectedTx.amount}
                </span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">Description:</span>
                <span className="modal-value">{selectedTx.description}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">PayPal Order ID:</span>
                <span className="modal-value font-mono">{selectedTx.order_id}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">Capture ID:</span>
                <span className="modal-value font-mono">
                  {selectedTx.capture_id || 'N/A'}
                </span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">Payer:</span>
                <span className="modal-value">
                  {selectedTx.payer_email || selectedTx.payer_name || 'N/A'}
                </span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-label">Recorded At:</span>
                <span className="modal-value font-mono">
                  {formatDate(selectedTx.created_at)}
                </span>
              </div>
              {selectedTx.paypal_fee && (
                <div className="modal-detail-row">
                  <span className="modal-label">PayPal Fee:</span>
                  <span className="modal-value font-mono text-muted">
                    {selectedTx.paypal_fee}
                  </span>
                </div>
              )}
              {selectedTx.net_amount && (
                <div className="modal-detail-row">
                  <span className="modal-label">Net Settlement:</span>
                  <span className="modal-value font-mono text-success">
                    {selectedTx.net_amount}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedTx(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
