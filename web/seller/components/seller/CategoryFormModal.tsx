'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { StoreCategory, StoreCategoryInput } from '@/lib/api/types';

// CategoryFormModal creates or edits a store category. The English name is
// required; Arabic is optional with display fallback. The slug is
// auto-suggested from the English name until the seller edits it manually.
// Parent choices are limited to the current store's categories, excluding the
// category itself and its descendants when editing.

export interface CategoryFormModalProps {
  isOpen: boolean;
  storeId: string;
  categories: StoreCategory[];
  editing: StoreCategory | null;
  labels: {
    create: string;
    edit: string;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    slug: string;
    slugHint: string;
    slugTaken: string;
    parent: string;
    parentNone: string;
    sortOrder: string;
    save: string;
    cancel: string;
    parentSelfError: string;
    loading: string;
  };
  onClose: () => void;
  onSaved: (category: StoreCategory, isNew: boolean) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function descendantIds(categories: StoreCategory[], rootId: string): Set<string> {
  const byParent = new Map<string | null, string[]>();
  for (const category of categories) {
    const key = category.parent_category_id;
    byParent.set(key, [...(byParent.get(key) ?? []), category.id]);
  }
  const out = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of byParent.get(current) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        queue.push(child);
      }
    }
  }
  return out;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function CategoryFormModal({
  isOpen,
  storeId,
  categories,
  editing,
  labels,
  onClose,
  onSaved
}: CategoryFormModalProps) {
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNameEn(editing?.translations?.en?.name ?? '');
    setNameAr(editing?.translations?.ar?.name ?? '');
    setDescriptionEn(editing?.translations?.en?.description ?? '');
    setDescriptionAr(editing?.translations?.ar?.description ?? '');
    setSlug(editing?.slug ?? '');
    setSlugEdited(Boolean(editing));
    setParentId(editing?.parent_category_id ?? '');
    setSortOrder(editing?.sort_order ?? 0);
    setFieldErrors({});
    setFormError(null);
  }, [isOpen, editing]);

  const selectableParents = useMemo(() => {
    if (!editing) return categories;
    const excluded = descendantIds(categories, editing.id);
    return categories.filter((category) => !excluded.has(category.id));
  }, [categories, editing]);

  if (!isOpen) return null;

  const handleNameEn = (value: string) => {
    setNameEn(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!nameEn.trim()) errors.nameEn = labels.nameEn;
    if (!slug) {
      errors.slug = labels.slug;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = labels.slugHint;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const translations: Record<string, { name: string; description: string }> = {
        en: { name: nameEn.trim(), description: descriptionEn }
      };
      if (nameAr.trim()) {
        translations.ar = { name: nameAr.trim(), description: descriptionAr };
      }
      if (editing) {
        const updated = await sellerApi.updateStoreCategory(storeId, editing.id, {
          slug,
          parent_category_id: parentId || null,
          sort_order: sortOrder,
          translations
        });
        onSaved(updated, false);
      } else {
        const input: StoreCategoryInput = {
          slug,
          parent_category_id: parentId || null,
          sort_order: sortOrder,
          translations
        };
        const created = await sellerApi.createStoreCategory(storeId, input);
        onSaved(created, true);
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        setFieldErrors((prev) => ({ ...prev, slug: labels.slugTaken }));
      } else {
        setFormError((error as Error)?.message || labels.parentSelfError);
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={editing ? labels.edit : labels.create}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? labels.edit : labels.create}</h2>
          <button type="button" onClick={onClose} aria-label={labels.cancel} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="category-name-en" className="mb-1 block text-sm font-medium text-slate-700">
              {labels.nameEn} <span className="text-rose-500">*</span>
            </label>
            <input
              id="category-name-en"
              value={nameEn}
              onChange={(event) => handleNameEn(event.target.value)}
              className={inputClass}
              dir="ltr"
              required
            />
            {fieldErrors.nameEn && <p className="mt-1 text-xs text-rose-600">{fieldErrors.nameEn}</p>}
          </div>

          <div>
            <label htmlFor="category-name-ar" className="mb-1 block text-sm font-medium text-slate-700">
              {labels.nameAr}
            </label>
            <input
              id="category-name-ar"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              className={inputClass}
              dir="rtl"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category-desc-en" className="mb-1 block text-sm font-medium text-slate-700">
                {labels.descriptionEn}
              </label>
              <textarea
                id="category-desc-en"
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
                rows={2}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="category-desc-ar" className="mb-1 block text-sm font-medium text-slate-700">
                {labels.descriptionAr}
              </label>
              <textarea
                id="category-desc-ar"
                value={descriptionAr}
                onChange={(event) => setDescriptionAr(event.target.value)}
                rows={2}
                className={inputClass}
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label htmlFor="category-slug" className="mb-1 block text-sm font-medium text-slate-700">
              {labels.slug} <span className="text-rose-500">*</span>
            </label>
            <input
              id="category-slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              className={inputClass}
              dir="ltr"
              required
            />
            <p className="mt-1 text-xs text-slate-500">{labels.slugHint}</p>
            {fieldErrors.slug && <p className="mt-1 text-xs text-rose-600">{fieldErrors.slug}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category-parent" className="mb-1 block text-sm font-medium text-slate-700">
                {labels.parent}
              </label>
              <select
                id="category-parent"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className={inputClass}
              >
                <option value="">{labels.parentNone}</option>
                {selectableParents.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.translations?.en?.name || category.translations?.ar?.name || category.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category-sort-order" className="mb-1 block text-sm font-medium text-slate-700">
                {labels.sortOrder}
              </label>
              <input
                id="category-sort-order"
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </div>

          {formError && <p className="text-sm text-rose-600">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {labels.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
