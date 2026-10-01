import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { usersScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreUsersPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={usersScreen} storeId={store_id} />;
}
