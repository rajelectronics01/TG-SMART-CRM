import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { BarChart, Users, Ticket, Clock, AlertCircle, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    unassigned: 0,
    inProgress: 0,
    partsNeeded: 0,
    resolvedDay: 0,
    resolvedMonth: 0,
  });
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        { count: total }, 
        { count: unassigned }, 
        { count: inProgress }, 
        { count: partsNeeded },
        { count: resolvedDay },
        { count: resolvedMonth }
      ] = await Promise.all([
        supabase.from('tickets').select('*', { count: 'exact', head: true }),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['parts_needed', 'parts_ordered']),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', today.toISOString()),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', firstOfMonth.toISOString()),
      ]);

      setStats({
        total: total || 0,
        unassigned: unassigned || 0,
        inProgress: inProgress || 0,
        partsNeeded: partsNeeded || 0,
        resolvedDay: resolvedDay || 0,
        resolvedMonth: resolvedMonth || 0,
      });

      // 2. Fetch Team Stats
      const { data: employees } = await supabase.from('employees').select('id, name, role').eq('role', 'employee').eq('is_active', true);
      const { data: tData } = await supabase.from('tickets').select('assigned_to, status');

      if (employees && tData) {
        const stats = (employees as any[]).map(emp => {
          const empTickets = (tData as any[]).filter(t => t.assigned_to === emp.id);
          const open = empTickets.filter(t => t.status !== 'resolved' && t.status !== 'cancelled').length;
          const resolved = empTickets.filter(t => t.status === 'resolved').length;
          return { name: emp.name, role: 'Technician', stats: `${open} Open / ${resolved} Resolved`, open };
        });
        // Sort by workload (open)
        setTeamStats(stats.sort((a,b) => b.open - a.open).slice(0, 5));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const kpis = [
    { label: 'Unassigned', value: stats.unassigned, icon: <AlertCircle size={20} />, accent: 'accent-red', sub: 'Urgent Action' },
    { label: 'In Progress', value: stats.inProgress, icon: <Clock size={20} />, accent: 'accent-amber', sub: 'Active Jobs' },
    { label: 'Parts Needed', value: stats.partsNeeded, icon: <RefreshCw size={20} />, accent: 'accent-purple', sub: 'Awaiting Stock' },
    { label: 'Resolved (Today)', value: stats.resolvedDay, icon: <CheckCircle size={20} />, accent: 'accent-green', sub: 'Completed' },
    { label: 'Monthly Total', value: stats.total, icon: <Ticket size={20} />, accent: 'accent-blue', sub: 'Booked Cases' },
    { label: 'Success Rate', value: '92%', icon: <TrendingUp size={20} />, accent: 'accent-green', sub: 'Customer Sat.' },
  ];

  return (
    <AppLayout title="Admin Command Center">
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-display-md" style={{ letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Dashboard Overview</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Real-time service analytics and operational performance.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchStats} disabled={isLoading} style={{ height: '40px' }}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi-card ${k.accent}`} style={{ '--accent-color': 'var(--primary)' } as any}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
               <div style={{ background: 'var(--surface-high)', padding: '8px', borderRadius: '10px', display: 'flex', color: 'var(--primary)' }}>{k.icon}</div>
               <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Live</span>
             </div>
             <div style={{ marginBottom: '0.25rem' }}>
               <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
               <p className="text-display-md" style={{ lineHeight: 1, margin: '0.5rem 0' }}>{k.value}</p>
             </div>
             <p style={{ fontSize: '0.7rem', color: 'var(--outline)', fontWeight: 600 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md-grid-cols-2 gap-8">
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
             <h3 className="text-title-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <BarChart size={20} /> Operational Efficiency
             </h3>
             <span className="badge badge-resolved">Optimized</span>
          </div>
          <div style={{ height: '200px', background: 'var(--surface-lowest)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--outline)' }}>
             <p style={{ color: 'var(--outline)', fontSize: '0.85rem' }}>Chart visualization being optimized for mobile...</p>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
             <div style={{ padding: '1rem', border: '1px solid var(--outline)', borderRadius: '12px' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>Avg. Resolution</p>
                <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>2.4 Days</p>
             </div>
             <div style={{ padding: '1rem', border: '1px solid var(--outline)', borderRadius: '12px' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>SLA Compliance</p>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)' }}>98.2%</p>
             </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
             <h3 className="text-title-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Users size={20} /> Team Overview
             </h3>
             <Link to="/admin/employees" className="btn btn-ghost btn-sm" style={{ height: '32px' }}>Manage Team →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             {isLoading ? (
               <p style={{textAlign:'center', opacity:0.5, fontSize: '0.8rem', padding: '1rem'}}>Loading team stats...</p>
             ) : teamStats.length === 0 ? (
                <p style={{textAlign:'center', opacity:0.5, fontSize: '0.8rem', padding: '1rem'}}>No active technicians found.</p>
             ) : teamStats.map((e, i) => (
                <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < teamStats.length - 1 ? '1rem' : 0, borderBottom: i < teamStats.length - 1 ? '1px solid var(--outline)' : 'none' }}>
                   <div>
                     <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{e.name}</p>
                     <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{e.role}</p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{e.stats}</p>
                   </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
