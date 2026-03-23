import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { Employee } from '../core/supabase/database.types';
import { Plus, Mail, X, RefreshCw, Smartphone, Users } from 'lucide-react';

const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminAuthClient = serviceKey 
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export default function ManagerTechniciansPage() {
  const { employee } = useAuth();
  const [technicians, setTechnicians] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New Technician Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    is_active: true
  });

  useEffect(() => {
    if (employee?.id) fetchTeam();
  }, [employee]);

  async function fetchTeam() {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*')
        .eq('parent_id', employee!.id)
        .eq('role', 'employee')
        .order('name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Create auth user securely
      if (!adminAuthClient) {
        throw new Error('Service Role Key is missing in .env.local. Area Managers cannot register new technicians securely without it.');
      }

      const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Could not create authentication account.");

      // 2. Create employee profile linked to manager
      const { error: profileError } = await (supabase as any).from('employees').insert({
        id: authData.user.id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        role: 'employee',
        parent_id: employee!.id,
        is_active: formData.is_active
      });

      if (profileError) throw profileError;

      alert("Technician added successfully!");
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', email: '', password: '', is_active: true });
      fetchTeam();
    } catch (err: any) {
      alert(err.message || "Failed to add technician.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="My Regional Team">
      <div className="container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
           <div>
             <h2 className="text-display-xs">Technicians Under You</h2>
             <p className="text-body-md" style={{ opacity: 0.6 }}>Add and oversee the staff assigned to your regional zones.</p>
           </div>
           <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Add New Tech
           </button>
        </div>

        {isLoading ? (
          <div className="loading-state">Syncing team members...</div>
        ) : technicians.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem', background: 'white', border: '2px dashed var(--outline)', borderRadius: '24px' }}>
             <Users size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
             <p className="text-title-md">No technicians found.</p>
             <p className="text-body-sm" style={{ opacity: 0.5 }}>Click "Add New Tech" to build your regional field team.</p>
          </div>
        ) : (
          <div className="tech-grid">
             {technicians.map(tech => (
               <div key={tech.id} className="tech-card">
                  <div className="tech-header">
                     <div className="avatar" style={{ background: 'var(--primary)', color: 'white', width: 44, height: 44, fontSize: '0.9rem' }}>
                       {tech.name[0]}
                     </div>
                     <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>{tech.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                           <span className={`status-dot ${tech.is_active ? 'active' : 'inactive'}`}></span>
                           <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.5 }}>{tech.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="tech-body">
                     <div className="info-row"><Smartphone size={14} /> {tech.phone}</div>
                     <div className="info-row"><Mail size={14} /> {tech.email}</div>
                  </div>

                  <div className="tech-footer">
                     <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Joined: {new Date(tech.created_at).toLocaleDateString()}</div>
                  </div>
               </div>
             ))}
          </div>
        )}

        {/* Add Tech Modal */}
        {isModalOpen && (
          <div className="modal-overlay">
             <div className="modal-content glass-card shadow-2xl" style={{ maxWidth: '440px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <h3 className="text-title-md">Register New Technician</h3>
                   <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4 }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div className="input-field">
                      <label>Full Name</label>
                      <input type="text" className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ramesh Kumar" />
                   </div>
                   <div className="input-field">
                      <label>Phone Number</label>
                      <input type="tel" className="input" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="10-digit mobile" />
                   </div>
                   <div className="input-field">
                      <label>Login Email</label>
                      <input type="email" className="input" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="tech@tgsmart.com" />
                   </div>
                   <div className="input-field">
                      <label>Password (For App Access)</label>
                      <input type="password" className="input" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Minimum 6 characters" />
                   </div>

                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', background: 'var(--surface-low)', padding: '0.75rem', borderRadius: '12px' }}>
                      <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Activate profile immediately</span>
                   </div>

                   <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ height: '48px', marginTop: '1rem' }}>
                      {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : 'Create Technician Account'}
                   </button>
                </form>
             </div>
          </div>
        )}

      </div>

      <style>{`
        .tech-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .tech-card {
           background: white; border: 1px solid var(--outline); padding: 1.5rem; border-radius: 20px;
           transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: default;
           display: flex; flex-direction: column; gap: 1rem;
        }
        .tech-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); border-color: var(--primary); }
        .tech-header { display: flex; align-items: center; gap: 1rem; }
        .avatar { display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.active { background: #22c55e; box-shadow: 0 0 10px rgba(34, 197, 94, 0.4); }
        .status-dot.inactive { background: #94a3b8; }
        .tech-body { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
        .info-row { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--on-surface-variant); font-weight: 600; }
        .tech-footer { padding-top: 1rem; border-top: 1px solid var(--surface-highest); }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { width: 95%; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative; border: none; }
        
        .input-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .input-field label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--on-surface-variant); padding-left: 4px; }
        
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  );
}
