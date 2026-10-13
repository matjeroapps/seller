import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VariantOptionsModal } from '../components/seller/VariantOptionsModal';
import StoreProductDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page';
import type { CreateProductVariantPayload } from '../lib/api/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard/stores/store_123/catalog/products/prod_456',
}));

const { mockApi, mockCreateVariantBatch, mockRetryFailedVariantBatch } = vi.hoisted(() => {
  const mockApi = {
    getStoreProductDetail: vi.fn(),
    listStoreCategories: vi.fn(),
    listStoreMedia: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateProductTranslations: vi.fn(),
    updateProductSlug: vi.fn(),
    updateProductStatus: vi.fn(),
    archiveProduct: vi.fn(),
    createProductVariant: vi.fn(),
    updateProductVariant: vi.fn(),
    archiveProductVariant: vi.fn(),
    deleteProductVariant: vi.fn(),
    createProductSku: vi.fn(),
    updateProductSku: vi.fn(),
    attachProductMedia: vi.fn(),
    detachProductMedia: vi.fn(),
  };
  const mockCreateVariantBatch = vi.fn();
  const mockRetryFailedVariantBatch = vi.fn();
  return { mockApi, mockCreateVariantBatch, mockRetryFailedVariantBatch };
});

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  sellerClient: mockApi,
}));

vi.mock('../lib/variants/batch', () => ({
  createVariantBatch: mockCreateVariantBatch,
  retryFailedVariantBatch: mockRetryFailedVariantBatch,
  variantIdempotencyKey: (productId: string, clientItemId: string) => `product-variant:${productId}:${clientItemId}`,
}));

