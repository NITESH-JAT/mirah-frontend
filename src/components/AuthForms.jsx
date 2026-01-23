import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const Input = ({ label, type = "text", ...props }) => (
  <div className="relative mb-3">
    {label && <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-400 z-10 uppercase tracking-wider">{label}</label>}
    <input 
      {...props} 
      type={type}
      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-dark text-sm text-gray-700" 
    />
  </div>
);

export const LoginForm = () => {
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

  const handleNext = () => {
    if (phone.length === 10) {
      localStorage.setItem('mirah_pending_phone', phone);
      navigate('/otp');
    }
  };

  return (
    <div className="w-full max-w-[340px] mx-auto text-center">
      <h1 className="auth-heading text-2xl mb-2">Enter your phone number</h1>
      <p className="text-gray-400 text-xs mb-8">Join us today and unlock a world of possibilities.</p>
      
      <div className="flex items-center justify-center text-xl font-medium mb-10">
        <span className="text-black">+91</span>
        <input 
          type="number" 
          placeholder="00000-00000"
          className="ml-2 w-40 outline-none placeholder-gray-200"
          value={phone}
          onChange={(e) => setPhone(e.target.value.slice(0, 10))}
        />
      </div>

      <button 
        onClick={handleNext}
        disabled={phone.length < 10}
        className="w-full bg-primary-dark text-white py-3.5 rounded-full text-sm font-medium mb-4 disabled:opacity-50 transition-all active:scale-95"
      >
        Next
      </button>
      <p className="text-xs text-gray-500">
        Don't have account? <span onClick={() => navigate('/register')} className="text-primary-dark font-bold cursor-pointer underline underline-offset-2">Sign Up</span>
      </p>
    </div>
  );
};

export const OTPForm = () => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(59);
  const inputs = useRef([]);
  const navigate = useNavigate();
  const phone = localStorage.getItem('mirah_pending_phone');

  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (val, i) => {
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    if (val && i < 3) inputs.current[i + 1].focus();
  };

  const handleVerify = async () => {
    if (otp.join('') === '1234') {
      const result = await authService.login(phone);
      if (result.success) navigate('/welcome');
      else navigate('/register');
    }
  };

  return (
    <div className="w-full max-w-[340px] mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-xl">←</button>
      <h1 className="auth-heading text-2xl mb-1">OTP Code</h1>
      <p className="text-gray-500 text-xs mb-1">Enter the OTP send to</p>
      <div className="flex items-center gap-2 mb-6">
        <span className="font-semibold text-primary-dark text-sm">+91 {phone}</span>
        <button className="text-primary-dark text-xs">✎</button>
      </div>

      <div className="flex gap-3 mb-6">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => inputs.current[i] = el}
            type="number"
            className="w-12 h-14 border border-gray-200 rounded-lg text-center text-lg font-semibold focus:border-primary-dark outline-none bg-gray-50"
            value={digit}
            onChange={(e) => handleChange(e.target.value, i)}
          />
        ))}
      </div>

      <div className="h-6 mb-8">
        {timer > 0 ? (
          <p className="text-xs text-gray-400">
            Didn't receive code? <span className="text-primary-dark opacity-60">Resend OTP in {timer}s</span>
          </p>
        ) : (
          <button 
            onClick={() => setTimer(59)}
            className="text-xs text-primary-dark font-bold hover:underline"
          >
            Resend OTP Now
          </button>
        )}
      </div>

      <button 
        onClick={handleVerify}
        disabled={otp.join('').length < 4}
        className="w-full bg-primary-dark text-white py-3.5 rounded-full text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
      >
        Verify
      </button>
    </div>
  );
};

export const RegisterForm = () => {
  const [role, setRole] = useState('user');
  const [formData, setFormData] = useState({ 
    fullName: '', 
    phone: localStorage.getItem('mirah_pending_phone') || '', 
    city: '', 
    password: '', 
    confirmPassword: '' 
  });
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) return alert("Passwords mismatch");
    await authService.register({ ...formData, role });
    navigate('/welcome');
  };

  return (
    <div className="w-full max-w-[340px] mx-auto">
      <div className="text-center mb-4">
        <h1 className="auth-heading text-2xl mb-1">Create Your Account</h1>
        <p className="text-gray-400 text-xs">Join our community of jewelry lovers.</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
        <button onClick={() => setRole('user')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${role === 'user' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}>As a User</button>
        <button onClick={() => setRole('seller')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${role === 'seller' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}>As a Jeweller</button>
      </div>

      <p className="text-center text-gray-400 text-[10px] mb-6 leading-tight">
        {role === 'user' ? 'Connect with skilled makers' : 'Grow your jewelry business'}
      </p>

      <Input placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
      <Input placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
      
      <div className="relative mb-3">
        <select 
          className="w-full px-4 py-3 border border-gray-200 rounded-xl appearance-none bg-white text-sm text-gray-400 outline-none" 
          value={formData.city} 
          onChange={e => setFormData({...formData, city: e.target.value})}
        >
          <option value="">City</option>
          <option value="Mumbai">Mumbai</option>
          <option value="Surat">Surat</option>
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">▼</div>
      </div>

      <Input label="Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
      <Input placeholder="Confirm Password" type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />

      <button onClick={handleRegister} className="w-full bg-primary-dark text-white py-3.5 rounded-full text-sm font-medium mt-2">Next</button>
      <p className="text-center text-[11px] text-gray-500 mt-4">Already have an account? <span onClick={() => navigate('/login')} className="text-primary-dark font-bold cursor-pointer">Login</span></p>
    </div>
  );
};