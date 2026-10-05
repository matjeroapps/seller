'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { SellerUser } from '@/lib/auth';

const SellerShellUserContext = createContext<SellerUser | null>(null);

export function SellerShellUserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: SellerUser;
}) {
  return <SellerShellUserContext.Provider value={user}>{children}</SellerShellUserContext.Provider>;
}

export function useSellerShellUser() {
  return useContext(SellerShellUserContext);
}
