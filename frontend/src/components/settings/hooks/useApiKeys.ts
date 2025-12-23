import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';

const log = logger.scope('useApiKeys');

export interface ApiKeyStatus {
  status: 'not_connected' | 'connected' | 'invalid';
  is_valid: boolean;
  is_active: boolean;
  key_hint?: string;
  last_validated?: string;
}

export function useApiKeys(isOpen: boolean) {
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState<boolean>(true);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiKeySaving, setApiKeySaving] = useState<boolean>(false);
  const [apiKeyTesting, setApiKeyTesting] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySuccess, setApiKeySuccess] = useState<string | null>(null);
  const [showReplaceKeyForm, setShowReplaceKeyForm] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKeyStatus();
    }
  }, [isOpen]);

  const loadApiKeyStatus = async () => {
    try {
      setApiKeyLoading(true);
      setApiKeyError(null);
      const status = await api.getOpenRouterKeyStatus();
      setApiKeyStatus(status);
    } catch (err) {
      log.error('Failed to load API key status:', err);
      setApiKeyError('Failed to load API key status');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    try {
      setApiKeySaving(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.saveOpenRouterKey(apiKeyInput.trim());
      setApiKeyStatus(result);
      setApiKeyInput('');
      setApiKeySuccess('API key connected successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save API key';
      setApiKeyError(message);
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleTestApiKey = async (): Promise<void> => {
    try {
      setApiKeyTesting(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.testOpenRouterKey();
      setApiKeyStatus(result);
      if (result.is_valid) {
        setApiKeySuccess('API key is valid and working!');
      } else {
        setApiKeyError('API key validation failed. Please check your key.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test API key';
      setApiKeyError(message);
    } finally {
      setApiKeyTesting(false);
    }
  };

  const handleDeleteApiKey = async (): Promise<void> => {
    try {
      setApiKeySaving(true);
      setApiKeyError(null);
      await api.deleteOpenRouterKey();
      setApiKeyStatus({ status: 'not_connected', is_valid: false, is_active: true });
      setApiKeySuccess('API key removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete API key';
      setApiKeyError(message);
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleToggleApiKey = async (): Promise<void> => {
    try {
      setApiKeySaving(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.toggleOpenRouterKey();
      setApiKeyStatus(result);
      setApiKeySuccess(result.is_active ? 'API key activated' : 'API key deactivated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle API key';
      setApiKeyError(message);
    } finally {
      setApiKeySaving(false);
    }
  };

  return {
    apiKeyStatus,
    setApiKeyStatus,
    apiKeyLoading,
    apiKeyInput,
    setApiKeyInput,
    apiKeySaving,
    setApiKeySaving,
    apiKeyTesting,
    apiKeyError,
    setApiKeyError,
    apiKeySuccess,
    setApiKeySuccess,
    showReplaceKeyForm,
    setShowReplaceKeyForm,
    handleSaveApiKey,
    handleTestApiKey,
    handleDeleteApiKey,
    handleToggleApiKey,
  };
}
