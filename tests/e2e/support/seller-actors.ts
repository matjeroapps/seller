export interface SellerActor {
  id: string;
  sub: string;
  email: string;
  name: string;
  role: 'seller_owner' | 'seller_manager' | 'seller_staff' | 'none';
  authorizedStoreIds: string[];
}

export interface StoreFixture {
  storeId: string;
  name: string;
  slug: string;
  currency: string;
  ownerSubject: string;
  metrics: {
    totalRevenueMinor: number;
    orderCount: number;
    productCount: number;
  };
}

export const SELLER_ACTORS = {
  sellerAOwner: {
    id: 'act_a_owner',
    sub: 'usr_seller_a_owner',
    email: 'owner-a@matjerhub.test',
    name: 'Seller A Owner',
    role: 'seller_owner',
    authorizedStoreIds: ['str_a1_1001', 'str_a2_1002'],
  } as SellerActor,

  sellerAManager: {
    id: 'act_a_manager',
    sub: 'usr_seller_a_manager',
    email: 'manager-a@matjerhub.test',
    name: 'Seller A Manager',
    role: 'seller_manager',
    authorizedStoreIds: ['str_a1_1001'],
  } as SellerActor,

  sellerAStaff: {
    id: 'act_a_staff',
    sub: 'usr_seller_a_staff',
    email: 'staff-a@matjerhub.test',
    name: 'Seller A Staff',
    role: 'seller_staff',
    authorizedStoreIds: ['str_a1_1001'],
  } as SellerActor,

  sellerBOwner: {
    id: 'act_b_owner',
    sub: 'usr_seller_b_owner',
    email: 'owner-b@matjerhub.test',
    name: 'Seller B Owner',
    role: 'seller_owner',
    authorizedStoreIds: ['str_b1_2001'],
  } as SellerActor,

  sellerRoleless: {
    id: 'act_roleless',
    sub: 'usr_seller_no_role',
    email: 'norole@matjerhub.test',
    name: 'No Role User',
    role: 'none',
    authorizedStoreIds: [],
  } as SellerActor,

  unauthenticated: null,
};

export const STORE_FIXTURES: Record<string, StoreFixture> = {
  str_a1_1001: {
    storeId: 'str_a1_1001',
    name: 'Seller A Store 1 (Populated)',
    slug: 'store-a1',
    currency: 'SAR',
    ownerSubject: 'usr_seller_a_owner',
    metrics: {
      totalRevenueMinor: 154000,
      orderCount: 12,
      productCount: 8,
    },
  },

  str_a2_1002: {
    storeId: 'str_a2_1002',
    name: 'Seller A Store 2 (Empty)',
    slug: 'store-a2',
    currency: 'SAR',
    ownerSubject: 'usr_seller_a_owner',
    metrics: {
      totalRevenueMinor: 0,
      orderCount: 0,
      productCount: 0,
    },
  },

  str_b1_2001: {
    storeId: 'str_b1_2001',
    name: 'Seller B Store 1 (Isolated)',
    slug: 'store-b1',
    currency: 'SAR',
    ownerSubject: 'usr_seller_b_owner',
    metrics: {
      totalRevenueMinor: 99000,
      orderCount: 5,
      productCount: 3,
    },
  },
};

export type DataMode = 'populated' | 'empty' | 'outage';
