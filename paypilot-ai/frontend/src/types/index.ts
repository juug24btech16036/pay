export interface ClientIdResponse {
  client_id: string;
  currency: string;
  environment: string;
  is_configured: boolean;
  instructions?: string;
}

export interface CreateOrderPayload {
  amount: string;
  currency: string;
  description: string;
  custom_id?: string;
}

export interface CreateOrderResponse {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
  currency: string;
  amount: string;
}

export interface CaptureOrderPayload {
  order_id: string;
}

export interface CaptureOrderResponse {
  id: string;
  status: string;
  capture_id?: string;
  amount?: string;
  currency?: string;
  payer_email?: string;
  payer_name?: string;
  create_time?: string;
  details: Record<string, any>;
}

export interface TransactionRecord {
  order_id: string;
  capture_id?: string;
  status: string;
  amount: string;
  currency: string;
  description: string;
  payer_email?: string;
  payer_name?: string;
  created_at: string;
  paypal_fee?: string;
  net_amount?: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  paypal_configured: boolean;
  gemini_configured?: boolean;
  environment: string;
  timestamp: string;
}

export interface ParseIntentRequest {
  prompt: string;
}

export interface ParseIntentResponse {
  amount?: string | null;
  currency?: string | null;
  description?: string | null;
  intent: string;
  needs_clarification: boolean;
  clarification_question?: string | null;
  explanation: string;
}

export type TransactionStep = 'idle' | 'creating' | 'ready' | 'approving' | 'captured' | 'failed';
