import React from 'react';
import type { ApiClient } from '../lib/api';

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

type ProductDetail = {
  product: { id: string; slug: string; status: string };
  source: string;
  translations: Array<{ locale: string; name: string; description: string }>;
  category_ids: string[];
  variants: Array<{ id: string; code: string; status: string }>;
  skus: Array<{ id: string; variant_id: string; code: string; barcode?: string; status: string }>;
  media: Array<{ id: string; uri: string; alt_text: string; sort_order: number; is_primary: boolean }>;
  listing: { id: string; status: string };
  current_price?: { amount: number; currency: string } | null;
  inventory_summary: { total_on_hand: number; total_reserved: number; total_available: number };
  presentation: {
    seller_listing_id: string;
    purchase_behavior: 'inherit' | 'add_to_cart' | 'buy_now';
    sections: Array<{ id: string; type: string; enabled: boolean; sort_order: number; content: Record<string, any> }>;
  };
  purchase_behavior: 'add_to_cart' | 'buy_now';
  publish_readiness: { is_ready: boolean; reasons: string[] };
};

type ProductsPanelProps = {
  api: ApiClient;
  storeId: string;
  locale: string;
  copy: Record<string, string>;
};

export function ProductsPanel({ api, storeId, locale, copy }: ProductsPanelProps) {
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
  const [variantCode, setVariantCode] = React.useState('Default');
  const [skuCode, setSkuCode] = React.useState('SKU-001');
  const [skuBarcode, setSkuBarcode] = React.useState('');
  const [priceMajor, setPriceMajor] = React.useState('100.00');
  const [onHandStock, setOnHandStock] = React.useState('10');
  const [purchaseBehavior, setPurchaseBehavior] = React.useState<'inherit' | 'add_to_cart' | 'buy_now'>('inherit');

  // Presentation sections state
  const [sections, setSections] = React.useState<Array<{ id: string; type: string; enabled: boolean; sort_order: number; content: Record<string, any> }>>([
    {
      id: 'sec-1',
      type: 'highlights',
      enabled: true,
      sort_order: 1,
      content: {
        en: { title: 'Product Highlights', items: ['High quality material', 'Fast shipping'] },
        ar: { title: 'مميزات المنتج', items: ['خامات عالي الجودة', 'شحن سريع'] }
      }
    }
  ]);

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

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleStartCreate = () => {
    setEditingProductId(null);
    setProductDetail(null);
    setSlug(`product-${Date.now().toString().slice(-6)}`);
    setNameEn('');
    setDescEn('');
    setNameAr('');
    setDescAr('');
    setVariantCode('Default');
    setSkuCode(`SKU-${Date.now().toString().slice(-4)}`);
    setSkuBarcode('');
    setPriceMajor('100.00');
    setOnHandStock('10');
    setPurchaseBehavior('inherit');
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

        if (detail.variants[0]) setVariantCode(detail.variants[0].code);
        if (detail.skus[0]) {
          setSkuCode(detail.skus[0].code);
          setSkuBarcode(detail.skus[0].barcode || '');
        }

        if (detail.current_price) {
          setPriceMajor((detail.current_price.amount / 100).toFixed(2));
        }

        setOnHandStock(String(detail.inventory_summary.total_on_hand || 0));
        setPurchaseBehavior(detail.presentation?.purchase_behavior || 'inherit');
        if (detail.presentation?.sections) {
          setSections(detail.presentation.sections);
        }

        setEditorStep('general');
        setActiveTab('editor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading product detail');
    } finally {
      setLoading(false);
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

      if (!editingProductId) {
        // Create new seller product
        const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products`, {
          slug,
          translations
        });
        if (res.ok) {
          const detail: ProductDetail = await res.json();
          setEditingProductId(detail.product.id);
          setProductDetail(detail);
          setEditorStep('variants');
        } else {
          setError('Failed to create product');
        }
      } else {
        // Update existing product
        const res = await api.put(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}`, {
          slug,
          translations
        });
        if (res.ok) {
          const detail: ProductDetail = await res.json();
          setProductDetail(detail);
          setEditorStep('variants');
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
    try {
      setLoading(true);
      setError(null);

      let variantId = productDetail?.variants[0]?.id;
      if (!variantId) {
        const vRes = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/variants`, {
          code: variantCode,
          status: 'active'
        });
        if (vRes.ok) {
          const v = await vRes.json();
          variantId = v.id;
        }
      }

      if (variantId) {
        let skuId = productDetail?.skus[0]?.id;
        if (!skuId) {
          await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/variants/${encodeURIComponent(variantId)}/skus`, {
            code: skuCode,
            barcode: skuBarcode || null,
            status: 'active'
          });
        }
      }

      // Refresh product detail
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}?locale=${locale}`);
      if (res.ok) setProductDetail(await res.json());

      setEditorStep('media');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variant and SKU');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImageMock = async () => {
    if (!editingProductId) return;
    try {
      setLoading(true);
      // 1. Presign
      const uploadRes = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/media/uploads`, {
        filename: 'product-image.webp',
        content_type: 'image/webp',
        size_bytes: 102400
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        // 2. Complete upload
        await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}/media`, {
          storage_key: uploadData.storage_key,
          alt_text: nameEn || 'Product Image',
          sort_order: (productDetail?.media.length || 0) + 1,
          is_primary: (productDetail?.media.length || 0) === 0
        });

        // Refresh detail
        const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}?locale=${locale}`);
        if (res.ok) setProductDetail(await res.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media upload failed');
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
      const amountMinor = Math.round(parseFloat(priceMajor || '0') * 100);
      await api.post(`/v1/seller/listings/${encodeURIComponent(productDetail.listing.id)}/price`, {
        amount_minor: amountMinor,
        currency: 'EGP'
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
              delta_quantity: delta,
              reason: 'Manual dashboard update'
            });
          }
        }
      }

      // Refresh detail
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}?locale=${locale}`);
      if (res.ok) setProductDetail(await res.json());

      setEditorStep('presentation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pricing/Inventory save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productDetail || !editingProductId) return;
    try {
      setLoading(true);
      await api.put(`/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(productDetail.listing.id)}/presentation`, {
        seller_listing_id: productDetail.listing.id,
        schema_version: 1,
        purchase_behavior: purchaseBehavior,
        sections
      });

      // Refresh detail
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(editingProductId)}?locale=${locale}`);
      if (res.ok) setProductDetail(await res.json());

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
        const data = await res.json();
        setError(data.message || 'Publish failed');
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
                    <td>{p.current_price ? `${(p.current_price.amount / 100).toFixed(2)} ${p.current_price.currency}` : 'Unpriced'}</td>
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
                <h3>Product Images (S3 Upload)</h3>
                <button type="button" className="btn btn-secondary" onClick={() => void handleUploadImageMock()} disabled={loading}>
                  + Upload Image (Presigned S3 Flow)
                </button>
                <div className="media-gallery">
                  {productDetail?.media?.map((m) => (
                    <div key={m.id} className="media-card">
                      <img src={m.uri} alt={m.alt_text} className="media-thumb" />
                      {m.is_primary && <span className="badge badge-primary">Primary</span>}
                      <p>{m.alt_text}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setEditorStep('pricing')}>
                  Next: Price & Inventory →
                </button>
              </div>
            )}

            {editorStep === 'pricing' && (
              <form onSubmit={(e) => void handleSavePricingAndInventory(e)} className="editor-form">
                <h3>Retail Pricing & Store Inventory</h3>
                <div className="form-group">
                  <label htmlFor="price-input">Retail Price (EGP)</label>
                  <input id="price-input" type="number" step="0.01" value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} required className="form-control" />
                </div>
                <div className="form-group">
                  <label htmlFor="stock-input">On-Hand Inventory (Units)</label>
                  <input id="stock-input" type="number" value={onHandStock} onChange={(e) => setOnHandStock(e.target.value)} required className="form-control" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save & Next: Product Page Editor →
                </button>
              </form>
            )}

            {editorStep === 'presentation' && (
              <form onSubmit={(e) => void handleSavePresentation(e)} className="editor-form">
                <h3>Product Page Sections & Purchase Action</h3>
                <div className="form-group">
                  <label htmlFor="purchase-behavior">Default Purchase Button CTA</label>
                  <select id="purchase-behavior" value={purchaseBehavior} onChange={(e) => setPurchaseBehavior(e.target.value as any)} className="form-control">
                    <option value="inherit">Use Store Default</option>
                    <option value="add_to_cart">Add to Cart</option>
                    <option value="buy_now">Buy Now</option>
                  </select>
                </div>
                <h4>Configured Sections</h4>
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="section-box">
                    <strong>Section #{idx + 1}: {sec.type}</strong>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save & Next: Readiness & Publish →
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
