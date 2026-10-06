'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { AlertCircle, FolderTree, Loader2, Plus, RefreshCw } from 'lucide-react';
import { CategoryTree } from '@/components/seller/CategoryTree';
import { CategoryFormModal } from '@/components/seller/CategoryFormModal';
import { ConfirmModal } from '@/components/seller/ConfirmModal';
import { ApiError, sellerApi } from '@/lib/api/client';
import { useTranslation } from '@/lib/i18n/locale-context';
import type { CategoryStatus, StoreCategory } from '@/lib/api/types';

// Store-scoped categories screen. All data flows through the Seller BFF; the
// tree is assembled client-side from the flat node list.

type PendingAction =
  | { kind: 'archive'; category: StoreCategory }
  | { kind: 'deactivate'; category: StoreCategory }
  | { kind: 'delete'; category: StoreCategory }
  | null;

export default function StoreCategoriesPage({
  params
}: {
  params: Promise<{ store_id: string }> | { store_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string }>)
      : (params as unknown as { store_id: string }) || {};
  const { store_id: storeId } = unwrappedParams;

  const { t, locale } = useTranslation();

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreCategory | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadCategories = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    sellerApi
      .listStoreCategories(storeId)
      .then((items) => {
        setCategories(items);
        setLoading(false);
      })
      .catch((error) => {
        setLoadError(error instanceof ApiError ? error.message : t('categories.errorGeneric'));
        setLoading(false);
      });
  }, [storeId, t]);

  useEffect(() => {
    // Reset per-store state so switching stores never shows stale data.
    setCategories([]);
    setFlash(null);
    setPending(null);
    setFormOpen(false);
    loadCategories();
  }, [storeId, loadCategories]);

  const labels = {
    create: t('categories.create'),
    edit: t('common.edit'),
    nameEn: t('categories.nameEn'),
    nameAr: t('categories.nameAr'),
    descriptionEn: t('categories.descriptionEn'),
    descriptionAr: t('categories.descriptionAr'),
    slug: t('categories.slug'),
    slugHint: t('categories.slugHint'),
    slugTaken: t('categories.slugTaken'),
    parent: t('categories.parent'),
    parentNone: t('categories.parentNone'),
    sortOrder: t('categories.sortOrder'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    parentSelfError: t('categories.parentSelfError'),
    loading: t('categories.loading'),
    archive: t('categories.archive'),
    restore: t('categories.restore'),
    activate: t('categories.activate'),
    deactivate: t('categories.deactivate'),
    moveUp: t('categories.moveUp'),
    moveDown: t('categories.moveDown'),
    products: t('categories.products'),
    subcategories: t('categories.subcategories'),
    delete: t('common.delete')
  };

  const applyStatus = async (category: StoreCategory, status: CategoryStatus) => {
    setBusy(true);
    setFlash(null);
    try {
      const updated = await sellerApi.updateStoreCategoryStatus(storeId, category.id, status);
      setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFlash(t('categories.saved'));
    } catch (error) {
      setFlash(error instanceof ApiError ? error.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (category: StoreCategory, direction: 'up' | 'down') => {
    // Reorder within the category's sibling set (same parent).
    const siblings = categories
      .filter((item) => (item.parent_category_id ?? null) === (category.parent_category_id ?? null))
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.created_at.localeCompare(b.created_at) ||
          a.id.localeCompare(b.id)
      );
    const index = siblings.findIndex((item) => item.id === category.id);
    const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
    if (!swapWith) return;

    const order = [category, swapWith].map((item) => ({
      id: item.id,
      sort_order: item.id === category.id ? swapWith.sort_order : category.sort_order
    }));
    setBusy(true);
    setFlash(null);
    try {
      await sellerApi.reorderStoreCategories(storeId, order);
      setCategories((prev) =>
        prev.map((item) => {
          const entry = order.find((o) => o.id === item.id);
          return entry ? { ...item, sort_order: entry.sort_order } : item;
        })
      );
      setFlash(t('categories.reordered'));
    } catch (error) {
      setFlash(error instanceof ApiError ? error.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    setConfirmLoading(true);
    try {
      if (pending.kind === 'delete') {
        await sellerApi.deleteStoreCategory(storeId, pending.category.id);
        setCategories((prev) => prev.filter((item) => item.id !== pending.category.id));
        setFlash(t('categories.deleted'));
      } else {
        const status: CategoryStatus = pending.kind === 'archive' ? 'archived' : 'inactive';
        const updated = await sellerApi.updateStoreCategoryStatus(storeId, pending.category.id, status);
        setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setFlash(t('categories.saved'));
      }
      setPending(null);
    } catch (error) {
      setFlash(error instanceof ApiError ? error.message : t('errors.generic'));
      setPending(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const pendingName = pending
    ? pending.category.translations?.ar?.name && locale === 'ar'
      ? pending.category.translations.ar.name
      : pending.category.translations?.en?.name || pending.category.slug
    : '';

  const pendingCounts = pending
    ? t('categories.confirmArchiveBody')
        .replace('{products}', String(pending.category.product_count))
        .replace('{children}', String(pending.category.child_count))
    : '';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FolderTree className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            {t('categories.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('categories.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('categories.create')}
        </button>
      </div>

      {flash && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {flash}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('categories.loading')}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" aria-hidden="true" />
          <p className="mb-3 text-sm text-rose-700">{loadError}</p>
          <button
            type="button"
            onClick={loadCategories}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('errors.retry')}
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FolderTree className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-800">{t('categories.emptyTitle')}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{t('categories.emptyBody')}</p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('categories.createFirst')}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-4">
          <CategoryTree
            categories={categories}
            locale={locale}
            busy={busy}
            labels={labels}
            onEdit={(category) => {
              setEditing(category);
              setFormOpen(true);
            }}
            onStatus={(category, status) => {
              if (status === 'archived') {
                setPending({ kind: 'archive', category });
              } else if (status === 'inactive') {
                setPending({ kind: 'deactivate', category });
              } else {
                void applyStatus(category, status);
              }
            }}
            onDelete={(category) => setPending({ kind: 'delete', category })}
            onMove={handleMove}
          />
        </div>
      )}

      <CategoryFormModal
        isOpen={formOpen}
        storeId={storeId}
        categories={categories}
        editing={editing}
        labels={labels}
        onClose={() => setFormOpen(false)}
        onSaved={(category, isNew) => {
          setCategories((prev) => {
            if (isNew) return [...prev, category];
            return prev.map((item) => (item.id === category.id ? category : item));
          });
          setFormOpen(false);
          setFlash(t('categories.saved'));
        }}
      />

      <ConfirmModal
        isOpen={pending !== null}
        title={
          pending?.kind === 'delete'
            ? t('categories.confirmDeleteTitle')
            : pending?.kind === 'archive'
              ? t('categories.confirmArchiveTitle')
              : t('categories.confirmDeactivateTitle')
        }
        description={
          pending?.kind === 'delete'
            ? `${t('categories.confirmDeleteBody')} — ${pendingName}`
            : pending?.kind === 'deactivate'
              ? `${pendingName} — ${t('categories.statusInactive')}`
              : `${pendingName} — ${pendingCounts}`
        }
        variant={pending?.kind === 'delete' ? 'danger' : 'warning'}
        loading={confirmLoading}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
