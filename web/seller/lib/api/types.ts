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

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
