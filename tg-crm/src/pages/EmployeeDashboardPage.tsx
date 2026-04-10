import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { useAuth } from '../core/auth/AuthContext';
import type { TicketStatus, TicketWithDetails } from '../core/supabase/database.types';
import { STATUS_LABELS } from '../core/constants';
import { Ticket, ArrowRight, RefreshCw } from 'lucide-react';

type Filter = 'all' | TicketStatus;

function normalizeStatus(status: string): TicketStatus {
  if (status === 'in_progress') return 'assigned';
  if (status === 'parts_ordered') return 'parts_needed';
  if (status === 'cancelled') return 'resolved';
  if (status === 'new' || status === 'assigned' || status === 'parts_needed' || status === 'resolved') return status;
  return 'new';
}

export default function EmployeeDashboardPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee?.id) fetchTickets();
  }, [employee]);

  async function fetchTickets() {
    if (!employee?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, customers(*), employees!assigned_to(id, name)')
        .eq('assigned_to', employee.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTickets((data ?? []) as unknown as TicketWithDetails[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter((ticket) => normalizeStatus(ticket.status) === filter);

  const kpis = [
    { label: 'Open Tickets', value: tickets.filter((ticket) => ['new', 'assigned'].includes(normalizeStatus(ticket.status))).length, accent: 'accent-blue', filter: 'assigned' as Filter },
    { label: 'Parts Needed', value: tickets.filter((ticket) => normalizeStatus(ticket.status) === 'parts_needed').length, accent: 'accent-red', filter: 'parts_needed' as Filter },
    { label: 'Resolved', value: tickets.filter((ticket) => normalizeStatus(ticket.status) === 'resolved').length, accent: 'accent-green', filter: 'resolved' as Filter },
  ];

  const firstName = employee?.name?.split(' ')[0] ?? 'there';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <AppLayout>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="text-headline-lg">{greeting}, {firstName}</h1>
            <p style={{ color: 'var(--on-surface-variant)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`kpi-card ${kpi.accent}`}
            onClick={() => setFilter(kpi.filter)}
            style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>
              {kpi.label}
            </p>
            <p className="text-display-md" style={{ lineHeight: 1 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="text-title-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Ticket size={18} /> My Active Jobs
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', flex: 1, justifyContent: 'flex-end' }}>
          {(['all', 'assigned', 'parts_needed', 'resolved'] as Filter[]).map((value) => (
            <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={{ minWidth: '86px', height: '36px' }}>
              {value === 'all' ? 'All' : STATUS_LABELS[value].label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Ticket Info</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>Loading jobs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                    No jobs found for "{filter}".
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => {
                  const status = normalizeStatus(ticket.status);
                  const statusMeta = STATUS_LABELS[status];
                  return (
                    <tr key={ticket.id}>
                      <td data-label="Ticket Info">
                        <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>#{ticket.ticket_number}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>Updated: {new Date(ticket.updated_at).toLocaleDateString()}</div>
                      </td>
                      <td data-label="Customer">
                        <div style={{ fontWeight: 600 }}>{ticket.customers?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>+91 {ticket.customers?.phone}</div>
                      </td>
                      <td data-label="Product">
                        <div style={{ fontSize: '0.9rem' }}>{ticket.product_type}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--outline)' }}>{ticket.product_model || 'Standard'}</div>
                      </td>
                      <td data-label="Status">
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      </td>
                      <td data-label="Action">
                        <Link to={`/ticket/${ticket.id}`} className="btn btn-secondary btn-sm btn-full-mobile" style={{ height: '36px' }}>
                          View Job <ArrowRight size={13} style={{ marginLeft: 4 }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
