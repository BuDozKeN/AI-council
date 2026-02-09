import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function TermsPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('legal.termsOfService', 'Terms of Service')} - AxCouncil`;
  }, [t]);

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back-link">
          <ArrowLeft size={18} />
          {t('common.backToHome', 'Back to Home')}
        </Link>

        <header className="legal-header">
          <h1>{t('legal.termsOfService', 'Terms of Service')}</h1>
          <p className="legal-effective-date">
            {t('legal.effectiveDate', 'Effective Date')}: January 1, 2026
          </p>
        </header>

        <main className="legal-content">
          <section>
            <h2>1. {t('legal.termsAcceptance', 'Acceptance of Terms')}</h2>
            <p>
              By accessing or using AxCouncil (&quot;the Service&quot;), you agree to be bound by
              these Terms of Service. If you do not agree to these terms, please do not use the
              Service.
            </p>
          </section>

          <section>
            <h2>2. {t('legal.termsDescription', 'Description of Service')}</h2>
            <p>
              AxCouncil is an AI-powered decision-making platform that orchestrates multiple large
              language models to provide synthesized recommendations. The Service includes:
            </p>
            <ul>
              <li>Multi-model AI consultation for business decisions</li>
              <li>Peer review and synthesis of AI responses</li>
              <li>Team collaboration and company context management</li>
              <li>Decision history and knowledge management</li>
            </ul>
          </section>

          <section>
            <h2>3. {t('legal.termsAccount', 'Account Registration')}</h2>
            <p>
              To use certain features of the Service, you must create an account. You agree to
              provide accurate, current, and complete information during registration and to update
              such information to keep it accurate.
            </p>
            <p>
              You are responsible for safeguarding your account credentials and for all activities
              that occur under your account.
            </p>
          </section>

          <section>
            <h2>4. {t('legal.termsUse', 'Acceptable Use')}</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or its servers</li>
              <li>Use automated means to access the Service without permission</li>
              <li>Transmit harmful code or malware</li>
              <li>Infringe on intellectual property rights of others</li>
            </ul>
          </section>

          <section>
            <h2>5. {t('legal.termsAI', 'AI-Generated Content')}</h2>
            <p>
              The Service uses artificial intelligence to generate recommendations. You acknowledge
              that:
            </p>
            <ul>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>
                Recommendations should not replace professional advice (legal, medical, financial,
                etc.)
              </li>
              <li>You are responsible for verifying and acting upon any AI recommendations</li>
              <li>We do not guarantee the accuracy, completeness, or reliability of AI outputs</li>
            </ul>
          </section>

          <section>
            <h2>6. {t('legal.termsData', 'Data and Privacy')}</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link to="/privacy">Privacy Policy</Link>. By using the Service, you consent to the
              collection and use of your data as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2>7. {t('legal.termsIP', 'Intellectual Property')}</h2>
            <p>
              The Service and its original content, features, and functionality are owned by
              AxCouncil and are protected by international copyright, trademark, and other
              intellectual property laws.
            </p>
            <p>
              You retain ownership of any content you submit to the Service, but grant us a license
              to use, store, and process such content to provide the Service.
            </p>
          </section>

          <section>
            <h2>8. {t('legal.termsPayment', 'Payment Terms')}</h2>
            <p>
              Certain features of the Service require payment. By subscribing to a paid plan, you
              agree to pay all applicable fees. Fees are non-refundable except as required by law or
              as explicitly stated in our refund policy.
            </p>
          </section>

          <section>
            <h2>9. {t('legal.termsTermination', 'Termination')}</h2>
            <p>
              We may terminate or suspend your account and access to the Service at our sole
              discretion, without prior notice, for conduct that we believe violates these Terms or
              is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2>10. {t('legal.termsDisclaimer', 'Disclaimer of Warranties')}</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section>
            <h2>11. {t('legal.termsLiability', 'Limitation of Liability')}</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, AXCOUNCIL SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR
              USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2>12. {t('legal.termsChanges', 'Changes to Terms')}</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of
              material changes by posting the updated Terms on this page with a new effective date.
              Your continued use of the Service after such changes constitutes acceptance of the new
              Terms.
            </p>
          </section>

          <section>
            <h2>13. {t('legal.termsContact', 'Contact Us')}</h2>
            <p>
              If you have questions about these Terms, please contact us at:{' '}
              <a href="mailto:legal@axcouncil.com">legal@axcouncil.com</a>
            </p>
          </section>
        </main>

        <footer className="legal-footer">
          <p>© {new Date().getFullYear()} AxCouncil. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
