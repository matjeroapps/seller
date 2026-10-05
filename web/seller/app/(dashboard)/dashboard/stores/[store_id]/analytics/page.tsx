import { UnsupportedCapabilityScreen } from '@/components/seller/UnsupportedCapabilityScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: Props) {
  const { store_id } = await params;
  return (
    <UnsupportedCapabilityScreen
      eyebrow="Analytics"
      title="Advanced analytics are not available yet"
      description="Advanced reports, cohorts, scheduled exports, and channel analytics need dedicated analytics contracts. The dashboard overview remains available for operational summaries."
      storeId={store_id}
      primaryHref={`/dashboard/stores/${store_id}`}
      primaryLabel="View dashboard overview"
    />
  );
}
