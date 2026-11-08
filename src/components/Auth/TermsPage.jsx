// TermsPage.jsx
import React, { useEffect } from 'react';
import { ArrowRight, AuthCard, AuthHeading, PrimaryButton, TextLink } from './ui';

/** The main Arviah Terms & Conditions; these platform terms are part of them. */
const MAIN_TERMS_URL = 'https://www.arviahstudio.com/terms-and-conditions/';

const MainTermsLink = ({ children = 'Arviah Terms & Conditions' }) => (
  <TextLink href={MAIN_TERMS_URL} target="_blank" rel="noopener noreferrer">
    {children}
  </TextLink>
);

export const TermsPage = () => {
  // Signup's "Messaging terms" link opens /terms#messaging.
  useEffect(() => {
    if (window.location.hash !== '#messaging') return;
    document.getElementById('messaging')?.scrollIntoView({ block: 'start' });
  }, []);

  const handleUnderstand = () => {
    // 1. Signal the other tab that terms are accepted
    localStorage.setItem('termsAcceptedSignal', Date.now().toString());
    
    // 2. Close this tab to return to the form
    window.close();
  };

  return (
    <div>
      <AuthHeading size="md" title="Terms of Service" subtitle="Please read our conditions carefully." />

      <p className="mt-4 rounded-2xl border border-pale bg-[#F2E6D4]/60 px-4 py-3 font-jakarta text-[13.5px] leading-[1.6] text-mid lg:mt-3 lg:text-[12px]">
        These platform terms are part of Arviah&apos;s main terms. By continuing, you also agree to the{' '}
        <MainTermsLink /> on arviahstudio.com.
      </p>

      <AuthCard className="mt-5 lg:mt-4">
        <div className="space-y-5 font-jakarta text-[14px] leading-[1.65] text-mid lg:space-y-4 lg:text-[12.5px]">
          <section>
            <h3 className="mb-1.5 font-jakarta text-[15px] font-bold text-ink lg:text-[13.5px]">1. Acceptance of Terms</h3>
            <p>
              By accessing and using this platform, you accept and agree to be bound by the terms and provision of this
              agreement and by the <MainTermsLink />, which apply together with these terms.
            </p>
          </section>
        
          <section>
            <h3 className="mb-1.5 font-jakarta text-[15px] font-bold text-ink lg:text-[13.5px]">2. User Verification</h3>
            <p>To access specific features, you must verify your phone number and email address. You agree to provide accurate and current information.</p>
          </section>

          <section>
            <h3 className="mb-1.5 font-jakarta text-[15px] font-bold text-ink lg:text-[13.5px]">3. Privacy & Data</h3>
            <p>Your data is stored securely. We do not share your personal information with third parties without your consent, except as required by law.</p>
          </section>
        
          <section>
            <h3 className="mb-1.5 font-jakarta text-[15px] font-bold text-ink lg:text-[13.5px]">4. User Conduct</h3>
            <p>You agree not to use the service for any unlawful purpose or any purpose prohibited by these terms.</p>
          </section>

          <section id="messaging" className="scroll-mt-24">
            <h3 className="mb-1.5 font-jakarta text-[15px] font-bold text-ink lg:text-[13.5px]">5. Email &amp; SMS Messaging</h3>
            <p>
             Arviah (arviahstudio.com) sends account and order messages by email and SMS to the email address and
             mobile number on your account, once you agree to "emails and texts for order updates and
             verification" when you sign up, reset your password or verify your phone.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
             <li><strong>What we send:</strong> one-time verification and password reset codes, and updates about your orders and projects (for example confirmations, payments, production and delivery). These messages are not marketing.</li>
             <li><strong>How often:</strong> message frequency varies with your account activity.</li>
             <li><strong>Cost:</strong> message and data rates may apply, depending on your mobile carrier and plan.</li>
             <li><strong>Opting out:</strong> reply STOP to any text to stop receiving texts. You can also email us to opt out. Verification codes are needed to sign in securely, so after opting out of texts you may need to verify by email instead.</li>
             <li><strong>Help:</strong> reply HELP to any text, or email <a className="underline" href="mailto:support@arviahstudio.com">support@arviahstudio.com</a>.</li>
             <li><strong>Carriers:</strong> mobile carriers are not liable for delayed or undelivered messages.</li>
             <li><strong>Your data:</strong> agreeing to messages is not required to browse Arviah. We record when and how you agreed. Text messaging originator opt-in data and consent will not be shared with any third parties.</li>
            </ul>
          </section>
          <p className="text-[12px] italic text-muted lg:text-[11px]">Last updated: November 2026</p>
        </div>
      </AuthCard>

      {/* Stays in view while reading; solid behind the note and button, with a short fade above. */}
      <div className="sticky bottom-0 z-10 -mx-2 mt-6 bg-cream px-2 pb-5 pt-3 lg:pb-4">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-cream to-transparent" aria-hidden />
        <p className="mb-3 text-center font-jakarta text-[12.5px] text-muted lg:text-[11.5px]">
          By continuing you agree to these terms and the <MainTermsLink />.
        </p>
        <PrimaryButton onClick={handleUnderstand} className="w-full">
          I understand &amp; continue <ArrowRight />
        </PrimaryButton>
      </div>
    </div>
  );
};
