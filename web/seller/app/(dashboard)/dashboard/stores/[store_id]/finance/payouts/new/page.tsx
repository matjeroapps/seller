import { SellerScreen } from '@/components/seller/SellerScreen';
import { payoutRequestScreen } from '@/components/seller/Configs';

export default async function StoreNewPayoutPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={payoutRequestScreen} storeId={store_id} />;
}
