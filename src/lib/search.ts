import React from 'react';
import { supabase } from './supabase';
import { FoodItem, Recipe, Tag, MealLog } from '../types';
import type { Database } from '../types/database';
import { dbItemToFoodItem, dbRecipeToRecipe, dbTagToTag, dbMealLogToMealLog } from './type-mappers';
import { logger } from './logger';

export interface SearchOptions {
  limit?: number;
  includeInactive?: boolean;
  categories?: string[];
  tags?: number[];
  sortBy?: 'relevance' | 'name' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface GlobalSearchResult {
  items: FoodItem[];
  recipes: Recipe[];
  tags: Tag[];
  mealLogs: MealLog[];
  total: number;
}

/**
 * Enhanced search utility for food items with full-text search
 */
export async function searchItems(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult<FoodItem>> {
  const {
    limit = 50,
    includeInactive = false,
    categories = [],
    sortBy = 'relevance',
    sortOrder = 'desc'
  } = options;

  try {
    let supabaseQuery = supabase
      .from('items')
      .select('*', { count: 'exact' });

    if (query.trim()) {
      // Use full-text search for non-empty queries
      const searchQuery = query
        .split(' ')
        .map(term => term.trim())
        .filter(term => term.length > 0)
        .join(' & ');

      supabaseQuery = supabaseQuery
        .textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'english'
        });
    }

    // Filter by stock status
    if (!includeInactive) {
      supabaseQuery = supabaseQuery.eq('in_stock', true);
    }

    // Filter by categories
    if (categories.length > 0) {
      supabaseQuery = supabaseQuery.in('category', categories);
    }

    // Apply sorting
    if (query.trim() && sortBy === 'relevance') {
      // PostgreSQL will automatically sort by relevance for text search
    } else {
      const sortField = sortBy === 'relevance' ? 'name' : sortBy;
      supabaseQuery = supabaseQuery.order(sortField, { ascending: sortOrder === 'asc' });
    }

    supabaseQuery = supabaseQuery.limit(limit);

    const { data, error, count } = await supabaseQuery;

    if (error) throw error;

    const items = (data || []).map(dbItemToFoodItem);
    
    return {
      items,
      total: count || 0,
      hasMore: (count || 0) > items.length
    };
  } catch (error) {
    logger.error('Search items error:', error);
    throw error;
  }
}

/**
 * Enhanced search utility for recipes with full-text search
 */
export async function searchRecipes(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult<Recipe>> {
  const {
    limit = 50,
    tags = [],
    sortBy = 'relevance',
    sortOrder = 'desc'
  } = options;

  try {
    let supabaseQuery = supabase
      .from('recipes')
      .select(`
        *,
        recipe_items (
          quantity,
          unit,
          item_id,
          created_at,
          updated_at
        ),
        recipe_tags (
          tag_id,
          tags (*)
        )
      `, { count: 'exact' });

    if (query.trim()) {
      // Use full-text search for non-empty queries
      const searchQuery = query
        .split(' ')
        .map(term => term.trim())
        .filter(term => term.length > 0)
        .join(' & ');

      supabaseQuery = supabaseQuery
        .textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'english'
        });
    }

    // Filter by tags
    if (tags.length > 0) {
      supabaseQuery = supabaseQuery
        .in('id', 
          supabase
            .from('recipe_tags')
            .select('recipe_id')
            .in('tag_id', tags)
        );
    }

    // Apply sorting
    if (query.trim() && sortBy === 'relevance') {
      // PostgreSQL will automatically sort by relevance for text search
    } else {
      const sortField = sortBy === 'relevance' ? 'name' : sortBy;
      supabaseQuery = supabaseQuery.order(sortField, { ascending: sortOrder === 'asc' });
    }

    supabaseQuery = supabaseQuery.limit(limit);

    const { data, error, count } = await supabaseQuery;

    if (error) throw error;

    const recipes = (data || []).map((dbRecipe: Database['public']['Tables']['recipes']['Row'] & {
      recipe_items: Array<{
        quantity: number | null;
        unit: string | null;
        item_id: number;
        created_at: string;
        updated_at: string;
      }>;
      recipe_tags: Array<{
        tag_id: number;
        tags: Database['public']['Tables']['tags']['Row'];
      }>;
    }) => {
      const ingredients = dbRecipe.recipe_items?.map((ri) => ({
        item_id: ri.item_id,
        quantity: Number(ri.quantity) || 0,
        unit: ri.unit || '',
        created_at: ri.created_at,
        updated_at: ri.updated_at,
      })) || [];
      
      const recipeTags = dbRecipe.recipe_tags?.map((rt) => 
        dbTagToTag(rt.tags)
      ) || [];
      
      return dbRecipeToRecipe(dbRecipe, ingredients, recipeTags);
    });
    
    return {
      items: recipes,
      total: count || 0,
      hasMore: (count || 0) > recipes.length
    };
  } catch (error) {
    logger.error('Search recipes error:', error);
    throw error;
  }
}

/**
 * Enhanced search utility for tags
 */
