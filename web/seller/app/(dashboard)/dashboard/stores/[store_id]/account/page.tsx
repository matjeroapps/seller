import { SellerScreen } from '@/components/seller/SellerScreen';
import { profileAccountScreen } from '@/components/seller/Configs';

export default async function StoreAccountPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={profileAccountScreen} storeId={store_id} />;
}
