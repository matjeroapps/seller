export type DomainStatus = 'pending' | 'verified' | 'active' | 'failed' | 'disabled';
export type DomainType = 'platform' | 'custom';

export type DomainVerification = {
  record_type: string;
  record_name: string;
  record_value: string;
};

export type StoreDomain = {
  id: string;
  domain: string;
  is_primary: boolean;
  status: DomainStatus;
  domain_type: DomainType;
  verified_at?: string;
  last_checked_at?: string;
  verification?: DomainVerification;
  created_at: string;
  updated_at: string;
};

export type StoreDomainCollectionResponse = {
  items: StoreDomain[];
};

export type RequestCustomDomainPayload = {
  domain: string;
};
