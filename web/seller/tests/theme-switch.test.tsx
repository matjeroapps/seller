import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ThemeSwitchConfirmModal } from '../components/theme/ThemeSwitchConfirmModal';
import tcpConfig from '../tailwind.config';
import { SellerShell } from '../components/shell/SellerShell';
import type { SellerUser } from '../lib/auth';

const { navMocks, mockSellerApi, fetchConsole } = vi.hoisted(() => ({
  navMocks: { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() },
  mockSellerApi: { getStores: vi.fn() },
  fetchConsole: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navMocks,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams()
}));

vi.mock('../lib/api/client', () => ({ sellerApi: mockSellerApi, sellerClient: mockSellerApi }));
vi.mock('../lib/api/merchant-console', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api/merchant-console')>();
  return { ...original, fetchMerchantConsole: fetchConsole };
});

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

describe('explicit Seller data-theme dark binding (T013/US2)', () => {
  it('binds Tailwind dark variants to the explicit [data-theme="dark"] selector, not the OS preference', () => {
    expect(tcpConfig.darkMode).toEqual(['selector', '[data-theme="dark"]']);
  });
});

describe('SellerShell explicit theme state (US2)', () => {
  const user = { name: 'Test Seller', roles: ['seller'] } as unknown as SellerUser;

  beforeAll(() => {
    // Simulate an OS that prefers dark mode; Seller theme state must not
    // consult or follow it.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
  });

  async function renderShell() {
    mockSellerApi.getStores.mockResolvedValue({ items: [] });
    fetchConsole.mockRejectedValue(new Error('not navigated'));
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<SellerShell user={user}>{<div>content</div>}</SellerShell>);
    });
    return utils;
  }

  it('stays light and keeps the explicit Seller data-theme while the OS prefers dark', async () => {
    const utils = await renderShell();
    const shell = utils.container.firstElementChild as HTMLElement;
    expect(shell.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows the explicit Seller toggle, light then dark', async () => {
    const utils = await renderShell();
    const toggle = utils.getByRole('button', { name: 'Toggle color mode' });
    fireEvent.click(toggle);
    const shell = utils.container.firstElementChild as HTMLElement;
    expect(shell.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(toggle);
    expect(shell.getAttribute('data-theme')).toBe('light');
  });
});
