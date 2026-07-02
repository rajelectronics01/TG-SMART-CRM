import type { TicketStatus } from './supabase/database.types';

export const PORTAL_BASE_URL = 'https://support.tgsmart.in';

export const TICKET_STATUSES: TicketStatus[] = [
  'new',
  'assigned',
  'parts_needed',
  'resolved',
];

export const STATUS_LABELS: Record<TicketStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'badge badge-new' },
  assigned: { label: 'Assigned', className: 'badge badge-assigned' },
  parts_needed: { label: 'Parts Needed', className: 'badge badge-parts-needed' },
  resolved: { label: 'Resolved', className: 'badge badge-resolved' },
};
