import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../core/supabase/client';
import { Shield, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../core/auth/AuthContext';

type LoginMethod = 'password' | 'otp';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/dashboard';
  const { session, employee } = useAuth();

  useEffect(() => {
    if (session && employee) {
      if (employee.role === 'admin') navigate('/admin', { replace: true });
      else if (employee.role === 'manager') navigate('/manager', { replace: true });
      else navigate(from === '/login' || from === '/' || from === '/complaint' ? '/dashboard' : from, { replace: true });
    }
  }, [session, employee, navigate, from]);

  const [method, setMethod] = useState<LoginMethod>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // UI redirection is handled by useEffect on session and employee changes
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const formattedPhone = `+91${phone.replace(/\D/g, '')}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const token = otp.join('');
    if (token.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: `+91${phone.replace(/\D/g, '')}`,
        token,
        type: 'sms',
      });
      if (error) throw error;
      // UI redirection is handled by useEffect on session and employee changes
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleOtpInput(value: string, index: number) {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  }

  return (
    <div className="public-light-theme login-page">
      <div className="glass-card login-card">
        
        {/* Logo Section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            width: 160, height: 64, background: 'white', borderRadius: '12px', 
            margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid var(--outline)',
            padding: '8px'
          }}>
            <img src="/tg-logo.jpg" alt="TG Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Service Portal Gateway</p>
        </div>

        {/* Method Selector Tabs */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--outline)' }}>
          {([
            { id: 'password', label: 'Password' },
            { id: 'otp', label: 'OTP' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setMethod(tab.id); setError(''); setOtpSent(false); }}
              style={{
                paddingBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
                color: method === tab.id ? 'var(--primary)' : 'var(--outline)',
                background: 'none', border: 'none',
                borderBottom: method === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ 
            background: 'var(--error-container)', color: 'var(--error)', 
            padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', 
            marginBottom: '1rem', border: '1px solid rgba(220, 38, 38, 0.1)' 
          }}>
            {error}
          </div>
        )}

        {/* Form Area */}
        {method === 'password' && (
          <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ marginBottom: '0.2rem' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@tgsmart.in" style={{ height: '52px', paddingLeft: '2.75rem' }} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: '0.5rem' }}>
              <label className="input-label" style={{ marginBottom: '0.2rem' }}>Credential Key</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={{ height: '52px', paddingLeft: '2.75rem' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', opacity: 0.5 }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={isLoading} style={{ height: '56px', borderRadius: 'var(--radius-lg)' }}>
              {isLoading ? 'Processing...' : 'Secure Login'}
            </button>
          </form>
        )}

        {method === 'otp' && !otpSent && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ marginBottom: '0.2rem' }}>Mobile Number</label>
              <div className="input-with-prefix">
                <span className="input-prefix" style={{ background: 'var(--surface-high)' }}>+91</span>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required placeholder="9876543210" style={{ height: '52px' }} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={isLoading || phone.length !== 10} style={{ height: '56px', borderRadius: 'var(--radius-lg)' }}>
              {isLoading ? 'Requesting...' : 'Receive Login Code'}
            </button>
          </form>
        )}

        {method === 'otp' && otpSent && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem' }}>Enter the 6-digit code sent to +91 {phone}</p>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
                {otp.map((digit, i) => (
                  <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpInput(e.target.value, i)} className="input" style={{ width: '44px', height: '56px', textAlign: 'center', fontWeight: 800, fontSize: '1.25rem', border: '1px solid var(--outline)' }} />
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={isLoading} style={{ height: '56px', borderRadius: 'var(--radius-lg)' }}>
              {isLoading ? 'Confirming...' : 'Verify Login Code'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOtpSent(false)}>Edit Mobile Number</button>
          </form>
        )}

        {/* Meta Info */}
        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', opacity: 0.6 }}>
          <Shield size={14} /> <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>TG SMART ENTERPRISE ENCRYPTION ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
