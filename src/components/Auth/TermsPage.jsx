// TermsPage.jsx
import React from 'react';

// Same scrollbar style for consistency
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`;

export const TermsPage = () => {

  const handleUnderstand = () => {
    // 1. Signal the other tab that terms are accepted
    localStorage.setItem('termsAcceptedSignal', Date.now().toString());
    
    // 2. Close this tab to return to the form
    window.close();
  };

  return (
    <div className="w-full h-screen flex flex-col bg-white">
      <style>{scrollbarStyles}</style>

      {/* HEADER */}
      <div className="shrink-0 text-center pt-8 pb-4 px-4 border-b border-gray-50">
        <h1 className="font-serif text-[30px] lg:text-[28px] font-bold text-primary-dark mb-1">
          Terms of Service
        </h1>
        <p className="font-sans text-gray-400 text-[14px] tracking-wide">
          Please read our conditions carefully.
        </p>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 max-w-2xl mx-auto w-full">
        <div className="prose prose-sm font-sans text-gray-600 space-y-6">
            <section>
                <h3 className="text-primary-dark font-bold text-lg mb-2">1. Acceptance of Terms</h3>
                <p>By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement.</p>
            </section>
            
            <section>
                <h3 className="text-primary-dark font-bold text-lg mb-2">2. User Verification</h3>
                <p>To access specific features, you must verify your phone number and email address. You agree to provide accurate and current information.</p>
            </section>

            <section>
                <h3 className="text-primary-dark font-bold text-lg mb-2">3. Privacy & Data</h3>
                <p>Your data is stored securely. We do not share your personal information with third parties without your consent, except as required by law.</p>
            </section>
            
            <section>
                <h3 className="text-primary-dark font-bold text-lg mb-2">4. User Conduct</h3>
                <p>You agree not to use the service for any unlawful purpose or any purpose prohibited by these terms.</p>
            </section>

             <p className="text-xs text-gray-400 italic mt-8">Last Updated: February 2026</p>
        </div>
      </div>

      {/* FOOTER ACTION */}
      {/* Changed: Added 'lg:pb-10' and 'lg:pt-6' to lift the button up on desktop */}
      <div className="shrink-0 px-4 py-4 lg:pb-10 lg:pt-6 border-t border-gray-50 bg-white">
        <div className="max-w-md mx-auto">
            <button 
              onClick={handleUnderstand} 
              className="w-full cursor-pointer bg-primary-dark text-white py-4 rounded-full lg:rounded-[20px] text-[16px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all font-sans"
            >
              I Understand & Continue
            </button>
        </div>
      </div>
    </div>
  );
};