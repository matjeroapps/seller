import { SellerScreen } from '@/components/seller/SellerScreen';
import { addCustomerScreen } from '@/components/seller/Configs';

export default async function StoreNewCustomerPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={addCustomerScreen} storeId={store_id} />;
}
