import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { AuroraBackground } from './ui/aurora-background';
import { hapticMedium, hapticSuccess, hapticError } from '../lib/haptics';
import { springs, interactionStates, springWithDelay } from '../lib/animations';
import './Login.css';

// Google Icon SVG
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
      <path fill="#EA4335" d="M -14.754 44.989 C -12.984 44.989 -11.404 45.599 -10.154 46.789 L -6.734 43.369 C -8.804 41.449 -11.514 40.239 -14.754 40.239 C -19.444 40.239 -23.494 42.939 -25.464 46.859 L -21.484 49.949 C -20.534 47.099 -17.884 44.989 -14.754 44.989 Z"/>
    </g>
  </svg>
);

export default function Login() {
  const [mode, setMode] = useState('signIn'); // 'signIn', 'signUp', 'forgotPassword', 'resetPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle, resetPassword: sendPasswordReset, updatePassword, needsPasswordReset } = useAuth();

  // Handle password recovery mode
  useEffect(() => {
    if (needsPasswordReset) {
      setMode('resetPassword');
      setMessage('Please enter your new password.');
    }
  }, [needsPasswordReset]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    hapticMedium(); // Haptic feedback on form submit

    try {
      if (mode === 'signUp') {
        await signUp(email, password);
        setMessage('Check your email to confirm your account!');
        hapticSuccess();
      } else if (mode === 'signIn') {
        await signIn(email, password);
        hapticSuccess();
      } else if (mode === 'forgotPassword') {
        await sendPasswordReset(email);
        setMessage('Check your email for a password reset link!');
        hapticSuccess();
      } else if (mode === 'resetPassword') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          hapticError();
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          hapticError();
          return;
        }
        await updatePassword(password);
        setMessage('Password updated successfully! You are now signed in.');
        setMode('signIn');
        hapticSuccess();
      }
    } catch (err) {
      setError(err.message);
      hapticError();
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signUp': return 'Create your account';
      case 'forgotPassword': return 'Reset your password';
      case 'resetPassword': return 'Set new password';
      default: return 'Welcome back';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signUp': return 'Start making better decisions with AI';
      case 'forgotPassword': return "We'll send you a reset link";
      case 'resetPassword': return 'Choose a strong password';
      default: return 'Sign in to continue to AxCouncil';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    switch (mode) {
      case 'signUp': return 'Create Account';
      case 'forgotPassword': return 'Send Reset Link';
      case 'resetPassword': return 'Update Password';
      default: return 'Sign In';
    }
  };

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className="login-card"
      >
        {/* Header */}
        <div className="login-header">
          <motion.h1
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
            <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
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
            <span>or continue with email</span>
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
          {mode !== 'resetPassword' && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'resetPassword') && (
            <div className="form-group">
              <label htmlFor="password">
                {mode === 'resetPassword' ? 'New Password' : 'Password'}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'resetPassword' ? 'Enter new password' : 'Your password'}
                required
                minLength={6}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {mode === 'resetPassword' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                autoComplete="new-password"
              />
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
                Forgot password?
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
                Don't have an account? <strong>Sign up</strong>
              </button>
            </>
          )}

          {mode === 'signUp' && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode('signIn');
                setError('');
                setMessage('');
              }}
            >
              Already have an account? <strong>Sign in</strong>
            </button>
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
              Back to sign in
            </button>
          )}
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}
