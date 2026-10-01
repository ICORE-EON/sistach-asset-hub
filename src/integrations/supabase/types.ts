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
      asset_families: {
        Row: {
          active: boolean
          code: string
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          is_system: boolean
          name_i18n: Json
          requires_certificate: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name_i18n?: Json
          requires_certificate?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name_i18n?: Json
          requires_certificate?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_families_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_families_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      asset_types: {
        Row: {
          active: boolean
          category: string
          code: string
          company_id: string | null
          created_at: string
          family_id: string | null
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
          family_id?: string | null
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
          family_id?: string | null
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
          {
            foreignKeyName: "asset_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "asset_types_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "asset_families"
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
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
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
      audit_logs_2026_08: {
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
      audit_logs_2026_09: {
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
      audit_logs_2026_10: {
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
      audit_logs_2026_11: {
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
      audit_logs_2026_12: {
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
      audit_logs_2027_01: {
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
      certificate_items: {
        Row: {
          asset_id: string | null
          certificate_id: string
          company_id: string | null
          created_at: string
          id: string
          maintenance_item_id: string | null
          maintenance_session_id: string | null
          notes: string | null
          result: string
        }
        Insert: {
          asset_id?: string | null
          certificate_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          maintenance_item_id?: string | null
          maintenance_session_id?: string | null
          notes?: string | null
          result?: string
        }
        Update: {
          asset_id?: string | null
          certificate_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          maintenance_item_id?: string | null
          maintenance_session_id?: string | null
          notes?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_items_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "certificate_items_maintenance_item_id_fkey"
            columns: ["maintenance_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_items_maintenance_session_id_fkey"
            columns: ["maintenance_session_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          asset_family_id: string | null
          code: string
          columns: Json
          company_id: string
          created_at: string
          deleted_at: string | null
          footer_text: string
          id: string
          intro_text: string
          is_default: boolean
          language: string
          logo_url: string | null
          name: string
          notes: string | null
          paper_size: string
          regulation_text: string
          show_company_stamp: boolean
          show_logo: boolean
          show_signature: boolean
          title: string
          updated_at: string
        }
        Insert: {
          asset_family_id?: string | null
          code: string
          columns?: Json
          company_id: string
          created_at?: string
          deleted_at?: string | null
          footer_text?: string
          id?: string
          intro_text?: string
          is_default?: boolean
          language?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          paper_size?: string
          regulation_text?: string
          show_company_stamp?: boolean
          show_logo?: boolean
          show_signature?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          asset_family_id?: string | null
          code?: string
          columns?: Json
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          footer_text?: string
          id?: string
          intro_text?: string
          is_default?: boolean
          language?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          paper_size?: string
          regulation_text?: string
          show_company_stamp?: boolean
          show_logo?: boolean
          show_signature?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_asset_family_id_fkey"
            columns: ["asset_family_id"]
            isOneToOne: false
            referencedRelation: "asset_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      certificates: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          external_cert_number: string | null
          external_provider: string | null
          id: string
          issued_on: string
          issuer_name: string | null
          issuer_role: string | null
          metadata: Json
          notes: string | null
          pdf_hash_sha256: string | null
          pdf_url: string | null
          signature_image_url: string | null
          signer_ip: unknown
          signer_user_agent: string | null
          status: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_cert_number?: string | null
          external_provider?: string | null
          id?: string
          issued_on?: string
          issuer_name?: string | null
          issuer_role?: string | null
          metadata?: Json
          notes?: string | null
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          signature_image_url?: string | null
          signer_ip?: unknown
          signer_user_agent?: string | null
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_cert_number?: string | null
          external_provider?: string | null
          id?: string
          issued_on?: string
          issuer_name?: string | null
          issuer_role?: string | null
          metadata?: Json
          notes?: string | null
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          signature_image_url?: string | null
          signer_ip?: unknown
          signer_user_agent?: string | null
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      checklist_questions: {
        Row: {
          company_id: string | null
          creates_incident: boolean
          fails_on: Json | null
          help_text: string | null
          id: string
          metadata: Json
          options: Json | null
          position: number
          prompt: string
          required: boolean
          response_type: string
          template_version_id: string
        }
        Insert: {
          company_id?: string | null
          creates_incident?: boolean
          fails_on?: Json | null
          help_text?: string | null
          id?: string
          metadata?: Json
          options?: Json | null
          position: number
          prompt: string
          required?: boolean
          response_type: string
          template_version_id: string
        }
        Update: {
          company_id?: string | null
          creates_incident?: boolean
          fails_on?: Json | null
          help_text?: string | null
          id?: string
          metadata?: Json
          options?: Json | null
          position?: number
          prompt?: string
          required?: boolean
          response_type?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "checklist_questions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          answer: Json | null
          answered_at: string
          answered_by: string | null
          checklist_template_version_id: string
          company_id: string | null
          id: string
          is_fail: boolean
          maintenance_item_id: string
          observations: string | null
          question_id: string
        }
        Insert: {
          answer?: Json | null
          answered_at?: string
          answered_by?: string | null
          checklist_template_version_id: string
          company_id?: string | null
          id?: string
          is_fail?: boolean
          maintenance_item_id: string
          observations?: string | null
          question_id: string
        }
        Update: {
          answer?: Json | null
          answered_at?: string
          answered_by?: string | null
          checklist_template_version_id?: string
          company_id?: string | null
          id?: string
          is_fail?: boolean
          maintenance_item_id?: string
          observations?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_checklist_template_version_id_fkey"
            columns: ["checklist_template_version_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_checklist_template_version_id_question_fkey"
            columns: ["checklist_template_version_id", "question_id"]
            isOneToOne: false
            referencedRelation: "checklist_questions"
            referencedColumns: ["template_version_id", "id"]
          },
          {
            foreignKeyName: "checklist_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "checklist_responses_maintenance_item_id_fkey"
            columns: ["maintenance_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_versions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_published: boolean
          notes: string | null
          published_at: string | null
          published_by: string | null
          template_id: string
          version: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          template_id: string
          version: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "checklist_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          active: boolean
          asset_family_id: string | null
          asset_type_id: string | null
          asset_type_ids: string[]
          code: string
          company_id: string
          created_at: string
          current_version: number
          deleted_at: string | null
          description: string | null
          id: string
          include_sublocations: boolean
          location_ids: string[]
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_family_id?: string | null
          asset_type_id?: string | null
          asset_type_ids?: string[]
          code: string
          company_id: string
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          include_sublocations?: boolean
          location_ids?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_family_id?: string | null
          asset_type_id?: string | null
          asset_type_ids?: string[]
          code?: string
          company_id?: string
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          include_sublocations?: boolean
          location_ids?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_asset_family_id_fkey"
            columns: ["asset_family_id"]
            isOneToOne: false
            referencedRelation: "asset_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
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
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
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
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
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
          {
            foreignKeyName: "counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_id: string | null
          category: string
          certificate_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_on: string | null
          file_hash_sha256: string | null
          file_size_bytes: number | null
          id: string
          incident_id: string | null
          is_signed: boolean
          issued_on: string | null
          location_id: string | null
          maintenance_item_id: string | null
          maintenance_session_id: string | null
          metadata: Json
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          vehicle_asset_id: string | null
        }
        Insert: {
          asset_id?: string | null
          category: string
          certificate_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_on?: string | null
          file_hash_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          incident_id?: string | null
          is_signed?: boolean
          issued_on?: string | null
          location_id?: string | null
          maintenance_item_id?: string | null
          maintenance_session_id?: string | null
          metadata?: Json
          mime_type?: string | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_asset_id?: string | null
        }
        Update: {
          asset_id?: string | null
          category?: string
          certificate_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_on?: string | null
          file_hash_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          incident_id?: string | null
          is_signed?: boolean
          issued_on?: string | null
          location_id?: string | null
          maintenance_item_id?: string | null
          maintenance_session_id?: string | null
          metadata?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          vehicle_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "documents_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "maintenance_item_open_incidents"
            referencedColumns: ["incident_id"]
          },
          {
            foreignKeyName: "documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_maintenance_item_id_fkey"
            columns: ["maintenance_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_maintenance_session_id_fkey"
            columns: ["maintenance_session_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_asset_id_fkey"
            columns: ["vehicle_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      first_aid_kit_contents: {
        Row: {
          batch_code: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "first_aid_kit_contents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "first_aid_kit_contents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "first_aid_kit_contents_kit_asset_id_fkey"
            columns: ["kit_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          duplicate_rows: number
          error_rows: number
          file_name: string | null
          file_storage_path: string | null
          finished_at: string | null
          id: string
          mapping: Json
          ok_rows: number
          options: Json
          source_type: string
          started_at: string | null
          status: string
          target_entity: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          file_name?: string | null
          file_storage_path?: string | null
          finished_at?: string | null
          id?: string
          mapping?: Json
          ok_rows?: number
          options?: Json
          source_type: string
          started_at?: string | null
          status?: string
          target_entity: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          file_name?: string | null
          file_storage_path?: string | null
          finished_at?: string | null
          id?: string
          mapping?: Json
          ok_rows?: number
          options?: Json
          source_type?: string
          started_at?: string | null
          status?: string
          target_entity?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      import_errors: {
        Row: {
          batch_id: string
          created_at: string
          details: Json | null
          error_code: string
          field: string | null
          id: string
          message: string
          row_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          details?: Json | null
          error_code: string
          field?: string | null
          id?: string
          message: string
          row_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          details?: Json | null
          error_code?: string
          field?: string | null
          id?: string
          message?: string
          row_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_errors_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          created_entity_id: string | null
          dedupe_key: string | null
          duplicate_of: string | null
          id: string
          normalized: Json | null
          raw: Json
          row_number: number
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_entity_id?: string | null
          dedupe_key?: string | null
          duplicate_of?: string | null
          id?: string
          normalized?: Json | null
          raw: Json
          row_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_entity_id?: string | null
          dedupe_key?: string | null
          duplicate_of?: string | null
          id?: string
          normalized?: Json | null
          raw?: Json
          row_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string | null
          from_status: string | null
          id: string
          incident_id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          from_status?: string | null
          id?: string
          incident_id: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          from_status?: string | null
          id?: string
          incident_id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "incident_status_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_status_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "maintenance_item_open_incidents"
            referencedColumns: ["incident_id"]
          },
        ]
      }
      incidents: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          closed_at: string | null
          code: string
          company_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          location_id: string | null
          metadata: Json
          reporter_email: string | null
          reporter_name: string | null
          reporter_user_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          source: string
          source_maintenance_item_id: string | null
          source_response_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          source_maintenance_item_id?: string | null
          source_response_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          source_maintenance_item_id?: string | null
          source_response_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "incidents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_source_maintenance_item_id_fkey"
            columns: ["source_maintenance_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "checklist_responses"
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
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
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
      maintenance_items: {
        Row: {
          asset_id: string
          checklist_template_version_id: string
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          metadata: Json
          observations: string | null
          result: string
          session_id: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          checklist_template_version_id: string
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          observations?: string | null
          result?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          checklist_template_version_id?: string
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          observations?: string | null
          result?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_checklist_template_version_id_fkey"
            columns: ["checklist_template_version_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plan_assets: {
        Row: {
          asset_id: string
          company_id: string | null
          created_at: string
          end_on: string | null
          id: string
          plan_id: string
          start_on: string
        }
        Insert: {
          asset_id: string
          company_id?: string | null
          created_at?: string
          end_on?: string | null
          id?: string
          plan_id: string
          start_on?: string
        }
        Update: {
          asset_id?: string
          company_id?: string | null
          created_at?: string
          end_on?: string | null
          id?: string
          plan_id?: string
          start_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plan_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_plan_assets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plan_type_templates: {
        Row: {
          asset_type_id: string
          checklist_template_id: string
          company_id: string | null
          created_at: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          asset_type_id: string
          checklist_template_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          asset_type_id?: string
          checklist_template_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plan_type_templates_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_type_templates_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_type_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_type_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_plan_type_templates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          active: boolean
          asset_family_id: string | null
          asset_type_id: string | null
          certificate_template_id: string | null
          checklist_template_id: string
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          frequency: string
          id: string
          interval_months: number | null
          name: string
          notes: string | null
          scope_include_sublocations: boolean
          scope_location_ids: string[]
          scope_mode: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_family_id?: string | null
          asset_type_id?: string | null
          certificate_template_id?: string | null
          checklist_template_id: string
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          frequency: string
          id?: string
          interval_months?: number | null
          name: string
          notes?: string | null
          scope_include_sublocations?: boolean
          scope_location_ids?: string[]
          scope_mode?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_family_id?: string | null
          asset_type_id?: string | null
          certificate_template_id?: string | null
          checklist_template_id?: string
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          interval_months?: number | null
          name?: string
          notes?: string | null
          scope_include_sublocations?: boolean
          scope_location_ids?: string[]
          scope_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_family_id_fkey"
            columns: ["asset_family_id"]
            isOneToOne: false
            referencedRelation: "asset_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_certificate_template_id_fkey"
            columns: ["certificate_template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      maintenance_sessions: {
        Row: {
          closed_at: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          external_cert_number: string | null
          external_provider: string | null
          id: string
          is_external: boolean
          location_id: string | null
          metadata: Json
          notes: string | null
          outcome: string | null
          pdf_hash_sha256: string | null
          pdf_url: string | null
          plan_id: string | null
          reopen_reason: string | null
          scheduled_for: string | null
          signature_image_url: string | null
          signer_ip: unknown
          signer_name: string | null
          signer_role: string | null
          signer_user_agent: string | null
          started_at: string | null
          status: string
          technician_id: string | null
          technician_name: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          external_cert_number?: string | null
          external_provider?: string | null
          id?: string
          is_external?: boolean
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          outcome?: string | null
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          plan_id?: string | null
          reopen_reason?: string | null
          scheduled_for?: string | null
          signature_image_url?: string | null
          signer_ip?: unknown
          signer_name?: string | null
          signer_role?: string | null
          signer_user_agent?: string | null
          started_at?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          external_cert_number?: string | null
          external_provider?: string | null
          id?: string
          is_external?: boolean
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          outcome?: string | null
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          plan_id?: string | null
          reopen_reason?: string | null
          scheduled_for?: string | null
          signature_image_url?: string | null
          signer_ip?: unknown
          signer_name?: string | null
          signer_role?: string | null
          signer_user_agent?: string | null
          started_at?: string | null
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mnt_checklist_template_sites: {
        Row: {
          created_at: string
          location_id: string
          org_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          org_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          org_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_checklist_template_sites_location_org_fk"
            columns: ["org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_sites_template_org_fk"
            columns: ["org_id", "template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_checklist_template_types: {
        Row: {
          asset_type_id: string
          created_at: string
          org_id: string
          template_id: string
        }
        Insert: {
          asset_type_id: string
          created_at?: string
          org_id: string
          template_id: string
        }
        Update: {
          asset_type_id?: string
          created_at?: string
          org_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_checklist_template_types_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_checklist_template_types_template_org_fk"
            columns: ["org_id", "template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_migration_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          postflight: Json | null
          preflight: Json | null
          rows_affected: Json | null
          started_at: string
          status: string
          step: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          postflight?: Json | null
          preflight?: Json | null
          rows_affected?: Json | null
          started_at?: string
          status: string
          step: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          postflight?: Json | null
          preflight?: Json | null
          rows_affected?: Json | null
          started_at?: string
          status?: string
          step?: string
        }
        Relationships: []
      }
      mnt_mtr_control_plans: {
        Row: {
          acceptance_criteria: string | null
          active: boolean
          company_id: string
          control_kind: string
          created_at: string
          equipment_id: string
          frequency_unit: string
          frequency_value: number | null
          id: string
          method: string
          next_due_on: string | null
          procedure: string | null
          qualifies_as_reference: boolean
          requires_document: boolean
          responsible_ref: string | null
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          active?: boolean
          company_id: string
          control_kind: string
          created_at?: string
          equipment_id: string
          frequency_unit: string
          frequency_value?: number | null
          id?: string
          method: string
          next_due_on?: string | null
          procedure?: string | null
          qualifies_as_reference?: boolean
          requires_document?: boolean
          responsible_ref?: string | null
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          active?: boolean
          company_id?: string
          control_kind?: string
          created_at?: string
          equipment_id?: string
          frequency_unit?: string
          frequency_value?: number | null
          id?: string
          method?: string
          next_due_on?: string | null
          procedure?: string | null
          qualifies_as_reference?: boolean
          requires_document?: boolean
          responsible_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_control_plans_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_control_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_control_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mnt_mtr_equipment: {
        Row: {
          allowed_uses: string | null
          brand: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          declared_accuracy: string | null
          deleted_at: string | null
          equipment_type: string
          id: string
          intended_use: string | null
          location_detail: string | null
          magnitude: string | null
          model: string | null
          name: string
          photo_document_ref: string | null
          range_max: number | null
          range_min: number | null
          registered_on: string
          resolution: string | null
          responsible_ref: string | null
          responsible_snapshot: Json | null
          restrictions: string | null
          serial_number: string | null
          site_id: string
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          allowed_uses?: string | null
          brand?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          declared_accuracy?: string | null
          deleted_at?: string | null
          equipment_type: string
          id?: string
          intended_use?: string | null
          location_detail?: string | null
          magnitude?: string | null
          model?: string | null
          name: string
          photo_document_ref?: string | null
          range_max?: number | null
          range_min?: number | null
          registered_on?: string
          resolution?: string | null
          responsible_ref?: string | null
          responsible_snapshot?: Json | null
          restrictions?: string | null
          serial_number?: string | null
          site_id: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          allowed_uses?: string | null
          brand?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          declared_accuracy?: string | null
          deleted_at?: string | null
          equipment_type?: string
          id?: string
          intended_use?: string | null
          location_detail?: string | null
          magnitude?: string | null
          model?: string | null
          name?: string
          photo_document_ref?: string | null
          range_max?: number | null
          range_min?: number | null
          registered_on?: string
          resolution?: string | null
          responsible_ref?: string | null
          responsible_snapshot?: Json | null
          restrictions?: string | null
          serial_number?: string | null
          site_id?: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_mtr_equipment_company_id_site_id_fkey"
            columns: ["company_id", "site_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_mtr_impact_reviews: {
        Row: {
          actions_taken_or_planned: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_snapshot: Json | null
          company_id: string
          conclusion: string | null
          created_at: string
          equipment_id: string
          external_ref_id: string | null
          external_ref_label: string | null
          external_ref_type: string | null
          external_ref_url: string | null
          id: string
          justification: string | null
          period_reviewed: string | null
          record_id: string
          responsible_ref: string | null
          reviewed_on: string | null
          status: string
        }
        Insert: {
          actions_taken_or_planned?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_snapshot?: Json | null
          company_id: string
          conclusion?: string | null
          created_at?: string
          equipment_id: string
          external_ref_id?: string | null
          external_ref_label?: string | null
          external_ref_type?: string | null
          external_ref_url?: string | null
          id?: string
          justification?: string | null
          period_reviewed?: string | null
          record_id: string
          responsible_ref?: string | null
          reviewed_on?: string | null
          status?: string
        }
        Update: {
          actions_taken_or_planned?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_snapshot?: Json | null
          company_id?: string
          conclusion?: string | null
          created_at?: string
          equipment_id?: string
          external_ref_id?: string | null
          external_ref_label?: string | null
          external_ref_type?: string | null
          external_ref_url?: string | null
          id?: string
          justification?: string | null
          period_reviewed?: string | null
          record_id?: string
          responsible_ref?: string | null
          reviewed_on?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_impact_reviews_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_impact_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_impact_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_mtr_impact_reviews_company_id_record_id_fkey"
            columns: ["company_id", "record_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_records"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_mtr_record_lines: {
        Row: {
          company_id: string
          created_at: string
          deviation: number | null
          id: string
          label: string
          measured_value: number | null
          position: number
          record_id: string
          reference_value: number | null
          result: string | null
          tolerance: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deviation?: number | null
          id?: string
          label: string
          measured_value?: number | null
          position: number
          record_id: string
          reference_value?: number | null
          result?: string | null
          tolerance?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deviation?: number | null
          id?: string
          label?: string
          measured_value?: number | null
          position?: number
          record_id?: string
          reference_value?: number | null
          result?: string | null
          tolerance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_record_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_record_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_mtr_record_lines_company_id_record_id_fkey"
            columns: ["company_id", "record_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_records"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_mtr_records: {
        Row: {
          accreditation: string | null
          adjusted_or_repaired: boolean | null
          certificate_number: string | null
          company_id: string
          control_plan_id: string
          created_at: string
          created_by: string | null
          declared_uncertainty: string | null
          document_ref: string | null
          equipment_id: string
          id: string
          kind: string
          laboratory: string | null
          next_due_calculated: string | null
          next_due_override: string | null
          observations: string | null
          override_reason: string | null
          performed_on: string
          performer_ref: string | null
          performer_snapshot: Json | null
          rectification_reason: string | null
          reference_equipment_id: string | null
          result: string | null
          status: string
          supersedes_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_snapshot: Json | null
          version: number
        }
        Insert: {
          accreditation?: string | null
          adjusted_or_repaired?: boolean | null
          certificate_number?: string | null
          company_id: string
          control_plan_id: string
          created_at?: string
          created_by?: string | null
          declared_uncertainty?: string | null
          document_ref?: string | null
          equipment_id: string
          id?: string
          kind: string
          laboratory?: string | null
          next_due_calculated?: string | null
          next_due_override?: string | null
          observations?: string | null
          override_reason?: string | null
          performed_on: string
          performer_ref?: string | null
          performer_snapshot?: Json | null
          rectification_reason?: string | null
          reference_equipment_id?: string | null
          result?: string | null
          status?: string
          supersedes_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_snapshot?: Json | null
          version?: number
        }
        Update: {
          accreditation?: string | null
          adjusted_or_repaired?: boolean | null
          certificate_number?: string | null
          company_id?: string
          control_plan_id?: string
          created_at?: string
          created_by?: string | null
          declared_uncertainty?: string | null
          document_ref?: string | null
          equipment_id?: string
          id?: string
          kind?: string
          laboratory?: string | null
          next_due_calculated?: string | null
          next_due_override?: string | null
          observations?: string | null
          override_reason?: string | null
          performed_on?: string
          performer_ref?: string | null
          performer_snapshot?: Json | null
          rectification_reason?: string | null
          reference_equipment_id?: string | null
          result?: string | null
          status?: string
          supersedes_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_snapshot?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_records_company_id_control_plan_id_fkey"
            columns: ["company_id", "control_plan_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_control_plans"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_records_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_mtr_records_company_id_reference_equipment_id_fkey"
            columns: ["company_id", "reference_equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_records_company_id_supersedes_id_fkey"
            columns: ["company_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_records"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_mtr_site_moves: {
        Row: {
          company_id: string
          equipment_id: string
          from_site_id: string | null
          id: string
          location_detail: string | null
          moved_at: string
          moved_by: string | null
          moved_by_snapshot: Json | null
          note: string | null
          to_site_id: string
        }
        Insert: {
          company_id: string
          equipment_id: string
          from_site_id?: string | null
          id?: string
          location_detail?: string | null
          moved_at?: string
          moved_by?: string | null
          moved_by_snapshot?: Json | null
          note?: string | null
          to_site_id: string
        }
        Update: {
          company_id?: string
          equipment_id?: string
          from_site_id?: string | null
          id?: string
          location_detail?: string | null
          moved_at?: string
          moved_by?: string | null
          moved_by_snapshot?: Json | null
          note?: string | null
          to_site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_site_moves_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_site_moves_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_site_moves_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mnt_mtr_status_history: {
        Row: {
          cause: string
          changed_at: string
          changed_by: string | null
          changed_by_snapshot: Json | null
          company_id: string
          equipment_id: string
          from_status: string | null
          id: string
          note: string | null
          record_id: string | null
          to_status: string
        }
        Insert: {
          cause: string
          changed_at?: string
          changed_by?: string | null
          changed_by_snapshot?: Json | null
          company_id: string
          equipment_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          record_id?: string | null
          to_status: string
        }
        Update: {
          cause?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_snapshot?: Json | null
          company_id?: string
          equipment_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          record_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_status_history_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mnt_mtr_unfit_decisions: {
        Row: {
          allowed_uses: string | null
          company_id: string
          decided_at: string
          decided_by: string | null
          decided_by_snapshot: Json | null
          decision: string
          equipment_id: string
          id: string
          notes: string | null
          record_id: string
        }
        Insert: {
          allowed_uses?: string | null
          company_id: string
          decided_at?: string
          decided_by?: string | null
          decided_by_snapshot?: Json | null
          decision: string
          equipment_id: string
          id?: string
          notes?: string | null
          record_id: string
        }
        Update: {
          allowed_uses?: string | null
          company_id?: string
          decided_at?: string
          decided_by?: string | null
          decided_by_snapshot?: Json | null
          decision?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_mtr_unfit_decisions_company_id_equipment_id_fkey"
            columns: ["company_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_equipment"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_mtr_unfit_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_mtr_unfit_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_mtr_unfit_decisions_company_id_record_id_fkey"
            columns: ["company_id", "record_id"]
            isOneToOne: false
            referencedRelation: "mnt_mtr_records"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      mnt_org_asset_types: {
        Row: {
          asset_type_id: string
          created_at: string
          enabled: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          asset_type_id: string
          created_at?: string
          enabled?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          asset_type_id?: string
          created_at?: string
          enabled?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_org_asset_types_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_org_asset_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_org_asset_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mnt_outbox: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          event_id: string
          event_type: string
          last_error: string | null
          occurred_at: string
          org_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          event_id?: string
          event_type: string
          last_error?: string | null
          occurred_at?: string
          org_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          event_id?: string
          event_type?: string
          last_error?: string | null
          occurred_at?: string
          org_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mnt_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mnt_plan_sites: {
        Row: {
          created_at: string
          location_id: string
          org_id: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          org_id: string
          plan_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          org_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnt_plan_sites_location_org_fk"
            columns: ["org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "mnt_plan_sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnt_plan_sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mnt_plan_sites_plan_org_fk"
            columns: ["org_id", "plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          event_id: string
          id: string
          last_error: string | null
          metadata: Json
          opened_at: string | null
          provider_message_id: string | null
          recipient_address: string
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          event_id: string
          id?: string
          last_error?: string | null
          metadata?: Json
          opened_at?: string | null
          provider_message_id?: string | null
          recipient_address: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          opened_at?: string | null
          provider_message_id?: string | null
          recipient_address?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          asset_id: string | null
          body: string | null
          certificate_id: string | null
          company_id: string
          created_at: string
          document_id: string | null
          event_type: string
          id: string
          incident_id: string | null
          maintenance_session_id: string | null
          payload: Json
          processed_at: string | null
          scheduled_for: string
          severity: string
          status: string
          subject: string
        }
        Insert: {
          asset_id?: string | null
          body?: string | null
          certificate_id?: string | null
          company_id: string
          created_at?: string
          document_id?: string | null
          event_type: string
          id?: string
          incident_id?: string | null
          maintenance_session_id?: string | null
          payload?: Json
          processed_at?: string | null
          scheduled_for?: string
          severity?: string
          status?: string
          subject: string
        }
        Update: {
          asset_id?: string | null
          body?: string | null
          certificate_id?: string | null
          company_id?: string
          created_at?: string
          document_id?: string | null
          event_type?: string
          id?: string
          incident_id?: string | null
          maintenance_session_id?: string | null
          payload?: Json
          processed_at?: string | null
          scheduled_for?: string
          severity?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notification_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "maintenance_item_open_incidents"
            referencedColumns: ["incident_id"]
          },
          {
            foreignKeyName: "notification_events_maintenance_session_id_fkey"
            columns: ["maintenance_session_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          event_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
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
      session_reopen_log: {
        Row: {
          company_id: string | null
          id: string
          reason: string
          reopened_at: string
          reopened_by: string | null
          session_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          reason: string
          reopened_at?: string
          reopened_by?: string | null
          session_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          reason?: string
          reopened_at?: string
          reopened_by?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reopen_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reopen_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "session_reopen_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "maintenance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_mounts: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "vehicle_mounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
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
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Views: {
      asset_next_maintenances: {
        Row: {
          asset_id: string | null
          company_id: string | null
          frequency: string | null
          interval_months: number | null
          last_done_at: string | null
          next_due_at: string | null
          plan_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plan_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plan_assets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_kpis: {
        Row: {
          assets_active: number | null
          assets_total: number | null
          company_id: string | null
          company_name: string | null
          incidents_open: number | null
          sessions_open: number | null
          vehicles_total: number | null
        }
        Insert: {
          assets_active?: never
          assets_total?: never
          company_id?: string | null
          company_name?: string | null
          incidents_open?: never
          sessions_open?: never
          vehicles_total?: never
        }
        Update: {
          assets_active?: never
          assets_total?: never
          company_id?: string | null
          company_name?: string | null
          incidents_open?: never
          sessions_open?: never
          vehicles_total?: never
        }
        Relationships: []
      }
      maintenance_item_open_incidents: {
        Row: {
          asset_id: string | null
          code: string | null
          company_id: string | null
          created_at: string | null
          incident_id: string | null
          severity: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          asset_id?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          incident_id?: string | null
          severity?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          asset_id?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          incident_id?: string | null
          severity?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Functions: {
      accept_company_invitation: { Args: { p_token: string }; Returns: string }
      audit_logs_ensure_partitions: {
        Args: { p_months_ahead?: number }
        Returns: number
      }
      audit_logs_purge_old: { Args: never; Returns: number }
      can_close_session: { Args: { p_company_id: string }; Returns: boolean }
      can_manage_assets: { Args: { p_company_id: string }; Returns: boolean }
      can_manage_company: { Args: { p_company_id: string }; Returns: boolean }
      can_reopen_session: { Args: { p_company_id: string }; Returns: boolean }
      can_run_maintenance: { Args: { p_company_id: string }; Returns: boolean }
      can_view: { Args: { p_company_id: string }; Returns: boolean }
      create_company_with_owner: {
        Args: { p_address?: string; p_cif: string; p_name: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_company_id: { Args: never; Returns: string }
      generate_expiry_notifications: { Args: never; Returns: number }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          company_id: string
          company_name: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role_in: {
        Args: {
          p_company_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      invite_company_member: {
        Args: {
          p_company_id: string
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mtr_calc_next_due: {
        Args: { p_from: string; p_unit: string; p_value: number }
        Returns: string
      }
      mtr_close_impact: {
        Args: {
          p_actions: string
          p_conclusion: string
          p_ext_id: string
          p_ext_label: string
          p_ext_type: string
          p_ext_url: string
          p_justification: string
          p_period: string
          p_review: string
          p_reviewed_on: string
        }
        Returns: undefined
      }
      mtr_decide_unfit: {
        Args: {
          p_allowed_uses: string
          p_decision: string
          p_notes: string
          p_record: string
        }
        Returns: string
      }
      mtr_is_client: { Args: never; Returns: boolean }
      mtr_log_status: {
        Args: {
          p_cause: string
          p_company: string
          p_eq: string
          p_from: string
          p_note: string
          p_record: string
          p_to: string
        }
        Returns: undefined
      }
      mtr_move_site: {
        Args: {
          p_equipment: string
          p_location_detail: string
          p_note: string
          p_site: string
        }
        Returns: undefined
      }
      mtr_rectify_record: {
        Args: { p_reason: string; p_record: string }
        Returns: string
      }
      mtr_reference_eligible: {
        Args: { p_company: string; p_equipment: string; p_on: string }
        Returns: boolean
      }
      mtr_set_status: {
        Args: { p_equipment: string; p_reason: string; p_status: string }
        Returns: undefined
      }
      mtr_site_in_org: {
        Args: { p_company: string; p_site: string }
        Returns: boolean
      }
      mtr_snapshot: { Args: never; Returns: Json }
      mtr_validate_record: { Args: { p_record: string }; Returns: Json }
      next_code: {
        Args: { p_company_id: string; p_prefix: string; p_scope: string }
        Returns: string
      }
      set_company_counter: {
        Args: {
          p_company_id: string
          p_scope: string
          p_value: number
          p_year: number
        }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
