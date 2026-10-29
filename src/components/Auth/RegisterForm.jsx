import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import {
  extractCountryCodesList,
  getPostalCodeLabelForCountry,
  getStateRegionLabelForCountry,
} from '../../utils/stateRegionLabel';
import { pinCodeError } from '../../utils/pinCode';
import {
  ArrowLeft,
  ArrowRight,
  AuthHeading,
  Checkbox,
  Field,
  OutlineButton,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
  RoleCard,
  SearchSelect,
  StepProgress,
  TextInput,
  TextLink,
  ToastStack,
} from './ui';
import { toDialCodeOptions, useToasts } from './authHelpers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_ONE_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword'];
const isIndia = (country) => /^india$/i.test(String(country || '').trim());

function validateStepOne(formData) {
  const errors = {};
  if (!formData.firstName.trim()) errors.firstName = 'Required';
  if (!formData.lastName.trim()) errors.lastName = 'Required';
  if (!formData.email) errors.email = 'Required';
  else if (!EMAIL_RE.test(formData.email)) errors.email = 'Enter a valid email address';
  if (!formData.phone) errors.phone = 'Required';
  else if (formData.phone.length < 6) errors.phone = 'Enter at least 6 digits';
  else if (formData.phone.length > 20) errors.phone = 'Enter 20 digits or fewer';
  if (!formData.password) errors.password = 'Required';
  else if (formData.password.length < 8) errors.password = 'Must be at least 8 characters';
  if (formData.confirmPassword !== formData.password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

function validateStepTwo(formData) {
  const errors = {};
  if (!formData.country) errors.country = 'Required';
  const pinErr = pinCodeError(String(formData.pinCode || '').trim());
  if (pinErr) errors.pinCode = pinErr;
  if (!formData.termsAccepted) errors.termsAccepted = 'You must accept the terms';
  return errors;
}

export const RegisterForm = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = searchParams.get('step') === '2' ? 2 : 1;
  const { toasts, addToast, removeToast } = useToasts();

  const [loading, setLoading] = useState(false);
  const [countryRows, setCountryRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    countryCode: '', phone: '', country: '', state: '',
    pinCode: '', userType: 'customer', termsAccepted: false,
    isSeepzPrimaryProductionUnit: false,
  });

  // Step 2 is only reachable through Continue; a refresh or deep link starts over.
  useEffect(() => {
    if (step === 2 && Object.keys(validateStepOne(formData)).length) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // --- LOAD DATA & GEO ---
  useEffect(() => {
    const initData = async () => {
      try {
        const data = extractCountryCodesList(await authService.getCountryCodes());
        setCountryRows(data);
        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          const geoInfo = await geoRes.json();
          if (!geoInfo || !data.length) throw new Error('Geo failed');
          const matchedCode = data.find((c) => c.countryCode === geoInfo.country_code);
          const matchedName = data.find((c) => c.countryName === geoInfo.country_name) || matchedCode;
          setFormData((prev) => ({
            ...prev,
            countryCode: matchedCode ? matchedCode.phoneCode : data[0]?.phoneCode,
            country: matchedName ? matchedName.countryName : data[0]?.countryName,
          }));
        } catch {
          const fallback = data.find((c) => c.countryName === 'India' || c.countryCode === 'IN' || c.phoneCode === '+91') || data[0];
          if (fallback) {
            setFormData((prev) => ({ ...prev, countryCode: fallback.phoneCode, country: fallback.countryName }));
          }
        }
      } catch {
        setCountryRows([]);
      }
    };
    initData();
  }, []);

  // --- CROSS-TAB TERMS ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key !== 'termsAcceptedSignal') return;
      setFormData((prev) => ({ ...prev, termsAccepted: true }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.termsAccepted;
        return next;
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const clearError = (name) =>
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError(name);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'phone') val = val.replace(/\D/g, '');
    if ((name === 'password' || name === 'confirmPassword') && val.length > 15) return;
    setField(name, val);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if ((name === 'password' || name === 'confirmPassword') && value.length > 0 && value.length < 8) {
      setErrors((prev) => ({ ...prev, [name]: 'Must be at least 8 characters' }));
    }
    if (name === 'confirmPassword' && value && value !== formData.password) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    const stepErrors = validateStepOne(formData);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setSearchParams({ step: '2' });
    window.scrollTo({ top: 0 });
  };

  const backToStepOne = () => {
    // Step 2 was pushed by Continue, so going back keeps browser history in sync.
    navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const stepErrors = validateStepTwo(formData);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }

    setLoading(true);
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email,
      password: formData.password,
      countryCode: formData.countryCode,
      phone: formData.phone,
      country: formData.country,
      state: formData.state,
      pinCode: String(formData.pinCode || '').trim(),
      userType: formData.userType,
      city: null,
      address: null,
      ...(formData.userType === 'vendor' && isIndia(formData.country)
        ? { isSeepzPrimaryProductionUnit: Boolean(formData.isSeepzPrimaryProductionUnit) }
        : {}),
    };

    try {
      await authService.signup(payload);
      addToast('Account created. Let’s verify your phone and email.', 'success');
      setTimeout(() => navigate('/verification'), 1000);
    } catch (err) {
      const message = err.message || 'Registration failed';
      // Duplicate email/phone belongs to step 1: send the user back to fix it there.
      const field = /e-?mail/i.test(message) ? 'email' : /phone|mobile/i.test(message) ? 'phone' : null;
      if (field && STEP_ONE_FIELDS.includes(field)) {
        setErrors({ [field]: message });
        backToStepOne();
      }
      addToast(message, 'error');
      setLoading(false);
    }
  };

  const codeOptions = useMemo(() => toDialCodeOptions(countryRows), [countryRows]);
  const countryOptions = useMemo(
    () => countryRows.map((c) => ({ value: c.countryName, label: c.countryName, searchData: { name: c.countryName } })),
    [countryRows]
  );
  const countryLookup = useMemo(
    () => countryRows.map((c) => ({ code: c.countryCode, name: c.countryName })),
    [countryRows]
  );
  const stateLabel = getStateRegionLabelForCountry(formData.country, countryLookup) || 'State';
  const postalLabel = getPostalCodeLabelForCountry(formData.country, countryLookup) || 'Postal code';

  const isBuyer = formData.userType === 'customer';
  const signInFooter = (
    <p className="text-center font-jakarta text-[14px] text-mid lg:text-[12.5px]">
      Already registered? <TextLink onClick={() => navigate('/login')}>Sign in</TextLink>
    </p>
  );

  return (
    <div>
      <ToastStack toasts={toasts} onClose={removeToast} />

      {step === 1 ? (
        <form onSubmit={handleContinue} noValidate autoComplete="on">
          <AuthHeading size="md" title="Create your free account" />
          <div className="mt-4 lg:mt-3">
            <StepProgress step={1} />
          </div>

          <div role="radiogroup" aria-label="Account type" className="mt-5 grid grid-cols-2 gap-3 lg:mt-4 lg:gap-2.5">
            <RoleCard
              selected={isBuyer}
              onSelect={() => setFormData((p) => ({ ...p, userType: 'customer', isSeepzPrimaryProductionUnit: false }))}
              title="Buyer"
              description="Retailer, brand, designer or individual"
            />
            <RoleCard
              selected={!isBuyer}
              onSelect={() => setFormData((p) => ({ ...p, userType: 'vendor' }))}
              title="Manufacturer"
              description="Workshop or production business"
            />
          </div>

          <div className="mt-5 space-y-3.5 lg:mt-4 lg:space-y-2.5">
            <div className="grid grid-cols-2 gap-3 lg:gap-2.5">
              <Field label="First name" htmlFor="reg-first" error={errors.firstName}>
                <TextInput id="reg-first" name="firstName" autoComplete="given-name" placeholder="First name" value={formData.firstName} onChange={handleChange} error={errors.firstName} />
              </Field>
              <Field label="Last name" htmlFor="reg-last" error={errors.lastName}>
                <TextInput id="reg-last" name="lastName" autoComplete="family-name" placeholder="Last name" value={formData.lastName} onChange={handleChange} error={errors.lastName} />
              </Field>
            </div>
            <Field label="Email address" htmlFor="reg-email" error={errors.email}>
              <TextInput id="reg-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} error={errors.email} />
            </Field>
            <Field label="Phone number" htmlFor="reg-phone" error={errors.phone}>
              <PhoneInput
                id="reg-phone"
                codeOptions={codeOptions}
                countryCode={formData.countryCode}
                onCountryCodeChange={(countryCode) => setFormData((p) => ({ ...p, countryCode }))}
                name="phone"
                autoComplete="tel-national"
                placeholder="Phone number"
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3 lg:gap-2.5">
              <Field label="Password" htmlFor="reg-password" error={errors.password}>
                <PasswordInput id="reg-password" name="password" autoComplete="new-password" placeholder="Create password" value={formData.password} onChange={handleChange} onBlur={handleBlur} error={errors.password} />
              </Field>
              <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirmPassword}>
                <PasswordInput id="reg-confirm" name="confirmPassword" autoComplete="new-password" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur} error={errors.confirmPassword} />
              </Field>
            </div>
          </div>

          {/* Pinned to the bottom of the screen while the form is taller than the window, so Continue is always in view. */}
          <div className="sticky bottom-0 z-10 -mx-5 mt-3 bg-gradient-to-t from-cream from-75% to-cream/0 px-5 pb-4 pt-5 sm:-mx-8 sm:px-8 lg:-mx-3 lg:px-3 lg:pb-3 lg:pt-4">
            <PrimaryButton type="submit" className="w-full">
              Continue <ArrowRight />
            </PrimaryButton>
          </div>
          <div className="border-t border-pale pt-5 lg:pt-4">{signInFooter}</div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate autoComplete="on">
          <AuthHeading size="md" title="Finish creating your account" />
          <div className="mt-5 lg:mt-4">
            <StepProgress step={2} />
          </div>
          <p className="mt-4 font-jakarta text-[14px] text-mid lg:mt-3 lg:text-[12.5px]">
            <span className="font-semibold text-ink">{isBuyer ? 'Buyer' : 'Manufacturer'} account</span>
            <span className="mx-2 text-soft" aria-hidden>·</span>
            <TextLink onClick={backToStepOne}>Change</TextLink>
          </p>

          <div className="mt-6 space-y-4 lg:mt-5 lg:space-y-3">
            <Field label="Country" error={errors.country}>
              <SearchSelect
                options={countryOptions}
                placeholder="Select country"
                searchPlaceholder="Search country…"
                value={formData.country}
                error={errors.country}
                onChange={(e) => {
                  const country = e.target.value;
                  setFormData((p) => ({
                    ...p,
                    country,
                    // SEEPZ only applies to India manufacturers
                    ...(isIndia(country) ? {} : { isSeepzPrimaryProductionUnit: false }),
                  }));
                  clearError('country');
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 lg:gap-2.5">
              <Field label={stateLabel} htmlFor="reg-state">
                <TextInput id="reg-state" name="state" autoComplete="address-level1" placeholder={`Enter ${stateLabel.toLowerCase()}`} value={formData.state} onChange={handleChange} />
              </Field>
              <Field label={postalLabel} htmlFor="reg-pin" error={errors.pinCode}>
                <TextInput id="reg-pin" name="pinCode" autoComplete="postal-code" autoCapitalize="characters" spellCheck={false} maxLength={20} placeholder={`Enter ${postalLabel.toLowerCase()}`} value={formData.pinCode} onChange={handleChange} error={errors.pinCode} />
              </Field>
            </div>

            {!isBuyer && isIndia(formData.country) ? (
              <Checkbox name="isSeepzPrimaryProductionUnit" checked={Boolean(formData.isSeepzPrimaryProductionUnit)} onChange={handleChange}>
                My primary production unit is in SEEPZ
              </Checkbox>
            ) : null}

            <div>
              <Checkbox name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} error={errors.termsAccepted}>
                I agree to the{' '}
                <TextLink href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms &amp; Conditions
                </TextLink>
              </Checkbox>
              {errors.termsAccepted ? <p className="ml-[30px] mt-1 font-jakarta text-[12px] text-red-600 lg:text-[11px]">{errors.termsAccepted}</p> : null}
            </div>
          </div>

          <p className="mt-5 font-jakarta text-[13px] text-mid lg:mt-4 lg:text-[12px]">Account registration is free.</p>
          <div className="mt-4 grid grid-cols-[2fr_3fr] gap-3 lg:mt-3 lg:gap-2.5">
            <OutlineButton onClick={backToStepOne} disabled={loading} className="px-4 lg:px-3.5">
              <ArrowLeft /> Back
            </OutlineButton>
            <PrimaryButton type="submit" disabled={loading} className="px-4 lg:px-3.5">
              {loading ? 'Creating…' : 'Create account'} {!loading && <ArrowRight />}
            </PrimaryButton>
          </div>
          <div className="mt-6 lg:mt-5">{signInFooter}</div>
        </form>
      )}
    </div>
  );
};
