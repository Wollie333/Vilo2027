export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addons: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          host_id: string
          id: string
          image_path: string | null
          is_active: boolean
          is_required: boolean
          lead_time_days: number
          max_quantity: number | null
          min_quantity: number
          name: string
          pricing_model: string
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          host_id: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_required?: boolean
          lead_time_days?: number
          max_quantity?: number | null
          min_quantity?: number
          name: string
          pricing_model: string
          sort_order?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          host_id?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_required?: boolean
          lead_time_days?: number
          max_quantity?: number | null
          min_quantity?: number
          name?: string
          pricing_model?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          impersonating: string | null
          ip_address: unknown
          payload: Json | null
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          impersonating?: string | null
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          impersonating?: string | null
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_impersonating_fkey"
            columns: ["impersonating"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          created_at: string
          description: string | null
          domain: string
          key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string
          key?: string
        }
        Relationships: []
      }
      admin_role_permissions: {
        Row: {
          granted_at: string
          permission_key: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          permission_key: string
          role_id: string
        }
        Update: {
          granted_at?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "admin_permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "admin_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          date: string
          ical_feed_id: string | null
          id: string
          listing_id: string
          quote_id: string | null
          reason: string | null
          room_id: string | null
          source: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          ical_feed_id?: string | null
          id?: string
          listing_id: string
          quote_id?: string | null
          reason?: string | null
          room_id?: string | null
          source?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          ical_feed_id?: string | null
          id?: string
          listing_id?: string
          quote_id?: string | null
          reason?: string | null
          room_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_ical_feed_id_fkey"
            columns: ["ical_feed_id"]
            isOneToOne: false
            referencedRelation: "ical_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          addon_id: string | null
          booking_id: string
          created_at: string
          currency: string
          id: string
          is_required: boolean
          label: string
          pricing_model: string | null
          quantity: number
          sort_order: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          addon_id?: string | null
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          is_required?: boolean
          label: string
          pricing_model?: string | null
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price: number
        }
        Update: {
          addon_id?: string | null
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_required?: boolean
          label?: string
          pricing_model?: string | null
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notes: {
        Row: {
          author_id: string
          body: string
          booking_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          booking_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rooms: {
        Row: {
          base_amount: number
          booking_id: string
          cleaning_fee: number
          created_at: string
          id: string
          room_id: string
        }
        Insert: {
          base_amount: number
          booking_id: string
          cleaning_fee?: number
          created_at?: string
          id?: string
          room_id: string
        }
        Update: {
          base_amount?: number
          booking_id?: string
          cleaning_fee?: number
          created_at?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          actioned_by: string | null
          base_amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          check_in: string | null
          check_out: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          cleaning_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          declined_at: string | null
          deleted_at: string | null
          eft_proof_url: string | null
          guest_email: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guests_breakdown: Json | null
          guests_count: number
          has_open_refund: boolean | null
          host_id: string
          host_payment_note: string | null
          id: string
          internal_notes: string | null
          listing_id: string
          nights: number | null
          origin: string
          payment_method: string | null
          payment_status: string
          policy_acknowledged: boolean
          policy_acknowledged_at: string | null
          previous_status: string | null
          quote_id: string | null
          reference: string
          refund_total: number | null
          scope: string
          session_date: string | null
          special_requests: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          actioned_by?: string | null
          base_amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in?: string | null
          check_out?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          eft_proof_url?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_breakdown?: Json | null
          guests_count?: number
          has_open_refund?: boolean | null
          host_id: string
          host_payment_note?: string | null
          id?: string
          internal_notes?: string | null
          listing_id: string
          nights?: number | null
          origin?: string
          payment_method?: string | null
          payment_status?: string
          policy_acknowledged?: boolean
          policy_acknowledged_at?: string | null
          previous_status?: string | null
          quote_id?: string | null
          reference?: string
          refund_total?: number | null
          scope?: string
          session_date?: string | null
          special_requests?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          actioned_by?: string | null
          base_amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in?: string | null
          check_out?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          eft_proof_url?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_breakdown?: Json | null
          guests_count?: number
          has_open_refund?: boolean | null
          host_id?: string
          host_payment_note?: string | null
          id?: string
          internal_notes?: string | null
          listing_id?: string
          nights?: number | null
          origin?: string
          payment_method?: string | null
          payment_status?: string
          policy_acknowledged?: boolean
          policy_acknowledged_at?: string | null
          previous_status?: string | null
          quote_id?: string | null
          reference?: string
          refund_total?: number | null
          scope?: string
          session_date?: string | null
          special_requests?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          guest_id: string
          host_id: string
          id: string
          is_enquiry: boolean
          last_message_at: string | null
          last_message_preview: string | null
          listing_id: string | null
          status: string
          unread_guest: number
          unread_host: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          guest_id: string
          host_id: string
          id?: string
          is_enquiry?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          listing_id?: string | null
          status?: string
          unread_guest?: number
          unread_host?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          guest_id?: string
          host_id?: string
          id?: string
          is_enquiry?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          listing_id?: string | null
          status?: string
          unread_guest?: number
          unread_host?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          notes: string | null
          rejected_reason: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          rejected_reason?: string | null
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          rejected_reason?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_search_logs: {
        Row: {
          clicked_listing: string | null
          created_at: string
          filters: Json | null
          id: string
          query: string | null
          result_count: number | null
          session_id: string | null
        }
        Insert: {
          clicked_listing?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string | null
          result_count?: number | null
          session_id?: string | null
        }
        Update: {
          clicked_listing?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string | null
          result_count?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_search_logs_clicked_listing_fkey"
            columns: ["clicked_listing"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      eft_banking_details: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          branch_code: string
          created_at: string
          host_id: string
          id: string
          is_archived: boolean
          is_default: boolean
          label: string
          reference_format: string
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type?: string
          bank_name: string
          branch_code: string
          created_at?: string
          host_id: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          label?: string
          reference_format?: string
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          branch_code?: string
          created_at?: string
          host_id?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          label?: string
          reference_format?: string
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eft_banking_details_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_listings: {
        Row: {
          created_at: string
          expires_at: string | null
          featured_by: string
          id: string
          listing_id: string
          reason: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          featured_by: string
          id?: string
          listing_id: string
          reason?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          featured_by?: string
          id?: string
          listing_id?: string
          reason?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "featured_listings_featured_by_fkey"
            columns: ["featured_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      host_business_details: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string
          billing_postcode: string | null
          company_registration_number: string | null
          created_at: string
          host_id: string
          legal_name: string | null
          trading_name: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string
          billing_postcode?: string | null
          company_registration_number?: string | null
          created_at?: string
          host_id: string
          legal_name?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string
          billing_postcode?: string | null
          company_registration_number?: string | null
          created_at?: string
          host_id?: string
          legal_name?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_business_details_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      host_counters: {
        Row: {
          host_id: string
          last_invoice_number: number
          last_quote_number: number
          updated_at: string
        }
        Insert: {
          host_id: string
          last_invoice_number?: number
          last_quote_number?: number
          updated_at?: string
        }
        Update: {
          host_id?: string
          last_invoice_number?: number
          last_quote_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_counters_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      host_feature_overrides: {
        Row: {
          created_at: string
          expires_at: string | null
          feature_key: string
          host_id: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          overridden_by: string
          reason: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          feature_key: string
          host_id: string
          id?: string
          is_enabled: boolean
          limit_value?: number | null
          overridden_by: string
          reason: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          feature_key?: string
          host_id?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          overridden_by?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_feature_overrides_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_feature_overrides_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hosts: {
        Row: {
          avatar_url: string | null
          avg_rating: number | null
          avg_response_hours: number | null
          bio: string | null
          cover_photo_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          handle: string
          id: string
          is_active: boolean
          is_verified: boolean
          languages_spoken: string[] | null
          response_rate: number | null
          social_links: Json | null
          total_bookings: number
          total_reviews: number
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          handle: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          languages_spoken?: string[] | null
          response_rate?: number | null
          social_links?: Json | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          handle?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          languages_spoken?: string[] | null
          response_rate?: number | null
          social_links?: Json | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_feeds: {
        Row: {
          created_at: string
          id: string
          imported_count: number
          last_error: string | null
          last_sync_at: string | null
          listing_id: string
          source_label: string
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_count?: number
          last_error?: string | null
          last_sync_at?: string | null
          listing_id: string
          source_label: string
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_count?: number
          last_error?: string | null
          last_sync_at?: string | null
          listing_id?: string
          source_label?: string
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_feeds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          target_user_id: string
        }
        Insert: {
          admin_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          target_user_id: string
        }
        Update: {
          admin_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "in_app_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          booking_id: string
          cancelled_at: string | null
          created_at: string
          currency: string
          guest_id: string | null
          guest_snapshot: Json
          host_id: string
          host_snapshot: Json
          hosted_token: string
          id: string
          invoice_number: string
          issued_at: string
          line_items: Json
          paid_at: string | null
          pdf_storage_path: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          booking_id: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          guest_snapshot: Json
          host_id: string
          host_snapshot: Json
          hosted_token?: string
          id?: string
          invoice_number: string
          issued_at?: string
          line_items: Json
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          booking_id?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          guest_snapshot?: Json
          host_id?: string
          host_snapshot?: Json
          hosted_token?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          line_items?: Json
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          listing_id: string
          room_id: string | null
          unit_price_override: number | null
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          listing_id: string
          room_id?: string | null
          unit_price_override?: number | null
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          room_id?: string | null
          unit_price_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_addons_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_addons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_amenities: {
        Row: {
          amenity_key: string
          amenity_label: string | null
          id: string
          listing_id: string
          room_id: string | null
        }
        Insert: {
          amenity_key: string
          amenity_label?: string | null
          id?: string
          listing_id: string
          room_id?: string | null
        }
        Update: {
          amenity_key?: string
          amenity_label?: string | null
          id?: string
          listing_id?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_amenities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          listing_id: string
          room_id: string | null
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          listing_id: string
          room_id?: string | null
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          room_id?: string | null
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_photos_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_policies: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          listing_id: string
          policy_id: string
          policy_type: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          listing_id: string
          policy_id: string
          policy_type: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          listing_id?: string
          policy_id?: string
          policy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_policies_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_policies_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_policies_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_rankings: {
        Row: {
          component_plan_boost: number
          component_profile: number
          component_rating: number
          component_response_rate: number
          component_reviews: number
          last_calculated: string
          listing_id: string
          ranking_score: number
        }
        Insert: {
          component_plan_boost?: number
          component_profile?: number
          component_rating?: number
          component_response_rate?: number
          component_reviews?: number
          last_calculated?: string
          listing_id: string
          ranking_score?: number
        }
        Update: {
          component_plan_boost?: number
          component_profile?: number
          component_rating?: number
          component_response_rate?: number
          component_reviews?: number
          last_calculated?: string
          listing_id?: string
          ranking_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_rankings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_rooms: {
        Row: {
          base_price: number
          bathrooms: number | null
          bed_type: string | null
          bedrooms: number | null
          cleaning_fee: number
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          experiences: string[]
          featured_photo_id: string | null
          floor_number: number | null
          has_ensuite_bathroom: boolean
          id: string
          inventory_count: number
          is_active: boolean
          listing_id: string
          max_guests: number
          name: string
          pets_allowed: boolean
          private_entrance: boolean
          room_size_sqm: number | null
          smoking_allowed: boolean
          sort_order: number
          updated_at: string
          view_type: string | null
          weekend_price: number | null
          wheelchair_accessible: boolean
        }
        Insert: {
          base_price: number
          bathrooms?: number | null
          bed_type?: string | null
          bedrooms?: number | null
          cleaning_fee?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          experiences?: string[]
          featured_photo_id?: string | null
          floor_number?: number | null
          has_ensuite_bathroom?: boolean
          id?: string
          inventory_count?: number
          is_active?: boolean
          listing_id: string
          max_guests?: number
          name: string
          pets_allowed?: boolean
          private_entrance?: boolean
          room_size_sqm?: number | null
          smoking_allowed?: boolean
          sort_order?: number
          updated_at?: string
          view_type?: string | null
          weekend_price?: number | null
          wheelchair_accessible?: boolean
        }
        Update: {
          base_price?: number
          bathrooms?: number | null
          bed_type?: string | null
          bedrooms?: number | null
          cleaning_fee?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          experiences?: string[]
          featured_photo_id?: string | null
          floor_number?: number | null
          has_ensuite_bathroom?: boolean
          id?: string
          inventory_count?: number
          is_active?: boolean
          listing_id?: string
          max_guests?: number
          name?: string
          pets_allowed?: boolean
          private_entrance?: boolean
          room_size_sqm?: number | null
          smoking_allowed?: boolean
          sort_order?: number
          updated_at?: string
          view_type?: string | null
          weekend_price?: number | null
          wheelchair_accessible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listing_rooms_featured_photo_id_fkey"
            columns: ["featured_photo_id"]
            isOneToOne: false
            referencedRelation: "listing_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_rooms_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_seasonal_pricing: {
        Row: {
          created_at: string
          currency: string
          end_date: string
          id: string
          is_active: boolean
          label: string
          listing_id: string
          min_nights: number | null
          price: number
          priority: number
          room_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          end_date: string
          id?: string
          is_active?: boolean
          label: string
          listing_id: string
          min_nights?: number | null
          price: number
          priority?: number
          room_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          end_date?: string
          id?: string
          is_active?: boolean
          label?: string
          listing_id?: string
          min_nights?: number | null
          price?: number
          priority?: number
          room_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_seasonal_pricing_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_seasonal_pricing_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          accepts_eft: boolean
          accepts_paypal: boolean
          accepts_paystack: boolean
          accommodation_type: string | null
          address_line1: string | null
          address_line2: string | null
          avg_rating: number | null
          base_price: number | null
          bathrooms: number | null
          bedrooms: number | null
          booking_mode: string
          cancellation_policy: string
          cancellation_policy_label: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          cleaning_fee: number | null
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number | null
          experience_type: string | null
          host_id: string
          house_rules: string | null
          id: string
          instant_booking: boolean
          is_featured: boolean
          is_non_refundable: boolean
          is_published: boolean
          is_suspended: boolean
          latitude: number | null
          listing_type: string
          location: unknown
          longitude: number | null
          max_guests: number | null
          max_nights: number | null
          max_participants: number | null
          meeting_point: string | null
          min_nights: number | null
          min_participants: number | null
          name: string
          postal_code: string | null
          private_group_price: number | null
          province: string | null
          published_at: string | null
          room_config: Json | null
          schedule: Json | null
          search_vector: unknown
          slug: string | null
          total_bookings: number
          total_reviews: number
          updated_at: string
          weekend_price: number | null
          what_to_bring: string | null
        }
        Insert: {
          accepts_eft?: boolean
          accepts_paypal?: boolean
          accepts_paystack?: boolean
          accommodation_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          avg_rating?: number | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_mode?: string
          cancellation_policy?: string
          cancellation_policy_label?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          cleaning_fee?: number | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          experience_type?: string | null
          host_id: string
          house_rules?: string | null
          id?: string
          instant_booking?: boolean
          is_featured?: boolean
          is_non_refundable?: boolean
          is_published?: boolean
          is_suspended?: boolean
          latitude?: number | null
          listing_type: string
          location?: unknown
          longitude?: number | null
          max_guests?: number | null
          max_nights?: number | null
          max_participants?: number | null
          meeting_point?: string | null
          min_nights?: number | null
          min_participants?: number | null
          name: string
          postal_code?: string | null
          private_group_price?: number | null
          province?: string | null
          published_at?: string | null
          room_config?: Json | null
          schedule?: Json | null
          search_vector?: unknown
          slug?: string | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          weekend_price?: number | null
          what_to_bring?: string | null
        }
        Update: {
          accepts_eft?: boolean
          accepts_paypal?: boolean
          accepts_paystack?: boolean
          accommodation_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          avg_rating?: number | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_mode?: string
          cancellation_policy?: string
          cancellation_policy_label?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          cleaning_fee?: number | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          experience_type?: string | null
          host_id?: string
          house_rules?: string | null
          id?: string
          instant_booking?: boolean
          is_featured?: boolean
          is_non_refundable?: boolean
          is_published?: boolean
          is_suspended?: boolean
          latitude?: number | null
          listing_type?: string
          location?: unknown
          longitude?: number | null
          max_guests?: number | null
          max_nights?: number | null
          max_participants?: number | null
          meeting_point?: string | null
          min_nights?: number | null
          min_participants?: number | null
          name?: string
          postal_code?: string | null
          private_group_price?: number | null
          province?: string | null
          published_at?: string | null
          room_config?: Json | null
          schedule?: Json | null
          search_vector?: unknown
          slug?: string | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          weekend_price?: number | null
          what_to_bring?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          host_id: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          host_id: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          host_id?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_filename: string | null
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          is_system_message: boolean
          read_at: string | null
          read_by_guest: boolean
          read_by_host: boolean
          sender_id: string | null
          system_event: string | null
        }
        Insert: {
          attachment_filename?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          read_at?: string | null
          read_by_guest?: boolean
          read_by_host?: boolean
          sender_id?: string | null
          system_event?: string | null
        }
        Update: {
          attachment_filename?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          read_at?: string | null
          read_by_guest?: boolean
          read_by_host?: boolean
          sender_id?: string | null
          system_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string
          error: string | null
          failed_at: string | null
          guest_id: string | null
          host_id: string | null
          id: string
          payload: Json
          sent_at: string | null
          type: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed_at?: string | null
          guest_id?: string | null
          host_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          type: string
        }
        Update: {
          created_at?: string
          error?: string | null
          failed_at?: string | null
          guest_id?: string | null
          host_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          authorised_at: string | null
          booking_id: string
          captured_at: string | null
          created_at: string
          currency: string
          eft_proof_url: string | null
          failed_at: string | null
          id: string
          method: string
          provider_reference: string | null
          provider_response: Json | null
          refunded_amount: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          authorised_at?: string | null
          booking_id: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          eft_proof_url?: string | null
          failed_at?: string | null
          id?: string
          method: string
          provider_reference?: string | null
          provider_response?: Json | null
          refunded_amount?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          authorised_at?: string | null
          booking_id?: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          eft_proof_url?: string | null
          failed_at?: string | null
          id?: string
          method?: string
          provider_reference?: string | null
          provider_response?: Json | null
          refunded_amount?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          description: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          plan: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          plan: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          plan?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_staff: {
        Row: {
          accepted_at: string | null
          created_at: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          last_active_at: string | null
          mfa_enrolled_at: string | null
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_active_at?: string | null
          mfa_enrolled_at?: string | null
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_active_at?: string | null
          mfa_enrolled_at?: string | null
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_staff_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_staff_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_staff_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_staff_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          created_at: string
          deleted_at: string | null
          host_id: string
          id: string
          is_non_refundable: boolean
          name: string
          parent_policy_id: string | null
          preset: string | null
          status: string
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          host_id: string
          id?: string
          is_non_refundable?: boolean
          name: string
          parent_policy_id?: string | null
          preset?: string | null
          status?: string
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          host_id?: string
          id?: string
          is_non_refundable?: boolean
          name?: string
          parent_policy_id?: string | null
          preset?: string | null
          status?: string
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policies_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_cancellation_rules: {
        Row: {
          days_before: number
          id: string
          label: string
          policy_id: string
          refund_percent: number
          sort_order: number
        }
        Insert: {
          days_before: number
          id?: string
          label: string
          policy_id: string
          refund_percent: number
          sort_order?: number
        }
        Update: {
          days_before?: number
          id?: string
          label?: string
          policy_id?: string
          refund_percent?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_cancellation_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_content: {
        Row: {
          body_html: string
          body_plain: string | null
          created_at: string
          id: string
          locale: string
          policy_id: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_plain?: string | null
          created_at?: string
          id?: string
          locale?: string
          policy_id: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_plain?: string | null
          created_at?: string
          id?: string
          locale?: string
          policy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_content_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_snapshots: {
        Row: {
          booking_id: string
          id: string
          policy_id: string
          policy_name: string
          policy_type: string
          policy_version: number
          snapshot_data: Json
          snapshotted_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          policy_id: string
          policy_name: string
          policy_type: string
          policy_version: number
          snapshot_data: Json
          snapshotted_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          policy_id?: string
          policy_name?: string
          policy_type?: string
          policy_version?: number
          snapshot_data?: Json
          snapshotted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_snapshots_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_addons: {
        Row: {
          created_at: string
          id: string
          label: string
          quantity: number
          quote_id: string
          sort_order: number
          subtotal: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          quantity?: number
          quote_id: string
          sort_order?: number
          subtotal?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          subtotal?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_addons_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_rooms: {
        Row: {
          base_amount: number
          cleaning_fee: number
          created_at: string
          id: string
          quote_id: string
          room_id: string
        }
        Insert: {
          base_amount: number
          cleaning_fee?: number
          created_at?: string
          id?: string
          quote_id: string
          room_id: string
        }
        Update: {
          base_amount?: number
          cleaning_fee?: number
          created_at?: string
          id?: string
          quote_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_rooms_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accept_token: string
          accepted_at: string | null
          addons_total: number
          base_amount: number
          check_in: string
          check_out: string
          cleaning_fee: number
          converted_at: string | null
          converted_booking_id: string | null
          created_at: string
          currency: string
          declined_at: string | null
          deleted_at: string | null
          guest_email: string
          guest_id: string | null
          guest_name: string
          guest_phone: string | null
          headcount: number
          host_id: string
          id: string
          listing_id: string
          notes: string | null
          policy_snapshot: Json | null
          previous_status: string | null
          quote_number: string
          scope: string
          sent_at: string | null
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accept_token?: string
          accepted_at?: string | null
          addons_total?: number
          base_amount: number
          check_in: string
          check_out: string
          cleaning_fee?: number
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          guest_email: string
          guest_id?: string | null
          guest_name: string
          guest_phone?: string | null
          headcount?: number
          host_id: string
          id?: string
          listing_id: string
          notes?: string | null
          policy_snapshot?: Json | null
          previous_status?: string | null
          quote_number: string
          scope?: string
          sent_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accept_token?: string
          accepted_at?: string | null
          addons_total?: number
          base_amount?: number
          check_in?: string
          check_out?: string
          cleaning_fee?: number
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          guest_email?: string
          guest_id?: string | null
          guest_name?: string
          guest_phone?: string | null
          headcount?: number
          host_id?: string
          id?: string
          listing_id?: string
          notes?: string | null
          policy_snapshot?: Json | null
          previous_status?: string | null
          quote_number?: string
          scope?: string
          sent_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_booking_id_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          admin_actioned_at: string | null
          admin_actioned_by: string | null
          admin_decision: string | null
          admin_note: string | null
          approved_amount: number | null
          auto_refund_rule: string | null
          booking_id: string
          created_at: string
          currency: string
          decline_reason: string | null
          deleted_at: string | null
          escalated_at: string | null
          escalation_note: string | null
          guest_banking_details: Json | null
          guest_id: string
          host_id: string
          host_note: string | null
          id: string
          initiated_by: string
          is_auto_refund: boolean
          is_manual: boolean
          manual_note: string | null
          manual_sent_at: string | null
          payment_id: string
          policy_entitlement: number | null
          policy_name: string | null
          policy_snapshot_id: string | null
          provider_refund_id: string | null
          provider_response: Json | null
          reason: string
          reason_detail: string | null
          requested_amount: number
          status: string
          supporting_doc_url: string | null
          updated_at: string
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          admin_actioned_at?: string | null
          admin_actioned_by?: string | null
          admin_decision?: string | null
          admin_note?: string | null
          approved_amount?: number | null
          auto_refund_rule?: string | null
          booking_id: string
          created_at?: string
          currency?: string
          decline_reason?: string | null
          deleted_at?: string | null
          escalated_at?: string | null
          escalation_note?: string | null
          guest_banking_details?: Json | null
          guest_id: string
          host_id: string
          host_note?: string | null
          id?: string
          initiated_by?: string
          is_auto_refund?: boolean
          is_manual?: boolean
          manual_note?: string | null
          manual_sent_at?: string | null
          payment_id: string
          policy_entitlement?: number | null
          policy_name?: string | null
          policy_snapshot_id?: string | null
          provider_refund_id?: string | null
          provider_response?: Json | null
          reason: string
          reason_detail?: string | null
          requested_amount: number
          status?: string
          supporting_doc_url?: string | null
          updated_at?: string
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          admin_actioned_at?: string | null
          admin_actioned_by?: string | null
          admin_decision?: string | null
          admin_note?: string | null
          approved_amount?: number | null
          auto_refund_rule?: string | null
          booking_id?: string
          created_at?: string
          currency?: string
          decline_reason?: string | null
          deleted_at?: string | null
          escalated_at?: string | null
          escalation_note?: string | null
          guest_banking_details?: Json | null
          guest_id?: string
          host_id?: string
          host_note?: string | null
          id?: string
          initiated_by?: string
          is_auto_refund?: boolean
          is_manual?: boolean
          manual_note?: string | null
          manual_sent_at?: string | null
          payment_id?: string
          policy_entitlement?: number | null
          policy_name?: string | null
          policy_snapshot_id?: string | null
          provider_refund_id?: string | null
          provider_response?: Json | null
          reason?: string
          reason_detail?: string | null
          requested_amount?: number
          status?: string
          supporting_doc_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_admin_actioned_by_fkey"
            columns: ["admin_actioned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_policy_snapshot_id_fkey"
            columns: ["policy_snapshot_id"]
            isOneToOne: false
            referencedRelation: "policy_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          refund_request_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          refund_request_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          refund_request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_status_history_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          is_manual: boolean
          manual_note: string | null
          payment_id: string
          processed_by: string | null
          provider_reference: string | null
          provider_response: Json | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          is_manual?: boolean
          manual_note?: string | null
          payment_id: string
          processed_by?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_manual?: boolean
          manual_note?: string | null
          payment_id?: string
          processed_by?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_flags: {
        Row: {
          created_at: string
          details: string | null
          flagged_by: string
          id: string
          reason: string
          review_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          flagged_by: string
          id?: string
          reason: string
          review_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          flagged_by?: string
          id?: string
          reason?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_flags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_request_queue: {
        Row: {
          booking_id: string
          created_at: string
          guest_id: string
          id: string
          sent_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          guest_id: string
          id?: string
          sent_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          guest_id?: string
          id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_request_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_request_queue_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          admin_actioned_by: string | null
          admin_decision: string | null
          body: string | null
          booking_id: string
          created_at: string
          flagged: boolean
          flagged_at: string | null
          flagged_reason: string | null
          guest_id: string
          host_id: string
          host_responded_at: string | null
          host_response: string | null
          id: string
          is_published: boolean
          listing_id: string
          publish_at: string | null
          rating: number
          review_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          admin_actioned_by?: string | null
          admin_decision?: string | null
          body?: string | null
          booking_id: string
          created_at?: string
          flagged?: boolean
          flagged_at?: string | null
          flagged_reason?: string | null
          guest_id: string
          host_id: string
          host_responded_at?: string | null
          host_response?: string | null
          id?: string
          is_published?: boolean
          listing_id: string
          publish_at?: string | null
          rating: number
          review_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_actioned_by?: string | null
          admin_decision?: string | null
          body?: string | null
          booking_id?: string
          created_at?: string
          flagged?: boolean
          flagged_at?: string | null
          flagged_reason?: string | null
          guest_id?: string
          host_id?: string
          host_responded_at?: string | null
          host_response?: string | null
          id?: string
          is_published?: boolean
          listing_id?: string
          publish_at?: string | null
          rating?: number
          review_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_admin_actioned_by_fkey"
            columns: ["admin_actioned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      room_beds: {
        Row: {
          bed_kind: string
          created_at: string
          id: string
          quantity: number
          room_id: string
          sort_order: number
        }
        Insert: {
          bed_kind: string
          created_at?: string
          id?: string
          quantity?: number
          room_id: string
          sort_order?: number
        }
        Update: {
          bed_kind?: string
          created_at?: string
          id?: string
          quantity?: number
          room_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "listing_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          host_id: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          host_id: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          host_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          host_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          amount_charged: number | null
          created_at: string
          currency: string | null
          event: string
          from_plan: string | null
          from_status: string | null
          host_id: string
          id: string
          notes: string | null
          performed_by: string | null
          subscription_id: string
          to_plan: string | null
          to_status: string | null
        }
        Insert: {
          amount_charged?: number | null
          created_at?: string
          currency?: string | null
          event: string
          from_plan?: string | null
          from_status?: string | null
          host_id: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          subscription_id: string
          to_plan?: string | null
          to_status?: string | null
        }
        Update: {
          amount_charged?: number | null
          created_at?: string
          currency?: string | null
          event?: string
          from_plan?: string | null
          from_status?: string | null
          host_id?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          subscription_id?: string
          to_plan?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          failed_payment_count: number
          grace_period_ends_at: string | null
          host_id: string
          id: string
          paypal_plan_id: string | null
          paypal_subscription_id: string | null
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          plan: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failed_payment_count?: number
          grace_period_ends_at?: string | null
          host_id: string
          id?: string
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failed_payment_count?: number
          grace_period_ends_at?: string | null
          host_id?: string
          id?: string
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      calculate_booking_price: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_listing_id: string
          p_room_id?: string
        }
        Returns: Json
      }
      calculate_policy_refund_amount: {
        Args: { p_booking_id: string; p_cancelled_at?: string }
        Returns: Json
      }
      check_feature_permission: {
        Args: { p_feature_key: string; p_host_id: string }
        Returns: Json
      }
      compute_addon_subtotal: {
        Args: {
          p_guests: number
          p_nights: number
          p_pricing_model: string
          p_quantity: number
          p_unit_price: number
        }
        Returns: number
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_in_app_notification: {
        Args: {
          p_body?: string
          p_kind: string
          p_link?: string
          p_payload?: Json
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      gen_url_token: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_host_inbox_stats: { Args: { p_host_id: string }; Returns: Json }
      get_host_refund_stats: { Args: { p_host_id: string }; Returns: Json }
      get_listing_availability: {
        Args: { p_listing_id: string; p_month: number; p_year: number }
        Returns: string[]
      }
      get_listing_policy_summary: {
        Args: { p_listing_id: string }
        Returns: Json
      }
      get_min_nights_for_stay: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_listing_id: string
          p_room_id: string
        }
        Returns: number
      }
      get_my_host_id: { Args: never; Returns: string }
      get_my_host_id_as_staff: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      gettransactionid: { Args: never; Returns: unknown }
      has_admin_permission: { Args: { p_key: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      listing_is_available_whole: {
        Args: { p_check_in: string; p_check_out: string; p_listing_id: string }
        Returns: boolean
      }
      log_subscription_event: {
        Args: {
          p_event: string
          p_from_plan: string
          p_from_status: string
          p_host_id: string
          p_notes?: string
          p_subscription_id: string
          p_to_plan: string
          p_to_status: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      next_invoice_number: { Args: { p_host_id: string }; Returns: string }
      next_quote_number: { Args: { p_host_id: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      recalculate_listing_ranking: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      room_is_available: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_listing_id: string
          p_room_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_booking_policies: {
        Args: { p_booking_id: string; p_listing_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
