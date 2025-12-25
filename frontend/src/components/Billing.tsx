import { useState, useEffect } from 'react';
import { api } from '../api';
import { Button } from './ui/button';
import { logger } from '../utils/logger';
import './Billing.css';

const log = logger.scope('Billing');

export default function Billing({ onClose }) {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBillingData();
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
      setError("Couldn't load your billing info. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId) => {
    try {
      setCheckoutLoading(tierId);
      setError(null);
      const result = await api.createCheckout(tierId);
      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url;
    } catch (err) {
      log.error('Failed to create checkout:', err);
      setError(err.message || "Something went wrong. Please try again.");
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
      setError(err.message || "Couldn't open billing portal. Please try again.");
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="billing-overlay" onClick={onClose}>
        <div className="billing-modal" onClick={(e) => e.stopPropagation()}>
          <div className="billing-loading">Loading billing information...</div>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const queriesUsed = subscription?.queries_used || 0;
  const queriesLimit = subscription?.queries_limit || 5;
  const isUnlimited = queriesLimit === -1;

  return (
    <div className="billing-overlay" onClick={onClose}>
      <div className="billing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="billing-header">
          <h2>Subscription Plans</h2>
          <button className="billing-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="billing-error">{error}</div>
        )}

        {/* Current Usage */}
        <div className="billing-usage">
          <div className="usage-label">Current Usage</div>
          <div className="usage-bar-container">
            <div
              className="usage-bar"
              style={{
                width: isUnlimited ? '10%' : `${Math.min((queriesUsed / queriesLimit) * 100, 100)}%`
              }}
            />
          </div>
          <div className="usage-text">
            {isUnlimited
              ? `${queriesUsed} queries used (Unlimited)`
              : `${queriesUsed} / ${queriesLimit} queries this month`
            }
          </div>
        </div>

        {/* Plans */}
        <div className="billing-plans">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentTier;
            const isUpgrade = !plan.is_free && (currentTier === 'free' ||
              (currentTier === 'pro' && plan.id === 'enterprise'));
            const isDowngrade = (plan.is_free && currentTier !== 'free') ||
              (plan.id === 'pro' && currentTier === 'enterprise');

            return (
              <div
                key={plan.id}
                className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}
              >
                {plan.id === 'pro' && <div className="popular-badge">Most Popular</div>}

                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">
                  {plan.is_free ? (
                    <span className="price-free">Free</span>
                  ) : (
                    <>
                      <span className="price-amount">${plan.price}</span>
                      <span className="price-period">/month</span>
                    </>
                  )}
                </div>

                <div className="plan-queries">
                  {plan.queries_display}
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>

                <div className="plan-action">
                  {isCurrentPlan ? (
                    <Button variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={checkoutLoading !== null}
                      title="Cancel subscription to downgrade to Free"
                    >
                      {checkoutLoading === 'manage' ? 'Loading...' : 'Downgrade'}
                    </Button>
                  ) : (
                    <Button
                      variant={isUpgrade ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === plan.id ? 'Loading...' : isUpgrade ? 'Upgrade' : 'Subscribe'}
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
              {checkoutLoading === 'manage' ? 'Loading...' : 'Manage Subscription & Billing'}
            </Button>
          </div>
        )}

        <div className="billing-footer">
          <p>Secure payments powered by Stripe</p>
        </div>
      </div>
    </div>
  );
}
