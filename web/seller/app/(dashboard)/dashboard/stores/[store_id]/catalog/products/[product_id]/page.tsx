'use client';

import { useCallback, useEffect, useMemo, useState, use, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Layers,
  Package,
  Plus,
  Save,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { CategoryPicker } from '@/components/seller/CategoryPicker';
import { ProductMediaWorkspace } from '@/components/seller/ProductMediaWorkspace';
import { VariantOptionsModal, type VariantBatchConfig } from '@/components/seller/VariantOptionsModal';
import { sellerApi } from '@/lib/api/client';
import { useTranslation } from '@/lib/i18n/locale-context';
import { formatMoney } from '@/lib/money';
import { deriveVariantAttributes } from '@/lib/variants/preview';
import type {
  CreateProductVariantPayload,
  Product,
  ProductMediaReference,
  ProductSku,
  ProductTranslation,
  ProductVariant,
  SellerProductDetail,
  StoreCategory,
  StoreMediaAsset,
  UpdateProductVariantPayload
} from '@/lib/api/types';

type TranslationForm = {
  enName: string;
  enDescription: string;
  enMetaTitle: string;
  enMetaDescription: string;
  arName: string;
  arDescription: string;
  arMetaTitle: string;
  arMetaDescription: string;
  slug: string;
  categoryIds: string[];
  storeCategoryIds: string[];
};

type VariantAttributeEdit = {
  attribute_id: string;
  attribute_value_id: string;
};

type VariantEdit = {
  code: string;
  status: string;
  /**
   * Editable attribute combination for saved unreferenced variants. Seeded
   * from the variant's saved `attribute_values`; only sent for unreferenced
   * variants because referenced variants keep their combination immutable.
   */
  attribute_values?: VariantAttributeEdit[];
};

type SkuEdit = {
  code: string;
  barcode: string;
  status: string;
};

const productStatusOptions = ['draft', 'active', 'archived'];

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function productTranslations(detail: SellerProductDetail | null): ProductTranslation[] {
  return asArray(detail?.translations);
}

function productVariants(detail: SellerProductDetail | null): ProductVariant[] {
  return asArray(detail?.variants);
}

function productSkus(detail: SellerProductDetail | null): ProductSku[] {
  return asArray(detail?.skus);
}

function productFromDetail(detail: SellerProductDetail, storeId: string): Product {
  const translations = productTranslations(detail);
  const translation = translations.find((item) => item.locale === 'en') || translations[0];
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
    productTranslations(detail).find((item) => item.locale === locale) || {
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
    enMetaTitle: en.meta_title || '',
    enMetaDescription: en.meta_description || '',
    arName: ar.name,
    arDescription: ar.description || '',
    arMetaTitle: ar.meta_title || '',
    arMetaDescription: ar.meta_description || '',
    slug: detail.product.slug,
    categoryIds: detail.category_ids || [],
    storeCategoryIds: detail.store_category_ids || []
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
  const { t } = useTranslation();
  const router = useRouter();

  const [detail, setDetail] = useState<SellerProductDetail | null>(null);
  const [mediaAssets, setMediaAssets] = useState<StoreMediaAsset[]>([]);
  const [references, setReferences] = useState<ProductMediaReference[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [variantConfirm, setVariantConfirm] = useState<{
    variant: ProductVariant;
    action: 'remove';
  } | null>(null);
  const [showVariantOptionsModal, setShowVariantOptionsModal] = useState(false);
  const [form, setForm] = useState<TranslationForm>({
    enName: '',
    enDescription: '',
    enMetaTitle: '',
    enMetaDescription: '',
    arName: '',
    arDescription: '',
    arMetaTitle: '',
    arMetaDescription: '',
    slug: '',
    categoryIds: [],
    storeCategoryIds: []
  });
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEdit>>({});
  const [skuEdits, setSkuEdits] = useState<Record<string, SkuEdit>>({});
  const [newVariant, setNewVariant] = useState<VariantEdit>({ code: '', status: 'active' });
  const [newSkuByVariant, setNewSkuByVariant] = useState<Record<string, SkuEdit>>({});

  const product = useMemo(() => (detail ? productFromDetail(detail, store_id) : null), [detail, store_id]);

  const canManageProduct =
    (product?.source === 'seller_owned' || detail?.source === 'seller_owned') &&
    product?.status !== 'archived';

  const variantOptions = useMemo(
    () => (detail ? deriveVariantAttributes(detail.variants || []) : []),
    [detail]
  );

  const variantBatchConfig: VariantBatchConfig | null = useMemo(() => {
    if (!canManageProduct || !variantOptions.length) return null;
    return {
      storeId: store_id,
      productId: product_id,
      productCode: detail?.product.slug || product_id,
      attributes: variantOptions,
      existingVariantRecords: detail?.variants || [],
      onComplete: () => refreshAfterMutation(`${t('products.noticeVariantSpecsCreated')} (batch)`)
    };
  }, [canManageProduct, variantOptions, store_id, product_id, detail, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetEditableState = useCallback((nextDetail: SellerProductDetail) => {
    setForm(buildTranslationForm(nextDetail));
    setVariantEdits(
      productVariants(nextDetail).reduce<Record<string, VariantEdit>>((acc, variant) => {
        acc[variant.id] = {
          code: variant.code,
          status: variant.status,
          attribute_values: asArray(variant.attribute_values).map((av) => ({
            attribute_id: av.attribute_id,
            attribute_value_id: av.value_id
          }))
        };
        return acc;
      }, {})
    );
    setSkuEdits(
      productSkus(nextDetail).reduce<Record<string, SkuEdit>>((acc, sku) => {
        acc[sku.id] = { code: sku.code, barcode: sku.barcode || '', status: sku.status };
        return acc;
      }, {})
    );
  }, []);

  const loadDetail = useCallback(async () => {
    setError(null);
    const [nextDetail, mediaRes, refsRes, categoriesRes] = await Promise.all([
      sellerApi.getStoreProductDetail(store_id, product_id),
      sellerApi.listStoreMedia(store_id).catch(() => ({ items: [] })),
      sellerApi.listProductMediaReferences(store_id, product_id).catch(() => ({ items: [] })),
      sellerApi.listStoreCategories(store_id).catch((err: any) => {
        setCategoryLoadError(err.message || t('products.errorLoadCategories'));
        return [];
      })
    ]);
    setDetail(nextDetail);
    setMediaAssets(mediaRes.items || []);
    setReferences(refsRes.items || []);
    setCategories(categoriesRes);
    if (categoriesRes.length > 0) setCategoryLoadError(null);
    resetEditableState(nextDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product_id, resetEditableState, store_id]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    loadDetail()
      .catch((err: any) => {
        if (isMounted) setError(err.message || t('products.errorLoadDetails'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadDetail]);

  const skusByVariant = useMemo(() => {
    return productSkus(detail).reduce<Record<string, ProductSku[]>>((acc, sku) => {
      if (!acc[sku.variant_id]) acc[sku.variant_id] = [];
      acc[sku.variant_id].push(sku);
      return acc;
    }, {});
  }, [detail]);

  const listing = detail?.listing;

  const refreshAfterMutation = async (message: string) => {
    await loadDetail();
    setNotice(message);
  };

  const handleSaveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !canManageProduct) return;
    if (!form.enName.trim() || !form.slug.trim()) {
      setError(t('products.requiredNameSlug'));
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
          description: form.enDescription.trim(),
          meta_title: form.enMetaTitle?.trim() || undefined,
          meta_description: form.enMetaDescription?.trim() || undefined
        }
      ];
      if (form.arName.trim()) {
        translations.push({
          locale: 'ar',
          name: form.arName.trim(),
          description: form.arDescription.trim(),
          meta_title: form.arMetaTitle?.trim() || undefined,
          meta_description: form.arMetaDescription?.trim() || undefined
        });
      }

      const updated = await sellerApi.updateStoreProduct(store_id, product_id, {
        slug: form.slug.trim(),
        translations,
        store_category_ids: form.storeCategoryIds
      });
      setDetail(updated);
      resetEditableState(updated);
      setNotice(t('products.noticeSaved'));
    } catch (err: any) {
      setError(err.message || t('products.errorSaveDetails'));
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
      await refreshAfterMutation(`${t('products.statusChangedPrefix')}${newStatus}.`);
    } catch (err: any) {
      setError(err.message || t('products.errorUpdateStatus'));
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
      await refreshAfterMutation(t('products.noticeArchived'));
    } catch (err: any) {
      setError(err.message || t('products.errorArchive'));
    } finally {
      setWorking(false);
    }
  };

  const confirmProductRemoval = async () => {
    if (!detail) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const response = await sellerApi.removeStoreProduct(store_id, product_id);
      const result = response.results?.[0];
      setShowRemoveModal(false);
      if (result?.outcome === 'archived') {
        await loadDetail();
        setNotice(t('products.noticeRemovalArchived'));
      } else if (result?.outcome === 'removed' || result?.outcome === 'not_found') {
        router.push(`/dashboard/stores/${store_id}/catalog/products`);
      } else {
        setError(t('products.errorRemoveProducts'));
      }
    } catch (err: any) {
      setError(err.message || t('products.errorRemoveProducts'));
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
        status: 'active'
      });
      setNewVariant({ code: '', status: 'active' });
      await refreshAfterMutation(t('products.noticeVariantAdded'));
    } catch (err: any) {
      setError(err.message || t('products.errorAddVariant'));
    } finally {
      setWorking(false);
    }
  };

  const handleCreateVariantWithOptions = async (payload: CreateProductVariantPayload) => {
    if (!canManageProduct) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.createProductVariant(store_id, product_id, payload);
      setShowVariantOptionsModal(false);
      await refreshAfterMutation(t('products.noticeVariantSpecsCreated'));
    } catch (err: any) {
      setError(err.message || t('products.errorVariantSpecs'));
      throw err;
    } finally {
      setWorking(false);
    }
  };

  const handleSaveVariant = async (variant: ProductVariant, variantHasSkus: boolean) => {
    if (!canManageProduct) return;
    const edit = variantEdits[variant.id];
    if (!edit?.code.trim()) {
      setError(t('products.requiredVariantCode'));
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const payload: UpdateProductVariantPayload = {
        code: edit.code.trim(),
        status: 'active'
      };
      // Unreferenced saved variants can atomically replace their attribute
      // combination through the existing update route; referenced variants
      // answer with an actionable 409 from Core, so their combination stays
      // immutable and pending edits are preserved on conflict.
      if (!variantHasSkus && edit.attribute_values && edit.attribute_values.length > 0) {
        payload.attribute_values = edit.attribute_values
          .map((av) => ({
            attribute_id: av.attribute_id.trim(),
            attribute_value_id: av.attribute_value_id.trim()
          }))
          .filter((av) => av.attribute_id !== '' && av.attribute_value_id !== '');
      }
      await sellerApi.updateProductVariant(store_id, product_id, variant.id, payload);
      await refreshAfterMutation(t('products.noticeVariantUpdated'));
    } catch (err: any) {
      setError(err.message || t('products.errorUpdateVariant'));
    } finally {
      setWorking(false);
    }
  };

  const openVariantConfirmation = (variant: ProductVariant) => {
    if (!canManageProduct) return;
    setVariantConfirm({ variant, action: 'remove' });
  };

  const confirmVariantLifecycle = async () => {
    if (!canManageProduct || !variantConfirm) return;
    const { variant } = variantConfirm;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.deleteProductVariant(store_id, product_id, variant.id);
      await refreshAfterMutation(t('products.noticeVariantRemoved'));
      setVariantConfirm(null);
    } catch (err: any) {
      setVariantConfirm(null);
      setError(
        err.message || t('products.errorRemoveVariant')
      );
    } finally {
      setWorking(false);
    }
  };

  const handleCreateSku = async (variantID: string) => {
    if (!canManageProduct) return;
    const draft = newSkuByVariant[variantID] || { code: '', barcode: '', status: 'active' };
    if (!draft.code.trim()) {
      setError(t('products.requiredSkuCode'));
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
      await refreshAfterMutation(t('products.noticeSkuAdded'));
    } catch (err: any) {
      setError(err.message || t('products.errorAddSku'));
    } finally {
      setWorking(false);
    }
  };

  const handleSaveSku = async (variantID: string, sku: ProductSku) => {
    if (!canManageProduct) return;
    const edit = skuEdits[sku.id];
    if (!edit?.code.trim()) {
      setError(t('products.requiredSkuCode'));
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
      await refreshAfterMutation(t('products.noticeSkuUpdated'));
    } catch (err: any) {
      setError(err.message || t('products.errorUpdateSku'));
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">{t('products.loadingDetail')}</div>;
  }

  if (!detail || !product) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-sm text-slate-500">{error || t('products.notFound')}</div>
        <Link href={`/dashboard/stores/${store_id}/catalog/products`} className="text-xs text-indigo-600 hover:underline">
          {t('products.backToCatalog')}
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
            aria-label={t('products.backAria')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-950">{product.name}</h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t('products.sourcePrefix')}<span className="font-medium text-slate-700">{product.source}</span> · {t('products.slugPrefix')}{' '}
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
              <ExternalLink className="h-3.5 w-3.5" /> {t('products.viewListing')}
            </Link>
          )}

          {listing?.id && (
            <button
              type="button"
              disabled={working}
              onClick={() => setShowRemoveModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t('products.removeProductAction')}
            </button>
          )}

          {canManageProduct && (
            <select
              value={product.status}
              onChange={(event) => handleStatusChange(event.target.value)}
              disabled={working}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              aria-label={t('products.changeStatusAria')}
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
              <Archive className="h-3.5 w-3.5" /> {t('products.archiveRemove')}
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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products.cardListing')}</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
            {listing?.status ? <StatusBadge status={listing.status} /> : t('products.noListing')}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('products.listingIdPrefix')}{listing?.id || '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products.cardReadiness')}</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {detail.publish_readiness?.is_ready ? t('products.readyToPublish') : t('products.needsAttention')}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {(detail.publish_readiness?.reasons || []).slice(0, 1).join(', ') || t('products.noBlockers')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products.cardInventory')}</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {detail.inventory_summary?.total_available ?? 0} {t('products.unitsAvailableSuffix')}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {detail.inventory_summary?.total_on_hand ?? 0} {t('products.stockOnHand')} · {detail.inventory_summary?.total_reserved ?? 0} {t('products.stockReserved')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products.cardPrice')}</div>
          <div className="mt-2 text-sm font-bold text-slate-900">
            {formatMoney(detail.current_price, t('products.moneyNotSet'))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('products.createdPrefix')}{formatDate(product.created_at)}</p>
        </div>
      </section>

      <form onSubmit={handleSaveProduct} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">{t('products.contentTitle')}</h2>
            <p className="text-xs text-slate-500">{t('products.contentSubtitle')}</p>
          </div>
          <button
            type="submit"
            disabled={!canManageProduct || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? t('products.saving') : t('products.saveDetails')}
          </button>
        </div>

        {!canManageProduct && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {t('products.readOnlyNotice')}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelEnTitle')}</span>
            <input
              value={form.enName}
              onChange={(event) => setForm((prev) => ({ ...prev, enName: event.target.value }))}
              disabled={!canManageProduct}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelSlug')}</span>
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              disabled={!canManageProduct}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelEnDescription')}</span>
            <textarea
              value={form.enDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, enDescription: event.target.value }))}
              disabled={!canManageProduct}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelEnSeoTitle')}</span>
            <input
              value={form.enMetaTitle}
              onChange={(event) => setForm((prev) => ({ ...prev, enMetaTitle: event.target.value }))}
              disabled={!canManageProduct}
              placeholder={t('products.enSeoTitlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelEnSeoDescription')}</span>
            <input
              value={form.enMetaDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, enMetaDescription: event.target.value }))}
              disabled={!canManageProduct}
              placeholder={t('products.enSeoDescriptionPlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelArTitle')}</span>
            <input
              value={form.arName}
              onChange={(event) => setForm((prev) => ({ ...prev, arName: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.categoriesLabel')}</span>
            <CategoryPicker
              storeId={store_id}
              categories={categories}
              selectedIds={form.storeCategoryIds}
              onChange={(selectedIds) => setForm((prev) => ({ ...prev, storeCategoryIds: selectedIds }))}
              disabled={!canManageProduct}
              loadError={categoryLoadError}
              onRetry={loadDetail}
            />
          </div>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelArDescription')}</span>
            <textarea
              value={form.arDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, arDescription: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelArSeoTitle')}</span>
            <input
              value={form.arMetaTitle}
              onChange={(event) => setForm((prev) => ({ ...prev, arMetaTitle: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              placeholder={t('products.arSeoTitlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{t('products.labelArSeoDescription')}</span>
            <input
              value={form.arMetaDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, arMetaDescription: event.target.value }))}
              disabled={!canManageProduct}
              dir="rtl"
              placeholder={t('products.arSeoDescriptionPlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </label>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">{t('products.variantsTitle')}</h2>
            <p className="text-xs text-slate-500">
              {t('products.variantsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowVariantOptionsModal(true)}
              disabled={!canManageProduct || working}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Layers className="h-3.5 w-3.5" /> {t('products.configureVariant')}
            </button>
            <div className="text-xs text-slate-500">
              {productVariants(detail).length} {t('products.variantsCountSuffix')}{productSkus(detail).length} SKUs
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateVariant} className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
          <input
            value={newVariant.code}
            onChange={(event) => setNewVariant((prev) => ({ ...prev, code: event.target.value }))}
            disabled={!canManageProduct}
            placeholder={t('products.variantPlaceholder')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!canManageProduct || working || !newVariant.code.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t('products.addVariant')}
          </button>
        </form>

        <div className="mt-5 space-y-4">
          {productVariants(detail).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {t('products.noVariants')}
            </div>
          ) : (
            productVariants(detail).map((variant) => {
              const edit = variantEdits[variant.id] || { code: variant.code, status: variant.status };
              const skuDraft = newSkuByVariant[variant.id] || { code: '', barcode: '', status: 'active' };
              const variantSkus = skusByVariant[variant.id] || [];
              const variantHasSkus = variantSkus.length > 0;

              return (
                <div key={variant.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
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
                    <button
                      type="button"
                      onClick={() => handleSaveVariant(variant, variantHasSkus)}
                      disabled={!canManageProduct || working}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t('products.saveVariant')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openVariantConfirmation(variant)}
                      disabled={!canManageProduct || working}
                      aria-label={`Delete variant ${variant.code}`}
                      className="rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('products.removeVariant')}
                    </button>
                  </div>

                  {variantHasSkus && canManageProduct && (
                    <p className="mt-2 text-xs text-amber-700" role="note" data-testid="variant-reference-guidance">
                      {t('products.variantReferencedHistory').replace('{count}', String(variantSkus.length))}
                    </p>
                  )}

                  {!variantHasSkus && canManageProduct && (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3" data-testid="variant-attribute-editor">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Attribute Combination
                          </h4>
                          <p className="text-xs text-slate-500">
                            Editable while this variant is not referenced by SKUs or inventory history.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setVariantEdits((prev) => ({
                              ...prev,
                              [variant.id]: { ...edit, attribute_values: [...(edit.attribute_values || []), { attribute_id: '', attribute_value_id: '' }] }
                            }))
                          }
                          disabled={working}
                          aria-label={`Add attribute to variant ${variant.code}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Attribute
                        </button>
                      </div>
                      {(edit.attribute_values && edit.attribute_values.length > 0) ? (
                        <div className="mt-2 space-y-2">
                          {edit.attribute_values.map((attr, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Attribute ID (e.g. color)"
                                value={attr.attribute_id}
                                aria-label={`Attribute for variant ${variant.code}`}
                                onChange={(event) =>
                                  setVariantEdits((prev) => ({
                                    ...prev,
                                    [variant.id]: {
                                      ...edit,
                                      attribute_values: (edit.attribute_values || []).map((a, i) =>
                                        i === idx ? { ...a, attribute_id: event.target.value } : a
                                      )
                                    }
                                  }))
                                }
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <input
                                type="text"
                                placeholder="Attribute Value ID (e.g. red)"
                                value={attr.attribute_value_id}
                                aria-label={`Attribute value for variant ${variant.code}`}
                                onChange={(event) =>
                                  setVariantEdits((prev) => ({
                                    ...prev,
                                    [variant.id]: {
                                      ...edit,
                                      attribute_values: (edit.attribute_values || []).map((a, i) =>
                                        i === idx ? { ...a, attribute_value_id: event.target.value } : a
                                      )
                                    }
                                  }))
                                }
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setVariantEdits((prev) => ({
                                    ...prev,
                                    [variant.id]: {
                                      ...edit,
                                      attribute_values: (edit.attribute_values || []).filter((_, i) => i !== idx)
                                    }
                                  }))
                                }
                                aria-label={`Remove attribute from variant ${variant.code}`}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs italic text-slate-400">
                          No attribute values on this variant. Click &quot;Add Attribute&quot; to link an option like Color or Size.
                        </p>
                      )}
                    </div>
                  )}

                  {variant.attribute_values && variant.attribute_values.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {variant.attribute_values.map((av) => (
                        <span
                          key={av.id || `${av.attribute_id}-${av.value_id}`}
                          className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                        >
                          {av.attribute_name || av.attribute_code}: {av.value_name || av.value_code}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{t('products.colSkuCode')}</th>
                          <th className="px-3 py-2 font-semibold">{t('products.colBarcode')}</th>
                          <th className="px-3 py-2 font-semibold">{t('products.colWeightSpecs')}</th>
                          <th className="px-3 py-2 font-semibold">{t('products.colStatus')}</th>
                          <th className="px-3 py-2 font-semibold text-right">{t('products.colActions')}</th>
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
                              <td className="px-3 py-2 text-slate-600">
                                {sku.weight_grams ? <span>{sku.weight_grams}g</span> : null}
                                {sku.length_mm && sku.width_mm && sku.height_mm ? (
                                  <span className="block text-[11px] text-slate-400">
                                    {sku.length_mm}×{sku.width_mm}×{sku.height_mm}mm
                                  </span>
                                ) : null}
                                {!sku.weight_grams && !sku.length_mm && <span className="text-slate-400">-</span>}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-600">{sku.status}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSaveSku(variant.id, sku)}
                                  disabled={!canManageProduct || working}
                                  className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {t('common.save')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {variantSkus.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                              {t('products.noSkus')}
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
                      placeholder={t('products.skuPlaceholder')}
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
                      placeholder={t('products.barcodePlaceholder')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateSku(variant.id)}
                      disabled={!canManageProduct || working || !skuDraft.code.trim()}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {t('products.addSku')}
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
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-950">{t('products.infoTitle')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
            <div>
              <span className="font-medium text-slate-500">{t('products.infoProductId')}</span>
              <div className="mt-1 font-mono text-slate-800">{product.id}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('products.infoSourceDiscriminator')}</span>
              <div className="mt-1 font-semibold text-slate-800">{product.source}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('products.infoCreatedAt')}</span>
              <div className="mt-1 text-slate-800">{formatDate(product.created_at)}</div>
            </div>
            <div>
              <span className="font-medium text-slate-500">{t('products.infoLastUpdated')}</span>
              <div className="mt-1 text-slate-800">{formatDate(product.updated_at)}</div>
            </div>
          </div>

          {detail.publish_readiness?.reasons?.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold text-amber-900">{t('products.infoReadyBlockers')}</div>
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
            <h2 className="text-base font-bold text-slate-950">{t('products.locationsTitle')}</h2>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 space-y-2">
            {(detail.inventory_summary?.locations || []).length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                {t('products.noLocations')}
              </div>
            ) : (
              detail.inventory_summary.locations.map((location) => (
                <div key={`${location.location_id}-${location.sku_id}`} className="rounded-xl border border-slate-100 p-3 text-xs">
                  <div className="font-semibold text-slate-900">{location.location_name || location.location_id}</div>
                  <div className="mt-1 text-slate-500">
                    SKU {location.sku_id} · {location.available_qty} {t('products.skuAvailableSuffix')} · {location.reserved_qty} {t('products.skuReservedSuffix')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <ProductMediaWorkspace
        storeId={store_id}
        productId={product_id}
        productName={product.name}
        canManage={canManageProduct}
        initialAssets={mediaAssets}
        initialReferences={references}
      />

      <ConfirmModal
        isOpen={showArchiveModal}
        title={t("products.confirmArchiveTitle")}
        description={t("products.confirmArchiveDescription")}
        confirmLabel={t("products.confirmArchiveConfirm")}
        cancelLabel={t("products.confirmArchiveCancel")}
        variant="danger"
        loading={working}
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveModal(false)}
      />

      <ConfirmModal
        isOpen={showRemoveModal}
        title={t('products.confirmRemovalTitle')}
        description={t('products.confirmRemovalDescription').replace('{count}', '1')}
        confirmLabel={t('products.confirmRemoveProducts')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        loading={working}
        onConfirm={confirmProductRemoval}
        onCancel={() => setShowRemoveModal(false)}
      />

      <ConfirmModal
        isOpen={variantConfirm !== null}
        title={
          t('products.removeVariant')
        }
        description={
          t('products.confirmVariantRemoval').replace('{code}', variantConfirm?.variant.code || '')
        }
        confirmLabel={t('products.removeVariant')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        loading={working}
        onConfirm={confirmVariantLifecycle}
        onCancel={() => setVariantConfirm(null)}
      />

      <VariantOptionsModal
        isOpen={showVariantOptionsModal}
        onClose={() => setShowVariantOptionsModal(false)}
        onSubmit={handleCreateVariantWithOptions}
        loading={working}
        batch={variantBatchConfig}
        productAttributes={detail?.attributes || []}
      />
    </div>
  );
}
