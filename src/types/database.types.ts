export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_entity: string
          target_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_entity: string
          target_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_entity?: string
          target_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_en: string | null
          name_fr: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_fr: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_fr?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_complements: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_all_categories: boolean
          name_en: string | null
          name_fr: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_all_categories?: boolean
          name_en?: string | null
          name_fr: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_all_categories?: boolean
          name_en?: string | null
          name_fr?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_complement_categories: {
        Row: {
          category_id: string
          complement_id: string
          created_at: string
        }
        Insert: {
          category_id: string
          complement_id: string
          created_at?: string
        }
        Update: {
          category_id?: string
          complement_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_complement_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_complement_categories_complement_id_fkey"
            columns: ["complement_id"]
            isOneToOne: false
            referencedRelation: "menu_complements"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          menu_item_id: string
          name_en: string | null
          name_fr: string
          price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id: string
          name_en?: string | null
          name_fr: string
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id?: string
          name_en?: string | null
          name_fr?: string
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variants_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description_en: string | null
          description_fr: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_available: boolean
          item_type: string
          name_en: string | null
          name_fr: string
          preparation_time_minutes: number | null
          price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          item_type?: string
          name_en?: string | null
          name_fr: string
          preparation_time_minutes?: number | null
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_fr?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          item_type?: string
          name_en?: string | null
          name_fr?: string
          preparation_time_minutes?: number | null
          price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_name: string
          menu_item_id: string | null
          order_id: string
          quantity: number
          selected_complements: Json
          special_notes: string | null
          subtotal: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          id?: string
          item_name: string
          menu_item_id?: string | null
          order_id: string
          quantity: number
          selected_complements?: Json
          special_notes?: string | null
          subtotal: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          id?: string
          item_name?: string
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          selected_complements?: Json
          special_notes?: string | null
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "menu_item_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token_hash: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_schedule_type: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_mode: string
          order_origin: string
          payment_status: string
          preparation_status: string
          public_reference: string
          room_number: string | null
          scheduled_delivery_time: string | null
          table_number: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          access_token_hash: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_schedule_type?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_mode: string
          order_origin?: string
          payment_status?: string
          preparation_status?: string
          public_reference: string
          room_number?: string | null
          scheduled_delivery_time?: string | null
          table_number?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          access_token_hash?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_schedule_type?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_mode?: string
          order_origin?: string
          payment_status?: string
          preparation_status?: string
          public_reference?: string
          room_number?: string | null
          scheduled_delivery_time?: string | null
          table_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_declarations: {
        Row: {
          created_at: string
          customer_note: string | null
          declared_reference: string | null
          id: string
          operator: string
          order_id: string
          payer_phone: string | null
          raw_sms_text: string | null
        }
        Insert: {
          created_at?: string
          customer_note?: string | null
          declared_reference?: string | null
          id?: string
          operator: string
          order_id: string
          payer_phone?: string | null
          raw_sms_text?: string | null
        }
        Update: {
          created_at?: string
          customer_note?: string | null
          declared_reference?: string | null
          id?: string
          operator?: string
          order_id?: string
          payer_phone?: string | null
          raw_sms_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_declarations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          account_name: string
          id: string
          instructions_en: string | null
          instructions_fr: string | null
          is_active: boolean
          is_tested_on_device: boolean
          merchant_code: string
          phone_number: string | null
          updated_at: string
          ussd_mode: string
        }
        Insert: {
          account_name?: string
          id: string
          instructions_en?: string | null
          instructions_fr?: string | null
          is_active?: boolean
          is_tested_on_device?: boolean
          merchant_code?: string
          phone_number?: string | null
          updated_at?: string
          ussd_mode?: string
        }
        Update: {
          account_name?: string
          id?: string
          instructions_en?: string | null
          instructions_fr?: string | null
          is_active?: boolean
          is_tested_on_device?: boolean
          merchant_code?: string
          phone_number?: string | null
          updated_at?: string
          ussd_mode?: string
        }
        Relationships: []
      }
      payment_verifications: {
        Row: {
          created_at: string
          id: string
          internal_notes: string | null
          order_id: string
          status: string
          verified_by: string
          verified_reference: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          order_id: string
          status: string
          verified_by: string
          verified_reference?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          order_id?: string
          status?: string
          verified_by?: string
          verified_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_verifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          currency: string
          delivery_fee: number | null
          hotel_address: string
          hotel_name: string
          hotel_phone: string | null
          id: string
          modes_active: Json
          updated_at: string
        }
        Insert: {
          currency?: string
          delivery_fee?: number | null
          hotel_address?: string
          hotel_name?: string
          hotel_phone?: string | null
          id?: string
          modes_active?: Json
          updated_at?: string
        }
        Update: {
          currency?: string
          delivery_fee?: number | null
          hotel_address?: string
          hotel_name?: string
          hotel_phone?: string | null
          id?: string
          modes_active?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order_client: {
        Args: {
          p_public_reference: string
          p_raw_token: string
          p_reason?: string
        }
        Returns: Json
      }
      clear_orders_history: {
        Args: {
          p_scope?: string
        }
        Returns: Json
      }
      confirm_payment: {
        Args: {
          p_order_id: string
          p_verified_reference: string
          p_internal_notes?: string
        }
        Returns: Json
      }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone?: string
          p_order_mode: string
          p_location_detail: string
          p_notes: string
          p_items: Json
          p_idempotency_key: string
          p_raw_token: string
        }
        Returns: Json
      }
      create_order_with_schedule: {
        Args: {
          p_customer_name: string
          p_customer_phone?: string
          p_order_mode: string
          p_location_detail: string
          p_notes: string
          p_items: Json
          p_idempotency_key: string
          p_raw_token: string
          p_delivery_schedule_type?: string
          p_scheduled_delivery_time?: string | null
        }
        Returns: Json
      }
      current_user_role: { Args: never; Returns: string }
      register_staff_push_subscription: {
        Args: { p_token: string; p_language?: string; p_user_agent?: string }
        Returns: Json
      }
      unregister_staff_push_token: {
        Args: { p_token: string }
        Returns: Json
      }
      register_client_push_subscription: {
        Args: {
          p_public_reference: string
          p_raw_token: string
          p_fcm_token: string
          p_language?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      unregister_client_push_subscription: {
        Args: { p_public_reference: string; p_raw_token: string; p_fcm_token: string }
        Returns: Json
      }
      get_client_order: {
        Args: { p_public_reference: string; p_raw_token: string }
        Returns: Json
      }
      get_public_payment_options: { Args: never; Returns: Json }
      reject_payment: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      request_payment_review: {
        Args: { p_order_id: string; p_internal_notes: string }
        Returns: Json
      }
      submit_payment_declaration: {
        Args: {
          p_public_reference: string
          p_raw_token: string
          p_operator: string
          p_declared_ref?: string
          p_raw_sms?: string
          p_payer_phone?: string
          p_note?: string
        }
        Returns: Json
      }
      update_order_preparation_status: {
        Args: { p_order_id: string; p_new_status: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
