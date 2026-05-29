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
      certificate_items: {
        Row: {
          asset_id: string | null
          certificate_id: string
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
        ]
      }
      checklist_questions: {
        Row: {
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
          asset_type_id: string
          code: string
          company_id: string
          created_at: string
          current_version: number
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_type_id: string
          code: string
          company_id: string
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_type_id?: string
          code?: string
          company_id?: string
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
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
          from_status: string | null
          id: string
          incident_id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          incident_id: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          incident_id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
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
          created_at: string
          end_on: string | null
          id: string
          plan_id: string
          start_on: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          end_on?: string | null
          id?: string
          plan_id: string
          start_on?: string
        }
        Update: {
          asset_id?: string
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
            foreignKeyName: "maintenance_plan_assets_plan_id_fkey"
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
          asset_type_id: string | null
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
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_type_id?: string | null
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
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_type_id?: string | null
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
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
          pdf_hash_sha256: string | null
          pdf_url: string | null
          plan_id: string | null
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
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          plan_id?: string | null
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
          pdf_hash_sha256?: string | null
          pdf_url?: string | null
          plan_id?: string | null
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
          id: string
          reason: string
          reopened_at: string
          reopened_by: string | null
          session_id: string
        }
        Insert: {
          id?: string
          reason: string
          reopened_at?: string
          reopened_by?: string | null
          session_id: string
        }
        Update: {
          id?: string
          reason?: string
          reopened_at?: string
          reopened_by?: string | null
          session_id?: string
        }
        Relationships: [
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
        ]
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
        ]
      }
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
