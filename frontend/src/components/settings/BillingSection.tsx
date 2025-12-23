import { Skeleton } from '../ui/Skeleton';
import { useBilling } from './hooks/useBilling';

const BillingSkeleton = () => (
  <>
    {/* Usage Card Skeleton */}
    <div className="settings-card">
      <div className="card-header">
        <Skeleton width={120} height={20} />
        <Skeleton width={240} height={14} style={{ marginTop: 8 }} />
      </div>
      <div className="card-body">
        <Skeleton height={10} style={{ borderRadius: 5 }} />
        <Skeleton width={200} height={14} style={{ marginTop: 10 }} />
      </div>
    </div>

    {/* Plans Skeleton */}
    <div className="plans-section">
      <Skeleton width={160} height={20} style={{ marginBottom: 16 }} />
      <div className="plans-grid">
        {[1, 2, 3].map((i) => (
          <div className="plan-card" key={i}>
            <div className="plan-header">
              <Skeleton width={60} height={20} style={{ margin: '0 auto 8px' }} />
              <Skeleton width={80} height={32} style={{ margin: '0 auto 4px' }} />
              <Skeleton width={100} height={14} style={{ margin: '0 auto' }} />
            </div>
            <div style={{ padding: '0 0 16px' }}>
              {[1, 2, 3, 4].map((j) => (
                <div key={j} style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
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
      <div className="settings-card">
        <div className="card-header">
          <h3>Current Usage</h3>
          <p>Your council queries this billing period</p>
        </div>
        <div className="card-body">
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
        </div>
      </div>

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
                    <button className="btn-outline" disabled>Current Plan</button>
                  ) : (
                    <button
                      className={isUpgrade ? 'btn-primary' : 'btn-outline'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === plan.id ? 'Loading...' : isUpgrade ? 'Upgrade' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Subscription */}
      {currentTier !== 'free' && (
        <div className="settings-card manage-card">
          <div className="manage-content">
            <div>
              <p className="manage-title">Manage your subscription</p>
              <p className="manage-desc">Update payment method, view invoices, or cancel</p>
            </div>
            <button
              className="btn-outline"
              onClick={handleManageSubscription}
              disabled={checkoutLoading !== null}
            >
              {checkoutLoading === 'manage' ? 'Loading...' : 'Manage Billing'}
            </button>
          </div>
        </div>
      )}

      <p className="stripe-note">Secure payments powered by Stripe</p>
    </>
  );
}
