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
  public: {
    Tables: {
      asset_types: {
        Row: {
          active: boolean
          category: string
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_system: boolean
          metadata: Json
          name_i18n: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          metadata?: Json
          name_i18n?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          metadata?: Json
          name_i18n?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type_id: string
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          install_date: string | null
          location_id: string | null
          manufacture_date: string | null
          manufacturer: string | null
          metadata: Json
          model: string | null
          name: string | null
          notes: string | null
          qr_token: string
          retire_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          asset_type_id: string
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          install_date?: string | null
          location_id?: string | null
          manufacture_date?: string | null
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name?: string | null
          notes?: string | null
          qr_token: string
          retire_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          asset_type_id?: string
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          install_date?: string | null
          location_id?: string | null
          manufacture_date?: string | null
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name?: string | null
          notes?: string | null
          qr_token?: string
          retire_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: Json | null
          company_id: string
          context: Json | null
          created_at: string
          id: number
          member_id: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id?: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_05: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: Json | null
          company_id: string
          context: Json | null
          created_at: string
          id: number
          member_id: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id?: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_06: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: Json | null
          company_id: string
          context: Json | null
          created_at: string
          id: number
          member_id: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id?: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_07: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: Json | null
          company_id: string
          context: Json | null
          created_at: string
          id: number
          member_id: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: Json | null
          company_id?: string
          context?: Json | null
          created_at?: string
          id?: number
          member_id?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_outbox: {
        Row: {
          created_at: string
          id: number
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: number
          payload: Json
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          active_until: string | null
          address: string | null
          cif: string
          created_at: string
          deleted_at: string | null
          id: string
          locale: string
          logo_url: string | null
          name: string
          plan: string
          primary_color: string | null
          seat_limit: number | null
          storage_limit_mb: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          active_until?: string | null
          address?: string | null
          cif: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string | null
          seat_limit?: number | null
          storage_limit_mb?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          active_until?: string | null
          address?: string | null
          cif?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string | null
          seat_limit?: number | null
          storage_limit_mb?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_features: {
        Row: {
          company_id: string
          config: Json
          enabled: boolean
          feature_key: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          enabled?: boolean
          feature_key: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          enabled?: boolean
          feature_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          joined_at?: string
          left_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counters: {
        Row: {
          company_id: string
          scope: string
          value: number
          year: number
        }
        Insert: {
          company_id: string
          scope: string
          value?: number
          year: number
        }
        Update: {
          company_id?: string
          scope?: string
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      first_aid_kit_contents: {
        Row: {
          batch_code: string | null
          created_at: string
          expires_on: string | null
          id: string
          kit_asset_id: string
          notes: string | null
          product_code: string | null
          product_name: string
          quantity: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          kit_asset_id: string
          notes?: string | null
          product_code?: string | null
          product_name: string
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          kit_asset_id?: string
          notes?: string | null
          product_code?: string | null
          product_name?: string
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "first_aid_kit_contents_kit_asset_id_fkey"
            columns: ["kit_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          metadata: Json
          name: string
          notes: string | null
          parent_location_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          name: string
          notes?: string | null
          parent_location_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          name?: string
          notes?: string | null
          parent_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_mounts: {
        Row: {
          created_at: string
          id: string
          mounted_asset_id: string
          mounted_at: string
          notes: string | null
          position: string | null
          removed_at: string | null
          updated_at: string
          vehicle_asset_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mounted_asset_id: string
          mounted_at?: string
          notes?: string | null
          position?: string | null
          removed_at?: string | null
          updated_at?: string
          vehicle_asset_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mounted_asset_id?: string
          mounted_at?: string
          notes?: string | null
          position?: string | null
          removed_at?: string | null
          updated_at?: string
          vehicle_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mounts_mounted_asset_id_fkey"
            columns: ["mounted_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mounts_vehicle_asset_id_fkey"
            columns: ["vehicle_asset_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          asset_id: string
          brand: string | null
          color: string | null
          company_id: string
          created_at: string
          current_km: number | null
          fuel_type: string | null
          insurance_expires_on: string | null
          itv_expires_on: string | null
          license_plate: string
          metadata: Json
          notes: string | null
          updated_at: string
          vehicle_model: string | null
          vin: string | null
        }
        Insert: {
          asset_id: string
          brand?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          current_km?: number | null
          fuel_type?: string | null
          insurance_expires_on?: string | null
          itv_expires_on?: string | null
          license_plate: string
          metadata?: Json
          notes?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vin?: string | null
        }
        Update: {
          asset_id?: string
          brand?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          current_km?: number | null
          fuel_type?: string | null
          insurance_expires_on?: string | null
          itv_expires_on?: string | null
          license_plate?: string
          metadata?: Json
          notes?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_close_session: { Args: { p_company_id: string }; Returns: boolean }
      can_manage_assets: { Args: { p_company_id: string }; Returns: boolean }
      can_manage_company: { Args: { p_company_id: string }; Returns: boolean }
      can_reopen_session: { Args: { p_company_id: string }; Returns: boolean }
      can_run_maintenance: { Args: { p_company_id: string }; Returns: boolean }
      can_view: { Args: { p_company_id: string }; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      has_role_in: {
        Args: {
          p_company_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      next_code: {
        Args: { p_company_id: string; p_prefix: string; p_scope: string }
        Returns: string
      }
      user_company_ids: { Args: never; Returns: string[] }
      user_has_membership: { Args: { p_company_id: string }; Returns: boolean }
      user_role_in: {
        Args: { p_company_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role:
        | "administrator"
        | "system_manager"
        | "manager"
        | "employee"
        | "auditor"
      audit_action:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "REOPEN"
        | "SIGN"
        | "IMPORT"
    }
    CompositeTypes: {
      [_ in never]: never
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
  public: {
    Enums: {
      app_role: [
        "administrator",
        "system_manager",
        "manager",
        "employee",
        "auditor",
      ],
      audit_action: ["INSERT", "UPDATE", "DELETE", "REOPEN", "SIGN", "IMPORT"],
    },
  },
} as const
