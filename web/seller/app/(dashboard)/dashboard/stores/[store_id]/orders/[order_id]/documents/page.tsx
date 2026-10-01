import { SellerScreen } from '@/components/seller/SellerScreen';
import { shippingDocumentsScreen } from '@/components/seller/Configs';

export default async function StoreOrderDocumentsPage({
  params
}: {
  params: Promise<{ store_id: string; order_id: string }>;
}) {
  const { store_id } = await params;

  return <SellerScreen screen={shippingDocumentsScreen} storeId={store_id} />;
}
