import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductListing } from '../components/storefront/ProductListing';
import { StorefrontHome } from '../components/storefront/StorefrontHome';
import { StorefrontSearch } from '../components/storefront/StorefrontSearch';
import { StorefrontShell } from '../components/storefront/StorefrontShell';
import { getStorefront } from '../lib/storefront/mock-data';

describe('storefront foundation', () => {
  it('renders the customer storefront shell independently from dashboard navigation', () => {
    const storefront = getStorefront('modern-home');

    render(
      <StorefrontShell storefront={storefront} locale="en">
        <StorefrontHome storefront={storefront} locale="en" />
      </StorefrontShell>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Modern Home Home/i })).toHaveAttribute('href', '/store/modern-home?lang=en');
    expect(screen.getByRole('navigation', { name: 'Store navigation' })).toBeInTheDocument();
    expect(screen.queryByText('Seller Dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Everything for a calmer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Featured products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Shop by category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Opening week bundle' })).toBeInTheDocument();
  });

  it('sets RTL direction and Arabic customer-visible labels for the storefront shell', () => {
    const storefront = getStorefront('modern-home');
    const { container } = render(
      <StorefrontShell storefront={storefront} locale="ar">
        <StorefrontHome storefront={storefront} locale="ar" />
      </StorefrontShell>
    );

    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
    expect(container.firstElementChild).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('navigation', { name: 'تنقل المتجر' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /كل ما يجعل المنزل/ })).toBeInTheDocument();
  });

  it('renders listing controls, product cards, and pagination placeholders', () => {
    const storefront = getStorefront('modern-home');

    render(<ProductListing storefront={storefront} locale="en" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByLabelText('Availability')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1 of 3');
  });

  it('renders search empty, no-results, and result states from mock data', () => {
    const storefront = getStorefront('modern-home');
    const { rerender } = render(<StorefrontSearch storefront={storefront} locale="en" query="" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Start with a product, category, or style' })).toBeInTheDocument();

    rerender(<StorefrontSearch storefront={storefront} locale="en" query="zzz" />);
    expect(screen.getByRole('heading', { level: 3, name: 'No matching products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Suggested searches' })).toBeInTheDocument();

    rerender(<StorefrontSearch storefront={storefront} locale="en" query="lamp" />);
    const results = within(screen.getByRole('region', { name: 'Search the store results' }));
    expect(results.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });
});
