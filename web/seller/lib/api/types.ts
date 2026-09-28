export interface Money {
  currency: string;
  amount: number;
}

export interface Store {
  id: string;
  seller_id: string;
  market_code: string;
  code: string;
  name: string;
  status: 'draft' | 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface SellerStoreListResponse {
  items: Store[];
  active_store_limit: number;
  active_store_count: number;
}

export interface Product {
  id: string;
  store_id?: string;
  source: 'seller_owned' | 'supplier_backed';
  slug: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  category_id?: string;
  supplier_id?: string;
  supplier_code?: string;
  supplier_name?: string;
  created_at: string;
  updated_at: string;
}

export interface SellerListing {
  id: string;
  store_id: string;
  product_id: string;
  supplier_offer_id?: string;
  market_code: string;
  status: 'draft' | 'published' | 'unpublished' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SupplierCatalogItem {
  offer_id: string;
  offer_status: string;
  market_code: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  product_status: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  category_id?: string;
  category_name?: string;
  price?: Money;
  minimum_order_quantity?: number;
  sku_id?: string;
  sku_code?: string;
  primary_media_id?: string;
  primary_media_uri?: string;
  is_available?: boolean;
  available_qty?: number;
  fulfillment_count: number;
  updated_at: string;
}

export interface StructuredReadinessReason {
  code: string;
  message: string;
}

export interface StructuredPublishReadiness {
  is_ready: boolean;
  reasons: StructuredReadinessReason[];
}

export interface StoreMediaAsset {
  id: string;
  store_id: string;
  checksum_sha256: string;
  content_type: string;
  byte_size: number;
  original_filename: string;
  status: 'ready' | 'deleting' | 'deleted';
  url: string;
  created_at: string;
}

export interface ProductMediaReference {
  id: string;
  store_id: string;
  product_id: string;
  asset_id: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
  url: string;
  created_at: string;
}

export interface MediaPresignResponse {
  mode: 'upload' | 'reuse';
  intent_id?: string;
  upload_url?: string;
  upload_token?: string;
  required_headers?: Record<string, string>;
  expires_at?: string;
  asset?: StoreMediaAsset;
}

export interface InventorySnapshot {
  id: string;
  fulfillment_location_id: string;
  location_name?: string;
  sku_id: string;
  sku_code?: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  version: number;
  updated_at: string;
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  order_item_id: string;
  quantity: number;
  created_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  notes?: string;
  occurred_at: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  fulfillment_location_id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  tracking_number?: string;
  shipping_cost_minor: number;
  cod_amount_minor: number;
  currency: string;
  items: ShipmentItem[];
  events?: ShipmentEvent[];
  created_at: string;
  updated_at: string;
}

export interface CreateShipmentPayload {
  fulfillment_location_id: string;
  tracking_number?: string;
  shipping_cost_minor: number;
  cod_amount_minor: number;
  currency: string;
  items: Array<{
    order_item_id: string;
    quantity: number;
  }>;
}

export interface UpdateShipmentStatusPayload {
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  tracking_number?: string;
  notes?: string;
}

export interface PaymentAttempt {
  id: string;
  payment_id: string;
  provider: string;
  provider_reference?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount_minor: number;
  currency: string;
  payment_method: string;
  status: 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  attempts?: PaymentAttempt[];
  created_at: string;
  updated_at: string;
}

export interface InitializePaymentPayload {
  amount_minor: number;
  currency: string;
  payment_method: string;
  provider?: string;
  provider_reference?: string;
}

export interface UpdatePaymentStatusPayload {
  status: 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  provider?: string;
  provider_reference?: string;
  error_message?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface StoreBalance {
  available_minor: number;
  pending_minor: number;
  currency: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount_minor: number;
  credit_amount_minor: number;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  reference_type: string;
  reference_id: string;
  description?: string;
  currency: string;
  posted_at: string;
  created_at: string;
  lines?: JournalLine[];
}

export interface Settlement {
  id: string;
  settlement_period_id: string;
  account_id: string;
  currency: string;
  gross_amount_minor: number;
  adjustment_amount_minor: number;
  net_amount_minor: number;
  status: string;
  created_at: string;
  calculated_at?: string;
  finalized_at?: string;
}

export interface Payout {
  id: string;
  store_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  payout_method: string;
  reference?: string;
  created_at: string;
}

export interface IntegrationConnection {
  id: string;
  actor_type: string;
  actor_id: string;
  provider: 'salla' | 'shopify' | 'woocommerce' | 'easyorders' | 'custom_api';
  name: string;
  status: 'active' | 'paused' | 'error' | 'disconnected';
  credentials_vault_ref?: string;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExternalEntityMapping {
  id: string;
  connection_id: string;
  entity_type: 'product' | 'variant' | 'inventory' | 'order' | 'fulfillment' | 'customer';
  internal_id: string;
  external_id: string;
  external_version?: string;
  mapping_status: 'synced' | 'pending' | 'conflict' | 'error';
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  conflict_status?: string;
  metadata?: Record<string, unknown>;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface SellerSyncJob {
  id: string;
  store_id: string;
  connection_id: string;
  sync_type: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_summary?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  actor_type: string;
  actor_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  expires_at?: string;
  created_at: string;
  updated_at: string;
  raw_key?: string;
}

export interface WebhookSubscription {
  id: string;
  actor_type: string;
  actor_id: string;
  target_url: string;
  subscribed_events: string[];
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
  raw_secret?: string;
}



