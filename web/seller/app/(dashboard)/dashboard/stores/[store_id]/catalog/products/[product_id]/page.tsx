'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Archive, AlertCircle, Plus, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Product, ProductMediaReference, StoreMediaAsset, SellerListing } from '@/lib/api/types';

export default function StoreProductDetailPage({
  params
}: {
  params: Promise<{ store_id: string; product_id: string }>;
}) {
  const { store_id, product_id } = use(params);

  const [product, setProduct] = useState<Product | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [mediaAssets, setMediaAssets] = useState<StoreMediaAsset[]>([]);
  const [references, setReferences] = useState<ProductMediaReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      sellerApi.listStoreProducts(store_id),
      sellerApi.listStoreListings(store_id).catch(() => ({ items: [] })),
      sellerApi.listStoreMedia(store_id).catch(() => ({ items: [] }))
    ])
      .then(([prodRes, listRes, mediaRes]) => {
        if (!isMounted) return;
        const found = (prodRes.items || []).find((p) => p.id === product_id);
        setProduct(found || null);
        const prodListings = (listRes.items || []).filter((l) => l.product_id === product_id);
        setListings(prodListings);
        setMediaAssets(mediaRes.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [store_id, product_id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!product) return;
    setUpdatingStatus(true);
    try {
      const updated = await sellerApi.updateProductStatus(store_id, product_id, newStatus);
      setProduct(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update product status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!product) return;
    if (!confirm('Are you sure you want to archive this product? Listing must be unpublished first.')) return;
    setUpdatingStatus(true);
    try {
      const updated = await sellerApi.archiveProduct(store_id, product_id);
      setProduct(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to archive product');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAttachMedia = async () => {
    if (!selectedAssetId) return;
    setAttaching(true);
    try {
      const ref = await sellerApi.attachProductMedia(store_id, product_id, {
        asset_id: selectedAssetId,
        is_primary: references.length === 0
      });
      setReferences((prev) => [...prev, ref]);
      setSelectedAssetId('');
    } catch (err: any) {
      alert(err.message || 'Failed to attach media reference');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachMedia = async (refId: string) => {
    try {
      await sellerApi.detachProductMedia(store_id, product_id, refId);
      setReferences((prev) => prev.filter((r) => r.id !== refId));
    } catch (err: any) {
      alert(err.message || 'Failed to detach media reference');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Loading product details...</div>;
  }

  if (!product) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-sm text-slate-500">Product not found in this store context.</div>
        <Link href={`/dashboard/stores/${store_id}/catalog/products`} className="text-xs text-indigo-600 hover:underline">
          Back to Products Catalog
        </Link>
      </div>
    );
  }

  const matchingListing = listings.find((l) => l.product_id === product.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products`}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${
                  product.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : product.status === 'draft'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {product.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source: <span className="font-medium text-slate-700">{product.source}</span> · Slug:{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded">{product.slug}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchingListing && (
            <Link
              href={`/dashboard/stores/${store_id}/catalog/listings/${matchingListing.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Store Listing
            </Link>
          )}

          {product.source === 'seller_owned' && product.status === 'draft' && (
            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('active')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              Activate Product
            </button>
          )}

          {product.source === 'seller_owned' && product.status !== 'archived' && (
            <button
              type="button"
              disabled={updatingStatus}
              onClick={handleArchive}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Archive Product
            </button>
          )}
        </div>
      </div>

      {/* Product Information Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Product Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Product ID:</span>
            <div className="font-mono text-slate-800 mt-0.5">{product.id}</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Source Discriminator:</span>
            <div className="font-medium text-slate-800 mt-0.5">{product.source}</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Created At:</span>
            <div className="text-slate-800 mt-0.5">{new Date(product.created_at).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Last Updated:</span>
            <div className="text-slate-800 mt-0.5">{new Date(product.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Product Media References Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-semibold text-slate-900">Product Media References</h2>
          <Link href={`/dashboard/stores/${store_id}/media`} className="text-xs text-indigo-600 hover:underline">
            Upload to Media Library
          </Link>
        </div>

        {/* Attach Media Form */}
        <div className="flex items-center gap-2">
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none"
          >
            <option value="">Select an asset from store media library...</option>
            {mediaAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.original_filename} ({asset.checksum_sha256.substring(0, 8)}...)
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedAssetId || attaching}
            onClick={handleAttachMedia}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Attach Media
          </button>
        </div>

        {/* Attached References List */}
        {references.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-100">
            No media attached to this product yet. Select an asset above or upload to the store media library.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {references.map((ref) => (
              <div key={ref.id} className="relative p-2 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <div className="h-28 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                  {ref.url ? (
                    <img src={ref.url} alt={ref.alt_text || product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  {ref.is_primary ? (
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Primary</span>
                  ) : (
                    <span className="text-slate-500">Secondary</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDetachMedia(ref.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Detach reference"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
