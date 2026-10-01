import { SellerStitchScreen } from '@/components/stitch/SellerStitchScreen';
import { analyticsScreen } from '@/components/stitch/seller-stitch-screen-configs';

export default async function StoreAnalyticsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = await params;

  return <SellerStitchScreen screen={analyticsScreen} storeId={store_id} />;
}
