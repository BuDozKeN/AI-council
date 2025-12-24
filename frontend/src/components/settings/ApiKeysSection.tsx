import { Zap, ChevronDown, CheckCircle, XCircle, ExternalLink, RefreshCw, HelpCircle, DollarSign, Lock, ArrowRight, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Switch } from '../ui/switch';
import * as Accordion from '@radix-ui/react-accordion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api } from '../../api';
import { useApiKeys } from './hooks/useApiKeys';

export function ApiKeysSection({ isOpen, onDeleteApiKey }) {
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
      <div className="settings-card">
        <div className="card-header">
          <Skeleton width={200} height={20} />
          <Skeleton width={300} height={14} style={{ marginTop: 8 }} />
        </div>
        <div className="card-body">
          <Skeleton height={40} style={{ marginBottom: 16 }} />
          <Skeleton height={40} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page intro */}
      <div className="api-page-intro">
        <h2>Connect Your AI Provider</h2>
        <p>
          AxCouncil uses AI models to power the council. Connect your own API key
          to have full control over costs — you only pay for what you use, directly
          to the provider.
        </p>
      </div>

      {/* OpenRouter Provider Accordion */}
      <Accordion.Root type="single" collapsible defaultValue="openrouter" className="api-provider-accordion">
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
                      <h3>OpenRouter</h3>
                      {/* Status dot based on is_active toggle state */}
                      {apiKeyStatus && (
                        apiKeyStatus.is_active ? (
                          apiKeyStatus.is_valid ? (
                            <span className="status-dot connected" title="Active" />
                          ) : (
                            <span className="status-dot invalid" title="Invalid" />
                          )
                        ) : (
                          <span className="status-dot paused" title="Paused" />
                        )
                      )}
                    </div>
                    <span className="provider-tagline">Access all major AI models through one API</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="accordion-chevron" size={20} />
            </Accordion.Trigger>
          </Accordion.Header>

          <Accordion.Content className="api-provider-content">
            {/* Ultra-compact connection row */}
            {(apiKeyStatus?.status === 'connected' || apiKeyStatus?.status === 'disabled' || apiKeyStatus?.status === 'invalid') && (
              <div className="byok-inline">
                {/* Toast messages */}
                {(apiKeyError || apiKeySuccess) && (
                  <div className={`byok-toast ${apiKeyError ? 'error' : apiKeySuccess?.includes('deactivated') ? 'warning' : 'success'}`}>
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
                            <RefreshCw size={14} /> Test
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="byok-dropdown-item"
                            onSelect={(e) => {
                              e.preventDefault();
                              setShowReplaceKeyForm(true);
                            }}
                          >
                            <Edit3 size={14} /> Replace
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="byok-dropdown-separator" />
                          <DropdownMenu.Item
                            className="byok-dropdown-item danger"
                            onSelect={(e) => {
                              e.preventDefault();
                              handleDeleteWithConfirm();
                            }}
                          >
                            <Trash2 size={14} /> Remove
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
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!apiKeyInput.trim()) return;
                  try {
                    setApiKeySaving(true);
                    setApiKeyError(null);
                    const result = await api.saveOpenRouterKey(apiKeyInput.trim());
                    setApiKeyStatus(result);
                    setApiKeyInput('');
                    setShowReplaceKeyForm(false);
                    setApiKeySuccess('API key replaced successfully!');
                  } catch (err) {
                    setApiKeyError(err.message || 'Failed to save API key');
                  } finally {
                    setApiKeySaving(false);
                  }
                }}>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-or-v1-..."
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="byok-replace-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setShowReplaceKeyForm(false);
                        setApiKeyInput('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={apiKeySaving || !apiKeyInput.trim()}
                    >
                      {apiKeySaving ? <Spinner size={14} /> : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* What is OpenRouter - always visible */}
            <div className="provider-explainer">
              <div className="explainer-section">
                <h4><HelpCircle size={16} /> What is OpenRouter?</h4>
                <p>
                  OpenRouter is a service that gives you access to all the major AI models
                  (like ChatGPT, Claude, Gemini, and more) through a single account. Instead
                  of signing up separately with OpenAI, Anthropic, Google, etc., you just
                  need one OpenRouter account.
                </p>
                <p>
                  Think of it like a phone plan that lets you call any network — OpenRouter
                  lets you use any AI model without managing multiple subscriptions.
                </p>
              </div>

              <div className="explainer-section">
                <h4><DollarSign size={16} /> How does billing work?</h4>
                <p>
                  <strong>You only pay for what you use.</strong> There are no monthly fees
                  or subscriptions. Each time the council runs, it costs a small amount
                  (typically a few cents) which is charged directly to your OpenRouter account.
                </p>
                <p>
                  AxCouncil does not charge you for AI usage — all costs go directly to
                  OpenRouter at their published rates. You can set spending limits on your
                  OpenRouter account to stay in control.
                </p>
              </div>

              <div className="explainer-section">
                <h4><Lock size={16} /> Is my API key secure?</h4>
                <p>
                  Yes. Your API key is encrypted before being stored and is only ever
                  decrypted on our secure servers when making AI requests. We never
                  log or expose your full key.
                </p>
              </div>
            </div>

            {/* Setup guide - ALWAYS visible */}
            <div className="provider-setup-guide">
              <div className="setup-steps">
                <h4>How to get your OpenRouter API key</h4>

                <div className="setup-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <p><strong>Create an OpenRouter account</strong></p>
                    <p>
                      Go to{' '}
                      <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">
                        openrouter.ai <ExternalLink size={12} />
                      </a>
                      {' '}and sign up for a free account. You can use Google, GitHub, or email.
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <p><strong>Add credits to your account</strong></p>
                    <p>
                      Go to{' '}
                      <a href="https://openrouter.ai/credits" target="_blank" rel="noopener noreferrer">
                        Credits <ExternalLink size={12} />
                      </a>
                      {' '}and add funds. Start with $5-10 to try it out — this will last
                      for many council sessions.
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <p><strong>Create an API key</strong></p>
                    <p>
                      Go to{' '}
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                        API Keys <ExternalLink size={12} />
                      </a>
                      {' '}and click "Create API Key". Give it a name like "AxCouncil"
                      and optionally set a spending limit.
                    </p>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <p><strong>Copy and paste your key below</strong></p>
                    <p>
                      Your key will look like <code>sk-or-v1-...</code> — paste it in the
                      field below and we'll verify it works.
                    </p>
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
                      <label>Your OpenRouter API Key</label>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="sk-or-v1-..."
                        autoComplete="off"
                      />
                      <span className="form-hint">
                        Your key is encrypted and stored securely
                      </span>
                    </div>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={apiKeySaving || !apiKeyInput.trim()}
                    >
                      {apiKeySaving ? <Spinner size={14} /> : <><ArrowRight size={14} /> Connect & Verify</>}
                    </button>
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
