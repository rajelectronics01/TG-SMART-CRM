import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../core/supabase/client';
import { useAuth } from '../core/auth/AuthContext';
import type { TicketWithDetails, TicketStatus, Spare } from '../core/supabase/database.types';
import AppLayout from '../components/AppLayout';
import { ArrowLeft, User, Package, Smartphone, Trash2 } from 'lucide-react';
import { sendSMS } from '../core/utils/sms';
import { notifyTechnicianAssigned, notifyTicketResolved } from '../core/utils/email';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:           { label: 'New',           className: 'badge badge-new' },
  assigned:      { label: 'Assigned',      className: 'badge badge-assigned' },
  in_progress:   { label: 'In Progress',   className: 'badge badge-in-progress' },
  parts_needed:  { label: 'Parts Needed',  className: 'badge badge-parts-needed' },
  parts_ordered: { label: 'Parts Ordered', className: 'badge badge-parts-ordered' },
  resolved:      { label: 'Resolved',      className: 'badge badge-resolved' },
  cancelled:     { label: 'Cancelled',     className: 'badge badge-cancelled' },
};

const ALL_STATUSES: TicketStatus[] = [
  'new', 'assigned', 'in_progress', 'parts_needed', 'parts_ordered', 'resolved', 'cancelled'
];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager, employee } = useAuth();
  
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [spares, setSpares] = useState<Spare[]>([]);
  const [techs, setTechs] = useState<{ id: string, name: string, email: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('new');
  const [serviceNotes, setServiceNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [isAddingSpare, setIsAddingSpare] = useState(false);
  const [servicePhotos, setServicePhotos] = useState<File[]>([]);

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchSpares();
    }
    if (isAdmin || isManager) fetchTechnicians();
  }, [id, isAdmin, isManager]);

  async function fetchTicket() {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('tickets')
      .select('*, customers(*), employees!assigned_to(*)')
      .eq('id', id!)
      .single();
    if (!error && data) {
      setTicket(data as unknown as TicketWithDetails);
      setSelectedTech(data.assigned_to || '');
      setSelectedStatus(data.status as TicketStatus);
      setServiceNotes(data.service_notes || '');
    }
    setIsLoading(false);
  }

  async function fetchSpares() {
    const { data } = await (supabase as any).from('spares').select('*').eq('ticket_id', id!).order('created_at', { ascending: true });
    if (data) setSpares(data as Spare[]);
  }

  async function fetchTechnicians() {
    let query = (supabase as any).from('employees').select('id, name, email').eq('role', 'employee').eq('is_active', true);
    
    if (isManager && employee?.id) {
       query = query.eq('parent_id', employee.id);
    }

    const { data } = await query;
    if (data) setTechs(data);
  }

  async function handleUpdateTicket() {
    if (!ticket) return;
    setIsUpdating(true);
    try {
      let uploadedPhotoUrls: string[] = [...(ticket.service_photos as string[] || [])];
      
      if (servicePhotos.length > 0) {
        for (const file of servicePhotos) {
          const fileName = `${ticket.id}/service_${Date.now()}_${file.name}`;
          await supabase.storage.from('ticket-attachments').upload(fileName, file);
          const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName);
          uploadedPhotoUrls.push(publicUrl);
        }
      }

      const dbUpdates: any = { 
        status: selectedStatus,
        service_notes: serviceNotes,
        service_photos: uploadedPhotoUrls
      };

      let assignmentChanged = false;
      let statusChanged = selectedStatus !== ticket.status;

      if ((isAdmin || isManager) && selectedTech !== ticket.assigned_to) {
        dbUpdates.assigned_to = selectedTech || null;
        assignmentChanged = true;
        if (selectedTech && (selectedStatus === 'new')) {
          dbUpdates.status = 'assigned';
        }
      }

      const { error } = await (supabase as any).from('tickets').update(dbUpdates).eq('id', ticket.id);
      if (!error) {
        if (assignmentChanged && selectedTech) {
          const tech = techs.find(t => t.id === selectedTech);
          const techName = tech?.name || 'a technician';
          const msg = `TG SMART: Technician ${techName} has been assigned to your ticket ${ticket.ticket_number}. They will contact you shortly.`;
          await sendSMS(ticket.customers?.phone || '', msg);
          
          // Send Assignment Notification (To Customer & Admin)
          if (ticket.customers?.email) {
            await notifyTechnicianAssigned(
              { ...ticket, customer_name: ticket.customers?.name }, 
              ticket.customers.email, 
              techName
            );
          }
        } else if (statusChanged) {
          let msg = '';
          if (selectedStatus === 'resolved') {
            msg = `TG SMART: Your ticket ${ticket.ticket_number} has been resolved. Thank you for choosing TG Service!`;
            
            // Send Resolution Email (To Customer & Admin)
            await notifyTicketResolved(
              { 
                ...ticket, 
                customer_name: ticket.customers?.name, 
                service_notes: serviceNotes,
                assigned_to_name: techs.find(t => t.id === ticket.assigned_to)?.name 
              },
              ticket.customers?.email
            );
          } else if (selectedStatus === 'parts_needed' || selectedStatus === 'parts_ordered') {
            msg = `TG SMART: We require parts for ticket ${ticket.ticket_number}. Your repair will continue once parts arrive.`;
          } else if (selectedStatus === 'in_progress') {
            msg = `TG SMART: Technician is now working on your request #${ticket.ticket_number}.`;
          }
          if (msg) await sendSMS(ticket.customers?.phone || '', msg);
        }
        setServicePhotos([]);
        fetchTicket(); 
      } else {
        alert('Update failed: ' + error.message);
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddSpare() {
    if (!newPartName.trim() || !employee?.id) return;
    setIsAddingSpare(true);
    const { error } = await (supabase as any).from('spares').insert({
      ticket_id: ticket!.id,
      part_name: newPartName.trim(),
      quantity: newPartQty,
      status: 'needed',
      added_by: employee.id,
    });
    if (!error) {
      setNewPartName('');
      setNewPartQty(1);
      fetchSpares();
    }
    setIsAddingSpare(false);
  }

  async function handleDeleteTicket() {
    if (!isAdmin) return;
    const confirmed = prompt(`DANGER: Type "DELETE" to permanently erase ticket ${ticket?.ticket_number}. This cannot be undone.`);
    if (confirmed !== 'DELETE') return;

    setIsUpdating(true); // Re-use loading state
    try {
      // 1. Clean up related records (Spares)
      await (supabase as any).from('spares').delete().eq('ticket_id', id);
      
      // 2. Delete the ticket
      const { error } = await (supabase as any).from('tickets').delete().eq('id', id);
      if (error) throw error;

      alert('Ticket successfully erased.');
      navigate(isAdmin ? '/admin/tickets' : '/manager/tickets');
    } catch (err: any) {
      alert('Deletion failed: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) return <AppLayout title="Loading..."><div style={{ padding: '2rem' }}>Loading ticket...</div></AppLayout>;
  if (!ticket) return <AppLayout title="Not Found"><div style={{ padding: '2rem' }}>Ticket not found</div></AppLayout>;

  return (
    <AppLayout title={`Ticket ${ticket.ticket_number}`}>
      <div style={{ marginBottom: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ paddingLeft: 0, minHeight: '44px' }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg-grid-cols-3 gap-6" style={{ alignItems: 'start' }}>
        
        <div className="lg-col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 className="text-headline-sm" style={{ margin: 0 }}>{ticket.product_type}</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  #{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={STATUS_LABELS[ticket.status]?.className ?? 'badge'}>
                {STATUS_LABELS[ticket.status]?.label ?? ticket.status}
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Issue Reported</p>
              <div style={{ background: 'var(--surface-lowest)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--outline)', fontSize: '0.9rem' }}>
                {ticket.issue_description}
              </div>
            </div>

            {ticket.photos && ticket.photos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {ticket.photos.map((url, i) => (
                  <img key={i} src={url} alt="Issue" style={{ height: '80px', width: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--outline)' }} />
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Package size={18} className="text-primary" /> Visit Details & Findings
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Service Report / Technical Notes</label>
                <textarea 
                  className="input" 
                  value={serviceNotes} 
                  onChange={e => setServiceNotes(e.target.value)}
                  placeholder="Describe your assessment, work performed, or root cause found..."
                  style={{ minHeight: '120px', paddingTop: '0.75rem' }}
                />
              </div>

              <div>
                <label className="input-label" style={{ marginBottom: '0.75rem', display: 'block' }}>Photo Evidence (Machine / Parts)</label>
                
                {/* Existing Service Photos */}
                {ticket.service_photos && ticket.service_photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {ticket.service_photos.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="Service" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--outline)' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload New Photos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ 
                    border: '2px dashed var(--outline)', padding: '1.5rem', borderRadius: '12px', 
                    textAlign: 'center', background: 'var(--surface-lowest)', position: 'relative'
                  }}>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      capture="environment"
                      onChange={e => e.target.files && setServicePhotos(Array.from(e.target.files))}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <Smartphone size={24} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{servicePhotos.length > 0 ? `${servicePhotos.length} photos selected` : 'Tap to Open Camera or Upload'}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.5 }}>Capture machine tag, internal parts, or resolved site</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <User size={18} className="text-primary" /> Customer Details
            </h3>
            <div className="grid grid-cols-1 md-grid-cols-2 gap-5">
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Customer Name</p>
                <p style={{ fontWeight: 600, margin: 0, fontSize: '1rem' }}>{ticket.customers?.name}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Mobile Contact</p>
                <p style={{ fontWeight: 600, margin: 0, fontSize: '1rem' }}>+91 {ticket.customers?.phone}</p>
              </div>
              <div className="md-col-span-2">
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Site Address</p>
                <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>{ticket.customers?.address}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1.25rem' }}>Ticket Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Operational Status</label>
                <select className="select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as TicketStatus)}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]?.label}</option>)}
                </select>
              </div>

              {(isAdmin || isManager) && (
                <div className="input-group">
                  <label className="input-label">Reassign Technician</label>
                  <select className="select" value={selectedTech} onChange={e => setSelectedTech(e.target.value)}>
                    <option value="">Unassigned</option>
                    {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <button className="btn btn-primary btn-full" style={{ height: '52px', borderRadius: '12px' }} onClick={handleUpdateTicket} disabled={isUpdating}>
                {isUpdating ? 'Uploading Data...' : 'Save Service Data'}
              </button>

              {isAdmin && (
                <button 
                  className="btn btn-danger btn-full" 
                  style={{ height: '48px', borderRadius: '12px', marginTop: '1rem', border: '1px solid rgba(220, 38, 38, 0.2)' }} 
                  onClick={handleDeleteTicket} 
                  disabled={isUpdating}
                >
                  <Trash2 size={16} /> Delete Ticket
                </button>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Package size={18} className="text-primary" /> Spare Parts Needed
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {spares.length === 0 && (
                <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center', padding: '1rem 0' }}>No spares recorded for this job</p>
              )}
              {spares.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-lowest)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--outline)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{s.part_name}</span>
                    <span style={{ opacity: 0.5, marginLeft: '0.5rem' }}>x{s.quantity}</span>
                  </div>
                  <span className="badge" style={{ fontSize: '0.65rem' }}>{s.status}</span>
                </div>
              ))}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--outline)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Add Requirement</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="input" placeholder="Part name..." value={newPartName} onChange={e => setNewPartName(e.target.value)} style={{ height: '44px' }} />
                  <button className="btn btn-secondary btn-sm" onClick={handleAddSpare} disabled={isAddingSpare} style={{ height: '44px', width: '44px' }}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
