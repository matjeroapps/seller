/** Minor-unit money. Core emits `amount_minor`; some seller-api DTOs emit `amount`. Use lib/money helpers. */
export interface Money {
  currency: string;
  amount?: number;
  amount_minor?: number;
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

export interface StoreOperationalState {
  store_id: string;
  checkout_status: 'accepting' | 'paused' | string;
  maintenance_message: string;
  updated_by?: string;
  updated_at?: string;
  checkout_accepting: boolean;
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

export interface SellerCategory {
  id: string;
  slug: string;
  status: string;
}

// Store-scoped category (seller-managed). A flat tree node: the hierarchy is
// assembled client-side from parent_category_id. The English name is always
// present; Arabic falls back to English where missing.
export type CategoryStatus = 'active' | 'inactive' | 'archived';

export interface StoreCategoryTranslation {
  name: string;
  description: string;
}

export interface StoreCategory {
  id: string;
  store_id: string;
  parent_category_id: string | null;
  slug: string;
  status: CategoryStatus;
  sort_order: number;
  translations: Record<string, StoreCategoryTranslation>;
  product_count: number;
  child_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoreCategoryRef {
  id: string;
  slug: string;
  status: string;
  name: string;
  name_ar?: string;
}

export interface StoreCategoryInput {
  slug: string;
  parent_category_id?: string | null;
  sort_order?: number;
  translations: Record<string, StoreCategoryTranslation>;
}

export interface StoreCategoryUpdateInput {
  slug?: string;
  parent_category_id?: string | null;
  clear_parent?: boolean;
  sort_order?: number;
  translations?: Record<string, StoreCategoryTranslation>;
}

export interface StoreCategoryReorderEntry {
  id: string;
  sort_order: number;
}

export interface ProductTranslation {
  locale: string;
  name: string;
  description: string;
  meta_title?: string;
  meta_description?: string;
}

export interface VariantAttributeValueDetail {
  id: string;
  attribute_id: string;
  attribute_name: string;
  attribute_code: string;
  value_id: string;
  value_name: string;
  value_code: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  code: string;
  status: 'draft' | 'active' | 'inactive' | 'archived' | string;
  attribute_values?: VariantAttributeValueDetail[];
  sku?: ProductSku;
  created_at: string;
  updated_at: string;
}

export interface ProductSku {
  id: string;
  variant_id: string;
  code: string;
  barcode?: string;
  status: 'draft' | 'active' | 'inactive' | 'archived' | string;
  weight_grams?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  price_minor_units?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductVariantPayload {
  code: string;
  status: 'draft' | 'active' | 'inactive' | 'archived' | string;
  sku_code?: string;
  barcode?: string;
  attribute_values?: Array<{
    attribute_id: string;
    attribute_value_id: string;
  }>;
  weight_grams?: number;
  dimensions?: {
    length_mm?: number;
    width_mm?: number;
    height_mm?: number;
  };
  price_minor_units?: number;
}

export interface InventorySummary {
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  locations: Array<{
    location_id: string;
    location_name: string;
    sku_id: string;
    on_hand_qty: number;
    reserved_qty: number;
    available_qty: number;
  }>;
}

export interface PublishReadiness {
  is_ready: boolean;
  reasons: string[];
}

export interface ProductPageSection {
  id: string;
  type: string;
  enabled: boolean;
  sort_order: number;
  content: Record<string, unknown>;
}

export interface SellerListingPresentation {
  seller_listing_id: string;
  schema_version: number;
  purchase_behavior: string;
  sections: ProductPageSection[];
  created_at: string;
  updated_at: string;
}

export interface SellerProductDetail {
  product: Omit<Product, 'store_id' | 'source' | 'name'>;
  source: Product['source'];
  translations: ProductTranslation[];
  category_ids: string[];
  store_category_ids: string[];
  store_categories: StoreCategoryRef[];
  variants: ProductVariant[];
  skus: ProductSku[];
  media: Array<{
    id: string;
    product_id: string;
    media_type: string;
    uri: string;
    storage_key?: string;
    alt_text: string;
    sort_order: number;
    is_primary: boolean;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
  listing: SellerListing;
  current_price?: Money | null;
  inventory_summary: InventorySummary;
  presentation: SellerListingPresentation;
  purchase_behavior: string;
  publish_readiness: PublishReadiness;
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

export interface ListingPriceUpdateRequest {
  currency: string;
  amount_minor: number;
  retail_price_minor_units?: number;
  allow_sub_wholesale?: boolean;
  audit_reason?: string;
}

export interface SupplierOfferImportParams {
  markup_percentage?: number;
  retail_price_minor_units?: number;
  shipping_subsidy_minor_units?: number;
  shipping_subsidy_policy?: string;
}

export interface ImportedOfferResult {
  id: string;
  listing_id: string;
  store_id: string;
  product_id: string;
  supplier_offer_id?: string;
  retail_price_minor_units: number;
  wholesale_price_minor_units: number;
  currency: string;
  margin_percentage: number;
  status: string;
  created_at: string;
}

export interface SellerListingLifecycle {
  listing_id: string;
  store_id: string;
  status: 'draft' | 'published' | 'unpublished' | 'archived';
  effective_availability: 'available' | 'out_of_stock' | 'upstream_unavailable' | string;
  is_upstream_available: boolean;
  supplier_offer_id?: string;
  supplier_offer_status?: string;
  has_margin_warning: boolean;
  current_retail_price?: Money;
  upstream_wholesale_price?: Money;
  last_synced_at: string;
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
  updated_at?: string;
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

export interface StoreLocation {
  id: string;
  store_id?: string;
  code: string;
  name: string;
  location_type: string;
  status: string;
  created_at?: string;
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

export interface InventoryAdjustmentPayload {
  fulfillment_location_id: string;
  sku_id: string;
  qty_delta?: number;
  target_qty?: number;
  reason_code: 'damaged' | 'received_stock' | 'cycle_count_reconciliation' | 'theft_loss' | 'customer_return_manual' | 'correction' | string;
  note?: string;
  idempotency_key?: string;
}

export interface InventoryAdjustmentResponse {
  snapshot_id: string;
  fulfillment_location_id: string;
  sku_id: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  quantity_delta: number;
  movement_id: string;
  reason_code: string;
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
  carrier_name?: string;
  tracking_number?: string;
  shipping_cost_minor: number;
  cod_amount_minor: number;
  currency: string;
  items: ShipmentItem[];
  events?: ShipmentEvent[];
  created_at: string;
  updated_at: string;
}

export interface StoreShipmentsResponse {
  items: Shipment[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface CreateShipmentPayload {
  fulfillment_location_id: string;
  carrier_name?: string;
  tracking_number?: string;
  shipping_cost_minor: number;
  cod_amount_minor: number;
  currency: string;
  items: Array<{
    order_item_id: string;
    quantity: number;
  }>;
}

export interface CreateStoreShipmentPayload extends CreateShipmentPayload {
  order_id: string;
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

export interface Theme {
  id?: string;
  key: string;
  name: string;
  version?: string;
  description?: string;
  type?: 'free' | 'premium' | string;
  status?: 'draft' | 'active' | 'deprecated' | 'disabled' | string;
}

export interface ThemeVersion {
  id: string;
  theme_id: string;
  version: string;
  status: 'draft' | 'published' | 'deprecated' | string;
  configuration_schema: Record<string, unknown>;
  default_configuration: Record<string, unknown>;
  component_registry_version?: string;
}

export interface ThemeInstallation {
  id: string;
  store_id: string;
  theme_id?: string;
  theme_key: string;
  version: string;
  status: 'active' | 'inactive' | string;
}

export interface ThemeInstallationResponse {
  installation: ThemeInstallation;
  draft_config?: Record<string, unknown>;
  published_config?: Record<string, unknown>;
  draft_revision: number;
  published_revision: number;
}

export interface ThemeDraftResponse {
  config: Record<string, unknown>;
  revision: number;
}

export interface ThemePublishResponse {
  published_revision: number;
}

export interface ThemePreviewResponse {
  token: string;
}

export interface SellerOrder {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total: number;
  item_count: number;
  recipient_name: string;
  confirmation_deadline_at?: string;
  created_at: string;
}

export interface SellerOrderItem {
  id: string;
  product_name: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  source: 'seller_owned' | 'supplier_backed' | string;
}

export interface SellerOrderTimelineEvent {
  id: string;
  type: string;
  detail: string;
  created_at: string;
}

export interface SellerOrderAddress {
  recipient_name?: string;
  phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country_code?: string;
}

export interface SellerOrderDetail {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  item_count: number;
  confirmation_deadline_at?: string;
  shipping_address?: SellerOrderAddress;
  contact_email?: string;
  items: SellerOrderItem[];
  timeline: SellerOrderTimelineEvent[];
  allowed_next_actions: string[];
  created_at: string;
  updated_at: string;
}

export interface SellerOrderListResponse {
  orders: SellerOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderTransitionPayload {
  target_status: string;
  reason?: string;
}

export interface SellerProfile {
  id: string;
  code?: string;
  email?: string;
  name: string;
  status?: string;
  phone?: string;
  avatar_url?: string;
  roles: string[];
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateSellerProfilePayload {
  name?: string;
  status?: string;
  phone?: string;
  settings?: Record<string, unknown>;
}
