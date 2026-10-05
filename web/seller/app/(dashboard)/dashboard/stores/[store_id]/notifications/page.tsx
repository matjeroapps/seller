import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Notifications"
      title="Notification center is not available yet"
      description="In-app seller notification feeds and channel preferences are deferred until Core exposes durable notification contracts."
      backlogNote="Supplier price-change and stock-change alerts should be prioritized in the follow-up notification lane."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/settings`}
      primaryLabel="View settings"
    />
  );
}
