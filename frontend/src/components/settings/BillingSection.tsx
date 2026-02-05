import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { useBilling } from './hooks/useBilling';
import { formatCurrency } from '../../lib/currencyUtils';
import './BillingSection.css';

const BillingSkeleton = () => (
  <>
    {/* Usage Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={120} height={20} />
        <Skeleton width={240} height={14} className="mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton height={10} className="rounded" />
        <Skeleton width={200} height={14} className="mt-2.5" />
      </CardContent>
    </Card>

    {/* Plans Skeleton */}
    <div className="plans-section">
      <Skeleton width={160} height={20} className="mb-4" />
      <div className="plans-grid">
        {[1, 2, 3].map((i) => (
          <div className="plan-card" key={i}>
            <div className="plan-header">
              <Skeleton width={60} height={20} className="mx-auto mb-2" />
              <Skeleton width={80} height={32} className="mx-auto mb-1" />
              <Skeleton width={100} height={14} className="mx-auto" />
            </div>
            <div className="pb-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex gap-2 py-1.5">
                  <Skeleton width={16} height={16} />
                  <Skeleton width={120} height={14} />
                </div>
              ))}
            </div>
            <Skeleton height={40} />
          </div>
        ))}
      </div>
    </div>
  </>
);

interface BillingSectionProps {
  isOpen: boolean;
}

export function BillingSection({ isOpen }: BillingSectionProps) {
  const { t } = useTranslation();
  const {
    plans,
    billingLoading,
    checkoutLoading,
    billingError,
    currentTier,
    queriesUsed,
    queriesLimit,
    isUnlimited,
    handleSubscribe,
    handleManageSubscription,
  } = useBilling(isOpen);

  if (billingLoading) {
    return <BillingSkeleton />;
  }

  return (
    <>
      {billingError && <div className="error-banner">{billingError}</div>}

      {/* Usage Card */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>{t('settings.currentUsage')}</CardTitle>
          <CardDescription>{t('settings.usageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="usage-bar">
            <div
              className="usage-fill"
              style={{
                width: isUnlimited
                  ? '10%'
                  : `${Math.min((queriesUsed / queriesLimit) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="usage-text">
            {isUnlimited
              ? t('settings.queriesUsed', { count: queriesUsed })
              : t('settings.queriesMonthly', { count: queriesUsed, limit: queriesLimit })}
          </p>
        </CardContent>
      </Card>

      {/* Plans */}
      <section className="plans-section" aria-labelledby="plans-heading">
        <h3 id="plans-heading">{t('settings.subscriptionPlans')}</h3>
        <ul className="plans-grid" aria-label="Subscription plans">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentTier;
            const isUpgrade =
              !plan.is_free &&
              (currentTier === 'free' || (currentTier === 'pro' && plan.id === 'enterprise'));

            return (
              <li
                key={plan.id}
                className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}
                aria-label={`${plan.name} plan, ${plan.is_free ? 'Free' : `${formatCurrency(plan.price, { maximumFractionDigits: 0 })} per month`}`}
              >
                {plan.id === 'pro' && (
                  <div className="popular-badge">{t('settings.mostPopular')}</div>
                )}
                <div className="plan-header">
                  <h4>{plan.name}</h4>
                  <div className="plan-price">
                    {/* ISS-144: Enterprise plan should show "Contact Us" not "Free" */}
                    {plan.id === 'enterprise' ? (
                      <span className="price">{t('settings.contactUs', 'Contact Us')}</span>
                    ) : plan.is_free ? (
                      <span className="price">{t('settings.free')}</span>
                    ) : (
                      <>
                        <span className="price">
                          {formatCurrency(plan.price, { maximumFractionDigits: 0 })}
                        </span>
                        <span className="period">{t('settings.perMonth')}</span>
                      </>
                    )}
                  </div>
                  <p className="plan-queries">{plan.queries_display}</p>
                </div>
                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="check">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="plan-action">
                  {isCurrentPlan ? (
                    <Button variant="outline" disabled>
                      {t('settings.currentPlan')}
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
                          ? t('settings.upgrade')
                          : t('settings.select')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Manage Subscription */}
      {currentTier !== 'free' && (
        <Card className="settings-card manage-card">
          <CardContent className="manage-content">
            <div>
              <p className="manage-title">{t('settings.manageSubscription')}</p>
              <p className="manage-desc">{t('settings.manageSubscriptionDesc')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={checkoutLoading !== null}
            >
              {checkoutLoading === 'manage' ? t('common.loading') : t('settings.manageBilling')}
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="stripe-note">{t('settings.stripePowered')}</p>
    </>
  );
}
