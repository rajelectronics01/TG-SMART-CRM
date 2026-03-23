import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { Download, Clock, AlertCircle } from 'lucide-react';

type ReportTicket = {
  id: string;
  ticket_number: string;
  product_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  customers: { name: string; phone: string; address: string; pincode: string } | null;
  employees: { name: string } | null;
};

export default function AdminReportsPage() {
  const [tickets, setTickets] = useState<ReportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchReportData();
  }, [dateRange, statusFilter]);

  async function fetchReportData() {
    setIsLoading(true);
    try {
      let query = (supabase as any)
        .from('tickets')
        .select(`
          *,
          customers(*),
          employees!assigned_to(name)
        `)
        .gte('created_at', dateRange.start + 'T00:00:00Z')
        .lte('created_at', dateRange.end + 'T23:59:59Z')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportCSV() {
    if (tickets.length === 0) return;

    const headers = ['Ticket #', 'Date', 'Customer', 'Phone', 'Address', 'Pincode', 'Product', 'Status', 'Technician', 'Service Notes'];
    const rows = tickets.map(t => [
      t.ticket_number,
      new Date(t.created_at).toLocaleDateString(),
      t.customers?.name || 'Unknown',
      t.customers?.phone || '',
      t.customers?.address || '',
      t.customers?.pincode || '',
      t.product_type,
      t.status,
      t.employees?.name || 'Unassigned',
      (t as any).service_notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TG_CRM_Report_${dateRange.start}_to_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getSLAStatus(ticket: ReportTicket) {
    if (ticket.status === 'resolved' || ticket.status === 'cancelled') return 'compliant';
    const createdDate = new Date(ticket.created_at);
    const diffHours = (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    return diffHours > 48 ? 'delayed' : 'within-sla';
  }

  return (
    <AppLayout title="Reports & Export Engine">
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
           <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
             <div className="input-field" style={{ width: '200px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px', display: 'block' }}>From Date</label>
                <input type="date" className="input" style={{ height: '44px' }} value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
             </div>
             <div className="input-field" style={{ width: '200px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px', display: 'block' }}>To Date</label>
                <input type="date" className="input" style={{ height: '44px' }} value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
             </div>
             <div className="input-field" style={{ width: '160px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px', display: 'block' }}>Status</label>
                <select className="select" style={{ height: '44px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                   <option value="all">All Statuses</option>
                   <option value="new">New</option>
                   <option value="assigned">Assigned</option>
                   <option value="in_progress">In Progress</option>
                   <option value="resolved">Resolved</option>
                </select>
             </div>
           </div>
           
           <button onClick={handleExportCSV} disabled={isLoading || tickets.length === 0} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '44px' }}>
              <Download size={18} /> Export CSV
           </button>
        </div>

        <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
           <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
              <p style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Filtered Tickets</p>
              <h2 style={{ fontSize: '1.5rem', margin: '0.25rem 0' }}>{tickets.length}</h2>
           </div>
           <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
              <p style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Delayed (SLA Violation)</p>
              <h2 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: '#ef4444' }}>
                {tickets.filter(t => getSLAStatus(t) === 'delayed').length}
              </h2>
           </div>
        </div>

        <div className="glass-card" style={{ overflow: 'hidden' }}>
           <div style={{ overflowX: 'auto' }}>
              <table className="data-table responsive-table">
                 <thead>
                    <tr>
                       <th>Ticket & Date</th>
                       <th>Customer Data</th>
                       <th>Status</th>
                       <th>SLA Health</th>
                       <th>Technician</th>
                    </tr>
                 </thead>
                 <tbody>
                    {isLoading ? (
                      <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center' }}><Clock className="animate-spin" size={32} style={{ margin: '0 auto', opacity: 0.1 }} /></td></tr>
                    ) : tickets.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>No tickets found in this range.</td></tr>
                    ) : (
                      tickets.map(t => {
                        const sla = getSLAStatus(t);
                        return (
                          <tr key={t.id} style={sla === 'delayed' ? { background: 'rgba(239, 68, 68, 0.05)' } : {}}>
                             <td>
                                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>#{t.ticket_number}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{new Date(t.created_at).toLocaleDateString()}</div>
                             </td>
                             <td>
                                <div style={{ fontWeight: 600 }}>{t.customers?.name || '---'}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.customers?.address || ''}</div>
                             </td>
                             <td>
                                <span className={`badge badge-${t.status}`}>
                                   {t.status}
                                </span>
                             </td>
                             <td>
                                {sla === 'delayed' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                                     <AlertCircle size={14} /> Delayed (&gt;48h)
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.75rem' }}>Within SLA</div>
                                )}
                             </td>
                             <td>{t.employees?.name || <i style={{ opacity: 0.5 }}>Unassigned</i>}</td>
                          </tr>
                        );
                      })
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </AppLayout>
  );
}
