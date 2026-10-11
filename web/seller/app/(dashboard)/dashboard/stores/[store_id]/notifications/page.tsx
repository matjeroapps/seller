import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      copyKey="unsupported.notifications"
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}/settings`}
    />
  );
}
