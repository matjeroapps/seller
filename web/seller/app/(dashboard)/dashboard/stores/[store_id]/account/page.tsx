import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { profileAccountScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreAccountPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={profileAccountScreen} storeId={store_id} />;
}
