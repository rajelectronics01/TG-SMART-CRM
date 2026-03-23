import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { Employee } from '../core/supabase/database.types';
import { UserPlus, Shield, Key, Copy, CheckCircle, RefreshCw, Smartphone, Mail, X, Edit, Power, Trash2 } from 'lucide-react';

const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminAuthClient = serviceKey 
  ? createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'admin' | 'manager'>('employee');
  const [parentId, setParentId] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);

  // Success State
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string; phone: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchManagers();
  }, []);

  async function fetchEmployees() {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('employees')
        .select('*, parent:parent_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchManagers() {
    const { data } = await (supabase as any).from('employees').select('id, name').eq('role', 'manager').eq('is_active', true);
    if (data) setManagers(data);
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$&*';
    let pass = '';
    for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(pass);
  }

  function openCreateModal() {
    setIsEditMode(false);
    setEditingId(null);
    setName(''); setPhone(''); setEmail(''); setRole('employee'); setParentId(''); setIsActive(true);
    generatePassword();
    setCreatedCredentials(null);
    setIsModalOpen(true);
  }

  function openEditModal(emp: Employee) {
    setIsEditMode(true);
    setEditingId(emp.id);
    setName(emp.name);
    setPhone(emp.phone);
    setEmail(emp.email);
    setRole(emp.role as any);
    setParentId(emp.parent_id || '');
    setIsActive(emp.is_active);
    setIsActive(emp.is_active);
    setPassword(''); // Allow setting a new password in edit mode
    setCreatedCredentials(null);
    setIsModalOpen(true);
  }

  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || !email) return;
    if (!isEditMode && !password) return;
    
    setIsLoading(true);
    try {
      if (isEditMode && editingId) {
        // UPDATE EXISTING DB RECORD
        const { error: dbError } = await (supabase as any).from('employees').update({
          name, phone, email, role,
          parent_id: role === 'employee' ? (parentId || null) : null,
          is_active: isActive
        }).eq('id', editingId);

        if (dbError) throw dbError;

        // OPTIONAL: UPDATE PASSWORD IN AUTH
        if (password) {
          if (!adminAuthClient) throw new Error('Service Role Key is missing. Password cannot be updated.');
          const { error: passError } = await adminAuthClient.auth.admin.updateUserById(editingId, { password });
          if (passError) throw passError;
          alert('Employee profile & password updated successfully!');
        } else {
          alert('Employee updated successfully.');
        }
        
        setIsModalOpen(false);
        fetchEmployees();
      } else {
        // CREATE NEW
        if (!adminAuthClient) throw new Error('Service Role Key is missing in .env.local. Cannot create users.');

        const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (authError) throw authError;

        const newUserId = authData?.user?.id;
        if (!newUserId) throw new Error('Could not create auth user.');

        const { error: dbError } = await (supabase as any).from('employees').insert({
          id: newUserId,
          name, phone, email, role,
          parent_id: role === 'employee' ? (parentId || null) : null,
          is_active: true
        });

        if (dbError) throw dbError;
        
        setCreatedCredentials({ email, pass: password, phone });
        fetchEmployees();
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleStatus(emp: Employee) {
     if (!confirm(`Are you sure you want to ${emp.is_active ? 'deactivate' : 'activate'} this account?`)) return;
     try {
        const { error } = await (supabase as any).from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id);
        if (error) throw error;
        fetchEmployees();
     } catch (err: any) {
        alert(err.message);
     }
  }

  async function deleteEmployee(emp: Employee) {
    if (!adminAuthClient) {
      alert("Missing VITE_SUPABASE_SERVICE_ROLE_KEY! You cannot delete users without it.");
      return;
    }
    const confirmDelete = prompt(`DANGER: Type "DELETE" to permanently erase ${emp.name} from the system.`);
    if (confirmDelete !== 'DELETE') return;

    setIsLoading(true);
    try {
      // Delete from public table
      await (supabase as any).from('employees').delete().eq('id', emp.id);
      
      // Delete from Auth
      const { error } = await adminAuthClient.auth.admin.deleteUser(emp.id);
      if (error) throw error;

      alert('Employee permanently deleted.');
      fetchEmployees();
    } catch (err: any) {
      alert('Error deleting employee: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function copyCredentials() {
    if (!createdCredentials) return;
    const text = `TG SMART Service CRM\nPortal: https://crm.tgsmart.com\nLogin ID: ${createdCredentials.email}\nTemp Password: ${createdCredentials.pass}\nMobile OTP is also enabled for +91 ${createdCredentials.phone}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppLayout title="Team Directory">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-headline-md" style={{ margin: 0 }}>Staff & Technicians</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>Manage system access and roles.</p>
        </div>
        <button className="btn btn-primary btn-full-mobile" onClick={openCreateModal} style={{ height: '44px' }}>
          <UserPlus size={16} /> Add New Member
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Login / ID</th>
                <th>Contact</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && !isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>No staff members found.</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} style={{ opacity: emp.is_active ? 1 : 0.6 }}>
                  <td data-label="Member">
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                      Joined: {new Date(emp.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td data-label="Role">
                    <span className={emp.role === 'admin' ? 'badge badge-in-progress' : emp.role === 'manager' ? 'badge badge-parts-needed' : 'badge badge-assigned'}>
                      {emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Area Manager' : 'Technician'}
                    </span>
                    {(emp as any).parent?.name && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                         Under: {(emp as any).parent.name}
                      </div>
                    )}
                  </td>
                  <td data-label="Login / ID">
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{emp.email}</div>
                  </td>
                  <td data-label="Contact">
                    <div style={{ fontSize: '0.875rem' }}>+91 {emp.phone}</div>
                  </td>
                  <td data-label="Status">
                    <span className={emp.is_active ? 'badge badge-resolved' : 'badge badge-cancelled'}>
                      {emp.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                     <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => openEditModal(emp)} className="btn btn-icon" title="Edit Profile"><Edit size={16} /></button>
                        <button onClick={() => toggleStatus(emp)} className="btn btn-icon" style={{ color: emp.is_active ? 'var(--error)' : 'var(--success)' }} title={emp.is_active ? 'Deactivate' : 'Activate'}>
                           <Power size={16} />
                        </button>
                        <button onClick={() => deleteEmployee(emp)} className="btn btn-icon" style={{ border: '1px solid rgba(239,68,68,0.3)', color: 'var(--error)', background: 'rgba(239,68,68,0.05)' }} title="Hard Delete">
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE/EDIT MODAL ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,14,20,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
        }}>
          <div className="glass-card shadow-2xl" style={{ width: '100%', maxWidth: '500px', background: 'var(--surface-container)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(66,71,84,0.3)' }}>
              <h2 className="text-title-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} style={{ color: 'var(--primary)' }} /> {isEditMode ? 'Update Staff Member' : 'Secure Account Generation'}
              </h2>
              {!createdCredentials && (
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--outline)', cursor: 'pointer' }}><X size={20} /></button>
              )}
            </div>

            {createdCredentials ? (
              <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 0 24px rgba(74,222,128,0.2)' }}>
                  <CheckCircle size={32} style={{ color: '#4ade80' }} />
                </div>
                <h3 className="text-headline-md" style={{ marginBottom: '0.5rem' }}>Account Created!</h3>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', marginBottom: '2rem' }}>Share these secure credentials with the employee.</p>
                
                <div style={{ background: 'var(--surface-lowest)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'left', marginBottom: '1.5rem', border: '1px solid rgba(66,71,84,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Login ID (Email)</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>{createdCredentials.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temporary Password</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--success)', letterSpacing: '0.05em', fontSize: '1.1rem' }}>{createdCredentials.pass}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OTP Number</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>+91 {createdCredentials.phone}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={copyCredentials} className="btn btn-secondary btn-full" style={{ flex: 1, borderColor: copied ? 'var(--success)' : undefined }}>
                    {copied ? <><CheckCircle size={16} style={{ color: 'var(--success)' }} /> Copied</> : <><Copy size={16} /> Copy Text</>}
                  </button>
                  <button onClick={() => setIsModalOpen(false)} className="btn btn-primary btn-full" style={{ flex: 1 }}>Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveEmployee} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Full Name</label>
                    <input className="input" placeholder="Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Role</label>
                    <select className="select" value={role} onChange={(e) => setRole(e.target.value as any)} required>
                      <option value="employee">Technician</option>
                      <option value="manager">Area Manager</option>
                      <option value="admin">System Admin</option>
                    </select>
                  </div>
                </div>

                {role === 'employee' && (
                  <div className="input-group">
                    <label className="input-label">Assign to Manager (Optional)</label>
                    <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                      <option value="">Directly Under Admin</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Mobile Number</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix"><Smartphone size={14} /> +91</span>
                    <input className="input" type="tel" maxLength={10} placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} required />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Email Address (Login ID)</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix"><Mail size={14} /></span>
                    <input className="input" type="email" placeholder="ramesh@tgsmart.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isEditMode} />
                  </div>
                  {isEditMode && <p style={{ fontSize: '0.65rem', color: 'var(--outline)', marginTop: '4px' }}>Login Email cannot be changed here for security reasons.</p>}
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {isEditMode ? 'New Password (Optional)' : 'Generated Password'}
                    
                    <button type="button" onClick={generatePassword} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <RefreshCw size={12} /> Regenerate
                    </button>
                  </label>
                  <div className="input-with-prefix">
                    <span className="input-prefix"><Key size={14} /></span>
                    <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEditMode} placeholder={isEditMode ? "Leave blank to keep current" : "Password"} style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 600 }} />
                  </div>
                  {isEditMode && <p style={{ fontSize: '0.65rem', color: 'var(--outline)', marginTop: '4px' }}>Fill this field *only* if you want to forcefully reset their password.</p>}
                </div>

                <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.5rem' }}>
                   {isLoading ? 'Processing...' : isEditMode ? 'Save Changes' : 'Generate & Save Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
         .btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); border-radius: 8px; border: 1px solid var(--outline); cursor: pointer; transition: all 0.2s; color: var(--on-surface-variant); }
         .btn-icon:hover { background: var(--surface-highest); border-color: var(--primary); color: var(--primary); }
      `}</style>
    </AppLayout>
  );
}
