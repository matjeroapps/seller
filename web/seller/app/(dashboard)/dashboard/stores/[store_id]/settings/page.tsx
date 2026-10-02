import { SettingsScreen } from '@/components/seller/SettingsScreen';

type Props = {
  params: Promise<{ store_id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: Props) {
  const { store_id } = await params;
  return <SettingsScreen storeId={store_id} />;
}
