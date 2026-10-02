import { SellerScreen } from '@/components/seller/SellerScreen';
import { settingsScreen } from '@/components/seller/Configs';

export default async function StoreSettingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={settingsScreen} storeId={store_id} />;
}
