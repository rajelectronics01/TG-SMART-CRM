import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlusCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../core/auth/AuthContext';
import { supabase } from '../core/supabase/client';
import { sendSMS } from '../core/utils/sms';

const PRODUCT_TYPES = ['Washing Machine', 'Air Cooler', 'Washer', 'Television'];

type TechnicianOption = {
  id: string;
  name: string;
  phone: string;
};

type InternalTicketForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  pincode: string;
  productType: string;
  productModel: string;
  serialNumber: string;
  issueDescription: string;
  assignedTo: string;
  invoice: File | null;
};

export default function InternalCreateTicketPage() {
  const navigate = useNavigate();
  const { employee, isAdmin, isManager, isStaff } = useAuth();

  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [isLoadingTechs, setIsLoadingTechs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<InternalTicketForm>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    pincode: '',
    productType: '',
    productModel: '',
    serialNumber: '',
    issueDescription: '',
    assignedTo: '',
    invoice: null,
  });

  useEffect(() => {
    if (!employee?.id) return;
    fetchTechnicians();
  }, [employee?.id, isAdmin, isManager, isStaff]);

  async function fetchTechnicians() {
    if (!employee?.id) return;
    setIsLoadingTechs(true);
    try {
      let query = (supabase as any).from('employees').select('id, name, phone').eq('role', 'employee').eq('is_active', true);

      if (isManager) {
        query = query.eq('parent_id', employee.id);
      }

      if (isStaff) {
        query = query.eq('id', employee.id);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      setTechnicians((data || []) as TechnicianOption[]);

      if (isStaff && employee.id) {
        setForm((prev) => ({ ...prev, assignedTo: employee.id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load technicians.');
    } finally {
      setIsLoadingTechs(false);
    }
  }

  function update<K extends keyof InternalTicketForm>(field: K, value: InternalTicketForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const cleanPhone = form.customerPhone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        throw new Error('Customer phone must be 10 digits.');
      }

      const { data: customer, error: customerError } = await (supabase as any)
        .from('customers')
        .upsert(
          {
            name: form.customerName,
            phone: cleanPhone,
            email: form.customerEmail || null,
            address: form.address,
            pincode: form.pincode,
          },
          { onConflict: 'phone' }
        )
        .select('id')
        .single();

      if (customerError) throw customerError;

      let invoiceUrl: string | null = null;
      if (form.invoice) {
        const filename = `invoices/${Date.now()}-${form.invoice.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error: invoiceError } = await supabase.storage.from('ticket-attachments').upload(filename, form.invoice);
        if (invoiceError) throw invoiceError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('ticket-attachments').getPublicUrl(filename);
        invoiceUrl = publicUrl;
      }

      const now = new Date();
      const datePart =
        now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0');

      let prefix = 'TG';
      if (form.productType === 'Washing Machine') prefix = 'TGWM';
      else if (form.productType === 'Air Cooler') prefix = 'TGAC';
      else if (form.productType === 'Washer') prefix = 'TGW';
      else if (form.productType === 'Television') prefix = 'TGTV';

      const fullPrefix = `${prefix}${datePart}`;

      const { data: latestTickets } = await (supabase as any)
        .from('tickets')
        .select('ticket_number')
        .like('ticket_number', `${fullPrefix}%`)
        .order('ticket_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (latestTickets && latestTickets.length > 0) {
        const lastNum = latestTickets[0].ticket_number.slice(fullPrefix.length);
        const parsed = Number.parseInt(lastNum, 10);
        if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
      }
      const ticketNumber = `${fullPrefix}${String(nextNumber).padStart(3, '0')}`;

      const assignedTo = isStaff ? employee?.id || null : form.assignedTo || null;
      const status = assignedTo ? 'assigned' : 'new';

      const { data: ticket, error: ticketError } = await (supabase as any)
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          customer_id: customer.id,
          assigned_to: assignedTo,
          manager_id: isManager ? employee?.id : null,
          product_type: form.productType,
          product_brand: 'TG SMART',
          product_model: form.productModel || null,
          serial_number: form.serialNumber || null,
          issue_description: form.issueDescription,
          status,
          photos: [],
          invoice_url: invoiceUrl,
        })
        .select('id, ticket_number')
        .single();

      if (ticketError) throw ticketError;

      const message = `Dear ${form.customerName}, Ticket ${ticket.ticket_number} has been created for your ${form.productType}. Track at: ${window.location.host}/track.`;
      await sendSMS(cleanPhone, message);

      if (isAdmin) {
        navigate(`/admin/tickets/${ticket.id}`);
      } else if (isManager) {
        navigate(`/manager/tickets/${ticket.id}`);
      } else {
        navigate(`/ticket/${ticket.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Create Ticket">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 className="text-title-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={18} /> New Ticket (Internal)
          </h2>
          <p style={{ marginTop: '0.35rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
            Single-step form for Admin, Manager and Employee portals.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', borderRadius: '10px', background: 'var(--error-container)', color: 'var(--error)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div className="grid grid-cols-1 md-grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label">Customer Name *</label>
              <input className="input" required value={form.customerName} onChange={(e) => update('customerName', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Customer Phone *</label>
              <input
                className="input"
                required
                maxLength={10}
                value={form.customerPhone}
                onChange={(e) => update('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Customer Email</label>
              <input className="input" type="email" value={form.customerEmail} onChange={(e) => update('customerEmail', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Pincode *</label>
              <input
                className="input"
                required
                maxLength={6}
                value={form.pincode}
                onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Address *</label>
            <textarea className="input" required value={form.address} onChange={(e) => update('address', e.target.value)} style={{ minHeight: '80px' }} />
          </div>

          <div className="grid grid-cols-1 md-grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label">Product Type *</label>
              <select className="select" required value={form.productType} onChange={(e) => update('productType', e.target.value)}>
                <option value="" disabled>
                  Select product
                </option>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Model</label>
              <input className="input" value={form.productModel} onChange={(e) => update('productModel', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Serial Number</label>
              <input className="input" value={form.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Invoice / Warranty</label>
              <input
                className="input"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => update('invoice', e.target.files && e.target.files.length ? e.target.files[0] : null)}
              />
            </div>
          </div>

          {!isStaff && (
            <div className="input-group">
              <label className="input-label">Assign Technician</label>
              <select className="select" value={form.assignedTo} onChange={(e) => update('assignedTo', e.target.value)} disabled={isLoadingTechs}>
                <option value="">Unassigned (New)</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Issue Description *</label>
            <textarea className="input" required value={form.issueDescription} onChange={(e) => update('issueDescription', e.target.value)} style={{ minHeight: '100px' }} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ height: '48px' }}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create Ticket'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
