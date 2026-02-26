export interface Product {
  id: number;
  name: string;
  category: string;
  price_sell: number;
  price_cost: number;
  stock_quantity: number;
  stock_min: number;
}

export interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  notes: string;
  loyalty_count: number;
}

export interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price_at_time: number;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  items?: OrderItem[];
  total_amount: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
}

export type CategoryName = 'Gás' | 'Água 20L' | 'Água de coco' | 'Refrigerante';

export interface Profile {
  id: string;
  name: string;
  role: 'admin' | 'entregador' | 'pending';
}
