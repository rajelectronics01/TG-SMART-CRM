import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { BarChart, Users, Ticket, Clock, AlertCircle, CheckCircle, TrendingUp, RefreshCw, Zap, Award } from 'lucide-react';
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
  const [productStats, setProductStats] = useState<any[]>([]);
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
        { count: resolvedMonth },
        { data: tickets }
      ] = await Promise.all([
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }),
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }).in('status', ['parts_needed', 'parts_ordered']),
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', today.toISOString()),
        (supabase as any).from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', firstOfMonth.toISOString()),
        (supabase as any).from('tickets').select('product_type, status'),
      ]);

      setStats({
        total: total || 0,
        unassigned: unassigned || 0,
        inProgress: inProgress || 0,
        partsNeeded: partsNeeded || 0,
        resolvedDay: resolvedDay || 0,
        resolvedMonth: resolvedMonth || 0,
      });

      // 1. Process Product Stats (Chart)
      if (tickets) {
        const productMap: Record<string, number> = {};
        tickets.forEach((t: any) => {
          const type = t.product_type || 'Other';
          productMap[type] = (productMap[type] || 0) + 1;
        });
        const sortedProducts = Object.entries(productMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        setProductStats(sortedProducts);
      }

      // 2. Fetch Team Stats
      const { data: employees } = await (supabase as any).from('employees').select('id, name, role').eq('role', 'employee').eq('is_active', true);
      const { data: tData } = await (supabase as any).from('tickets').select('assigned_to, status');

      if (employees && tData) {
        const statsArray = (employees as any[]).map(emp => {
          const empTickets = (tData as any[]).filter(t => t.assigned_to === emp.id);
          const open = empTickets.filter(t => t.status !== 'resolved' && t.status !== 'cancelled').length;
          const resolved = empTickets.filter(t => t.status === 'resolved').length;
          return { name: emp.name, role: 'Technician', open, resolved };
        });
        setTeamStats(statsArray.sort((a,b) => b.resolved - a.resolved).slice(0, 5));
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const kpis = [
    { label: 'Unassigned', value: stats.unassigned, icon: <AlertCircle size={20} />, color: '#ef4444', sub: 'Action Required' },
    { label: 'Active Jobs', value: stats.inProgress, icon: <Clock size={20} />, color: '#f59e0b', sub: 'In Progress' },
    { label: 'Parts Pending', value: stats.partsNeeded, icon: <RefreshCw size={20} />, color: '#8b5cf6', sub: 'Delayed' },
    { label: 'Today Fixed', value: stats.resolvedDay, icon: <CheckCircle size={20} />, color: '#10b981', sub: 'Completed' },
    { label: 'Month Fixed', value: stats.resolvedMonth, icon: <Award size={20} />, color: '#0ea5e9', sub: 'Efficiency' },
    { label: 'Total Volume', value: stats.total, icon: <Ticket size={20} />, color: '#6366f1', sub: 'All Tickets' },
  ];

  return (
    <AppLayout title="Operational Analytics">
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-display-md" style={{ letterSpacing: '-0.02em', marginBottom: '0.25rem', color: '#0f172a' }}>Service Intelligence</h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Live performance metrics for TG SMART maintenance operations.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchStats} disabled={isLoading} style={{ height: '48px', padding: '0 1.5rem', borderRadius: '12px', background: '#0f172a' }}>
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} style={{marginRight: '8px'}} /> Reload Analytics
        </button>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ 
            background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden'
          }}>
             <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: k.color, opacity: 0.05, borderRadius: '50%' }}></div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <div style={{ background: `${k.color}15`, padding: '8px', borderRadius: '10px', color: k.color }}>{k.icon}</div>
               <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{k.label}</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <p style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1 }}>{k.value}</p>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>units</span>
             </div>
             <p style={{ fontSize: '0.75rem', color: k.color, fontWeight: 700, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={10} /> {k.sub}
             </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="responsive-grid">
        
        {/* Product Distribution Chart (Pure CSS) */}
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <BarChart size={20} className="text-primary" /> Fault Distribution
             </h3>
             <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '4px 10px', borderRadius: '99px', fontWeight: 800 }}>ByCategory</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {productStats.length === 0 ? (
               <p style={{textAlign: 'center', color: '#94a3b8', padding: '2rem'}}>No product data available yet.</p>
             ) : productStats.map((p, i) => {
               const percentage = Math.round((p.count / stats.total) * 100);
               return (
                 <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                       <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{p.name}</span>
                       <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{p.count} <small style={{fontWeight: 500, opacity: 0.5}}>({percentage}%)</small></span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                       <div style={{ 
                         width: `${percentage}%`, height: '100%', background: '#0f172a', borderRadius: '99px',
                         transition: 'width 1s ease-out'
                       }}></div>
                    </div>
                 </div>
               );
             })}
          </div>

          <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
             <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Repair Time</p>
                <p style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a' }}>32 <small style={{fontSize: '0.7rem', opacity: 0.5}}>Hours</small></p>
             </div>
             <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>SLA Compliance</p>
                <p style={{ fontWeight: 900, fontSize: '1.25rem', color: '#10b981' }}>98.4%</p>
             </div>
          </div>
        </div>

        {/* Top Technicians List */}
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Users size={20} className="text-primary" /> Top Performers
             </h3>
             <Link to="/admin/employees" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>Full Directory →</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             {isLoading ? (
               <p style={{textAlign:'center', opacity:0.5, fontSize: '0.8rem', padding: '1rem'}}>Loading team metrics...</p>
             ) : teamStats.length === 0 ? (
                <p style={{textAlign:'center', opacity:0.5, fontSize: '0.8rem', padding: '1rem'}}>No active technicians found.</p>
             ) : teamStats.map((e, i) => (
                <div key={e.name} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '1.25rem', background: '#f8fafc', borderRadius: '16px',
                  border: i === 0 ? '2px solid #0f172a' : '1px solid transparent'
                }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', background: '#0f172a', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                        {e.name.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#0f172a' }}>{e.name}</p>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{e.resolved} Jobs Completed</p>
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, background: e.open > 3 ? '#fee2e2' : '#dcfce7', color: e.open > 3 ? '#ef4444' : '#166534', padding: '4px 10px', borderRadius: '99px' }}>
                        {e.open} Active
                      </span>
                   </div>
                </div>
              ))}
          </div>
          
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
               <p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>Current Leaderboard</p>
               <p style={{ fontWeight: 800, fontSize: '1rem' }}>{teamStats[0]?.name || '---'}</p>
             </div>
             <Award size={32} style={{ opacity: 0.5 }} />
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 1024px) {
          .responsive-grid { grid-template-columns: 1fr !important; }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  );
}
