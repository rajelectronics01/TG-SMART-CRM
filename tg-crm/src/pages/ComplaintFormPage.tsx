import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../core/supabase/client';
import { User, Cpu, AlertTriangle, CheckCircle } from 'lucide-react';
import { sendSMS } from '../core/utils/sms';

const PRODUCT_TYPES = [
  'Washing Machine', 'Television', 'Cooler', 'Voltage Stabilizer', 'Induction',
  'Air Conditioner', 'Refrigerator', 'Microwave', 'Dishwasher', 'Water Heater', 'Other'
];

interface FormData {
  name: string; phone: string; email: string;
  productType: string;
  productModel: string;
  serialNumber: string;
  purchaseDate: string;
  issueDescription: string;
  address: string; pincode: string; photos: File[];
  invoice: File | null;
}

export default function ComplaintFormPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>({
    name: '', phone: '', email: '',
    productType: '', productModel: '', serialNumber: '', purchaseDate: '',
    issueDescription: '', address: '', pincode: '', photos: [], invoice: null,
  });

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data: customer, error: custErr } = await (supabase as any)
        .from('customers')
        .upsert({ name: form.name, phone: form.phone, email: form.email || null, address: form.address, pincode: form.pincode }, { onConflict: 'phone' })
        .select('id').single();
      if (custErr) throw custErr;

      const photoUrls: string[] = [];
      for (const file of form.photos) {
        const filename = `photos/${Date.now()}-${file.name}`;
        await supabase.storage.from('ticket-attachments').upload(filename, file);
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(filename);
        photoUrls.push(publicUrl);
      }

      let invoiceUrl: string | null = null;
      if (form.invoice) {
        const filename = `invoices/${Date.now()}-${form.invoice.name}`;
        await supabase.storage.from('ticket-attachments').upload(filename, form.invoice);
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(filename);
        invoiceUrl = publicUrl;
      }

      const { data: ticket, error: tickErr } = await (supabase as any)
        .from('tickets')
        .insert({
          customer_id: customer.id,
          product_type: form.productType,
          product_brand: 'TG SMART',
          product_model: form.productModel,
          serial_number: form.serialNumber,
          issue_description: form.issueDescription,
          status: 'new',
          photos: photoUrls,
          invoice_url: invoiceUrl,
        })
        .select('ticket_number').single();
      if (tickErr) throw tickErr;

      const msg = `Dear ${form.name}, Ticket ${ticket.ticket_number} created for TG SMART ${form.productType}. Track at: ${window.location.host}/track. - TG SMART`;
      await sendSMS(form.phone, msg);

      navigate(`/confirmation/${ticket.ticket_number}`);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setIsLoading(false);
    }
  }

  const steps = [
    { label: 'Details', icon: <User size={14} /> },
    { label: 'Product', icon: <Cpu size={14} /> },
    { label: 'Issue', icon: <AlertTriangle size={14} /> },
  ];

  return (
    <div className="public-light-theme" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/tg-logo.jpg" alt="Logo" style={{ width: 32, height: 32, borderRadius: '6px' }} />
          <span style={{ fontWeight: 800, fontSize: '1rem' }}>TG SMART</span>
        </div>
        <a href="/track" style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Track →</a>
      </header>

      <main style={{ flex: 1, maxWidth: '600px', margin: '0 auto', width: '100%', padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{
              flexShrink: 0, padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
              background: i === step ? '#000' : 'rgba(0,0,0,0.05)', color: i === step ? '#fff' : '#666',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              {i < step ? <CheckCircle size={14} /> : s.icon}
              {s.label}
            </div>
          ))}
        </div>

        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

        <form onSubmit={step < 2 ? (e) => { e.preventDefault(); setStep(step + 1); } : handleSubmit}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            {step === 0 && (
              <div className="grid grid-cols-1 gap-4">
                <div className="input-group">
                  <label className="input-label">Full Name *</label>
                  <input className="input" type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Your Name" />
                </div>
                <div className="input-group">
                  <label className="input-label">Mobile Number *</label>
                  <input className="input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} required maxLength={10} placeholder="10-digit number" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 gap-4">
                <div className="input-group">
                  <label className="input-label">Product Type *</label>
                  <select className="select" value={form.productType} onChange={(e) => update('productType', e.target.value)} required>
                    <option value="">Select Type</option>
                    {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Serial Number / Model *</label>
                  <input className="input" type="text" value={form.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} required placeholder="Found on sticker" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 gap-4">
                <div className="input-group">
                  <label className="input-label">Issue Description *</label>
                  <textarea className="input" value={form.issueDescription} onChange={(e) => update('issueDescription', e.target.value)} required style={{ minHeight: '100px' }} placeholder="What is the problem?" />
                </div>
                <div className="input-group">
                  <label className="input-label">Pincode *</label>
                  <input className="input" type="text" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} required maxLength={6} placeholder="6-digit code" />
                </div>
                <div className="input-group">
                  <label className="input-label">Full Address *</label>
                  <textarea className="input" value={form.address} onChange={(e) => update('address', e.target.value)} required placeholder="Door no, Street, Landmark..." />
                </div>
              </div>
            )}
          </div>

          <div className="button-row" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            {step > 0 && (
              <button type="button" className="btn btn-secondary" style={{ flex: 1, height: '48px' }} onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px' }} disabled={isLoading}>
              {step < 2 ? 'Continue' : isLoading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <a href="/login" style={{ fontSize: '0.7rem', color: '#000', textDecoration: 'none' }}>STAFF LOGIN</a>
      </footer>
    </div>
  );
}
