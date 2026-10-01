import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { cartsScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreCartsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={cartsScreen} storeId={store_id} />;
}
