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
      accounting_periods: {
        Row: {
          closed_at: string
          closed_by: string | null
          host_id: string
          id: string
          note: string | null
          period_month: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          host_id: string
          id?: string
          note?: string | null
          period_month: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          host_id?: string
          id?: string
          note?: string | null
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          allow_custom_quantity: boolean
          category: string | null
          created_at: string
          currency: string
          daily_capacity: number | null
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
          stock_quantity: number | null
          unit_price: number
          updated_at: string
          vat_included: boolean
        }
        Insert: {
          allow_custom_quantity?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          daily_capacity?: number | null
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
          stock_quantity?: number | null
          unit_price: number
          updated_at?: string
          vat_included?: boolean
        }
        Update: {
          allow_custom_quantity?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          daily_capacity?: number | null
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
          stock_quantity?: number | null
          unit_price?: number
          updated_at?: string
          vat_included?: boolean
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
      admin_message_batches: {
        Row: {
          body: string
          channels: Json
          created_at: string
          created_by: string
          id: string
          link_label: string | null
          link_url: string | null
          recipient_count: number | null
          recipient_ids: string[]
          severity: string
          title: string
        }
        Insert: {
          body: string
          channels?: Json
          created_at?: string
          created_by: string
          id?: string
          link_label?: string | null
          link_url?: string | null
          recipient_count?: number | null
          recipient_ids: string[]
          severity?: string
          title: string
        }
        Update: {
          body?: string
          channels?: Json
          created_at?: string
          created_by?: string
          id?: string
          link_label?: string | null
          link_url?: string | null
          recipient_count?: number | null
          recipient_ids?: string[]
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_message_batches_created_by_fkey"
            columns: ["created_by"]
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
      admin_support_grants: {
        Row: {
          created_at: string
          decided_at: string | null
          expires_at: string | null
          host_id: string
          host_user_id: string
          id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          expires_at?: string | null
          host_id: string
          host_user_id: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          expires_at?: string | null
          host_id?: string
          host_user_id?: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_support_grants_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_support_grants_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_support_grants_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_user_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          user_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          user_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_accounts: {
        Row: {
          accepted_at: string
          created_at: string
          currency: string
          default_payout_method: string | null
          id: string
          payout_threshold: number | null
          slug: string
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          currency?: string
          default_payout_method?: string | null
          id?: string
          payout_threshold?: number | null
          slug: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          terms_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          currency?: string
          default_payout_method?: string | null
          id?: string
          payout_threshold?: number | null
          slug?: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_accounts_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          landing_path: string | null
          referer: string | null
          slug: string
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          landing_path?: string | null
          referer?: string | null
          slug: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          landing_path?: string | null
          referer?: string | null
          slug?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          base_amount: number
          billing_period: number | null
          cleared_at: string | null
          commission_amount: number
          created_at: string
          currency: string
          entry_type: string
          hold_until: string
          id: string
          kind: string
          paid_at: string | null
          payout_id: string | null
          product_id: string | null
          rate_type: string
          rate_value: number
          referral_id: string
          referred_host_id: string | null
          refund_ledger_id: string | null
          source_ledger_id: string
          status: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          affiliate_id: string
          base_amount: number
          billing_period?: number | null
          cleared_at?: string | null
          commission_amount: number
          created_at?: string
          currency?: string
          entry_type?: string
          hold_until: string
          id?: string
          kind?: string
          paid_at?: string | null
          payout_id?: string | null
          product_id?: string | null
          rate_type: string
          rate_value: number
          referral_id: string
          referred_host_id?: string | null
          refund_ledger_id?: string | null
          source_ledger_id: string
          status?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          affiliate_id?: string
          base_amount?: number
          billing_period?: number | null
          cleared_at?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          entry_type?: string
          hold_until?: string
          id?: string
          kind?: string
          paid_at?: string | null
          payout_id?: string | null
          product_id?: string | null
          rate_type?: string
          rate_value?: number
          referral_id?: string
          referred_host_id?: string | null
          refund_ledger_id?: string | null
          source_ledger_id?: string
          status?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payout_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referred_host_id_fkey"
            columns: ["referred_host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_refund_ledger_id_fkey"
            columns: ["refund_ledger_id"]
            isOneToOne: false
            referencedRelation: "platform_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_source_ledger_id_fkey"
            columns: ["source_ledger_id"]
            isOneToOne: false
            referencedRelation: "platform_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_fees: {
        Row: {
          cap_fee: number | null
          currency: string
          fixed_fee: number
          method: string
          percent_fee: number
          updated_at: string
        }
        Insert: {
          cap_fee?: number | null
          currency?: string
          fixed_fee?: number
          method: string
          percent_fee?: number
          updated_at?: string
        }
        Update: {
          cap_fee?: number | null
          currency?: string
          fixed_fee?: number
          method?: string
          percent_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_payout_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          affiliate_id: string
          bank_name: string | null
          branch_code: string | null
          created_at: string
          id: string
          is_default: boolean
          method: string
          paypal_email: string | null
          paystack_recipient_code: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          affiliate_id: string
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          method: string
          paypal_email?: string | null
          paystack_recipient_code?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          affiliate_id?: string
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          method?: string
          paypal_email?: string | null
          paystack_recipient_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_methods_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          created_at: string
          currency: string
          destination_snapshot: Json | null
          failure_reason: string | null
          fee_amount: number
          fee_config_snapshot: Json | null
          gross_amount: number
          id: string
          method: string
          net_amount: number
          processed_at: string | null
          processed_by: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          currency?: string
          destination_snapshot?: Json | null
          failure_reason?: string | null
          fee_amount?: number
          fee_config_snapshot?: Json | null
          gross_amount: number
          id?: string
          method: string
          net_amount: number
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          currency?: string
          destination_snapshot?: Json | null
          failure_reason?: string | null
          fee_amount?: number
          fee_config_snapshot?: Json | null
          gross_amount?: number
          id?: string
          method?: string
          net_amount?: number
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          bound_at: string
          click_id: string | null
          created_at: string
          id: string
          referred_host_id: string | null
          referred_user_id: string
          source: string | null
        }
        Insert: {
          affiliate_id: string
          bound_at?: string
          click_id?: string | null
          created_at?: string
          id?: string
          referred_host_id?: string | null
          referred_user_id: string
          source?: string | null
        }
        Update: {
          affiliate_id?: string
          bound_at?: string
          click_id?: string | null
          created_at?: string
          id?: string
          referred_host_id?: string | null
          referred_user_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_host_id_fkey"
            columns: ["referred_host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          attribution_model: string
          cookie_days: number
          currency: string
          hold_days: number
          id: boolean
          min_payout_threshold: number
          self_referral_blocked: boolean
          terms_content: string | null
          terms_version: string
          updated_at: string
        }
        Insert: {
          attribution_model?: string
          cookie_days?: number
          currency?: string
          hold_days?: number
          id?: boolean
          min_payout_threshold?: number
          self_referral_blocked?: boolean
          terms_content?: string | null
          terms_version?: string
          updated_at?: string
        }
        Update: {
          attribution_model?: string
          cookie_days?: number
          currency?: string
          hold_days?: number
          id?: boolean
          min_payout_threshold?: number
          self_referral_blocked?: boolean
          terms_content?: string | null
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      amenity_catalog: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_id: string
          icon: string
          id: string
          is_published: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          group_id: string
          icon?: string
          id?: string
          is_published?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_id?: string
          icon?: string
          id?: string
          is_published?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_catalog_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "amenity_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      amenity_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          is_published: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
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
          property_id: string
          quote_id: string | null
          reason: string | null
          room_id: string | null
          source: string
          special_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          ical_feed_id?: string | null
          id?: string
          property_id: string
          quote_id?: string | null
          reason?: string | null
          room_id?: string | null
          source?: string
          special_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          ical_feed_id?: string | null
          id?: string
          property_id?: string
          quote_id?: string | null
          reason?: string | null
          room_id?: string | null
          source?: string
          special_id?: string | null
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_dates_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          added_by: string | null
          addon_id: string | null
          booking_id: string
          created_at: string
          created_at_tx: string | null
          currency: string
          id: string
          invoice_id: string | null
          is_required: boolean
          label: string
          pricing_model: string | null
          quantity: number
          sort_order: number
          source: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          added_by?: string | null
          addon_id?: string | null
          booking_id: string
          created_at?: string
          created_at_tx?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          is_required?: boolean
          label: string
          pricing_model?: string | null
          quantity?: number
          sort_order?: number
          source?: string
          subtotal?: number
          unit_price: number
        }
        Update: {
          added_by?: string | null
          addon_id?: string | null
          booking_id?: string
          created_at?: string
          created_at_tx?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          is_required?: boolean
          label?: string
          pricing_model?: string | null
          quantity?: number
          sort_order?: number
          source?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "booking_addons_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_privacy_version: number | null
          accepted_terms_version: number | null
          access_card_sent_at: string | null
          actioned_by: string | null
          additional_guests: Json
          balance_due: number
          balance_due_date: string | null
          base_amount: number
          booked_via: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          check_in: string | null
          check_out: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          cleaning_fee: number
          confirmed_at: string | null
          coupon_discount: number
          coupon_id: string | null
          created_at: string
          currency: string
          declined_at: string | null
          deleted_at: string | null
          deposit_amount: number
          discount_amount: number
          eft_proof_url: string | null
          guest_email: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guests_breakdown: Json | null
          guests_count: number
          has_open_refund: boolean | null
          host_id: string
          host_message: string | null
          host_payment_note: string | null
          id: string
          internal_notes: string | null
          nights: number | null
          origin: string
          pay_token: string
          payment_method: string | null
          payment_status: string
          policy_acknowledged: boolean
          policy_acknowledged_at: string | null
          previous_status: string | null
          price_breakdown: Json | null
          property_id: string
          quote_id: string | null
          reference: string
          refund_total: number | null
          scope: string
          session_date: string | null
          special_id: string | null
          special_requests: string | null
          status: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          accepted_privacy_version?: number | null
          accepted_terms_version?: number | null
          access_card_sent_at?: string | null
          actioned_by?: string | null
          additional_guests?: Json
          balance_due?: number
          balance_due_date?: string | null
          base_amount: number
          booked_via?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string | null
          check_in?: string | null
          check_out?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_fee?: number
          confirmed_at?: string | null
          coupon_discount?: number
          coupon_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          deposit_amount?: number
          discount_amount?: number
          eft_proof_url?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_breakdown?: Json | null
          guests_count?: number
          has_open_refund?: boolean | null
          host_id: string
          host_message?: string | null
          host_payment_note?: string | null
          id?: string
          internal_notes?: string | null
          nights?: number | null
          origin?: string
          pay_token?: string
          payment_method?: string | null
          payment_status?: string
          policy_acknowledged?: boolean
          policy_acknowledged_at?: string | null
          previous_status?: string | null
          price_breakdown?: Json | null
          property_id: string
          quote_id?: string | null
          reference: string
          refund_total?: number | null
          scope?: string
          session_date?: string | null
          special_id?: string | null
          special_requests?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          accepted_privacy_version?: number | null
          accepted_terms_version?: number | null
          access_card_sent_at?: string | null
          actioned_by?: string | null
          additional_guests?: Json
          balance_due?: number
          balance_due_date?: string | null
          base_amount?: number
          booked_via?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string | null
          check_in?: string | null
          check_out?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_fee?: number
          confirmed_at?: string | null
          coupon_discount?: number
          coupon_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          deposit_amount?: number
          discount_amount?: number
          eft_proof_url?: string | null
          guest_email?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guests_breakdown?: Json | null
          guests_count?: number
          has_open_refund?: boolean | null
          host_id?: string
          host_message?: string | null
          host_payment_note?: string | null
          id?: string
          internal_notes?: string | null
          nights?: number | null
          origin?: string
          pay_token?: string
          payment_method?: string | null
          payment_status?: string
          policy_acknowledged?: boolean
          policy_acknowledged_at?: string | null
          previous_status?: string | null
          price_breakdown?: Json | null
          property_id?: string
          quote_id?: string | null
          reference?: string
          refund_total?: number | null
          scope?: string
          session_date?: string | null
          special_id?: string | null
          special_requests?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
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
            foreignKeyName: "bookings_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_acknowledgements: {
        Row: {
          acknowledged_at: string | null
          broadcast_id: string
          dismissed_at: string | null
          link_clicked_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          broadcast_id: string
          dismissed_at?: string | null
          link_clicked_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          broadcast_id?: string
          dismissed_at?: string | null
          link_clicked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_acknowledgements_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcast_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_announcements: {
        Row: {
          audience: string
          body: string
          cancelled_at: string | null
          created_at: string
          created_by: string
          email_fanout_completed_at: string | null
          ends_at: string | null
          id: string
          link_label: string | null
          link_url: string | null
          requires_ack: boolean
          severity: string
          starts_at: string
          title: string
        }
        Insert: {
          audience: string
          body: string
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          email_fanout_completed_at?: string | null
          ends_at?: string | null
          id?: string
          link_label?: string | null
          link_url?: string | null
          requires_ack?: boolean
          severity: string
          starts_at?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          email_fanout_completed_at?: string | null
          ends_at?: string | null
          id?: string
          link_label?: string | null
          link_url?: string | null
          requires_ack?: boolean
          severity?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_counters: {
        Row: {
          business_id: string
          last_credit_note_number: number
          last_invoice_number: number
          last_quote_number: number
          last_receipt_number: number
          last_refund_number: number
          updated_at: string
        }
        Insert: {
          business_id: string
          last_credit_note_number?: number
          last_invoice_number?: number
          last_quote_number?: number
          last_receipt_number?: number
          last_refund_number?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          last_credit_note_number?: number
          last_invoice_number?: number
          last_quote_number?: number
          last_receipt_number?: number
          last_refund_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_registration_number: string | null
          country: string
          created_at: string
          default_currency: string
          default_language: string
          host_id: string
          id: string
          is_archived: boolean
          is_default: boolean
          latitude: number | null
          legal_name: string | null
          logo_path: string | null
          longitude: number | null
          municipality: string | null
          postal_code: string | null
          province: string | null
          trading_name: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_registration_number?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          default_language?: string
          host_id: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          latitude?: number | null
          legal_name?: string | null
          logo_path?: string | null
          longitude?: number | null
          municipality?: string | null
          postal_code?: string | null
          province?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_registration_number?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          default_language?: string
          host_id?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          latitude?: number | null
          legal_name?: string | null
          logo_path?: string | null
          longitude?: number | null
          municipality?: string | null
          postal_code?: string | null
          province?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          created_at: string
          follow_up_at: string | null
          guest_id: string
          guest_last_seen_at: string | null
          host_id: string
          host_last_seen_at: string | null
          id: string
          is_enquiry: boolean
          last_message_at: string | null
          last_message_preview: string | null
          lost_reason: string | null
          pinned: boolean
          pipeline_stage: string | null
          property_id: string | null
          source: string | null
          status: string
          unread_guest: number
          unread_host: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string
          follow_up_at?: string | null
          guest_id: string
          guest_last_seen_at?: string | null
          host_id: string
          host_last_seen_at?: string | null
          id?: string
          is_enquiry?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lost_reason?: string | null
          pinned?: boolean
          pipeline_stage?: string | null
          property_id?: string | null
          source?: string | null
          status?: string
          unread_guest?: number
          unread_host?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string
          follow_up_at?: string | null
          guest_id?: string
          guest_last_seen_at?: string | null
          host_id?: string
          host_last_seen_at?: string | null
          id?: string
          is_enquiry?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lost_reason?: string | null
          pinned?: boolean
          pipeline_stage?: string | null
          property_id?: string | null
          source?: string | null
          status?: string
          unread_guest?: number
          unread_host?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount_discounted: number
          booking_id: string
          coupon_id: string
          created_at: string
          currency: string
          guest_id: string | null
          id: string
        }
        Insert: {
          amount_discounted: number
          booking_id: string
          coupon_id: string
          created_at?: string
          currency?: string
          guest_id?: string | null
          id?: string
        }
        Update: {
          amount_discounted?: number
          booking_id?: string
          coupon_id?: string
          created_at?: string
          currency?: string
          guest_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          addon_id: string | null
          code: string
          created_at: string
          currency: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          host_id: string
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_nights: number | null
          min_spend: number | null
          per_guest_limit: number | null
          property_id: string | null
          redeemed_count: number
          room_id: string | null
          scope: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          addon_id?: string | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value: number
          ends_at?: string | null
          host_id: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_nights?: number | null
          min_spend?: number | null
          per_guest_limit?: number | null
          property_id?: string | null
          redeemed_count?: number
          room_id?: string | null
          scope?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_id?: string | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_nights?: number | null
          min_spend?: number | null
          per_guest_limit?: number | null
          property_id?: string | null
          redeemed_count?: number
          room_id?: string | null
          scope?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          booking_id: string
          cancelled_at: string | null
          created_at: string
          credit_note_number: string
          currency: string
          guest_id: string | null
          guest_snapshot: Json
          host_id: string
          host_snapshot: Json
          hosted_token: string
          id: string
          invoice_id: string
          issued_at: string
          line_items: Json
          origin: string
          pdf_storage_path: string | null
          reason: string | null
          refund_request_id: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          booking_id: string
          cancelled_at?: string | null
          created_at?: string
          credit_note_number: string
          currency?: string
          guest_id?: string | null
          guest_snapshot: Json
          host_id: string
          host_snapshot: Json
          hosted_token?: string
          id?: string
          invoice_id: string
          issued_at?: string
          line_items?: Json
          origin?: string
          pdf_storage_path?: string | null
          reason?: string | null
          refund_request_id?: string | null
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          booking_id?: string
          cancelled_at?: string | null
          created_at?: string
          credit_note_number?: string
          currency?: string
          guest_id?: string | null
          guest_snapshot?: Json
          host_id?: string
          host_snapshot?: Json
          hosted_token?: string
          id?: string
          invoice_id?: string
          issued_at?: string
          line_items?: Json
          origin?: string
          pdf_storage_path?: string | null
          reason?: string | null
          refund_request_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          clicked_property: string | null
          created_at: string
          filters: Json | null
          id: string
          query: string | null
          result_count: number | null
          session_id: string | null
        }
        Insert: {
          clicked_property?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string | null
          result_count?: number | null
          session_id?: string | null
        }
        Update: {
          clicked_property?: string | null
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
            columns: ["clicked_property"]
            isOneToOne: false
            referencedRelation: "properties"
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
          business_id: string
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
          business_id: string
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
          business_id?: string
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
            foreignKeyName: "eft_banking_details_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eft_banking_details_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_review_sources: {
        Row: {
          access_token: string | null
          account_name: string | null
          account_url: string | null
          api_key: string | null
          api_secret: string | null
          created_at: string
          deleted_at: string | null
          external_account_id: string
          host_id: string
          id: string
          is_active: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          refresh_token: string | null
          source: string
          sync_cursor: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_name?: string | null
          account_url?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          deleted_at?: string | null
          external_account_id: string
          host_id: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          refresh_token?: string | null
          source: string
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_name?: string | null
          account_url?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          deleted_at?: string | null
          external_account_id?: string
          host_id?: string
          id?: string
          is_active?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          refresh_token?: string | null
          source?: string
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_review_sources_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_review_sync_log: {
        Row: {
          completed_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          reviews_added: number | null
          reviews_fetched: number | null
          reviews_updated: number | null
          source_id: string
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          reviews_added?: number | null
          reviews_fetched?: number | null
          reviews_updated?: number | null
          source_id: string
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          reviews_added?: number | null
          reviews_fetched?: number | null
          reviews_updated?: number | null
          source_id?: string
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_review_sync_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "external_review_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      external_reviews: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          external_review_id: string
          external_reviewer_id: string | null
          host_id: string
          host_reply: string | null
          host_reply_at: string | null
          id: string
          is_featured: boolean
          is_visible: boolean
          language: string | null
          property_id: string | null
          rating: number | null
          reply_sync_error: string | null
          reply_synced: boolean
          review_url: string | null
          reviewed_at: string
          reviewer_avatar_url: string | null
          reviewer_name: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          external_review_id: string
          external_reviewer_id?: string | null
          host_id: string
          host_reply?: string | null
          host_reply_at?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          language?: string | null
          property_id?: string | null
          rating?: number | null
          reply_sync_error?: string | null
          reply_synced?: boolean
          review_url?: string | null
          reviewed_at: string
          reviewer_avatar_url?: string | null
          reviewer_name?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          external_review_id?: string
          external_reviewer_id?: string | null
          host_id?: string
          host_reply?: string | null
          host_reply_at?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          language?: string | null
          property_id?: string | null
          rating?: number | null
          reply_sync_error?: string | null
          reply_synced?: boolean
          review_url?: string | null
          reviewed_at?: string
          reviewer_avatar_url?: string | null
          reviewer_name?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_reviews_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_reviews_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "external_review_sources"
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
          property_id: string
          reason: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          featured_by: string
          id?: string
          property_id: string
          reason?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          featured_by?: string
          id?: string
          property_id?: string
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
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          amount: number | null
          booking_id: string | null
          created_at: string
          currency: string | null
          entity_id: string | null
          entity_type: string | null
          host_id: string
          id: string
          metadata: Json | null
          reason: string | null
          txn_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          entity_type?: string | null
          host_id: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          txn_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          entity_type?: string | null
          host_id?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_audit_log_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          is_manual_override: boolean
          quote_currency: string
          rate: number
          source: string
          updated_at: string
        }
        Insert: {
          base_currency: string
          fetched_at?: string
          is_manual_override?: boolean
          quote_currency: string
          rate: number
          source?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          is_manual_override?: boolean
          quote_currency?: string
          rate?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_broadcasts: {
        Row: {
          audience: string
          body: string
          created_by: string | null
          host_id: string
          id: string
          recipient_count: number
          sent_at: string
          status: string
          subject: string
        }
        Insert: {
          audience: string
          body: string
          created_by?: string | null
          host_id: string
          id?: string
          recipient_count?: number
          sent_at?: string
          status?: string
          subject: string
        }
        Update: {
          audience?: string
          body?: string
          created_by?: string | null
          host_id?: string
          id?: string
          recipient_count?: number
          sent_at?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_broadcasts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_business_links: {
        Row: {
          business_id: string
          contact_id: string
          first_linked_at: string
          host_id: string
          id: string
          source_booking_id: string | null
        }
        Insert: {
          business_id: string
          contact_id: string
          first_linked_at?: string
          host_id: string
          id?: string
          source_booking_id?: string | null
        }
        Update: {
          business_id?: string
          contact_id?: string
          first_linked_at?: string
          host_id?: string
          id?: string
          source_booking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_business_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_business_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "host_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_business_links_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_business_links_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_credit_ledger: {
        Row: {
          amount: number
          booking_id: string | null
          business_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          gkey: string
          guest_email: string | null
          guest_id: string | null
          host_id: string
          id: string
          payment_id: string | null
          reason: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gkey: string
          guest_email?: string | null
          guest_id?: string | null
          host_id: string
          id?: string
          payment_id?: string | null
          reason: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gkey?: string
          guest_email?: string | null
          guest_id?: string | null
          host_id?: string
          id?: string
          payment_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_credit_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_credit_ledger_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_credit_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_credit_ledger_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_credit_ledger_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_credit_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_marketing: {
        Row: {
          email: string
          gkey: string
          host_id: string
          is_subscribed: boolean
          source: string | null
          subscribed_at: string
          unsub_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          gkey: string
          host_id: string
          is_subscribed?: boolean
          source?: string | null
          subscribed_at?: string
          unsub_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          gkey?: string
          host_id?: string
          is_subscribed?: boolean
          source?: string | null
          subscribed_at?: string
          unsub_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_marketing_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          gkey: string
          host_id: string
          id: string
          is_pinned: boolean
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          gkey: string
          host_id: string
          id?: string
          is_pinned?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          gkey?: string
          host_id?: string
          id?: string
          is_pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "guest_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notes_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_ratings: {
        Row: {
          created_at: string
          guest_id: string
          host_id: string
          id: string
          note_cleanliness: string | null
          note_communication: string | null
          note_house_rules: string | null
          note_integrity: string | null
          note_payments: string | null
          rating: number
          rating_cleanliness: number | null
          rating_communication: number | null
          rating_house_rules: number | null
          rating_integrity: number | null
          rating_payments: number | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          host_id: string
          id?: string
          note_cleanliness?: string | null
          note_communication?: string | null
          note_house_rules?: string | null
          note_integrity?: string | null
          note_payments?: string | null
          rating: number
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_house_rules?: number | null
          rating_integrity?: number | null
          rating_payments?: number | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          host_id?: string
          id?: string
          note_cleanliness?: string | null
          note_communication?: string | null
          note_house_rules?: string | null
          note_integrity?: string | null
          note_payments?: string | null
          rating?: number
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_house_rules?: number | null
          rating_integrity?: number | null
          rating_payments?: number | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_ratings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_ratings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_relationships: {
        Row: {
          contact_id: string
          created_at: string
          host_id: string
          id: string
          related_contact_id: string
          source_booking_id: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          host_id: string
          id?: string
          related_contact_id: string
          source_booking_id?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          host_id?: string
          id?: string
          related_contact_id?: string
          source_booking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_relationships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "host_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "host_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_feedback: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string | null
          vote: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id?: string | null
          vote: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_suggestions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_article_suggestions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          audience: string
          author_id: string | null
          body_html: string
          body_json: Json
          category_id: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string
          featured_rank: number | null
          has_video: boolean
          helpful_count: number
          id: string
          last_editor_id: string | null
          not_helpful_count: number
          published_at: string | null
          read_time_minutes: number
          saved_count: number
          search_tsv: unknown
          slug: string
          status: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          audience?: string
          author_id?: string | null
          body_html?: string
          body_json?: Json
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured_rank?: number | null
          has_video?: boolean
          helpful_count?: number
          id?: string
          last_editor_id?: string | null
          not_helpful_count?: number
          published_at?: string | null
          read_time_minutes?: number
          saved_count?: number
          search_tsv?: unknown
          slug: string
          status?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          audience?: string
          author_id?: string | null
          body_html?: string
          body_json?: Json
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured_rank?: number | null
          has_video?: boolean
          helpful_count?: number
          id?: string
          last_editor_id?: string | null
          not_helpful_count?: number
          published_at?: string | null
          read_time_minutes?: number
          saved_count?: number
          search_tsv?: unknown
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_last_editor_id_fkey"
            columns: ["last_editor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          audience: string
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string
          id: string
          is_published: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      help_faqs: {
        Row: {
          answer_html: string
          audience: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_html: string
          audience?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_html?: string
          audience?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_faqs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      help_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      help_status_components: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          note: string | null
          sort_order: number
          spark_values: Json
          status: string
          updated_at: string
          uptime_pct: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          note?: string | null
          sort_order?: number
          spark_values?: Json
          status?: string
          updated_at?: string
          uptime_pct?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          note?: string | null
          sort_order?: number
          spark_values?: Json
          status?: string
          updated_at?: string
          uptime_pct?: number
        }
        Relationships: []
      }
      help_videos: {
        Row: {
          audience: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          duration_seconds: number
          embed_id: string
          embed_provider: string
          embed_url: string
          featured_rank: number | null
          id: string
          is_new: boolean
          sort_order: number
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          duration_seconds?: number
          embed_id: string
          embed_provider?: string
          embed_url: string
          featured_rank?: number | null
          id?: string
          is_new?: boolean
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          duration_seconds?: number
          embed_id?: string
          embed_provider?: string
          embed_url?: string
          featured_rank?: number | null
          id?: string
          is_new?: boolean
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      host_contacts: {
        Row: {
          blocked: boolean
          blocked_at: string | null
          blocked_reason: string | null
          country: string | null
          created_at: string
          email: string
          email_consent: boolean
          guest_id: string | null
          host_id: string
          id: string
          last_seen_at: string
          last_stage: string | null
          name: string | null
          notes: string | null
          phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          country?: string | null
          created_at?: string
          email: string
          email_consent?: boolean
          guest_id?: string | null
          host_id: string
          id?: string
          last_seen_at?: string
          last_stage?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          country?: string | null
          created_at?: string
          email?: string
          email_consent?: boolean
          guest_id?: string | null
          host_id?: string
          id?: string
          last_seen_at?: string
          last_stage?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_contacts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_contacts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
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
      host_payment_gateways: {
        Row: {
          business_id: string
          created_at: string
          environment: string
          gateway: string
          host_id: string
          id: string
          is_enabled: boolean
          last_validated_at: string | null
          live_public_identifier: string | null
          live_secret_cipher: string | null
          live_secret_last4: string | null
          mode: string
          public_identifier: string | null
          secret_cipher: string | null
          secret_last4: string | null
          statement_descriptor: string | null
          test_public_identifier: string | null
          test_secret_cipher: string | null
          test_secret_last4: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          environment?: string
          gateway: string
          host_id: string
          id?: string
          is_enabled?: boolean
          last_validated_at?: string | null
          live_public_identifier?: string | null
          live_secret_cipher?: string | null
          live_secret_last4?: string | null
          mode?: string
          public_identifier?: string | null
          secret_cipher?: string | null
          secret_last4?: string | null
          statement_descriptor?: string | null
          test_public_identifier?: string | null
          test_secret_cipher?: string | null
          test_secret_last4?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          environment?: string
          gateway?: string
          host_id?: string
          id?: string
          is_enabled?: boolean
          last_validated_at?: string | null
          live_public_identifier?: string | null
          live_secret_cipher?: string | null
          live_secret_last4?: string | null
          mode?: string
          public_identifier?: string | null
          secret_cipher?: string | null
          secret_last4?: string | null
          statement_descriptor?: string | null
          test_public_identifier?: string | null
          test_secret_cipher?: string | null
          test_secret_last4?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_payment_gateways_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_payment_gateways_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      host_personal_details: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          host_id: string
          latitude: number | null
          longitude: number | null
          municipality: string | null
          postal_code: string | null
          province: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          host_id: string
          latitude?: number | null
          longitude?: number | null
          municipality?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          host_id?: string
          latitude?: number | null
          longitude?: number | null
          municipality?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_personal_details_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      host_websites: {
        Row: {
          brand: Json
          business_id: string
          created_at: string
          custom_domain: string | null
          deleted_at: string | null
          domain_status: string
          host_id: string
          id: string
          navigation: Json
          published_at: string | null
          published_snapshot: Json | null
          saved_sections: Json
          seo: Json
          settings: Json
          ssl_status: string
          status: string
          subdomain: string
          theme: Json
          theme_id: string | null
          updated_at: string
          verification_token: string | null
        }
        Insert: {
          brand?: Json
          business_id: string
          created_at?: string
          custom_domain?: string | null
          deleted_at?: string | null
          domain_status?: string
          host_id: string
          id?: string
          navigation?: Json
          published_at?: string | null
          published_snapshot?: Json | null
          saved_sections?: Json
          seo?: Json
          settings?: Json
          ssl_status?: string
          status?: string
          subdomain: string
          theme?: Json
          theme_id?: string | null
          updated_at?: string
          verification_token?: string | null
        }
        Update: {
          brand?: Json
          business_id?: string
          created_at?: string
          custom_domain?: string | null
          deleted_at?: string | null
          domain_status?: string
          host_id?: string
          id?: string
          navigation?: Json
          published_at?: string | null
          published_snapshot?: Json | null
          saved_sections?: Json
          seo?: Json
          settings?: Json
          ssl_status?: string
          status?: string
          subdomain?: string
          theme?: Json
          theme_id?: string | null
          updated_at?: string
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_websites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_websites_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_websites_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "site_themes"
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
          default_currency: string
          deleted_at: string | null
          display_name: string
          enquiry_auto_reply: string | null
          handle: string
          highlights: string[]
          id: string
          is_active: boolean
          is_superhost: boolean
          is_verified: boolean
          languages_spoken: string[] | null
          payout_verified: boolean
          phone_verified: boolean
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
          default_currency?: string
          deleted_at?: string | null
          display_name: string
          enquiry_auto_reply?: string | null
          handle: string
          highlights?: string[]
          id?: string
          is_active?: boolean
          is_superhost?: boolean
          is_verified?: boolean
          languages_spoken?: string[] | null
          payout_verified?: boolean
          phone_verified?: boolean
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
          default_currency?: string
          deleted_at?: string | null
          display_name?: string
          enquiry_auto_reply?: string | null
          handle?: string
          highlights?: string[]
          id?: string
          is_active?: boolean
          is_superhost?: boolean
          is_verified?: boolean
          languages_spoken?: string[] | null
          payout_verified?: boolean
          phone_verified?: boolean
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
          property_id: string
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
          property_id: string
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
          property_id?: string
          source_label?: string
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_feeds_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          category_id: string
          created_at: string
          id: string
          kind: string
          link: string | null
          payload: Json
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category_id?: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category_id?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          severity?: string
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
          kind: string
          line_items: Json
          paid_at: string | null
          payment_id: string | null
          pdf_storage_path: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          kind?: string
          line_items: Json
          paid_at?: string | null
          payment_id?: string | null
          pdf_storage_path?: string | null
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          kind?: string
          line_items?: Json
          paid_at?: string | null
          payment_id?: string | null
          pdf_storage_path?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
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
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_alerts: {
        Row: {
          category: string | null
          check_in_from: string | null
          check_in_to: string | null
          created_at: string
          host_id: string
          id: string
          is_active: boolean
          last_matched_at: string | null
          last_notified_at: string | null
          location_region: string | null
          match_count: number
          max_budget: number | null
          max_guests: number | null
          min_budget: number | null
          min_guests: number | null
          name: string | null
        }
        Insert: {
          category?: string | null
          check_in_from?: string | null
          check_in_to?: string | null
          created_at?: string
          host_id: string
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          last_notified_at?: string | null
          location_region?: string | null
          match_count?: number
          max_budget?: number | null
          max_guests?: number | null
          min_budget?: number | null
          min_guests?: number | null
          name?: string | null
        }
        Update: {
          category?: string | null
          check_in_from?: string | null
          check_in_to?: string | null
          created_at?: string
          host_id?: string
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          last_notified_at?: string | null
          location_region?: string | null
          match_count?: number
          max_budget?: number | null
          max_guests?: number | null
          min_budget?: number | null
          min_guests?: number | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_alerts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_bookmarks: {
        Row: {
          host_id: string
          id: string
          post_id: string
          saved_at: string
        }
        Insert: {
          host_id: string
          id?: string
          post_id: string
          saved_at?: string
        }
        Update: {
          host_id?: string
          id?: string
          post_id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_bookmarks_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_expiry_notifications: {
        Row: {
          days_before: number
          id: string
          post_id: string
          sent_at: string | null
        }
        Insert: {
          days_before: number
          id?: string
          post_id: string
          sent_at?: string | null
        }
        Update: {
          days_before?: number
          id?: string
          post_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_expiry_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_passes: {
        Row: {
          host_id: string
          id: string
          passed_at: string
          post_id: string
          reason: string | null
        }
        Insert: {
          host_id: string
          id?: string
          passed_at?: string
          post_id: string
          reason?: string | null
        }
        Update: {
          host_id?: string
          id?: string
          passed_at?: string
          post_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_passes_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_passes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_post_targets: {
        Row: {
          created_at: string
          host_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_post_targets_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_post_views: {
        Row: {
          host_id: string
          id: string
          post_id: string
          viewed_at: string
        }
        Insert: {
          host_id: string
          id?: string
          post_id: string
          viewed_at?: string
        }
        Update: {
          host_id?: string
          id?: string
          post_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_post_views_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_posts: {
        Row: {
          adults: number
          budget_currency: string
          budget_max: number | null
          budget_min: number | null
          budget_per: string | null
          category: string
          check_in_date: string | null
          check_out_date: string | null
          children: number
          created_at: string
          description: string | null
          event_type: string | null
          expires_at: string | null
          extension_count: number
          fulfilled_booking_id: string | null
          fulfilled_via: string | null
          guest_id: string
          id: string
          infants: number
          is_all_in_quote: boolean | null
          is_public: boolean
          is_urgent: boolean
          location_lat: number | null
          location_lng: number | null
          location_region: string | null
          location_text: string | null
          min_host_rating: number | null
          quote_count: number
          quote_deadline: string | null
          reopen_count: number
          status: string
          sub_category: string | null
          title: string
          total_headcount: number | null
          updated_at: string
          urgent_until: string | null
          vendor_needs: string[] | null
          view_count: number
        }
        Insert: {
          adults?: number
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          budget_per?: string | null
          category?: string
          check_in_date?: string | null
          check_out_date?: string | null
          children?: number
          created_at?: string
          description?: string | null
          event_type?: string | null
          expires_at?: string | null
          extension_count?: number
          fulfilled_booking_id?: string | null
          fulfilled_via?: string | null
          guest_id: string
          id?: string
          infants?: number
          is_all_in_quote?: boolean | null
          is_public?: boolean
          is_urgent?: boolean
          location_lat?: number | null
          location_lng?: number | null
          location_region?: string | null
          location_text?: string | null
          min_host_rating?: number | null
          quote_count?: number
          quote_deadline?: string | null
          reopen_count?: number
          status?: string
          sub_category?: string | null
          title: string
          total_headcount?: number | null
          updated_at?: string
          urgent_until?: string | null
          vendor_needs?: string[] | null
          view_count?: number
        }
        Update: {
          adults?: number
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          budget_per?: string | null
          category?: string
          check_in_date?: string | null
          check_out_date?: string | null
          children?: number
          created_at?: string
          description?: string | null
          event_type?: string | null
          expires_at?: string | null
          extension_count?: number
          fulfilled_booking_id?: string | null
          fulfilled_via?: string | null
          guest_id?: string
          id?: string
          infants?: number
          is_all_in_quote?: boolean | null
          is_public?: boolean
          is_urgent?: boolean
          location_lat?: number | null
          location_lng?: number | null
          location_region?: string | null
          location_text?: string | null
          min_host_rating?: number | null
          quote_count?: number
          quote_deadline?: string | null
          reopen_count?: number
          status?: string
          sub_category?: string | null
          title?: string
          total_headcount?: number | null
          updated_at?: string
          urgent_until?: string | null
          vendor_needs?: string[] | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_posts_fulfilled_booking_id_fkey"
            columns: ["fulfilled_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_posts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_quotas: {
        Row: {
          guest_extensions_per_month: number | null
          guest_posts_per_day: number | null
          guest_posts_per_month: number | null
          guest_posts_per_year: number | null
          host_quotes_per_day: number | null
          host_quotes_per_month: number | null
          host_quotes_per_year: number | null
          id: string
          plan_id: string
          public_quote_count_cap: number | null
          quote_expiry_days: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          guest_extensions_per_month?: number | null
          guest_posts_per_day?: number | null
          guest_posts_per_month?: number | null
          guest_posts_per_year?: number | null
          host_quotes_per_day?: number | null
          host_quotes_per_month?: number | null
          host_quotes_per_year?: number | null
          id?: string
          plan_id: string
          public_quote_count_cap?: number | null
          quote_expiry_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          guest_extensions_per_month?: number | null
          guest_posts_per_day?: number | null
          guest_posts_per_month?: number | null
          guest_posts_per_year?: number | null
          host_quotes_per_day?: number | null
          host_quotes_per_month?: number | null
          host_quotes_per_year?: number | null
          id?: string
          plan_id?: string
          public_quote_count_cap?: number | null
          quote_expiry_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_quotas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_region_digest_queue: {
        Row: {
          id: string
          post_count: number
          processed_at: string | null
          queued_at: string | null
          region: string
          sample_post_ids: string[]
        }
        Insert: {
          id?: string
          post_count?: number
          processed_at?: string | null
          queued_at?: string | null
          region: string
          sample_post_ids?: string[]
        }
        Update: {
          id?: string
          post_count?: number
          processed_at?: string | null
          queued_at?: string | null
          region?: string
          sample_post_ids?: string[]
        }
        Relationships: []
      }
      looking_for_responses: {
        Row: {
          expires_at: string | null
          host_id: string
          id: string
          post_id: string
          quote_id: string | null
          sent_at: string
          status: string
          thread_id: string | null
          viewed_at: string | null
        }
        Insert: {
          expires_at?: string | null
          host_id: string
          id?: string
          post_id: string
          quote_id?: string | null
          sent_at?: string
          status?: string
          thread_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          expires_at?: string | null
          host_id?: string
          id?: string
          post_id?: string
          quote_id?: string | null
          sent_at?: string
          status?: string
          thread_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_responses_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_responses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_responses_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_responses_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      looking_for_usage: {
        Row: {
          action: string
          id: string
          occurred_at: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          occurred_at?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          occurred_at?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_usage_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          file_url: string | null
          height: number | null
          id: string
          is_active: boolean
          link_url: string | null
          mime_type: string | null
          sort_order: number
          title: string
          updated_at: string
          width: number | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          mime_type?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          mime_type?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          quote_id: string | null
          quote_version_no: number | null
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
          quote_id?: string | null
          quote_version_no?: number | null
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
          quote_id?: string | null
          quote_version_no?: number | null
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
            foreignKeyName: "messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      notification_categories: {
        Row: {
          created_at: string
          default_for_role: Json
          description: string
          display_order: number
          icon_name: string
          id: string
          is_locked: boolean
          label: string
          supports_digest: boolean
        }
        Insert: {
          created_at?: string
          default_for_role?: Json
          description: string
          display_order?: number
          icon_name: string
          id: string
          is_locked?: boolean
          label: string
          supports_digest?: boolean
        }
        Update: {
          created_at?: string
          default_for_role?: Json
          description?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_locked?: boolean
          label?: string
          supports_digest?: boolean
        }
        Relationships: []
      }
      notification_delivery_log: {
        Row: {
          category_id: string | null
          channel: string
          created_at: string
          dedupe_key: string | null
          event_kind: string
          id: string
          read_at: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          channel: string
          created_at?: string
          dedupe_key?: string | null
          event_kind: string
          id?: string
          read_at?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          channel?: string
          created_at?: string
          dedupe_key?: string | null
          event_kind?: string
          id?: string
          read_at?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          category_id: string
          created_at: string
          email_template_key: string | null
          feature: string
          human_description: string | null
          human_label: string
          in_app_supported: boolean
          kind: string
          push_supported: boolean
          severity: string
        }
        Insert: {
          category_id: string
          created_at?: string
          email_template_key?: string | null
          feature: string
          human_description?: string | null
          human_label: string
          in_app_supported?: boolean
          kind: string
          push_supported?: boolean
          severity?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          email_template_key?: string | null
          feature?: string
          human_description?: string | null
          human_label?: string
          in_app_supported?: boolean
          kind?: string
          push_supported?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          category_id: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          failed_at: string | null
          guest_id: string | null
          host_id: string | null
          id: string
          payload: Json
          sent_at: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          failed_at?: string | null
          guest_id?: string | null
          host_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          failed_at?: string | null
          guest_id?: string | null
          host_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          type?: string
          user_id?: string | null
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
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          kind: string
          method: string
          note: string | null
          provider_reference: string | null
          provider_response: Json | null
          receipt_number: string | null
          receipt_token: string | null
          recorded_by: string | null
          refunded_amount: number | null
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          kind?: string
          method: string
          note?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          receipt_number?: string | null
          receipt_token?: string | null
          recorded_by?: string | null
          refunded_amount?: number | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          kind?: string
          method?: string
          note?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          receipt_number?: string | null
          receipt_token?: string | null
          recorded_by?: string | null
          refunded_amount?: number | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_digest_items: {
        Row: {
          body: string | null
          category_id: string
          created_at: string
          event_kind: string
          id: string
          link: string | null
          payload: Json
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category_id: string
          created_at?: string
          event_kind: string
          id?: string
          link?: string | null
          payload?: Json
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category_id?: string
          created_at?: string
          event_kind?: string
          id?: string
          link?: string | null
          payload?: Json
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_digest_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_push_queue: {
        Row: {
          claimed_at: string | null
          created_at: string
          error: string | null
          event_kind: string
          failed_at: string | null
          id: string
          payload: Json
          release_at: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          event_kind: string
          failed_at?: string | null
          id?: string
          payload: Json
          release_at?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          event_kind?: string
          failed_at?: string | null
          id?: string
          payload?: Json
          release_at?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_push_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
            foreignKeyName: "plan_features_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_features_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          plan: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          plan: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          plan?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      plans: {
        Row: {
          bullets: Json
          created_at: string
          currency: string
          description: string | null
          is_active: boolean
          is_free: boolean
          is_recommended: boolean
          key: string
          name: string
          sort_order: number
          tagline: string | null
          trial_days: number
          updated_at: string
          vat_inclusive: boolean
        }
        Insert: {
          bullets?: Json
          created_at?: string
          currency?: string
          description?: string | null
          is_active?: boolean
          is_free?: boolean
          is_recommended?: boolean
          key: string
          name: string
          sort_order?: number
          tagline?: string | null
          trial_days?: number
          updated_at?: string
          vat_inclusive?: boolean
        }
        Update: {
          bullets?: Json
          created_at?: string
          currency?: string
          description?: string | null
          is_active?: boolean
          is_free?: boolean
          is_recommended?: boolean
          key?: string
          name?: string
          sort_order?: number
          tagline?: string | null
          trial_days?: number
          updated_at?: string
          vat_inclusive?: boolean
        }
        Relationships: []
      }
      platform_counters: {
        Row: {
          id: boolean
          last_invoice_number: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          last_invoice_number?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          last_invoice_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_integrations: {
        Row: {
          id: boolean
          meta_capi_access_token: string | null
          meta_capi_enabled: boolean
          meta_pixel_enabled: boolean
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          meta_capi_access_token?: string | null
          meta_capi_enabled?: boolean
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          meta_capi_access_token?: string | null
          meta_capi_enabled?: boolean
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_ledger: {
        Row: {
          amount: number
          billing_cycle: string | null
          coupon_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          environment: string
          host_id: string | null
          id: string
          invoice_id: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          plan: string | null
          product_id: string | null
          provider: string | null
          provider_reference: string | null
          reason: string | null
          reverses_ledger_id: string | null
          service_id: string | null
          status: string
          subscription_id: string | null
          type: string
          user_id: string | null
          vat_amount: number | null
        }
        Insert: {
          amount: number
          billing_cycle?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          environment?: string
          host_id?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          product_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          reason?: string | null
          reverses_ledger_id?: string | null
          service_id?: string | null
          status?: string
          subscription_id?: string | null
          type: string
          user_id?: string | null
          vat_amount?: number | null
        }
        Update: {
          amount?: number
          billing_cycle?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          environment?: string
          host_id?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          product_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          reason?: string | null
          reverses_ledger_id?: string | null
          service_id?: string | null
          status?: string
          subscription_id?: string | null
          type?: string
          user_id?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "platform_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_reverses_ledger_id_fkey"
            columns: ["reverses_ledger_id"]
            isOneToOne: false
            referencedRelation: "platform_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payment_settings: {
        Row: {
          eft_account_name: string | null
          eft_account_number: string | null
          eft_bank_name: string | null
          eft_branch_code: string | null
          eft_enabled: boolean
          eft_reference_hint: string | null
          id: boolean
          paystack_enabled: boolean
          paystack_mode: string
          paystack_public_key: string | null
          paystack_secret_key: string | null
          paystack_test_public_key: string | null
          paystack_test_secret_key: string | null
          updated_at: string
        }
        Insert: {
          eft_account_name?: string | null
          eft_account_number?: string | null
          eft_bank_name?: string | null
          eft_branch_code?: string | null
          eft_enabled?: boolean
          eft_reference_hint?: string | null
          id?: boolean
          paystack_enabled?: boolean
          paystack_mode?: string
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          paystack_test_public_key?: string | null
          paystack_test_secret_key?: string | null
          updated_at?: string
        }
        Update: {
          eft_account_name?: string | null
          eft_account_number?: string | null
          eft_bank_name?: string | null
          eft_branch_code?: string | null
          eft_enabled?: boolean
          eft_reference_hint?: string | null
          id?: boolean
          paystack_enabled?: boolean
          paystack_mode?: string
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          paystack_test_public_key?: string | null
          paystack_test_secret_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_services: {
        Row: {
          billing_cycle: string | null
          billing_type: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          billing_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          billing_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          check_in_method: string | null
          check_in_time: string | null
          check_out_time: string | null
          children_welcome: boolean | null
          created_at: string
          deleted_at: string | null
          host_id: string
          id: string
          is_default: boolean
          is_non_refundable: boolean
          name: string
          parent_policy_id: string | null
          parties_allowed: boolean | null
          pets_allowed: boolean | null
          preset: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          smoking_allowed: boolean | null
          status: string
          summary: string | null
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          children_welcome?: boolean | null
          created_at?: string
          deleted_at?: string | null
          host_id: string
          id?: string
          is_default?: boolean
          is_non_refundable?: boolean
          name: string
          parent_policy_id?: string | null
          parties_allowed?: boolean | null
          pets_allowed?: boolean | null
          preset?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          smoking_allowed?: boolean | null
          status?: string
          summary?: string | null
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          children_welcome?: boolean | null
          created_at?: string
          deleted_at?: string | null
          host_id?: string
          id?: string
          is_default?: boolean
          is_non_refundable?: boolean
          name?: string
          parent_policy_id?: string | null
          parties_allowed?: boolean | null
          pets_allowed?: boolean | null
          preset?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          smoking_allowed?: boolean | null
          status?: string
          summary?: string | null
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
      product_features: {
        Row: {
          feature_key: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          feature_key: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          feature_key?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_orders: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          environment: string
          id: string
          method: string | null
          paid_at: string | null
          pay_token: string
          payer_email: string
          payer_user_id: string | null
          product_id: string | null
          product_name: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          environment?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          pay_token: string
          payer_email: string
          payer_user_id?: string | null
          product_id?: string | null
          product_name: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          environment?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          pay_token?: string
          payer_email?: string
          payer_user_id?: string | null
          product_id?: string | null
          product_name?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_duration: string
          affiliate_duration_months: number | null
          affiliate_type: string
          affiliate_value: number
          billing_cycle: string | null
          bullets: Json
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_recommended: boolean
          is_visible: boolean
          name: string
          payment_methods: string[]
          price: number
          setup_fee: number
          setup_fee_affiliate_type: string
          setup_fee_affiliate_value: number
          setup_fee_label: string | null
          slug: string | null
          sort_order: number
          trial_days: number
          type: string
          updated_at: string
        }
        Insert: {
          affiliate_duration?: string
          affiliate_duration_months?: number | null
          affiliate_type?: string
          affiliate_value?: number
          billing_cycle?: string | null
          bullets?: Json
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_visible?: boolean
          name: string
          payment_methods?: string[]
          price?: number
          setup_fee?: number
          setup_fee_affiliate_type?: string
          setup_fee_affiliate_value?: number
          setup_fee_label?: string | null
          slug?: string | null
          sort_order?: number
          trial_days?: number
          type?: string
          updated_at?: string
        }
        Update: {
          affiliate_duration?: string
          affiliate_duration_months?: number | null
          affiliate_type?: string
          affiliate_value?: number
          billing_cycle?: string | null
          bullets?: Json
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_visible?: boolean
          name?: string
          payment_methods?: string[]
          price?: number
          setup_fee?: number
          setup_fee_affiliate_type?: string
          setup_fee_affiliate_value?: number
          setup_fee_label?: string | null
          slug?: string | null
          sort_order?: number
          trial_days?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          accepts_eft: boolean
          accepts_paypal: boolean
          accepts_paystack: boolean
          accommodation_type: string | null
          address_line1: string | null
          address_line2: string | null
          allow_children: boolean
          allow_infants: boolean
          allow_pets: boolean
          avg_rating: number | null
          base_price: number | null
          bathrooms: number | null
          bedrooms: number | null
          booking_mode: string
          business_id: string
          cancellation_policy: string
          cancellation_policy_label: string | null
          category_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          child_max_age: number
          child_price: number
          city: string | null
          cleaning_fee: number | null
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number | null
          experience_type: string | null
          featured_review_id: string | null
          host_id: string
          house_rules: string | null
          id: string
          infant_max_age: number
          infant_price: number
          instant_booking: boolean
          is_featured: boolean
          is_non_refundable: boolean
          is_published: boolean
          is_suspended: boolean
          latitude: number | null
          location: unknown
          longitude: number | null
          max_guests: number | null
          max_nights: number | null
          max_participants: number | null
          meeting_point: string | null
          min_nights: number | null
          min_participants: number | null
          monthly_discount_pct: number | null
          name: string
          pet_fee: number
          postal_code: string | null
          private_group_price: number | null
          property_type: string
          province: string | null
          published_at: string | null
          room_config: Json | null
          schedule: Json | null
          search_vector: unknown
          slug: string | null
          total_bookings: number
          total_reviews: number
          updated_at: string
          vat_number: string | null
          vat_rate: number
          weekend_price: number | null
          weekly_discount_pct: number | null
          what_to_bring: string | null
          whole_property_discount_pct: number | null
        }
        Insert: {
          accepts_eft?: boolean
          accepts_paypal?: boolean
          accepts_paystack?: boolean
          accommodation_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_children?: boolean
          allow_infants?: boolean
          allow_pets?: boolean
          avg_rating?: number | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_mode?: string
          business_id: string
          cancellation_policy?: string
          cancellation_policy_label?: string | null
          category_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          child_max_age?: number
          child_price?: number
          city?: string | null
          cleaning_fee?: number | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          experience_type?: string | null
          featured_review_id?: string | null
          host_id: string
          house_rules?: string | null
          id?: string
          infant_max_age?: number
          infant_price?: number
          instant_booking?: boolean
          is_featured?: boolean
          is_non_refundable?: boolean
          is_published?: boolean
          is_suspended?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_guests?: number | null
          max_nights?: number | null
          max_participants?: number | null
          meeting_point?: string | null
          min_nights?: number | null
          min_participants?: number | null
          monthly_discount_pct?: number | null
          name: string
          pet_fee?: number
          postal_code?: string | null
          private_group_price?: number | null
          property_type: string
          province?: string | null
          published_at?: string | null
          room_config?: Json | null
          schedule?: Json | null
          search_vector?: unknown
          slug?: string | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          weekend_price?: number | null
          weekly_discount_pct?: number | null
          what_to_bring?: string | null
          whole_property_discount_pct?: number | null
        }
        Update: {
          accepts_eft?: boolean
          accepts_paypal?: boolean
          accepts_paystack?: boolean
          accommodation_type?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_children?: boolean
          allow_infants?: boolean
          allow_pets?: boolean
          avg_rating?: number | null
          base_price?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_mode?: string
          business_id?: string
          cancellation_policy?: string
          cancellation_policy_label?: string | null
          category_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          child_max_age?: number
          child_price?: number
          city?: string | null
          cleaning_fee?: number | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          experience_type?: string | null
          featured_review_id?: string | null
          host_id?: string
          house_rules?: string | null
          id?: string
          infant_max_age?: number
          infant_price?: number
          instant_booking?: boolean
          is_featured?: boolean
          is_non_refundable?: boolean
          is_published?: boolean
          is_suspended?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_guests?: number | null
          max_nights?: number | null
          max_participants?: number | null
          meeting_point?: string | null
          min_nights?: number | null
          min_participants?: number | null
          monthly_discount_pct?: number | null
          name?: string
          pet_fee?: number
          postal_code?: string | null
          private_group_price?: number | null
          property_type?: string
          province?: string | null
          published_at?: string | null
          room_config?: Json | null
          schedule?: Json | null
          search_vector?: unknown
          slug?: string | null
          total_bookings?: number
          total_reviews?: number
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          weekend_price?: number | null
          weekly_discount_pct?: number | null
          what_to_bring?: string | null
          whole_property_discount_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "property_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_featured_review_id_fkey"
            columns: ["featured_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_access: {
        Row: {
          check_in_instructions: string | null
          check_in_method: string | null
          created_at: string
          door_code: string | null
          gate_code: string | null
          property_id: string
          updated_at: string
          wifi_network: string | null
          wifi_password: string | null
        }
        Insert: {
          check_in_instructions?: string | null
          check_in_method?: string | null
          created_at?: string
          door_code?: string | null
          gate_code?: string | null
          property_id: string
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Update: {
          check_in_instructions?: string | null
          check_in_method?: string | null
          created_at?: string
          door_code?: string | null
          gate_code?: string | null
          property_id?: string
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_access_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          property_id: string
          room_id: string | null
          unit_price_override: number | null
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          property_id: string
          room_id?: string | null
          unit_price_override?: number | null
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          property_id?: string
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_addons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_key: string
          amenity_label: string | null
          catalog_id: string | null
          id: string
          property_id: string
          room_id: string | null
        }
        Insert: {
          amenity_key: string
          amenity_label?: string | null
          catalog_id?: string | null
          id?: string
          property_id: string
          room_id?: string | null
        }
        Update: {
          amenity_key?: string
          amenity_label?: string | null
          catalog_id?: string | null
          id?: string
          property_id?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_amenities_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "amenity_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_amenities_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_amenities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_categories: {
        Row: {
          canonical_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          faq: Json
          hero_image_url: string | null
          icon: string
          id: string
          intro_markdown: string | null
          is_published: boolean
          kind: string
          label: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          faq?: Json
          hero_image_url?: string | null
          icon?: string
          id?: string
          intro_markdown?: string | null
          is_published?: boolean
          kind: string
          label: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          faq?: Json
          hero_image_url?: string | null
          icon?: string
          id?: string
          intro_markdown?: string | null
          is_published?: boolean
          kind?: string
          label?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "property_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      property_counters: {
        Row: {
          last_booking_number: number
          property_id: string
          updated_at: string
        }
        Insert: {
          last_booking_number?: number
          property_id: string
          updated_at?: string
        }
        Update: {
          last_booking_number?: number
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_counters_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_local_picks: {
        Row: {
          blurb: string | null
          category: string
          created_at: string
          distance_label: string | null
          id: string
          image_path: string | null
          property_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          category?: string
          created_at?: string
          distance_label?: string | null
          id?: string
          image_path?: string | null
          property_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          category?: string
          created_at?: string
          distance_label?: string | null
          id?: string
          image_path?: string | null
          property_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_local_picks_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          property_id: string
          room_id: string | null
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id: string
          room_id?: string | null
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id?: string
          room_id?: string | null
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_photos_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_points_of_interest: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          property_id: string
          sort_order: number
          travel_time: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          property_id: string
          sort_order?: number
          travel_time?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          property_id?: string
          sort_order?: number
          travel_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_points_of_interest_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_policies: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          policy_id: string
          policy_type: string
          property_id: string
          room_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          policy_id: string
          policy_type: string
          property_id: string
          room_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          policy_id?: string
          policy_type?: string
          property_id?: string
          room_id?: string | null
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_policies_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_policies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_rankings: {
        Row: {
          component_plan_boost: number
          component_profile: number
          component_rating: number
          component_response_rate: number
          component_reviews: number
          last_calculated: string
          property_id: string
          ranking_score: number
        }
        Insert: {
          component_plan_boost?: number
          component_profile?: number
          component_rating?: number
          component_response_rate?: number
          component_reviews?: number
          last_calculated?: string
          property_id: string
          ranking_score?: number
        }
        Update: {
          component_plan_boost?: number
          component_profile?: number
          component_rating?: number
          component_response_rate?: number
          component_reviews?: number
          last_calculated?: string
          property_id?: string
          ranking_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_rankings_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_review_themes: {
        Row: {
          created_at: string
          icon_key: string
          id: string
          label: string
          mention_count: number | null
          property_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_key?: string
          id?: string
          label: string
          mention_count?: number | null
          property_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_key?: string
          id?: string
          label?: string
          mention_count?: number | null
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_themes_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_room_access: {
        Row: {
          check_in_instructions: string | null
          check_in_method: string | null
          created_at: string
          door_code: string | null
          gate_code: string | null
          room_id: string
          updated_at: string
          wifi_network: string | null
          wifi_password: string | null
        }
        Insert: {
          check_in_instructions?: string | null
          check_in_method?: string | null
          created_at?: string
          door_code?: string | null
          gate_code?: string | null
          room_id: string
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Update: {
          check_in_instructions?: string | null
          check_in_method?: string | null
          created_at?: string
          door_code?: string | null
          gate_code?: string | null
          room_id?: string
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_room_access_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_rooms: {
        Row: {
          allow_children: boolean
          allow_infants: boolean
          allow_pets: boolean
          base_occupancy: number | null
          base_price: number
          bathrooms: number | null
          bed_type: string | null
          bedrooms: number | null
          child_max_age: number
          child_price: number
          cleaning_fee: number
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          experiences: string[]
          extra_guest_price: number | null
          featured_photo_id: string | null
          floor_number: number | null
          has_ensuite_bathroom: boolean
          id: string
          infant_max_age: number
          infant_price: number
          inventory_count: number
          is_active: boolean
          max_guests: number
          min_guests: number
          min_nights: number
          name: string
          pet_fee: number
          pets_allowed: boolean
          price_per_person: number | null
          pricing_mode: string
          private_entrance: boolean
          property_id: string
          room_size_sqm: number | null
          smoking_allowed: boolean
          sort_order: number
          updated_at: string
          view_type: string | null
          weekend_price: number | null
          wheelchair_accessible: boolean
        }
        Insert: {
          allow_children?: boolean
          allow_infants?: boolean
          allow_pets?: boolean
          base_occupancy?: number | null
          base_price: number
          bathrooms?: number | null
          bed_type?: string | null
          bedrooms?: number | null
          child_max_age?: number
          child_price?: number
          cleaning_fee?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          experiences?: string[]
          extra_guest_price?: number | null
          featured_photo_id?: string | null
          floor_number?: number | null
          has_ensuite_bathroom?: boolean
          id?: string
          infant_max_age?: number
          infant_price?: number
          inventory_count?: number
          is_active?: boolean
          max_guests?: number
          min_guests?: number
          min_nights?: number
          name: string
          pet_fee?: number
          pets_allowed?: boolean
          price_per_person?: number | null
          pricing_mode?: string
          private_entrance?: boolean
          property_id: string
          room_size_sqm?: number | null
          smoking_allowed?: boolean
          sort_order?: number
          updated_at?: string
          view_type?: string | null
          weekend_price?: number | null
          wheelchair_accessible?: boolean
        }
        Update: {
          allow_children?: boolean
          allow_infants?: boolean
          allow_pets?: boolean
          base_occupancy?: number | null
          base_price?: number
          bathrooms?: number | null
          bed_type?: string | null
          bedrooms?: number | null
          child_max_age?: number
          child_price?: number
          cleaning_fee?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          experiences?: string[]
          extra_guest_price?: number | null
          featured_photo_id?: string | null
          floor_number?: number | null
          has_ensuite_bathroom?: boolean
          id?: string
          infant_max_age?: number
          infant_price?: number
          inventory_count?: number
          is_active?: boolean
          max_guests?: number
          min_guests?: number
          min_nights?: number
          name?: string
          pet_fee?: number
          pets_allowed?: boolean
          price_per_person?: number | null
          pricing_mode?: string
          private_entrance?: boolean
          property_id?: string
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
            referencedRelation: "property_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_rooms_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_seasonal_pricing: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          created_at: string
          currency: string
          end_date: string
          id: string
          is_active: boolean
          label: string
          min_nights: number | null
          price: number | null
          priority: number
          property_id: string
          room_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          adjustment_type?: string
          adjustment_value: number
          created_at?: string
          currency?: string
          end_date: string
          id?: string
          is_active?: boolean
          label: string
          min_nights?: number | null
          price?: number | null
          priority?: number
          property_id: string
          room_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          created_at?: string
          currency?: string
          end_date?: string
          id?: string
          is_active?: boolean
          label?: string
          min_nights?: number | null
          price?: number | null
          priority?: number
          property_id?: string
          room_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_seasonal_pricing_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_seasonal_pricing_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      property_view_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          duration_seconds: number | null
          id: string
          property_id: string
          referrer: string | null
          session_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          duration_seconds?: number | null
          id?: string
          property_id: string
          referrer?: string | null
          session_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          duration_seconds?: number | null
          id?: string
          property_id?: string
          referrer?: string | null
          session_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_view_events_listing_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_view_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          addon_id: string | null
          created_at: string
          id: string
          kind: string
          label: string
          quantity: number
          quote_id: string
          sort_order: number
          subtotal: number | null
          unit_price: number
        }
        Insert: {
          addon_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          label: string
          quantity?: number
          quote_id: string
          sort_order?: number
          subtotal?: number | null
          unit_price: number
        }
        Update: {
          addon_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          subtotal?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_addons_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          quote_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          quote_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_notes_quote_id_fkey"
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
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          currency: string
          id: string
          quote_id: string
          reason: string | null
          snapshot: Json
          total_amount: number
          version_no: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          quote_id: string
          reason?: string | null
          snapshot: Json
          total_amount?: number
          version_no: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          quote_id?: string
          reason?: string | null
          snapshot?: Json
          total_amount?: number
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_view_events: {
        Row: {
          device: string | null
          id: string
          opened_at: string
          quote_id: string
        }
        Insert: {
          device?: string | null
          id?: string
          opened_at?: string
          quote_id: string
        }
        Update: {
          device?: string | null
          id?: string
          opened_at?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_view_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accept_token: string
          accepted_at: string | null
          addons_total: number
          balance_amount: number
          balance_due_days: number
          base_amount: number
          check_in: string
          check_out: string
          cleaning_fee: number
          conversation_id: string | null
          converted_at: string | null
          converted_booking_id: string | null
          created_at: string
          currency: string
          declined_at: string | null
          deleted_at: string | null
          deposit_amount: number
          deposit_pct: number
          deposit_type: string
          discount_amount: number
          discount_reason: string | null
          discount_type: string | null
          discount_value: number
          guest_email: string
          guest_id: string | null
          guest_name: string
          guest_phone: string | null
          guests_breakdown: Json | null
          headcount: number
          host_id: string
          id: string
          looking_for_post_id: string | null
          notes: string | null
          policy_snapshot: Json | null
          previous_status: string | null
          price_mode: string
          property_id: string
          quote_number: string
          scope: string
          sent_at: string | null
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          accept_token?: string
          accepted_at?: string | null
          addons_total?: number
          balance_amount?: number
          balance_due_days?: number
          base_amount: number
          check_in: string
          check_out: string
          cleaning_fee?: number
          conversation_id?: string | null
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          deposit_amount?: number
          deposit_pct?: number
          deposit_type?: string
          discount_amount?: number
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number
          guest_email: string
          guest_id?: string | null
          guest_name: string
          guest_phone?: string | null
          guests_breakdown?: Json | null
          headcount?: number
          host_id: string
          id?: string
          looking_for_post_id?: string | null
          notes?: string | null
          policy_snapshot?: Json | null
          previous_status?: string | null
          price_mode?: string
          property_id: string
          quote_number: string
          scope?: string
          sent_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          accept_token?: string
          accepted_at?: string | null
          addons_total?: number
          balance_amount?: number
          balance_due_days?: number
          base_amount?: number
          check_in?: string
          check_out?: string
          cleaning_fee?: number
          conversation_id?: string | null
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          deleted_at?: string | null
          deposit_amount?: number
          deposit_pct?: number
          deposit_type?: string
          discount_amount?: number
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number
          guest_email?: string
          guest_id?: string | null
          guest_name?: string
          guest_phone?: string | null
          guests_breakdown?: Json | null
          headcount?: number
          host_id?: string
          id?: string
          looking_for_post_id?: string | null
          notes?: string | null
          policy_snapshot?: Json | null
          previous_status?: string | null
          price_mode?: string
          property_id?: string
          quote_number?: string
          scope?: string
          sent_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_looking_for_post_id_fkey"
            columns: ["looking_for_post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
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
          reference: string | null
          refund_method: string | null
          refund_number: string | null
          requested_amount: number
          status: string
          supporting_doc_url: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          reference?: string | null
          refund_method?: string | null
          refund_number?: string | null
          requested_amount: number
          status?: string
          supporting_doc_url?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          reference?: string | null
          refund_method?: string | null
          refund_number?: string | null
          requested_amount?: number
          status?: string
          supporting_doc_url?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          {
            foreignKeyName: "refund_requests_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
      report_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          file_storage_path: string | null
          file_url: string | null
          format: string
          host_id: string
          id: string
          report_type: string
          scheduled_report_id: string | null
          scope_filter: Json
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          format: string
          host_id: string
          id?: string
          report_type: string
          scheduled_report_id?: string | null
          scope_filter: Json
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          format?: string
          host_id?: string
          id?: string
          report_type?: string
          scheduled_report_id?: string | null
          scope_filter?: Json
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
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
      review_helpful_votes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_photos: {
        Row: {
          created_at: string
          id: string
          review_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
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
          guest_id: string | null
          id: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          guest_id?: string | null
          id?: string
          send_at?: string
          sent_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          guest_id?: string | null
          id?: string
          send_at?: string
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
          guest_id: string | null
          helpful_count: number
          host_id: string
          host_responded_at: string | null
          host_response: string | null
          id: string
          is_published: boolean
          property_id: string
          publish_at: string | null
          rating: number
          rating_accuracy: number | null
          rating_checkin: number | null
          rating_cleanliness: number | null
          rating_communication: number | null
          rating_location: number | null
          rating_value: number | null
          review_token: string | null
          token_expires_at: string | null
          trip_type: string | null
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
          guest_id?: string | null
          helpful_count?: number
          host_id: string
          host_responded_at?: string | null
          host_response?: string | null
          id?: string
          is_published?: boolean
          property_id: string
          publish_at?: string | null
          rating: number
          rating_accuracy?: number | null
          rating_checkin?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_location?: number | null
          rating_value?: number | null
          review_token?: string | null
          token_expires_at?: string | null
          trip_type?: string | null
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
          guest_id?: string | null
          helpful_count?: number
          host_id?: string
          host_responded_at?: string | null
          host_response?: string | null
          id?: string
          is_published?: boolean
          property_id?: string
          publish_at?: string | null
          rating?: number
          rating_accuracy?: number | null
          rating_checkin?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_location?: number | null
          rating_value?: number | null
          review_token?: string | null
          token_expires_at?: string | null
          trip_type?: string | null
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
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          sleeps: number
          sort_order: number
        }
        Insert: {
          bed_kind: string
          created_at?: string
          id?: string
          quantity?: number
          room_id: string
          sleeps?: number
          sort_order?: number
        }
        Update: {
          bed_kind?: string
          created_at?: string
          id?: string
          quantity?: number
          room_id?: string
          sleeps?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          description: string | null
          format: string
          host_id: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipients: Json
          report_type: string
          schedule_cron: string | null
          schedule_label: string | null
          scope_filter: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string
          host_id: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipients?: Json
          report_type: string
          schedule_cron?: string | null
          schedule_label?: string | null
          scope_filter?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          host_id?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipients?: Json
          report_type?: string
          schedule_cron?: string | null
          schedule_label?: string | null
          scope_filter?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_themes: {
        Row: {
          base: Json
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_premium: boolean
          name: string
          page_templates: Json
          preview_image_path: string | null
          price: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base?: Json
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_premium?: boolean
          name: string
          page_templates?: Json
          preview_image_path?: string | null
          price?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base?: Json
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_premium?: boolean
          name?: string
          page_templates?: Json
          preview_image_path?: string | null
          price?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      special_addons: {
        Row: {
          addon_id: string
          id: string
          is_required: boolean
          quantity: number
          sort_order: number
          special_id: string
          unit_price_override: number | null
        }
        Insert: {
          addon_id: string
          id?: string
          is_required?: boolean
          quantity?: number
          sort_order?: number
          special_id: string
          unit_price_override?: number | null
        }
        Update: {
          addon_id?: string
          id?: string
          is_required?: boolean
          quantity?: number
          sort_order?: number
          special_id?: string
          unit_price_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "special_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_addons_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
        ]
      }
      special_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          intro_markdown: string | null
          is_active: boolean
          key: string
          label: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          intro_markdown?: string | null
          is_active?: boolean
          key: string
          label: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          intro_markdown?: string | null
          is_active?: boolean
          key?: string
          label?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      special_view_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          event: string
          id: string
          referrer_host: string | null
          session_id: string | null
          special_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          referrer_host?: string | null
          session_id?: string | null
          special_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          referrer_host?: string | null
          session_id?: string | null
          special_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_view_events_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
        ]
      }
      specials: {
        Row: {
          badge: string | null
          book_by: string | null
          business_id: string
          cancellation_policy_id: string | null
          categories: string[]
          created_at: string
          currency: string
          custom_tags: string[]
          date_mode: string
          deleted_at: string | null
          description: string | null
          fixed_check_in: string | null
          fixed_check_out: string | null
          flat_total: number | null
          go_live_at: string | null
          hero_image_path: string | null
          host_id: string
          id: string
          is_featured: boolean
          max_guests: number | null
          max_nights: number | null
          min_nights: number | null
          per_night_price: number | null
          price_mode: string
          property_id: string
          quantity: number
          redemptions_used: number
          room_id: string | null
          savings_amount: number | null
          savings_pct: number | null
          show_in_directory: boolean
          show_on_website: boolean
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          was_price: number | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          badge?: string | null
          book_by?: string | null
          business_id: string
          cancellation_policy_id?: string | null
          categories?: string[]
          created_at?: string
          currency?: string
          custom_tags?: string[]
          date_mode: string
          deleted_at?: string | null
          description?: string | null
          fixed_check_in?: string | null
          fixed_check_out?: string | null
          flat_total?: number | null
          go_live_at?: string | null
          hero_image_path?: string | null
          host_id: string
          id?: string
          is_featured?: boolean
          max_guests?: number | null
          max_nights?: number | null
          min_nights?: number | null
          per_night_price?: number | null
          price_mode: string
          property_id: string
          quantity?: number
          redemptions_used?: number
          room_id?: string | null
          savings_amount?: number | null
          savings_pct?: number | null
          show_in_directory?: boolean
          show_on_website?: boolean
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          was_price?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          badge?: string | null
          book_by?: string | null
          business_id?: string
          cancellation_policy_id?: string | null
          categories?: string[]
          created_at?: string
          currency?: string
          custom_tags?: string[]
          date_mode?: string
          deleted_at?: string | null
          description?: string | null
          fixed_check_in?: string | null
          fixed_check_out?: string | null
          flat_total?: number | null
          go_live_at?: string | null
          hero_image_path?: string | null
          host_id?: string
          id?: string
          is_featured?: boolean
          max_guests?: number | null
          max_nights?: number | null
          min_nights?: number | null
          per_night_price?: number | null
          price_mode?: string
          property_id?: string
          quantity?: number
          redemptions_used?: number
          room_id?: string | null
          savings_amount?: number | null
          savings_pct?: number | null
          show_in_directory?: boolean
          show_on_website?: boolean
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          was_price?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specials_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specials_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specials_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
        ]
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
          product_id: string | null
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
          product_id?: string | null
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
          product_id?: string | null
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
          {
            foreignKeyName: "subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          category_id: string
          digest_mode: string
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          digest_mode?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          digest_mode?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          dedupe_enabled: boolean
          digest_send_hour: number
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          quiet_hours_timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          dedupe_enabled?: boolean
          digest_send_hour?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          dedupe_enabled?: boolean
          digest_send_hour?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          id_verified_at: string | null
          is_active: boolean
          is_lead: boolean
          languages: string[]
          marketing_opt_in: boolean
          phone: string | null
          phone_verified_at: string | null
          preferred_cities: string[]
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          id_verified_at?: string | null
          is_active?: boolean
          is_lead?: boolean
          languages?: string[]
          marketing_opt_in?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          preferred_cities?: string[]
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_verified_at?: string | null
          is_active?: boolean
          is_lead?: boolean
          languages?: string[]
          marketing_opt_in?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          preferred_cities?: string[]
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_analytics_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          event: string
          id: string
          path: string
          referrer_host: string | null
          session_id: string | null
          website_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          path?: string
          referrer_host?: string | null
          session_id?: string | null
          website_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          path?: string
          referrer_host?: string | null
          session_id?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_analytics_events_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_blog_authors: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          website_id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          website_id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_authors_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_categories_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "website_blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      website_blog_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body_html: string | null
          category_id: string | null
          cover_path: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string | null
          featured: boolean
          id: string
          publish_at: string | null
          seo: Json
          slug: string
          status: string
          title: string
          updated_at: string
          website_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body_html?: string | null
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          publish_at?: string | null
          seo?: Json
          slug: string
          status?: string
          title: string
          updated_at?: string
          website_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body_html?: string | null
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          publish_at?: string | null
          seo?: Json
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "website_blog_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "website_blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_blog_posts_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_blog_tags_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_domain_events: {
        Row: {
          created_at: string
          detail: Json
          event: string
          id: string
          website_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event: string
          id?: string
          website_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_domain_events_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_form_submissions: {
        Row: {
          booking_id: string | null
          conversation_id: string | null
          created_at: string
          data: Json
          form_id: string | null
          id: string
          source: string
          status: string
          website_id: string
        }
        Insert: {
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
          source?: string
          status?: string
          website_id: string
        }
        Update: {
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string | null
          id?: string
          source?: string
          status?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_form_submissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_form_submissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "website_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_form_submissions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_forms: {
        Row: {
          created_at: string
          deleted_at: string | null
          fields: Json
          id: string
          is_default: boolean
          name: string
          settings: Json
          type: string
          updated_at: string
          website_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fields?: Json
          id?: string
          is_default?: boolean
          name: string
          settings?: Json
          type?: string
          updated_at?: string
          website_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fields?: Json
          id?: string
          is_default?: boolean
          name?: string
          settings?: Json
          type?: string
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_forms_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_media: {
        Row: {
          alt: string | null
          created_at: string
          height: number | null
          id: string
          mime: string | null
          path: string
          size_bytes: number | null
          updated_at: string
          website_id: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime?: string | null
          path: string
          size_bytes?: number | null
          updated_at?: string
          website_id: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime?: string | null
          path?: string
          size_bytes?: number | null
          updated_at?: string
          website_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "website_media_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          created_at: string
          draft_sections: Json
          id: string
          kind: string
          nav_label: string | null
          nav_order: number
          published_sections: Json
          seo_overrides: Json
          show_in_nav: boolean
          slug: string
          title: string | null
          updated_at: string
          website_id: string
        }
        Insert: {
          created_at?: string
          draft_sections?: Json
          id?: string
          kind?: string
          nav_label?: string | null
          nav_order?: number
          published_sections?: Json
          seo_overrides?: Json
          show_in_nav?: boolean
          slug: string
          title?: string | null
          updated_at?: string
          website_id: string
        }
        Update: {
          created_at?: string
          draft_sections?: Json
          id?: string
          kind?: string
          nav_label?: string | null
          nav_order?: number
          published_sections?: Json
          seo_overrides?: Json
          show_in_nav?: boolean
          slug?: string
          title?: string | null
          updated_at?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_pages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_properties: {
        Row: {
          created_at: string
          display_overrides: Json
          id: string
          is_visible: boolean
          property_id: string
          sort_order: number
          website_id: string
        }
        Insert: {
          created_at?: string
          display_overrides?: Json
          id?: string
          is_visible?: boolean
          property_id: string
          sort_order?: number
          website_id: string
        }
        Update: {
          created_at?: string
          display_overrides?: Json
          id?: string
          is_visible?: boolean
          property_id?: string
          sort_order?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_properties_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_restore_points: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          snapshot: Json
          theme_slug: string | null
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          snapshot: Json
          theme_slug?: string | null
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          snapshot?: Json
          theme_slug?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_restore_points_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_rooms: {
        Row: {
          badge: string | null
          created_at: string
          detail_overrides: Json | null
          display_currency: string | null
          display_desc: string | null
          display_name: string | null
          display_price: number | null
          featured: boolean
          id: string
          is_visible: boolean
          media_overrides: Json
          room_id: string
          sort_order: number
          website_id: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          detail_overrides?: Json | null
          display_currency?: string | null
          display_desc?: string | null
          display_name?: string | null
          display_price?: number | null
          featured?: boolean
          id?: string
          is_visible?: boolean
          media_overrides?: Json
          room_id: string
          sort_order?: number
          website_id: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          detail_overrides?: Json | null
          display_currency?: string | null
          display_desc?: string | null
          display_name?: string | null
          display_price?: number | null
          featured?: boolean
          id?: string
          is_visible?: boolean
          media_overrides?: Json
          room_id?: string
          sort_order?: number
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "property_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_rooms_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "host_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      wielo_invoices: {
        Row: {
          buyer_snapshot: Json
          created_at: string
          currency: string
          environment: string
          hosted_token: string
          id: string
          invoice_number: string
          issued_at: string
          ledger_id: string | null
          line_items: Json
          order_id: string | null
          paid_at: string | null
          pdf_storage_path: string | null
          status: string
          subscription_id: string | null
          subtotal: number
          total_amount: number
          user_id: string | null
          vat_amount: number
          wielo_snapshot: Json
        }
        Insert: {
          buyer_snapshot: Json
          created_at?: string
          currency?: string
          environment?: string
          hosted_token?: string
          id?: string
          invoice_number: string
          issued_at?: string
          ledger_id?: string | null
          line_items?: Json
          order_id?: string | null
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
          subscription_id?: string | null
          subtotal?: number
          total_amount?: number
          user_id?: string | null
          vat_amount?: number
          wielo_snapshot: Json
        }
        Update: {
          buyer_snapshot?: Json
          created_at?: string
          currency?: string
          environment?: string
          hosted_token?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          ledger_id?: string | null
          line_items?: Json
          order_id?: string | null
          paid_at?: string | null
          pdf_storage_path?: string | null
          status?: string
          subscription_id?: string | null
          subtotal?: number
          total_amount?: number
          user_id?: string | null
          vat_amount?: number
          wielo_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "wielo_invoices_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "platform_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wielo_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wielo_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wielo_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      _access_line: {
        Args: { p_label: string; p_val: string }
        Returns: string
      }
      _can_read_host: { Args: { p_host_id: string }; Returns: boolean }
      _host_guest_rows: {
        Args: { p_host_id: string }
        Returns: {
          avatar_url: string
          avg_rating: number
          channel: string
          channels: string[]
          country: string
          currency: string
          direct_value: number
          email: string
          est_fees_saved: number
          first_stay: string
          gkey: string
          guest_id: string
          guest_since: string
          has_email: boolean
          has_phone: boolean
          is_added_guest: boolean
          is_all_direct: boolean
          is_blocked: boolean
          is_inhouse: boolean
          is_lapsed: boolean
          is_new: boolean
          is_ota: boolean
          is_returning: boolean
          is_verified: boolean
          is_vip: boolean
          last_status: string
          last_stay: string
          lifetime_value: number
          listing_ids: string[]
          name: string
          next_listing: string
          next_stay: string
          phone: string
          review_count: number
          tags: string[]
          total_bookings: number
          total_nights: number
          total_stays: number
        }[]
      }
      _materialize_booking_party: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
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
      accrue_affiliate_commission: {
        Args: { p_ledger_id: string }
        Returns: string
      }
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
      app_purge_user_account: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      block_special_dates: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_property_id: string
          p_room_id: string
          p_special_id: string
        }
        Returns: undefined
      }
      booking_business_id: { Args: { p_booking_id: string }; Returns: string }
      broadcast_audience: {
        Args: { p_audience: string; p_host_id: string }
        Returns: {
          email: string
          first_name: string
          gkey: string
          status: string
        }[]
      }
      business_doc_code: { Args: { p_business_id: string }; Returns: string }
      calculate_booking_price: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_listing_id: string
          p_room_id?: string
        }
        Returns: Json
      }
      calculate_looking_for_match_score: {
        Args: { p_host_id: string; p_post_id: string }
        Returns: Json
      }
      calculate_policy_refund_amount: {
        Args: { p_booking_id: string; p_cancelled_at?: string }
        Returns: Json
      }
      can_send_broadcast: { Args: { p_host_id: string }; Returns: Json }
      check_feature_permission: {
        Args: { p_feature_key: string; p_host_id: string }
        Returns: Json
      }
      check_guest_post_quota: { Args: { p_user_id: string }; Returns: Json }
      check_host_availability_for_dates: {
        Args: { p_check_in: string; p_check_out: string; p_host_id: string }
        Returns: Json
      }
      check_host_quote_quota: { Args: { p_host_id: string }; Returns: Json }
      claim_email_queue_batch: {
        Args: { p_limit: number; p_stale_seconds?: number }
        Returns: {
          category_id: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          failed_at: string | null
          guest_id: string | null
          host_id: string | null
          id: string
          payload: Json
          sent_at: string | null
          type: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_push_queue_batch: {
        Args: { p_limit: number; p_stale_seconds?: number }
        Returns: {
          claimed_at: string | null
          created_at: string
          error: string | null
          event_kind: string
          failed_at: string | null
          id: string
          payload: Json
          release_at: string
          sent_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pending_push_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clawback_affiliate_commission: {
        Args: { p_refund_ledger_id: string; p_source_ledger_id: string }
        Returns: undefined
      }
      clear_all: { Args: never; Returns: string }
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
      count_broadcast_recipients: {
        Args: { p_audience: string; p_host_id: string }
        Returns: Json
      }
      create_affiliate_payout: {
        Args: { p_affiliate_id: string; p_method: string }
        Returns: Json
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
      effective_vat_rate: { Args: { p_listing_id: string }; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_in_app_notification: {
        Args: {
          p_body?: string
          p_category_id?: string
          p_kind: string
          p_link?: string
          p_payload?: Json
          p_severity?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      ensure_booking_invoice: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      ensure_host_booking_terms: {
        Args: { p_host_id: string }
        Returns: undefined
      }
      ensure_host_default_policies: {
        Args: { p_host_id: string }
        Returns: undefined
      }
      ensure_host_legal_presets: {
        Args: { p_host_id: string }
        Returns: undefined
      }
      ensure_host_policy_presets: {
        Args: { p_host_id: string }
        Returns: undefined
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_specials: { Args: never; Returns: number }
      fetch_channel_mix: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_conversion_funnel: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_guest_demographics: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_guest_record: {
        Args: { p_gkey: string; p_host_id: string }
        Returns: Json
      }
      fetch_host_guests: {
        Args: {
          p_business_id?: string
          p_channel?: string
          p_host_id: string
          p_limit?: number
          p_listing_id?: string
          p_min_rating?: number
          p_offset?: number
          p_search?: string
          p_segment?: string
          p_sort?: string
        }
        Returns: Json
      }
      fetch_host_guests_summary: { Args: { p_host_id: string }; Returns: Json }
      fetch_host_savings: { Args: { p_host_id: string }; Returns: Json }
      fetch_looking_for_stats: {
        Args: { p_end_date?: string; p_host_id: string; p_start_date?: string }
        Returns: Json
      }
      fetch_platform_commission_saved: { Args: never; Returns: number }
      fetch_popular_rooms: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_limit?: number
          p_start_date: string
        }
        Returns: Json
      }
      fetch_primary_kpis: {
        Args: {
          p_channel?: string
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_property_performance: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_limit?: number
          p_offset?: number
          p_sort_by?: string
          p_sort_direction?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_refunds_cancellations: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_regional_breakdown: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_revenue_trend: {
        Args: {
          p_channel?: string
          p_end_date: string
          p_grouping?: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_seasonality_heatmap: {
        Args: { p_host_id: string; p_year: number }
        Returns: Json
      }
      fetch_secondary_metrics: {
        Args: {
          p_channel?: string
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      fetch_time_to_book: {
        Args: {
          p_end_date: string
          p_host_id: string
          p_listing_id?: string
          p_start_date: string
        }
        Returns: Json
      }
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
        Args: { p_listing_id: string; p_room_id?: string }
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
      get_special_booking_conflict: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_property_id: string
          p_room_id: string
        }
        Returns: string
      }
      gettransactionid: { Args: never; Returns: unknown }
      guest_gkey_for_email: { Args: { p_email: string }; Returns: string }
      has_admin_permission: { Args: { p_key: string }; Returns: boolean }
      import_ical_blocks: {
        Args: { p_dates: string[]; p_feed_id: string; p_property_id: string }
        Returns: number
      }
      increment_help_article_view: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      is_period_closed: {
        Args: { p_date: string; p_host_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      listing_doc_code: { Args: { p_listing_id: string }; Returns: string }
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
      mark_delivery_read: { Args: { p_log_id: string }; Returns: undefined }
      materialize_booking_party: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      next_credit_note_number: {
        Args: { p_business_id: string }
        Returns: string
      }
      next_invoice_number: { Args: { p_business_id: string }; Returns: string }
      next_quote_number: { Args: { p_business_id: string }; Returns: string }
      next_receipt_number: { Args: { p_business_id: string }; Returns: string }
      next_refund_number: { Args: { p_business_id: string }; Returns: string }
      next_wielo_invoice_number: { Args: never; Returns: string }
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
      redeem_coupon: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_coupon_id: string
          p_currency: string
          p_guest_id: string
        }
        Returns: boolean
      }
      redeem_special: { Args: { p_special_id: string }; Returns: boolean }
      release_addon_stock: {
        Args: { p_addon_id: string; p_qty: number }
        Returns: undefined
      }
      release_booking_addon_stock: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      release_special: { Args: { p_special_id: string }; Returns: undefined }
      release_special_dates: {
        Args: { p_special_id: string }
        Returns: undefined
      }
      reserve_addon_stock: {
        Args: { p_addon_id: string; p_qty: number }
        Returns: boolean
      }
      resolve_listing_policy_id: {
        Args: { p_listing_id: string; p_room_id: string; p_type: string }
        Returns: string
      }
      resolve_notification_prefs: {
        Args: { p_category_id: string; p_user_id: string }
        Returns: {
          digest_mode: string
          email_enabled: boolean
          in_app_enabled: boolean
          is_locked: boolean
          push_enabled: boolean
        }[]
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
      send_due_access_cards: { Args: never; Returns: number }
      set_affiliate_status: {
        Args: {
          p_admin: string
          p_affiliate_id: string
          p_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      settle_affiliate_payout: {
        Args: {
          p_action: string
          p_admin: string
          p_payout_id: string
          p_reason?: string
          p_reference?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_booking_policies: {
        Args: {
          p_booking_id: string
          p_listing_id: string
          p_special_cancellation_policy_id?: string
        }
        Returns: undefined
      }
      special_dates_available: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_exclude_special_id?: string
          p_property_id: string
          p_room_id: string
        }
        Returns: boolean
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
      vote_help_article: {
        Args: { p_article_id: string; p_vote: string }
        Returns: {
          helpful_count: number
          not_helpful_count: number
        }[]
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
