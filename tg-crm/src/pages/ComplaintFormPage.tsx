import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../core/supabase/client';
import { User, Cpu, AlertTriangle, CheckCircle, Camera, FileText, ArrowRight, ArrowLeft } from 'lucide-react';
import { sendSMS } from '../core/utils/sms';
import { notifyNewTicket } from '../core/utils/email';

const PRODUCT_TYPES = [
  'Washing Machine', 'Air Cooler', 'Washer', 'Television'
];

interface FormData {
  name: string; phone: string; email: string;
  productType: string;
  productModel: string;
  serialNumber: string;
  issueDescription: string;
  address: string; pincode: string; 
  photos: File[];
  invoice: File | null;
}

export default function ComplaintFormPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    name: '', phone: '', email: '',
    productType: '', productModel: '', serialNumber: '',
    issueDescription: '', address: '', pincode: '', photos: [], invoice: null,
  });

  function update(field: keyof FormData, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      update('photos', Array.from(e.target.files));
    }
  }

  function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      update('invoice', e.target.files[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // 1. Upsert Customer
      const { data: customer, error: custErr } = await (supabase as any)
        .from('customers')
        .upsert({ name: form.name, phone: form.phone, email: form.email || null, address: form.address, pincode: form.pincode }, { onConflict: 'phone' })
        .select('id').single();
      if (custErr) throw custErr;

      // 2. Upload Photos
      const photoUrls: string[] = [];
      for (let i = 0; i < form.photos.length; i++) {
        const file = form.photos[i];
        const filename = `photos/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        await supabase.storage.from('ticket-attachments').upload(filename, file);
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(filename);
        photoUrls.push(publicUrl);
      }

      // 3. Upload Invoice
      let invoiceUrl: string | null = null;
      if (form.invoice) {
        const filename = `invoices/${Date.now()}-${form.invoice.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        await supabase.storage.from('ticket-attachments').upload(filename, form.invoice);
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(filename);
        invoiceUrl = publicUrl;
      }

      // 4. Generate custom Ticket Number based on product + date
      const now = new Date();
      const datePart = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0');
      
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
        const parsed = parseInt(lastNum, 10);
        if (!isNaN(parsed)) nextNumber = parsed + 1;
      }
      const newTicketNumber = `${fullPrefix}${String(nextNumber).padStart(3, '0')}`;

      // 5. Smart Routing: Auto-Assign Technician based on Pincode
      const { data: routeMatch } = await (supabase as any)
        .from('pincode_routes')
        .select('employee_id, employees!employee_id(name)')
        .eq('pincode', form.pincode)
        .maybeSingle();

      const autoAssignedTo = routeMatch?.employee_id || null;
      const techName = (routeMatch as any)?.employees?.name || null;
      const initialStatus = autoAssignedTo ? 'assigned' : 'new';

      // 6. Create Ticket
      const { data: ticket, error: tickErr } = await (supabase as any)
        .from('tickets')
        .insert({
          ticket_number: newTicketNumber,
          customer_id: customer.id,
          assigned_to: autoAssignedTo,
          product_type: form.productType,
          product_brand: 'TG SMART',
          product_model: form.productModel || null,
          serial_number: form.serialNumber || null,
          issue_description: form.issueDescription,
          status: initialStatus,
          photos: photoUrls,
          invoice_url: invoiceUrl,
        })
        .select('*, id, ticket_number').single();
      if (tickErr) throw tickErr;

      // 7. Send Notifications
      const msg = `Dear ${form.name}, Ticket ${ticket.ticket_number} created for TG SMART ${form.productType}. ${autoAssignedTo ? `Technician ${techName} assigned.` : 'Our team will contact you soon.'} Track at: ${window.location.host}/track. - TG SMART`;
      await sendSMS(form.phone, msg);

      // Phase 1 Optimization (New Ticket)
      await (supabase as any).from('tickets').update({ status: initialStatus }).eq('id', ticket.id);
      await notifyNewTicket({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        customer_name: form.name,
        product_type: form.productType,
        issue_description: form.issueDescription
      }, form.email);

      // Trigger Phase 2 (Auto-Assignment) if routed
      if (autoAssignedTo && form.email) {
        import('../core/utils/email').then(({ notifyTechnicianAssigned }) => {
          notifyTechnicianAssigned(
            { ...ticket, customer_name: form.name }, 
            form.email, 
            techName
          );
        });
      }

      // 8. Redirect to confirmation
      navigate(`/confirmation/${ticket.ticket_number}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const steps = [
    { label: 'Your Details', icon: <User size={16} /> },
    { label: 'Product Info', icon: <Cpu size={16} /> },
    { label: 'Issue & Location', icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'var(--font-body)' }}>
      {/* Bold Header */}
      <header style={{ 
        padding: '1.25rem 2rem', 
        background: '#0f172a', 
        color: '#fff',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '4px', borderRadius: '8px' }}>
            <img src="/tg-logo.jpg" alt="TG SMART" style={{ width: 40, height: 40, borderRadius: '4px', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.02em', display: 'block', lineHeight: 1.2 }}>TG SMART</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Service Portal</span>
          </div>
        </div>
        <style>{`
          @media (max-width: 767px) {
            .hide-on-mobile { display: none !important; }
          }
        `}</style>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a href="/track" className="hide-on-mobile" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '99px', transition: 'all 0.2s' }}>
            Track Ticket <ArrowRight size={14} />
          </a>
          <button 
            onClick={() => navigate('/login')}
            style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '99px', transition: 'all 0.2s' }}
          >
            <User size={14} /> Login
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: '720px', margin: '0 auto', width: '100%', padding: '2rem 1rem', display: 'flex', flexDirection: 'column' }}>
        
        {/* Bold Title Area */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 className="text-display-md" style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>Need Help? We’re Here.</h1>
          <p style={{ color: '#475569', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>Fast, reliable & professional repairs for your TG SMART appliances.</p>
        </div>

        {/* Fancy Progress Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#fff', padding: '0.5rem', borderRadius: '99px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center', padding: '0.75rem 0.5rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 700,
              background: i === step ? '#0f172a' : i < step ? '#f1f5f9' : 'transparent',
              color: i === step ? '#fff' : i < step ? '#0f172a' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', cursor: 'default'
            }}>
              {i < step ? <CheckCircle size={16} className="text-success" /> : s.icon}
              <span className="desktop-only" style={{ display: i === step ? 'inline' : 'none' }} >{s.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'var(--error-container)', color: 'var(--error)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* Main Form Card */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ background: '#fff', padding: '2.5rem', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
            
            {/* STEP 1: Details */}
            {step === 0 && (
              <div className="grid grid-cols-1 gap-5" style={{ animation: 'fadeIn 0.4s ease' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={20} className="text-primary"/> Personal Details</h2>
                
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Full Name <span className="text-error">*</span></label>
                  <input className="input" type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="e.g. Rahul Sharma" style={{ height: '54px', fontSize: '1.05rem', backgroundColor: '#f8fafc', border: '2px solid transparent' }} />
                </div>
                
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Mobile Number <span className="text-error">*</span></label>
                  <div className="input-with-prefix" style={{ height: '54px', backgroundColor: '#f8fafc', border: '2px solid transparent' }}>
                    <div className="input-prefix" style={{ fontWeight: 800, background: '#e2e8f0', border: 'none' }}>+91</div>
                    <input className="input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} required maxLength={10} placeholder="10-digit number" style={{ fontSize: '1.05rem' }} />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Email Address (Optional)</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="For digital receipts" style={{ height: '54px', fontSize: '1.05rem', backgroundColor: '#f8fafc', border: '2px solid transparent' }} />
                </div>
              </div>
            )}

            {/* STEP 2: Product */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-5" style={{ animation: 'fadeIn 0.4s ease' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Cpu size={20} className="text-primary"/> Product Information</h2>
                
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>What product needs service? <span className="text-error">*</span></label>
                  <select className="select" value={form.productType} onChange={(e) => update('productType', e.target.value)} required style={{ height: '54px', fontSize: '1.05rem', backgroundColor: '#f8fafc', border: '2px solid transparent', fontWeight: 600 }}>
                    <option value="" disabled>Select Appliance Type</option>
                    {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Model Number (Optional)</label>
                    <input className="input" type="text" value={form.productModel} onChange={(e) => update('productModel', e.target.value)} placeholder="e.g. TGS-150W" style={{ height: '54px', backgroundColor: '#f8fafc', border: '2px solid transparent' }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Serial Number (Optional)</label>
                    <input className="input" type="text" value={form.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} placeholder="Found on back sticker" style={{ height: '54px', backgroundColor: '#f8fafc', border: '2px solid transparent' }} />
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Upload Invoice / Warranty Card <span style={{opacity:0.6, fontWeight:500}}>(Optional but recommended)</span></label>
                  <input type="file" ref={invoiceInputRef} onChange={handleInvoiceUpload} accept="image/*,.pdf" style={{ display: 'none' }} />
                  <div 
                    onClick={() => invoiceInputRef.current?.click()}
                    style={{ 
                      border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', 
                      cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#0f172a'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <FileText size={32} style={{ color: form.invoice ? '#16a34a' : '#94a3b8' }} />
                    <p style={{ fontWeight: 700, color: form.invoice ? '#16a34a' : '#475569', fontSize: '0.9rem' }}>
                      {form.invoice ? form.invoice.name : 'Tap to upload invoice document'}
                    </p>
                    {!form.invoice && <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Supports JPG, PNG, PDF</p>}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Issue */}
            {step === 2 && (
              <div className="grid grid-cols-1 gap-5" style={{ animation: 'fadeIn 0.4s ease' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={20} className="text-primary"/> Define The Issue</h2>
                
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Describe the problem <span className="text-error">*</span></label>
                  <textarea className="input" value={form.issueDescription} onChange={(e) => update('issueDescription', e.target.value)} required style={{ minHeight: '120px', fontSize: '1.05rem', backgroundColor: '#f8fafc', border: '2px solid transparent', padding: '1rem' }} placeholder="E.g. The AC is blowing warm air instead of cooling..." />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Upload Issue Photos <span style={{opacity:0.6, fontWeight:500}}>(Optional)</span></label>
                  <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" multiple style={{ display: 'none' }} />
                  <div 
                    onClick={() => photoInputRef.current?.click()}
                    style={{ 
                      border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', 
                      cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#0f172a'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <Camera size={32} style={{ color: form.photos.length > 0 ? '#16a34a' : '#94a3b8' }} />
                    <p style={{ fontWeight: 700, color: form.photos.length > 0 ? '#16a34a' : '#475569', fontSize: '0.9rem' }}>
                      {form.photos.length > 0 ? `${form.photos.length} photos selected` : 'Tap to take or choose photos'}
                    </p>
                    {!form.photos.length && <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Helpful for visible damage</p>}
                  </div>
                </div>

                <div className="divider" style={{ margin: '0.5rem 0' }} />

                <div className="grid grid-cols-1 gap-4">
                  <div className="input-group">
                     <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Pincode <span className="text-error">*</span></label>
                     <input className="input" type="text" value={form.pincode} onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} required maxLength={6} placeholder="6-digit area code" style={{ height: '54px', fontSize: '1.05rem', backgroundColor: '#f8fafc', border: '2px solid transparent', fontWeight: 700, letterSpacing: '0.1em' }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label" style={{ fontWeight: 700, color: '#1e293b' }}>Service Address <span className="text-error">*</span></label>
                    <textarea className="input" value={form.address} onChange={(e) => update('address', e.target.value)} required placeholder="House/Flat No, Street Name, Landmark" style={{ minHeight: '80px', backgroundColor: '#f8fafc', border: '2px solid transparent' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {step > 0 && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, height: '56px', fontSize: '1.1rem', borderRadius: '16px', background: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} 
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={20} /> Back
              </button>
            )}
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 2, height: '56px', fontSize: '1.1rem', borderRadius: '16px', background: '#0f172a', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.3)' }} 
              disabled={isLoading}
            >
              {step < 2 ? (
                <>Next Step <ArrowRight size={20} /></>
              ) : isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                   Submitting Order...
                </div>
              ) : (
                <>Book Service Now <CheckCircle size={20} /></>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 'auto' }}>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>© {new Date().getFullYear()} TG SMART Customer Service</p>
        <a href="/login" style={{ fontSize: '0.75rem', color: '#0f172a', textDecoration: 'none', fontWeight: 700, opacity: 0.5, letterSpacing: '0.05em' }}>STAFF PORTAL LOGIN</a>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .input:focus, .select:focus, .input-with-prefix:focus-within {
          border-color: #0f172a !important;
          background-color: #fff !important;
          box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
