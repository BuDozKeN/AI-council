import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Globe } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { AuroraBackground } from './ui/aurora-background';
import { hapticMedium, hapticSuccess, hapticError } from '../lib/haptics';
import { springs, interactionStates, springWithDelay } from '../lib/animations';
import { saveReturnUrl } from '../utils/authRedirect';
import { supportedLanguages } from '../i18n';
import './Login.css';

// Google Icon SVG
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path
        fill="#4285F4"
        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
      />
      <path
        fill="#34A853"
        d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
      />
      <path
        fill="#FBBC05"
        d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
      />
      <path
        fill="#EA4335"
        d="M -14.754 44.989 C -12.984 44.989 -11.404 45.599 -10.154 46.789 L -6.734 43.369 C -8.804 41.449 -11.514 40.239 -14.754 40.239 C -19.444 40.239 -23.494 42.939 -25.464 46.859 L -21.484 49.949 C -20.534 47.099 -17.884 44.989 -14.754 44.989 Z"
      />
    </g>
  </svg>
);

// Transform backend error messages into user-friendly ones
const getUserFriendlyError = (error: string, t: TFunction): string => {
  // Map technical error codes/messages to user-friendly translations
  const errorMap: Record<string, string> = {
    block_new_signups: t(
      'errors.signupDisabled',
      'Sign up is currently unavailable. Please try again later.'
    ),
    signups_not_allowed: t(
      'errors.signupDisabled',
      'Sign up is currently unavailable. Please try again later.'
    ),
    invalid_credentials: t('errors.invalidCredentials', 'Invalid email or password'),
    // ISS-009: Supabase returns this exact message for failed login
    'invalid login credentials': t('errors.invalidCredentials', 'Invalid email or password'),
    email_not_confirmed: t(
      'errors.emailNotConfirmed',
      'Please check your email to confirm your account'
    ),
    user_already_registered: t('errors.userExists', 'An account with this email already exists'),
    weak_password: t(
      'errors.weakPassword',
      'Password must be at least 8 characters with a mix of letters, numbers, and symbols'
    ),
    // ISS-008: Common browser validation messages
    'email address is not valid': t('validation.invalidEmail', 'Invalid email address'),
    'password is required': t('validation.required', 'This field is required'),
    'email is required': t('validation.required', 'This field is required'),
  };

  // Check if the error contains any known error codes
  const lowerError = error.toLowerCase();
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerError.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return the original error if no mapping found
  return error;
};

