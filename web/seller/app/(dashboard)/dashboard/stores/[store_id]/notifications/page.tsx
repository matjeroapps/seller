import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { notificationsScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreNotificationsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={notificationsScreen} storeId={store_id} />;
}
