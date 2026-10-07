import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductMediaWorkspace } from '../components/seller/ProductMediaWorkspace';
import type { ProductMediaReference, StoreMediaAsset } from '../lib/api/types';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    listStoreMedia: vi.fn(),
    createMediaUpload: vi.fn(),
    completeMediaUpload: vi.fn(),
    attachProductMedia: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateProductMediaReference: vi.fn(),
    detachProductMedia: vi.fn(),
    deleteStoreMedia: vi.fn()
  }
}));

vi.mock('../lib/api/client', () => ({ sellerApi: mockApi }));

const assets: StoreMediaAsset[] = [
  {
    id: 'asset-1',
    store_id: 'store-1',
    checksum_sha256: 'a'.repeat(64),
    content_type: 'image/png',
    byte_size: 1024,
    original_filename: 'front.png',
    status: 'ready',
    url: 'https://cdn.test/front.png',
    created_at: '2026-10-07T08:00:00Z'
  },
  {
    id: 'asset-2',
    store_id: 'store-1',
    checksum_sha256: 'b'.repeat(64),
    content_type: 'image/jpeg',
    byte_size: 2048,
    original_filename: 'side.jpg',
    status: 'ready',
    url: 'https://cdn.test/side.jpg',
    created_at: '2026-10-07T08:01:00Z'
  }
];

const references: ProductMediaReference[] = [
  {
    id: 'ref-1',
    store_id: 'store-1',
    product_id: 'product-1',
    asset_id: 'asset-1',
    alt_text: 'Front view',
    sort_order: 0,
    is_primary: true,
    url: 'https://cdn.test/front.png',
    created_at: '2026-10-07T08:02:00Z'
  }
];

function renderWorkspace(overrides: Partial<React.ComponentProps<typeof ProductMediaWorkspace>> = {}) {
  return render(
    <ProductMediaWorkspace
      storeId="store-1"
      productId="product-1"
      productName="Travel bag"
      canManage
      initialAssets={assets}
      initialReferences={references}
      {...overrides}
    />
  );
}

describe('ProductMediaWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listStoreMedia.mockResolvedValue({ items: assets, total: assets.length, limit: 12, offset: 0 });
    mockApi.listProductMediaReferences.mockResolvedValue({ items: references });
    mockApi.attachProductMedia.mockImplementation(async (_storeId, _productId, payload) => ({
      ...references[0],
      id: `ref-${payload.asset_id}`,
      asset_id: payload.asset_id,
      is_primary: false,
      sort_order: payload.sort_order
    }));
    mockApi.updateProductMediaReference.mockImplementation(async (_storeId, _productId, id, payload) => ({
      ...references[0],
      id,
      ...payload
    }));
    mockApi.detachProductMedia.mockResolvedValue(undefined);
  });

  it('renders an accessible dropzone, visual gallery, search, and multi-select attach flow', async () => {
    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Upload product images' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search store media' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('front.png')).toBeInTheDocument();
      expect(screen.getByText('side.jpg')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /side\.jpg/i }));
    fireEvent.click(screen.getByRole('button', { name: /Attach selected \(1\)/i }));

    await waitFor(() => {
      expect(mockApi.attachProductMedia).toHaveBeenCalledWith('store-1', 'product-1', {
        asset_id: 'asset-2',
        sort_order: 1,
        is_primary: false
      });
      expect(screen.getByText('1 image attached.')).toBeInTheDocument();
    });
  });

  it('filters the gallery by filename and attachment state', async () => {
    renderWorkspace();

    await waitFor(() => expect(screen.getByText('side.jpg')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Search store media' }), {
      target: { value: 'side' }
    });

    await waitFor(() => {
      expect(mockApi.listStoreMedia).toHaveBeenLastCalledWith('store-1', expect.objectContaining({ filename: 'side', offset: 0 }));
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter attachment status' }), {
      target: { value: 'unattached' }
    });
    expect(screen.getByRole('combobox', { name: 'Filter attachment status' })).toHaveValue('unattached');
  });

  it('rejects unsupported and oversized files with inline messages', async () => {
    renderWorkspace();
    const dropzone = screen.getByRole('button', { name: 'Upload product images' });
    const unsupported = new File(['text'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [unsupported] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('notes.txt: use JPG, PNG, or WebP.');

    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [oversized] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('large.png: maximum size is 10 MB.');
    expect(mockApi.createMediaUpload).not.toHaveBeenCalled();
  });

  it('detaches a reference without deleting the underlying store asset', async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByText('Alt text: Front view')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Detach image 1' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detach image' }));

    await waitFor(() => {
      expect(mockApi.detachProductMedia).toHaveBeenCalledWith('store-1', 'product-1', 'ref-1');
      expect(screen.getByText('Image detached from this product. The store media asset was kept.')).toBeInTheDocument();
    });
    expect(mockApi.deleteStoreMedia).not.toHaveBeenCalled();
  });

  it('updates alt text, primary state, and display order through reference APIs', async () => {
    renderWorkspace({
      initialReferences: [
        ...references,
        { ...references[0], id: 'ref-2', asset_id: 'asset-2', sort_order: 1, is_primary: false, alt_text: 'Side view' }
      ]
    });
    await waitFor(() => expect(screen.getByText('Alt text: Front view')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Alt text: Front view' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Alt text for image 1' }), { target: { value: 'Main front' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set primary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 up' }));

    await waitFor(() => {
      expect(mockApi.updateProductMediaReference).toHaveBeenCalled();
    });
    expect(mockApi.updateProductMediaReference).toHaveBeenCalledWith(
      'store-1',
      'product-1',
      'ref-1',
      expect.objectContaining({ alt_text: 'Main front' })
    );
  });
});
