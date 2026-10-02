import { SellerScreen } from '@/components/seller/SellerScreen';
import { cartsScreen } from '@/components/seller/Configs';

export default async function StoreCartsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={cartsScreen} storeId={store_id} />;
}
