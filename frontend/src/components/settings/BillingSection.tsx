import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { useBilling } from './hooks/useBilling';

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

export function BillingSection({ isOpen }) {
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
      {billingError && (
        <div className="error-banner">{billingError}</div>
      )}

      {/* Usage Card */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>Your council queries this billing period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="usage-bar">
            <div
              className="usage-fill"
              style={{
                width: isUnlimited ? '10%' : `${Math.min((queriesUsed / queriesLimit) * 100, 100)}%`
              }}
            />
          </div>
          <p className="usage-text">
            {isUnlimited
              ? `${queriesUsed} queries used (Unlimited)`
              : `${queriesUsed} / ${queriesLimit} queries this month`
            }
          </p>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="plans-section">
        <h3>Subscription Plans</h3>
        <div className="plans-grid">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentTier;
            const isUpgrade = !plan.is_free && (currentTier === 'free' ||
              (currentTier === 'pro' && plan.id === 'enterprise'));

            return (
              <div
                key={plan.id}
                className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}
              >
                {plan.id === 'pro' && (
                  <div className="popular-badge">Most Popular</div>
                )}
                <div className="plan-header">
                  <h4>{plan.name}</h4>
                  <div className="plan-price">
                    {plan.is_free ? (
                      <span className="price">Free</span>
                    ) : (
                      <>
                        <span className="price">${plan.price}</span>
                        <span className="period">/month</span>
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
                    <Button variant="outline" disabled>Current Plan</Button>
                  ) : (
                    <Button
                      variant={isUpgrade ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === plan.id ? 'Loading...' : isUpgrade ? 'Upgrade' : 'Select'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Subscription */}
      {currentTier !== 'free' && (
        <Card className="settings-card manage-card">
          <CardContent className="manage-content">
            <div>
              <p className="manage-title">Manage your subscription</p>
              <p className="manage-desc">Update payment method, view invoices, or cancel</p>
            </div>
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={checkoutLoading !== null}
            >
              {checkoutLoading === 'manage' ? 'Loading...' : 'Manage Billing'}
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="stripe-note">Secure payments powered by Stripe</p>
    </>
  );
}
