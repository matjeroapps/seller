'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Card, Container, Grid, PageHeader, Stack, Button } from '@matjerhub/ui-sdk';
import { Store as StoreIcon, PlusCircle, ArrowRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';

export function DashboardOverview() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .getStores()
      .then((res) => {
        if (!isMounted) return;
        const items = res.items || [];
        setStores(items);
        setLoading(false);
        if (items.length === 0) {
          router.replace('/dashboard/onboarding');
        } else if (items.length === 1) {
          router.replace(`/dashboard/stores/${items[0].id}`);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <Container size="xl">
        <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
          Loading merchant stores...
        </div>
      </Container>
    );
  }

  if (stores.length === 0) {
    return (
      <Container size="md">
        <Card padding="lg" className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
              <StoreIcon className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">No Store Configured</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Welcome to MatjerHub! Set up your digital store to start importing supplier offers and merchandising your storefront.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-2 mx-auto">
              <PlusCircle className="w-4 h-4" />
              Start Store Onboarding
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        <PageHeader
          title="Seller Stores"
          subtitle="Manage your active stores and launch readiness."
          actions={
            <Button variant="primary" onClick={() => router.push('/dashboard/onboarding')} className="flex items-center gap-1.5 text-xs">
              <PlusCircle className="w-4 h-4" />
              New Store
            </Button>
          }
        />
        <Grid cols={3} gap="lg">
          {stores.map((st) => (
            <Card key={st.id} padding="lg" className="hover:border-slate-300 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/stores/${st.id}`)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{st.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{st.code}.matjerhub.local</p>
                </div>
                <Badge variant={st.status === 'active' ? 'default' : 'secondary'} className="uppercase">
                  {st.status}
                </Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </div>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
