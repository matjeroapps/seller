'use client';

import { Badge, Card, Container, Grid, PageHeader, Stack } from '@matjerhub/ui-sdk';
import { AlertTriangle, PackageSearch, ShoppingBag, TrendingUp } from 'lucide-react';

const foundationMetrics = [
  {
    title: 'Total Products',
    value: '128',
    note: 'Placeholder catalog count',
    icon: PackageSearch,
    tone: 'text-sky-700 bg-sky-50'
  },
  {
    title: 'Active Orders',
    value: '24',
    note: 'Placeholder order workload',
    icon: ShoppingBag,
    tone: 'text-emerald-700 bg-emerald-50'
  },
  {
    title: 'Revenue',
    value: 'EGP 84.2K',
    note: 'Placeholder revenue signal',
    icon: TrendingUp,
    tone: 'text-indigo-700 bg-indigo-50'
  },
  {
    title: 'Inventory Alerts',
    value: '7',
    note: 'Placeholder replenishment signal',
    icon: AlertTriangle,
    tone: 'text-amber-700 bg-amber-50'
  }
];

export function DashboardOverview() {
  return (
    <Container size="xl">
      <Stack gap="xl">
        <PageHeader
          title="Seller Dashboard"
          subtitle="This foundation view is ready for future seller workflows."
          actions={<Badge variant="secondary">Foundation data</Badge>}
        />
        <Grid cols={4} gap="lg">
          {foundationMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} padding="lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-600">{metric.title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">{metric.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{metric.note}</p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            );
          })}
        </Grid>
        <section aria-labelledby="foundation-readiness" className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card padding="lg">
            <div className="space-y-3">
              <h2 id="foundation-readiness" className="text-lg font-bold text-slate-950">
                Workflow Readiness
              </h2>
              <p className="text-sm text-slate-600">
                Navigation, authentication, responsive shell, and shared UI SDK composition are in place. Business screens and API-backed behavior remain intentionally deferred.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Next.js App Router', 'Zitadel-ready auth', 'UI SDK shell', 'RTL/LTR-ready layout'].map((item) => (
                  <Badge key={item} variant="default">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
          <Card padding="lg">
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-950">Empty State Pattern</h2>
              <p className="text-sm text-slate-600">
                Future workflow pages should use shared empty, loading, and error states from the UI SDK and stay scoped to seller presentation.
              </p>
            </div>
          </Card>
        </section>
      </Stack>
    </Container>
  );
}
