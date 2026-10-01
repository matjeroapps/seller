import { SellerScreen } from '@/components/seller/SellerScreen';
import { usersScreen } from '@/components/seller/Configs';

export default async function StoreUsersPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={usersScreen} storeId={store_id} />;
}
