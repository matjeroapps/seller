'use client';

import { ChevronDown, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { isOperableWorkspace, type MerchantWorkspace } from '@/lib/api/merchant-console';

/**
 * Merchant workspace switcher (Feature 025). Rendered only when the principal
 * holds more than one operable workspace. Functionally independent of the
 * Store switcher: switching writes the canonical workspace URL and reloads
 * merchant-scoped views from the newly selected workspace — no store selection
 * is carried across workspaces.
 */
export function MerchantWorkspaceSwitcher({
  workspaces,
  selectedMerchantId,
  onSelect
}: {
  workspaces: MerchantWorkspace[];
  selectedMerchantId?: string;
  onSelect: (merchantId: string) => void;
}) {
  const operable = workspaces.filter(isOperableWorkspace);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  if (operable.length < 2) {
    return null;
  }

  const selected = operable.find((ws) => ws.merchant_id === selectedMerchantId) || operable[0];

  return (
    <div className="seller-sidebar__store" ref={containerRef}>
      <button
        type="button"
        className="store-switcher__trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="merchant-workspace-switcher"
      >
        <span className="store-switcher__meta">
          <span className="store-switcher__label">Merchant workspace</span>
          <span className="store-switcher__name">{selected?.legal_name || selected?.merchant_code}</span>
          <span className="store-switcher__code">{selected?.membership.status}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4" />
      </button>
      {isOpen && (
        <div className="store-switcher__menu" role="listbox" aria-label="Merchant workspaces">
          {operable.map((ws) => (
            <button
              key={ws.merchant_id}
              type="button"
              role="option"
              aria-selected={ws.merchant_id === selected?.merchant_id}
              className={`store-switcher__item ${ws.merchant_id === selected?.merchant_id ? 'is-active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                onSelect(ws.merchant_id);
              }}
              data-testid={`merchant-workspace-option-${ws.merchant_code}`}
            >
              <span>
                <span className="store-switcher__name">{ws.legal_name}</span>
                <span className="store-switcher__code">{ws.merchant_code}</span>
              </span>
              {ws.merchant_id === selected?.merchant_id && <Check aria-hidden="true" className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
