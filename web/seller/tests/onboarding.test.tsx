import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeSelectionCard } from '../components/onboarding/ThemeSelectionCard';
import { StoreLaunchChecklist } from '../components/onboarding/StoreLaunchChecklist';
import type { Store, SellerListing, ThemeInstallation } from '../lib/api/types';

describe('Onboarding Components', () => {
  describe('ThemeSelectionCard', () => {
    const mockTheme = {
      key: 'default',
      name: 'Default',
      badge: 'Recommended',
      description: 'Clean high-conversion layout',
      features: ['High-contrast grid', 'Mobile bottom bar'],
      previewGradient: 'bg-indigo-50'
    };

    it('renders theme details and handles selection', () => {
      const onSelect = vi.fn();
      render(<ThemeSelectionCard theme={mockTheme} isSelected={false} onSelect={onSelect} />);

      expect(screen.getByText('Default')).toBeDefined();
      expect(screen.getByText('Clean high-conversion layout')).toBeDefined();
      expect(screen.getByText('Recommended')).toBeDefined();

      fireEvent.click(screen.getByRole('radio'));
      expect(onSelect).toHaveBeenCalledWith('default');
    });

    it('shows selected visual state when isSelected is true', () => {
      render(<ThemeSelectionCard theme={mockTheme} isSelected={true} onSelect={vi.fn()} />);
      const card = screen.getByRole('radio');
      expect(card.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('StoreLaunchChecklist', () => {
    const mockStore: Store = {
      id: 'store-1',
      seller_id: 'seller-1',
      market_code: 'SA',
      code: 'al-baraka',
      name: 'Al Baraka Store',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const mockTheme: ThemeInstallation = {
      id: 'theme-inst-1',
      store_id: 'store-1',
      theme_key: 'default',
      version: '1.0.0',
      status: 'active'
    };

    it('renders 3-point checklist and detects incomplete catalog requirement', () => {
      const emptyListings: SellerListing[] = [];
      const onPublish = vi.fn();

      render(
        <StoreLaunchChecklist
          store={mockStore}
          listings={emptyListings}
          themeInstallation={mockTheme}
          onPublishStore={onPublish}
        />
      );

      expect(screen.getByText('Store Launch Checklist')).toBeDefined();
      expect(screen.getByText('Check Readiness')).toBeDefined();

      // Click check readiness
      fireEvent.click(screen.getByText('Check Readiness'));
      expect(screen.getByText('Publish Readiness Gate')).toBeDefined();
      expect(screen.getByText(/At least 1 active\/published product in catalog/)).toBeDefined();
    });

    it('enables Publish Storefront button when all 3 criteria are satisfied', () => {
      const activeListings: SellerListing[] = [
        {
          id: 'list-1',
          store_id: 'store-1',
          product_id: 'prod-1',
          market_code: 'SA',
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const onPublish = vi.fn();

      render(
        <StoreLaunchChecklist
          store={mockStore}
          listings={activeListings}
          themeInstallation={mockTheme}
          onPublishStore={onPublish}
        />
      );

      const publishBtn = screen.getByText('Publish Storefront');
      expect(publishBtn).toBeDefined();

      fireEvent.click(publishBtn);
      expect(onPublish).toHaveBeenCalled();
    });

    it('renders live storefront link when store is already active', () => {
      const publishedStore: Store = {
        ...mockStore,
        status: 'active'
      };

      render(
        <StoreLaunchChecklist
          store={publishedStore}
          listings={[]}
          themeInstallation={mockTheme}
          storefrontHost="al-baraka.matjerhub.local"
          onPublishStore={vi.fn()}
        />
      );

      expect(screen.getByText('Live & Published')).toBeDefined();
      expect(screen.getByText('Visit Live Storefront')).toBeDefined();
    });
  });
});
