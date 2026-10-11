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
        />
      );

      // Fill basic variant identity
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. red-xl/i), {
        target: { value: 'blue-xl' },
      });

      // Add attribute
      fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
      const attrIdInput = screen.getByPlaceholderText(/Attribute ID/i);
      const attrValInput = screen.getByPlaceholderText(/Attribute Value ID/i);

      fireEvent.change(attrIdInput, { target: { value: 'color-attr' } });
      fireEvent.change(attrValInput, { target: { value: 'blue-val' } });

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

  describe('Product Detail Page Integration', () => {
    const sampleDetail = {
      source: 'seller_owned',
      product: {
        id: 'prod_456',
        store_id: 'store_123',
        source: 'seller_owned',
        slug: 'test-product',
        status: 'active',
        created_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
      translations: [
        {
          id: 'trans_en',
          locale: 'en',
          name: 'Test Product',
          description: 'Description',
        },
      ],
      variants: [
        {
          id: 'var_1',
          code: 'var-red',
          status: 'active',
          attribute_values: [
            {
              id: 'av_1',
              attribute_id: 'attr_col',
              attribute_name: 'Color',
              attribute_code: 'color',
              value_id: 'val_red',
              value_name: 'Red',
              value_code: 'red',
            },
          ],
        },
      ],
      skus: [
        {
          id: 'sku_1',
          variant_id: 'var_1',
          code: 'SKU-RED-1',
          barcode: '628001',
          status: 'active',
          weight_grams: 500,
          length_mm: 200,
          width_mm: 150,
          height_mm: 50,
        },
      ],
      media: [],
    };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listStoreCategories.mockResolvedValue([]);
      mockApi.getStoreProductDetail.mockResolvedValue(sampleDetail);
      mockApi.listStoreMedia.mockResolvedValue({ assets: [] });
      mockApi.listProductMediaReferences.mockResolvedValue([]);
    });

    it('renders attribute badges and physical specs in the SKU table', async () => {
      await act(async () => {
        render(
          <StoreProductDetailPage
            params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      // Attribute badge rendered
      expect(screen.getByText(/Color: Red/i)).toBeInTheDocument();

      // Physical specs rendered in SKU table
      expect(screen.getByText('500g')).toBeInTheDocument();
      expect(screen.getByText('200×150×50mm')).toBeInTheDocument();
    });

    it('opens VariantOptionsModal when clicking Configure Variant & Specs', async () => {
      await act(async () => {
        render(
          <StoreProductDetailPage
            params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      const openButton = screen.getByRole('button', { name: /configure variant & specs/i });
      await act(async () => {
        fireEvent.click(openButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/New Variant & Physical SKU Specs/i)).toBeInTheDocument();
      });
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

    it('guards above 100 combinations and blocks creation', () => {
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

      selectValues(['Use A', 'Use B']);
      selectValues([
        ...Array.from({ length: 12 }, (_, i) => `A: A${i}`),
        ...Array.from({ length: 9 }, (_, i) => `B: B${i}`),
      ]);

      expect(screen.getByText(/Selection creates 108 combinations/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
    });
  });

  describe('Saved variant lifecycle and guidance (T024 US2)', () => {
    const lifecycleVariant = {
      id: 'var_1',
      code: 'var-red',
      status: 'active',
      attribute_values: [
        {
          id: 'av_1',
          attribute_id: 'attr_col',
          attribute_name: 'Color',
          attribute_code: 'color',
          value_id: 'val_red',
          value_name: 'Red',
          value_code: 'red',
        },
      ],
    };
    const referencedBySkuDetail = {
      source: 'seller_owned',
      product: {
        id: 'prod_456',
        store_id: 'store_123',
        source: 'seller_owned',
        slug: 'test-product',
        status: 'active',
        created_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
      translations: [{ id: 'trans_en', locale: 'en', name: 'Test Product', description: 'Description' }],
      variants: [lifecycleVariant],
      skus: [
        {
          id: 'sku_1',
          variant_id: 'var_1',
          code: 'SKU-RED-1',
          barcode: '628001',
          status: 'active',
          weight_grams: 500,
          length_mm: 200,
          width_mm: 150,
          height_mm: 50,
        },
      ],
      media: [],
    };
    const skulessDetail = { ...referencedBySkuDetail, skus: [] };
    const archivedDetail = {
      ...referencedBySkuDetail,
      variants: [{ ...lifecycleVariant, status: 'archived' }],
      skus: [{ ...referencedBySkuDetail.skus[0], status: 'inactive' }],
    };

    async function openLifecyclePage(detail: unknown = referencedBySkuDetail) {
      mockApi.getStoreProductDetail.mockResolvedValue(detail);
      await act(async () => {
        render(
          <StoreProductDetailPage
            params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
          />
        );
      });
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });
    }

    beforeEach(() => {
      vi.clearAllMocks();
      mockApi.listStoreCategories.mockResolvedValue([]);
      mockApi.getStoreProductDetail.mockResolvedValue(referencedBySkuDetail);
      mockApi.listStoreMedia.mockResolvedValue({ assets: [] });
      mockApi.listProductMediaReferences.mockResolvedValue([]);
    });

    it('persists edited variant code and nested SKU code with their saved statuses', async () => {
      mockApi.updateProductVariant.mockResolvedValue({});
      mockApi.updateProductSku.mockResolvedValue({});
      await openLifecyclePage();

      const variantCode = screen.getByDisplayValue('var-red');
      fireEvent.change(variantCode, { target: { value: 'var-red-saved' } });
      fireEvent.click(screen.getByRole('button', { name: /save variant/i }));

      await waitFor(() => {
        expect(mockApi.updateProductVariant).toHaveBeenCalledWith('store_123', 'prod_456', 'var_1', {
          code: 'var-red-saved',
          status: 'active',
        });
      });

      const skuCode = screen.getByDisplayValue('SKU-RED-1');
      fireEvent.change(skuCode, { target: { value: 'SKU-RED-1-EDITED' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockApi.updateProductSku).toHaveBeenCalledWith(
          'store_123',
          'prod_456',
          'var_1',
          'sku_1',
          expect.objectContaining({ code: 'SKU-RED-1-EDITED', status: 'active' })
        );
      });
    });

    it('shows referenced-attribute guidance, keeps the attribute badge, and disables removal as fallback', async () => {
      await openLifecyclePage();

      const guidance = screen.getByRole('note');
      expect(guidance).toHaveTextContent(/referenced by 1 SKU; permanent removal is blocked/i);
      expect(guidance).toHaveTextContent(/Archive it instead/i);
      // The saved combination stays rendered as a badge for context.
      expect(screen.getByText(/Color: Red/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete variant var-red' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Deactivate variant var-red' })).toBeEnabled();
    });

    it('renders an archived variant with its inactive historical SKU on reload', async () => {
      await openLifecyclePage(archivedDetail);

      // Variant status stays archived and the historical SKU keeps its code but
      // shows the inactive status: history is displayed, not discarded.
      expect(screen.getByDisplayValue('archived')).toBeInTheDocument();
      expect(screen.getByDisplayValue('SKU-RED-1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('inactive')).toBeInTheDocument();
    });

    it('confirms before deleting and reports the refreshed state', async () => {
      mockApi.deleteProductVariant.mockResolvedValue(undefined);
      await openLifecyclePage(skulessDetail);

      fireEvent.click(screen.getByRole('button', { name: 'Delete variant var-red' }));
      await screen.findByRole('dialog');
      expect(screen.getByRole('heading', { name: 'Remove Variant' })).toBeInTheDocument();
      expect(screen.getByText(/Permanently remove variant var-red\?/)).toBeInTheDocument();

      // Queue the post-removal reload before confirming.
      mockApi.getStoreProductDetail.mockResolvedValue({ ...skulessDetail, variants: [] });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Variant' }));

      await waitFor(() => {
        expect(mockApi.deleteProductVariant).toHaveBeenCalledWith('store_123', 'prod_456', 'var_1');
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Variant removed.')).toBeInTheDocument();
    });

    it('offers the archive fallback for a referenced variant', async () => {
      mockApi.archiveProductVariant.mockResolvedValue({});
      await openLifecyclePage();

      expect(screen.getByRole('button', { name: 'Delete variant var-red' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate variant var-red' }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Archive Variant' })).toBeInTheDocument();
      expect(screen.getByText(/Archive variant var-red\? Its active SKUs will be deactivated/)).toBeInTheDocument();

      mockApi.getStoreProductDetail.mockResolvedValueOnce(archivedDetail);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Variant' }));

      await waitFor(() => {
        expect(mockApi.archiveProductVariant).toHaveBeenCalledWith('store_123', 'prod_456', 'var_1');
      });
      expect(mockApi.deleteProductVariant).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByDisplayValue('archived')).toBeInTheDocument();
      });
    });

    it('keeps the default-variant workflow for products without configurable attributes', async () => {
      // A product without configurable attributes carries the default variant
      // (no attribute_values), not an attribute-bearing variant.
      const defaultVariantDetail = {
        ...skulessDetail,
        variants: [{ id: 'var_default', code: 'default', status: 'active', attribute_values: [] }],
      };
      await openLifecyclePage(defaultVariantDetail);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /configure variant & specs/i }));
      });
      // Without attribute data the single-variant spec form opens instead of
      // the batch preview, so the default variant stays creatable.
      const dialog = await screen.findByRole('dialog');
      expect(screen.getByText(/New Variant & Physical SKU Specs/i)).toBeInTheDocument();
      expect(dialog.querySelector('[data-testid="variant-attribute-picker"]')).toBeNull();
    });

    it('submits edited attribute_values for a saved unreferenced variant and persists the new combination', async () => {
      mockApi.updateProductVariant.mockResolvedValue({});
      await openLifecyclePage(skulessDetail);

      // The saved combination seeds the editable rows.
      expect(screen.getByTestId('variant-attribute-editor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('val_red')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Attribute value for variant var-red'), {
        target: { value: 'val_blue' },
      });
      fireEvent.change(screen.getByDisplayValue('var-red'), { target: { value: 'var-blue' } });

      // Next load returns the persisted combination like a real reload.
      mockApi.getStoreProductDetail.mockResolvedValue({
        ...skulessDetail,
        variants: [
          {
            ...lifecycleVariant,
            code: 'var-blue',
            attribute_values: [
              {
                ...lifecycleVariant.attribute_values[0],
                id: 'av_2',
                value_id: 'val_blue',
                value_name: 'Blue',
                value_code: 'blue',
              },
            ],
          },
        ],
      });
      fireEvent.click(screen.getByRole('button', { name: /save variant/i }));

      await waitFor(() => {
        expect(mockApi.updateProductVariant).toHaveBeenCalledWith('store_123', 'prod_456', 'var_1', {
          code: 'var-blue',
          status: 'active',
          attribute_values: [{ attribute_id: 'attr_col', attribute_value_id: 'val_blue' }],
        });
      });

      // Reloaded detail renders the persisted combination, proving persistence.
      await waitFor(() => {
        expect(screen.getByText(/Color: Blue/i)).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('var-blue')).toBeInTheDocument();
    });

    it('keeps referenced variants attribute-immutable and preserves canonical conflicts with unsaved edits', async () => {
      mockApi.updateProductVariant.mockRejectedValue(
        Object.assign(new Error('variant is referenced by active inventory records'), { code: 'resource_in_use', status: 409 })
      );
      await openLifecyclePage(referencedBySkuDetail);

      // Attribute editing is not offered for referenced variants; guidance
      // names the lock while code and SKU edits stay available.
      expect(screen.queryByTestId('variant-attribute-editor')).toBeNull();
      const guidance = screen.getByTestId('variant-reference-guidance');
      expect(guidance).toHaveTextContent(/attribute combination is locked/i);
      expect(screen.getByText(/Color: Red/i)).toBeInTheDocument();

      const variantCode = screen.getByDisplayValue('var-red');
      fireEvent.change(variantCode, { target: { value: 'var-red-unsaved' } });
      fireEvent.click(screen.getByRole('button', { name: /save variant/i }));

      await waitFor(() => {
        expect(mockApi.updateProductVariant).toHaveBeenCalledWith('store_123', 'prod_456', 'var_1', {
          code: 'var-red-unsaved',
          status: 'active',
        });
      });

      // Canonical error is surfaced verbatim and unsaved edits survive it.
      await waitFor(() => {
        expect(screen.getByText(/variant is referenced by active inventory records/i)).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('var-red-unsaved')).toBeInTheDocument();
    });
  });
});
