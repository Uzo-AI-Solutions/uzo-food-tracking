import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addUserIdToInsert } from '../lib/auth-helpers';
import { FoodItem, DbItem } from '../types';
import { dbItemToFoodItem, foodItemToDbInsert } from '../lib/type-mappers';
import { mockFoodItems } from '../data/mockData';
import { useDebounce } from '../lib/search';
import { logger } from '@/lib/logger';

interface InventoryFilters {
  category: string;
  stock: string;
  rating: string;
}

interface UseInventorySearchResult {
  // Data
  items: FoodItem[];
  allItems: FoodItem[];
  loading: boolean;
  error: string | null;
  usingMockData: boolean;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filters
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  stockFilter: string;
  setStockFilter: (stock: string) => void;
  ratingFilter: string;
  setRatingFilter: (rating: string) => void;
  categories: string[];
  
  // Actions
  addItem: (item: Omit<FoodItem, 'id' | 'last_edited' | 'created_at' | 'updated_at'>) => Promise<FoodItem>;
  updateItem: (id: number, updates: Partial<FoodItem>) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useInventorySearch(): UseInventorySearchResult {
  const queryClient = useQueryClient();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  
  // Mock data fallback state
  const [usingMockData, setUsingMockData] = useState(false);
  const [mockItems, setMockItems] = useState<FoodItem[]>([]);

  // Load all items from database (cached)
  const {
    data: allItems = [],
    isLoading: isLoadingItems,
    error: itemsError,
    refetch: refetchItems
  } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      logger.info('🔄 Loading items from Supabase...');
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (error) {
        logger.warn('⚠️ Supabase connection failed, falling back to mock data:', error.message);
        setUsingMockData(true);
        setMockItems(mockFoodItems);
        return mockFoodItems;
      }
      
      if (data && data.length > 0) {
        logger.info('✅ Loaded data from Supabase:', data.length, 'items');
        const mappedItems = data.map(dbItemToFoodItem);
        setUsingMockData(false);
        return mappedItems;
      } else {
        logger.info('ℹ️ Database is empty, using mock data');
        setUsingMockData(true);
        setMockItems(mockFoodItems);
        return mockFoodItems;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enhanced client-side filtering with smart search capabilities (like recipes and meal re-log)
  const items = useMemo(() => {
    const baseItems = usingMockData ? mockItems : allItems;

    return baseItems.filter(item => {
      // Smart search filtering for all data (mock and real)
      let matchesSearch = true;
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();

        // Smart search: Check name, brand, category, and ingredients for partial matches
        const nameMatch = item.name.toLowerCase().includes(query);
        const brandMatch = item.brand?.toLowerCase().includes(query);
        const categoryMatch = item.category.toLowerCase().includes(query);
        const ingredientsMatch = item.ingredients?.toLowerCase().includes(query);

        matchesSearch = nameMatch || brandMatch || categoryMatch || ingredientsMatch;
      }
      
      // Apply filters (removed stock filter since in_stock field was removed)
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesRating = ratingFilter === 'all' ||
                           (ratingFilter === 'unrated' && !item.rating) ||
                           (ratingFilter !== 'unrated' && item.rating === parseInt(ratingFilter));

      return matchesSearch && matchesCategory && matchesRating;
    });
  }, [allItems, mockItems, debouncedSearchQuery, usingMockData, categoryFilter, ratingFilter]);

  // Derive categories from current items
  const categories = useMemo(() => {
    const baseItems = usingMockData ? mockItems : allItems;
    return Array.from(new Set(baseItems.map(item => item.category)));
  }, [allItems, mockItems, usingMockData]);

  // Loading state (only for initial data load)
  const loading = isLoadingItems;

  // Error state (simplified since no more search API calls)
  const error = itemsError ?
    (usingMockData ? 'Using mock data - database connection unavailable' :
     itemsError instanceof Error ? itemsError.message : 'Failed to load items') : null;

  // Stats - outOfStockItems removed since in_stock field was removed

  // Actions
  const addItem = async (itemData: Omit<FoodItem, 'id' | 'last_edited' | 'created_at' | 'updated_at'>) => {
    try {
      // If using mock data, add to local state only
      if (usingMockData) {
        const newItem: FoodItem = {
          ...itemData,
          id: Date.now(),
          last_edited: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setMockItems(prev => [...prev, newItem]);
        return newItem;
      }

      // Otherwise, add to Supabase
      const now = new Date().toISOString();
      const dbItem = await addUserIdToInsert(foodItemToDbInsert({
        ...itemData,
        last_edited: now,
        created_at: now,
        updated_at: now,
      }));

      const { data, error } = await supabase
        .from('items')
        .insert([dbItem])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('ux_items_normalized_name')) {
          const duplicateError = new Error(`An item with the name "${itemData.name}" already exists in your inventory.`);
          duplicateError.name = 'DuplicateItemError';
          throw duplicateError;
        }
        throw error;
      }

      const newItem = dbItemToFoodItem(data as DbItem);
      
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      
      return newItem;
    } catch (err) {
      if (err instanceof Error && err.name === 'DuplicateItemError') {
        throw err;
      }

      // Fall back to local mock mode
      logger.warn('Add item failed, falling back to local mock mode:', err);
      const now = new Date().toISOString();
      const newItem: FoodItem = {
        ...itemData,
        id: Date.now(),
        last_edited: now,
        created_at: now,
        updated_at: now,
      };
      setMockItems(prev => [...prev, newItem]);
      setUsingMockData(true);
      return newItem;
    }
  };

  const updateItem = async (id: number, updates: Partial<FoodItem>) => {
    try {
      // If using mock data, update local state only
      if (usingMockData) {
        const now = new Date().toISOString();
        setMockItems(prev => prev.map(item => 
          item.id === id 
            ? { ...item, ...updates, last_edited: now, updated_at: now }
            : item
        ));
        return;
      }

      // Update in Supabase - only map fields that exist in new schema
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {};

      // Map updates to database fields (only existing fields)
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.brand !== undefined) updateData.brand = updates.brand || null;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url || null;
      if (updates.rating !== undefined) updateData.rating = updates.rating || null;
      if (updates.ingredients !== undefined) updateData.ingredients = updates.ingredients || null;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;

      // Removed fields: in_stock, price, serving_*, nutrition fields
      
      updateData.last_edited = now;
      
      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      throw new Error(errorMessage);
    }
  };

  const deleteItem = async (id: number) => {
    try {
      // If using mock data, delete from local state only
      if (usingMockData) {
        setMockItems(prev => prev.filter(item => item.id !== id));
        return;
      }

      // Delete from Supabase
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      throw new Error(errorMessage);
    }
  };

  // toggleStock function removed since in_stock field was removed from schema

  return {
    // Data
    items,
    allItems: usingMockData ? mockItems : allItems,
    loading,
    error,
    usingMockData,
    
    // Search
    searchQuery,
    setSearchQuery,
    
    // Filters
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
    ratingFilter,
    setRatingFilter,
    categories,
    
    // Actions
    addItem,
    updateItem,
    deleteItem,
    refetch: refetchItems,
  };
}
