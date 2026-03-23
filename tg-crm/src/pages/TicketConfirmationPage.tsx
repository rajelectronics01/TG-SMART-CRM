import { useParams, Link } from 'react-router-dom';
import { CheckCircle, MessageSquare, Copy } from 'lucide-react';

export default function TicketConfirmationPage() {
  const { ticketId } = useParams<{ ticketId: string }>();

  function copyToClipboard() {
    if (ticketId) navigator.clipboard.writeText(ticketId);
  }

  return (
    <div className="public-light-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '3rem', textAlign: 'center' }}>
        {/* Success Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem', boxShadow: '0 0 24px rgba(74,222,128,0.2)',
        }}>
          <CheckCircle size={36} style={{ color: '#4ade80' }} />
        </div>

        <h1 className="text-headline-md" style={{ marginBottom: '0.5rem' }}>Complaint Registered!</h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9375rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Your complaint has been received. Our team will review it and assign a technician shortly.
        </p>

        {/* Ticket ID */}
        <div style={{
          background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem', marginBottom: '2rem',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Your Ticket ID</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: '#000', letterSpacing: '0.05em' }}>
              {ticketId}
            </span>
            <button onClick={copyToClipboard} title="Copy ticket ID"
              style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)', padding: '4px', cursor: 'pointer', color: 'var(--on-surface-variant)', display: 'flex' }}>
              <Copy size={14} />
            </button>
          </div>
        </div>

        {/* Info boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem', textAlign: 'left' }}>
          {[
            { icon: <MessageSquare size={15} />, text: 'You will receive an SMS with your ticket ID and tracking link.' },
            { icon: <CheckCircle size={15} />, text: 'Our team typically responds within 24 hours.' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.875rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: '#000', marginTop: '1px', flexShrink: 0 }}>{item.icon}</span>
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>{item.text}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <Link to={`/track/${ticketId}`} className="btn btn-primary btn-lg btn-full">
            Track Your Ticket
          </Link>
          <Link to="/complaint" className="btn btn-ghost btn-full" style={{ color: 'var(--on-surface-variant)' }}>
            Submit Another Complaint
          </Link>
        </div>
      </div>
    </div>
  );
}
