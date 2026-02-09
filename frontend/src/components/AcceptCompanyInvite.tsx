/**
 * AcceptCompanyInvite - Page for existing users to accept company member invitations
 *
 * Flow:
 * 1. User clicks invitation link in email (e.g., /accept-company-invite?token=xxx)
 * 2. Page validates the token via API
 * 3. If not logged in, redirect to login with return URL
 * 4. If logged in with wrong account, show message
 * 5. If logged in with correct account, show "Join Company" confirmation
 * 6. On accept, calls authenticated accept endpoint
 * 7. Redirects to company page
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../i18n';
import { Building2, CheckCircle, XCircle, Clock, AlertCircle, LogOut } from 'lucide-react';
import { Spinner } from './ui/Spinner';
import { supabase } from '../supabase';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from './ui/ThemeToggle';
import './AcceptInvite.css';

interface InvitationData {
  email: string;
  name: string | null;
  expires_at: string;
  target_company_name: string | null;
}

type PageState =
  | 'loading'
  | 'invalid'
  | 'not_logged_in'
  | 'wrong_account'
  | 'confirm'
  | 'accepting'
  | 'success'
  | 'error';

export default function AcceptCompanyInvite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // State
  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Validate token and check auth on mount
  useEffect(() => {
    const validateAndCheck = async () => {
      // Wait for auth to load
      if (authLoading) return;

      if (!token) {
        setPageState('invalid');
        setErrorMessage(t('acceptCompanyInvite.noToken', 'No invitation token provided.'));
        return;
      }

      try {
        // Validate the token
        const result = await api.validateInvitation(token);

        if (!result.is_valid) {
          setPageState('invalid');
          setErrorMessage(
            result.error || t('acceptCompanyInvite.invalidToken', 'Invalid invitation.')
          );
          return;
        }

        setInvitation({
          email: result.email!,
          name: result.name || null,
          expires_at: result.expires_at!,
          target_company_name: result.target_company_name || null,
        });

        // Check if user is logged in
        if (!isAuthenticated || !user) {
          // Redirect to login with return URL
          const returnUrl = `/accept-company-invite?token=${encodeURIComponent(token)}`;
          navigate(`/?returnTo=${encodeURIComponent(returnUrl)}`);
          return;
        }

        // Check if email matches
        const userEmail = user.email?.toLowerCase();
        const inviteEmail = result.email?.toLowerCase();

        if (userEmail !== inviteEmail) {
          setPageState('wrong_account');
          return;
        }

        // Everything is good - show confirmation
        setPageState('confirm');
      } catch (err) {
        console.error('Token validation error:', err);
        setPageState('invalid');
        setErrorMessage(t('acceptCompanyInvite.validationError', 'Could not validate invitation.'));
      }
    };

    validateAndCheck();
  }, [token, user, isAuthenticated, authLoading, navigate, t]);

  // Handle accept
  const handleAccept = async () => {
    if (!token) return;

    setPageState('accepting');

    try {
      const result = await api.acceptCompanyInvitation(token);

      if (result.success) {
        setPageState('success');

        // Redirect to company page after 2 seconds
        setTimeout(() => {
          navigate(`/my-company`);
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Accept error:', err);
      setPageState('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('acceptCompanyInvite.acceptError', 'Could not accept invitation.')
      );
    }
  };

  // Handle sign out (for wrong account case)
  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    // After sign out, the useEffect will redirect to login
    setPageState('loading');
  };

  // Format expiry date
  const formatExpiry = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(getIntlLocale(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="accept-invite-page">
      <ThemeToggle />

      <div className="accept-invite-container">
        {/* Logo / Branding */}
        <div className="accept-invite-header">
          <h1 className="accept-invite-logo">AxCouncil</h1>
          <p className="accept-invite-tagline">
            {t('acceptCompanyInvite.tagline', 'AI-Powered Decision Council')}
          </p>
        </div>

        {/* Content based on state */}
        <div className="accept-invite-card">
          {/* Loading state - ISS-342: Use unified Spinner */}
          {(pageState === 'loading' || authLoading) && (
            <div className="accept-invite-state">
              <Spinner
                size="xl"
                variant="brand"
                label={t('acceptCompanyInvite.validating', 'Validating invitation...')}
              />
              <p>{t('acceptCompanyInvite.validating', 'Validating invitation...')}</p>
            </div>
          )}

          {/* Invalid token state */}
          {pageState === 'invalid' && (
            <div className="accept-invite-state accept-invite-state--error">
              <XCircle className="accept-invite-icon accept-invite-icon--error" />
              <h2>{t('acceptCompanyInvite.invalidTitle', 'Invalid Invitation')}</h2>
              <p>{errorMessage}</p>
              <button className="accept-invite-btn" onClick={() => navigate('/')}>
                {t('acceptCompanyInvite.goToHome', 'Go to Homepage')}
              </button>
            </div>
          )}

          {/* Wrong account state */}
          {pageState === 'wrong_account' && invitation && (
            <div className="accept-invite-state accept-invite-state--warning">
              <AlertCircle className="accept-invite-icon accept-invite-icon--warning" />
              <h2>{t('acceptCompanyInvite.wrongAccountTitle', 'Wrong Account')}</h2>
              <p>
                {t(
                  'acceptCompanyInvite.wrongAccountDesc',
                  'This invitation was sent to {{email}}. You are currently signed in with a different account.',
                  { email: invitation.email }
                )}
              </p>
              <p className="accept-invite-hint">
                {t(
                  'acceptCompanyInvite.signOutHint',
                  'Please sign out and sign in with the correct account.'
                )}
              </p>
              <button className="accept-invite-btn" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                {t('acceptCompanyInvite.signOut', 'Sign Out')}
              </button>
            </div>
          )}

          {/* Confirmation state */}
          {pageState === 'confirm' && invitation && (
            <>
              <div className="accept-invite-welcome">
                <Building2 className="accept-invite-company-icon" />
                <h2>
                  {t('acceptCompanyInvite.joinTitle', 'Join {{company}}', {
                    company: invitation.target_company_name || 'Company',
                  })}
                </h2>
                <p>
                  {t(
                    'acceptCompanyInvite.joinDesc',
                    "You've been invited to join this company on AxCouncil."
                  )}
                </p>
              </div>

              {/* Invitation details */}
              <div className="accept-invite-details">
                <div className="accept-invite-detail">
                  <Building2 className="h-4 w-4" />
                  <span>{invitation.target_company_name}</span>
                </div>
                <div className="accept-invite-detail accept-invite-detail--muted">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t('acceptCompanyInvite.expiresAt', 'Expires: {{date}}', {
                      date: formatExpiry(invitation.expires_at),
                    })}
                  </span>
                </div>
              </div>

              <div className="accept-invite-benefits">
                <p>{t('acceptCompanyInvite.benefitsTitle', 'As a team member, you will:')}</p>
                <ul>
                  <li>
                    {t(
                      'acceptCompanyInvite.benefit1',
                      'Collaborate with your team using AI-powered decisions'
                    )}
                  </li>
                  <li>
                    {t('acceptCompanyInvite.benefit2', 'Access company departments and projects')}
                  </li>
                  <li>{t('acceptCompanyInvite.benefit3', 'Participate in council sessions')}</li>
                </ul>
              </div>

              <div className="accept-invite-actions">
                <button className="accept-invite-submit" onClick={handleAccept}>
                  {t('acceptCompanyInvite.acceptButton', 'Accept & Join')}
                </button>
                <button className="accept-invite-btn-secondary" onClick={() => navigate('/')}>
                  {t('common.decline', 'Decline')}
                </button>
              </div>
            </>
          )}

          {/* Accepting state - ISS-342: Use unified Spinner */}
          {pageState === 'accepting' && (
            <div className="accept-invite-state">
              <Spinner
                size="xl"
                variant="brand"
                label={t('acceptCompanyInvite.accepting', 'Joining the team...')}
              />
              <p>{t('acceptCompanyInvite.accepting', 'Joining the team...')}</p>
            </div>
          )}

          {/* Success state */}
          {pageState === 'success' && invitation && (
            <div className="accept-invite-state accept-invite-state--success">
              <CheckCircle className="accept-invite-icon accept-invite-icon--success" />
              <h2>
                {t('acceptCompanyInvite.successTitle', 'Welcome to {{company}}!', {
                  company: invitation.target_company_name || 'the team',
                })}
              </h2>
              <p>{t('acceptCompanyInvite.successDesc', 'Redirecting you to the company...')}</p>
            </div>
          )}

          {/* Error state */}
          {pageState === 'error' && (
            <div className="accept-invite-state accept-invite-state--error">
              <XCircle className="accept-invite-icon accept-invite-icon--error" />
              <h2>{t('acceptCompanyInvite.errorTitle', 'Something Went Wrong')}</h2>
              <p>{errorMessage}</p>
              <button className="accept-invite-btn" onClick={() => setPageState('confirm')}>
                {t('acceptCompanyInvite.tryAgain', 'Try Again')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
