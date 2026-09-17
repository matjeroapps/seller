'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';

export default function NewStoreProductPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug) {
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
        name,
        slug
      });
      router.push(`/dashboard/stores/${store_id}/catalog/products/${product.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
      setSaving(false);
    }
  };

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
          <h1 className="text-xl font-bold text-slate-900">Create Seller Product</h1>
          <p className="text-xs text-slate-500">Add a new seller-owned draft product and initial store listing</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Premium Cotton T-Shirt"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Product Slug *</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. premium-cotton-t-shirt"
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">Unique URL identifier for the product catalog</p>
        </div>

        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products`}
            className="px-3 py-1.5 text-xs text-slate-600 hover:underline"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Draft Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
