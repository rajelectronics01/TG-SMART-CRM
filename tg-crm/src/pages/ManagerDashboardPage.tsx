import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import type { TicketWithDetails } from '../core/supabase/database.types';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle, ChevronRight, MapPin, Users } from 'lucide-react';

export default function ManagerDashboardPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [assignedTechnicians, setAssignedTechnicians] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({ pending: 0, inProgress: 0, completed: 0 });

  useEffect(() => {
    if (employee?.id) fetchManagerData();
  }, [employee]);

  async function fetchManagerData() {
    try {
      // 1. Get areas assigned to this manager
      const { data: areas } = await (supabase as any).from('pincode_routes').select('pincode').eq('employee_id', employee!.id);
      const pincodes = (areas || []).map((a: any) => a.pincode);

      // 2. Fetch technicians under this manager
      const { data: techs } = await (supabase as any).from('employees').select('id, name, role, is_active').eq('parent_id', employee!.id);
      setAssignedTechnicians(techs || []);

      // 3. Fetch tickets for these areas
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

      const sorted = ticketData;
      setTickets(sorted as unknown as TicketWithDetails[]);

      setMetrics({
        pending: (sorted || []).filter(t => t?.status === 'pending' || t?.status === 'new').length,
        inProgress: (sorted || []).filter(t => t?.status === 'in_progress').length,
        completed: (sorted || []).filter(t => t?.status === 'completed' || t?.status === 'resolved').length
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppLayout title="Area Overview">
      <div className="container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="text-display-sm" style={{ marginBottom: '0.25rem' }}>Welcome, {employee?.name}</h2>
          <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Managing your assigned regional areas and technicians.</p>
        </div>

        <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
          <Link to="/manager/tickets?status=new" className="kpi-link">
            <div className="kpi-card accent-amber">
              <div className="kpi-label"><Clock size={16} /> Pending in Area</div>
              <div className="kpi-value">{metrics.pending}</div>
            </div>
          </Link>
          <Link to="/manager/tickets?status=in_progress" className="kpi-link">
            <div className="kpi-card accent-blue">
               <div className="kpi-label"><AlertCircle size={16} /> In Progress</div>
               <div className="kpi-value">{metrics.inProgress}</div>
            </div>
          </Link>
          <Link to="/manager/tickets?status=resolved" className="kpi-link">
            <div className="kpi-card accent-green">
               <div className="kpi-label"><CheckCircle size={16} /> Completed</div>
               <div className="kpi-value">{metrics.completed}</div>
            </div>
          </Link>
          <Link to="/manager/technicians" className="kpi-link">
            <div className="kpi-card accent-purple">
               <div className="kpi-label"><Users size={16} /> My Technicians</div>
               <div className="kpi-value">{assignedTechnicians.length}</div>
            </div>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
          
          <div className="glass-card" style={{ padding: '1.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="text-title-md">Recent Regional Tickets</h3>
                <Link to="/manager/tickets" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>View All</Link>
             </div>

             {isLoading ? (
               <div className="loading-state">Loading area data...</div>
             ) : tickets.length === 0 ? (
               <div className="empty-state">No tickets found in your assigned areas.</div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(tickets || []).slice(0, 5).map(ticket => (
                    <Link key={ticket?.id} to={`/manager/tickets/${ticket?.id}`} className="ticket-list-item-minimal">
                       <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                             <span className="ticket-id-tag">#{ticket?.ticket_number || '---'}</span>
                             <span className={`status-pill ${ticket?.status || 'unknown'}`}>{ticket?.status || 'Unknown'}</span>
                          </div>
                          <div style={{ marginTop: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>{ticket.customers?.name || 'Unknown Customer'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                             <MapPin size={10} /> {ticket.customers?.pincode || 'No Pincode'}
                          </div>
                       </div>
                       <ChevronRight size={16} style={{ opacity: 0.3 }} />
                    </Link>
                  ))}
               </div>
             )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
             <h3 className="text-title-md" style={{ marginBottom: '1.25rem' }}>Available Technicians</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {assignedTechnicians.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>No technicians added under you.</p>
                ) : assignedTechnicians.map(tech => (
                  <div key={tech?.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-low)', borderRadius: '8px' }}>
                     <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.65rem' }}>{(tech?.name || 'U')[0]}</div>
                     <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tech?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--success)' }}>{tech?.is_active ? 'Online' : 'Offline'}</div>
                     </div>
                  </div>
                ))}
                <Link to="/manager/technicians" className="btn btn-outline" style={{ fontSize: '0.75rem', marginTop: '0.5rem', width: '100%' }}>Manage Team</Link>
             </div>
          </div>

        </div>

      </div>

      <style>{`
        .kpi-link { text-decoration: none; color: inherit; display: block; }
        .kpi-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
        .ticket-list-item-minimal {
          display: flex;
          align-items: center;
          padding: 1rem;
          background: var(--surface-low);
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .ticket-list-item-minimal:hover {
          background: white;
          border-color: var(--outline);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .ticket-id-tag {
          font-family: monospace;
          background: var(--surface-highest);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .status-pill {
          font-size: 0.65rem;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .status-pill.pending { background: #fef3c7; color: #92400e; }
        .status-pill.in_progress { background: #dbeafe; color: #1e40af; }
        .status-pill.resolved { background: #dcfce7; color: #166534; }
        
        @media (max-width: 768px) {
          .container { padding: 1rem !important; }
          div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppLayout>
  );
}
