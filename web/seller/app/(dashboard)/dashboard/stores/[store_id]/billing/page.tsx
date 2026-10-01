import { SellerScreen } from '@/components/seller/SellerScreen';
import { billingScreen } from '@/components/seller/Configs';

export default async function StoreBillingPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={billingScreen} storeId={store_id} />;
}
