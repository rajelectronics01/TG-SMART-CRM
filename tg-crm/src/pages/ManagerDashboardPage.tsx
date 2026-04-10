import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ChevronRight, Clock, MapPin, PlusCircle, Users } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import type { TicketStatus, TicketWithDetails } from '../core/supabase/database.types';
import { STATUS_LABELS } from '../core/constants';

function normalizeStatus(status: string | null | undefined): TicketStatus {
  if (!status) return 'new';
  if (status === 'in_progress') return 'assigned';
  if (status === 'parts_ordered') return 'parts_needed';
  if (status === 'cancelled') return 'resolved';
  if (status === 'new' || status === 'assigned' || status === 'parts_needed' || status === 'resolved') return status;
  return 'new';
}

export default function ManagerDashboardPage() {
  const { employee } = useAuth();
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [assignedTechnicians, setAssignedTechnicians] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({ newCount: 0, assignedCount: 0, partsNeeded: 0, resolved: 0 });

  useEffect(() => {
    if (employee?.id) fetchManagerData();
  }, [employee?.id]);

  async function fetchManagerData() {
    if (!employee?.id) return;
    setIsLoading(true);

    try {
      const { data: areas } = await (supabase as any).from('pincode_routes').select('pincode').eq('employee_id', employee.id);
      const pincodes = (areas || []).map((area: any) => area.pincode);

      const { data: techs } = await (supabase as any)
        .from('employees')
        .select('id, name, role, is_active')
        .eq('parent_id', employee.id)
        .eq('role', 'employee');
      setAssignedTechnicians(techs || []);

      if (pincodes.length === 0) {
        setTickets([]);
        setMetrics({ newCount: 0, assignedCount: 0, partsNeeded: 0, resolved: 0 });
        return;
      }

      const { data, error } = await (supabase as any)
        .from('tickets')
        .select('*, customers!inner (*), employees!assigned_to (id, name), manager:manager_id (id, name)')
        .in('customers.pincode', pincodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const ticketData = (data || []) as TicketWithDetails[];
      setTickets(ticketData);

      setMetrics({
        newCount: ticketData.filter((ticket) => normalizeStatus(ticket.status) === 'new').length,
        assignedCount: ticketData.filter((ticket) => normalizeStatus(ticket.status) === 'assigned').length,
        partsNeeded: ticketData.filter((ticket) => normalizeStatus(ticket.status) === 'parts_needed').length,
        resolved: ticketData.filter((ticket) => normalizeStatus(ticket.status) === 'resolved').length,
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
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 className="text-display-sm" style={{ marginBottom: '0.25rem' }}>Welcome, {employee?.name}</h2>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Manage tickets and technicians in your assigned areas.</p>
          </div>
          <Link to="/manager/tickets/new" className="btn btn-primary" style={{ height: '44px' }}>
            <PlusCircle size={16} /> Create Ticket
          </Link>
        </div>

        <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
          <Link to="/manager/tickets?status=new" className="kpi-link">
            <div className="kpi-card accent-amber">
              <div className="kpi-label"><Clock size={16} /> New</div>
              <div className="kpi-value">{metrics.newCount}</div>
            </div>
          </Link>
          <Link to="/manager/tickets?status=assigned" className="kpi-link">
            <div className="kpi-card accent-blue">
              <div className="kpi-label"><AlertCircle size={16} /> Assigned</div>
              <div className="kpi-value">{metrics.assignedCount}</div>
            </div>
          </Link>
          <Link to="/manager/tickets?status=parts_needed" className="kpi-link">
            <div className="kpi-card accent-purple">
              <div className="kpi-label"><Users size={16} /> Parts Needed</div>
              <div className="kpi-value">{metrics.partsNeeded}</div>
            </div>
          </Link>
          <Link to="/manager/tickets?status=resolved" className="kpi-link">
            <div className="kpi-card accent-green">
              <div className="kpi-label"><CheckCircle size={16} /> Resolved</div>
              <div className="kpi-value">{metrics.resolved}</div>
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
                {tickets.slice(0, 5).map((ticket) => {
                  const status = normalizeStatus(ticket.status);
                  return (
                    <Link key={ticket.id} to={`/manager/tickets/${ticket.id}`} className="ticket-list-item-minimal">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="ticket-id-tag">#{ticket.ticket_number || '---'}</span>
                          <span className={STATUS_LABELS[status].className}>{STATUS_LABELS[status].label}</span>
                        </div>
                        <div style={{ marginTop: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>{ticket.customers?.name || 'Unknown Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={10} /> {ticket.customers?.pincode || 'No Pincode'}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ opacity: 0.3 }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="text-title-md" style={{ marginBottom: '1.25rem' }}>Available Technicians</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {assignedTechnicians.length === 0 ? (
                <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>No technicians assigned under you.</p>
              ) : (
                assignedTechnicians.map((tech) => (
                  <div key={tech.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--surface-low)', borderRadius: '8px' }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.65rem' }}>{(tech.name || 'U')[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tech.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.65rem', color: tech.is_active ? 'var(--success)' : 'var(--on-surface-variant)' }}>{tech.is_active ? 'Active' : 'Inactive'}</div>
                    </div>
                  </div>
                ))
              )}
              <Link to="/manager/technicians" className="btn btn-outline" style={{ fontSize: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
                Manage Team
              </Link>
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

        @media (max-width: 768px) {
          .container { padding: 1rem !important; }
          div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppLayout>
  );
}