export async function searchTags(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult<Tag>> {
  const {
    limit = 50,
    sortBy = 'relevance',
    sortOrder = 'desc'
  } = options;

  try {
    let supabaseQuery = supabase
      .from('tags')
      .select('*', { count: 'exact' });

    if (query.trim()) {
      // Use full-text search for non-empty queries
      const searchQuery = query
        .split(' ')
        .map(term => term.trim())
        .filter(term => term.length > 0)
        .join(' & ');

      supabaseQuery = supabaseQuery
        .textSearch('search_vector', searchQuery, {
          type: 'websearch',
          config: 'english'
        });
    }

    // Apply sorting
    if (query.trim() && sortBy === 'relevance') {
      // PostgreSQL will automatically sort by relevance for text search
    } else {
      const sortField = sortBy === 'relevance' ? 'name' : sortBy;
      supabaseQuery = supabaseQuery.order(sortField, { ascending: sortOrder === 'asc' });
    }

    supabaseQuery = supabaseQuery.limit(limit);

    const { data, error, count } = await supabaseQuery;

    if (error) throw error;

    const tags = (data || []).map(dbTagToTag);
    
    return {
      items: tags,
      total: count || 0,
      hasMore: (count || 0) > tags.length
    };
  } catch (error) {
    logger.error('Search tags error:', error);
    throw error;
  }
}

/**
 * Search meal logs by recipe names or meal names
 */
export async function searchMealLogs(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult<MealLog>> {
  const {
    limit = 50,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = options;

  try {
    const trimmed = query.trim();

    // Base query builder - no user_id filtering, RLS handles authentication
    const base = supabase
      .from('meal_logs')
      .select('*', { count: 'exact' })
      .order('eaten_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    let items: MealLog[] = [];
    let total = 0;

    if (!trimmed) {
      // No query: just return latest
      const { data, error, count } = await base;
      if (error) throw error;
      items = (data || []).map(dbMealLogToMealLog);
      total = count || items.length;
    } else {
      // 1) Try Full-Text Search (FTS) via search_vector
      const ftsQuery = base.textSearch('search_vector', trimmed, { type: 'websearch', config: 'english' });

      const { data: ftsDataRaw, error: ftsError, count: ftsCount } = await ftsQuery;
      let ftsData = ftsDataRaw;

      if (ftsError) {
        // If FTS errors (e.g., column missing), fall back to trigram/ILIKE
        ftsData = null;
      }

      if (ftsData && ftsData.length > 0) {
        items = ftsData.map(dbMealLogToMealLog);
        total = ftsCount || items.length;
      } else {
        // 2) Fallback: substring match (trigram-backed) on meal_name and notes
        const like = `%${trimmed}%`;
        const likeQuery = base.or(`meal_name.ilike.${like},notes.ilike.${like}`);

        const { data: likeData, error: likeError, count: likeCount } = await likeQuery;
        if (likeError) throw likeError;
        items = (likeData || []).map(dbMealLogToMealLog);
        total = likeCount || items.length;
      }
    }

    // Apply client-side sorting if explicitly requested by non-default fields
    if (sortBy && sortBy !== 'created_at') {
      const ascending = sortOrder === 'asc';
      if (sortBy === 'meal_name') {
        items.sort((a, b) => a.meal_name.localeCompare(b.meal_name) * (ascending ? 1 : -1));
      } else if (sortBy === 'eaten_on') {
        items.sort((a, b) => ((a.eaten_on > b.eaten_on ? 1 : a.eaten_on < b.eaten_on ? -1 : 0) * (ascending ? 1 : -1)));
      }
      // Other sort fields are not applicable for MealLog; rely on DB ordering
    }

    return { items, total, hasMore: total > items.length };
  } catch (error) {
    logger.error('Search meal logs error:', error);
    throw error;
  }
}

/**
 * Global search across all entities
 */
export async function globalSearch(
  query: string,
  options: Partial<SearchOptions> = {}
): Promise<GlobalSearchResult> {
  if (!query.trim()) {
    return {
      items: [],
      recipes: [],
      tags: [],
      mealLogs: [],
      total: 0
    };
  }

  try {
    const searchOptions = { ...options, limit: options.limit || 10 };

    // Perform searches in parallel
    const [itemsResult, recipesResult, tagsResult, mealLogsResult] = await Promise.all([
      searchItems(query, searchOptions),
      searchRecipes(query, searchOptions),
      searchTags(query, searchOptions),
      searchMealLogs(query, searchOptions),
    ]);

    return {
      items: itemsResult.items,
      recipes: recipesResult.items,
      tags: tagsResult.items,
      mealLogs: mealLogsResult.items,
      total: itemsResult.total + recipesResult.total + tagsResult.total + mealLogsResult.total
    };
  } catch (error) {
    logger.error('Global search error:', error);
    throw error;
  }
}

/**
 * Search suggestions based on query
 */
export async function getSearchSuggestions(
  query: string,
  type?: 'items' | 'recipes' | 'tags'
): Promise<string[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  try {
    const suggestions: Set<string> = new Set();

    if (!type || type === 'items') {
      const { data: items } = await supabase
        .from('items')
        .select('name, brand, category')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(5);

      items?.forEach(item => {
        if (item.name?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(item.name);
        }
        if (item.brand?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(item.brand);
        }
        if (item.category?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(item.category);
        }
      });
    }

    if (!type || type === 'recipes') {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('name, cuisine_type')
        .or(`name.ilike.%${query}%,cuisine_type.ilike.%${query}%`)
        .limit(5);

      recipes?.forEach(recipe => {
        if (recipe.name?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(recipe.name);
        }
        if (recipe.cuisine_type?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(recipe.cuisine_type);
        }
      });
    }

    if (!type || type === 'tags') {
      const { data: tags } = await supabase
        .from('tags')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(5);

      tags?.forEach(tag => {
        if (tag.name?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(tag.name);
        }
      });
    }

    return Array.from(suggestions).slice(0, 8);
  } catch (error) {
    logger.error('Get search suggestions error:', error);
    return [];
  }
}

/**
 * Debounce utility for search input
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
