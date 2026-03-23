import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { useAuth } from '../core/auth/AuthContext';
import type { TicketWithDetails } from '../core/supabase/database.types';
import { Ticket, ArrowRight, RefreshCw } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  new: 'badge badge-new', assigned: 'badge badge-assigned',
  in_progress: 'badge badge-in-progress', parts_needed: 'badge badge-parts-needed',
  parts_ordered: 'badge badge-parts-ordered', resolved: 'badge badge-resolved',
  cancelled: 'badge badge-cancelled',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New', assigned: 'Assigned', in_progress: 'In Progress',
  parts_needed: 'Parts Needed', parts_ordered: 'Parts Ordered',
  resolved: 'Resolved', cancelled: 'Cancelled',
};

type Filter = 'all' | 'new' | 'assigned' | 'in_progress' | 'parts_needed';

export default function EmployeeDashboardPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee?.id) fetchTickets();
  }, [employee]);

  async function fetchTickets() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, customers(*), employees!assigned_to(id, name)')
        .eq('assigned_to', employee!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTickets((data ?? []) as unknown as TicketWithDetails[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  const kpis = [
    { label: 'Open Tickets', value: tickets.filter((t) => t.status === 'new' || t.status === 'assigned').length, accent: 'accent-blue' },
    { label: 'In Progress', value: tickets.filter((t) => t.status === 'in_progress').length, accent: 'accent-amber' },
    { label: 'Parts Needed', value: tickets.filter((t) => t.status === 'parts_needed' || t.status === 'parts_ordered').length, accent: 'accent-red' },
    { label: 'Resolved', value: tickets.filter((t) => t.status === 'resolved').length, accent: 'accent-green' },
  ];

  const firstName = employee?.name?.split(' ')[0] ?? 'there';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <AppLayout>
      {/* Header */}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="text-headline-lg">{greeting}, {firstName} 👋</h1>
            <p style={{ color: 'var(--on-surface-variant)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`kpi-card ${kpi.accent}`}>
            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700 }}>
              {kpi.label}
            </p>
            <p className="text-display-md" style={{ lineHeight: 1 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Actions / Filter */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="text-title-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Ticket size={18} /> My Active Jobs
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', flex: 1, justifyContent: 'flex-end' }}>
          {(['all', 'assigned', 'in_progress', 'parts_needed'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              style={{ minWidth: '80px', height: '36px' }}>
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
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
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>Loading Jobs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                    No jobs found matching "{filter}".
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => (
                  <tr key={ticket.id}>
                    <td data-label="Ticket Info">
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>#{ticket.ticket_number}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                        Updated: {new Date(ticket.updated_at).toLocaleDateString()}
                      </div>
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
                      <span className={STATUS_BADGE[ticket.status] ?? 'badge'}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
                    </td>
                    <td data-label="Action">
                      <Link to={`/ticket/${ticket.id}`} className="btn btn-secondary btn-sm btn-full-mobile" style={{ height: '36px' }}>
                        View Job <ArrowRight size={13} style={{ marginLeft: 4 }} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
