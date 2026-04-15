import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Loader2, Share2 } from 'lucide-react';
import { supabase } from '../core/supabase/client';
import type { Ticket, Customer, Employee, TicketStatus } from '../core/supabase/database.types';
import { STATUS_LABELS } from '../core/constants';
import AppLayout from '../components/AppLayout';

type FullTicket = Ticket & {
  customers: Customer | null;
  employees?: Employee | null;
};

const STATUS_OPTIONS: Array<{ value: 'all' | TicketStatus; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New (Unassigned)' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'parts_needed', label: 'Parts Needed' },
  { value: 'resolved', label: 'Resolved' },
];

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

  async function handleShareTicket(ticket: FullTicket) {
    const ticketUrl = `${window.location.origin}/track/${ticket.ticket_number}`;
    const shareText = `Ticket ${ticket.ticket_number} • ${ticket.customers?.name || 'Customer'} • ${ticketUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ticket ${ticket.ticket_number}`,
          text: shareText,
          url: ticketUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Ticket share link copied.');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const customer = ticket.customers;
    return (
      ticket.ticket_number.toLowerCase().includes(term) ||
      (customer?.name || '').toLowerCase().includes(term) ||
      (customer?.phone || '').includes(term) ||
      ticket.product_type.toLowerCase().includes(term)
    );
  });

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const ms = Date.now() - date.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  function getRaisedBy(ticket: FullTicket) {
    if (ticket.complainant_type === 'dealer') {
      return `Dealer — ${ticket.dealer_name || 'Unknown dealer'}`;
    }
    return 'Customer';
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
              placeholder="Search ticket, customer, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', height: '44px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 220px' }}>
            <Filter size={16} style={{ color: 'var(--on-surface-variant)' }} />
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: '44px' }}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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
                filteredTickets.map((ticket) => {
                  const statusMeta = STATUS_LABELS[ticket.status as TicketStatus] || { label: ticket.status, className: 'badge' };
                  return (
                    <tr key={ticket.id}>
                      <td data-label="Ticket Info">
                        <Link
                          to={`/admin/tickets/${ticket.id}`}
                          style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem', textDecoration: 'none' }}
                        >
                          {ticket.ticket_number}
                        </Link>
                        <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{new Date(ticket.created_at).toLocaleDateString()}</div>
                      </td>
                      <td data-label="Customer">
                        <Link
                          to={`/admin/tickets/${ticket.id}`}
                          style={{ fontWeight: 600, color: 'var(--on-surface)', textDecoration: 'none' }}
                        >
                          {ticket.customers?.name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>+91 {ticket.customers?.phone}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--outline)' }}>Raised by: {getRaisedBy(ticket)}</div>
                      </td>
                      <td data-label="Product">
                        <div style={{ fontWeight: 500 }}>{ticket.product_type}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--outline)' }}>{ticket.product_model || 'N/A'}</div>
                      </td>
                      <td data-label="Status & Tech">
                        <div style={{ marginBottom: '0.25rem' }}>
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{ticket.employees?.name || 'Unassigned'}</div>
                      </td>
                      <td data-label="Aging">
                        <div style={{ fontSize: '0.8rem' }}>{formatTimeAgo(ticket.created_at)}</div>
                      </td>
                      <td data-label="Action">
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/admin/tickets/${ticket.id}`} className="btn btn-secondary btn-sm" style={{ height: '36px' }}>
                            Manage
                          </Link>
                          <button className="btn btn-secondary btn-sm" type="button" style={{ height: '36px' }} onClick={() => handleShareTicket(ticket)}>
                            <Share2 size={14} /> Share
                          </button>
                        </div>
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
