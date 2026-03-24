import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import type { TicketWithDetails } from '../core/supabase/database.types';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, MapPin, Search as SearchIcon, RefreshCw, User } from 'lucide-react';

export default function ManagerTicketsPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');

  useEffect(() => {
    if (employee?.id) fetchTickets();
  }, [employee]);

  async function fetchTickets() {
    setIsLoading(true);
    try {
      // 1. Get areas assigned to this manager
      const { data: areas } = await (supabase as any).from('pincode_routes').select('pincode').eq('employee_id', employee!.id);
      const pincodes = (areas || []).map((a: any) => a.pincode);

      // 2. Fetch tickets for these areas
      let ticketData: any[] = [];
      if (pincodes.length > 0) {
        const { data, error } = await (supabase as any)
          .from('tickets')
          .select(`
            *,
            customers!inner (*),
            employees!assigned_to (id, name),
            manager:manager_id (id, name)
          `)
          .in('customers.pincode', pincodes)
          .order('created_at', { ascending: false });

        if (error) throw error;
        ticketData = data || [];
      }
      setTickets(ticketData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = (t.ticket_number || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (t.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (t.customers?.phone || '').includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout title="Regional Area Tickets">
      <div className="container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
           <div className="search-box" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
              <input 
                type="text" 
                placeholder="Search ticket #, name, phone..." 
                className="input" 
                style={{ paddingLeft: '40px', height: '44px', width: '100%' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           
           <select 
             className="select" 
             style={{ width: '180px', height: '44px' }}
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value)}
           >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
           </select>

           <button onClick={fetchTickets} className="btn btn-outline" style={{ height: '44px' }}>
              <RefreshCw size={16} />
           </button>
        </div>

        {isLoading ? (
          <div className="loading-state">Syncing regional data...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">No tickets found in your area matching these filters.</div>
        ) : (
          <div className="ticket-list">
              {(filteredTickets || []).map(ticket => (
               <Link key={ticket?.id} to={`/manager/tickets/${ticket?.id}`} className="ticket-row">
                  <div className="id-col">
                    <span className="ticket-tag">#{ticket?.ticket_number || '---'}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>
                      {ticket?.created_at ? new Date(ticket.created_at).toLocaleDateString() : '---'}
                    </span>
                  </div>

                  <div className="customer-col">
                    <div style={{ fontWeight: 700 }}>{ticket?.customers?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                       <MapPin size={12} /> {ticket?.customers?.pincode || 'N/A'}
                    </div>
                  </div>

                  <div className="product-col">
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{ticket?.product_brand || ''} {ticket?.product_type || ''}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{ticket?.product_model || ''}</div>
                  </div>

                  <div className="assign-col">
                     {ticket?.employees ? (
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
                    <span className={`status-pill ${ticket?.status || 'unknown'}`}>{ticket?.status || 'Unknown'}</span>
                  </div>

                  <ChevronRight size={20} style={{ opacity: 0.2 }} />
               </Link>
              ))}
          </div>
        )}

      </div>

      <style>{`
        .ticket-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .ticket-row {
          display: grid;
          grid-template-columns: 100px 1.5fr 1fr 1fr 120px 40px;
          gap: 1.5rem;
          background: white;
          padding: 1.25rem 1.5rem;
          border-radius: 16px;
          align-items: center;
          text-decoration: none;
          color: inherit;
          border: 1px solid var(--outline);
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .ticket-row:hover {
          transform: translateX(4px);
          border-color: var(--primary);
          box-shadow: 0 8px 20px rgba(0,0,0,0.06);
          background: var(--surface-low);
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
        .status-pill {
          font-size: 0.7rem;
          padding: 4px 12px;
          border-radius: 99px;
          font-weight: 800;
          text-align: center;
          text-transform: uppercase;
        }
        .status-pill.pending { background: #fee2e2; color: #b91c1c; }
        .status-pill.in_progress { background: #dbeafe; color: #1e40af; }
        .status-pill.resolved { background: #dcfce7; color: #15803d; }

        @media (max-width: 1024px) {
           .ticket-row { 
             grid-template-columns: 1fr 1fr; 
             gap: 1rem;
             padding: 1rem;
           }
           .product-col, .id-col { display: none; }
           .assign-col, .status-col { order: 3; }
        }
      `}</style>
    </AppLayout>
  );
}
