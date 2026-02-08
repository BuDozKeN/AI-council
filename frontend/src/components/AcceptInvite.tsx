/**
 * AcceptInvite - Public page for accepting platform invitations
 *
 * Flow:
 * 1. User clicks invitation link in email (e.g., /accept-invite?token=xxx)
 * 2. Page validates the token via API
 * 3. If valid, shows signup form
 * 4. After successful Supabase signup, calls accept invitation endpoint
 * 5. Redirects to main app
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../i18n';
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  XCircle,
  Building2,
  Clock,
} from 'lucide-react';
import { Spinner } from './ui/Spinner';
import { supabase } from '../supabase';
import { api } from '../api';
import { ThemeToggle } from './ui/ThemeToggle';
import './AcceptInvite.css';

interface InvitationData {
  email: string;
  name: string | null;
  expires_at: string;
  target_company_name: string | null;
}

type PageState = 'loading' | 'invalid' | 'signup' | 'submitting' | 'success' | 'error';

export default function AcceptInvite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // State
  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setPageState('invalid');
        setErrorMessage(t('acceptInvite.noToken', 'No invitation token provided.'));
        return;
      }

      try {
        const result = await api.validateInvitation(token);

        if (!result.is_valid) {
          setPageState('invalid');
          setErrorMessage(result.error || t('acceptInvite.invalidToken', 'Invalid invitation.'));
          return;
        }

        setInvitation({
          email: result.email!,
          name: result.name || null,
          expires_at: result.expires_at!,
          target_company_name: result.target_company_name || null,
        });
        setPageState('signup');
      } catch (err) {
        console.error('Token validation error:', err);
        setPageState('invalid');
        setErrorMessage(t('acceptInvite.validationError', 'Could not validate invitation.'));
      }
    };

    validateToken();
  }, [token, t]);

  // Handle signup form submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate passwords
    if (password.length < 8) {
      setFormError(t('acceptInvite.passwordTooShort', 'Password must be at least 8 characters.'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('acceptInvite.passwordMismatch', 'Passwords do not match.'));
      return;
    }

    if (!invitation || !token) {
      setFormError(t('acceptInvite.missingData', 'Missing invitation data.'));
      return;
    }

    setPageState('submitting');

    try {
      // Ensure supabase client is available
      if (!supabase) {
        throw new Error(t('acceptInvite.noSupabase', 'Authentication service unavailable.'));
      }

      // Step 1: Create Supabase account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: {
            full_name: invitation.name || '',
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!signUpData.user) {
        throw new Error(t('acceptInvite.signupFailed', 'Account creation failed.'));
      }

      // Step 2: Accept the invitation
      try {
        await api.acceptInvitation(token, signUpData.user.id);
      } catch (acceptError) {
        console.error('Accept invitation error:', acceptError);
        // Don't fail completely - user is created, they can still use the app
      }

      setPageState('success');

      // Redirect to main app after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setPageState('signup');
      setFormError(
        err instanceof Error
          ? err.message
          : t('acceptInvite.signupError', 'Could not create account.')
      );
    }
  };

  // Format expiry date
  const formatExpiry = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(getIntlLocale(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
            {t('acceptInvite.tagline', 'AI-Powered Decision Council')}
          </p>
        </div>

        {/* Content based on state */}
        <div className="accept-invite-card">
          {/* Loading state - ISS-342: Use unified Spinner */}
          {pageState === 'loading' && (
            <div className="accept-invite-state">
              <Spinner size="xl" variant="brand" label={t('acceptInvite.validating', 'Validating invitation...')} />
              <p>{t('acceptInvite.validating', 'Validating invitation...')}</p>
            </div>
          )}

          {/* Invalid token state */}
          {pageState === 'invalid' && (
            <div className="accept-invite-state accept-invite-state--error">
              <XCircle className="accept-invite-icon accept-invite-icon--error" />
              <h2>{t('acceptInvite.invalidTitle', 'Invalid Invitation')}</h2>
              <p>{errorMessage}</p>
              <button className="accept-invite-btn" onClick={() => navigate('/')}>
                {t('acceptInvite.goToHome', 'Go to Homepage')}
              </button>
            </div>
          )}

          {/* Signup form */}
          {pageState === 'signup' && invitation && (
            <>
              <div className="accept-invite-welcome">
                <h2>{t('acceptInvite.welcomeTitle', 'Welcome to AxCouncil')}</h2>
                <p>{t('acceptInvite.welcomeDesc', 'Create your account to get started.')}</p>
              </div>

              {/* Invitation details */}
              <div className="accept-invite-details">
                <div className="accept-invite-detail">
                  <Mail className="h-4 w-4" />
                  <span>{invitation.email}</span>
                </div>
                {invitation.name && (
                  <div className="accept-invite-detail">
                    <User className="h-4 w-4" />
                    <span>{invitation.name}</span>
                  </div>
                )}
                {invitation.target_company_name && (
                  <div className="accept-invite-detail">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {t('acceptInvite.joiningCompany', 'Joining: {{company}}', {
                        company: invitation.target_company_name,
                      })}
                    </span>
                  </div>
                )}
                <div className="accept-invite-detail accept-invite-detail--muted">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t('acceptInvite.expiresAt', 'Expires: {{date}}', {
                      date: formatExpiry(invitation.expires_at),
                    })}
                  </span>
                </div>
              </div>

              {/* Signup form */}
              <form onSubmit={handleSignup} className="accept-invite-form">
                {formError && (
                  <div className="accept-invite-form-error">
                    <XCircle className="h-4 w-4" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="accept-invite-form-group">
                  <label htmlFor="password">{t('acceptInvite.passwordLabel', 'Password')}</label>
                  <div className="accept-invite-input-wrapper">
                    <Lock className="accept-invite-input-icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder={t('acceptInvite.passwordPlaceholder', 'Create a password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="accept-invite-input"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="accept-invite-toggle-pw"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="accept-invite-form-group">
                  <label htmlFor="confirm-password">
                    {t('acceptInvite.confirmPasswordLabel', 'Confirm Password')}
                  </label>
                  <div className="accept-invite-input-wrapper">
                    <Lock className="accept-invite-input-icon" />
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder={t('acceptInvite.confirmPasswordPlaceholder', 'Confirm password')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="accept-invite-input"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="accept-invite-submit"
                  disabled={!password || !confirmPassword}
                >
                  {t('acceptInvite.createAccount', 'Create Account')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="accept-invite-terms">
                {t(
                  'acceptInvite.termsNotice',
                  'By creating an account, you agree to our Terms of Service and Privacy Policy.'
                )}
              </p>
            </>
          )}

          {/* Submitting state - ISS-342: Use unified Spinner */}
          {pageState === 'submitting' && (
            <div className="accept-invite-state">
              <Spinner size="xl" variant="brand" label={t('acceptInvite.creatingAccount', 'Creating your account...')} />
              <p>{t('acceptInvite.creatingAccount', 'Creating your account...')}</p>
            </div>
          )}

          {/* Success state */}
          {pageState === 'success' && (
            <div className="accept-invite-state accept-invite-state--success">
              <CheckCircle className="accept-invite-icon accept-invite-icon--success" />
              <h2>{t('acceptInvite.successTitle', 'Account Created!')}</h2>
              <p>{t('acceptInvite.successDesc', 'Redirecting you to the app...')}</p>
            </div>
          )}

          {/* Error state */}
          {pageState === 'error' && (
            <div className="accept-invite-state accept-invite-state--error">
              <XCircle className="accept-invite-icon accept-invite-icon--error" />
              <h2>{t('acceptInvite.errorTitle', 'Something Went Wrong')}</h2>
              <p>{errorMessage}</p>
              <button className="accept-invite-btn" onClick={() => setPageState('signup')}>
                {t('acceptInvite.tryAgain', 'Try Again')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="accept-invite-footer">
          {t('acceptInvite.alreadyHaveAccount', 'Already have an account?')}{' '}
          <button className="accept-invite-link" onClick={() => navigate('/')}>
            {t('acceptInvite.signIn', 'Sign in')}
          </button>
        </p>
      </div>
    </div>
  );
}
