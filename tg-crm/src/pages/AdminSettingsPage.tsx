import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { User, Shield, CreditCard, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  const { employee } = useAuth();

  const sections = [
    { title: 'Profile Settings', icon: <User size={20} />, active: true },
    { title: 'Security & Password', icon: <Shield size={20} /> },
    { title: 'System Configurations', icon: <Bell size={20} /> },
    { title: 'Subscription & Billing', icon: <CreditCard size={20} /> },
  ];

  return (
    <AppLayout title="Administrative Settings">
      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2.5rem' }}>
          
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sections.map(s => (
              <button key={s.title} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', 
                padding: '0.875rem 1.25rem', borderRadius: '12px', border: 'none',
                background: s.active ? 'var(--primary-container)' : 'transparent',
                color: s.active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s'
              }}>
                {s.icon} {s.title}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h3 className="text-display-xs" style={{ marginBottom: '1.5rem' }}>Account Details</h3>
            
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px', display: 'block' }}>Full Name</label>
                  <input type="text" className="input" defaultValue={employee?.name} readOnly />
                </div>
                <div className="input-field">
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px', display: 'block' }}>Associated Email</label>
                  <input type="email" className="input" defaultValue={employee?.email} readOnly />
                </div>
              </div>

              <div className="input-field">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px', display: 'block' }}>Role</label>
                <input type="text" className="input" defaultValue="Master Administrator" readOnly style={{ background: 'var(--surface-low)' }} />
              </div>
            </form>

            <div style={{ marginTop: '2.5rem', paddingTop: '2.5rem', borderTop: '2px dashed var(--outline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Bell size={22} style={{ color: 'var(--primary)' }} />
                <h3 className="text-display-xs">System Diagnostics</h3>
              </div>

              <div className="glass-card" style={{ padding: '2rem', background: 'var(--surface-high)' }}>
                <h4 style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', opacity: 0.7 }}>SMS Gateway Tester (Fast2SMS)</h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem', opacity: 0.8 }}>Enter your phone number to test if the "Quick SMS" route is active. Check console (F12) for detailed logs.</p>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input 
                    id="testPhone" 
                    type="text" 
                    className="input" 
                    placeholder="10-digit Phone Number" 
                    style={{ maxWidth: '240px' }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={async () => {
                      const num = (document.getElementById('testPhone') as HTMLInputElement).value;
                      if (!num) return alert("Please enter a number");
                      const btn = (document.activeElement as HTMLButtonElement);
                      btn.innerText = "Sending...";
                      btn.disabled = true;
                      
                      const { sendSMS } = await import('../core/utils/sms');
                      const result = await sendSMS(num, "TG SMART: This is a system test message from your Admin Panel.");
                      
                      btn.innerText = "Send Test SMS";
                      btn.disabled = false;
                      
                      if (result?.return) {
                        alert("SMS Sent Successfully! Result: " + JSON.stringify(result.message));
                      } else {
                        alert("FAILED: " + (result?.message || "Check network/console"));
                      }
                    }}
                  >
                    Send Test SMS
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 260px 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
