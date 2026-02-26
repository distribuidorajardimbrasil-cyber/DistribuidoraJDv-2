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
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            categories: {
                Row: {
                    emoji: string
                    id: number
                    name: string
                }
                Insert: {
                    emoji: string
                    id?: number
                    name: string
                }
                Update: {
                    emoji?: string
                    id?: number
                    name?: string
                }
                Relationships: []
            }
            customers: {
                Row: {
                    address: string | null
                    id: number
                    is_active: boolean
                    loyalty_count: number | null
                    name: string
                    notes: string | null
                    phone: string | null
                }
                Insert: {
                    address?: string | null
                    id?: number
                    is_active?: boolean
                    loyalty_count?: number | null
                    name: string
                    notes?: string | null
                    phone?: string | null
                }
                Update: {
                    address?: string | null
                    id?: number
                    is_active?: boolean
                    loyalty_count?: number | null
                    name?: string
                    notes?: string | null
                    phone?: string | null
                }
                Relationships: []
            }
            order_items: {
                Row: {
                    id: number
                    order_id: number | null
                    price_at_time: number
                    product_id: number | null
                    quantity: number
                }
                Insert: {
                    id?: number
                    order_id?: number | null
                    price_at_time: number
                    product_id?: number | null
                    quantity: number
                }
                Update: {
                    id?: number
                    order_id?: number | null
                    price_at_time?: number
                    product_id?: number | null
                    quantity?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "order_items_order_id_fkey"
                        columns: ["order_id"]
                        isOneToOne: false
                        referencedRelation: "orders"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "order_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            orders: {
                Row: {
                    created_at: string | null
                    customer_id: number | null
                    delivery_status: string | null
                    id: number
                    payment_method: string | null
                    payment_status: string | null
                    total_amount: number
                }
                Insert: {
                    created_at?: string | null
                    customer_id?: number | null
                    delivery_status?: string | null
                    id?: number
                    payment_method?: string | null
                    payment_status?: string | null
                    total_amount: number
                }
                Update: {
                    created_at?: string | null
                    customer_id?: number | null
                    delivery_status?: string | null
                    id?: number
                    payment_method?: string | null
                    payment_status?: string | null
                    total_amount?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "orders_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "customers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            products: {
                Row: {
                    category: string
                    id: number
                    is_active: boolean
                    name: string
                    price_cost: number
                    price_sell: number
                    stock_min: number | null
                    stock_quantity: number | null
                }
                Insert: {
                    category: string
                    id?: number
                    is_active?: boolean
                    name: string
                    price_cost: number
                    price_sell: number
                    stock_min?: number | null
                    stock_quantity?: number | null
                }
                Update: {
                    category?: string
                    id?: number
                    is_active?: boolean
                    name?: string
                    price_cost?: number
                    price_sell?: number
                    stock_min?: number | null
                    stock_quantity?: number | null
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    created_at: string
                    id: string
                    name: string | null
                    role: string | null
                }
                Insert: {
                    created_at?: string
                    id: string
                    name?: string | null
                    role?: string | null
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string | null
                    role?: string | null
                }
                Relationships: []
            }
            stock_movements: {
                Row: {
                    created_at: string | null
                    id: number
                    product_id: number | null
                    quantity: number
                    reason: string | null
                    type: string
                }
                Insert: {
                    created_at?: string | null
                    id?: number
                    product_id?: number | null
                    quantity: number
                    reason?: string | null
                    type: string
                }
                Update: {
                    created_at?: string | null
                    id?: number
                    product_id?: number | null
                    quantity?: number
                    reason?: string | null
                    type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "stock_movements_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            transactions: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string | null
                    id: number
                    type: string
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description?: string | null
                    id?: number
                    type: string
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string | null
                    id?: number
                    type?: string
                }
                Relationships: []
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
