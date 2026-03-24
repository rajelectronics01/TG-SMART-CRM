import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../core/supabase/client';
import type { Ticket, Customer } from '../core/supabase/database.types';
import { Search, CheckCircle, Clock, AlertCircle, User, ArrowRight } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:           { label: 'New',           className: 'badge badge-new' },
  assigned:      { label: 'Assigned',      className: 'badge badge-assigned' },
  in_progress:   { label: 'In Progress',   className: 'badge badge-in-progress' },
  parts_needed:  { label: 'Parts Needed',  className: 'badge badge-parts-needed' },
  parts_ordered: { label: 'Parts Ordered', className: 'badge badge-parts-ordered' },
  resolved:      { label: 'Resolved',      className: 'badge badge-resolved' },
  cancelled:     { label: 'Cancelled',     className: 'badge badge-cancelled' },
};

const ALL_STATUSES = ['new','assigned','in_progress','parts_needed','parts_ordered','resolved','cancelled'];

export default function TrackTicketPage() {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState(ticketId ?? '');
  const [ticket, setTicket] = useState<(Ticket & { customers: Customer }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (ticketId) fetchTicket(ticketId);
  }, [ticketId]);

  async function fetchTicket(id: string) {
    setIsLoading(true); setNotFound(false); setTicket(null);
    try {
      let result = null;
      
      const cleanId = id.trim().toUpperCase();
      
      // Try fetching by Ticket Number first
      result = await supabase
        .from('tickets')
        .select('*, customers(*)')
        .ilike('ticket_number', cleanId)
        .limit(1)
        .maybeSingle();

      // If not found, try by phone number
      if (!result.data) {
        result = await supabase
          .from('tickets')
          .select('*, customers!inner(*)')
          .eq('customers.phone', cleanId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      }

      if (result.error) {
        console.error('Track Ticket Error:', result.error.message);
        setNotFound(true);
      } else if (!result.data) {
        setNotFound(true);
      } else {
        setTicket(result.data as unknown as (Ticket & { customers: Customer }));
      }
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/track/${search.trim()}`);
      fetchTicket(search.trim());
    }
  }

  const currentStepIndex = ticket ? ALL_STATUSES.indexOf(ticket.status) : -1;

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
          <a href="/complaint" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '99px', transition: 'all 0.2s' }}>
            New Complaint <ArrowRight size={14} />
          </a>
          <button 
            onClick={() => navigate('/login')}
            style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '99px', transition: 'all 0.2s' }}
          >
            <User size={14} /> Login
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <h1 className="text-headline-lg" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Track Your Ticket</h1>
        <p style={{ textAlign: 'center', color: 'var(--on-surface-variant)', marginBottom: '2rem' }}>
          Enter your Ticket ID or registered mobile number
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)' }} />
            <input className="input" style={{ paddingLeft: '2.75rem' }}
              placeholder="TKT-20260322-0042 or mobile number..."
              value={search} onChange={(e) => setSearch(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {notFound && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
            <AlertCircle size={40} style={{ margin: '0 auto 1rem', color: 'var(--error)' }} />
            <p>No ticket found. Please check your Ticket ID or mobile number.</p>
          </div>
        )}

        {ticket && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--outline)', marginBottom: '0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ticket ID</p>
                <h2 style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: '#000' }}>{ticket.ticket_number}</h2>
              </div>
              <span className={STATUS_LABELS[ticket.status]?.className ?? 'badge'}>
                {STATUS_LABELS[ticket.status]?.label ?? ticket.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Customer', value: ticket.customers?.name },
                { label: 'Product', value: `${ticket.product_type} – ${ticket.product_brand}` },
                { label: 'Raised On', value: new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Last Updated', value: new Date(ticket.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', padding: '0.875rem' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginBottom: '0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#000' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Status Progress */}
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--outline)', marginBottom: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Status Progress</p>
              <div style={{ display: 'flex', gap: '0', alignItems: 'center', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {ALL_STATUSES.filter(s => s !== 'cancelled').map((s, i, arr) => {
                  const isDone = currentStepIndex > i;
                  const isCurrent = currentStepIndex === i;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isDone ? '#4ade80' : isCurrent ? '#000' : 'rgba(0,0,0,0.05)',
                          flexShrink: 0, transition: 'all 0.3s',
                        }}>
                          {isDone ? <CheckCircle size={14} style={{ color: '#fff' }} /> : isCurrent ? <Clock size={12} style={{ color: '#fff' }} /> : null}
                        </div>
                        <span style={{ fontSize: '0.6rem', color: isDone || isCurrent ? 'var(--on-surface)' : 'var(--outline)', textAlign: 'center', whiteSpace: 'nowrap', textTransform: 'capitalize', letterSpacing: '0.02em' }}>
                          {STATUS_LABELS[s]?.label}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ flex: 1, height: '2px', background: isDone ? '#4ade80' : 'rgba(0,0,0,0.1)', margin: '0 0.25rem', marginBottom: '1.2rem' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Subtle Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem', marginTop: 'auto' }}>
        <a href="/login" style={{ color: 'var(--outline)', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.05em' }}>
          STAFF PORTAL
        </a>
      </footer>
    </div>
  );
}
