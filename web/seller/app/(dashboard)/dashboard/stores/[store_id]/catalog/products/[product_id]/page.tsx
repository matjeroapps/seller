"use client";

import { ProductEditorPage } from "../new/page";

export default function StoreProductDetailPage({
  params,
}: {
  params: Promise<{ store_id: string; product_id: string }>;
}) {
  return <ProductEditorPage params={params} />;
}
