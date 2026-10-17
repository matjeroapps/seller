'use client';

import { useState, useEffect, useId, useMemo, useRef, FormEvent } from 'react';
import { X, Plus, Trash2, Layers, Loader2, RotateCcw } from 'lucide-react';
import type { CreateProductVariantPayload, ProductAttributeOption, ProductVariant, UpdateProductVariantPayload, VariantBatchResult } from '@/lib/api/types';
import type {
  VariantPreviewAttribute,
  VariantPreviewDimensionInput
} from '@/lib/variants/preview';
import { buildVariantPreview, deriveVariantAttributes } from '@/lib/variants/preview';
import { useTranslation } from '@/lib/i18n/locale-context';
import { PropertySelectionStep, type PropertyDraft, type PropertyValueDraft } from '@/components/seller/variant-management/PropertySelectionStep';
import {
  createVariantBatch,
  retryFailedVariantBatch,
  type VariantBatchReviewItem
} from '@/lib/variants/batch';

export interface VariantOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProductVariantPayload) => Promise<void>;
  onUpdate?: (variantId: string, payload: UpdateProductVariantPayload) => Promise<void>;
  editingVariant?: ProductVariant | null;
  loading?: boolean;
  batch?: VariantBatchConfig | null;
  productAttributes?: ProductAttributeOption[];
  onCreateProperty?: (draft: PropertyDraft) => Promise<void> | void;
  onCreatePropertyValue?: (draft: PropertyValueDraft) => Promise<void> | void;
}

export interface VariantBatchConfig {
  storeId: string;
  productId: string;
  productCode: string;
  /** Attribute picker options derived from the product's existing variant data. */
  attributes: VariantPreviewAttribute[];
  existingVariantRecords?: Array<Partial<ProductVariant> | null | undefined>;
  onComplete?: () => void | Promise<void>;
}

interface VariantRowEdit {
  variant_code?: string;
  sku_code?: string;
  removed?: boolean;
}

interface AttributeRow {
  attributeId: string;
  attributeValueId: string;
}

export function VariantOptionsModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editingVariant = null,
  loading = false,
  batch = null,
  productAttributes = [],
  onCreateProperty,
  onCreatePropertyValue,
}: VariantOptionsModalProps) {
  if (batch) {
    return <VariantBatchModal {...batch} isOpen={isOpen} onClose={onClose} onCreateProperty={onCreateProperty} onCreatePropertyValue={onCreatePropertyValue} />;
  }
  return <VariantOptionsFormModal isOpen={isOpen} onClose={onClose} onSubmit={onSubmit} onUpdate={onUpdate} editingVariant={editingVariant} loading={loading} productAttributes={productAttributes} />;
}

