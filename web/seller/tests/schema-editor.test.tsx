import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchemaEditor } from '../src/components/SchemaEditor';

describe('SchemaEditor Component', () => {
  const sampleSchema = {
    type: 'object',
    properties: {
      logo: { type: 'string', maxLength: 512, title: 'Store Logo' },
      colors: {
        type: 'object',
        properties: {
          primary: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', title: 'Primary Color' },
          secondary: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', title: 'Secondary Color' }
        }
      },
      announcement_bar: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', title: 'Enable Announcement' },
          text: { type: 'string', maxLength: 256, title: 'Announcement Text' }
        }
      },
      footer: {
        type: 'object',
        properties: {
          columns: { type: 'integer', minimum: 1, maximum: 4, title: 'Footer Columns' }
        }
      },
      product_card_layout: {
        type: 'string',
        enum: ['compact', 'detailed'],
        title: 'Card Layout'
      },
      homepage_sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['featured', 'category_grid'] },
            title: { type: 'string' }
          }
        }
      }
    }
  };

  const sampleValue = {
    logo: 'https://example.com/logo.png',
    colors: {
      primary: '#0f766e',
      secondary: '#0d9488'
    },
    announcement_bar: {
      enabled: true,
      text: 'Welcome sale!'
    },
    footer: {
      columns: 3
    },
    product_card_layout: 'compact',
    homepage_sections: [{ type: 'featured', title: 'Featured' }],
    unrelated_preserve_key: 'KEEP_THIS_INTACT'
  };

  it('renders all field types from JSON schema correctly', () => {
    render(
      <SchemaEditor
        schema={sampleSchema}
        value={sampleValue}
        onChange={vi.fn()}
        copy={{ select: 'Select', enabled: 'Enabled', disabled: 'Disabled', remove: 'Remove', addItem: 'Add Item' }}
      />
    );

    expect(screen.getByLabelText('Store Logo')).toHaveValue('https://example.com/logo.png');
    expect(screen.getByLabelText('Enable Announcement')).toBeChecked();
    expect(screen.getByLabelText('Footer Columns')).toHaveValue(3);
    expect(screen.getByLabelText('Card Layout')).toHaveValue('compact');
  });

  it('preserves unrelated configuration keys when updating a field', () => {
    const handleChange = vi.fn();

    render(
      <SchemaEditor
        schema={sampleSchema}
        value={sampleValue}
        onChange={handleChange}
        copy={{ select: 'Select', enabled: 'Enabled', disabled: 'Disabled', remove: 'Remove', addItem: 'Add Item' }}
      />
    );

    const logoInput = screen.getByLabelText('Store Logo');
    fireEvent.change(logoInput, { target: { value: 'https://example.com/new-logo.png' } });

    expect(handleChange).toHaveBeenCalled();
    const updatedValue = handleChange.mock.calls[0][0];

    expect(updatedValue.logo).toBe('https://example.com/new-logo.png');
    expect(updatedValue.unrelated_preserve_key).toBe('KEEP_THIS_INTACT');
    expect(updatedValue.colors.primary).toBe('#0f766e');
    expect(updatedValue.footer.columns).toBe(3);
  });

  it('renders fallback notice for unknown field constructs safely', () => {
    const unknownSchema = {
      type: 'object',
      properties: {
        custom_widget: { type: 'unknown_unsupported_type' }
      }
    };

    render(
      <SchemaEditor
        schema={unknownSchema}
        value={{ custom_widget: {} }}
        onChange={vi.fn()}
        copy={{ unsupportedField: 'Unsupported field type' }}
      />
    );

    expect(screen.getByText(/Unsupported field type: unknown_unsupported_type/i)).toBeInTheDocument();
  });
});
