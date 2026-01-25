import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Button } from './ui/button';
import { logger } from '../utils/logger';
import { formatCurrency } from '../lib/currencyUtils';
import { makeClickable } from '../utils/a11y';
import './Billing.css';

const log = logger.scope('Billing');

interface Plan {
  id: string;
  name: string;
  price: number;
  is_free: boolean;
  queries_display: string;
  features: string[];
  contact_sales?: boolean;
}

interface Subscription {
  tier: string;
  queries_used: number;
  queries_limit: number;
}

interface BillingProps {
  onClose: () => void;
}

export default function Billing({ onClose }: BillingProps) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansData, subData] = await Promise.all([
        api.getBillingPlans(),
        api.getSubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err) {
      log.error('Failed to load billing data:', err);
      setError(t('billing.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    try {
      setCheckoutLoading(tierId);
      setError(null);
      const result = await api.createCheckout(tierId);
      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url;
    } catch (err) {
      log.error('Failed to create checkout:', err);
      const errorMessage = err instanceof Error ? err.message : t('errors.generic');
      setError(errorMessage);
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setCheckoutLoading('manage');
      setError(null);
      const result = await api.createBillingPortal();
      // Redirect to Stripe Billing Portal
      window.location.href = result.portal_url;
    } catch (err) {
      log.error('Failed to open billing portal:', err);
      const errorMessage = err instanceof Error ? err.message : t('billing.portalError');
      setError(errorMessage);
      setCheckoutLoading(null);
    }
  };

  // Handle overlay click - close unless clicking the ThemeToggle
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking the theme toggle (positioned outside the modal but visually overlapping)
      if (target.closest('.theme-toggle-container')) {
        return;
      }
      onClose();
    },
    [onClose]
  );

  if (loading) {
    return (
      <div className="billing-overlay" {...makeClickable(handleOverlayClick)}>
        <div className="billing-modal" {...makeClickable((e) => e.stopPropagation())}>
          <div className="billing-loading">{t('billing.loadingBilling')}</div>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const queriesUsed = subscription?.queries_used || 0;
  const queriesLimit = subscription?.queries_limit || 5;
  const isUnlimited = queriesLimit === -1;

  return (
    <div className="billing-overlay" {...makeClickable(handleOverlayClick)}>
      <div className="billing-modal" {...makeClickable((e) => e.stopPropagation())}>
        <div className="billing-header">
          <h2>{t('billing.subscriptionPlans')}</h2>
          <button className="billing-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {error && <div className="billing-error">{error}</div>}

        {/* Current Usage */}
        <div className="billing-usage">
          <div className="usage-label">{t('billing.currentUsage')}</div>
          <div className="usage-bar-container">
            <div
              className="usage-bar"
              style={{
                width: isUnlimited
                  ? '10%'
                  : `${Math.min((queriesUsed / queriesLimit) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="usage-text">
            {isUnlimited
              ? t('billing.queriesUsedUnlimited', { count: queriesUsed })
              : t('billing.queriesUsedMonthly', { used: queriesUsed, limit: queriesLimit })}
          </div>
        </div>

        {/* Plans */}
        <div className="billing-plans">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentTier;

            // Tier ranking for upgrade/downgrade logic (5-tier system)
            const tierRank: Record<string, number> = {
              free: 0,
              starter: 1,
              pro: 2,
              business: 3,
              enterprise: 4,
            };
            const currentRank = tierRank[currentTier] ?? 0;
            const planRank = tierRank[plan.id] ?? 0;

            const isUpgrade = planRank > currentRank;
            const isDowngrade = planRank < currentRank;

            return (
              <div
                key={plan.id}
                className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}
              >
                {plan.id === 'pro' && (
                  <div className="popular-badge">{t('billing.mostPopular')}</div>
                )}

                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">
                  {plan.is_free ? (
                    <span className="price-free">{t('settings.free')}</span>
                  ) : (
                    <>
                      <span className="price-amount">
                        {formatCurrency(plan.price, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="price-period">{t('settings.perMonth')}</span>
                    </>
                  )}
                </div>

                <div className="plan-queries">{plan.queries_display}</div>

                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>

                <div className="plan-action">
                  {isCurrentPlan ? (
                    <Button variant="outline" disabled>
                      {t('billing.currentPlan')}
                    </Button>
                  ) : plan.contact_sales ? (
                    <Button
                      variant="default"
                      onClick={() =>
                        (window.location.href =
                          'mailto:sales@axcouncil.com?subject=Enterprise%20Plan%20Inquiry')
                      }
                    >
                      {t('billing.contactSales')}
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={checkoutLoading !== null}
                      title={t('billing.cancelToDowngrade')}
                    >
                      {checkoutLoading === 'manage' ? t('common.loading') : t('billing.downgrade')}
                    </Button>
                  ) : (
                    <Button
                      variant={isUpgrade ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === plan.id
                        ? t('common.loading')
                        : isUpgrade
                          ? t('billing.upgrade')
                          : t('billing.subscribe')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Manage Subscription Link */}
        {currentTier !== 'free' && (
          <div className="billing-manage">
            <Button
              variant="link"
              onClick={handleManageSubscription}
              disabled={checkoutLoading !== null}
            >
              {checkoutLoading === 'manage'
                ? t('common.loading')
                : t('billing.manageSubscriptionBilling')}
            </Button>
          </div>
        )}

        <div className="billing-footer">
          <p>{t('billing.stripePowered')}</p>
        </div>
      </div>
    </div>
  );
}