export default function Login() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState('signIn'); // 'signIn', 'signUp', 'forgotPassword', 'resetPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Get current language info (ISS-002)
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const currentLanguage =
    supportedLanguages.find((l) => l.code === currentLang) || supportedLanguages[0];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setShowLangMenu(false);
  };

  const {
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword: sendPasswordReset,
    updatePassword,
    needsPasswordReset,
  } = useAuth();

  // Handle password recovery mode
  useEffect(() => {
    if (needsPasswordReset) {
      setMode('resetPassword');
      setMessage(t('auth.enterNewPassword'));
    }
  }, [needsPasswordReset, t]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      // Save returnTo URL before OAuth redirect (it would be lost otherwise)
      saveReturnUrl();
      await signInWithGoogle();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('errors.generic');
      setError(getUserFriendlyError(errorMsg, t));
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    hapticMedium(); // Haptic feedback on form submit

    try {
      if (mode === 'signUp') {
        // Password confirmation validation
        if (password !== confirmPassword) {
          setError(t('validation.passwordsNoMatch', 'Passwords do not match'));
          setLoading(false);
          hapticError();
          return;
        }
        if (password.length < 6) {
          setError(t('validation.passwordMinLength', 'Password must be at least 6 characters'));
          setLoading(false);
          hapticError();
          return;
        }
        await signUp(email, password);
        setMessage(t('auth.checkEmailConfirm'));
        hapticSuccess();
      } else if (mode === 'signIn') {
        await signIn(email, password);
        hapticSuccess();
      } else if (mode === 'forgotPassword') {
        await sendPasswordReset(email);
        setMessage(t('auth.checkEmailReset'));
        hapticSuccess();
      } else if (mode === 'resetPassword') {
        if (password !== confirmPassword) {
          setError(t('validation.passwordsNoMatch'));
          setLoading(false);
          hapticError();
          return;
        }
        if (password.length < 6) {
          setError(t('validation.passwordMinLength'));
          setLoading(false);
          hapticError();
          return;
        }
        await updatePassword(password);
        setMessage(t('auth.passwordUpdated'));
        setMode('signIn');
        hapticSuccess();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('errors.generic');
      setError(getUserFriendlyError(errorMsg, t));
      hapticError();
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signUp':
        return t('auth.createAccount');
      case 'forgotPassword':
        return t('auth.resetPassword');
      case 'resetPassword':
        return t('auth.setNewPassword');
      default:
        return t('auth.welcomeBack');
    }
  };

  // Update document title based on current mode for better accessibility
  useEffect(() => {
    let pageTitle: string;
    switch (mode) {
      case 'signUp':
        pageTitle = t('auth.createAccount');
        break;
      case 'forgotPassword':
        pageTitle = t('auth.resetPassword');
        break;
      case 'resetPassword':
        pageTitle = t('auth.setNewPassword');
        break;
      default:
        pageTitle = t('auth.welcomeBack');
    }
    document.title = `${pageTitle} - AxCouncil`;
  }, [mode, t]);

  const getSubtitle = () => {
    switch (mode) {
      case 'signUp':
        return t('auth.startMakingDecisions');
      case 'forgotPassword':
        return t('auth.sendResetLink');
      case 'resetPassword':
        return t('auth.chooseStrongPassword');
      default:
        return t('auth.signInToContinue');
    }
  };

  const getButtonText = () => {
    if (loading) return t('common.loading');
    switch (mode) {
      case 'signUp':
        return t('auth.createAccountBtn');
      case 'forgotPassword':
        return t('auth.sendResetLinkBtn');
      case 'resetPassword':
        return t('auth.updatePasswordBtn');
      default:
        return t('auth.signIn');
    }
  };

  return (
    <AuroraBackground>
      {/* Skip to main content link for accessibility (ISS-007) */}
      <a href="#login-form" className="skip-to-main-content">
        {t('a11y.skipToMainContent', 'Skip to main content')}
      </a>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className="login-card noise-overlay"
        id="login-form"
        role="main"
        aria-labelledby="login-title"
      >
        {/* Language Selector (ISS-002) */}
        <div className="login-lang-selector">
          <button
            type="button"
            className="lang-toggle-btn"
            onClick={() => setShowLangMenu(!showLangMenu)}
            aria-expanded={showLangMenu}
            aria-haspopup="listbox"
            aria-label={t('settings.language', 'Language')}
          >
            <Globe size={16} />
            <span>{currentLanguage.nativeName}</span>
          </button>
          {showLangMenu && (
            <div
              className="lang-menu"
              role="listbox"
              aria-label={t('settings.language', 'Language')}
            >
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-menu-item ${lang.code === currentLang ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                  role="option"
                  aria-selected={lang.code === currentLang}
                >
                  <span className="lang-flag">{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="login-header">
          <motion.h1
            id="login-title"
            className="login-title"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springWithDelay('smooth', 0.1)}
          >
            AxCouncil
          </motion.h1>
          <motion.p
            className="login-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springWithDelay('smooth', 0.15)}
          >
            {getTitle()}
          </motion.p>
          <motion.p
            className="login-description"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springWithDelay('smooth', 0.2)}
          >
            {getSubtitle()}
          </motion.p>
        </div>

        {/* Google Sign In Button - Primary CTA */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <motion.button
            type="button"
            className="google-button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springWithDelay('smooth', 0.25)}
            whileHover={interactionStates.buttonHover}
            whileTap={interactionStates.buttonTap}
          >
            <GoogleIcon />
            <span>{googleLoading ? t('auth.connecting') : t('auth.continueWithGoogle')}</span>
          </motion.button>
        )}

        {/* Divider */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <motion.div
            className="divider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springWithDelay('smooth', 0.3)}
          >
            <span>{t('auth.orContinueWithEmail')}</span>
          </motion.div>
        )}

        {/* Email Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="login-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={springWithDelay('smooth', 0.35)}
        >
          {/* Hidden username field for password managers (ISS-005 accessibility fix) */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              border: 0,
            }}
          />
          {mode !== 'resetPassword' && (
            <div className="form-group">
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                autoComplete="email"
              />
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'resetPassword') && (
            <div className="form-group">
              <label htmlFor="password">
                {mode === 'resetPassword' ? t('auth.newPassword') : t('auth.password')}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'resetPassword'
                      ? t('auth.enterNewPassword')
                      : t('auth.passwordPlaceholder')
                  }
                  required
                  minLength={6}
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? t('auth.hidePassword', 'Hide password')
                      : t('auth.showPassword', 'Show password')
                  }
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Password requirements hint (ISS-010) and strength indicator (ISS-161) */}
              {(mode === 'signUp' || mode === 'resetPassword') && (
                <>
                  <p className="password-requirements">
                    {t('auth.passwordRequirements', 'Password must be at least 6 characters')}
                  </p>
                  {password.length > 0 && (
                    <div className="password-strength" aria-live="polite">
                      <div
                        className={`password-strength-bar ${
                          password.length >= 12 &&
                          /[A-Z]/.test(password) &&
                          /[0-9]/.test(password) &&
                          /[^A-Za-z0-9]/.test(password)
                            ? 'strong'
                            : password.length >= 8 &&
                                (/[A-Z]/.test(password) || /[0-9]/.test(password))
                              ? 'fair'
                              : 'weak'
                        }`}
                      />
                      <span className="password-strength-text">
                        {password.length >= 12 &&
                        /[A-Z]/.test(password) &&
                        /[0-9]/.test(password) &&
                        /[^A-Za-z0-9]/.test(password)
                          ? t('auth.passwordStrong', 'Strong')
                          : password.length >= 8 &&
                              (/[A-Z]/.test(password) || /[0-9]/.test(password))
                            ? t('auth.passwordFair', 'Fair')
                            : t('auth.passwordWeak', 'Weak')}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {(mode === 'signUp' || mode === 'resetPassword') && (
            <div className="form-group">
              <label htmlFor="confirmPassword">
                {t('auth.confirmPassword', 'Confirm Password')}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder', 'Re-enter your password')}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? t('auth.hidePassword', 'Hide password')
                      : t('auth.showPassword', 'Show password')
                  }
                  tabIndex={0}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springs.snappy}
            >
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div
              className="success-message"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springs.snappy}
            >
              {message}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className="submit-button"
            disabled={loading}
            whileHover={interactionStates.buttonHover}
            whileTap={interactionStates.buttonTap}
          >
            {getButtonText()}
          </motion.button>
        </motion.form>

        {/* Footer Links */}
        <motion.div
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={springWithDelay('smooth', 0.4)}
        >
          {mode === 'signIn' && (
            <>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('forgotPassword');
                  setError('');
                  setMessage('');
                }}
              >
                {t('auth.forgotPassword')}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('signUp');
                  setError('');
                  setMessage('');
                }}
              >
                {t('auth.noAccount')} <strong>{t('auth.signUp')}</strong>
              </button>
            </>
          )}

          {mode === 'signUp' && (
            <>
              <p className="legal-text">
                {t('auth.signupAgreement', 'By signing up, you agree to our')}{' '}
                <a href="/terms" className="legal-link" target="_blank" rel="noopener noreferrer">
                  {t('auth.termsOfService', 'Terms of Service')}
                </a>{' '}
                {t('common.and', 'and')}{' '}
                <a href="/privacy" className="legal-link" target="_blank" rel="noopener noreferrer">
                  {t('auth.privacyPolicy', 'Privacy Policy')}
                </a>
              </p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('signIn');
                  setError('');
                  setMessage('');
                }}
              >
                {t('auth.hasAccount')} <strong>{t('auth.signIn')}</strong>
              </button>
            </>
          )}

          {(mode === 'forgotPassword' || mode === 'resetPassword') && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode('signIn');
                setError('');
                setMessage('');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              {t('auth.backToSignIn')}
            </button>
          )}
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}
