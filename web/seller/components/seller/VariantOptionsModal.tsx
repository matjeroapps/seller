'use client';

import { useState, useEffect, useId, useRef, FormEvent } from 'react';
import { X, Plus, Trash2, Layers, Loader2 } from 'lucide-react';
import type { CreateProductVariantPayload } from '@/lib/api/types';

export interface VariantOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProductVariantPayload) => Promise<void>;
  loading?: boolean;
}

interface AttributeRow {
  attributeId: string;
  attributeValueId: string;
}

export function VariantOptionsModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}: VariantOptionsModalProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'active' | 'draft' | 'inactive'>('active');
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
      setCode('');
      setStatus('active');
      setSkuCode('');
      setBarcode('');
      setPriceMinorUnits('');
      setWeightGrams('');
      setLengthMm('');
      setWidthMm('');
      setHeightMm('');
      setAttributes([]);
      setValidationError(null);

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
      setValidationError('Variant code is required.');
      return;
    }

    const trimmedSkuCode = skuCode.trim();
    if (!trimmedSkuCode) {
      setValidationError('SKU code is required for physical specifications.');
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
      status,
      sku_code: trimmedSkuCode,
      barcode: barcode.trim() ? barcode.trim() : undefined,
      attribute_values: validAttributes.length > 0 ? validAttributes : undefined,
    };

    if (weightGrams.trim()) {
      const parsedWeight = parseInt(weightGrams.trim(), 10);
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        setValidationError('Weight must be a non-negative integer in grams.');
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
        setValidationError('Price must be a non-negative integer in minor units.');
        return;
      }
      payload.price_minor_units = parsedPrice;
    }

    try {
      await onSubmit(payload);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to create variant with specifications.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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
                New Variant & Physical SKU Specs
              </h2>
              <p className="text-xs text-slate-500">
                Configure option dimensions, SKU barcode, weight, and dimensional packaging.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
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
              1. Variant Identity
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Variant Code <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. red-xl"
                  required
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                >
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Option Values / Attributes */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  2. Variant Attributes
                </h3>
                <p className="text-xs text-slate-500">
                  Link option attributes (e.g. color, size) to this variant.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAttribute}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Attribute
              </button>
            </div>

            {attributes.length === 0 ? (
              <p className="mt-3 text-xs italic text-slate-400">
                No attribute values added yet. Click &quot;Add Attribute&quot; to specify options like Color or Size.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Attribute ID (e.g. color)"
                      value={attr.attributeId}
                      onChange={(e) => handleUpdateAttribute(idx, 'attributeId', e.target.value)}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Attribute Value ID (e.g. red)"
                      value={attr.attributeValueId}
                      onChange={(e) => handleUpdateAttribute(idx, 'attributeValueId', e.target.value)}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(idx)}
                      disabled={loading}
                      aria-label="Remove attribute"
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
              3. SKU & Physical Dimensions
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  SKU Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value)}
                  placeholder="e.g. SKU-RED-XL"
                  required
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Barcode (GTIN/EAN)</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. 6281000999911"
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Weight (Grams)</label>
                <input
                  type="number"
                  min="0"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="e.g. 450"
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Price (Minor Units)</label>
                <input
                  type="number"
                  min="0"
                  value={priceMinorUnits}
                  onChange={(e) => setPriceMinorUnits(e.target.value)}
                  placeholder="e.g. 15000 for 150.00"
                  disabled={loading}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Packaging Dimensions */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-700">
                Packaging Dimensions (Length × Width × Height in mm)
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Length (mm)"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Width (mm)"
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Height (mm)"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim() || !skuCode.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Variant with Specs
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
