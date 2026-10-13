'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CategoryPicker } from '@/components/seller/CategoryPicker';
import { AuthoringAssistantPanel } from '@/components/seller/AuthoringAssistantPanel';
import { useTranslation } from '@/lib/i18n/locale-context';
import { sellerApi } from '@/lib/api/client';
import type { AuthoringFieldProposal, StoreCategory } from '@/lib/api/types';

export default function NewStoreProductPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const router = useRouter();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const loadCategories = () => {
    setCategoryLoadError(null);
    sellerApi
      .listStoreCategories(store_id)
      .then((items) => setCategories(items))
      .catch((err: Error) => setCategoryLoadError(err.message || t('products.errorLoadCategories')));
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store_id]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setSaving(true);
    setError(null);
    try {
      const product = await sellerApi.createStoreProduct(store_id, {
        slug,
        translations: [
          { locale: 'en', name, description },
          ...(nameAr.trim() || descriptionAr.trim() ? [{ locale: 'ar', name: nameAr, description: descriptionAr }] : [])
        ],
        store_category_ids: selectedCategoryIds
      });
      router.push(`/dashboard/stores/${store_id}/catalog/products/${product.id}`);
    } catch (err: any) {
      setError(err.message || t('products.errorCreateProduct'));
      setSaving(false);
    }
  };

  const authoringBrief = [
    name.trim() ? `Product name: ${name.trim()}` : '',
    nameAr.trim() ? `اسم المنتج: ${nameAr.trim()}` : '',
    description.trim() ? `Product description: ${description.trim()}` : '',
    descriptionAr.trim() ? `وصف المنتج: ${descriptionAr.trim()}` : ''
  ].filter(Boolean).join('\n\n');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/stores/${store_id}/catalog/products`}
          className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('products.newTitle')}</h1>
          <p className="text-xs text-slate-500">{t('products.newSubtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('products.labelEnTitle')}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('products.namePlaceholder')}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('products.labelArTitle')}</label>
          <input
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t('products.labelArTitle')}
            dir="rtl"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('products.slugRequiredLabel')}</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(e.target.value);
            }}
            placeholder={t('products.slugPlaceholder')}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">{t('products.slugHelp')}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="product-create-description">{t('products.labelEnDescription')}</label>
          <textarea
            id="product-create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="product-create-description"
            placeholder={t('products.descriptionPlaceholder')}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="product-create-description-ar">{t('products.labelArDescription')}</label>
          <textarea
            id="product-create-description-ar"
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            dir="rtl"
            placeholder={t('products.labelArDescription')}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <AuthoringAssistantPanel
          storeId={store_id}
          brief={authoringBrief}
          onApplyFields={(fields: AuthoringFieldProposal[]) => {
            const get = (key: string, locale: string) => fields.find((field) => field.field_key === key && field.locale === locale)?.value;
            const nameEn = get('name', 'en');
            const nameArabic = get('name', 'ar');
            const descriptionEn = get('description', 'en');
            const descriptionArabic = get('description', 'ar');
            if (nameEn) handleNameChange(nameEn);
            if (nameArabic) setNameAr(nameArabic);
            if (descriptionEn) setDescription(descriptionEn);
            if (descriptionArabic) setDescriptionAr(descriptionArabic);
          }}
        />

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-slate-700">{t('products.categoriesLabel')}</span>
          <CategoryPicker
            storeId={store_id}
            categories={categories}
            selectedIds={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
            loadError={categoryLoadError}
            onRetry={loadCategories}
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products`}
            className="px-3 py-1.5 text-xs text-slate-600 hover:underline"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('products.creating') : t('products.createDraft')}
          </button>
        </div>
      </form>

    </div>
  );
}
