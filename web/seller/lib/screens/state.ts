export type CapabilityStatus =
  | 'loading'
  | 'live'
  | 'empty'
  | 'blocked'
  | 'setup-required'
  | 'unavailable'
  | 'manual-review'
  | 'error';

export interface CapabilityStateInfo {
  status: CapabilityStatus;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  reason?: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function createUnavailableState(
  domainName: string,
  reason: string,
  alternativeHref = '/dashboard/stores',
  alternativeText = 'Return to Dashboard'
): CapabilityStateInfo {
  return {
    status: 'unavailable',
    title: `${domainName} Unavailable`,
    description: reason,
    actionText: alternativeText,
    actionHref: alternativeHref,
    retryable: false,
  };
}

export function createEmptyState(
  domainName: string,
  message: string,
  createActionText?: string,
  createActionHref?: string,
  onCreate?: () => void
): CapabilityStateInfo {
  return {
    status: 'empty',
    title: `No ${domainName} Found`,
    description: message,
    actionText: createActionText,
    actionHref: createActionHref,
    onAction: onCreate,
  };
}

export function createBlockedState(
  domainName: string,
  reason: string
): CapabilityStateInfo {
  return {
    status: 'blocked',
    title: `Access Restricted for ${domainName}`,
    description: reason,
    actionText: 'View Store Overview',
    actionHref: '/dashboard/stores',
  };
}

export function createErrorState(
  errorMessage: string,
  onRetry?: () => void
): CapabilityStateInfo {
  return {
    status: 'error',
    title: 'Failed to Load Data',
    description: errorMessage || 'An unexpected error occurred while communicating with backend services.',
    retryable: Boolean(onRetry),
    onRetry,
  };
}
