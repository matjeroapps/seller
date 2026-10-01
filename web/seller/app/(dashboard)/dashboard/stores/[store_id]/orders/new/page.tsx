import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { newOrderScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreNewOrderPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={newOrderScreen} storeId={store_id} />;
}
