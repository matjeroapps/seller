import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { addCustomerScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreNewCustomerPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={addCustomerScreen} storeId={store_id} />;
}
