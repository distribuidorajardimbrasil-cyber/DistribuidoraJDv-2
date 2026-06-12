import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Category, Product, Profile } from '../types';

interface DataContextType {
  categories: Category[];
  products: Product[];
  deliverymen: Profile[];
  loadingCategories: boolean;
  loadingProducts: boolean;
  loadingDeliverymen: boolean;
  refreshCategories: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshDeliverymen: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliverymen, setDeliverymen] = useState<Profile[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDeliverymen, setLoadingDeliverymen] = useState(false);

  const refreshCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await (supabase
        .from('categories') as any)
        .select('id, name, emoji')
        .order('name');
      if (!error && data) {
        setCategories(data as Category[]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const refreshProducts = async () => {
    setLoadingProducts(true);
    try {
      // Products has 'is_active' column. Fetch active only.
      const { data, error } = await (supabase
        .from('products') as any)
        .select('id, name, category, price_sell, price_cost, stock_quantity, stock_min')
        .eq('is_active', true);

      if (!error && data) {
        setProducts(data as Product[]);
      } else if (error) {
        // Fallback if is_active column doesn't exist
        const { data: allData } = await (supabase
          .from('products') as any)
          .select('id, name, category, price_sell, price_cost, stock_quantity, stock_min');
        if (allData) setProducts(allData as Product[]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const refreshDeliverymen = async () => {
    setLoadingDeliverymen(true);
    try {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('id, name, role')
        .eq('role', 'entregador');
      if (!error && data) {
        setDeliverymen(data as Profile[]);
      }
    } catch (err) {
      console.error('Error fetching deliverymen:', err);
    } finally {
      setLoadingDeliverymen(false);
    }
  };

  useEffect(() => {
    refreshCategories();
    refreshProducts();
    refreshDeliverymen();
  }, []);

  return (
    <DataContext.Provider
      value={{
        categories,
        products,
        deliverymen,
        loadingCategories,
        loadingProducts,
        loadingDeliverymen,
        refreshCategories,
        refreshProducts,
        refreshDeliverymen,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
