import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { kycService } from '../../services/kycService';
import { authService } from '../../services/authService';
import logo from '../../assets/logo.png';

// --- GLOBAL STYLES ---
const globalStyles = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .animate-slide-in { animation: slideIn 0.4s ease-out forwards; }
  
  /* Custom Scrollbar applied only to the form container */
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`;

// --- HELPER COMPONENTS ---

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const CustomSelect = ({ options, placeholder, value, onChange, disabled, className, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  useEffect(() => {
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
    if (!isOpen) setSearchTerm(''); 
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerTerm = searchTerm.toLowerCase();
    
    return options.filter(opt => {
      if (opt.searchData) {
        return Object.values(opt.searchData).some(val => 
          String(val).toLowerCase().includes(lowerTerm)
        );
      }
      const label = opt.label || opt;
      const val = opt.value || opt;
      return String(label).toLowerCase().includes(lowerTerm) || String(val).toLowerCase().includes(lowerTerm);
    });
  }, [options, searchTerm]);

  const selectedOption = options.find(o => (o.value || o) === value);
  const selectedLabel = selectedOption ? (selectedOption.label || selectedOption.value) : value;

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3.5 lg:py-3 pr-10 rounded-[8px] border border-gray-200 text-[14px] font-medium bg-white focus:outline-none focus:border-primary-dark focus:ring-1 focus:ring-primary-dark/10 transition-all cursor-pointer flex items-center
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:border-gray-300'}
        `}
      >
        {selectedLabel ? (
          <span className="truncate text-gray-700">{selectedLabel}</span>
        ) : (
          <span className="truncate text-gray-400">
            {placeholder}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        )}
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-[8px] shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-50 bg-gray-50/50">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-dark font-sans bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-[160px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const val = opt.value || opt;
                const lab = opt.label || opt;
                return (
                  <li 
                    key={idx}
                    onClick={() => handleSelect(val)}
                    className={`px-4 py-3 lg:py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0
                      ${val === value ? 'bg-primary-dark/5 text-primary-dark font-semibold' : ''}
                    `}
                  >
                    {lab}
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-[13px] text-gray-400 italic text-center">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const InputField = ({ label, required, error, type = "text", ...props }) => (
  <div className="w-full relative">
    <input
      type={type}
      placeholder={`${label}${required ? '*' : ''}`}
      className={`w-full px-4 py-3.5 lg:py-3 rounded-[8px] border text-gray-700 text-[14px] font-medium focus:outline-none focus:ring-1 transition-all font-sans 
        placeholder:text-gray-400 
        ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-primary-dark focus:ring-primary-dark/10'}
      `}
      {...props}
    />
    {error && <p className="text-red-500 text-[11px] mt-1 ml-1 absolute -bottom-4 left-0">{error}</p>}
  </div>
);