function VariantBatchModal({
  isOpen,
  onClose,
  attributes,
  storeId,
  productId,
  productCode,
  existingVariantRecords,
  onComplete: onBatchComplete,
  onCreateProperty,
  onCreatePropertyValue,
}: VariantBatchConfig & {
  isOpen: boolean;
  onClose: () => void;
  onCreateProperty?: (draft: PropertyDraft) => Promise<void> | void;
  onCreatePropertyValue?: (draft: PropertyValueDraft) => Promise<void> | void;
}) {
  const titleId = useId();
  const existingSignatures = useMemo(
    () =>
      new Set(
        (existingVariantRecords || []).map((variant) =>
          canonicalSignatureOf(variant?.attribute_values || [])
        ).filter((signature) => signature.length > 0)
      ),
    [existingVariantRecords]
  );
  const existingVariantCodes = useMemo(
    () => new Set((existingVariantRecords || []).map((variant) => variant?.code).filter(Boolean) as string[]),
    [existingVariantRecords]
  );
  const existingSkuCodes = useMemo(
    () => new Set((existingVariantRecords || []).flatMap((variant) => (variant?.sku?.code ? [variant.sku.code] : []))),
    [existingVariantRecords]
  );

  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [rowEdits, setRowEdits] = useState<Record<string, VariantRowEdit>>({});
  const [itemResults, setItemResults] = useState<Record<string, VariantBatchResult['items'][number]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelection({});
    setRowEdits({});
    setItemResults({});
    setError(null);
  }, [isOpen]);

  const dimensions: VariantPreviewDimensionInput[] = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, valueIds]) => valueIds.length > 0)
        .map(([attribute_id, value_ids]) => ({ attribute_id, value_ids })),
    [selection]
  );

  const preview = useMemo(
    () =>
      buildVariantPreview({
        productCode,
        attributes,
        dimensions,
        existingSignatures,
        existingVariantCodes,
        existingSkuCodes
      }),
    [productCode, attributes, dimensions, existingSignatures, existingVariantCodes, existingSkuCodes]
  );

  const editFor = (clientItemId: string): VariantRowEdit => rowEdits[clientItemId] || {};
  const resultFor = (clientItemId: string) => itemResults[clientItemId];

  const reviewItems: VariantBatchReviewItem[] = useMemo(
    () =>
      preview.items.map((item) => ({
        ...item,
        variant_code: editFor(item.client_item_id).variant_code?.trim() || item.variant_code,
        sku_code: editFor(item.client_item_id).sku_code?.trim() || item.sku_code,
        removed: !!editFor(item.client_item_id).removed,
        result: resultFor(item.client_item_id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview.items, rowEdits, itemResults]
  );

  const toggleAttribute = (attributeId: string, checked: boolean) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (checked) next[attributeId] = [];
      else delete next[attributeId];
      return next;
    });
  };

  const toggleValue = (attributeId: string, valueId: string) => {
    setSelection((prev) => {
      const current = prev[attributeId] || [];
      return {
        ...prev,
        [attributeId]: current.includes(valueId)
          ? current.filter((id) => id !== valueId)
          : [...current, valueId]
      };
    });
  };

  const updateEdit = (clientItemId: string, patch: VariantRowEdit) => {
    setRowEdits((prev) => ({ ...prev, [clientItemId]: { ...prev[clientItemId], ...patch } }));
  };

  const runBatch = async (kind: 'create' | 'retry') => {
    if (dimensions.length === 0 || preview.errors.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const results =
        kind === 'create'
          ? await createVariantBatch(storeId, productId, reviewItems)
          : await retryFailedVariantBatch(storeId, productId, reviewItems);
      setItemResults((prev) => {
        const next = { ...prev };
        for (const item of results.items) next[item.client_item_id] = item;
        return next;
      });
      await onBatchComplete?.();
    } catch (err: any) {
      setError(err?.message || 'Unable to create variant batch.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const pendingCount = reviewItems.filter(
    (item) =>
      !item.removed &&
      !item.existing &&
      item.result?.status !== 'created' &&
      item.result?.status !== 'already_exists'
  ).length;
  const failedCount = reviewItems.filter((item) => !item.removed && item.result?.status === 'failed').length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      dir="rtl"
    >
      <div
        className="fixed inset-0 bg-[#102c2a]/35 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[22px] bg-white p-6 shadow-2xl ring-1 ring-[#0b5d4b]/10 sm:p-7">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                إدارة وتعديل خصائص ومتغيرات المنتج
              </h2>
              <p className="text-xs text-slate-500">
                اختر الخصائص والقيم، راجع التركيبات، ثم احفظ المتغيرات دفعة واحدة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="إغلاق النافذة"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(error || preview.errors.length > 0) && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" data-testid="variant-preview-errors">
            {[...new Set([...preview.errors, error ? [error] : []].flat())].map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-5">
          <PropertySelectionStep
            properties={attributes}
            selected={selection}
            disabled={busy}
            onToggleProperty={toggleAttribute}
            onToggleValue={toggleValue}
            onCreateProperty={onCreateProperty}
            onCreatePropertyValue={onCreatePropertyValue}
          />

          <section data-testid="variant-preview-table">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                ٢. معاينة التركيبات
              </h3>
              <span className="text-xs text-slate-500">
                {preview.items.length} تركيبة
                {preview.errors.length === 0 && preview.items.length > 0 && ` · ${pendingCount} جاهزة للحفظ`}
                <span className="sr-only">
                  {preview.items.length} combinations
                  {preview.errors.length === 0 && preview.items.length > 0 && ` · ${pendingCount} to create`}
                </span>
              </span>
            </div>
            {preview.items.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">التركيبة</th>
                      <th className="px-3 py-2 font-semibold">رمز المتغير</th>
                      <th className="px-3 py-2 font-semibold">رمز SKU</th>
                      <th className="px-3 py-2 font-semibold">النتيجة</th>
                      <th className="px-3 py-2 font-semibold text-left">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reviewItems.map((item) => {
                      const result = resultFor(item.client_item_id);
                      return (
                        <tr
                          key={item.client_item_id}
                          className={item.removed ? 'opacity-50' : undefined}
                          data-existing={item.existing || undefined}
                        >
                          <td className="px-3 py-2">
                            {item.labels.map((label) => (
                              <span
                                key={`${label.attribute_name}-${label.value_name}`}
                                className="mr-1 inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700"
                              >
                                {label.attribute_name}: {label.value_name}
                              </span>
                            ))}
                            {item.existing && (
                              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                                موجودة مسبقاً
                                <span className="sr-only">Already exists</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={item.variant_code}
                              aria-label={`Variant code for ${item.labels.map((l) => l.value_name).join('/')} or ${item.variant_code}`}
                              onChange={(event) => updateEdit(item.client_item_id, { variant_code: event.target.value })}
                              disabled={busy || item.removed || result?.status === 'created' || item.existing}
                              className="w-40 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={item.sku_code}
                              aria-label={`SKU code for ${item.variant_code}`}
                              onChange={(event) => updateEdit(item.client_item_id, { sku_code: event.target.value })}
                              disabled={busy || item.removed || result?.status === 'created' || item.existing}
                              className="w-40 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {result?.status ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  result.status === 'created'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : result.status === 'failed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {({ created: 'تم الحفظ', already_exists: 'موجودة مسبقاً', failed: 'فشل الحفظ', skipped: 'مستبعدة' } as Record<string, string>)[result.status] || result.status}
                                {result.status === 'failed' && result.error?.message ? `: ${result.error.message}` : ''}
                                <span className="sr-only">
                                  {({
                                    created: 'Created',
                                    already_exists: 'Already exists',
                                    failed: `failed${result.error?.message ? `: ${result.error.message}` : ''}`,
                                    skipped: 'Skipped',
                                  } as Record<string, string>)[result.status] || result.status}
                                </span>
                              </span>
                            ) : item.removed ? (
                              <span className="text-[10px] font-bold text-slate-400">مستبعدة</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                updateEdit(item.client_item_id, { removed: !editFor(item.client_item_id).removed })
                              }
                              disabled={busy || result?.status === 'created'}
                              aria-label={item.removed ? `Restore ${item.variant_code}` : `Remove ${item.variant_code}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {item.removed ? 'إعادة' : 'استبعاد'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => runBatch('retry')}
              disabled={busy}
              aria-label={`إعادة محاولة حفظ ${failedCount} متغير - Retry ${failedCount} failed variants`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> إعادة محاولة حفظ {failedCount} متغير
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => runBatch('create')}
            disabled={busy || dimensions.length === 0 || preview.errors.length > 0 || pendingCount === 0}
            aria-label={`حفظ ${pendingCount || preview.items.length} متغير - Create ${pendingCount || preview.items.length} variants`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ {pendingCount || preview.items.length} متغير
          </button>
        </div>
      </div>
    </div>
  );
}

function canonicalSignatureOf(
  values: Array<{ attribute_id: string; value_id?: string; attribute_value_id?: string }>
): string {
  const pairs = values
    .map((value) => ({
      attribute_id: value.attribute_id,
      attribute_value_id: value.value_id || value.attribute_value_id || ''
    }))
    .filter((value) => value.attribute_value_id)
    .sort(
      (a, b) =>
        a.attribute_id.localeCompare(b.attribute_id) ||
        a.attribute_value_id.localeCompare(b.attribute_value_id)
    )
    .map((value) => `${value.attribute_id}=${value.attribute_value_id}`);
  return pairs.join('|');
}

function VariantOptionsFormModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editingVariant = null,
  loading = false,
  productAttributes = [],
}: VariantOptionsModalProps) {
  const { t, isRtl } = useTranslation();
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [priceMinorUnits, setPriceMinorUnits] = useState('');
  const [weightGrams, setWeightGrams] = useState('');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCode(editingVariant?.code || '');
      setSkuCode(editingVariant?.sku?.code || '');
      setBarcode(editingVariant?.sku?.barcode || '');
      setPriceMinorUnits(editingVariant?.sku?.price_minor_units?.toString() || '');
      setWeightGrams(editingVariant?.sku?.weight_grams?.toString() || '');
      setLengthMm(editingVariant?.sku?.length_mm?.toString() || '');
      setWidthMm(editingVariant?.sku?.width_mm?.toString() || '');
      setHeightMm(editingVariant?.sku?.height_mm?.toString() || '');
      setAttributes((editingVariant?.attribute_values || []).map((value) => ({
        attributeId: value.attribute_id,
        attributeValueId: value.value_id,
      })));
      setValidationError(null);

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editingVariant]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleAddAttribute = () => {
    setAttributes((prev) => [...prev, { attributeId: '', attributeValueId: '' }]);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAttribute = (index: number, field: keyof AttributeRow, value: string) => {
    setAttributes((prev) =>
      prev.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr))
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setValidationError(t('variantSpecs.requiredVariantCode'));
      return;
    }

    const trimmedSkuCode = skuCode.trim();
    if (!trimmedSkuCode) {
      setValidationError(t('variantSpecs.requiredSkuCode'));
      return;
    }

    // Filter valid attribute rows
    const validAttributes = attributes
      .map((a) => ({
        attribute_id: a.attributeId.trim(),
        attribute_value_id: a.attributeValueId.trim(),
      }))
      .filter((a) => a.attribute_id !== '' && a.attribute_value_id !== '');

    const payload: CreateProductVariantPayload = {
      code: trimmedCode,
      status: 'active',
      sku_code: trimmedSkuCode,
      barcode: barcode.trim() ? barcode.trim() : undefined,
      attribute_values: validAttributes.length > 0 ? validAttributes : undefined,
    };

    if (weightGrams.trim()) {
      const parsedWeight = parseInt(weightGrams.trim(), 10);
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        setValidationError(t('variantSpecs.invalidWeight'));
        return;
      }
      payload.weight_grams = parsedWeight;
    }

    if (lengthMm.trim() || widthMm.trim() || heightMm.trim()) {
      payload.dimensions = {
        length_mm: lengthMm.trim() ? parseInt(lengthMm.trim(), 10) : undefined,
        width_mm: widthMm.trim() ? parseInt(widthMm.trim(), 10) : undefined,
        height_mm: heightMm.trim() ? parseInt(heightMm.trim(), 10) : undefined,
      };
    }

    if (priceMinorUnits.trim()) {
      const parsedPrice = parseInt(priceMinorUnits.trim(), 10);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setValidationError(t('variantSpecs.invalidPrice'));
        return;
      }
      payload.price_minor_units = parsedPrice;
    }

    try {
      if (editingVariant && onUpdate) {
        await onUpdate(editingVariant.id, payload);
      } else {
        await onSubmit(payload);
      }
    } catch (err: any) {
      setValidationError(err.message || t('variantSpecs.createError'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!loading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5 sm:p-7">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                {editingVariant ? t('variantSpecs.editTitle') : t('variantSpecs.title')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('variantSpecs.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={t('variantSpecs.close')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {validationError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Section 1: Variant Basic Info */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('variantSpecs.identity')}
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  {t('variantSpecs.variantCode')} <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('variantSpecs.variantCodeExample')}
                  required
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Option Values / Attributes */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('variantSpecs.attributes')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('variantSpecs.attributesHelp')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAttribute}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {t('variantSpecs.addAttribute')}
              </button>
            </div>

            {attributes.length === 0 ? (
              <p className="mt-3 text-xs italic text-slate-400">
                {t('variantSpecs.noAttributes')}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={attr.attributeId}
                      onChange={(e) => {
                        setAttributes((prev) => prev.map((row, rowIndex) =>
                          rowIndex === idx ? { attributeId: e.target.value, attributeValueId: '' } : row
                        ));
                      }}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="">{t('variantSpecs.selectAttribute')}</option>
                      {productAttributes.filter((item) => item.status === 'active' && !attributes.some((row, rowIndex) => rowIndex !== idx && row.attributeId === item.id)).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <select
                      value={attr.attributeValueId}
                      onChange={(e) => handleUpdateAttribute(idx, 'attributeValueId', e.target.value)}
                      disabled={loading || !attr.attributeId}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="">{t('variantSpecs.selectValue')}</option>
                      {productAttributes.find((item) => item.id === attr.attributeId)?.values
                        .filter((item) => item.status === 'active').map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(idx)}
                      disabled={loading}
                      aria-label={t('variantSpecs.removeAttribute')}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: SKU & Physical Specifications */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('variantSpecs.skuDimensions')}
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  {t('variantSpecs.skuCode')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value)}
                  placeholder={t('variantSpecs.skuCodeExample')}
                  required
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">{t('variantSpecs.barcode')}</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={t('variantSpecs.barcodeExample')}
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">{t('variantSpecs.weight')}</label>
                <input
                  type="number"
                  min="0"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder={t('variantSpecs.weightExample')}
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">{t('variantSpecs.price')}</label>
                <input
                  type="number"
                  min="0"
                  value={priceMinorUnits}
                  onChange={(e) => setPriceMinorUnits(e.target.value)}
                  placeholder={t('variantSpecs.priceExample')}
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Packaging Dimensions */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-700">
                {t('variantSpecs.packagingDimensions')}
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={t('variantSpecs.length')}
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                <input
                  type="number"
                  min="0"
                  placeholder={t('variantSpecs.width')}
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                <input
                  type="number"
                  min="0"
                  placeholder={t('variantSpecs.height')}
                  value={heightMm}
                  onChange={(e) => setHeightMm(e.target.value)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim() || !skuCode.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('variantSpecs.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
