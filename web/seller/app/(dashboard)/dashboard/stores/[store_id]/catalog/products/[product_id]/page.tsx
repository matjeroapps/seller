'use client';

import { useCallback, useEffect, useMemo, useState, use, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Package,
  Plus,
  Save,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { sellerApi } from '@/lib/api/client';
import { formatMoney } from '@/lib/money';
import type {
  Product,
  ProductMediaReference,
  ProductSku,
  ProductTranslation,
  ProductVariant,
  SellerProductDetail,
  StoreMediaAsset
} from '@/lib/api/types';

type TranslationForm = {
  enName: string;
  enDescription: string;
  arName: string;
  arDescription: string;
  slug: string;
};

type VariantEdit = {
  code: string;
  status: string;
};

type SkuEdit = {
  code: string;
  barcode: string;
  status: string;
};

const productStatusOptions = ['draft', 'active', 'archived'];
const catalogItemStatusOptions = ['draft', 'active', 'inactive', 'archived'];

function productFromDetail(detail: SellerProductDetail, storeId: string): Product {
  const translation = detail.translations.find((item) => item.locale === 'en') || detail.translations[0];
  return {
    id: detail.product.id,
    store_id: storeId,
    source: detail.source,
    slug: detail.product.slug,
    name: translation?.name || detail.product.slug || 'Unnamed product',
    status: detail.product.status as Product['status'],
    created_at: detail.product.created_at,
    updated_at: detail.product.updated_at
  };
}

function translationFor(detail: SellerProductDetail | null, locale: string): ProductTranslation {
  return (
    detail?.translations.find((item) => item.locale === locale) || {
      locale,
      name: '',
      description: ''
    }
  );
}

function buildTranslationForm(detail: SellerProductDetail): TranslationForm {
  const en = translationFor(detail, 'en');
  const ar = translationFor(detail, 'ar');
  return {
    enName: en.name,
    enDescription: en.description || '',
    arName: ar.name,
    arDescription: ar.description || '',
    slug: detail.product.slug
  };
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'draft'
        ? 'bg-amber-100 text-amber-800'
        : status === 'archived'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-indigo-100 text-indigo-800';

  return <span className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${tone}`}>{status}</span>;
}

export default function StoreProductDetailPage({
  params
}: {
  params: Promise<{ store_id: string; product_id: string }>;
}) {
  const { store_id, product_id } = use(params);

  const [detail, setDetail] = useState<SellerProductDetail | null>(null);
  const [mediaAssets, setMediaAssets] = useState<StoreMediaAsset[]>([]);
  const [references, setReferences] = useState<ProductMediaReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [form, setForm] = useState<TranslationForm>({
    enName: '',
    enDescription: '',
    arName: '',
    arDescription: '',
    slug: ''
  });
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEdit>>({});
  const [skuEdits, setSkuEdits] = useState<Record<string, SkuEdit>>({});
  const [newVariant, setNewVariant] = useState<VariantEdit>({ code: '', status: 'active' });
  const [newSkuByVariant, setNewSkuByVariant] = useState<Record<string, SkuEdit>>({});

  const product = useMemo(() => (detail ? productFromDetail(detail, store_id) : null), [detail, store_id]);

  const resetEditableState = useCallback((nextDetail: SellerProductDetail) => {
    setForm(buildTranslationForm(nextDetail));
    setVariantEdits(
      nextDetail.variants.reduce<Record<string, VariantEdit>>((acc, variant) => {
        acc[variant.id] = { code: variant.code, status: variant.status };
        return acc;
      }, {})
    );
    setSkuEdits(
      nextDetail.skus.reduce<Record<string, SkuEdit>>((acc, sku) => {
        acc[sku.id] = { code: sku.code, barcode: sku.barcode || '', status: sku.status };
        return acc;
      }, {})
    );
  }, []);

  const loadDetail = useCallback(async () => {
    setError(null);
    const [nextDetail, mediaRes, refsRes] = await Promise.all([
      sellerApi.getStoreProductDetail(store_id, product_id),
      sellerApi.listStoreMedia(store_id).catch(() => ({ items: [] })),
      sellerApi.listProductMediaReferences(store_id, product_id).catch(() => ({ items: [] }))
    ]);
    setDetail(nextDetail);
    setMediaAssets(mediaRes.items || []);
    setReferences(refsRes.items || []);
    resetEditableState(nextDetail);
  }, [product_id, resetEditableState, store_id]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    loadDetail()
      .catch((err: any) => {
        if (isMounted) setError(err.message || 'Failed to load product details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadDetail]);

  const skusByVariant = useMemo(() => {
    return (detail?.skus || []).reduce<Record<string, ProductSku[]>>((acc, sku) => {
      if (!acc[sku.variant_id]) acc[sku.variant_id] = [];
      acc[sku.variant_id].push(sku);
      return acc;
    }, {});
  }, [detail?.skus]);

  const canManageProduct = product?.source === 'seller_owned' && product.status !== 'archived';
  const listing = detail?.listing;

  const refreshAfterMutation = async (message: string) => {
    await loadDetail();
    setNotice(message);
  };

  const handleSaveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !canManageProduct) return;
    if (!form.enName.trim() || !form.slug.trim()) {
      setError('Product name and slug are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const translations: ProductTranslation[] = [
        {
          locale: 'en',
          name: form.enName.trim(),
          description: form.enDescription.trim()
        }
      ];
      if (form.arName.trim()) {
        translations.push({
          locale: 'ar',
          name: form.arName.trim(),
          description: form.arDescription.trim()
        });
      }

      const updated = await sellerApi.updateStoreProduct(store_id, product_id, {
        slug: form.slug.trim(),
        translations,
        category_ids: detail.category_ids || []
      });
      setDetail(updated);
      resetEditableState(updated);
      setNotice('Product details saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save product details');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!product || !canManageProduct) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.updateProductStatus(store_id, product_id, newStatus);
      await refreshAfterMutation(`Product status changed to ${newStatus}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to update product status');
    } finally {
      setWorking(false);
    }
  };

  const handleArchive = () => {
    if (!product || !canManageProduct) return;
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    if (!product || !canManageProduct) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.archiveProduct(store_id, product_id);
      setShowArchiveModal(false);
      await refreshAfterMutation('Product archived.');
    } catch (err: any) {
      setError(err.message || 'Failed to archive product');
    } finally {
      setWorking(false);
    }
  };

  const handleCreateVariant = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageProduct || !newVariant.code.trim()) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.createProductVariant(store_id, product_id, {
        code: newVariant.code.trim(),
        status: newVariant.status
      });
      setNewVariant({ code: '', status: 'active' });
      await refreshAfterMutation('Variant added.');
    } catch (err: any) {
      setError(err.message || 'Failed to add variant');
    } finally {
      setWorking(false);
    }
  };

  const handleSaveVariant = async (variant: ProductVariant) => {
    if (!canManageProduct) return;
    const edit = variantEdits[variant.id];
    if (!edit?.code.trim()) {
      setError('Variant code is required.');
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.updateProductVariant(store_id, product_id, variant.id, {
        code: edit.code.trim(),
        status: edit.status
      });
      await refreshAfterMutation('Variant updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update variant');
    } finally {
      setWorking(false);
    }
  };

  const handleCreateSku = async (variantID: string) => {
    if (!canManageProduct) return;
    const draft = newSkuByVariant[variantID] || { code: '', barcode: '', status: 'active' };
    if (!draft.code.trim()) {
      setError('SKU code is required.');
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.createProductSku(store_id, product_id, variantID, {
        code: draft.code.trim(),
        barcode: draft.barcode.trim() || undefined,
        status: draft.status
      });
      setNewSkuByVariant((prev) => ({ ...prev, [variantID]: { code: '', barcode: '', status: 'active' } }));
      await refreshAfterMutation('SKU added.');
    } catch (err: any) {
      setError(err.message || 'Failed to add SKU');
    } finally {
      setWorking(false);
    }
  };

  const handleSaveSku = async (variantID: string, sku: ProductSku) => {
    if (!canManageProduct) return;
    const edit = skuEdits[sku.id];
    if (!edit?.code.trim()) {
      setError('SKU code is required.');
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.updateProductSku(store_id, product_id, variantID, sku.id, {
        code: edit.code.trim(),
        barcode: edit.barcode.trim() || undefined,
        status: edit.status
      });
      await refreshAfterMutation('SKU updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update SKU');
    } finally {
      setWorking(false);
    }
  };

  const handleAttachMedia = async () => {
    if (!selectedAssetId || !canManageProduct) return;
    setAttaching(true);
    setError(null);
    setNotice(null);
    try {
      const ref = await sellerApi.attachProductMedia(store_id, product_id, {
        asset_id: selectedAssetId,
        is_primary: references.length === 0
      });
      setReferences((prev) => [...prev, ref]);
      setSelectedAssetId('');
      setNotice('Media attached.');
    } catch (err: any) {
      setError(err.message || 'Failed to attach media reference');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachMedia = async (refId: string) => {
    if (!canManageProduct) return;
    setError(null);
    setNotice(null);
    try {
      await sellerApi.detachProductMedia(store_id, product_id, refId);
      setReferences((prev) => prev.filter((ref) => ref.id !== refId));
      setNotice('Media detached.');
    } catch (err: any) {
      setError(err.message || 'Failed to detach media reference');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Loading product details...</div>;
  }

  if (!detail || !product) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-sm text-slate-500">{error || 'Product not found in this store context.'}</div>
        <Link href={`/dashboard/stores/${store_id}/catalog/products`} className="text-xs text-indigo-600 hover:underline">
          Back to Products Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products`}
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800"
            aria-label="Back to product catalog"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-950">{product.name}</h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Source: <span className="font-medium text-slate-700">{product.source}</span> · Slug:{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">{product.slug}</code>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {listing?.id && (
            <Link
              href={`/dashboard/stores/${store_id}/catalog/listings/${listing.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Store Listing
            </Link>
          )}

          {canManageProduct && (
            <select
              value={product.status}
              onChange={(event) => handleStatusChange(event.target.value)}
              disabled={working}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              aria-label="Change product status"
            >
              {productStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}

          {canManageProduct && (
            <button
              type="button"
              disabled={working}
              onClick={handleArchive}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" /> Archive / Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
            {listing?.status ? <StatusBadge status={listing.status} /> : 'No listing'}
          </div>
          <p className="mt-2 text-xs text-slate-500">ID: {listing?.id || '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {detail.publish_readiness?.is_ready ? 'Ready to publish' : 'Needs attention'}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {(detail.publish_readiness?.reasons || []).slice(0, 1).join(', ') || 'No readiness blockers reported.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {detail.inventory_summary?.total_available ?? 0} available
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {detail.inventory_summary?.total_on_hand ?? 0} on hand · {detail.inventory_summary?.total_reserved ?? 0} reserved
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current price</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {formatMoney(detail.current_price, "Not set")}
          </div>
          <p className="mt-2 text-xs text-slate-500">Created: {formatDate(product.created_at)}</p>
        </div>
      </section>

      <form onSubmit={handleSaveProduct} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Product content</h2>
            <p className="text-xs text-slate-500">Edit customer-facing title, description, slug, and localized copy.</p>
          </div>
          <button
            type="submit"
            disabled={!canManageProduct || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Product Details'}
          </button>
        </div>

        {!canManageProduct && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            This product cannot be edited because it is either supplier-backed or archived.
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">English title *</span>
            <input
              value={form.enName}
              onChange={(event) => setForm((prev) => ({ ...prev, enName: event.target.value }))}
              disabled={!canManageProduct}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Product slug *</span>
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              disabled={!canManageProduct}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-700">English description</span>
            <textarea
              value={form.enDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, enDescription: event.target.value }))}
              disabled={!canManageProduct}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Arabic title</span>
            <input
              value={form.arName}
              onChange={(event) => setForm((prev) => ({ ...prev, arName: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Category IDs</span>
            <input
              value={(detail.category_ids || []).join(', ') || 'No categories assigned'}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Arabic description</span>
            <textarea
              value={form.arDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, arDescription: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Variants & SKUs</h2>
            <p className="text-xs text-slate-500">
              Manage sellable product variants and their SKU records. At least one active variant with one active SKU is required for publishing.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {detail.variants.length} variants · {detail.skus.length} SKUs
          </div>
        </div>

        <form onSubmit={handleCreateVariant} className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_160px_auto]">
          <input
            value={newVariant.code}
            onChange={(event) => setNewVariant((prev) => ({ ...prev, code: event.target.value }))}
            disabled={!canManageProduct}
            placeholder="Variant code, e.g. default, color-red, size-xl"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          />
          <select
            value={newVariant.status}
            onChange={(event) => setNewVariant((prev) => ({ ...prev, status: event.target.value }))}
            disabled={!canManageProduct}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            {catalogItemStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!canManageProduct || working || !newVariant.code.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add Variant
          </button>
        </form>

        <div className="mt-5 space-y-4">
          {detail.variants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No variants yet. Add the default variant before publishing this product.
            </div>
          ) : (
            detail.variants.map((variant) => {
              const edit = variantEdits[variant.id] || { code: variant.code, status: variant.status };
              const skuDraft = newSkuByVariant[variant.id] || { code: '', barcode: '', status: 'active' };
              const variantSkus = skusByVariant[variant.id] || [];

              return (
                <div key={variant.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
                    <input
                      value={edit.code}
                      onChange={(event) =>
                        setVariantEdits((prev) => ({
                          ...prev,
                          [variant.id]: { ...edit, code: event.target.value }
                        }))
                      }
                      disabled={!canManageProduct}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                    <select
                      value={edit.status}
                      onChange={(event) =>
                        setVariantEdits((prev) => ({
                          ...prev,
                          [variant.id]: { ...edit, status: event.target.value }
                        }))
                      }
                      disabled={!canManageProduct}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      {catalogItemStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSaveVariant(variant)}
                      disabled={!canManageProduct || working}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save Variant
                    </button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">SKU code</th>
                          <th className="px-3 py-2 font-semibold">Barcode</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {variantSkus.map((sku) => {
                          const skuEdit = skuEdits[sku.id] || {
                            code: sku.code,
                            barcode: sku.barcode || '',
                            status: sku.status
                          };
                          return (
                            <tr key={sku.id}>
                              <td className="px-3 py-2">
                                <input
                                  value={skuEdit.code}
                                  onChange={(event) =>
                                    setSkuEdits((prev) => ({
                                      ...prev,
                                      [sku.id]: { ...skuEdit, code: event.target.value }
                                    }))
                                  }
                                  disabled={!canManageProduct}
                                  className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={skuEdit.barcode}
                                  onChange={(event) =>
                                    setSkuEdits((prev) => ({
                                      ...prev,
                                      [sku.id]: { ...skuEdit, barcode: event.target.value }
                                    }))
                                  }
                                  disabled={!canManageProduct}
                                  className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={skuEdit.status}
                                  onChange={(event) =>
                                    setSkuEdits((prev) => ({
                                      ...prev,
                                      [sku.id]: { ...skuEdit, status: event.target.value }
                                    }))
                                  }
                                  disabled={!canManageProduct}
                                  className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                                >
                                  {catalogItemStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSaveSku(variant.id, sku)}
                                  disabled={!canManageProduct || working}
                                  className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {variantSkus.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              No SKUs for this variant yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_140px_auto]">
                    <input
                      value={skuDraft.code}
                      onChange={(event) =>
                        setNewSkuByVariant((prev) => ({
                          ...prev,
                          [variant.id]: { ...skuDraft, code: event.target.value }
                        }))
                      }
                      disabled={!canManageProduct}
                      placeholder="New SKU code"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
                    />
                    <input
                      value={skuDraft.barcode}
                      onChange={(event) =>
                        setNewSkuByVariant((prev) => ({
                          ...prev,
                          [variant.id]: { ...skuDraft, barcode: event.target.value }
                        }))
                      }
                      disabled={!canManageProduct}
                      placeholder="Barcode (optional)"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
                    />
                    <select
                      value={skuDraft.status}
                      onChange={(event) =>
                        setNewSkuByVariant((prev) => ({
                          ...prev,
                          [variant.id]: { ...skuDraft, status: event.target.value }
                        }))
                      }
                      disabled={!canManageProduct}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
                    >
                      {catalogItemStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleCreateSku(variant.id)}
                      disabled={!canManageProduct || working || !skuDraft.code.trim()}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Add SKU
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-950">Product information</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
            <div>
              <span className="font-medium text-slate-500">Product ID</span>
              <div className="mt-1 font-mono text-slate-800">{product.id}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">Source discriminator</span>
              <div className="mt-1 font-semibold text-slate-800">{product.source}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">Created at</span>
              <div className="mt-1 text-slate-800">{formatDate(product.created_at)}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">Last updated</span>
              <div className="mt-1 text-slate-800">{formatDate(product.updated_at)}</div>
            </div>
          </div>

          {detail.publish_readiness?.reasons?.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold text-amber-900">Publish readiness blockers</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-800">
                {detail.publish_readiness.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-950">Inventory locations</h2>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 space-y-2">
            {(detail.inventory_summary?.locations || []).length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                No inventory snapshots linked to this product yet.
              </div>
            ) : (
              detail.inventory_summary.locations.map((location) => (
                <div key={`${location.location_id}-${location.sku_id}`} className="rounded-xl border border-slate-100 p-3 text-xs">
                  <div className="font-semibold text-slate-900">{location.location_name || location.location_id}</div>
                  <div className="mt-1 text-slate-500">
                    SKU {location.sku_id} · {location.available_qty} available · {location.reserved_qty} reserved
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Product media references</h2>
            <p className="mt-1 text-xs text-slate-500">Attach existing store media assets to this product.</p>
          </div>
          <Link href={`/dashboard/stores/${store_id}/media`} className="text-xs font-semibold text-indigo-600 hover:underline">
            Upload to Media Library
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedAssetId}
            onChange={(event) => setSelectedAssetId(event.target.value)}
            disabled={!canManageProduct}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
          >
            <option value="">Select an asset from store media library...</option>
            {mediaAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.original_filename || 'Media asset'}
                {asset.checksum_sha256 ? ` (${asset.checksum_sha256.substring(0, 8)}...)` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canManageProduct || !selectedAssetId || attaching}
            onClick={handleAttachMedia}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Attach Media
          </button>
        </div>

        {references.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
            No media attached to this product yet. Select an asset above or upload to the store media library.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {references.map((ref) => (
              <div key={ref.id} className="relative space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                  {ref.url ? (
                    <img src={ref.url} alt={ref.alt_text || product.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  {ref.is_primary ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">Primary</span>
                  ) : (
                    <span className="text-slate-500">Secondary</span>
                  )}
                  <button
                    type="button"
                    disabled={!canManageProduct}
                    onClick={() => handleDetachMedia(ref.id)}
                    className="p-1 text-red-600 hover:text-red-800 disabled:opacity-40"
                    title="Detach reference"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={showArchiveModal}
        title="Archive Product"
        description="Archive this product? It will be removed from active catalog management. Published listings may need to be unpublished first."
        confirmLabel="Archive Product"
        cancelLabel="Keep Product"
        variant="danger"
        loading={working}
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveModal(false)}
      />
    </div>
  );
}
