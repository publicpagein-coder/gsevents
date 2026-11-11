/**
 * Supabase generated types — updated after 20261110000000_stage1_decisions.sql.
 *
 * Run `supabase gen types typescript --local > src/lib/supabase/types.ts`
 * after `supabase start` to regenerate from the live schema.
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
          role: "organizer" | "sponsor" | "general" | "admin" | "super_admin";
          full_name: string | null;
          phone: string | null;
          city_id: number | null;
          preferred_language: "en" | "hi" | "gu";
          is_support: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "organizer" | "sponsor" | "general" | "admin" | "super_admin";
          full_name?: string | null;
          phone?: string | null;
          city_id?: number | null;
          preferred_language?: "en" | "hi" | "gu";
          is_support?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "organizer" | "sponsor" | "general" | "admin" | "super_admin";
          full_name?: string | null;
          phone?: string | null;
          city_id?: number | null;
          preferred_language?: "en" | "hi" | "gu";
          is_support?: boolean;
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
          authority_letter_path: string | null;
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
          authority_letter_path?: string | null;
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
          authority_letter_path?: string | null;
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
          base_paise: number | null;
          gst_paise: number | null;
          status: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id: string | null;
          gateway_payment_id: string | null;
          refund_reason: string | null;
          paid_at: string | null;
          review_alert_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          fee_type: "event_listing" | "sponsor_subscription";
          amount_paise: number;
          base_paise?: number | null;
          gst_paise?: number | null;
          status?: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          refund_reason?: string | null;
          paid_at?: string | null;
          review_alert_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          fee_type?: "event_listing" | "sponsor_subscription";
          amount_paise?: number;
          base_paise?: number | null;
          gst_paise?: number | null;
          status?: "pending" | "paid" | "failed" | "refunded";
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          refund_reason?: string | null;
          paid_at?: string | null;
          review_alert_sent_at?: string | null;
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
      settings: {
        Row: {
          id: number;
          listing_fee_paise: number;
          subscription_fee_paise: number;
          gst_rate_pct: number;
          gstin: string | null;
          launch_offer_text: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          listing_fee_paise?: number;
          subscription_fee_paise?: number;
          gst_rate_pct?: number;
          gstin?: string | null;
          launch_offer_text?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          listing_fee_paise?: number;
          subscription_fee_paise?: number;
          gst_rate_pct?: number;
          gstin?: string | null;
          launch_offer_text?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_change_requests: {
        Row: {
          id: string;
          event_id: string;
          proposed_fields: Json;
          proposed_packages: Json | null;
          new_authority_letter_path: string | null;
          status: "pending" | "approved" | "rejected";
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_alert_sent_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          proposed_fields: Json;
          proposed_packages?: Json | null;
          new_authority_letter_path?: string | null;
          status?: "pending" | "approved" | "rejected";
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_alert_sent_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          proposed_fields?: Json;
          proposed_packages?: Json | null;
          new_authority_letter_path?: string | null;
          status?: "pending" | "approved" | "rejected";
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_alert_sent_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: "organizer" | "sponsor" | "general" | "admin" | "super_admin";
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "organizer" | "sponsor" | "general" | "admin" | "super_admin";
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