const FileUploadField = ({ label, required, onUpload, value, error }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await kycService.uploadDocument(file);
      onUpload(response.fileUrl || response.id || file.name); 
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full col-span-1 md:col-span-2">
      <div className="mb-2">
        <span className="text-[13px] font-medium text-gray-700">
          Upload Image <span className="text-gray-500 font-normal">({label})</span>
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </div>
      <div className={`relative w-full h-32 border-2 border-dashed rounded-[12px] flex flex-col items-center justify-center bg-white transition-all
        ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-primary-dark'}
      `}>
        <input 
          type="file" 
          onChange={handleFileChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept="image/*,.pdf"
        />
        {uploading ? (
          <span className="text-primary-dark text-sm font-semibold animate-pulse">Uploading...</span>
        ) : value ? (
          <div className="text-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-green-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <span className="text-gray-700 text-[13px] font-medium">Document Uploaded</span>
          </div>
        ) : (
          <div className="text-center text-gray-400 flex flex-col items-center">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <div className="absolute -bottom-1 -right-1 bg-primary-dark rounded-full p-0.5 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-[11px] mt-1 ml-1">{error}</p>}
    </div>
  );
};


// --- MAIN KYC COMPONENT ---

export default function VendorKYC() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // KYC State
  const [status, setStatus] = useState(null); 
  const [country, setCountry] = useState('');
  const [countryData, setCountryData] = useState([]);
  const [config, setConfig] = useState(null); 
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Helper to map backend fields to UI sections
  const processBackendFields = (fieldsRes) => {
    const rawSections = fieldsRes.fieldsBySection || {};
    
    const orderedKeys = [
      { id: 'business_details', title: 'Verify Your Business', subtitle: 'To ensure trust and safety, we require all jewelers to complete KYC before accepting projects' },
      { id: 'business_info', title: 'Business Information', subtitle: 'To ensure we require all business information' },
      { id: 'bank_details', title: 'Banking Details', subtitle: 'To ensure we require all bank details' }
    ];

    const formattedSections = [];
    
    orderedKeys.forEach(sec => {
      if (rawSections[sec.id] && rawSections[sec.id].length > 0) {
        formattedSections.push({
          id: sec.id,
          title: sec.title,
          subtitle: sec.subtitle,
          fields: rawSections[sec.id].sort((a, b) => a.order - b.order)
        });
      }
    });

    Object.keys(rawSections).forEach(key => {
      if (!formattedSections.find(s => s.id === key) && rawSections[key].length > 0) {
        formattedSections.push({
          id: key,
          title: key.replace(/_/g, ' ').toUpperCase(),
          subtitle: 'Please provide details',
          fields: rawSections[key].sort((a, b) => a.order - b.order)
        });
      }
    });

    return formattedSections;
  };

  useEffect(() => {
    const initKYC = async () => {
      try {
        const cResponse = await authService.getCountryCodes();
        const cData = Array.isArray(cResponse) ? cResponse : (cResponse.data || []);
        const validCountries = cData.map(c => ({ code: c.countryCode, name: c.countryName }));
        setCountryData(validCountries);

        const res = await kycService.getStatus();
        setStatus(res.status || 'PENDING');
        
        if (res.status === 'PENDING') {
          if (res.country) {
            setCountry(res.country);
            const fieldsRes = await kycService.getFields(res.country);
            setConfig({ sections: processBackendFields(fieldsRes) });
            setFormData(res.savedData || {});
            setCurrentStep(res.lastStep || 1);
          } else {
            try {
              const geoRes = await fetch('https://ipapi.co/json/');
              const geoInfo = await geoRes.json();
              if (geoInfo && validCountries.length > 0) {
                const matchedCode = validCountries.find(c => c.code === geoInfo.country_code);
                if (matchedCode) setCountry(matchedCode.code);
              }
            } catch (geoErr) {
              const fallback = validCountries.find(c => c.name === "India" || c.code === "IN");
              if (fallback) setCountry(fallback.code);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load KYC status", err);
      } finally {
        setLoading(false);
      }
    };
    initKYC();
  }, []);

  const countryOptions = useMemo(() => {
    return countryData.map(c => ({
      value: c.code,
      label: c.name,
      searchData: { code: c.code, name: c.name }
    }));
  }, [countryData]);

  const handleCountrySubmit = async () => {
    if (!country) return setErrors({ country: "Please select a country" });
    setLoading(true);
    try {
      const fieldsRes = await kycService.getFields(country);
      setConfig({ sections: processBackendFields(fieldsRes) });
      setCurrentStep(1);
    } catch (err) {
      console.error(err);
      setErrors({ country: err.message || "Failed to load configuration for this country." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleNext = async () => {
    const currentSection = config.sections[currentStep - 1];
    const newErrors = {};
    const sectionData = {};
    
    if (currentStep === 1) sectionData.country = country;

    currentSection.fields.forEach(field => {
      if (formData[field.fieldName] !== undefined) {
          sectionData[field.fieldName] = formData[field.fieldName];
      }
      if (field.acceptsAttachment && formData[`${field.fieldName}_file`]) {
          sectionData[`${field.fieldName}_file`] = formData[`${field.fieldName}_file`];
      }

      if (field.required && (formData[field.fieldName] === undefined || formData[field.fieldName] === '')) {
        newErrors[field.fieldName] = "Required";
      }
      if (field.acceptsAttachment && field.required && !formData[`${field.fieldName}_file`]) {
        newErrors[`${field.fieldName}_file`] = "Required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await kycService.saveProgress(currentSection.id, sectionData);
      
      if (currentStep < config.sections.length) {
        setCurrentStep(prev => prev + 1);
      } else {
        await kycService.submitKYC();
        setStatus('IN_REVIEW');
      }
    } catch (err) {
      console.error("Failed to save progress", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  // --- RENDERERS ---

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white text-primary-dark font-sans font-medium">Loading KYC Details...</div>;

  if (status === 'IN_REVIEW') {
    return (
      <div className="h-screen w-full bg-white flex flex-col items-center justify-center p-6 font-sans">
         <img src={logo} alt="Mirah Logo" className="w-16 h-16 rounded-xl shadow-sm mb-6" />
         <h1 className="font-serif text-[32px] font-bold text-primary-dark mb-2">KYC Under Review</h1>
         <p className="text-gray-500 text-center max-w-md">Your application has been submitted successfully. Our admin team is currently reviewing your documents. You will be notified once approved.</p>
         <button onClick={() => navigate('/dashboard')} className="mt-8 bg-primary-dark text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-primary-dark/90 transition-all">Go to Dashboard</button>
      </div>
    );
  }

  const totalSteps = config ? config.sections.length : 1;

  return (
    // FIXED: Main background is now exactly `bg-white` to match the navbar
    <div className="h-screen w-full bg-white flex flex-col font-sans relative overflow-hidden">
      <style>{globalStyles}</style>

      {/* HEADER */}
      <header className="shrink-0 w-full bg-white px-5 lg:px-8 py-4 flex items-center justify-between border-b border-gray-100 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Mirah" className="w-8 h-8 rounded-md shadow-sm hidden sm:block" />
          <span className="font-serif text-xl text-primary-dark font-bold italic hidden sm:block">Mirah</span>
          <button className="sm:hidden text-primary-dark p-1" onClick={() => navigate(-1)}>
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
             </svg>
          </button>
        </div>
        
        {config && currentStep > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex gap-1 w-24 sm:w-32">
              {config.sections.map((_, idx) => (
                <div key={idx} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${idx < currentStep ? 'bg-primary-dark' : 'bg-gray-200'}`} />
              ))}
            </div>
            <span className="text-[13px] font-bold text-gray-500">{currentStep} of {totalSteps}</span>
          </div>
        )}
      </header>

      {/* BODY */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* FIXED: Removed pb-24 so empty space goes away on mobile. Kept standard py-8 lg:py-12 */}
        <div className="w-full max-w-[700px] mx-auto py-8 px-5 lg:py-12">
          
          {/* STEP 0: COUNTRY SELECTION */}
          {currentStep === 0 && (
            <div className="animate-slide-in text-center max-w-md mx-auto mt-10">
              <h1 className="font-serif text-[28px] lg:text-[32px] font-bold text-primary-dark mb-2">Welcome to Mirah</h1>
              <p className="text-gray-500 text-[14px] mb-8">Please select the country your business is registered in to begin KYC.</p>
              
              <div className="text-left">
                 <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">Registered Country <span className="text-red-500">*</span></label>
                 
                 <CustomSelect
                   placeholder="Search or Select Country"
                   value={country}
                   onChange={(e) => { setCountry(e.target.value); setErrors({}); }}
                   options={countryOptions}
                 />
                 {errors.country && <p className="text-red-500 text-[11px] mt-1 ml-1">{errors.country}</p>}
                 
                 <button 
                   onClick={handleCountrySubmit}
                   disabled={loading}
                   className="w-full mt-8 bg-primary-dark text-white py-3.5 rounded-full text-[15px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-50"
                 >
                   {loading ? 'Loading Setup...' : 'Begin KYC'}
                 </button>
              </div>
            </div>
          )}

          {/* DYNAMIC STEPS (1 to N) */}
          {currentStep > 0 && config && (
            <div className="animate-slide-in">
              <div className="text-center mb-8 lg:mb-10">
                <h1 className="font-serif text-[26px] lg:text-[32px] font-bold text-primary-dark mb-2">
                  {config.sections[currentStep - 1].title}
                </h1>
                <p className="text-gray-500 text-[13px] lg:text-[14px]">
                  {config.sections[currentStep - 1].subtitle}
                </p>
              </div>

              {/* Form Grid Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-6 lg:gap-y-8">
                
                {/* DYNAMIC FIELD RENDERER */}
                {config.sections[currentStep - 1].fields.map((field) => {
                  
                  const renderInput = () => {
                    if (field.dataType === 'boolean' || field.type === 'select') {
                      const options = field.dataType === 'boolean' 
                        ? [{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}]
                        : (field.options?.map(o => ({label: o, value: o})) || []);

                      return (
                        <div className="w-full relative mb-2">
                           <CustomSelect 
                             placeholder={field.label}
                             required={field.required}
                             options={options}
                             value={formData[field.fieldName] !== undefined ? String(formData[field.fieldName]) : ''}
                             onChange={(e) => handleChange(field.fieldName, field.dataType === 'boolean' ? e.target.value === 'true' : e.target.value)}
                             className={errors[field.fieldName] ? 'border-red-400' : ''}
                           />
                           {errors[field.fieldName] && <p className="text-red-500 text-[11px] mt-1 ml-1 absolute -bottom-4 left-0">{errors[field.fieldName]}</p>}
                        </div>
                      );
                    }
                    
                    return (
                      <div className="mb-2 w-full">
                        <InputField 
                          label={field.label}
                          required={field.required}
                          error={errors[field.fieldName]}
                          type={field.dataType === 'number' ? 'number' : 'text'}
                          value={formData[field.fieldName] || ''}
                          onChange={(e) => handleChange(field.fieldName, e.target.value)}
                        />
                      </div>
                    );
                  };

                  return (
                    <React.Fragment key={field.fieldName}>
                      {renderInput()}

                      {field.acceptsAttachment && (
                        <FileUploadField 
                          label={field.label}
                          required={field.required}
                          error={errors[`${field.fieldName}_file`]}
                          value={formData[`${field.fieldName}_file`]}
                          onUpload={(url) => handleChange(`${field.fieldName}_file`, url)}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ACTION BUTTONS */}
              <div className="mt-10 flex flex-col-reverse md:flex-row items-center gap-4 pt-6">
                {currentStep > 1 && (
                  <button 
                    onClick={handleBack}
                    className="w-full md:flex-1 py-3.5 rounded-full border-2 border-primary-dark text-primary-dark text-[15px] font-bold hover:bg-primary-dark/5 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button 
                  onClick={handleNext}
                  disabled={saving}
                  className="w-full md:flex-1 py-3.5 rounded-full bg-primary-dark text-white text-[15px] font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] hover:bg-primary-dark/90 transition-all disabled:opacity-70"
                >
                  {saving ? 'Saving...' : (currentStep === totalSteps ? 'Submit Application' : 'Next')}
                </button>
              </div>

              {/* Notice text shown on step 2 per mockup */}
              {currentStep === 2 && (
                <p className="text-[11px] text-gray-500 mt-6 text-center">
                  <span className="text-red-500 font-bold">Note:</span> Kindly attach your company's registration scan copy & photo identity proof of proprietor/director/partner.
                </p>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}