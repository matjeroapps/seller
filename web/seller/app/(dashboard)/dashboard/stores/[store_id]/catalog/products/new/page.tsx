"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  ImagePlus,
  Package,
  Search,
  Sparkles,
  Truck,
  WandSparkles,
} from "lucide-react";
import { CategoryPicker } from "@/components/seller/CategoryPicker";
import { AuthoringAssistantPanel } from "@/components/seller/AuthoringAssistantPanel";
import { ProductMediaWorkspace } from "@/components/seller/ProductMediaWorkspace";
import { VariantOptionsModal, type VariantBatchConfig } from "@/components/seller/VariantOptionsModal";
import {
  ProductEditorLayout,
  productEditorCardClass,
  productEditorInputClass,
  ProductEditorHeading,
} from "@/components/seller/ProductEditorLayout";
import { useTranslation } from "@/lib/i18n/locale-context";
import { sellerApi } from "@/lib/api/client";
import type { AuthoringFieldProposal, CreateProductVariantPayload, ProductMediaReference, ProductVariant, SellerProductDetail, StoreCategory, UpdateProductVariantPayload } from "@/lib/api/types";
import { deriveVariantAttributes } from "@/lib/variants/preview";

const inputClass = productEditorInputClass;
const cardClass = productEditorCardClass;
const SectionHeading = ProductEditorHeading;

