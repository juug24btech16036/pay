import type {
  BackendHealthResponse,
  CaptureOrderResponse,
  ClientIdResponse,
  CreateOrderPayload,
  CreateOrderResponse,
  TransactionRecord,
  ParseIntentResponse,
} from '../types';

// Use relative API path when served through Vite proxy, or custom env if specified
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    if (typeof data === 'object' && data !== null) {
      if (data.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (typeof data.detail === 'object' && data.detail.error) {
          message = data.detail.error;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data.message) {
        message = data.message;
      }
    }
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  /**
   * Check backend health and PayPal configuration status
   */
  async getHealth(): Promise<BackendHealthResponse> {
    const response = await fetch(`${API_BASE}/health`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<BackendHealthResponse>(response);
  },

  /**
   * Fetch PayPal Sandbox Client ID (Never exposes secret)
   */
  async getClientId(): Promise<ClientIdResponse> {
    const response = await fetch(`${API_BASE}/api/paypal/client-id`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<ClientIdResponse>(response);
  },

  /**
   * Create PayPal Order via Backend REST API
   */
  async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    const response = await fetch(`${API_BASE}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<CreateOrderResponse>(response);
  },

  /**
   * Capture PayPal Order via Backend REST API after buyer approval
   */
  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    const response = await fetch(`${API_BASE}/api/paypal/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ order_id: orderId }),
    });
    return handleResponse<CaptureOrderResponse>(response);
  },

  /**
   * Look up PayPal Order details
   */
  async getOrder(orderId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/api/paypal/order/${encodeURIComponent(orderId)}`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<any>(response);
  },

  /**
   * Fetch recent captured transactions from backend store
   */
  async getTransactions(): Promise<TransactionRecord[]> {
    const response = await fetch(`${API_BASE}/api/paypal/transactions`, {
      headers: { Accept: 'application/json' },
    });
    return handleResponse<TransactionRecord[]>(response);
  },

  /**
   * Parse natural-language payment prompt using Gemini Flash via FastAPI backend
   */
  async parsePaymentPrompt(prompt: string): Promise<ParseIntentResponse> {
    const response = await fetch(`${API_BASE}/api/ai/parse-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    return handleResponse<ParseIntentResponse>(response);
  },
};

/**
 * Standalone parsePaymentPrompt helper function
 */
export async function parsePaymentPrompt(prompt: string): Promise<ParseIntentResponse> {
  return api.parsePaymentPrompt(prompt);
}
