'use client';

import { Container, EmptyState, Stack } from '@matjerhub/ui-sdk';

export function FoundationDestination({ title, description }: { title: string; description: string }) {
  return (
    <Container size="xl">
      <Stack gap="lg">
        <EmptyState title={title} description={description} />
      </Stack>
    </Container>
  );
}
