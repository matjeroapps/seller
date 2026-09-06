import React from 'react';
import type { ApiClient, SellerCategory } from '../lib/api';
import { inputStepForMinorUnit, majorToMinor, minorToMajor } from '../lib/money';

type ProductMedia = {
  id: string;
  media_type: string;
  uri: string;
  storage_key?: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
};

type ProductDetail = {
  product: { id: string; slug: string; status: string };
  source: string;
  translations: Array<{ locale: string; name: string; description: string }>;
  category_ids: string[];
  variants: Array<{ id: string; code: string; status: string }>;
  skus: Array<{ id: string; variant_id: string; code: string; barcode?: string; status: string }>;
  media: ProductMedia[];
  listing: { id: string; status: string };
  current_price?: { amount: number; currency: string } | null;
  inventory_summary: { total_on_hand: number; total_reserved: number; total_available: number };
  presentation: {
    seller_listing_id: string;
    purchase_behavior: 'inherit' | 'add_to_cart' | 'buy_now';
    sections: PresentationSection[];
  };
  purchase_behavior: 'add_to_cart' | 'buy_now';
  publish_readiness: { is_ready: boolean; reasons: string[] };
};

type PresentationSection = {
  id: string;
  type: string;
  enabled: boolean;
  sort_order: number;
  content: Record<string, any>;
};

type SectionType = 'description' | 'highlights' | 'image_text' | 'specifications' | 'faq' | 'final_cta';

const SECTION_TYPES: SectionType[] = ['description', 'highlights', 'image_text', 'specifications', 'faq', 'final_cta'];

/**
 * Empty localized content template for a newly added section of `type`.
 * Localized content always lives under `content: { en: {...}, ar: {...} }`.
 */
function emptyContentFor(type: SectionType): Record<string, any> {
  switch (type) {
    case 'description':
      return { en: { heading: '', body: '' }, ar: { heading: '', body: '' } };
    case 'highlights':
      return { en: { title: '', items: [] }, ar: { title: '', items: [] } };
    case 'image_text':
      return { media_id: '', en: { heading: '', body: '' }, ar: { heading: '', body: '' } };
    case 'specifications':
      return { en: { items: [{ key: '', value: '' }] }, ar: { items: [{ key: '', value: '' }] } };
    case 'faq':
      return { en: { items: [{ question: '', answer: '' }] }, ar: { items: [{ question: '', answer: '' }] } };
    case 'final_cta':
      return { en: { title: '', body: '', action: 'add_to_cart' }, ar: { title: '', body: '' } };
  }
}

/** Light client-side validation for enabled sections; returns an error message or null. */
function validateSections(sections: PresentationSection[]): string | null {
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (!sec.enabled) continue;
    const where = `Section ${i + 1} (${sec.type})`;
    const en = sec.content?.en ?? {};
    switch (sec.type) {
      case 'description':
        if (!String(en.body ?? '').trim()) return `${where}: English body text is required.`;
        break;
      case 'highlights': {
        if (!String(en.title ?? '').trim()) return `${where}: English title is required.`;
        const items = (en.items as string[]) ?? [];
        if (!items.some((it) => String(it ?? '').trim())) return `${where}: at least one English highlight is required.`;
        break;
      }
      case 'image_text':
        if (!String(sec.content?.media_id ?? '').trim()) return `${where}: an image must be selected.`;
        if (!String(en.heading ?? '').trim()) return `${where}: English heading is required.`;
        break;
      case 'specifications': {
        const items = (en.items as Array<{ key?: string; value?: string }>) ?? [];
        if (items.length === 0 || !items.some((it) => String(it.key ?? '').trim())) {
          return `${where}: at least one specification key/value pair is required.`;
        }
        break;
      }
      case 'faq': {
        const items = (en.items as Array<{ question?: string; answer?: string }>) ?? [];
        if (items.length === 0 || !items.some((it) => String(it.question ?? '').trim())) {
          return `${where}: at least one question is required.`;
        }
        break;
      }
      case 'final_cta':
        if (!String(en.title ?? '').trim()) return `${where}: English title is required.`;
        break;
      default:
        break;
    }
  }
  return null;
}

/** Human-readable label for a section type. */
function sectionTypeLabel(type: string): string {
  switch (type) {
    case 'description':
      return 'Description';
    case 'highlights':
      return 'Highlights';
    case 'image_text':
      return 'Image & Text';
    case 'specifications':
      return 'Specifications';
    case 'faq':
      return 'FAQ';
    case 'final_cta':
      return 'Final Call-to-Action';
    default:
      return type;
  }
}

type ProductsPanelProps = {
  api: ApiClient;
  storeId: string;
  locale: string;
  copy: Record<string, string>;
};

