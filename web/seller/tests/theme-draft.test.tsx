import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeDraftEditor } from '../components/theme/ThemeDraftEditor';

describe('Theme Draft Customization & Rollback Editor (T014 / US3)', () => {
  const mockThemeInstallation = {
    installation: {
      id: 'inst-1',
      store_id: 'store-1',
      theme_key: 'default',
      version: '1.0.0',
      status: 'active'
    },
    draft_config: {
      primary_color: '#4f46e5',
      accent_color: '#f59e0b',
      announcement_banner: 'Welcome to our store!',
      hero_heading: 'Discover Premium Items'
    },
    published_config: {
      primary_color: '#4f46e5',
      accent_color: '#f59e0b'
    },
    draft_revision: 2,
    published_revision: 1
  };

  it('renders draft settings with loaded configuration values', () => {
    render(
      <ThemeDraftEditor
        themeInstallation={mockThemeInstallation}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onPublishDraft={vi.fn()}
        isSaving={false}
        isPublishing={false}
      />
    );

    expect(screen.getByTestId('input-primary-color')).toHaveValue('#4f46e5');
    expect(screen.getByTestId('input-accent-color')).toHaveValue('#f59e0b');
    expect(screen.getByTestId('input-announcement-banner')).toHaveValue('Welcome to our store!');
    expect(screen.getByText('Unpublished Draft Edits Pending')).toBeInTheDocument();
  });

  it('enables Save Draft on input modification and triggers onSaveDraft', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeDraftEditor
        themeInstallation={mockThemeInstallation}
        onSaveDraft={handleSave}
        onDiscardDraft={vi.fn()}
        onPublishDraft={vi.fn()}
        isSaving={false}
        isPublishing={false}
      />
    );

    const bannerInput = screen.getByTestId('input-announcement-banner');
    fireEvent.change(bannerInput, { target: { value: 'New Seasonal Promo' } });

    const saveBtn = screen.getByTestId('btn-save-draft');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        announcement_banner: 'New Seasonal Promo'
      })
    );
  });

  it('triggers onDiscardDraft when Discard Changes is clicked', () => {
    const handleDiscard = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeDraftEditor
        themeInstallation={mockThemeInstallation}
        onSaveDraft={vi.fn()}
        onDiscardDraft={handleDiscard}
        onPublishDraft={vi.fn()}
        isSaving={false}
        isPublishing={false}
      />
    );

    const discardBtn = screen.getByTestId('btn-discard-draft');
    expect(discardBtn).not.toBeDisabled();
    fireEvent.click(discardBtn);
    expect(handleDiscard).toHaveBeenCalledTimes(1);
  });
});
