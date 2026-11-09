/**
 * Supabase generated types.
 *
 * Run `supabase gen types typescript --local > src/lib/supabase/types.ts`
 * after `supabase start` to replace this stub with the real types.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cities: {
        Row: {
          id: number;
          name: string;
          state: string;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          state: string;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          state?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      event_types: {
        Row: {
          id: number;
          slug: string;
          name: string;
        };
        Insert: {
          id?: number;
          slug: string;
          name: string;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: "organizer" | "sponsor" | "general" | "admin";
          full_name: string | null;
          phone: string | null;
          city_id: number | null;
          preferred_language: "en" | "hi" | "gu";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "organizer" | "sponsor" | "general" | "admin";
          full_name?: string | null;
          phone?: string | null;
          city_id?: number | null;
          preferred_language?: "en" | "hi" | "gu";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "organizer" | "sponsor" | "general" | "admin";
          full_name?: string | null;
          phone?: string | null;
          city_id?: number | null;
          preferred_language?: "en" | "hi" | "gu";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizer_profiles: {
        Row: {
          user_id: string;
          org_name: string;
          org_type: "society" | "club" | "company" | "other";
          venue_name: string | null;
          social_link: string | null;
          proof_note: string | null;
          verification_status: "pending" | "approved" | "rejected";
          verified_at: string | null;
          verified_by: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          org_name: string;
          org_type?: "society" | "club" | "company" | "other";
          venue_name?: string | null;
          social_link?: string | null;
          proof_note?: string | null;
          verification_status?: "pending" | "approved" | "rejected";
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          org_name?: string;
          org_type?: "society" | "club" | "company" | "other";
          venue_name?: string | null;
          social_link?: string | null;
          proof_note?: string | null;
          verification_status?: "pending" | "approved" | "rejected";
          verified_at?: string | null;
          verified_by?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsor_profiles: {
        Row: {
          user_id: string;
          company_name: string;
          industry: string | null;
          budget_min_paise: number | null;
          budget_max_paise: number | null;
          target_city_ids: number[];
          plan: "basic" | "premium";
          subscription_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          company_name: string;
          industry?: string | null;
          budget_min_paise?: number | null;
          budget_max_paise?: number | null;
          target_city_ids?: number[];
          plan?: "basic" | "premium";
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          company_name?: string;
          industry?: string | null;
          budget_min_paise?: number | null;
          budget_max_paise?: number | null;
          target_city_ids?: number[];
          plan?: "basic" | "premium";
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string | null;
          event_type_id: number;
          city_id: number;
          venue: string | null;
          season: string | null;
          start_date: string;
          end_date: string;
          expected_audience: number | null;
          audience_notes: string | null;
          visibility: "public" | "private";
          ticketing: "none" | "ticketed";
          status: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "completed";
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          title: string;
          description?: string | null;
          event_type_id: number;
          city_id: number;
          venue?: string | null;
          season?: string | null;
          start_date: string;
          end_date: string;
          expected_audience?: number | null;
          audience_notes?: string | null;
          visibility?: "public" | "private";
          ticketing?: "none" | "ticketed";
          status?: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "completed";
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          title?: string;
          description?: string | null;
          event_type_id?: number;
          city_id?: number;
          venue?: string | null;
          season?: string | null;
          start_date?: string;
          end_date?: string;
          expected_audience?: number | null;
          audience_notes?: string | null;
          visibility?: "public" | "private";
          ticketing?: "none" | "ticketed";
          status?: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "completed";
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsorship_packages: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          price_paise: number;
          deliverables: string | null;
          slots_total: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          price_paise: number;
          deliverables?: string | null;
          slots_total?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          price_paise?: number;
          deliverables?: string | null;
          slots_total?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      interests: {
        Row: {
          id: string;
          sponsor_id: string;
          event_id: string;
          package_id: string | null;
          message: string | null;
          status: "new" | "contacted" | "in_discussion" | "closed" | "declined";
          contact_shared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sponsor_id: string;
          event_id: string;
          package_id?: string | null;
          message?: string | null;
          status?: "new" | "contacted" | "in_discussion" | "closed" | "declined";
          contact_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sponsor_id?: string;
          event_id?: string;
          package_id?: string | null;
          message?: string | null;
          status?: "new" | "contacted" | "in_discussion" | "closed" | "declined";
          contact_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          interest_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          interest_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          interest_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_fees: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          fee_type: "event_listing" | "sponsor_subscription";
          amount_paise: number;
          status: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id: string | null;
          gateway_payment_id: string | null;
          refund_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          fee_type: "event_listing" | "sponsor_subscription";
          amount_paise: number;
          status?: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          refund_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          fee_type?: "event_listing" | "sponsor_subscription";
          amount_paise?: number;
          status?: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          refund_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: "organizer" | "sponsor" | "general" | "admin";
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "organizer" | "sponsor" | "general" | "admin";
      verification_status: "pending" | "approved" | "rejected";
      organizer_type: "society" | "club" | "company" | "other";
      sponsor_plan: "basic" | "premium";
      event_visibility: "public" | "private";
      ticketing_mode: "none" | "ticketed";
      event_status: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "completed";
      interest_status: "new" | "contacted" | "in_discussion" | "closed" | "declined";
      fee_type: "event_listing" | "sponsor_subscription";
      fee_status: "pending" | "paid" | "failed" | "refunded";
    };
    CompositeTypes: Record<string, never>;
  };
};
