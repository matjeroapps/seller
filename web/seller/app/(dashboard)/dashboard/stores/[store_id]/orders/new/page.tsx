import { SellerScreen } from '@/components/seller/SellerScreen';
import { newOrderScreen } from '@/components/seller/Configs';

export default async function StoreNewOrderPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={newOrderScreen} storeId={store_id} />;
}
