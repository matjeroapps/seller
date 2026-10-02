import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountScreen } from '../components/seller/AccountScreen';
import { SettingsScreen } from '../components/seller/SettingsScreen';
import { OrderDocumentsScreen } from '../components/seller/OrderDocumentsScreen';
import { sellerClient } from '../lib/api/client';

describe('Live & Operations Screens Verification (T020)', () => {
  it('renders AccountScreen title and form', async () => {
    vi.spyOn(sellerClient, 'getProfile').mockResolvedValueOnce({
      id: 'usr_seller_a_owner',
      email: 'owner@matjerhub.test',
      name: 'Seller Owner',
      roles: ['seller_owner'],
    });

    render(<AccountScreen />);
    expect(await screen.findByText('Account Profile')).toBeInTheDocument();
    expect(screen.getByText('2FA, Passkeys & Session Revocation Unavailable')).toBeInTheDocument();
  });

  it('renders SettingsScreen with store settings', async () => {
    vi.spyOn(sellerClient, 'getStores').mockResolvedValueOnce({
      items: [{ id: 'str_a1_1001', seller_id: 'sel_a', market_code: 'SA', code: 'store-a1', name: 'Store A1', status: 'active', created_at: '', updated_at: '' }],
      active_store_limit: 5,
      active_store_count: 1,
    });
    vi.spyOn(sellerClient, 'getStoreOperationalState').mockResolvedValueOnce({
      store_id: 'str_a1_1001',
      checkout_status: 'accepting',
      maintenance_message: '',
      checkout_accepting: true,
    });

    render(<SettingsScreen storeId="str_a1_1001" />);
    expect(await screen.findByText('Store Settings')).toBeInTheDocument();
    expect(screen.getByText('Tax Rules & Custom Legal Policies Unavailable')).toBeInTheDocument();
  });

  it('renders OrderDocumentsScreen with printable markup', async () => {
    vi.spyOn(sellerClient, 'getStoreOrderDetail').mockResolvedValueOnce({
      id: 'ord_1001',
      order_number: 'ORD-1001',
      status: 'confirmed',
      currency: 'SAR',
      subtotal: 10000,
      total: 10000,
      item_count: 1,
      items: [{ id: 'item_1', product_name: 'Product A', sku_code: 'SKU-A', quantity: 1, unit_price: 10000, total_price: 10000, source: 'seller_owned' }],
      timeline: [],
      allowed_next_actions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(<OrderDocumentsScreen storeId="str_a1_1001" orderId="ord_1001" />);
    expect(await screen.findByText('PACKING SLIP & RECEIPT')).toBeInTheDocument();
    expect(screen.getByText('PDF Export & ZATCA E-Invoicing Signing Unavailable')).toBeInTheDocument();
  });
});
