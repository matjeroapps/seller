import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { payoutRequestScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreNewPayoutPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={payoutRequestScreen} storeId={store_id} />;
}
