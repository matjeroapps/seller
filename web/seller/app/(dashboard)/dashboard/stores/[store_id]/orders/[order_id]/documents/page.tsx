import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { shippingDocumentsScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreOrderDocumentsPage({
  params
}: {
  params: Promise<{ store_id: string; order_id: string }>;
}) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={shippingDocumentsScreen} storeId={store_id} />;
}
