import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSwitchConfirmModal } from '../components/theme/ThemeSwitchConfirmModal';

describe('Theme Switch Confirmation Modal & Atomic Publish (T011 / US2)', () => {
  it('renders modal with target theme name and commerce safety disclaimer', () => {
    render(
      <ThemeSwitchConfirmModal
        isOpen={true}
        targetThemeKey="boutique"
        currentThemeKey="default"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        isPublishing={false}
      />
    );

    expect(screen.getByText('Confirm Store Theme Switch')).toBeInTheDocument();
    expect(screen.getByText('Commerce Invariants Guaranteed')).toBeInTheDocument();
    expect(screen.getByText('Editorial Boutique')).toBeInTheDocument();
  });

  it('triggers onConfirm when Switch & Publish button is clicked', () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeSwitchConfirmModal
        isOpen={true}
        targetThemeKey="boutique"
        currentThemeKey="default"
        onConfirm={handleConfirm}
        onClose={vi.fn()}
        isPublishing={false}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Switch & Publish Editorial Boutique/i });
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ThemeSwitchConfirmModal
        isOpen={true}
        targetThemeKey="boutique"
        currentThemeKey="default"
        onConfirm={vi.fn()}
        onClose={handleClose}
        isPublishing={false}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
