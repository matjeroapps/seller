import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SCREEN_REGISTRY,
  getAllMappedScreens,
  getRouteScreens,
  getScreenByDesignId,
} from '../lib/screens/registry';

describe('Canonical Screen Registry & Evidence Reconciliation (T047)', () => {
  it('contains exactly 28 approved design records', () => {
    const screens = getAllMappedScreens();
    expect(screens).toHaveLength(28);
  });

  it('contains 26 route/app screens and 2 non-route assets', () => {
    const routeScreens = getRouteScreens();
    const assets = CANONICAL_SCREEN_REGISTRY.filter((s) => !s.isRoute);

    expect(routeScreens).toHaveLength(26);
    expect(assets).toHaveLength(2);
    expect(assets.map((a) => a.designId)).toEqual([
      'cc2a635b61244038b532a6ced210873f',
      'cc8331289828447385c2725e039aaa4c',
    ]);
  });

  it('maps to 24 unique route paths across 26 route records', () => {
    const routeScreens = getRouteScreens();
    const uniqueRoutes = new Set(routeScreens.map((s) => s.destination));
    expect(uniqueRoutes.size).toBe(24);
  });

  it('retrieves screen records by design ID', () => {
    const dashboardScreen = getScreenByDesignId('6cacb65351564341a4c1401391f6bd2b');
    expect(dashboardScreen).toBeDefined();
    expect(dashboardScreen?.title).toBe('Store Overview');
    expect(dashboardScreen?.classification).toBe('live');
  });

  it('ensures every record has a valid classification and test identifier', () => {
    for (const screen of CANONICAL_SCREEN_REGISTRY) {
      expect(['live', 'partial', 'setup-required', 'unavailable', 'asset']).toContain(screen.classification);
      expect(screen.testIdentifier).toBeDefined();
      expect(screen.testIdentifier.length).toBeGreaterThan(0);
    }
  });
});
