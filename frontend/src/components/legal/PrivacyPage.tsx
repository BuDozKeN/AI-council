import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function PrivacyPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('legal.privacyPolicy', 'Privacy Policy')} - AxCouncil`;
  }, [t]);

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back-link">
          <ArrowLeft size={18} />
          {t('common.backToHome', 'Back to Home')}
        </Link>

        <header className="legal-header">
          <h1>{t('legal.privacyPolicy', 'Privacy Policy')}</h1>
          <p className="legal-effective-date">
            {t('legal.effectiveDate', 'Effective Date')}: January 1, 2026
          </p>
        </header>

        <main className="legal-content">
          <section>
            <h2>1. {t('legal.privacyIntro', 'Introduction')}</h2>
            <p>
              AxCouncil (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to
              protecting your privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our AI-powered decision-making platform.
            </p>
          </section>

          <section>
            <h2>2. {t('legal.privacyCollect', 'Information We Collect')}</h2>

            <h3>2.1 Information You Provide</h3>
            <ul>
              <li>
                <strong>Account Information:</strong> Name, email address, password, and profile
                details
              </li>
              <li>
                <strong>Company Information:</strong> Company name, departments, roles, and
                organizational context
              </li>
              <li>
                <strong>Decision Queries:</strong> Questions and prompts you submit to the AI
                council
              </li>
              <li>
                <strong>Feedback:</strong> Ratings, reviews, and feedback you provide about AI
                responses
              </li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li>
                <strong>Usage Data:</strong> Pages visited, features used, time spent on the Service
              </li>
              <li>
                <strong>Device Information:</strong> Browser type, operating system, device
                identifiers
              </li>
              <li>
                <strong>Log Data:</strong> IP address, access times, referring URLs
              </li>
            </ul>
          </section>

          <section>
            <h2>3. {t('legal.privacyUse', 'How We Use Your Information')}</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your AI consultation requests</li>
              <li>Personalize your experience based on your company context</li>
              <li>Communicate with you about updates, security alerts, and support</li>
              <li>Analyze usage patterns to improve our AI models and features</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>4. {t('legal.privacyAI', 'AI Processing and Data')}</h2>
            <p>
              When you submit queries to our AI council, your input is processed by multiple AI
              models to generate recommendations. We want you to understand:
            </p>
            <ul>
              <li>Your queries are sent to third-party AI providers (OpenRouter, OpenAI, etc.)</li>
              <li>We do not sell your query data to third parties</li>
              <li>AI providers may have their own data retention policies</li>
              <li>Aggregated, anonymized data may be used to improve AI performance</li>
            </ul>
          </section>

          <section>
            <h2>5. {t('legal.privacyShare', 'Information Sharing')}</h2>
            <p>We may share your information with:</p>
            <ul>
              <li>
                <strong>AI Providers:</strong> To process your queries through our multi-model
                pipeline
              </li>
              <li>
                <strong>Service Providers:</strong> Cloud hosting, analytics, and support services
              </li>
              <li>
                <strong>Team Members:</strong> If you&apos;re part of a company account, authorized
                team members may access shared content
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
              </li>
            </ul>
            <p>We do not sell your personal information to third parties for marketing purposes.</p>
          </section>

          <section>
            <h2>6. {t('legal.privacySecurity', 'Data Security')}</h2>
            <p>We implement industry-standard security measures to protect your data, including:</p>
            <ul>
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Row-Level Security (RLS) for multi-tenant data isolation</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication requirements</li>
            </ul>
            <p>
              However, no method of transmission over the Internet is 100% secure. We cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2>7. {t('legal.privacyRetention', 'Data Retention')}</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the
              Service. You may request deletion of your data at any time. After account deletion, we
              may retain certain data as required by law or for legitimate business purposes.
            </p>
          </section>

          <section>
            <h2>8. {t('legal.privacyRights', 'Your Rights')}</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data (right to be forgotten)</li>
              <li>Export your data (data portability)</li>
              <li>Opt out of certain data processing</li>
              <li>Withdraw consent</li>
            </ul>
            <p>
              To exercise these rights, please contact us at{' '}
              <a href="mailto:privacy@axcouncil.com">privacy@axcouncil.com</a>.
            </p>
          </section>

          <section>
            <h2>9. {t('legal.privacyCookies', 'Cookies and Tracking')}</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember your
              preferences, and analyze usage. You can control cookie settings in your browser, but
              some features may not function properly without cookies.
            </p>
          </section>

          <section>
            <h2>10. {t('legal.privacyChildren', "Children's Privacy")}</h2>
            <p>
              The Service is not intended for users under 16 years of age. We do not knowingly
              collect personal information from children. If you believe we have collected
              information from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2>11. {t('legal.privacyInternational', 'International Data Transfers')}</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own.
              We ensure appropriate safeguards are in place for such transfers in compliance with
              applicable data protection laws.
            </p>
          </section>

          <section>
            <h2>12. {t('legal.privacyChanges', 'Changes to This Policy')}</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the new Privacy Policy on this page and updating the effective
              date. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2>13. {t('legal.privacyContact', 'Contact Us')}</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact
              us at:
            </p>
            <ul>
              <li>
                Email: <a href="mailto:privacy@axcouncil.com">privacy@axcouncil.com</a>
              </li>
              <li>
                Data Protection Officer: <a href="mailto:dpo@axcouncil.com">dpo@axcouncil.com</a>
              </li>
            </ul>
          </section>
        </main>

        <footer className="legal-footer">
          <p>© {new Date().getFullYear()} AxCouncil. All rights reserved.</p>
          <p>
            <Link to="/terms">{t('legal.termsOfService', 'Terms of Service')}</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
