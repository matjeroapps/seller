import { notFound } from 'next/navigation';

import { FoundationDestination } from '@/components/dashboard/FoundationDestination';
import { sellerNavigation } from '@/config/seller-navigation';

const foundationDestinations = new Map(
  sellerNavigation
    .flatMap((item) => [item, ...(item.children || [])])
    .filter((item) => item.path !== '/dashboard')
    .map((item) => [item.path.replace('/dashboard/', ''), item.label])
);

export function generateStaticParams() {
  return Array.from(foundationDestinations.keys()).map((path) => ({
    segments: path.split('/')
  }));
}

export default async function FoundationDestinationPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const destinationPath = segments.join('/');
  const label = foundationDestinations.get(destinationPath);

  if (!label) {
    notFound();
  }

  return (
    <FoundationDestination
      title={`${label} foundation`}
      description="This destination is reserved in the Seller Portal information architecture. Business workflows and API-backed behavior are deferred beyond Phase UI-5."
    />
  );
}
