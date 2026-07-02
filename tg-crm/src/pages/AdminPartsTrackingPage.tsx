import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Filter, RefreshCw, Search } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import type { Spare, SpareAction, SpareStatus } from '../core/supabase/database.types';

type SpareTrackingRow = Spare & {
  ticket: {
    id: string;
    ticket_number: string;
    product_type: string;
    status: string;
    customers: { name: string; phone: string } | null;
  } | null;
};

type EmployeeLite = {
  id: string;
  name: string;
};

const ACTION_FILTERS: Array<{ value: 'all' | SpareAction; label: string }> = [
  { value: 'all', label: 'All Actions' },
  { value: 'pending', label: 'Pending' },
  { value: 'installed', label: 'Installed' },
  { value: 'returned', label: 'Returned' },
  { value: 'unused', label: 'Unused' },
];

const STATUS_FILTERS: Array<{ value: 'all' | SpareStatus; label: string }> = [
  { value: 'all', label: 'All Part Status' },
  { value: 'needed', label: 'Needed' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'delivered', label: 'Delivered' },
];

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPartsTrackingPage() {
  const [rows, setRows] = useState<SpareTrackingRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | SpareAction>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SpareStatus>('all');
  const [technicianFilter, setTechnicianFilter] = useState<'all' | string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchPartsTracking();
  }, [actionFilter, statusFilter, technicianFilter, dateFrom, dateTo]);

  async function fetchEmployees() {
    const { data, error } = await (supabase as any)
      .from('employees')
      .select('id, name')
      .order('name', { ascending: true });

    if (!error) {
      setEmployees((data || []) as EmployeeLite[]);
    }
  }

  async function fetchPartsTracking() {
    setIsLoading(true);
    try {
      let query = (supabase as any)
        .from('spares')
        .select(`
          *,
          ticket:tickets!inner(
            id,
            ticket_number,
            product_type,
            status,
            customers(name, phone)
          )
        `)
        .order('action_updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (actionFilter !== 'all') {
        query = query.eq('action_status', actionFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (technicianFilter !== 'all') {
        query = query.eq('assigned_to', technicianFilter);
      }

      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
      }

      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59Z`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as SpareTrackingRow[]);
    } catch (err) {
      console.error('Error fetching parts tracking:', err);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  const employeeById = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((employee) => map.set(employee.id, employee.name));
    return map;
  }, [employees]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;

    const term = searchTerm.toLowerCase();
    return rows.filter((row) => {
      const ticketNumber = row.ticket?.ticket_number?.toLowerCase() || '';
      const customerName = row.ticket?.customers?.name?.toLowerCase() || '';
      const customerPhone = row.ticket?.customers?.phone || '';
      const partName = row.part_name.toLowerCase();
      const partNumber = (row.part_number || '').toLowerCase();
      const actionNote = (row.action_note || '').toLowerCase();
      const assignedName = row.assigned_to ? (employeeById.get(row.assigned_to) || '').toLowerCase() : '';
      const addedByName = employeeById.get(row.added_by)?.toLowerCase() || '';

      return (
        ticketNumber.includes(term) ||
        customerName.includes(term) ||
        customerPhone.includes(term) ||
        partName.includes(term) ||
        partNumber.includes(term) ||
        actionNote.includes(term) ||
        assignedName.includes(term) ||
        addedByName.includes(term)
      );
    });
  }, [rows, searchTerm, employeeById]);

  return (
    <AppLayout title="Parts Tracking Console">
      <div style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.3fr) repeat(5, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>Search</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  className="input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ticket, customer, part, technician..."
                  style={{ paddingLeft: '34px', height: '42px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>
                <Filter size={12} style={{ marginRight: 4 }} /> Action
              </label>
              <select className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as 'all' | SpareAction)} style={{ height: '42px' }}>
                {ACTION_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>Part Status</label>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | SpareStatus)} style={{ height: '42px' }}>
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>Technician</label>
              <select className="select" value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} style={{ height: '42px' }}>
                <option value="all">All Technicians</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>From Date</label>
              <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ height: '42px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px', display: 'block' }}>To Date</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ height: '42px' }} />
                <button type="button" className="btn btn-secondary btn-sm" style={{ height: '42px', minWidth: '42px' }} onClick={fetchPartsTracking}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Part Details</th>
                  <th>Taken By</th>
                  <th>Added By</th>
                  <th>Part Status</th>
                  <th>Action</th>
                  <th>Timeline</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                      <Clock size={30} className="animate-spin" style={{ margin: '0 auto', opacity: 0.25 }} />
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      No parts activity found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Ticket">
                        {row.ticket ? (
                          <Link to={`/admin/tickets/${row.ticket.id}`} style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>
                            #{row.ticket.ticket_number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Customer">
                        <div style={{ fontWeight: 600 }}>{row.ticket?.customers?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>+91 {row.ticket?.customers?.phone || 'N/A'}</div>
                      </td>
                      <td data-label="Part Details">
                        <div style={{ fontWeight: 600 }}>{row.part_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                          Qty: {row.quantity} {row.part_number ? `• PN: ${row.part_number}` : ''}
                        </div>
                      </td>
                      <td data-label="Taken By">{row.assigned_to ? (employeeById.get(row.assigned_to) || 'Unknown technician') : 'Unassigned'}</td>
                      <td data-label="Added By">{employeeById.get(row.added_by) || 'Unknown'}</td>
                      <td data-label="Part Status">
                        <span className="badge" style={{ textTransform: 'capitalize' }}>{row.status}</span>
                      </td>
                      <td data-label="Action">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span className="badge" style={{ textTransform: 'capitalize' }}>{row.action_status}</span>
                          {row.action_note && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', maxWidth: '200px', whiteSpace: 'pre-wrap' }}>
                              {row.action_note}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Timeline">
                        <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>
                          <div><strong>Requested:</strong> {formatDateTime(row.created_at)}</div>
                          <div><strong>Last action:</strong> {formatDateTime(row.action_updated_at)}</div>
                        </div>
                      </td>
                      <td data-label="Open">
                        {row.ticket ? (
                          <Link to={`/admin/tickets/${row.ticket.id}`} className="btn btn-secondary btn-sm" style={{ height: '34px' }}>
                            Open
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
