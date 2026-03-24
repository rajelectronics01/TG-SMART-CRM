import { useState, useEffect } from 'react';
import { supabase } from '../core/supabase/client';
import type { Ticket, Customer, Employee } from '../core/supabase/database.types';
import AppLayout from '../components/AppLayout';
import { Search, Filter, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

type FullTicket = Ticket & {
  customers: Customer | null;
  employees?: Employee | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:           { label: 'New',           className: 'badge badge-new' },
  assigned:      { label: 'Assigned',      className: 'badge badge-assigned' },
  in_progress:   { label: 'In Progress',   className: 'badge badge-in-progress' },
  parts_needed:  { label: 'Parts Needed',  className: 'badge badge-parts-needed' },
  parts_ordered: { label: 'Parts Ordered', className: 'badge badge-parts-ordered' },
  resolved:      { label: 'Resolved',      className: 'badge badge-resolved' },
  cancelled:     { label: 'Cancelled',     className: 'badge badge-cancelled' },
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<FullTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all');

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  async function fetchTickets() {
    setIsLoading(true);
    let query = supabase
      .from('tickets')
      .select('*, customers(*), employees!assigned_to(*)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching tickets:', error);
    } else {
      setTickets((data as unknown as FullTicket[]) || []);
    }
    setIsLoading(false);
  }

  const filteredTickets = tickets.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const cust = t.customers;
    return (
      t.ticket_number.toLowerCase().includes(term) ||
      (cust?.name || '').toLowerCase().includes(term) ||
      (cust?.phone || '').includes(term) ||
      t.product_type.toLowerCase().includes(term)
    );
  });

  function formatTimeAgo(dateString: string) {
    const d = new Date(dateString);
    const ms = Date.now() - d.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  return (
    <AppLayout title="All Tickets Dashboard">

      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)', zIndex: 1 }} />
            <input
              type="text"
              className="input"
              placeholder="Search ID, customer, phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', height: '44px' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px' }}>
            <Filter size={16} style={{ color: 'var(--on-surface-variant)' }} />
            <select
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: '44px' }}
            >
              <option value="all">All Statuses</option>
              <option value="new">New (Unassigned)</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="parts_needed">Parts Needed</option>
              <option value="parts_ordered">Parts Ordered</option>
              <option value="resolved">Resolved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
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
                <th>Status & Tech</th>
                <th>Aging</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => (
                  <tr key={t.id}>
                    <td data-label="Ticket Info">
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>{t.ticket_number}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td data-label="Customer">
                      <div style={{ fontWeight: 600 }}>{t.customers?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>+91 {t.customers?.phone}</div>
                    </td>
                    <td data-label="Product">
                      <div style={{ fontWeight: 500 }}>{t.product_type}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--outline)' }}>{t.product_model || 'N/A'}</div>
                    </td>
                    <td data-label="Status & Tech">
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span className={STATUS_LABELS[t.status]?.className ?? 'badge'}>
                          {STATUS_LABELS[t.status]?.label ?? t.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                        {t.employees?.name || 'Unassigned'}
                      </div>
                    </td>
                    <td data-label="Aging">
                      <div style={{ fontSize: '0.8rem' }}>{formatTimeAgo(t.created_at)}</div>
                    </td>
                    <td data-label="Action">
                      <Link to={`/admin/tickets/${t.id}`} className="btn btn-secondary btn-sm btn-full-mobile" style={{ height: '36px' }}>
                        Manage
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
