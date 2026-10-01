import { SellerScreen } from '@/components/seller/SellerScreen';
import { notificationsScreen } from '@/components/seller/Configs';

export default async function StoreNotificationsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={notificationsScreen} storeId={store_id} />;
}
