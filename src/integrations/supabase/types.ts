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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          deal_analysis_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          deal_analysis_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          deal_analysis_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_deal_analysis_id_fkey"
            columns: ["deal_analysis_id"]
            isOneToOne: false
            referencedRelation: "deal_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_strategies: {
        Row: {
          acceptance_likelihood: number | null
          counter_price: number | null
          deal_analysis_id: string
          generated_at: string
          id: string
          rationale: string | null
          risk: string | null
          strategy_type: string
          target_buyer: string | null
          terms: Json | null
          version: number | null
        }
        Insert: {
          acceptance_likelihood?: number | null
          counter_price?: number | null
          deal_analysis_id: string
          generated_at?: string
          id?: string
          rationale?: string | null
          risk?: string | null
          strategy_type: string
          target_buyer?: string | null
          terms?: Json | null
          version?: number | null
        }
        Update: {
          acceptance_likelihood?: number | null
          counter_price?: number | null
          deal_analysis_id?: string
          generated_at?: string
          id?: string
          rationale?: string | null
          risk?: string | null
          strategy_type?: string
          target_buyer?: string | null
          terms?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "counter_strategies_deal_analysis_id_fkey"
            columns: ["deal_analysis_id"]
            isOneToOne: false
            referencedRelation: "deal_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_analyses: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          property_id: string
          status: string | null
          top_recommendation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          property_id: string
          status?: string | null
          top_recommendation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          status?: string | null
          top_recommendation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          offer_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          offer_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          offer_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_offer_fields: {
        Row: {
          confidence: number | null
          evidence: string | null
          extracted_at: string
          field_name: string
          field_value: Json | null
          id: string
          offer_id: string
          version: number | null
        }
        Insert: {
          confidence?: number | null
          evidence?: string | null
          extracted_at?: string
          field_name: string
          field_value?: Json | null
          id?: string
          offer_id: string
          version?: number | null
        }
        Update: {
          confidence?: number | null
          evidence?: string | null
          extracted_at?: string
          field_name?: string
          field_value?: Json | null
          id?: string
          offer_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_offer_fields_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      leverage_suggestions: {
        Row: {
          deal_analysis_id: string
          easiest_wins: Json | null
          generated_at: string
          highest_impact_terms: Json | null
          id: string
          notes: string | null
          suggestions: Json
          version: number | null
        }
        Insert: {
          deal_analysis_id: string
          easiest_wins?: Json | null
          generated_at?: string
          highest_impact_terms?: Json | null
          id?: string
          notes?: string | null
          suggestions?: Json
          version?: number | null
        }
        Update: {
          deal_analysis_id?: string
          easiest_wins?: Json | null
          generated_at?: string
          highest_impact_terms?: Json | null
          id?: string
          notes?: string | null
          suggestions?: Json
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leverage_suggestions_deal_analysis_id_fkey"
            columns: ["deal_analysis_id"]
            isOneToOne: false
            referencedRelation: "deal_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          agent_brokerage: string | null
          agent_name: string | null
          appraisal_terms: string | null
          buyer_name: string
          close_days: number | null
          close_timeline: string | null
          completeness: number | null
          concessions: string | null
          contingencies: string[] | null
          created_at: string
          deal_analysis_id: string
          down_payment: number | null
          down_payment_percent: number | null
          earnest_money: number | null
          financing_type: string | null
          id: string
          inspection_period: string | null
          labels: string[] | null
          leaseback_request: string | null
          offer_price: number | null
          pre_approval: boolean | null
          proof_of_funds: boolean | null
          special_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_brokerage?: string | null
          agent_name?: string | null
          appraisal_terms?: string | null
          buyer_name: string
          close_days?: number | null
          close_timeline?: string | null
          completeness?: number | null
          concessions?: string | null
          contingencies?: string[] | null
          created_at?: string
          deal_analysis_id: string
          down_payment?: number | null
          down_payment_percent?: number | null
          earnest_money?: number | null
          financing_type?: string | null
          id?: string
          inspection_period?: string | null
          labels?: string[] | null
          leaseback_request?: string | null
          offer_price?: number | null
          pre_approval?: boolean | null
          proof_of_funds?: boolean | null
          special_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_brokerage?: string | null
          agent_name?: string | null
          appraisal_terms?: string | null
          buyer_name?: string
          close_days?: number | null
          close_timeline?: string | null
          completeness?: number | null
          concessions?: string | null
          contingencies?: string[] | null
          created_at?: string
          deal_analysis_id?: string
          down_payment?: number | null
          down_payment_percent?: number | null
          earnest_money?: number | null
          financing_type?: string | null
          id?: string
          inspection_period?: string | null
          labels?: string[] | null
          leaseback_request?: string | null
          offer_price?: number | null
          pre_approval?: boolean | null
          proof_of_funds?: boolean | null
          special_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_deal_analysis_id_fkey"
            columns: ["deal_analysis_id"]
            isOneToOne: false
            referencedRelation: "deal_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          city: string | null
          created_at: string
          id: string
          listing_price: number | null
          property_type: string | null
          seller_goals: string[] | null
          seller_notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          id?: string
          listing_price?: number | null
          property_type?: string | null
          seller_goals?: string[] | null
          seller_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          id?: string
          listing_price?: number | null
          property_type?: string | null
          seller_goals?: string[] | null
          seller_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          close_probability: number | null
          contingency_risk: number | null
          factor_details: Json | null
          financial_confidence: number | null
          id: string
          offer_id: string
          offer_strength: number | null
          package_completeness: number | null
          scored_at: string
          timing_risk: number | null
          version: number | null
        }
        Insert: {
          close_probability?: number | null
          contingency_risk?: number | null
          factor_details?: Json | null
          financial_confidence?: number | null
          id?: string
          offer_id: string
          offer_strength?: number | null
          package_completeness?: number | null
          scored_at?: string
          timing_risk?: number | null
          version?: number | null
        }
        Update: {
          close_probability?: number | null
          contingency_risk?: number | null
          factor_details?: Json | null
          financial_confidence?: number | null
          id?: string
          offer_id?: string
          offer_strength?: number | null
          package_completeness?: number | null
          scored_at?: string
          timing_risk?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_priorities: {
        Row: {
          certainty_weight: number | null
          contingencies_weight: number | null
          created_at: string
          deal_analysis_id: string
          financial_weight: number | null
          id: string
          leaseback_weight: number | null
          price_weight: number | null
          repair_weight: number | null
          speed_weight: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certainty_weight?: number | null
          contingencies_weight?: number | null
          created_at?: string
          deal_analysis_id: string
          financial_weight?: number | null
          id?: string
          leaseback_weight?: number | null
          price_weight?: number | null
          repair_weight?: number | null
          speed_weight?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certainty_weight?: number | null
          contingencies_weight?: number | null
          created_at?: string
          deal_analysis_id?: string
          financial_weight?: number | null
          id?: string
          leaseback_weight?: number | null
          price_weight?: number | null
          repair_weight?: number | null
          speed_weight?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_priorities_deal_analysis_id_fkey"
            columns: ["deal_analysis_id"]
            isOneToOne: false
            referencedRelation: "deal_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
