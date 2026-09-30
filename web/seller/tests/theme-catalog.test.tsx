import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeCatalogGrid, REGISTERED_THEMES } from '../components/theme/ThemeCatalogGrid';

describe('Theme Catalog Grid & Preview Actions (T008 / US1)', () => {
  const mockActiveInstallation = {
    id: 'inst-1',
    store_id: 'store-1',
    theme_key: 'default',
    version: '1.0.0',
    status: 'active'
  };

  it('renders all registered theme cards with badges and descriptions', () => {
    render(
      <ThemeCatalogGrid
        themes={[]}
        activeInstallation={mockActiveInstallation}
        onPreviewTheme={vi.fn()}
        onSelectForSwitch={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Default Clean' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editorial Boutique' })).toBeInTheDocument();
    expect(screen.getByText('Active Published Theme')).toBeInTheDocument();
  });

  it('triggers preview handler when Preview Theme is clicked', () => {
    const handlePreview = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeCatalogGrid
        themes={[]}
        activeInstallation={mockActiveInstallation}
        onPreviewTheme={handlePreview}
        onSelectForSwitch={vi.fn()}
      />
    );

    const boutiquePreviewBtn = screen.getByTestId('preview-btn-boutique');
    fireEvent.click(boutiquePreviewBtn);
    expect(handlePreview).toHaveBeenCalledWith('boutique');
  });

  it('triggers onSelectForSwitch when Switch to Theme is clicked on an inactive theme', () => {
    const handleSwitch = vi.fn();
    render(
      <ThemeCatalogGrid
        themes={[]}
        activeInstallation={mockActiveInstallation}
        onPreviewTheme={vi.fn()}
        onSelectForSwitch={handleSwitch}
      />
    );

    const boutiqueSwitchBtn = screen.getByTestId('switch-btn-boutique');
    fireEvent.click(boutiqueSwitchBtn);
    expect(handleSwitch).toHaveBeenCalledWith('boutique');
  });
});
