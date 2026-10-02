import { SellerScreen } from '@/components/seller/SellerScreen';
import { analyticsScreen } from '@/components/seller/Configs';

export default async function StoreAnalyticsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerScreen screen={analyticsScreen} storeId={store_id} />;
}
