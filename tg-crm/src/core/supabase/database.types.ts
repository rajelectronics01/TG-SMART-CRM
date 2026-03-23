// =============================================================================
// TG SERVICE CRM — DATABASE TYPES
// Auto-generate this with: npx supabase gen types typescript --project-id YOUR_ID
// For now, manually maintained. Run gen types after schema migrations.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TicketStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'parts_needed'
  | 'parts_ordered'
  | 'resolved'
  | 'cancelled';

export type SpareStatus = 'needed' | 'ordered' | 'delivered';

export type EmployeeRole = 'employee' | 'manager' | 'admin';

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
          address: string;
          pincode: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      employees: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string;
          role: EmployeeRole;
          is_active: boolean;
          created_at: string;
          last_login_at: string | null;
          parent_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      tickets: {
        Row: {
          id: string;
          ticket_number: string;
          customer_id: string;
          assigned_to: string | null;
          product_type: string;
          product_brand: string;
          product_model: string;
          serial_number: string | null;
          issue_description: string;
          invoice_url: string | null;
          status: TicketStatus;
          visit_date: string | null;
          photos: string[];
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          service_notes: string | null;
          service_photos: string[] | null;
          manager_id: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['tickets']['Row'],
          'id' | 'ticket_number' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
      };
      ticket_updates: {
        Row: {
          id: string;
          ticket_id: string;
          updated_by: string;
          old_status: TicketStatus;
          new_status: TicketStatus;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ticket_updates']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      spares: {
        Row: {
          id: string;
          ticket_id: string;
          part_name: string;
          part_number: string | null;
          quantity: number;
          status: SpareStatus;
          notes: string | null;
          added_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['spares']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['spares']['Insert']>;
      };
    };
  };
}

// Convenience types for use across the app
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type TicketUpdate = Database['public']['Tables']['ticket_updates']['Row'];
export type Spare = Database['public']['Tables']['spares']['Row'];

// Extended types with joins
export interface TicketWithDetails extends Ticket {
  customers: Customer;
  employees: Pick<Employee, 'id' | 'name'> | null;
  manager: Pick<Employee, 'id' | 'name'> | null;
}
