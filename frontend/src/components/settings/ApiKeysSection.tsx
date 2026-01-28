import { useTranslation } from 'react-i18next';
import {
  Zap,
  ChevronDown,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  DollarSign,
  Lock,
  ArrowRight,
  MoreHorizontal,
  Edit3,
  Trash2,
} from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/button';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import * as Accordion from '@radix-ui/react-accordion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api } from '../../api';
import { useApiKeys } from './hooks/useApiKeys';
import './api-keys/base.css';
import './api-keys/accordion.css';
import './api-keys/setup.css';
import './api-keys/byok.css';
import './api-keys/mobile.css';

interface ApiKeysSectionProps {
  isOpen: boolean;
  onDeleteApiKey: (deleteHandler: () => Promise<void>) => void;
}

export function ApiKeysSection({ isOpen, onDeleteApiKey }: ApiKeysSectionProps) {
  const { t } = useTranslation();
  const {
    apiKeyStatus,
    setApiKeyStatus,
    apiKeyLoading,
    apiKeyInput,
    setApiKeyInput,
    apiKeySaving,
    setApiKeySaving,
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
  } = useApiKeys(isOpen);

  const handleDeleteWithConfirm = () => {
    onDeleteApiKey(handleDeleteApiKey);
  };

  if (apiKeyLoading) {
    return (
      <Card className="settings-card">
        <CardHeader>
          <Skeleton width={200} height={20} />
          <Skeleton width={300} height={14} className="mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton height={40} className="mb-4" />
          <Skeleton height={40} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Page intro */}
      <div className="api-page-intro">
        <h2>{t('settings.connectAiProvider')}</h2>
        <p>{t('settings.aiProviderDescription')}</p>
      </div>

      {/* OpenRouter Provider Accordion */}
      <Accordion.Root type="single" collapsible className="api-provider-accordion">
        <Accordion.Item value="openrouter" className="api-provider-item">
          <Accordion.Header>
            <Accordion.Trigger className="api-provider-trigger">
              <div className="provider-header">
                <div className="provider-info">
                  <div className="provider-logo openrouter">
                    <Zap size={20} />
                  </div>
                  <div className="provider-details">
                    <div className="provider-title-row">
                      <h3>{t('settings.openRouter')}</h3>
                      {/* Status dot based on is_active toggle state */}
                      {apiKeyStatus &&
                        (apiKeyStatus.is_active ? (
                          apiKeyStatus.is_valid ? (
                            <span
                              className="status-dot connected"
                              title={`${t('settings.active')} - ${t('mycompany.statusConnected')}`}
                              aria-label={t('mycompany.statusConnected')}
                            />
                          ) : (
                            <span className="status-dot invalid" title={t('settings.invalid')} />
                          )
                        ) : (
                          <span
                            className="status-dot paused"
                            title={`${t('settings.paused')} - ${t('mycompany.statusDisconnected')}`}
                            aria-label={t('mycompany.statusDisconnected')}
                          />
                        ))}
                    </div>
                    <span className="provider-tagline">{t('settings.openRouterTagline')}</span>
                  </div>
                </div>
              </div>
              <ChevronDown
                className="accordion-chevron"
                size={20}
                aria-label={t('aria.expandSection')}
              />
            </Accordion.Trigger>
          </Accordion.Header>

          <Accordion.Content className="api-provider-content">
            {/* Ultra-compact connection row */}
            {(apiKeyStatus?.status === 'connected' ||
              apiKeyStatus?.status === 'disabled' ||
              apiKeyStatus?.status === 'invalid') && (
              <div className="byok-inline">
                {/* Toast messages */}
                {(apiKeyError || apiKeySuccess) && (
                  <div
                    className={`byok-toast ${apiKeyError ? 'error' : apiKeySuccess?.includes('deactivated') ? 'warning' : 'success'}`}
                  >
                    {apiKeyError ? <XCircle size={12} /> : <CheckCircle size={12} />}
                    <span>{apiKeyError || apiKeySuccess}</span>
                  </div>
                )}

                {/* Single row: key + toggle + menu */}
                <div className="byok-row">
                  <code className="byok-key">{apiKeyStatus.masked_key}</code>

                  <div className="byok-actions">
                    {/* Standard shadcn Switch */}
                    <Switch
                      checked={apiKeyStatus.is_active}
                      onCheckedChange={handleToggleApiKey}
                      disabled={apiKeySaving}
                    />

                    {/* Dropdown Menu */}
                    <DropdownMenu.Root modal={false}>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className="byok-menu"
                          disabled={apiKeySaving}
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {apiKeySaving ? <Spinner size={14} /> : <MoreHorizontal size={16} />}
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="byok-dropdown"
                          sideOffset={5}
                          align="end"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                          onPointerDownOutside={(e) => e.preventDefault()}
                        >
                          <DropdownMenu.Item
                            className="byok-dropdown-item"
                            onSelect={(e) => {
                              e.preventDefault();
                              handleTestApiKey();
                            }}
                          >
                            <RefreshCw size={14} /> {t('settings.test')}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="byok-dropdown-item"
                            onSelect={(e) => {
                              e.preventDefault();
                              setShowReplaceKeyForm(true);
                            }}
                          >
                            <Edit3 size={14} /> {t('settings.replace')}
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="byok-dropdown-separator" />
                          <DropdownMenu.Item
                            className="byok-dropdown-item danger"
                            onSelect={(e) => {
                              e.preventDefault();
                              handleDeleteWithConfirm();
                            }}
                          >
                            <Trash2 size={14} /> {t('common.remove')}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              </div>
            )}

            {/* Replace key inline form */}
            {showReplaceKeyForm && (
              <div className="byok-replace-form">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!apiKeyInput.trim()) return;
                    try {
                      setApiKeySaving(true);
                      setApiKeyError(null);
                      const result = await api.saveOpenRouterKey(apiKeyInput.trim());
                      setApiKeyStatus(result);
                      setApiKeyInput('');
                      setShowReplaceKeyForm(false);
                      setApiKeySuccess(t('settings.apiKeyReplaced'));
                    } catch (err: unknown) {
                      setApiKeyError(
                        err instanceof Error ? err.message : t('settings.failedSaveKey')
                      );
                    } finally {
                      setApiKeySaving(false);
                    }
                  }}
                >
                  <input
                    id="replace-api-key"
                    name="api-key"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-or-v1-..."
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="byok-replace-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowReplaceKeyForm(false);
                        setApiKeyInput('');
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      disabled={apiKeySaving || !apiKeyInput.trim()}
                    >
                      {apiKeySaving ? <Spinner size={14} /> : t('common.save')}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* What is OpenRouter - always visible */}
            <div className="provider-explainer">
              <div className="explainer-section">
                <h4>
                  <HelpCircle size={16} /> {t('settings.whatIsOpenRouter')}
                </h4>
                <p>{t('settings.whatIsOpenRouterDesc')}</p>
                <p>{t('settings.openRouterAnalogy')}</p>
              </div>

              <div className="explainer-section">
                <h4>
                  <DollarSign size={16} /> {t('settings.howBillingWorks')}
                </h4>
                <p>
                  <strong>{t('settings.billingExplainer')}</strong>
                </p>
                <p>{t('settings.billingNote')}</p>
              </div>

              <div className="explainer-section">
                <h4>
                  <Lock size={16} /> {t('settings.isKeySecure')}
                </h4>
                <p>{t('settings.keySecurityNote')}</p>
              </div>
            </div>

            {/* Setup guide - ALWAYS visible */}
            <div className="provider-setup-guide">
              <div className="setup-steps">
                <h4>{t('settings.howToGetKey')}</h4>

                <div className="setup-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <p>
                      <strong>{t('settings.step1Title')}</strong>
                    </p>
                    <p>
                      {t('settings.step1Desc')}{' '}
                      <a
                        href="https://openrouter.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="openrouter.ai (opens in new tab)"
                      >
                        openrouter.ai <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <p>
                      <strong>{t('settings.step2Title')}</strong>
                    </p>
                    <p>
                      {t('settings.step2Desc')}{' '}
                      <a
                        href="https://openrouter.ai/credits"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Credits (opens in new tab)"
                      >
                        Credits <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <p>
                      <strong>{t('settings.step3Title')}</strong>
                    </p>
                    <p>
                      {t('settings.step3Desc')}{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="API Keys (opens in new tab)"
                      >
                        API Keys <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <p>
                      <strong>{t('settings.step4Title')}</strong>
                    </p>
                    <p>{t('settings.step4Desc')}</p>
                  </div>
                </div>
              </div>

              {/* Input form - only show if not connected */}
              {apiKeyStatus?.status !== 'connected' && (
                <div className="provider-connection">
                  {apiKeyError && !apiKeyStatus?.status && (
                    <div className="api-message error">
                      <XCircle size={16} />
                      {apiKeyError}
                    </div>
                  )}

                  <form onSubmit={handleSaveApiKey} className="api-key-form">
                    <div className="form-group">
                      <label htmlFor="openrouter-api-key">{t('settings.yourApiKey')}</label>
                      <input
                        id="openrouter-api-key"
                        name="openrouter-api-key"
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="sk-or-v1-..."
                        autoComplete="off"
                      />
                      <span className="form-hint">{t('settings.keyEncrypted')}</span>
                    </div>
                    <Button
                      type="submit"
                      variant="default"
                      disabled={apiKeySaving || !apiKeyInput.trim()}
                    >
                      {apiKeySaving ? (
                        <Spinner size={14} />
                      ) : (
                        <>
                          <ArrowRight size={14} /> {t('settings.connectVerify')}
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </>
  );
}
