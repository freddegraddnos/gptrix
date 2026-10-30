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
      agent_bookings: {
        Row: {
          created_at: string
          customer_email: string
          customer_lang: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number
          id: string
          idea: string | null
          motif_url: string | null
          placement: string | null
          quoted_price_ore: number | null
          reminder_sent_at: string | null
          size_cm: number | null
          slot_id: string | null
          starts_at: string
          status: string
          studio_id: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_lang?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes: number
          id?: string
          idea?: string | null
          motif_url?: string | null
          placement?: string | null
          quoted_price_ore?: number | null
          reminder_sent_at?: string | null
          size_cm?: number | null
          slot_id?: string | null
          starts_at: string
          status?: string
          studio_id: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_lang?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          idea?: string | null
          motif_url?: string | null
          placement?: string | null
          quoted_price_ore?: number | null
          reminder_sent_at?: string | null
          size_cm?: number | null
          slot_id?: string | null
          starts_at?: string
          status?: string
          studio_id?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_bookings_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "agent_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_threads: {
        Row: {
          created_at: string
          id: string
          messages: Json
          session_key: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          session_key: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          session_key?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          anon_id: string | null
          created_at: string
          event: string
          id: string
          meta: Json
          path: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          event: string
          id?: string
          meta?: Json
          path?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          event?: string
          id?: string
          meta?: Json
          path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      artist_client_projects: {
        Row: {
          acquisition_source: string
          after_url: string | null
          age_verification_status: string
          artist_id: string
          assigned_artist_id: string | null
          base_photo_url: string | null
          before_url: string | null
          booking_link_sending_at: string | null
          booking_link_sent_at: string | null
          booking_link_session_count: number | null
          booking_link_session_minutes: number | null
          booking_link_session_plan: number[] | null
          client_email: string | null
          client_handle: string | null
          client_name: string | null
          client_phone: string | null
          client_user_id: string | null
          color_mode: string | null
          conversation_title: string | null
          created_at: string
          description: string | null
          design: Json
          final_sketch_version_id: string | null
          id: string
          invite_token: string
          latest_activity_at: string
          more_times_notified_at: string | null
          more_times_request_note: string | null
          more_times_requested_at: string | null
          motif_url: string | null
          notes: string | null
          placement: string | null
          placement_unsure: boolean
          preview_token: string
          publish_approved: boolean
          quote_amount_ore: number | null
          quote_message: string | null
          quote_status: string
          reference_urls: string[]
          request_group_id: string | null
          scan_id: string | null
          sent_to_multiple: boolean
          session_count: number
          session_minutes: number
          session_plan: number[] | null
          size_cm: number | null
          size_dimension: string | null
          size_source: string | null
          size_unsure: boolean
          sketch_reminder_sent_at: string | null
          sketch_share_enabled: boolean
          sketch_share_token: string | null
          source_project_id: string | null
          status: string
          studio_read_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acquisition_source?: string
          after_url?: string | null
          age_verification_status?: string
          artist_id: string
          assigned_artist_id?: string | null
          base_photo_url?: string | null
          before_url?: string | null
          booking_link_sending_at?: string | null
          booking_link_sent_at?: string | null
          booking_link_session_count?: number | null
          booking_link_session_minutes?: number | null
          booking_link_session_plan?: number[] | null
          client_email?: string | null
          client_handle?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_user_id?: string | null
          color_mode?: string | null
          conversation_title?: string | null
          created_at?: string
          description?: string | null
          design?: Json
          final_sketch_version_id?: string | null
          id?: string
          invite_token?: string
          latest_activity_at?: string
          more_times_notified_at?: string | null
          more_times_request_note?: string | null
          more_times_requested_at?: string | null
          motif_url?: string | null
          notes?: string | null
          placement?: string | null
          placement_unsure?: boolean
          preview_token?: string
          publish_approved?: boolean
          quote_amount_ore?: number | null
          quote_message?: string | null
          quote_status?: string
          reference_urls?: string[]
          request_group_id?: string | null
          scan_id?: string | null
          sent_to_multiple?: boolean
          session_count?: number
          session_minutes?: number
          session_plan?: number[] | null
          size_cm?: number | null
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          sketch_reminder_sent_at?: string | null
          sketch_share_enabled?: boolean
          sketch_share_token?: string | null
          source_project_id?: string | null
          status?: string
          studio_read_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acquisition_source?: string
          after_url?: string | null
          age_verification_status?: string
          artist_id?: string
          assigned_artist_id?: string | null
          base_photo_url?: string | null
          before_url?: string | null
          booking_link_sending_at?: string | null
          booking_link_sent_at?: string | null
          booking_link_session_count?: number | null
          booking_link_session_minutes?: number | null
          booking_link_session_plan?: number[] | null
          client_email?: string | null
          client_handle?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_user_id?: string | null
          color_mode?: string | null
          conversation_title?: string | null
          created_at?: string
          description?: string | null
          design?: Json
          final_sketch_version_id?: string | null
          id?: string
          invite_token?: string
          latest_activity_at?: string
          more_times_notified_at?: string | null
          more_times_request_note?: string | null
          more_times_requested_at?: string | null
          motif_url?: string | null
          notes?: string | null
          placement?: string | null
          placement_unsure?: boolean
          preview_token?: string
          publish_approved?: boolean
          quote_amount_ore?: number | null
          quote_message?: string | null
          quote_status?: string
          reference_urls?: string[]
          request_group_id?: string | null
          scan_id?: string | null
          sent_to_multiple?: boolean
          session_count?: number
          session_minutes?: number
          session_plan?: number[] | null
          size_cm?: number | null
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          sketch_reminder_sent_at?: string | null
          sketch_share_enabled?: boolean
          sketch_share_token?: string | null
          source_project_id?: string | null
          status?: string
          studio_read_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_client_projects_assigned_artist_id_fkey"
            columns: ["assigned_artist_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_client_projects_final_sketch_version_fkey"
            columns: ["final_sketch_version_id"]
            isOneToOne: false
            referencedRelation: "artist_project_sketch_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_client_projects_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "body_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_client_projects_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_email_otps: {
        Row: {
          artist_user_id: string
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          artist_user_id: string
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          artist_user_id?: string
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      artist_profiles: {
        Row: {
          accepts_messages: boolean
          address: string | null
          approval_note: string | null
          approval_requested_at: string | null
          approval_status: string
          approval_token: string | null
          approval_token_used_at: string | null
          approved_at: string | null
          avatar_url: string | null
          bio: string | null
          booking_greeting: string | null
          booking_questions: Json
          city: string | null
          contact_email: string
          created_at: string
          document_path: string | null
          document_submitted_at: string | null
          email_verified_at: string | null
          handle: string | null
          headline: string | null
          id: string
          instagram: string | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          must_change_password: boolean
          notify_email: string | null
          notify_email_enabled: boolean
          notify_phone: string | null
          notify_sms_enabled: boolean
          notify_test_email_at: string | null
          notify_test_sms_at: string | null
          onboarding_details_saved_at: string | null
          onboarding_step: number
          opening_hours: string | null
          phone: string | null
          price_level: number | null
          rating: number | null
          require_deposit_for_confirmation: boolean
          review_count: number
          social_url: string | null
          status: string
          studio_name: string
          styles: string[]
          theme: Json
          theme_draft: Json | null
          theme_draft_updated_at: string | null
          updated_at: string
          user_id: string
          verification_note: string | null
          verification_status: string
          verified: boolean
          verified_at: string | null
          website: string | null
        }
        Insert: {
          accepts_messages?: boolean
          address?: string | null
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approval_token?: string | null
          approval_token_used_at?: string | null
          approved_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          booking_greeting?: string | null
          booking_questions?: Json
          city?: string | null
          contact_email: string
          created_at?: string
          document_path?: string | null
          document_submitted_at?: string | null
          email_verified_at?: string | null
          handle?: string | null
          headline?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          must_change_password?: boolean
          notify_email?: string | null
          notify_email_enabled?: boolean
          notify_phone?: string | null
          notify_sms_enabled?: boolean
          notify_test_email_at?: string | null
          notify_test_sms_at?: string | null
          onboarding_details_saved_at?: string | null
          onboarding_step?: number
          opening_hours?: string | null
          phone?: string | null
          price_level?: number | null
          rating?: number | null
          require_deposit_for_confirmation?: boolean
          review_count?: number
          social_url?: string | null
          status?: string
          studio_name: string
          styles?: string[]
          theme?: Json
          theme_draft?: Json | null
          theme_draft_updated_at?: string | null
          updated_at?: string
          user_id: string
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          accepts_messages?: boolean
          address?: string | null
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approval_token?: string | null
          approval_token_used_at?: string | null
          approved_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          booking_greeting?: string | null
          booking_questions?: Json
          city?: string | null
          contact_email?: string
          created_at?: string
          document_path?: string | null
          document_submitted_at?: string | null
          email_verified_at?: string | null
          handle?: string | null
          headline?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          must_change_password?: boolean
          notify_email?: string | null
          notify_email_enabled?: boolean
          notify_phone?: string | null
          notify_sms_enabled?: boolean
          notify_test_email_at?: string | null
          notify_test_sms_at?: string | null
          onboarding_details_saved_at?: string | null
          onboarding_step?: number
          opening_hours?: string | null
          phone?: string | null
          price_level?: number | null
          rating?: number | null
          require_deposit_for_confirmation?: boolean
          review_count?: number
          social_url?: string | null
          status?: string
          studio_name?: string
          styles?: string[]
          theme?: Json
          theme_draft?: Json | null
          theme_draft_updated_at?: string | null
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      artist_project_age_verifications: {
        Row: {
          birth_year: number | null
          created_at: string
          id: string
          min_age: number
          project_id: string
          reject_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          id?: string
          min_age?: number
          project_id: string
          reject_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          id?: string
          min_age?: number
          project_id?: string
          reject_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_age_verifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_comments: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_messages: {
        Row: {
          ai_checked_at: string | null
          ai_time: Json | null
          attachment_id: string | null
          body: string
          created_at: string
          id: string
          project_id: string
          reminder_sent_at: string | null
          sender_id: string
        }
        Insert: {
          ai_checked_at?: string | null
          ai_time?: Json | null
          attachment_id?: string | null
          body?: string
          created_at?: string
          id?: string
          project_id: string
          reminder_sent_at?: string | null
          sender_id: string
        }
        Update: {
          ai_checked_at?: string | null
          ai_time?: Json | null
          attachment_id?: string | null
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          reminder_sent_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_messages_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "artist_project_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_sketch_annotations: {
        Row: {
          author_id: string
          body: string
          coordinate_kind: string
          created_at: string
          id: string
          pos_x: number
          pos_y: number
          pos_z: number | null
          version_id: string
        }
        Insert: {
          author_id: string
          body: string
          coordinate_kind: string
          created_at?: string
          id?: string
          pos_x: number
          pos_y: number
          pos_z?: number | null
          version_id: string
        }
        Update: {
          author_id?: string
          body?: string
          coordinate_kind?: string
          created_at?: string
          id?: string
          pos_x?: number
          pos_y?: number
          pos_z?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_sketch_annotations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "artist_project_sketch_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_project_sketch_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_comment: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_comment: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_comment?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "artist_project_sketch_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_services: {
        Row: {
          active: boolean
          artist_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          kind: string
          price_ore: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: string
          price_ore?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: string
          price_ore?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      artist_sketches: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          image_path: string
          note: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          image_path: string
          note?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          image_path?: string
          note?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      body_scans: {
        Row: {
          body_part: string | null
          calibrated: boolean
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          model_path: string | null
          provider_task_id: string | null
          scale_confidence: number | null
          scale_factor: number | null
          status: string
          still_path: string | null
          updated_at: string
          user_id: string
          video_path: string
        }
        Insert: {
          body_part?: string | null
          calibrated?: boolean
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          model_path?: string | null
          provider_task_id?: string | null
          scale_confidence?: number | null
          scale_factor?: number | null
          status?: string
          still_path?: string | null
          updated_at?: string
          user_id: string
          video_path: string
        }
        Update: {
          body_part?: string | null
          calibrated?: boolean
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          model_path?: string | null
          provider_task_id?: string | null
          scale_confidence?: number | null
          scale_factor?: number | null
          status?: string
          still_path?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string
        }
        Relationships: []
      }
      booking_files: {
        Row: {
          bucket: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          note: string | null
          path: string
          size_bytes: number | null
          slot_id: string
          updated_at: string
          uploader_id: string
          uploader_role: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          note?: string | null
          path: string
          size_bytes?: number | null
          slot_id: string
          updated_at?: string
          uploader_id: string
          uploader_role?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          note?: string | null
          path?: string
          size_bytes?: number | null
          slot_id?: string
          updated_at?: string
          uploader_id?: string
          uploader_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_files_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "studio_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          artist_id: string | null
          artist_project_id: string | null
          base_photo_url: string | null
          body_area: string | null
          created_at: string
          decline_reason: string | null
          duration_minutes: number | null
          id: string
          intake_answers: Json | null
          note: string | null
          placement_unsure: boolean
          preferred_date: string
          preferred_time: string | null
          project_id: string | null
          reference_urls: string[]
          reminder_sent_at: string | null
          session_number: number
          size_cm: number | null
          size_dimension: string | null
          size_source: string | null
          size_unsure: boolean
          slot_id: string | null
          slot_starts_at: string | null
          status: string
          studio_address: string | null
          studio_lat: number | null
          studio_lng: number | null
          studio_name: string
          studio_place_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          artist_project_id?: string | null
          base_photo_url?: string | null
          body_area?: string | null
          created_at?: string
          decline_reason?: string | null
          duration_minutes?: number | null
          id?: string
          intake_answers?: Json | null
          note?: string | null
          placement_unsure?: boolean
          preferred_date: string
          preferred_time?: string | null
          project_id?: string | null
          reference_urls?: string[]
          reminder_sent_at?: string | null
          session_number?: number
          size_cm?: number | null
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          slot_id?: string | null
          slot_starts_at?: string | null
          status?: string
          studio_address?: string | null
          studio_lat?: number | null
          studio_lng?: number | null
          studio_name: string
          studio_place_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string | null
          artist_project_id?: string | null
          base_photo_url?: string | null
          body_area?: string | null
          created_at?: string
          decline_reason?: string | null
          duration_minutes?: number | null
          id?: string
          intake_answers?: Json | null
          note?: string | null
          placement_unsure?: boolean
          preferred_date?: string
          preferred_time?: string | null
          project_id?: string | null
          reference_urls?: string[]
          reminder_sent_at?: string | null
          session_number?: number
          size_cm?: number | null
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          slot_id?: string | null
          slot_starts_at?: string | null
          status?: string
          studio_address?: string | null
          studio_lat?: number | null
          studio_lng?: number | null
          studio_name?: string
          studio_place_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_artist_project_id_fkey"
            columns: ["artist_project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "studio_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          image_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_id?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: []
      }
      couple_designs: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string
          id: string
          image_data: string
          name: string
          note: string | null
          rotation: number | null
          width_cm: number | null
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by: string
          id?: string
          image_data: string
          name?: string
          note?: string | null
          rotation?: number | null
          width_cm?: number | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string
          id?: string
          image_data?: string
          name?: string
          note?: string | null
          rotation?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_designs_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_members: {
        Row: {
          couple_id: string
          display_name: string | null
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          couple_id: string
          display_name?: string | null
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          couple_id?: string
          display_name?: string | null
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_members_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_messages: {
        Row: {
          ai_checked_at: string | null
          ai_time: Json | null
          attachment_url: string | null
          body: string | null
          created_at: string
          direction: string
          id: string
          ig_message_id: string | null
          thread_id: string
        }
        Insert: {
          ai_checked_at?: string | null
          ai_time?: Json | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          direction: string
          id?: string
          ig_message_id?: string | null
          thread_id: string
        }
        Update: {
          ai_checked_at?: string | null
          ai_time?: Json | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          ig_message_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "instagram_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_threads: {
        Row: {
          created_at: string
          id: string
          ig_thread_id: string
          last_inbound_at: string | null
          last_message_at: string
          participant_avatar: string | null
          participant_id: string
          participant_name: string | null
          participant_username: string | null
          project_id: string | null
          studio_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ig_thread_id: string
          last_inbound_at?: string | null
          last_message_at?: string
          participant_avatar?: string | null
          participant_id: string
          participant_name?: string | null
          participant_username?: string | null
          project_id?: string | null
          studio_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ig_thread_id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          participant_avatar?: string | null
          participant_id?: string
          participant_name?: string | null
          participant_username?: string | null
          project_id?: string | null
          studio_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_motifs: {
        Row: {
          tattoo_availability: string | null
          tattoo_reuse: string | null
          suggested_size_cm: number | null
          tattoo_price_note: string | null
          artist_id: string
          category: string | null
          coverage: string
          created_at: string
          description: string | null
          id: string
          image_path: string
          name: string
          placements: string[]
          price_ore: number
          published: boolean
          style: string | null
          tags: string[]
          updated_at: string
          usage_terms: string | null
        }
        Insert: {
          tattoo_availability?: string | null
          tattoo_reuse?: string | null
          suggested_size_cm?: number | null
          tattoo_price_note?: string | null
          artist_id: string
          category?: string | null
          coverage?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path: string
          name: string
          placements?: string[]
          price_ore: number
          published?: boolean
          style?: string | null
          tags?: string[]
          updated_at?: string
          usage_terms?: string | null
        }
        Update: {
          tattoo_availability?: string | null
          tattoo_reuse?: string | null
          suggested_size_cm?: number | null
          tattoo_price_note?: string | null
          artist_id?: string
          category?: string | null
          coverage?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string
          name?: string
          placements?: string[]
          price_ore?: number
          published?: boolean
          style?: string | null
          tags?: string[]
          updated_at?: string
          usage_terms?: string | null
        }
        Relationships: []
      }
      matching_designs: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          image_data: string
          message: string | null
          name: string
          opened_count: number
          rotation: number | null
          sender_name: string | null
          token: string
          width_cm: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          image_data: string
          message?: string | null
          name?: string
          opened_count?: number
          rotation?: number | null
          sender_name?: string | null
          token: string
          width_cm?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          image_data?: string
          message?: string | null
          name?: string
          opened_count?: number
          rotation?: number | null
          sender_name?: string | null
          token?: string
          width_cm?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      motif_purchases: {
        Row: {
          commission_rate: number | null
          created_at: string
          environment: string
          fortnox_exported_at: string | null
          fortnox_invoice_number: string | null
          id: string
          motif_id: string
          price_paid_ore: number
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          environment?: string
          fortnox_exported_at?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          motif_id: string
          price_paid_ore: number
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          environment?: string
          fortnox_exported_at?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          motif_id?: string
          price_paid_ore?: number
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motif_purchases_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "marketplace_motifs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          created_at: string
          email_enabled: boolean
          extra_emails: string[]
          inapp_enabled: boolean
          on_change: boolean
          on_confirmation: boolean
          on_message: boolean
          on_reminder: boolean
          on_scan: boolean
          push_enabled: boolean
          quiet_enabled: boolean
          quiet_end: string
          quiet_scope: string
          quiet_start: string
          quiet_tz: string
          reminder_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          extra_emails?: string[]
          inapp_enabled?: boolean
          on_change?: boolean
          on_confirmation?: boolean
          on_message?: boolean
          on_reminder?: boolean
          on_scan?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_scope?: string
          quiet_start?: string
          quiet_tz?: string
          reminder_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          extra_emails?: string[]
          inapp_enabled?: boolean
          on_change?: boolean
          on_confirmation?: boolean
          on_message?: boolean
          on_reminder?: boolean
          on_scan?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_scope?: string
          quiet_start?: string
          quiet_tz?: string
          reminder_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          post_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          post_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          post_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body_part: string | null
          caption: string | null
          category: string | null
          created_at: string
          id: string
          image_path: string
          price_ore: number
          style: string | null
          tattoo_name: string | null
          try_count: number
          user_id: string
        }
        Insert: {
          body_part?: string | null
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_path: string
          price_ore?: number
          style?: string | null
          tattoo_name?: string | null
          try_count?: number
          user_id: string
        }
        Update: {
          body_part?: string | null
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_path?: string
          price_ore?: number
          style?: string | null
          tattoo_name?: string | null
          try_count?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adult_declared_at: string | null
          avatar_url: string | null
          bio: string | null
          bonus_until: string | null
          contact_email: string | null
          created_at: string
          display_name: string | null
          email_message_notifications: boolean
          handle: string | null
          id: string
          onboarding_done: boolean
          phone: string | null
          referral_code: string | null
          tab_privacy: Json
          updated_at: string
          username_set: boolean
        }
        Insert: {
          adult_declared_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          bonus_until?: string | null
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          email_message_notifications?: boolean
          handle?: string | null
          id: string
          onboarding_done?: boolean
          phone?: string | null
          referral_code?: string | null
          tab_privacy?: Json
          updated_at?: string
          username_set?: boolean
        }
        Update: {
          adult_declared_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          bonus_until?: string | null
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          email_message_notifications?: boolean
          handle?: string | null
          id?: string
          onboarding_done?: boolean
          phone?: string | null
          referral_code?: string | null
          tab_privacy?: Json
          updated_at?: string
          username_set?: boolean
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          created_at: string
          id: string
          image_url: string
          kind: string
          note: string | null
          project_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          kind?: string
          note?: string | null
          project_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          kind?: string
          note?: string | null
          project_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deposits: {
        Row: {
          amount_ore: number
          created_at: string
          created_by: string
          currency: string
          environment: string
          fortnox_exported_at: string | null
          fortnox_invoice_number: string | null
          id: string
          kind: string
          paid_at: string | null
          project_id: string
          reminder_sent_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          studio_id: string
          updated_at: string
        }
        Insert: {
          amount_ore: number
          created_at?: string
          created_by: string
          currency?: string
          environment?: string
          fortnox_exported_at?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          project_id: string
          reminder_sent_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          studio_id: string
          updated_at?: string
        }
        Update: {
          amount_ore?: number
          created_at?: string
          created_by?: string
          currency?: string
          environment?: string
          fortnox_exported_at?: string | null
          fortnox_invoice_number?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          project_id?: string
          reminder_sent_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deposits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_proposals: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          note: string | null
          project_id: string
          proposed_by: string
          proposed_date: string
          responded_at: string | null
          status: string
          time_window: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          project_id: string
          proposed_by: string
          proposed_date: string
          responded_at?: string | null
          status?: string
          time_window: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string
          proposed_by?: string
          proposed_date?: string
          responded_at?: string | null
          status?: string
          time_window?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_proposals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "artist_client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          created_at: string
          id: string
          label: string | null
          project_id: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          artist_name: string | null
          artist_user_id: string | null
          base_photo_url: string | null
          body_part: string | null
          booking_status: string
          collection: string | null
          cover_url: string | null
          created_at: string
          id: string
          journey_public: boolean
          name: string
          notes: string | null
          placement_note: string | null
          placement_unsure: boolean
          preview_url: string | null
          shared_reference_ids: string[]
          shelf: string
          size_dimension: string | null
          size_source: string | null
          size_unsure: boolean
          tattoo_id: string | null
          tattoo_name: string | null
          transform: Json | null
          updated_at: string
          user_id: string
          width_cm: number | null
        }
        Insert: {
          artist_name?: string | null
          artist_user_id?: string | null
          base_photo_url?: string | null
          body_part?: string | null
          booking_status?: string
          collection?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          journey_public?: boolean
          name: string
          notes?: string | null
          placement_note?: string | null
          placement_unsure?: boolean
          preview_url?: string | null
          shared_reference_ids?: string[]
          shelf?: string
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          tattoo_id?: string | null
          tattoo_name?: string | null
          transform?: Json | null
          updated_at?: string
          user_id: string
          width_cm?: number | null
        }
        Update: {
          artist_name?: string | null
          artist_user_id?: string | null
          base_photo_url?: string | null
          body_part?: string | null
          booking_status?: string
          collection?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          journey_public?: boolean
          name?: string
          notes?: string | null
          placement_note?: string | null
          placement_unsure?: boolean
          preview_url?: string | null
          shared_reference_ids?: string[]
          shelf?: string
          size_dimension?: string | null
          size_source?: string | null
          size_unsure?: boolean
          tattoo_id?: string | null
          tattoo_name?: string | null
          transform?: Json | null
          updated_at?: string
          user_id?: string
          width_cm?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_redemptions: {
        Row: {
          code: string
          created_at: string
          granted_days: number
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          granted_days?: number
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          granted_days?: number
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      scan_annotations: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          pos_x: number
          pos_y: number
          pos_z: number
          scan_id: string
          share_id: string | null
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          pos_x: number
          pos_y: number
          pos_z: number
          scan_id: string
          share_id?: string | null
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          pos_x?: number
          pos_y?: number
          pos_z?: number
          scan_id?: string
          share_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_annotations_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "body_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_annotations_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "scan_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_shares: {
        Row: {
          artist_id: string | null
          created_at: string
          expires_at: string
          id: string
          note: string | null
          revoked: boolean
          scan_id: string
          sketch_bucket: string | null
          sketch_path: string | null
          token: string
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          revoked?: boolean
          scan_id: string
          sketch_bucket?: string | null
          sketch_path?: string | null
          token: string
          user_id: string
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          revoked?: boolean
          scan_id?: string
          sketch_bucket?: string | null
          sketch_path?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_shares_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "body_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_monitor_runs: {
        Row: {
          base_url: string
          checks: Json
          emailed: boolean
          id: string
          issue_count: number
          issues: Json
          new_issue_count: number
          ran_at: string
          source: string
        }
        Insert: {
          base_url: string
          checks?: Json
          emailed?: boolean
          id?: string
          issue_count?: number
          issues?: Json
          new_issue_count?: number
          ran_at?: string
          source?: string
        }
        Update: {
          base_url?: string
          checks?: Json
          emailed?: boolean
          id?: string
          issue_count?: number
          issues?: Json
          new_issue_count?: number
          ran_at?: string
          source?: string
        }
        Relationships: []
      }
      seo_monitor_settings: {
        Row: {
          alert_email: string | null
          base_url: string
          email_enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          alert_email?: string | null
          base_url?: string
          email_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          alert_email?: string | null
          base_url?: string
          email_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      share_events: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          kind: string
          motif_id: string
          referrer: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          kind?: string
          motif_id: string
          referrer?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          kind?: string
          motif_id?: string
          referrer?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      slot_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          created_at: string
          id: string
          note: string | null
          slot_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          id?: string
          note?: string | null
          slot_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          id?: string
          note?: string | null
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "studio_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          method: string
          platform: string
          profile_url: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          method?: string
          platform: string
          profile_url?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          method?: string
          platform?: string
          profile_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      studio_agent_settings: {
        Row: {
          booking_mode: string
          buffer_minutes: number
          deposit_ore: number | null
          enabled: boolean
          horizon_days: number
          hourly_rate_ore: number | null
          knowledge: string
          language: string
          message_templates: Json
          min_minutes: number
          pricing_mode: string
          size_tiers: Json
          studio_id: string
          updated_at: string
        }
        Insert: {
          booking_mode?: string
          buffer_minutes?: number
          deposit_ore?: number | null
          enabled?: boolean
          horizon_days?: number
          hourly_rate_ore?: number | null
          knowledge?: string
          language?: string
          message_templates?: Json
          min_minutes?: number
          pricing_mode?: string
          size_tiers?: Json
          studio_id: string
          updated_at?: string
        }
        Update: {
          booking_mode?: string
          buffer_minutes?: number
          deposit_ore?: number | null
          enabled?: boolean
          horizon_days?: number
          hourly_rate_ore?: number | null
          knowledge?: string
          language?: string
          message_templates?: Json
          min_minutes?: number
          pricing_mode?: string
          size_tiers?: Json
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_artists: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          instagram: string | null
          name: string
          role: string | null
          sort_order: number
          studio_id: string
          styles: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name: string
          role?: string | null
          sort_order?: number
          studio_id: string
          styles?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string
          role?: string | null
          sort_order?: number
          studio_id?: string
          styles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      studio_availability: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          member_id: string | null
          requires_3d: boolean
          slot_minutes: number
          start_time: string
          studio_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          member_id?: string | null
          requires_3d?: boolean
          slot_minutes?: number
          start_time: string
          studio_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          member_id?: string | null
          requires_3d?: boolean
          slot_minutes?: number
          start_time?: string
          studio_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_availability_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_calendar_links: {
        Row: {
          account_email: string | null
          calendar_id: string
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          last_synced_at: string | null
          studio_id: string
          updated_at: string
        }
        Insert: {
          account_email?: string | null
          calendar_id?: string
          connection_key_ciphertext: string
          connector_id?: string
          created_at?: string
          last_synced_at?: string | null
          studio_id: string
          updated_at?: string
        }
        Update: {
          account_email?: string | null
          calendar_id?: string
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          last_synced_at?: string | null
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_clients: {
        Row: {
          client_key: string
          client_user_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          note: string | null
          phone: string | null
          state: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          client_key: string
          client_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          state?: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          client_key?: string
          client_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          state?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_deals: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_percent: number | null
          ends_at: string | null
          id: string
          member_id: string | null
          starts_at: string | null
          studio_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          member_id?: string | null
          starts_at?: string | null
          studio_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          member_id?: string | null
          starts_at?: string | null
          studio_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_deals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_fortnox_links: {
        Row: {
          access_token: string
          company_name: string | null
          created_at: string
          expires_at: string
          fee_account: number
          payment_account: number
          refresh_token: string
          sales_account: number
          studio_id: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          access_token: string
          company_name?: string | null
          created_at?: string
          expires_at: string
          fee_account?: number
          payment_account?: number
          refresh_token: string
          sales_account?: number
          studio_id: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          access_token?: string
          company_name?: string | null
          created_at?: string
          expires_at?: string
          fee_account?: number
          payment_account?: number
          refresh_token?: string
          sales_account?: number
          studio_id?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      studio_gallery: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          member_id: string | null
          studio_id: string
          style: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          member_id?: string | null
          studio_id: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          member_id?: string | null
          studio_id?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_gallery_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_handle_history: {
        Row: {
          created_at: string
          old_handle: string
          user_id: string
        }
        Insert: {
          created_at?: string
          old_handle: string
          user_id: string
        }
        Update: {
          created_at?: string
          old_handle?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_help_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          query: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          query?: string
          studio_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          query?: string
          studio_id?: string
        }
        Relationships: []
      }
      studio_instagram_links: {
        Row: {
          account_type: string | null
          created_at: string
          ig_user_id: string
          studio_id: string
          token_ciphertext: string
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          ig_user_id: string
          studio_id: string
          token_ciphertext: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string
          ig_user_id?: string
          studio_id?: string
          token_ciphertext?: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      studio_members: {
        Row: {
          artist_member_id: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          invite_token: string
          role: string
          status: string
          studio_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          artist_member_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invite_token?: string
          role?: string
          status?: string
          studio_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          artist_member_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invite_token?: string
          role?: string
          status?: string
          studio_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_artist_member_id_fkey"
            columns: ["artist_member_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_payouts: {
        Row: {
          amount_ore: number
          created_at: string
          created_by: string
          id: string
          note: string | null
          studio_id: string
        }
        Insert: {
          amount_ore: number
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          studio_id: string
        }
        Update: {
          amount_ore?: number
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          studio_id?: string
        }
        Relationships: []
      }
      studio_slots: {
        Row: {
          approved_at: string | null
          booked_at: string | null
          booked_by: string | null
          client_note: string | null
          created_at: string
          deal_id: string | null
          decline_reason: string | null
          duration_minutes: number
          external_event_id: string | null
          id: string
          member_id: string | null
          note: string | null
          price_ore: number | null
          proposed_options: Json
          proposed_starts_at: string | null
          reminder_sent_at: string | null
          requires_3d: boolean
          scan_bucket: string
          scan_by: string | null
          scan_delivered_at: string | null
          scan_name: string | null
          scan_note: string | null
          scan_path: string | null
          source: string
          starts_at: string
          status: string
          studio_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          booked_at?: string | null
          booked_by?: string | null
          client_note?: string | null
          created_at?: string
          deal_id?: string | null
          decline_reason?: string | null
          duration_minutes?: number
          external_event_id?: string | null
          id?: string
          member_id?: string | null
          note?: string | null
          price_ore?: number | null
          proposed_options?: Json
          proposed_starts_at?: string | null
          reminder_sent_at?: string | null
          requires_3d?: boolean
          scan_bucket?: string
          scan_by?: string | null
          scan_delivered_at?: string | null
          scan_name?: string | null
          scan_note?: string | null
          scan_path?: string | null
          source?: string
          starts_at: string
          status?: string
          studio_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          booked_at?: string | null
          booked_by?: string | null
          client_note?: string | null
          created_at?: string
          deal_id?: string | null
          decline_reason?: string | null
          duration_minutes?: number
          external_event_id?: string | null
          id?: string
          member_id?: string | null
          note?: string | null
          price_ore?: number | null
          proposed_options?: Json
          proposed_starts_at?: string | null
          reminder_sent_at?: string | null
          requires_3d?: boolean
          scan_bucket?: string
          scan_by?: string | null
          scan_delivered_at?: string | null
          scan_name?: string | null
          scan_note?: string | null
          scan_path?: string | null
          source?: string
          starts_at?: string
          status?: string
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_slots_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "studio_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_slots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "studio_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_waitlist: {
        Row: {
          city: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tryon_history: {
        Row: {
          body_part: string | null
          created_at: string
          id: string
          motif_id: string | null
          motif_name: string | null
          pose: string | null
          preview_url: string | null
          rotation: number | null
          session_id: string | null
          transform: Json | null
          user_id: string
          width_cm: number | null
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          id?: string
          motif_id?: string | null
          motif_name?: string | null
          pose?: string | null
          preview_url?: string | null
          rotation?: number | null
          session_id?: string | null
          transform?: Json | null
          user_id: string
          width_cm?: number | null
        }
        Update: {
          body_part?: string | null
          created_at?: string
          id?: string
          motif_id?: string | null
          motif_name?: string | null
          pose?: string | null
          preview_url?: string | null
          rotation?: number | null
          session_id?: string | null
          transform?: Json | null
          user_id?: string
          width_cm?: number | null
        }
        Relationships: []
      }
      user_designs: {
        Row: {
          created_at: string
          id: string
          kind: string
          local_id: string | null
          name: string
          storage_path: string
          user_id: string
          width_cm: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          local_id?: string | null
          name?: string
          storage_path: string
          user_id: string
          width_cm?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          local_id?: string | null
          name?: string
          storage_path?: string
          user_id?: string
          width_cm?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vote_reactions: {
        Row: {
          choice: string | null
          created_at: string
          creator_user_id: string
          device_id: string | null
          id: string
          media_path: string
          media_type: string
          reactor_name: string | null
          vote_session_id: string
        }
        Insert: {
          choice?: string | null
          created_at?: string
          creator_user_id: string
          device_id?: string | null
          id?: string
          media_path: string
          media_type?: string
          reactor_name?: string | null
          vote_session_id: string
        }
        Update: {
          choice?: string | null
          created_at?: string
          creator_user_id?: string
          device_id?: string | null
          id?: string
          media_path?: string
          media_type?: string
          reactor_name?: string | null
          vote_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_reactions_vote_session_id_fkey"
            columns: ["vote_session_id"]
            isOneToOne: false
            referencedRelation: "vote_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_sessions: {
        Row: {
          caption: string | null
          created_at: string
          creator_user_id: string
          expires_at: string
          id: string
          image_url_a: string
          image_url_b: string | null
          is_profile_open: boolean
          media_type_a: string
          media_type_b: string | null
          reaction_enabled: boolean
          slug: string
          type: Database["public"]["Enums"]["vote_session_type"]
          updated_at: string
          vote_enabled: boolean
        }
        Insert: {
          caption?: string | null
          created_at?: string
          creator_user_id: string
          expires_at?: string
          id?: string
          image_url_a: string
          image_url_b?: string | null
          is_profile_open?: boolean
          media_type_a?: string
          media_type_b?: string | null
          reaction_enabled?: boolean
          slug: string
          type: Database["public"]["Enums"]["vote_session_type"]
          updated_at?: string
          vote_enabled?: boolean
        }
        Update: {
          caption?: string | null
          created_at?: string
          creator_user_id?: string
          expires_at?: string
          id?: string
          image_url_a?: string
          image_url_b?: string | null
          is_profile_open?: boolean
          media_type_a?: string
          media_type_b?: string | null
          reaction_enabled?: boolean
          slug?: string
          type?: Database["public"]["Enums"]["vote_session_type"]
          updated_at?: string
          vote_enabled?: boolean
        }
        Relationships: []
      }
      votes: {
        Row: {
          choice: Database["public"]["Enums"]["vote_choice"]
          created_at: string
          device_id: string | null
          id: string
          vote_session_id: string
          voter_display_name: string | null
          voter_ip_hash: string | null
          voter_type: Database["public"]["Enums"]["voter_type"]
          voter_user_id: string | null
        }
        Insert: {
          choice: Database["public"]["Enums"]["vote_choice"]
          created_at?: string
          device_id?: string | null
          id?: string
          vote_session_id: string
          voter_display_name?: string | null
          voter_ip_hash?: string | null
          voter_type?: Database["public"]["Enums"]["voter_type"]
          voter_user_id?: string | null
        }
        Update: {
          choice?: Database["public"]["Enums"]["vote_choice"]
          created_at?: string
          device_id?: string | null
          id?: string
          vote_session_id?: string
          voter_display_name?: string | null
          voter_ip_hash?: string | null
          voter_type?: Database["public"]["Enums"]["voter_type"]
          voter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_vote_session_id_fkey"
            columns: ["vote_session_id"]
            isOneToOne: false
            referencedRelation: "vote_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_studio_invite: { Args: { _token: string }; Returns: Json }
      add_artist_preview_comment: {
        Args: { _body: string; _name: string; _token: string }
        Returns: Json
      }
      add_scan_annotation: {
        Args: {
          _body: string
          _name: string
          _token: string
          _x: number
          _y: number
          _z: number
        }
        Returns: Json
      }
      approve_artist_project_sketch_version: {
        Args: { _version_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          change_comment: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "artist_project_sketch_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      artist_preview_by_token: { Args: { _token: string }; Returns: Json }
      booking_adult_declared: { Args: { _user: string }; Returns: boolean }
      claim_artist_invite: { Args: { _token: string }; Returns: Json }
      create_artist_project_sketch_version: {
        Args: {
          _change_comment: string
          _file_name: string
          _mime_type: string
          _project_id: string
          _size_bytes: number
          _storage_path: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          change_comment: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "artist_project_sketch_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_referral_code: { Args: never; Returns: string }
      find_couple_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          member_count: number
          name: string
        }[]
      }
      generate_studio_handle: {
        Args: { _name: string; _user: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_try: { Args: { _post_id: string }; Returns: number }
      is_any_studio_account: { Args: { _user: string }; Returns: boolean }
      is_approved_studio: { Args: { _user: string }; Returns: boolean }
      is_artist_project_party: {
        Args: { _project: string; _user: string }
        Returns: boolean
      }
      is_booking_party: {
        Args: { _slot: string; _user: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_couple_member: {
        Args: { _couple_id: string; _user_id: string }
        Returns: boolean
      }
      is_handle_available: { Args: { _handle: string }; Returns: boolean }
      is_instagram_thread_staff: {
        Args: { _thread: string; _user: string }
        Returns: boolean
      }
      is_studio_admin: {
        Args: { _studio: string; _user: string }
        Returns: boolean
      }
      is_studio_staff: {
        Args: { _studio: string; _user: string }
        Returns: boolean
      }
      join_couple_by_code: {
        Args: { _code: string; _display_name: string }
        Returns: string
      }
      open_direct_conversation: { Args: { _other: string }; Returns: string }
      owns_motif: { Args: { _motif: string; _user: string }; Returns: boolean }
      public_artist_page: { Args: { _handle: string }; Returns: Json }
      public_profile_page: { Args: { _handle: string }; Returns: Json }
      public_slots: {
        Args: { _studio: string }
        Returns: {
          deal_id: string
          duration_minutes: number
          id: string
          member_id: string
          note: string
          price_ore: number
          requires_3d: boolean
          starts_at: string
          status: string
          studio_id: string
        }[]
      }
      redeem_referral: { Args: { _code: string }; Returns: Json }
      resolve_studio_handle: { Args: { _handle: string }; Returns: string }
      scan_annotations_by_token: { Args: { _token: string }; Returns: Json }
      search_artists: {
        Args: {
          _lat?: number
          _limit?: number
          _lng?: number
          _max_price?: number
          _min_rating?: number
          _q?: string
          _styles?: string[]
        }
        Returns: {
          accepts_messages: boolean
          address: string
          avatar_url: string
          bio: string
          city: string
          distance_km: number
          instagram: string
          lat: number
          lng: number
          price_level: number
          rating: number
          studio_name: string
          styles: string[]
          user_id: string
          verified: boolean
          website: string
        }[]
      }
      search_artists_v2: {
        Args: {
          _lat?: number
          _limit?: number
          _lng?: number
          _max_price?: number
          _min_rating?: number
          _q?: string
          _styles?: string[]
        }
        Returns: {
          accepts_messages: boolean
          address: string
          avatar_url: string
          bio: string
          city: string
          distance_km: number
          handle: string
          instagram: string
          lat: number
          lng: number
          price_level: number
          rating: number
          studio_name: string
          styles: string[]
          user_id: string
          verified: boolean
          website: string
        }[]
      }
      search_user_handles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          id: string
        }[]
      }
      set_scan_scale: {
        Args: { _scale: number; _scan_id: string }
        Returns: Json
      }
      sketch_share_by_token: { Args: { _token: string }; Returns: Json }
      studio_booking_form: { Args: { _studio: string }; Returns: Json }
      studio_calendar_status: { Args: { _studio: string }; Returns: Json }
      studio_fortnox_status: { Args: { _studio: string }; Returns: Json }
      studio_instagram_status: { Args: { _studio: string }; Returns: Json }
      studio_overview: { Args: { _studio: string }; Returns: Json }
      top_shared_motifs: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          motif_id: string
          opens: number
          shares: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      notification_kind: "like" | "comment" | "follow" | "message" | "booking"
      vote_choice: "yes" | "no" | "a" | "b"
      vote_session_type: "yes_no" | "a_b"
      voter_type: "guest" | "user"
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
      app_role: ["admin", "moderator", "user"],
      notification_kind: ["like", "comment", "follow", "message", "booking"],
      vote_choice: ["yes", "no", "a", "b"],
      vote_session_type: ["yes_no", "a_b"],
      voter_type: ["guest", "user"],
    },
  },
} as const
