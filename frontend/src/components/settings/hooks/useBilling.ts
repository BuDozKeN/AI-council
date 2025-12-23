import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';

const log = logger.scope('useBilling');

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  tier: string;
}

export interface Subscription {
  tier: string;
  queries_used: number;
  queries_limit: number;
  status?: string;
}

export function useBilling(isOpen: boolean) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingLoading, setBillingLoading] = useState<boolean>(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBillingData();
    }
  }, [isOpen]);

  const loadBillingData = async () => {
    try {
      setBillingLoading(true);
      setBillingError(null);
      const [plansData, subData] = await Promise.all([
        api.getBillingPlans(),
        api.getSubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err) {
      log.error('Failed to load billing data:', err);
      setBillingError('Failed to load billing information');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string): Promise<void> => {
    try {
      setCheckoutLoading(tierId);
      setBillingError(null);
      const result = await api.createCheckout(tierId);
      window.location.href = result.checkout_url;
    } catch (err) {
      log.error('Failed to create checkout:', err);
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setBillingError(message);
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async (): Promise<void> => {
    try {
      setCheckoutLoading('manage');
      setBillingError(null);
      const result = await api.createBillingPortal();
      window.location.href = result.portal_url;
    } catch (err) {
      log.error('Failed to open billing portal:', err);
      const message = err instanceof Error ? err.message : 'Failed to open billing portal';
      setBillingError(message);
      setCheckoutLoading(null);
    }
  };

  const currentTier = subscription?.tier || 'free';
  const queriesUsed = subscription?.queries_used || 0;
  const queriesLimit = subscription?.queries_limit || 5;
  const isUnlimited = queriesLimit === -1;

  return {
    plans,
    subscription,
    billingLoading,
    checkoutLoading,
    billingError,
    currentTier,
    queriesUsed,
    queriesLimit,
    isUnlimited,
    handleSubscribe,
    handleManageSubscription,
  };
}
