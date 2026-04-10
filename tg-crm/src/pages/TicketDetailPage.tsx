import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Package, Share2, Trash2, User } from 'lucide-react';
import { supabase } from '../core/supabase/client';
import { useAuth } from '../core/auth/AuthContext';
import type { Spare, SpareAction, SpareStatus, TicketStatus, TicketWithDetails } from '../core/supabase/database.types';
import { PORTAL_BASE_URL, STATUS_LABELS, TICKET_STATUSES } from '../core/constants';
import AppLayout from '../components/AppLayout';
import { sendSMS } from '../core/utils/sms';
import { notifyTechnicianAssigned, notifyTicketResolved } from '../core/utils/email';

type Technician = { id: string; name: string; email: string; phone: string };

const SPARE_STATUS_OPTIONS: SpareStatus[] = ['needed', 'ordered', 'delivered'];
const SPARE_ACTION_OPTIONS: SpareAction[] = ['pending', 'installed', 'returned', 'unused'];

function normalizeTicketStatus(status: string | null | undefined): TicketStatus {
  if (!status) return 'new';
  if (status === 'in_progress') return 'assigned';
  if (status === 'parts_ordered') return 'parts_needed';
  if (status === 'cancelled') return 'resolved';
  if (status === 'new' || status === 'assigned' || status === 'parts_needed' || status === 'resolved') return status;
  return 'new';
}

