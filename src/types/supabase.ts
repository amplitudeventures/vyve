export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      "Denominator questions": {
        Row: {
          question_id: number
          question_text: string | null
          display_order?: number
        }
        Insert: {
          question_id: number
          question_text?: string | null
          display_order?: number
        }
        Update: {
          question_id?: number
          question_text?: string | null
          display_order?: number
        }
      }
      "Denominator questions soft": {
        Row: {
          question_id: number
          question_text: string | null
          display_order?: number
        }
        Insert: {
          question_id: number
          question_text?: string | null
          display_order?: number
        }
        Update: {
          question_id?: number
          question_text?: string | null
          display_order?: number
        }
      }
      "Kristian questions": {
        Row: {
          question_id: number
          question_text: string | null
        }
        Insert: {
          question_id: number
          question_text?: string | null
        }
        Update: {
          question_id?: number
          question_text?: string | null
        }
      }
      company_analysis_results: {
        Row: {
          id: string
          company_id: string
          question_id: number
          answer: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          question_id: number
          answer: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          question_id?: number
          answer?: string
          created_at?: string
        }
      }
    }
  }
} 