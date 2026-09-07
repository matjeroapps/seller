import { DashboardOverview } from '@/components/dashboard/DashboardOverview';

export const metadata = {
  title: 'Dashboard'
};

export default async function DashboardPage() {
  return <DashboardOverview />;
}