function normalizePhone(phone: string | null | undefined) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager, employee } = useAuth();

  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [spares, setSpares] = useState<Spare[]>([]);
  const [techs, setTechs] = useState<Technician[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingSpareId, setSavingSpareId] = useState<string | null>(null);
  const [isAddingSpare, setIsAddingSpare] = useState(false);

  const [selectedTech, setSelectedTech] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('new');
  const [serviceNotes, setServiceNotes] = useState('');
  const [servicePhotos, setServicePhotos] = useState<File[]>([]);

  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartAssignedTo, setNewPartAssignedTo] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchTicket();
    fetchSpares();
    if (isAdmin || isManager) {
      fetchTechnicians();
    }
  }, [id, isAdmin, isManager]);

  async function fetchTicket() {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('tickets')
      .select('*, customers(*), employees!assigned_to(*)')
      .eq('id', id)
      .single();

    if (!error && data) {
      const normalizedStatus = normalizeTicketStatus(data.status);
      setTicket(data as TicketWithDetails);
      setSelectedTech(data.assigned_to || '');
      setSelectedStatus(normalizedStatus);
      setServiceNotes(data.service_notes || '');
    }
    setIsLoading(false);
  }

  async function fetchSpares() {
    if (!id) return;
    const { data } = await (supabase as any).from('spares').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
    if (data) setSpares(data as Spare[]);
  }

  async function fetchTechnicians() {
    let query = (supabase as any).from('employees').select('id, name, email, phone').eq('role', 'employee').eq('is_active', true);
    if (isManager && employee?.id) {
      query = query.eq('parent_id', employee.id);
    }
    const { data } = await query.order('name');
    if (data) setTechs(data as Technician[]);
  }

  const activeTech = useMemo(() => {
    const currentId = selectedTech || ticket?.assigned_to || '';
    return techs.find((tech) => tech.id === currentId) || null;
  }, [selectedTech, ticket?.assigned_to, techs]);

  async function handleShareTicket() {
    if (!ticket) return;
    const trackUrl = `${PORTAL_BASE_URL}/track/${ticket.ticket_number}`;
    const text = `Ticket ${ticket.ticket_number} • ${ticket.customers?.name || 'Customer'} • ${trackUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ticket ${ticket.ticket_number}`,
          text,
          url: trackUrl,
        });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Ticket share link copied.');
      }
    } catch (err) {
      console.error('Share cancelled/failed:', err);
    }
  }

  function openWhatsApp(phone: string, message: string) {
    const clean = normalizePhone(phone);
    if (clean.length !== 10) {
      alert('Phone number unavailable.');
      return;
    }
    const waUrl = `https://wa.me/91${clean}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  function handleShareCustomerWhatsApp() {
    if (!ticket) return;
    const message = `Dear ${ticket.customers?.name || 'Customer'}, your ticket ${ticket.ticket_number} is currently ${STATUS_LABELS[normalizeTicketStatus(ticket.status)].label}. Track here: ${PORTAL_BASE_URL}/track/${ticket.ticket_number}`;
    openWhatsApp(ticket.customers?.phone || '', message);
  }

  function handleShareTechnicianWhatsApp() {
    if (!ticket || !activeTech) return;
    const message = `Hi ${activeTech.name}, ticket ${ticket.ticket_number} is assigned to you. Customer: ${ticket.customers?.name || '-'}, phone: ${ticket.customers?.phone || '-'}, address: ${ticket.customers?.address || '-'}, issue: ${ticket.issue_description}`;
    openWhatsApp(activeTech.phone, message);
  }

  async function handleUpdateTicket() {
    if (!ticket) return;

    setIsUpdating(true);
    try {
      let uploadedPhotoUrls: string[] = [...((ticket.service_photos as string[]) || [])];

      if (servicePhotos.length > 0) {
        for (const file of servicePhotos) {
          const fileName = `${ticket.id}/service_${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(fileName, file);
          if (uploadError) throw uploadError;
          const {
            data: { publicUrl },
          } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName);
          uploadedPhotoUrls.push(publicUrl);
        }
      }

      const dbUpdates: any = {
        status: selectedStatus,
        service_notes: serviceNotes,
        service_photos: uploadedPhotoUrls,
      };

      const statusChanged = selectedStatus !== normalizeTicketStatus(ticket.status);
      const assignmentChanged = (isAdmin || isManager) && selectedTech !== (ticket.assigned_to || '');

      if (assignmentChanged) {
        dbUpdates.assigned_to = selectedTech || null;
        if (selectedTech && selectedStatus === 'new') {
          dbUpdates.status = 'assigned';
        }
      }

      const { error } = await (supabase as any).from('tickets').update(dbUpdates).eq('id', ticket.id);
      if (error) throw error;

      if (assignmentChanged && selectedTech) {
        const tech = techs.find((t) => t.id === selectedTech);
        const techName = tech?.name || 'a technician';
        const msg = `TG SMART: Technician ${techName} has been assigned to your ticket ${ticket.ticket_number}.`;
        await sendSMS(ticket.customers?.phone || '', msg);

        if (ticket.customers?.email) {
          await notifyTechnicianAssigned({ ...ticket, customer_name: ticket.customers?.name }, ticket.customers.email, techName);
        }
      }

      if (statusChanged) {
        if (selectedStatus === 'resolved') {
          await sendSMS(ticket.customers?.phone || '', `TG SMART: Your ticket ${ticket.ticket_number} has been resolved.`);
          await notifyTicketResolved(
            {
              ...ticket,
              customer_name: ticket.customers?.name,
              service_notes: serviceNotes,
              assigned_to_name: activeTech?.name,
            },
            ticket.customers?.email || undefined
          );
        }

        if (selectedStatus === 'parts_needed') {
          await sendSMS(ticket.customers?.phone || '', `TG SMART: Parts are required for ticket ${ticket.ticket_number}. We will update you after procurement.`);
        }
      }

      setServicePhotos([]);
      await fetchTicket();
    } catch (err: any) {
      alert(`Update failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  function patchSpare(id: string, patch: Partial<Spare>) {
    setSpares((prev) => prev.map((spare) => (spare.id === id ? { ...spare, ...patch } : spare)));
  }

  async function handleSaveSpare(spare: Spare) {
    setSavingSpareId(spare.id);
    try {
      const { error } = await (supabase as any)
        .from('spares')
        .update({
          status: spare.status,
          assigned_to: spare.assigned_to,
          action_status: spare.action_status,
          action_note: spare.action_note,
          action_updated_at: new Date().toISOString(),
        })
        .eq('id', spare.id);

      if (error) throw error;
      await fetchSpares();
    } catch (err: any) {
      alert(`Part update failed: ${err.message || 'unknown error'}`);
    } finally {
      setSavingSpareId(null);
    }
  }

  async function handleAddSpare() {
    if (!ticket || !employee?.id || !newPartName.trim()) return;

    setIsAddingSpare(true);
    try {
      const { error } = await (supabase as any).from('spares').insert({
        ticket_id: ticket.id,
        part_name: newPartName.trim(),
        quantity: newPartQty,
        status: 'needed',
        notes: null,
        added_by: employee.id,
        assigned_to: newPartAssignedTo || null,
        action_status: 'pending',
        action_note: null,
        action_updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setNewPartName('');
      setNewPartQty(1);
      setNewPartAssignedTo('');
      await fetchSpares();
    } catch (err: any) {
      alert(`Failed to add part: ${err.message || 'unknown error'}`);
    } finally {
      setIsAddingSpare(false);
    }
  }

  async function handleDeleteTicket() {
    if (!isAdmin || !ticket) return;

    const confirmed = prompt(`DANGER: Type "DELETE" to permanently erase ticket ${ticket.ticket_number}.`);
    if (confirmed !== 'DELETE') return;

    setIsUpdating(true);
    try {
      await (supabase as any).from('spares').delete().eq('ticket_id', ticket.id);
      const { error } = await (supabase as any).from('tickets').delete().eq('id', ticket.id);
      if (error) throw error;

      alert('Ticket deleted.');
      navigate('/admin/tickets');
    } catch (err: any) {
      alert(`Deletion failed: ${err.message || 'unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout title="Loading...">
        <div style={{ padding: '2rem' }}>Loading ticket...</div>
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout title="Not Found">
        <div style={{ padding: '2rem' }}>Ticket not found.</div>
      </AppLayout>
    );
  }

  const normalizedStatus = normalizeTicketStatus(ticket.status);
  const statusMeta = STATUS_LABELS[normalizedStatus];

  return (
    <AppLayout title={`Ticket ${ticket.ticket_number}`}>
      <div style={{ marginBottom: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ paddingLeft: 0, minHeight: '44px' }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg-grid-cols-3 gap-6" style={{ alignItems: 'start' }}>
        <div className="lg-col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <User size={18} className="text-primary" /> Customer Details
            </h3>

            <div className="grid grid-cols-1 md-grid-cols-2 gap-4">
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Customer Name</p>
                <p style={{ fontWeight: 600, margin: 0 }}>{ticket.customers?.name}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Mobile Contact</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>+91 {ticket.customers?.phone}</p>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ height: '32px' }} onClick={handleShareCustomerWhatsApp}>
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </div>
              </div>
              <div className="md-col-span-2">
                <p style={{ fontSize: '0.7rem', color: 'var(--outline)', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Site Address</p>
                <p style={{ margin: 0 }}>{ticket.customers?.address}</p>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <h2 className="text-headline-sm" style={{ margin: 0 }}>{ticket.product_type}</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                  #{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={statusMeta.className}>{statusMeta.label}</span>
            </div>

            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Issue Reported</p>
              <div style={{ background: 'var(--surface-lowest)', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--outline)', fontSize: '0.9rem' }}>
                {ticket.issue_description}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1rem' }}>Visit Details & Findings</h3>
            <div className="input-group">
              <label className="input-label">Service Report / Technical Notes</label>
              <textarea
                className="input"
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                placeholder="Describe assessment, work performed, or root cause..."
                style={{ minHeight: '120px' }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Service Photo Evidence</label>
              {ticket.service_photos && ticket.service_photos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {ticket.service_photos.map((url, i) => (
                    <img key={`${url}-${i}`} src={url} alt="Service" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--outline)' }} />
                  ))}
                </div>
              )}

              <input type="file" accept="image/*" multiple onChange={(e) => setServicePhotos(e.target.files ? Array.from(e.target.files) : [])} />
              {servicePhotos.length > 0 && <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>{servicePhotos.length} new photo(s) selected.</p>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1rem' }}>Ticket Actions</h3>

            <div className="input-group" style={{ marginBottom: '0.9rem' }}>
              <label className="input-label">Operational Status</label>
              <select className="select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}>
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status].label}
                  </option>
                ))}
              </select>
            </div>

            {(isAdmin || isManager) && (
              <div className="input-group" style={{ marginBottom: '0.9rem' }}>
                <label className="input-label">Reassign Technician</label>
                <select className="select" value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
                  <option value="">Unassigned</option>
                  {techs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>

                {activeTech && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ height: '34px', marginTop: '0.5rem' }} onClick={handleShareTechnicianWhatsApp}>
                    <MessageCircle size={14} /> Share with Technician
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ height: '36px' }} onClick={handleShareTicket}>
                <Share2 size={14} /> Share Ticket
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ height: '36px' }} onClick={handleShareCustomerWhatsApp}>
                <MessageCircle size={14} /> WhatsApp Customer
              </button>
            </div>

            <button className="btn btn-primary btn-full" style={{ height: '48px' }} onClick={handleUpdateTicket} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Ticket'}
            </button>

            {isAdmin && (
              <button className="btn btn-danger btn-full" style={{ height: '44px', marginTop: '0.75rem' }} onClick={handleDeleteTicket} disabled={isUpdating}>
                <Trash2 size={16} /> Delete Ticket
              </button>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 className="text-title-sm" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} className="text-primary" /> Spare Parts Tracker
            </h3>

            {spares.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.75rem' }}>No spare parts recorded.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {spares.map((spare) => (
                <div key={spare.id} style={{ border: '1px solid var(--outline)', borderRadius: '10px', padding: '0.75rem', background: 'var(--surface-lowest)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700 }}>{spare.part_name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>x{spare.quantity}</div>
                  </div>

                  <div className="grid grid-cols-1 md-grid-cols-2 gap-3" style={{ marginBottom: '0.5rem' }}>
                    <div className="input-group">
                      <label className="input-label">Part Status</label>
                      <select className="select" value={spare.status} onChange={(e) => patchSpare(spare.id, { status: e.target.value as SpareStatus })}>
                        {SPARE_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Technician</label>
                      <select className="select" value={spare.assigned_to || ''} onChange={(e) => patchSpare(spare.id, { assigned_to: e.target.value || null })}>
                        <option value="">Unassigned</option>
                        {techs.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Action</label>
                      <select className="select" value={spare.action_status} onChange={(e) => patchSpare(spare.id, { action_status: e.target.value as SpareAction })}>
                        {SPARE_ACTION_OPTIONS.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Action Notes</label>
                      <input className="input" value={spare.action_note || ''} onChange={(e) => patchSpare(spare.id, { action_note: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <small style={{ opacity: 0.7 }}>
                      Updated: {spare.action_updated_at ? new Date(spare.action_updated_at).toLocaleString() : 'Not updated'}
                    </small>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ height: '34px' }} onClick={() => handleSaveSpare(spare)} disabled={savingSpareId === spare.id}>
                      {savingSpareId === spare.id ? 'Saving...' : 'Save Part'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--outline)', paddingTop: '0.9rem' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.5rem' }}>Add New Part</p>
              <div className="grid grid-cols-1 md-grid-cols-2 gap-3">
                <input className="input" placeholder="Part name" value={newPartName} onChange={(e) => setNewPartName(e.target.value)} />
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={newPartQty}
                  onChange={(e) => setNewPartQty(Math.max(1, Number.parseInt(e.target.value || '1', 10)))}
                />
                <select className="select" value={newPartAssignedTo} onChange={(e) => setNewPartAssignedTo(e.target.value)}>
                  <option value="">Assign later</option>
                  {techs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" type="button" onClick={handleAddSpare} disabled={isAddingSpare}>
                  {isAddingSpare ? 'Adding...' : 'Add Part'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
