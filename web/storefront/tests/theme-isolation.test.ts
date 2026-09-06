import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Theme Isolation Matrix', () => {
  it('guarantees matjero-boutique has zero imports from matjero-default', () => {
    const boutiqueDir = path.resolve(__dirname, '../src/themes/matjero-boutique');
    const files = fs.readdirSync(boutiqueDir);

    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(path.join(boutiqueDir, file), 'utf-8');
        expect(content).not.toContain('matjero-default');
      }
    }
  });

  it('ensures shared components directory exists and contains PurchaseControl', () => {
    const sharedDir = path.resolve(__dirname, '../src/themes/shared');
    const files = fs.readdirSync(sharedDir);

    expect(files).toContain('PurchaseControl.tsx');
    expect(files).toContain('ProductSections.tsx');
  });
});