export function ProductEditorPage({
  params,
}: {
  params: Promise<{ store_id: string; product_id?: string }>;
}) {
  const { store_id, product_id } = use(params);
  const isEdit = Boolean(product_id);
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [stock, setStock] = useState("0");
  const [lowStock, setLowStock] = useState("0");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    height: "",
  });
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState("");
  const [productStatus, setProductStatus] = useState("draft");
  const [trackInventory, setTrackInventory] = useState(true);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(
    null,
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaReferences, setMediaReferences] = useState<ProductMediaReference[]>([]);
  const [productDetail, setProductDetail] = useState<SellerProductDetail | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantWorking, setVariantWorking] = useState(false);
  const [initializing, setInitializing] = useState(isEdit);
  const refreshProductDetail = async () => {
    if (!product_id) return;
    const detail = await sellerApi.getStoreProductDetail(store_id, product_id);
    setProductDetail(detail);
  };
  const loadCategories = () => {
    setCategoryLoadError(null);
    sellerApi
      .listStoreCategories(store_id)
      .then(setCategories)
      .catch((err: Error) =>
        setCategoryLoadError(err.message || t("products.errorLoadCategories")),
      );
  };
  useEffect(() => {
    loadCategories(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [store_id]);
  useEffect(() => {
    if (!product_id) return;
    let mounted = true;
    Promise.all([
      sellerApi.getStoreProductDetail(store_id, product_id),
      sellerApi.listProductMediaReferences(store_id, product_id).catch(() => ({ items: [] })),
    ]).then(([detail, media]) => {
      if (!mounted) return;
      setProductDetail(detail);
      const en = detail.translations?.find((item) => item.locale === "en") || detail.translations?.[0];
      const ar = detail.translations?.find((item) => item.locale === "ar");
      setName(en?.name || "");
      setNameAr(ar?.name || "");
      setDescription(en?.description || "");
      setDescriptionAr(ar?.description || "");
      setMetaTitle(en?.meta_title || "");
      setMetaDescription(en?.meta_description || "");
      setSlug(detail.product.slug || "");
      setSlugManuallyEdited(true);
      setSelectedCategoryIds(detail.store_category_ids || []);
      setProductStatus(detail.product.status || "draft");
      setMediaReferences(media.items || []);
      const amount = detail.current_price?.amount_minor ?? detail.current_price?.amount;
      if (typeof amount === "number") setRetailPrice((amount / 100).toFixed(2));
    }).catch((err: any) => mounted && setError(err.message || t("products.errorLoadDetails")))
      .finally(() => mounted && setInitializing(false));
    return () => { mounted = false; };
  }, [product_id, store_id, t]);
  const variantBatch = useMemo<VariantBatchConfig | null>(() => {
    if (!isEdit || !productDetail || !product_id) return null;
    const attributes = productDetail.attributes?.length
      ? productDetail.attributes.map((attribute) => ({
          id: attribute.id,
          code: attribute.code,
          name: attribute.name,
          values: attribute.values.map((value) => ({
            id: value.id,
            code: value.code,
            name: value.name,
            status: value.status,
          })),
        }))
      : deriveVariantAttributes(productDetail.variants || []);
    return attributes.length ? {
      storeId: store_id,
      productId: product_id,
      productCode: productDetail.product.slug || product_id,
      attributes,
      existingVariantRecords: productDetail.variants || [],
      onComplete: () => setShowVariantModal(false),
    } : null;
  }, [isEdit, productDetail, product_id, store_id]);
  const createVariant = async (payload: CreateProductVariantPayload) => {
    if (!product_id) return;
    setVariantWorking(true);
    try {
      await sellerApi.createProductVariant(store_id, product_id, payload);
      await refreshProductDetail();
      setShowVariantModal(false);
      setNotice("تم إنشاء المتغير بنجاح.");
    } finally {
      setVariantWorking(false);
    }
  };
  const updateVariant = async (variantId: string, payload: UpdateProductVariantPayload) => {
    if (!product_id) return;
    setVariantWorking(true);
    try {
      await sellerApi.updateProductVariant(store_id, product_id, variantId, payload);
      const currentSku = editingVariant?.id === variantId ? editingVariant.sku : undefined;
      if (currentSku) {
        await sellerApi.updateProductSku(store_id, product_id, variantId, currentSku.id, {
          code: payload.sku_code || currentSku.code,
          barcode: payload.barcode,
          status: "active",
          weight_grams: payload.weight_grams,
          length_mm: payload.dimensions?.length_mm,
          width_mm: payload.dimensions?.width_mm,
          height_mm: payload.dimensions?.height_mm,
          price_minor_units: payload.price_minor_units,
        });
      }
      await refreshProductDetail();
      setEditingVariant(null);
      setShowVariantModal(false);
      setNotice("تم حفظ تعديلات المتغير بنجاح.");
    } finally {
      setVariantWorking(false);
    }
  };
  const removeVariant = async (variant: ProductVariant) => {
    if (!product_id || !window.confirm("سيتم إزالة المتغير من الكتالوج مع الاحتفاظ بسجله التشغيلي والتاريخي. هل تريد المتابعة؟")) return;
    setVariantWorking(true);
    try {
      await sellerApi.deleteProductVariant(store_id, product_id, variant.id);
      await refreshProductDetail();
      setNotice("تمت إزالة المتغير من الكتالوج مع الاحتفاظ بسجله.");
    } finally {
      setVariantWorking(false);
    }
  };
  const createProperty = async (draft: { code: string; nameAr: string; nameEn: string }) => {
    await sellerApi.createStoreAttribute(store_id, {
      code: draft.code,
      status: "active",
      names: { ar: draft.nameAr, en: draft.nameEn },
    });
    await refreshProductDetail();
  };
  const createPropertyValue = async (draft: { attributeId: string; code: string; nameAr: string; nameEn: string }) => {
    await sellerApi.createStoreAttributeValue(store_id, draft.attributeId, {
      code: draft.code,
      status: "active",
      names: { ar: draft.nameAr, en: draft.nameEn },
    });
    await refreshProductDetail();
  };
  const triggerAuthoring = () => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="authoring-generate"]');
    button?.click();
    const assistant = document.querySelector<HTMLElement>('[data-testid="authoring-assistant"]');
    assistant?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited)
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, ""),
      );
  };
  const authoringBrief = useMemo(
    () =>
      [
        name.trim() ? `Product name: ${name.trim()}` : "",
        nameAr.trim() ? `اسم المنتج: ${nameAr.trim()}` : "",
        description.trim() ? `Product description: ${description.trim()}` : "",
        descriptionAr.trim() ? `وصف المنتج: ${descriptionAr.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    [name, nameAr, description, descriptionAr],
  );
  const applyAuthoringFields = (fields: AuthoringFieldProposal[]) => {
    const get = (key: string, locale: string) =>
      fields.find((field) => field.field_key === key && field.locale === locale)
        ?.value;
    const enName = get("name", "en");
    const arName = get("name", "ar");
    const enDescription = get("description", "en");
    const arDescription = get("description", "ar");
    if (enName) handleNameChange(enName);
    if (arName) setNameAr(arName);
    if (enDescription) setDescription(enDescription);
    if (arDescription) setDescriptionAr(arDescription);
    const enMeta = get("meta_title", "en");
    const enMetaDescription = get("meta_description", "en");
    if (enMeta) setMetaTitle(enMeta);
    if (enMetaDescription) setMetaDescription(enMetaDescription);
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!name.trim() && !nameAr.trim()) || !slug.trim()) {
      setError("اسم المنتج والرابط المخصص حقول إلزامية.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const englishTranslation = {
        locale: "en",
        name: name.trim() || nameAr.trim(),
        description: description.trim(),
        ...(metaTitle.trim() ? { meta_title: metaTitle.trim() } : {}),
        ...(metaDescription.trim()
          ? { meta_description: metaDescription.trim() }
          : {}),
      };
      const arabicTranslation = {
        locale: "ar",
        name: nameAr.trim(),
        description: descriptionAr.trim(),
      };
      const translations = [englishTranslation, ...(nameAr.trim() || descriptionAr.trim() ? [arabicTranslation] : [])];
      const product = isEdit
        ? await sellerApi.updateStoreProduct(store_id, product_id!, {
            slug: slug.trim(),
            translations,
            store_category_ids: selectedCategoryIds,
          })
        : await sellerApi.createStoreProduct(store_id, {
            slug: slug.trim(), translations, store_category_ids: selectedCategoryIds,
          });
      const listingId = isEdit
        ? (product as SellerProductDetail).listing?.id
        : (product as any).listing_id;
      if (listingId && retailPrice.trim()) {
        const amount = Math.round(Number(retailPrice) * 100);
        if (Number.isFinite(amount) && amount >= 0)
          await sellerApi.updateListingPrice(store_id, listingId, {
            currency: "EGP",
            retail_price_minor_units: amount,
            amount_minor: amount,
          });
      }
      const savedProductId = isEdit ? product_id! : (product as any).id;
      if (productStatus !== "draft")
        await sellerApi.updateProductStatus(
          store_id,
          savedProductId,
          productStatus,
        );
      setNotice(isEdit ? "تم حفظ تعديلات المنتج بنجاح." : "تم حفظ المسودة. يمكنك استكمال الوسائط والمتغيرات لاحقاً.");
      if (!isEdit) router.push(`/dashboard/stores/${store_id}/catalog/products/${savedProductId}`);
    } catch (err: any) {
      setError(err.message || t("products.errorCreateProduct"));
    } finally {
      // Always release the busy state after every awaited save request.  The
      // previous flow only reset this in the error branch, leaving a successful
      // edit stuck on "جارٍ الحفظ…" even though the API had completed.
      setSaving(false);
    }
  };

  if (initializing) return <ProductEditorLayout><div className="animate-pulse rounded-2xl bg-white p-8 text-sm text-slate-500">جارٍ تحميل بيانات المنتج...</div></ProductEditorLayout>;

  return (
    <ProductEditorLayout>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/stores/${store_id}/catalog/products`}
              className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-emerald-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                {isEdit ? "تعديل المنتج" : "إضافة منتج جديد"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isEdit ? "عدّل بيانات المنتج وراجعها قبل الحفظ أو النشر." : "أضف منتجاً لمسودتك وراجعه قبل نشره في المتجر."}
              </p>
            </div>
          </div>
          <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 sm:inline-flex">
            مسودة
          </span>
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}
        <form
          id="new-product-form"
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12"
        >
          {isEdit && <span className="sr-only">محتوى المنتج</span>}
          <div className="space-y-6 xl:col-span-8">
            <section className={cardClass}>
              <SectionHeading
                icon={ClipboardList}
                title="البيانات الأساسية للمنتج"
                hint="العناوين التعريفية والوصف التفصيلي لتهيئة العرض التسويقي"
                required
              />
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">
                    اسم المنتج بالعربية *
                  </label>
                  <div className="relative">
                    <input
                      required
                      data-testid="product-name-ar"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      className={inputClass}
                      placeholder="مثال: خلاط متعدد السرعات"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="absolute left-3 top-2.5 rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"
                      title="اقتراح صياغة ذكية"
                      onClick={triggerAuthoring}
                    >
                      <WandSparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">
                    اسم المنتج بالإنجليزية{" "}
                    <span className="font-normal text-slate-400">
                      (اختياري)
                    </span>
                  </label>
                  <input
                    data-testid="product-name-en"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Multi-speed electric blender"
                    dir="ltr"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-semibold">
                      الوصف التفصيلي للمنتج
                    </label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
                      onClick={triggerAuthoring}
                    >
                      <Sparkles className="h-4 w-4" />
                      توليد وصف تسويقي بالذكاء الصناعي
                    </button>
                  </div>
                  <textarea
                    data-testid="product-description-ar"
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    className={`${inputClass} min-h-36 resize-y`}
                    placeholder="اكتب مواصفات المنتج ومميزاته ومحتويات الصندوق..."
                    dir="rtl"
                  />
                  <textarea
                    data-testid="product-description-en"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${inputClass} mt-3 min-h-24 resize-y`}
                    placeholder="Product description (English)"
                    dir="ltr"
                  />
                </div>
              </div>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={ImagePlus}
                title="وسائط وصور المنتج"
                hint="أضف الصور أو ارفعها بالسحب والإفلات، ثم راجعها قبل الحفظ."
              />
              {isEdit ? (
                <ProductMediaWorkspace
                  storeId={store_id}
                  productId={product_id!}
                  productName={name || slug}
                  canManage
                  initialReferences={mediaReferences}
                />
              ) : <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
                <ImagePlus className="mx-auto h-9 w-9 text-emerald-600" />
                <p className="mt-3 text-sm font-semibold">
                  اسحب الصور وأفلتها هنا، أو{" "}
                  <span className="text-emerald-700 underline">
                    استعرض الملفات
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  JPG أو PNG أو WebP، حتى 10 ميجابايت للصورة
                </p>
              </div>}
              {!isEdit && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700"
                >
                  <ImagePlus className="mb-2 h-6 w-6" />
                  إضافة صورة
                </button>
              </div>}
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={BadgeDollarSign}
                title="التسعير والتكاليف وهوامش الأرباح"
                hint="احسب السعر والهامش قبل نشر المنتج."
              />
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-semibold">
                  سعر البيع النهائي *
                  <input
                    required
                    data-testid="retail-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="0.00"
                  />
                </label>
                <label className="text-sm font-semibold">
                  سعر المقارنة
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={comparePrice}
                    onChange={(e) => setComparePrice(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="0.00"
                  />
                </label>
                <label className="text-sm font-semibold">
                  تكلفة السلعة
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="0.00"
                  />
                </label>
              </div>
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                صافي الربح التقديري:{" "}
                <strong>
                  {retailPrice && costPrice
                    ? (Number(retailPrice) - Number(costPrice)).toFixed(2)
                    : "—"}
                </strong>{" "}
                · الهامش:{" "}
                <strong>
                  {retailPrice && Number(retailPrice) > 0 && costPrice
                    ? `${(((Number(retailPrice) - Number(costPrice)) / Number(retailPrice)) * 100).toFixed(1)}%`
                    : "—"}
                </strong>
              </div>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={Boxes}
                title="المخزون ورموز التتبع (SKU)"
                hint="إدارة الكمية والرموز الأساسية للمنتج."
              />
              <div className="mb-4 flex items-center gap-2">
                <input
                  id="track-inventory"
                  type="checkbox"
                  checked={trackInventory}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                  className="h-4 w-4 accent-emerald-700"
                />
                <label
                  htmlFor="track-inventory"
                  className="text-sm font-semibold"
                >
                  تتبع كميات المخزون
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">
                  رمز SKU
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    dir="ltr"
                    placeholder="PRODUCT-001"
                  />
                </label>
                <label className="text-sm font-semibold">
                  الباركود الدولي
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    dir="ltr"
                    placeholder="اختياري"
                  />
                </label>
                <label className="text-sm font-semibold">
                  الكمية المتوفرة
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <label className="text-sm font-semibold">
                  حد التنبيه
                  <input
                    type="number"
                    min="0"
                    value={lowStock}
                    onChange={(e) => setLowStock(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
              </div>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={Package}
                title="الخيارات والمتغيرات (Variants)"
                hint="أضف الخصائص والقيم من نافذة واحدة لتوليد التركيبات تلقائياً."
              />
              <button
                type="button"
                onClick={() => {
                  if (!isEdit) {
                    setNotice("احفظ المنتج أولاً ثم افتح إدارة الخيارات والمتغيرات.");
                    return;
                  }
                  setEditingVariant(null);
                  setShowVariantModal(true);
                }}
                disabled={variantWorking}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                إدارة الخيارات والمتغيرات
              </button>
              {productDetail?.variants?.length ? (
                <div className="mt-4 space-y-2" data-testid="product-variant-list">
                  {productDetail.variants.map((variant) => (
                    <div key={variant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">{variant.code}</span>
                          {variant.attribute_values?.map((value) => (
                            <span key={`${variant.id}-${value.value_id}`} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              {value.attribute_name}: {value.value_name}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          SKU: <span className="font-mono">{variant.sku?.code || "—"}</span>
                          {variant.sku?.price_minor_units != null ? ` · ${(variant.sku.price_minor_units / 100).toFixed(2)} ج.م` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditingVariant(variant); setShowVariantModal(true); }}
                          disabled={variantWorking}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVariant(variant)}
                          disabled={variantWorking}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          إزالة من الكتالوج
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                  لا توجد متغيرات محفوظة بعد. اختر الخصائص والقيم لتوليدها دفعة واحدة.
                </div>
              )}
            </section>
            <AuthoringAssistantPanel
              storeId={store_id}
              brief={authoringBrief}
              onApplyFields={applyAuthoringFields}
            />
          </div>
          <aside className="space-y-6 xl:col-span-4">
            <section className={cardClass}>
              <SectionHeading
                icon={Search}
                title="تحسين محركات البحث والروابط"
                hint="خصص طريقة ظهور المنتج في نتائج البحث."
              />
              <label className="text-sm font-semibold">
                عنوان الصفحة (Meta Title)
                <input
                  data-testid="product-meta-title"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                الوصف التعريفي
                <textarea
                  data-testid="product-meta-description"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className={`${inputClass} mt-1.5 min-h-24`}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                رابط المنتج المخصص
                <input
                  required
                  data-testid="product-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(e.target.value);
                  }}
                  className={`${inputClass} mt-1.5 font-mono`}
                  dir="ltr"
                  placeholder="product-slug"
                />
              </label>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={ClipboardList}
                title="حالة النشر والظهور"
                hint="تحكم في حالة المسودة قبل النشر."
              />
              <label className="text-sm font-semibold">
                حالة المنتج
                <select
                  value={productStatus}
                  onChange={(e) => setProductStatus(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="draft">مسودة</option>
                  <option value="active">نشط ومنشور</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={Search}
                title="التصنيف والتنظيم"
                hint="اختر التصنيف الرئيسي والوسوم."
              />
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">
                    التصنيف الرئيسي
                  </span>
                  <CategoryPicker
                    storeId={store_id}
                    categories={categories}
                    selectedIds={selectedCategoryIds}
                    onChange={setSelectedCategoryIds}
                    loadError={categoryLoadError}
                    onRetry={loadCategories}
                  />
                </div>
                <label className="block text-sm font-semibold">
                  العلامة التجارية
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  الوسوم والكلمات المفتاحية
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                    placeholder="افصل بين الوسوم بفاصلة"
                  />
                </label>
              </div>
            </section>
            <section className={cardClass}>
              <SectionHeading
                icon={Truck}
                title="أبعاد الشحن والطرود"
                hint="تستخدم لحساب الشحن والتجهيز."
              />
              <label className="text-sm font-semibold">
                الوزن مع التغليف (كجم)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["length", "width", "height"] as const).map((key) => (
                  <label
                    key={key}
                    className="text-xs font-semibold text-slate-500"
                  >
                    {key === "length"
                      ? "الطول"
                      : key === "width"
                        ? "العرض"
                        : "الارتفاع"}
                    <input
                      type="number"
                      min="0"
                      value={dimensions[key]}
                      onChange={(e) =>
                        setDimensions({ ...dimensions, [key]: e.target.value })
                      }
                      className={`${inputClass} mt-1.5 px-2 text-center`}
                    />
                  </label>
                ))}
              </div>
            </section>
          </aside>
        </form>
        <VariantOptionsModal
          isOpen={showVariantModal}
          onClose={() => setShowVariantModal(false)}
          onSubmit={createVariant}
          onUpdate={updateVariant}
          editingVariant={editingVariant}
          loading={variantWorking}
          batch={editingVariant ? null : variantBatch}
          productAttributes={productDetail?.attributes || []}
          onCreateProperty={createProperty}
          onCreatePropertyValue={createPropertyValue}
        />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <span className="hidden text-xs text-slate-500 sm:inline">
            {isEdit ? "سيتم حفظ التعديلات على المنتج الحالي." : "سيتم حفظ المنتج كمسودة ويمكن استكمال الوسائط والمتغيرات لاحقاً."}
          </span>
          <div className="mr-auto flex items-center gap-3">
            <Link
              href={`/dashboard/stores/${store_id}/catalog/products`}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              form="new-product-form"
              disabled={saving}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ كمسودة"}
            </button>
          </div>
        </div>
      </div>
    </ProductEditorLayout>
  );
}

export default function NewStoreProductPage({ params }: { params: Promise<{ store_id: string }> }) {
  return <ProductEditorPage params={params} />;
}
