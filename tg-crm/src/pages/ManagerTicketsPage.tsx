import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, MapPin, MessageCircle, RefreshCw, Search as SearchIcon, Share2, User } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import type { TicketStatus, TicketWithDetails } from '../core/supabase/database.types';
import { PORTAL_BASE_URL, STATUS_LABELS } from '../core/constants';

const STATUS_FILTERS: Array<{ value: 'all' | TicketStatus; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'parts_needed', label: 'Parts Needed' },
  { value: 'resolved', label: 'Resolved' },
];

function normalizeStatus(status: string | null | undefined): TicketStatus {
  if (!status) return 'new';
  if (status === 'in_progress') return 'assigned';
  if (status === 'parts_ordered') return 'parts_needed';
  if (status === 'cancelled') return 'resolved';
  if (status === 'new' || status === 'assigned' || status === 'parts_needed' || status === 'resolved') return status;
  return 'new';
}

export default function ManagerTicketsPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>((searchParams.get('status') as 'all' | TicketStatus) || 'all');

  useEffect(() => {
    if (employee?.id) fetchTickets();
  }, [employee?.id]);

  async function fetchTickets() {
    if (!employee?.id) return;
    setIsLoading(true);
    try {
      const { data: areas } = await (supabase as any).from('pincode_routes').select('pincode').eq('employee_id', employee.id);
      const pincodes = (areas || []).map((area: any) => area.pincode);

      if (pincodes.length === 0) {
        setTickets([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('tickets')
        .select('*, customers!inner (*), employees!assigned_to (id, name, phone), manager:manager_id (id, name)')
        .in('customers.pincode', pincodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as TicketWithDetails[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleShare(ticket: TicketWithDetails) {
    const trackUrl = `${PORTAL_BASE_URL}/track/${ticket.ticket_number}`;
    const shareText = `Ticket ${ticket.ticket_number} • ${ticket.customers?.name || 'Customer'} • ${trackUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: `Ticket ${ticket.ticket_number}`, text: shareText, url: trackUrl });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Ticket share link copied.');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  function handleCustomerWhatsApp(ticket: TicketWithDetails) {
    const phone = (ticket.customers?.phone || '').replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      alert('Customer number missing for WhatsApp share.');
      return;
    }

    const msg = `Dear ${ticket.customers?.name || 'Customer'}, your ticket ${ticket.ticket_number} is currently ${STATUS_LABELS[normalizeStatus(ticket.status)].label}. Track here: ${PORTAL_BASE_URL}/track/${ticket.ticket_number}`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  const filteredTickets = tickets.filter((ticket) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      (ticket.ticket_number || '').toLowerCase().includes(query) ||
      (ticket.customers?.name || '').toLowerCase().includes(query) ||
      (ticket.customers?.phone || '').includes(query);

    const normalizedStatus = normalizeStatus(ticket.status);
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout title="Regional Area Tickets">
      <div className="container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
            <input
              type="text"
              placeholder="Search ticket, customer, phone..."
              className="input"
              style={{ paddingLeft: '40px', height: '44px', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select className="select" style={{ width: '180px', height: '44px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}>
            {STATUS_FILTERS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <button onClick={fetchTickets} className="btn btn-outline" style={{ height: '44px' }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="loading-state">Syncing regional data...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">No tickets found in your area matching filters.</div>
        ) : (
          <div className="ticket-list">
            {filteredTickets.map((ticket) => {
              const status = normalizeStatus(ticket.status);
              const statusMeta = STATUS_LABELS[status];
              return (
                <div key={ticket.id} className="ticket-row">
                  <div className="customer-col">
                    <div style={{ fontWeight: 700 }}>{ticket.customers?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>+91 {ticket.customers?.phone || 'N/A'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={12} /> {ticket.customers?.pincode || 'N/A'}
                    </div>
                  </div>

                  <div className="id-col">
                    <span className="ticket-tag">#{ticket.ticket_number || '---'}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '3px' }}>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '---'}</span>
                  </div>

                  <div className="product-col">
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ticket.product_brand || ''} {ticket.product_type || ''}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{ticket.product_model || ''}</div>
                  </div>

                  <div className="assign-col">
                    {ticket.employees ? (
                      <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={14} /> {ticket.employees.name || 'Unknown'}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--error)', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} /> Unassigned
                      </div>
                    )}
                  </div>

                  <div className="status-col">
                    <span className={statusMeta.className}>{statusMeta.label}</span>
                  </div>

                  <div className="actions-col">
                    <button className="btn btn-secondary btn-sm" style={{ height: '34px' }} onClick={() => handleShare(ticket)}>
                      <Share2 size={13} /> Share
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ height: '34px' }} onClick={() => handleCustomerWhatsApp(ticket)}>
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                    <Link to={`/manager/tickets/${ticket.id}`} className="btn btn-secondary btn-sm" style={{ height: '34px' }}>
                      Open <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .ticket-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .ticket-row {
          display: grid;
          grid-template-columns: 1.4fr 120px 1fr 1fr 130px 1.4fr;
          gap: 1rem;
          background: white;
          padding: 1rem 1.1rem;
          border-radius: 14px;
          align-items: center;
          border: 1px solid var(--outline);
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .ticket-tag {
          font-family: 'JetBrains Mono', monospace;
          background: #0f172a;
          color: white;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .id-col { display: flex; flex-direction: column; }
        .actions-col { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end; }

        @media (max-width: 1024px) {
          .ticket-row {
            grid-template-columns: 1fr;
            gap: 0.7rem;
            padding: 0.95rem;
          }
          .actions-col { justify-content: flex-start; }
        }
      `}</style>
    </AppLayout>
  );
}
