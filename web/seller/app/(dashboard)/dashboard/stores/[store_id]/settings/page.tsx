import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { settingsScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreSettingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={settingsScreen} storeId={store_id} />;
}
