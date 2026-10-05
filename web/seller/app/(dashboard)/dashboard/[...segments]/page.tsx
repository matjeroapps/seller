import { redirect } from 'next/navigation';

export default function GenericDashboardCatchAllPage() {
  // Tenant screens are only valid when a store/workspace is selected. The
  // legacy shell used to render links such as /dashboard/catalog/products
  // without a store id, which landed here and produced a confusing Next 404.
  // Return the user to the authoritative dashboard resolver instead; it will
  // choose onboarding, a merchant workspace, or the user's only store.
  redirect('/dashboard');
}
