import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, MessageSquare, Copy, User } from 'lucide-react';

export default function TicketConfirmationPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  function copyToClipboard() {
    if (ticketId) navigator.clipboard.writeText(ticketId);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'var(--font-body)' }}>
      {/* Bold Header */}
      <header style={{ 
        padding: '1.25rem 2rem', 
        background: '#0f172a', 
        color: '#fff',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '4px', borderRadius: '8px' }}>
            <img src="/tg-logo.jpg" alt="TG SMART" style={{ width: 40, height: 40, borderRadius: '4px', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.02em', display: 'block', lineHeight: 1.2 }}>TG SMART</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Service Portal</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/login')}
            style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '99px', transition: 'all 0.2s' }}
          >
            <User size={14} /> Login
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '3rem', textAlign: 'center' }}>
          {/* Success Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem', boxShadow: '0 0 24px rgba(74,222,128,0.2)',
          }}>
            <CheckCircle size={36} style={{ color: '#4ade80' }} />
          </div>

          <h1 className="text-display-sm" style={{ marginBottom: '0.5rem', color: '#0f172a' }}>Complaint Registered!</h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            Your complaint has been received. Our team will review it and assign a technician shortly.
          </p>

          {/* Ticket ID */}
          <div style={{
            background: '#f1f5f9', borderRadius: '16px',
            padding: '1.25rem 1.5rem', marginBottom: '2rem',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>Your Ticket ID</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', letterSpacing: '0.05em' }}>
                {ticketId}
              </span>
              <button onClick={copyToClipboard} title="Copy ticket ID"
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Info boxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem', textAlign: 'left' }}>
            {[
              { icon: <MessageSquare size={16} />, text: 'You will receive an SMS with your ticket ID and tracking link.' },
              { icon: <CheckCircle size={16} />, text: 'Our team typically responds within 24 hours.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <span style={{ color: '#0f172a', marginTop: '2px', flexShrink: 0 }}>{item.icon}</span>
                <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>{item.text}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <Link to={`/track/${ticketId}`} className="btn btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontWeight: 700, background: '#0f172a' }}>
              Track Your Ticket
            </Link>
            <Link to="/complaint" className="btn btn-ghost" style={{ color: '#64748b', fontWeight: 600 }}>
              Submit Another Complaint
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
