import { supabase } from '../supabase/client';

const ADMIN_EMAIL = 'offerrajelectronics@gmail.com';
const DOMAIN = window.location.host;

/**
 * Core function to trigger the Supabase RPC for sending emails via Resend.
 */
export async function sendEmail(toEmail: string, subject: string, htmlBody: string) {
  try {
    const { data, error } = await (supabase as any).rpc('send_email_resend', { 
      to_email: toEmail, 
      subject: subject,
      html_body: htmlBody
    });

    if (error) {
      console.error('Email API Error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Email queued successfully.' };
  } catch (err) {
    console.error('Email Gateway Error:', err);
    return { success: false, message: "Server Communication Error" };
  }
}

/**
 * 1 & 2: Notify Customer & Admin about a New Ticket
 */
export async function notifyNewTicket(ticket: any, customerEmail?: string) {
  const subject = `TG SMART: Ticket #${ticket.ticket_number} Created`;
  const trackingUrl = `https://${DOMAIN}/track`;

  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 25px; border: 1px solid #0f172a; border-radius: 12px;">
      <h2 style="color: #0f172a; margin-top: 0;">We’ve Received Your Request</h2>
      <p>Hello <strong>${ticket.customer_name || 'Customer'}</strong>,</p>
      <p>Your repair ticket for the <strong>${ticket.product_type}</strong> has been successfully registered. Our technical team is reviewing it right now.</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 25px 0;">
        <p style="margin: 0; font-size: 1.2rem;">Ticket ID: <strong style="color: #0f172a;">#${ticket.ticket_number}</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">Status: 🟡 Waiting for Assignment</p>
      </div>
      <p style="margin-bottom: 25px;">You can track the live status of your repair anytime by clicking the button below:</p>
      <a href="${trackingUrl}" style="display: inline-block; background: #0f172a; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Track Live Status</a>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #eee; pt: 20px;">© ${new Date().getFullYear()} TG SMART Customer Support</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 2px solid #0f172a; border-radius: 12px;">
      <h2 style="color: #0f172a;">NEW CUSTOMER REQUEST 🚨</h2>
      <p>A new service ticket has been submitted via the portal.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
        <tr><td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Ticket:</strong></td><td style="padding: 12px; border: 1px solid #e2e8f0;">#${ticket.ticket_number}</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Customer:</strong></td><td style="padding: 12px; border: 1px solid #e2e8f0;">${ticket.customer_name}</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Product:</strong></td><td style="padding: 12px; border: 1px solid #e2e8f0;">${ticket.product_type}</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Issue:</strong></td><td style="padding: 12px; border: 1px solid #e2e8f0;">${ticket.issue_description}</td></tr>
      </table>
      <a href="https://${DOMAIN}/admin/tickets/${ticket.id}" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Assign Technician Now</a>
    </div>
  `;

  if (customerEmail && customerEmail.includes('@')) {
    await sendEmail(customerEmail, subject, customerHtml);
  }
  await sendEmail(ADMIN_EMAIL, `New Ticket Alert: #${ticket.ticket_number} - ${ticket.customer_name}`, adminHtml);
}

/**
 * 3: Phase 2 - Notify Customer (and Admin) that Tech is Assigned
 */
export async function notifyTechnicianAssigned(ticket: any, customerEmail: string, techName: string) {
  const subject = `UPDATE: Technician Assigned for Ticket #${ticket.ticket_number}`;
  
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 25px; border: 1px solid #0f172a; border-radius: 12px;">
      <h2 style="color: #0f172a;">Technician Assigned! 🛠️</h2>
      <p>Great news! We have assigned a professional technician to your repair request.</p>
      <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0; margin: 25px 0;">
        <p style="margin: 0;">Assigned Technician: <strong style="color: #166534; font-size: 1.1rem;">${techName}</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #166534;">Status: 🟢 Dispatched / On the Way</p>
      </div>
      <p>The technician will contact you shortly on your registered mobile number to confirm the visit time.</p>
      <a href="https://${DOMAIN}/track" style="display: inline-block; background: #0f172a; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Track Real-Time Status</a>
    </div>
  `;

  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0f172a;">Dispatch Confirmation ✅</h2>
      <p>Ticket <strong>#${ticket.ticket_number}</strong> has been assigned to <strong>${techName}</strong>.</p>
      <p>Customer: ${ticket.customer_name}</p>
      <p>A notification has been sent to the customer.</p>
    </div>
  `;

  if (customerEmail && customerEmail.includes('@')) {
    await sendEmail(customerEmail, subject, customerHtml);
  }
  await sendEmail(ADMIN_EMAIL, `Dispatched: #${ticket.ticket_number} -> ${techName}`, adminHtml);
}

/**
 * 4 & 5: Notify Customer & Admin about Resolution
 */
export async function notifyTicketResolved(ticket: any, customerEmail?: string) {
  const subject = `TG SMART: Ticket #${ticket.ticket_number} Resolved Successfully`;

  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 30px; border: 2px solid #16a34a; border-radius: 16px; text-align: center;">
      <div style="font-size: 60px; margin-bottom: 20px;">✨</div>
      <h2 style="color: #166534; font-size: 1.5rem; margin-top: 0;">Perfect! Your Repair is Done.</h2>
      <p style="color: #475569;">Hello <strong>${ticket.customer_name}</strong>, your ticket <strong>#${ticket.ticket_number}</strong> has been marked as <strong>Resolved</strong>.</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px dashed #cbd5e1; text-align: left;">
        <p style="margin: 0; font-size: 14px; color: #64748b; font-weight: 700;">SERVICE SUMMARY:</p>
        <p style="margin: 10px 0 0 0; color: #0f172a;">Product Type: ${ticket.product_type}</p>
        <p style="margin: 5px 0 0 0; color: #0f172a;">Assigned Technician: ${ticket.assigned_to_name || 'TG Specialist'}</p>
      </div>
      <p>Thank you for trusting TG SMART for your appliance repairs. We hope you had a great experience!</p>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} TG SMART Service Network</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #16a34a; border-radius: 12px;">
      <h2 style="color: #166534;">TICKET RESOLVED ✅</h2>
      <p>Technician has closed Ticket <strong>#${ticket.ticket_number}</strong>.</p>
      <p><strong>Work Performed:</strong><br/>${ticket.service_notes || 'Resolved successfully.'}</p>
      <a href="https://${DOMAIN}/admin/tickets/${ticket.id}" style="display: inline-block; background: #0f172a; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Review Final Case File</a>
    </div>
  `;

  if (customerEmail && customerEmail.includes('@')) {
    await sendEmail(customerEmail, subject, customerHtml);
  }
  await sendEmail(ADMIN_EMAIL, `Closed: Ticket #${ticket.ticket_number} Resolved`, adminHtml);
}