describe('Variant Options & SKU Physical Specs (T026-T028)', () => {
  describe('VariantOptionsModal Unit Tests', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <VariantOptionsModal
          isOpen={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders form fields when open and closes on Cancel', () => {
      const onClose = vi.fn();
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={onClose}
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText(/New Variant & Physical SKU Specs/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. red-xl/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. SKU-RED-XL/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('supports adding attributes and submitting full payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={onSubmit}
          productAttributes={[
            { id: 'color-attr', name: 'Color', code: 'color', status: 'active', values: [{ id: 'blue-val', name: 'Blue', code: 'blue', status: 'active' }] },
          ]}
        />
      );

      // Fill basic variant identity
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. red-xl/i), {
        target: { value: 'blue-xl' },
      });

      // Add attribute
      fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
      const [attributeSelect, valueSelect] = screen.getAllByRole('combobox');
      fireEvent.change(attributeSelect, { target: { value: 'color-attr' } });
      fireEvent.change(valueSelect, { target: { value: 'blue-val' } });

      // Fill SKU & specs
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. SKU-RED-XL/i), {
        target: { value: 'SKU-BLU-XL' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 6281000999911/i), {
        target: { value: '6281000123456' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 450/i), {
        target: { value: '600' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Length \(mm\)/i), {
        target: { value: '350' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Width \(mm\)/i), {
        target: { value: '250' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Height \(mm\)/i), {
        target: { value: '80' },
      });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. 15000/i), {
        target: { value: '18000' },
      });

      // Submit
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create variant with specs/i }));
      });

      expect(onSubmit).toHaveBeenCalledWith({
        code: 'blue-xl',
        status: 'active',
        sku_code: 'SKU-BLU-XL',
        barcode: '6281000123456',
        attribute_values: [
          { attribute_id: 'color-attr', attribute_value_id: 'blue-val' },
        ],
        weight_grams: 600,
        dimensions: {
          length_mm: 350,
          width_mm: 250,
          height_mm: 80,
        },
        price_minor_units: 18000,
      });
    });

    it('validates required SKU code when submitting specs', async () => {
      const onSubmit = vi.fn();
      render(
        <VariantOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. red-xl/i), {
        target: { value: 'only-code' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create variant with specs/i }));
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Variant batch matrix UI (T034 preview/batch)', () => {
    const batchAttributes = [
      {
        id: 'attr_color',
        code: 'color',
        name: 'Color',
        values: [
          { id: 'val_red', code: 'red', name: 'Red' },
          { id: 'val_blue', code: 'blue', name: 'Blue' },
        ],
      },
      {
        id: 'attr_size',
        code: 'size',
        name: 'Size',
        values: [
          { id: 'val_s', code: 's', name: 'Small' },
          { id: 'val_l', code: 'l', name: 'Large' },
        ],
      },
    ];

    const batchBase = {
      storeId: 'store_123',
      productId: 'prod_456',
      productCode: 'test-product',
      existingVariantRecords: [
        {
          id: 'var_existing',
          code: 'TEST-PRODUCT-RED-S',
          status: 'active',
          sku: { id: 'sku_existing', variant_id: 'var_existing', code: 'SKU-TEST-PRODUCT-RED-S', status: 'active' },
          attribute_values: [
            { id: 'av_1', attribute_id: 'attr_color', attribute_code: 'color', value_id: 'val_red' },
            { id: 'av_2', attribute_id: 'attr_size', attribute_code: 'size', value_id: 'val_s' },
          ],
        },
      ],
    };

    function selectValues(labels: string[]) {
      for (const label of labels) {
        fireEvent.click(screen.getByRole('checkbox', { name: label }));
      }
    }

    it('previews combinations, marks existing ones, and supports row removal', () => {
      render(
        <VariantOptionsModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          batch={{ ...batchBase, attributes: batchAttributes, onComplete: vi.fn() } as any}
        />
      );

      selectValues(['Use Color', 'Use Size']);
      selectValues(['Color: Blue', 'Color: Red', 'Size: Small', 'Size: Large']);

      expect(screen.getByText('4 combinations · 3 to create')).toBeInTheDocument();
      expect(screen.getByText(/exists/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /remove TEST-PRODUCT-BLUE-L/i }));
      expect(screen.getByText('4 combinations · 2 to create')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /restore/i }));
      expect(screen.getByText('4 combinations · 3 to create')).toBeInTheDocument();
    });

    it('creates the batch, reports mixed results, and retries failed rows only', async () => {
      const createdVariant = {
        id: 'var_new',
        product_id: 'prod_456',
        code: 'TEST-PRODUCT-BLUE-S',
        status: 'active',
        created_at: '',
        updated_at: '',
      };
      mockCreateVariantBatch.mockResolvedValueOnce({
        items: [
          { client_item_id: 'attr_color-val_blue__attr_size-val_l', status: 'skipped' },
          { client_item_id: 'attr_color-val_blue__attr_size-val_s', status: 'created', variant: createdVariant },
          { client_item_id: 'attr_color-val_red__attr_size-val_l', status: 'failed', error: { code: 'conflict', message: 'SKU code is already used' } },
          { client_item_id: 'attr_color-val_red__attr_size-val_s', status: 'already_exists' },
        ],
        created_count: 1,
        failed_count: 1,
      });
      mockRetryFailedVariantBatch.mockResolvedValue({
        items: [
          { client_item_id: 'attr_color-val_red__attr_size-val_l', status: 'created', variant: createdVariant },
        ],
        created_count: 1,
        failed_count: 0,
      });
      const onComplete = vi.fn();

      render(
        <VariantOptionsModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          batch={{ ...batchBase, attributes: batchAttributes, onComplete } as any}
        />
      );

      selectValues(['Use Color', 'Use Size']);
      selectValues(['Color: Blue', 'Color: Red', 'Size: Small', 'Size: Large']);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create 3 variants/i })).toBeInTheDocument();
      });
      await act(async () => {
        console.log("DBG_BTN:", screen.getByRole("button", { name: /create/i }).outerHTML.slice(0, 300));
        fireEvent.click(screen.getByRole('button', { name: /create 3 variants/i }));
      });

      await waitFor(() => {
        expect(mockCreateVariantBatch).toHaveBeenCalledTimes(1);
      });
      expect(mockCreateVariantBatch).toHaveBeenCalledWith('store_123', 'prod_456', expect.any(Array));
      await waitFor(() => {
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getAllByText(/failed: SKU code is already used/i).length).toBeGreaterThan(0);
      });
      expect(mockRetryFailedVariantBatch).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /retry 1 failed/i }));
      });
      await waitFor(() => {
        expect(mockRetryFailedVariantBatch).toHaveBeenCalledTimes(1);
        expect(mockRetryFailedVariantBatch).toHaveBeenCalledWith('store_123', 'prod_456', expect.arrayContaining([
          expect.objectContaining({
            client_item_id: 'attr_color-val_red__attr_size-val_l',
            result: expect.objectContaining({ status: 'failed' }),
          }),
        ]));
      });
    });

    it('guards above 100 combinations and blocks creation', async () => {
      const manyAttributes = [
        {
          id: 'attr_a',
          code: 'a',
          name: 'A',
          values: Array.from({ length: 12 }, (_, i) => ({ id: `va_${i}`, code: `a${i}`, name: `A${i}` })),
        },
        {
          id: 'attr_b',
          code: 'b',
          name: 'B',
          values: Array.from({ length: 9 }, (_, i) => ({ id: `vb_${i}`, code: `b${i}`, name: `B${i}` })),
        },
      ];
      render(
        <VariantOptionsModal
          isOpen
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          batch={{ ...batchBase, attributes: manyAttributes } as any}
        />
      );

      fireEvent.click(screen.getByRole('checkbox', { name: 'Use A' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Use B' }));
      // Resolve all value checkbox references up front: with the full matrix
      // rendered, each re-query walks the entire table DOM (~180ms per lookup in
      // jsdom), which alone pushes this test past the 5s timeout. Reusing the
      // same checkboxes keeps the exact same selection and guard semantics.
      const valueLabels = [
        ...Array.from({ length: 12 }, (_, i) => `A: A${i}`),
        ...Array.from({ length: 9 }, (_, i) => `B: B${i}`),
      ];
      const valueCheckboxes = valueLabels.map((label) => screen.getByRole('checkbox', { name: label }));
      await act(async () => {
        for (const checkbox of valueCheckboxes) fireEvent.click(checkbox);
      });

      expect(screen.getByText(/Selection creates 108 combinations/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
    });
  });

});