export function ProductsPanel({ api, storeId, locale, copy }: ProductsPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [storeCurrency, setStoreCurrency] = React.useState('EGP');
  const [storeCurrencyMinorUnit, setStoreCurrencyMinorUnit] = React.useState(2);
  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'list' | 'editor'>('list');
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null);
  const [productDetail, setProductDetail] = React.useState<ProductDetail | null>(null);

  // Wizard step state
  const [editorStep, setEditorStep] = React.useState<'general' | 'variants' | 'media' | 'pricing' | 'presentation' | 'publish'>('general');

  // Form states
  const [slug, setSlug] = React.useState('');
  const [nameEn, setNameEn] = React.useState('');
  const [descEn, setDescEn] = React.useState('');
  const [nameAr, setNameAr] = React.useState('');
  const [descAr, setDescAr] = React.useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<SellerCategory[]>([]);
  const [variantCode, setVariantCode] = React.useState('Default');
  const [skuCode, setSkuCode] = React.useState('SKU-001');
  const [skuBarcode, setSkuBarcode] = React.useState('');
  const [priceMajor, setPriceMajor] = React.useState('100.00');
  const [onHandStock, setOnHandStock] = React.useState('10');
  const [purchaseBehavior, setPurchaseBehavior] = React.useState<'inherit' | 'add_to_cart' | 'buy_now'>('inherit');

  // Media step: per-media alt-text drafts keyed by media id.
  const [altDrafts, setAltDrafts] = React.useState<Record<string, string>>({});

  // Presentation step state
  const [sections, setSections] = React.useState<PresentationSection[]>([]);
  const [newSectionType, setNewSectionType] = React.useState<SectionType>('description');

  // Sorted gallery view of the product's media (order used for move up/down).
  const sortedMedia = React.useMemo(() => {
    return [...(productDetail?.media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  }, [productDetail]);

  const loadProducts = React.useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products?locale=${locale}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        setError('Failed to load products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading products');
    } finally {
      setLoading(false);
    }
  }, [api, storeId, locale]);

  // Fetch store market currency when store changes.
  React.useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}`);
        if (res.ok) {
          const store = await res.json();
          const mktCode: string = store.market_code || 'EG';
          const mktRes = await api.get(`/v1/markets/${encodeURIComponent(mktCode)}?locale=${locale}`);
          if (mktRes.ok) {
            const mkt = await mktRes.json();
            if (mkt?.currency?.code) setStoreCurrency(mkt.currency.code);
            if (mkt?.currency?.minor_unit != null) setStoreCurrencyMinorUnit(mkt.currency.minor_unit);
          }
        }
      } catch {
        // Non-fatal: fallback to EGP
      }
    })();
  }, [api, storeId, locale]);

  // Fetch the store's categories once per store. If the endpoint is not
  // available (or fails), degrade gracefully to an empty list.
  React.useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      try {
        const cats = await api.listStoreCategories(storeId);
        if (!cancelled) setCategories(cats);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, storeId]);

  // Seed alt-text drafts for newly loaded media without clobbering in-flight edits.
  React.useEffect(() => {
    if (!productDetail) return;
    setAltDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const m of productDetail.media) {
        next[m.id] = m.id in prev ? prev[m.id] : m.alt_text;
      }
      return next;
    });
  }, [productDetail]);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const refreshProductDetail = React.useCallback(async (): Promise<ProductDetail | null> => {
    if (!editingProductId) return null;
    const res = await api.get(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}?locale=${locale}`
    );
    if (!res.ok) return null;
    const detail: ProductDetail = await res.json();
    setProductDetail(detail);
    return detail;
  }, [api, storeId, locale, editingProductId]);

  const handleStartCreate = () => {
    setEditingProductId(null);
    setProductDetail(null);
    setSlug(`product-${Date.now().toString().slice(-6)}`);
    setNameEn('');
    setDescEn('');
    setNameAr('');
    setDescAr('');
    setSelectedCategoryIds([]);
    setVariantCode('Default');
    setSkuCode(`SKU-${Date.now().toString().slice(-4)}`);
    setSkuBarcode('');
    setPriceMajor('100.00');
    setOnHandStock('10');
    setPurchaseBehavior('inherit');
    setSections([]);
    setEditorStep('general');
    setActiveTab('editor');
  };

  const handleEditProduct = async (productId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}?locale=${locale}`);
      if (res.ok) {
        const detail: ProductDetail = await res.json();
        setEditingProductId(productId);
        setProductDetail(detail);
        setSlug(detail.product.slug);

        const trEn = detail.translations.find((t) => t.locale === 'en');
        const trAr = detail.translations.find((t) => t.locale === 'ar');
        setNameEn(trEn?.name || '');
        setDescEn(trEn?.description || '');
        setNameAr(trAr?.name || '');
        setDescAr(trAr?.description || '');
        setSelectedCategoryIds(detail.category_ids || []);

        if (detail.variants[0]) setVariantCode(detail.variants[0].code);
        if (detail.skus[0]) {
          setSkuCode(detail.skus[0].code);
          setSkuBarcode(detail.skus[0].barcode || '');
        }

        if (detail.current_price) {
          setPriceMajor(minorToMajor(detail.current_price.amount, storeCurrencyMinorUnit));
        }

        setOnHandStock(String(detail.inventory_summary.total_on_hand || 0));
        setPurchaseBehavior(detail.presentation?.purchase_behavior || 'inherit');
        setSections(detail.presentation?.sections || []);

        setEditorStep('general');
        setActiveTab('editor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading product detail');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  /** Parse a seller API error response body into a message string. */
  const readErrorMessage = async (res: Response, fallback: string): Promise<string> => {
    try {
      const data = await res.json();
      return data?.error?.message || data?.message || fallback;
    } catch {
      return fallback;
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const translations = [
        { locale: 'en', name: nameEn || slug, description: descEn },
        { locale: 'ar', name: nameAr || nameEn || slug, description: descAr }
      ];
      const body = { slug, translations, category_ids: selectedCategoryIds };

      if (!editingProductId) {
        // Create new seller product
        const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products`, body);
        if (res.ok) {
          const detail: ProductDetail = await res.json();
          setEditingProductId(detail.product.id);
          setProductDetail(detail);
          setEditorStep('variants');
        } else {
          setError(await readErrorMessage(res, 'Failed to create product'));
        }
      } else {
        // Update existing product
        const res = await api.put(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}`, body);
        if (res.ok) {
          const detail: ProductDetail = await res.json();
          setProductDetail(detail);
          setEditorStep('variants');
        } else {
          setError(await readErrorMessage(res, 'Failed to update product'));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariantAndSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId) return;
    const base = `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}`;
    try {
      setLoading(true);
      setError(null);

      const existingVariant = productDetail?.variants[0];
      let variantId = existingVariant?.id;
      if (variantId) {
        // Update the existing variant with the edited values.
        const vRes = await api.put(`${base}/variants/${encodeURIComponent(variantId)}`, {
          code: variantCode,
          status: 'active'
        });
        if (!vRes.ok) {
          setError(await readErrorMessage(vRes, 'Failed to update variant'));
          return;
        }
      } else {
        const vRes = await api.post(`${base}/variants`, { code: variantCode, status: 'active' });
        if (!vRes.ok) {
          setError(await readErrorMessage(vRes, 'Failed to create variant'));
          return;
        }
        const v = await vRes.json();
        variantId = v.id;
      }

      if (!variantId) return;

      const existingSku = productDetail?.skus[0];
      const skuBody = { code: skuCode, barcode: skuBarcode || null, status: 'active' };
      if (existingSku?.id) {
        // Update the existing SKU with the edited values.
        const sRes = await api.put(
          `${base}/variants/${encodeURIComponent(variantId)}/skus/${encodeURIComponent(existingSku.id)}`,
          skuBody
        );
        if (!sRes.ok) {
          setError(await readErrorMessage(sRes, 'Failed to update SKU'));
          return;
        }
      } else {
        const sRes = await api.post(`${base}/variants/${encodeURIComponent(variantId)}/skus`, skuBody);
        if (!sRes.ok) {
          setError(await readErrorMessage(sRes, 'Failed to create SKU'));
          return;
        }
      }

      await refreshProductDetail();
      setEditorStep('media');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variant and SKU');
    } finally {
      setLoading(false);
    }
  };

  const handlePickAndUploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProductId) return;
    // Reset file input so same file can be re-selected
    e.target.value = '';
    try {
      setLoading(true);
      setError(null);
      // 1. Request presigned upload URL from Core (via Seller API)
      const presignRes = await api.post(
        `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/media/uploads`,
        { filename: file.name, content_type: file.type, size_bytes: file.size }
      );
      if (!presignRes.ok) {
        setError(await readErrorMessage(presignRes, 'Failed to get upload URL'));
        return;
      }
      const presignData: { upload_url: string; storage_key: string; upload_token: string } = await presignRes.json();

      // 2. PUT file directly to S3 presigned URL (browser-native, bypasses Seller API)
      const putRes = await fetch(presignData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setError(`S3 upload failed: ${putRes.status} ${putRes.statusText}`);
        return;
      }

      // 3. Complete upload — pass the upload_token back to Core for verification
      const completeRes = await api.post(
        `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/media`,
        {
          storage_key: presignData.storage_key,
          upload_token: presignData.upload_token,
          alt_text: file.name.replace(/\.[^.]+$/, '') || (nameEn || 'Product Image'),
          sort_order: (productDetail?.media.length || 0) + 1,
          is_primary: (productDetail?.media.length || 0) === 0,
        }
      );
      if (!completeRes.ok) {
        setError(await readErrorMessage(completeRes, 'Failed to register image'));
        return;
      }

      // 4. Refresh product detail so the gallery re-renders
      await refreshProductDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAltText = async (media: ProductMedia) => {
    if (!editingProductId) return;
    try {
      setLoading(true);
      setError(null);
      await api.updateProductMedia(storeId, editingProductId, media.id, {
        alt_text: altDrafts[media.id] ?? media.alt_text,
        sort_order: media.sort_order,
        is_primary: media.is_primary
      });
      await refreshProductDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alt text');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimaryMedia = async (media: ProductMedia) => {
    if (!editingProductId || media.is_primary) return;
    try {
      setLoading(true);
      setError(null);
      await api.updateProductMedia(storeId, editingProductId, media.id, {
        alt_text: media.alt_text,
        sort_order: media.sort_order,
        is_primary: true
      });
      await refreshProductDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set primary image');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveMedia = async (index: number, direction: -1 | 1) => {
    if (!editingProductId) return;
    const target = index + direction;
    if (target < 0 || target >= sortedMedia.length) return;
    const a = sortedMedia[index];
    const b = sortedMedia[target];
    try {
      setLoading(true);
      setError(null);
      // Swap sort_order values, then persist both records.
      await api.updateProductMedia(storeId, editingProductId, a.id, {
        alt_text: a.alt_text,
        sort_order: b.sort_order,
        is_primary: a.is_primary
      });
      await api.updateProductMedia(storeId, editingProductId, b.id, {
        alt_text: b.alt_text,
        sort_order: a.sort_order,
        is_primary: b.is_primary
      });
      await refreshProductDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder images');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async (media: ProductMedia) => {
    if (!editingProductId) return;
    try {
      setLoading(true);
      setError(null);
      await api.deleteProductMedia(storeId, editingProductId, media.id);
      // The backend promotes the earliest remaining image to primary when the
      // primary is deleted; the refetch below reflects the server state.
      await refreshProductDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePricingAndInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId || !productDetail) return;
    try {
      setLoading(true);
      // Set Listing Price
      const amountMinor = majorToMinor(priceMajor || '0', storeCurrencyMinorUnit);
      await api.post(`/v1/seller/listings/${encodeURIComponent(productDetail.listing.id)}/price`, {
        amount_minor: amountMinor,
        currency: storeCurrency
      });

      // Ensure store location & inventory
      let locsRes = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/locations`);
      let locs = locsRes.ok ? await locsRes.json() : [];
      let locId = locs[0]?.id;
      if (!locId) {
        const createLocRes = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/locations`, {
          code: 'default',
          name: 'Main Location',
          type: 'warehouse',
          status: 'active'
        });
        if (createLocRes.ok) {
          const loc = await createLocRes.json();
          locId = loc.id;
        }
      }

      if (locId && productDetail.skus[0]) {
        const targetOnHand = parseInt(onHandStock || '0', 10);
        const invRes = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory`);
        const existingInv = invRes.ok ? await invRes.json() : [];
        const snap = existingInv.find((i: any) => i.sku_id === productDetail.skus[0].id);

        if (!snap) {
          await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory/snapshots`, {
            location_id: locId,
            sku_id: productDetail.skus[0].id,
            on_hand_qty: targetOnHand
          });
        } else {
          const delta = targetOnHand - snap.on_hand_qty;
          if (delta !== 0) {
            await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory/${encodeURIComponent(snap.id)}/adjustments`, {
              quantity_delta: delta,
              reason: 'Manual dashboard update'
            });
          }
        }
      }

      // Refresh detail
      await refreshProductDetail();

      setEditorStep('presentation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pricing/Inventory save failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Presentation section helpers ---

  const updateSection = (index: number, updater: (sec: PresentationSection) => PresentationSection) => {
    setSections((prev) => prev.map((sec, i) => (i === index ? updater(sec) : sec)));
  };

  const updateLocalizedField = (index: number, lang: 'en' | 'ar', patch: Record<string, any>) => {
    updateSection(index, (sec) => ({
      ...sec,
      content: {
        ...sec.content,
        [lang]: { ...(sec.content?.[lang] ?? {}), ...patch }
      }
    }));
  };

  const getLocalizedItems = (sec: PresentationSection, lang: 'en' | 'ar'): any[] => {
    const items = sec.content?.[lang]?.items;
    return Array.isArray(items) ? items : [];
  };

  const updateLocalizedItems = (index: number, lang: 'en' | 'ar', items: any[]) => {
    updateLocalizedField(index, lang, { items });
  };

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}-${prev.length}`,
        type: newSectionType,
        enabled: true,
        sort_order: prev.length + 1,
        content: emptyContentFor(newSectionType)
      }
    ]);
  };

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      // Renumber so sort_order always matches visual order.
      return next.map((sec, i) => ({ ...sec, sort_order: i + 1 }));
    });
  };

  const handleDeleteSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index).map((sec, i) => ({ ...sec, sort_order: i + 1 })));
  };

  const handleSavePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productDetail || !editingProductId) return;
    const validationError = validateSections(sections);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.put(
        `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(productDetail.listing.id)}/presentation`,
        {
          seller_listing_id: productDetail.listing.id,
          schema_version: 1,
          purchase_behavior: purchaseBehavior,
          sections
        }
      );
      if (!res.ok) {
        setError(await readErrorMessage(res, 'Presentation save failed'));
        return;
      }

      // Refresh detail
      await refreshProductDetail();

      setEditorStep('publish');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Presentation save failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!editingProductId) return;
    try {
      setLoading(true);
      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/publish`);
      if (res.ok) {
        await loadProducts();
        setActiveTab('list');
      } else {
        setError(await readErrorMessage(res, 'Publish failed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async (productId: string) => {
    try {
      setLoading(true);
      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/unpublish`);
      if (res.ok) {
        await loadProducts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unpublish error');
    } finally {
      setLoading(false);
    }
  };

  /** Renders the localized editing form for a section, by type. */
  const renderSectionContent = (sec: PresentationSection, idx: number) => {
    const setField = (lang: 'en' | 'ar', patch: Record<string, any>) => updateLocalizedField(idx, lang, patch);

    switch (sec.type) {
      case 'description':
        return (
          <div className="section-content">
            {(['en', 'ar'] as const).map((lang) => (
              <div className="form-grid" key={lang}>
                <div className="form-group" dir={lang === 'ar' ? 'rtl' : undefined}>
                  <label>Heading ({lang.toUpperCase()})</label>
                  <input
                    type="text"
                    className="form-control"
                    value={(sec.content?.[lang]?.heading as string) || ''}
                    onChange={(e) => setField(lang, { heading: e.target.value })}
                  />
                </div>
                <div className="form-group" dir={lang === 'ar' ? 'rtl' : undefined}>
                  <label>Body ({lang.toUpperCase()})</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={(sec.content?.[lang]?.body as string) || ''}
                    onChange={(e) => setField(lang, { body: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 'highlights':
        return (
          <div className="section-content">
            {(['en', 'ar'] as const).map((lang) => (
              <div className="form-group" key={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
                <label>Title ({lang.toUpperCase()})</label>
                <input
                  type="text"
                  className="form-control"
                  value={(sec.content?.[lang]?.title as string) || ''}
                  onChange={(e) => setField(lang, { title: e.target.value })}
                />
                <label>Items ({lang.toUpperCase()}, one per line)</label>
                <textarea
                  rows={3}
                  className="form-control"
                  value={getLocalizedItems(sec, lang).join('\n')}
                  onChange={(e) =>
                    updateLocalizedItems(
                      idx,
                      lang,
                      e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                />
              </div>
            ))}
          </div>
        );

      case 'image_text':
        return (
          <div className="section-content">
            <div className="form-group">
              <label>Image</label>
              <select
                className="form-control"
                value={(sec.content?.media_id as string) || ''}
                onChange={(e) => updateSection(idx, (s) => ({ ...s, content: { ...s.content, media_id: e.target.value } }))}
              >
                <option value="">— Select an image —</option>
                {sortedMedia.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt_text || m.uri}
                  </option>
                ))}
              </select>
            </div>
            {(['en', 'ar'] as const).map((lang) => (
              <div className="form-group" key={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
                <label>Heading ({lang.toUpperCase()})</label>
                <input
                  type="text"
                  className="form-control"
                  value={(sec.content?.[lang]?.heading as string) || ''}
                  onChange={(e) => setField(lang, { heading: e.target.value })}
                />
                <label>Body ({lang.toUpperCase()})</label>
                <textarea
                  rows={3}
                  className="form-control"
                  value={(sec.content?.[lang]?.body as string) || ''}
                  onChange={(e) => setField(lang, { body: e.target.value })}
                />
              </div>
            ))}
          </div>
        );

      case 'specifications':
        return (
          <div className="section-content">
            {(['en', 'ar'] as const).map((lang) => (
              <div key={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
                <h5>Specifications ({lang.toUpperCase()})</h5>
                {getLocalizedItems(sec, lang).map((row: { key?: string; value?: string }, rowIdx: number) => (
                  <div className="spec-row" key={rowIdx}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Key"
                      aria-label={`Specification key (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      value={row?.key || ''}
                      onChange={(e) => {
                        const items = [...getLocalizedItems(sec, lang)];
                        items[rowIdx] = { ...items[rowIdx], key: e.target.value };
                        updateLocalizedItems(idx, lang, items);
                      }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Value"
                      aria-label={`Specification value (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      value={row?.value || ''}
                      onChange={(e) => {
                        const items = [...getLocalizedItems(sec, lang)];
                        items[rowIdx] = { ...items[rowIdx], value: e.target.value };
                        updateLocalizedItems(idx, lang, items);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`Remove specification row (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      onClick={() =>
                        updateLocalizedItems(
                          idx,
                          lang,
                          getLocalizedItems(sec, lang).filter((_, i) => i !== rowIdx)
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => updateLocalizedItems(idx, lang, [...getLocalizedItems(sec, lang), { key: '', value: '' }])}
                >
                  + Add Row ({lang.toUpperCase()})
                </button>
              </div>
            ))}
          </div>
        );

      case 'faq':
        return (
          <div className="section-content">
            {(['en', 'ar'] as const).map((lang) => (
              <div key={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
                <h5>Questions ({lang.toUpperCase()})</h5>
                {getLocalizedItems(sec, lang).map((row: { question?: string; answer?: string }, rowIdx: number) => (
                  <div className="faq-row" key={rowIdx}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Question"
                      aria-label={`FAQ question (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      value={row?.question || ''}
                      onChange={(e) => {
                        const items = [...getLocalizedItems(sec, lang)];
                        items[rowIdx] = { ...items[rowIdx], question: e.target.value };
                        updateLocalizedItems(idx, lang, items);
                      }}
                    />
                    <textarea
                      rows={2}
                      className="form-control"
                      placeholder="Answer"
                      aria-label={`FAQ answer (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      value={row?.answer || ''}
                      onChange={(e) => {
                        const items = [...getLocalizedItems(sec, lang)];
                        items[rowIdx] = { ...items[rowIdx], answer: e.target.value };
                        updateLocalizedItems(idx, lang, items);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`Remove FAQ row (${lang.toUpperCase()}, row ${rowIdx + 1})`}
                      onClick={() =>
                        updateLocalizedItems(
                          idx,
                          lang,
                          getLocalizedItems(sec, lang).filter((_, i) => i !== rowIdx)
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => updateLocalizedItems(idx, lang, [...getLocalizedItems(sec, lang), { question: '', answer: '' }])}
                >
                  + Add Question ({lang.toUpperCase()})
                </button>
              </div>
            ))}
          </div>
        );

      case 'final_cta':
        return (
          <div className="section-content">
            {(['en', 'ar'] as const).map((lang) => (
              <div className="form-group" key={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
                <label>Title ({lang.toUpperCase()})</label>
                <input
                  type="text"
                  className="form-control"
                  value={(sec.content?.[lang]?.title as string) || ''}
                  onChange={(e) => setField(lang, { title: e.target.value })}
                />
                <label>Body ({lang.toUpperCase()})</label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={(sec.content?.[lang]?.body as string) || ''}
                  onChange={(e) => setField(lang, { body: e.target.value })}
                />
                {lang === 'en' && (
                  <>
                    <label>Action</label>
                    <select
                      className="form-control"
                      value={(sec.content?.en?.action as string) || 'add_to_cart'}
                      onChange={(e) => setField('en', { action: e.target.value })}
                    >
                      <option value="add_to_cart">Add to Cart</option>
                      <option value="buy_now">Buy Now</option>
                    </select>
                  </>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="section-content">
            <p className="subtext">Type: {sec.type} — no structured editor available for this type.</p>
          </div>
        );
    }
  };

  return (
    <div className="products-panel">
      <div className="panel-header">
        <h2>{copy.productsTitle || 'Product Catalog Authoring'}</h2>
        {activeTab === 'list' && (
          <button type="button" className="btn btn-primary" onClick={handleStartCreate}>
            + {copy.newProduct || 'New Product'}
          </button>
        )}
        {activeTab === 'editor' && (
          <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>
            ← {copy.backToList || 'Back to Products'}
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {activeTab === 'list' && (
        <div className="products-list-view">
          {loading ? (
            <div className="notice">{copy.loading || 'Loading products...'}</div>
          ) : products.length === 0 ? (
            <div className="notice">{copy.noProducts || 'No products found for this store. Click New Product to start authoring.'}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Readiness</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product.id}>
                    <td>
                      <strong>{p.name || p.product.slug}</strong>
                      <div className="subtext">{p.product.slug}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${p.source}`}>{p.source === 'seller_owned' ? 'Seller Owned' : 'Supplier Backed'}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${p.listing_status}`}>{p.listing_status}</span>
                    </td>
                    <td>{p.current_price ? `${minorToMajor(p.current_price.amount, storeCurrencyMinorUnit)} ${p.current_price.currency}` : 'Unpriced'}</td>
                    <td>{p.inventory_summary?.total_on_hand ?? 0}</td>
                    <td>
                      {p.publish_readiness?.is_ready ? (
                        <span className="badge badge-success">✓ Ready</span>
                      ) : (
                        <span className="badge badge-warning" title={p.publish_readiness?.reasons?.join(', ')}>
                          Draft ({p.publish_readiness?.reasons?.length || 0} missing)
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleEditProduct(p.product.id)}>
                        Edit
                      </button>{' '}
                      {p.listing_status === 'active' ? (
                        <button type="button" className="btn btn-sm btn-warning" onClick={() => void handleUnpublish(p.product.id)}>
                          Unpublish
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'editor' && (
        <div className="product-wizard">
          <div className="wizard-steps">
            <button type="button" className={`step-btn ${editorStep === 'general' ? 'active' : ''}`} onClick={() => setEditorStep('general')}>
              1. General
            </button>
            <button type="button" className={`step-btn ${editorStep === 'variants' ? 'active' : ''}`} onClick={() => setEditorStep('variants')} disabled={!editingProductId}>
              2. Variants & SKUs
            </button>
            <button type="button" className={`step-btn ${editorStep === 'media' ? 'active' : ''}`} onClick={() => setEditorStep('media')} disabled={!editingProductId}>
              3. Media ({productDetail?.media?.length || 0})
            </button>
            <button type="button" className={`step-btn ${editorStep === 'pricing' ? 'active' : ''}`} onClick={() => setEditorStep('pricing')} disabled={!editingProductId}>
              4. Price & Inventory
            </button>
            <button type="button" className={`step-btn ${editorStep === 'presentation' ? 'active' : ''}`} onClick={() => setEditorStep('presentation')} disabled={!editingProductId}>
              5. Product Page Editor
            </button>
            <button type="button" className={`step-btn ${editorStep === 'publish' ? 'active' : ''}`} onClick={() => setEditorStep('publish')} disabled={!editingProductId}>
              6. Publish
            </button>
          </div>

          <div className="wizard-content">
            {editorStep === 'general' && (
              <form onSubmit={(e) => void handleSaveGeneral(e)} className="editor-form">
                <h3>General Product Information</h3>
                <div className="form-group">
                  <label htmlFor="prod-slug">Slug (URL key)</label>
                  <input id="prod-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required className="form-control" />
                </div>
                <div className="form-grid">
                  <div className="form-column">
                    <h4>English Content</h4>
                    <div className="form-group">
                      <label htmlFor="name-en">Product Name (EN)</label>
                      <input id="name-en" type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className="form-control" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="desc-en">Description (EN)</label>
                      <textarea id="desc-en" value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={4} className="form-control" />
                    </div>
                  </div>
                  <div className="form-column" dir="rtl">
                    <h4>محتوى اللغة العربية</h4>
                    <div className="form-group">
                      <label htmlFor="name-ar">اسم المنتج (عربي)</label>
                      <input id="name-ar" type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required className="form-control" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="desc-ar">الوصف (عربي)</label>
                      <textarea id="desc-ar" value={descAr} onChange={(e) => setDescAr(e.target.value)} rows={4} className="form-control" />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Categories</label>
                  {categories.length === 0 ? (
                    <p className="subtext">No categories available for this store.</p>
                  ) : (
                    <div className="category-list">
                      {categories.map((c) => (
                        <label key={c.id} className="category-option">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(c.id)}
                            onChange={() => toggleCategory(c.id)}
                          />{' '}
                          {c.slug}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save & Next: Variants →
                </button>
              </form>
            )}

            {editorStep === 'variants' && (
              <form onSubmit={(e) => void handleSaveVariantAndSKU(e)} className="editor-form">
                <h3>Variants & Selectable SKU</h3>
                <p className="subtext">MVP invariant: 1 active selectable SKU per variant.</p>
                <div className="form-group">
                  <label htmlFor="v-code">Variant Label / Code</label>
                  <input id="v-code" type="text" value={variantCode} onChange={(e) => setVariantCode(e.target.value)} required className="form-control" />
                </div>
                <div className="form-group">
                  <label htmlFor="sku-code">SKU Code</label>
                  <input id="sku-code" type="text" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} required className="form-control" />
                </div>
                <div className="form-group">
                  <label htmlFor="sku-barcode">Barcode (Optional)</label>
                  <input id="sku-barcode" type="text" value={skuBarcode} onChange={(e) => setSkuBarcode(e.target.value)} className="form-control" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save & Next: Media Upload →
                </button>
              </form>
            )}

            {editorStep === 'media' && (
              <div className="editor-form">
                <h3>Product Images</h3>
                <p className="subtext">
                  Upload images directly to S3 storage via presigned URL. The first image is the primary image; the
                  earliest remaining image is promoted automatically when the primary is deleted.
                </p>
                {/* Hidden native file input — triggered programmatically */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleFileSelected(e)}
                />
                <button type="button" className="btn btn-secondary" onClick={handlePickAndUploadImage} disabled={loading}>
                  📁 {loading ? 'Uploading…' : '+ Upload Image'}
                </button>
                <div className="media-gallery">
                  {sortedMedia.map((m, idx) => (
                    <div key={m.id} className="media-card">
                      <img src={m.uri} alt={m.alt_text} className="media-thumb" />
                      {m.is_primary && <span className="badge badge-primary">Primary</span>}
                      <div className="media-card-fields">
                        <label htmlFor={`media-alt-${m.id}`}>Alt text</label>
                        <input
                          id={`media-alt-${m.id}`}
                          type="text"
                          className="form-control"
                          value={altDrafts[m.id] ?? m.alt_text}
                          onChange={(e) => setAltDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        />
                        <div className="media-card-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={loading || (altDrafts[m.id] ?? m.alt_text) === m.alt_text}
                            onClick={() => void handleSaveAltText(m)}
                          >
                            Save Alt Text
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={loading || m.is_primary}
                            onClick={() => void handleSetPrimaryMedia(m)}
                          >
                            Set Primary
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={loading || idx === 0}
                            aria-label="Move image up"
                            onClick={() => void handleMoveMedia(idx, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={loading || idx === sortedMedia.length - 1}
                            aria-label="Move image down"
                            onClick={() => void handleMoveMedia(idx, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={loading}
                            onClick={() => void handleDeleteMedia(m)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(productDetail?.media ?? []).length === 0 && (
                    <p className="subtext">No images uploaded yet. Add at least one image before publishing.</p>
                  )}
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setEditorStep('pricing')}>
                  Next: Price &amp; Inventory →
                </button>
              </div>
            )}

            {editorStep === 'pricing' && (
              <form onSubmit={(e) => void handleSavePricingAndInventory(e)} className="editor-form">
                <h3>Retail Pricing &amp; Store Inventory</h3>
                <div className="form-group">
                  <label htmlFor="price-input">Retail Price ({storeCurrency})</label>
                  <input
                    id="price-input"
                    type="number"
                    step={inputStepForMinorUnit(storeCurrencyMinorUnit)}
                    min="0"
                    value={priceMajor}
                    onChange={(e) => setPriceMajor(e.target.value)}
                    required
                    className="form-control"
                  />
                  <span className="field-hint">
                    Enter price in {storeCurrency} (e.g. 1{storeCurrencyMinorUnit > 0 ? '.' + '0'.repeat(storeCurrencyMinorUnit) : ''} = 1{' '}
                    {storeCurrency})
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="stock-input">On-Hand Inventory (Units)</label>
                  <input id="stock-input" type="number" min="0" value={onHandStock} onChange={(e) => setOnHandStock(e.target.value)} required className="form-control" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save &amp; Next: Product Page Editor →
                </button>
              </form>
            )}

            {editorStep === 'presentation' && (
              <form onSubmit={(e) => void handleSavePresentation(e)} className="editor-form">
                <h3>Product Page Sections &amp; Purchase Action</h3>
                <div className="form-group">
                  <label htmlFor="purchase-behavior">Default Purchase Button CTA</label>
                  <select id="purchase-behavior" value={purchaseBehavior} onChange={(e) => setPurchaseBehavior(e.target.value as 'inherit' | 'add_to_cart' | 'buy_now')} className="form-control">
                    <option value="inherit">Use Store Default</option>
                    <option value="add_to_cart">Add to Cart</option>
                    <option value="buy_now">Buy Now</option>
                  </select>
                </div>
                <h4>Configured Product Page Sections</h4>
                {sections.length === 0 && <p className="subtext">No sections yet. Add one below.</p>}
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="section-box">
                    <div className="section-header">
                      <strong>
                        Section #{idx + 1}: {sectionTypeLabel(sec.type)}
                      </strong>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={sec.enabled}
                          onChange={(e) => updateSection(idx, (s) => ({ ...s, enabled: e.target.checked }))}
                        />
                        Enabled
                      </label>
                      <div className="section-order-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={idx === 0}
                          aria-label={`Move section ${idx + 1} up`}
                          onClick={() => handleMoveSection(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={idx === sections.length - 1}
                          aria-label={`Move section ${idx + 1} down`}
                          onClick={() => handleMoveSection(idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          aria-label={`Delete section ${idx + 1}`}
                          onClick={() => handleDeleteSection(idx)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {renderSectionContent(sec, idx)}
                  </div>
                ))}
                <div className="section-actions">
                  <select
                    aria-label="New section type"
                    value={newSectionType}
                    onChange={(e) => setNewSectionType(e.target.value as SectionType)}
                    className="form-control form-control-sm"
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {sectionTypeLabel(t)}
                      </option>
                    ))}
                  </select>{' '}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={handleAddSection}>
                    + Add Section
                  </button>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save &amp; Next: Readiness &amp; Publish →
                </button>
              </form>
            )}

            {editorStep === 'publish' && (
              <div className="editor-form">
                <h3>Publish Readiness Checklist</h3>
                {productDetail?.publish_readiness?.is_ready ? (
                  <div className="notice notice-success">
                    ✓ Product is completely valid and ready to publish to Storefront!
                  </div>
                ) : (
                  <div className="notice notice-warning">
                    ⚠️ Product cannot publish yet because:
                    <ul>
                      {productDetail?.publish_readiness?.reasons?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button type="button" className="btn btn-lg btn-success" onClick={() => void handlePublish()} disabled={!productDetail?.publish_readiness?.is_ready || loading}>
                  🚀 Publish Product
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type ProductListItem = {
  product: { id: string; slug: string; status: string; created_at: string };
  source: 'seller_owned' | 'supplier_backed';
  name: string;
  listing_status: string;
  listing_id: string;
  current_price?: { amount: number; currency: string } | null;
  inventory_summary: { total_on_hand: number; total_reserved: number; total_available: number };
  publish_readiness: { is_ready: boolean; reasons: string[] };
};
