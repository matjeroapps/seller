import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { billingScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreBillingPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={billingScreen} storeId={store_id} />;
}
