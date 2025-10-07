import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { addUserIdToInsert } from '../lib/auth-helpers';
import { Recipe, RecipeIngredient } from '../types';
import type { Database } from '../types/database';

type DbRecipeWithRelations = Database['public']['Tables']['recipes']['Row'];
import { dbRecipeToRecipe, recipeToDbInsert } from '../lib/type-mappers';
import { searchRecipes } from '../lib/search';
import { mockRecipes } from '../data/mockData';
import { logger } from '../lib/logger';

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.log('🔄 Attempting to load recipes from Supabase...');

      // Try to connect to Supabase first
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('name');

      if (recipesError) {
        logger.warn('⚠️ Supabase connection failed, falling back to mock data:', recipesError.message);
        // Fall back to mock data
        setRecipes(mockRecipes);
        setUsingMockData(true);
        logger.log('✅ Loaded mock data:', mockRecipes.length, 'recipes');
        return;
      }

      if (recipesData && recipesData.length > 0) {
        logger.log('✅ Loaded data from Supabase:', recipesData.length, 'recipes');
        const mappedRecipes = recipesData.map((dbRecipe: DbRecipeWithRelations) => {
          return dbRecipeToRecipe(dbRecipe);
        });
        setRecipes(mappedRecipes);
        setUsingMockData(false);
      } else {
        // Database is empty, use mock data
        logger.log('ℹ️ Database is empty, using mock data');
        setRecipes(mockRecipes);
        setUsingMockData(true);
        logger.log('✅ Loaded mock data:', mockRecipes.length, 'recipes');
      }
    } catch (err) {
      logger.warn('❌ Failed to load from Supabase, using mock data:', err);
      // Fall back to mock data on any error
      setRecipes(mockRecipes);
      setUsingMockData(true);
      setError('Using mock data - database connection unavailable');
      logger.log('✅ Loaded mock data:', mockRecipes.length, 'recipes');
    } finally {
      setLoading(false);
    }
  };

// Enhanced filtering with smart search capabilities - memoized for performance
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      let matchesSearch = true;

      // If we have a search query, use smart search for both mock and real data when backend search isn't used
      if (searchQuery) {
        const query = searchQuery.toLowerCase();

        // Smart search: Check recipe name, instructions, notes
        const nameMatch = recipe.name.toLowerCase().includes(query);
        const instructionsMatch = recipe.instructions?.toLowerCase().includes(query);
        const notesMatch = recipe.notes?.toLowerCase().includes(query);

        // Smart ingredient search - check both ingredient_list (AI recipes) and ingredients (linked items)
        let ingredientMatch = false;

        // Search in ingredient_list (AI-generated recipes)
        if (recipe.ingredient_list && recipe.ingredient_list.length > 0) {
          ingredientMatch = recipe.ingredient_list.some(ingredient =>
            ingredient.toLowerCase().includes(query)
          );
        }

        // Search in ingredients (regular recipes with linked items) - would need ingredient names
        // Note: For now, regular recipes don't have ingredient names readily available in the filter
        // This could be enhanced by including ingredient names in the recipe data structure

        // Search in tags
        const tagMatch = recipe.tags?.some(tag =>
          tag.name.toLowerCase().includes(query)
        );

        matchesSearch = nameMatch || instructionsMatch || notesMatch || ingredientMatch || tagMatch;
      }

      return matchesSearch;
    });
  }, [recipes, searchQuery]);

  const favoriteRecipes = useMemo(() => {
    return filteredRecipes.filter(r => r.is_favorite);
  }, [filteredRecipes]);

  // Enhanced search function for real-time search - prioritize client-side like meal re-log
  const performSearch = useCallback(async (query: string, tagIds: number[] = []) => {
    // Always use client-side smart search for better UX (like meal re-log)
    setSearchQuery(query);

    // If no query, reset to show all recipes
    if (!query.trim()) {
      // Don't reload, just clear the search query to show all recipes
      return;
    }

    // Use client-side smart search for immediate, partial matching
    // Backend search can be added later as an advanced option if needed
  }, []);

const addRecipe = async (recipe: Omit<Recipe, 'id' | 'is_favorite'> & { selectedTagIds?: string[] }) => {
    try {
      const { selectedTagIds, ...recipeWithoutTags } = recipe;

      // Convert selectedTagIds to tag names if provided, otherwise use existing tags
      let tagsToStore: string[] = [];
      if (selectedTagIds && selectedTagIds.length > 0) {
        // For now, treat selectedTagIds as tag names (strings) since we're consolidating
        tagsToStore = selectedTagIds;
      } else if (recipeWithoutTags.tags) {
        tagsToStore = recipeWithoutTags.tags.map(tag => tag.name);
      }

      const dbRecipe = await addUserIdToInsert(recipeToDbInsert({ ...recipeWithoutTags, tags: tagsToStore.map(name => ({ name, id: 0, color: '#3b82f6', created_at: '', updated_at: '' })) }));

      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .insert([dbRecipe])
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Note: recipe_items table has been removed. Ingredients are now stored in ingredient_list text array

      // Reload recipes to get the updated data
      await loadRecipes();
      const newRecipe = recipes.find(r => r.id === recipeData.id) || dbRecipeToRecipe(recipeData);
      return newRecipe;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe');
      throw err;
    }
  };

const updateRecipe = async (id: number, updates: Partial<Recipe> & { selectedTagIds?: string[] }) => {
    logger.debug('🎯 updateRecipe called for ID:', id, 'Updates:', updates);
    try {
      const { selectedTagIds, ...updatesWithoutTags } = updates;
      logger.debug('📝 Updates includes ingredients?', !!updatesWithoutTags.ingredients, 'Ingredient count:', updatesWithoutTags.ingredients?.length);

      // Use the nutrition provided in updates (calculated by AddRecipeDialog)
      const nutritionToSave = updatesWithoutTags.nutrition;

      // Build update object with only provided fields to avoid resetting existing data
      const updateData: Partial<Database['public']['Tables']['recipes']['Update']> = {};

      if (updatesWithoutTags.name !== undefined) updateData.name = updatesWithoutTags.name;
      if (updatesWithoutTags.instructions !== undefined) updateData.instructions = updatesWithoutTags.instructions;
      if (updatesWithoutTags.servings !== undefined) updateData.servings = updatesWithoutTags.servings;
      if (updatesWithoutTags.total_time_minutes !== undefined) updateData.total_time = updatesWithoutTags.total_time_minutes;
      if (nutritionToSave !== undefined) updateData.nutrition_per_serving = nutritionToSave;
      if (updatesWithoutTags.ingredient_list !== undefined) updateData.ingredient_list = updatesWithoutTags.ingredient_list;
      if (updatesWithoutTags.nutrition_source !== undefined) updateData.nutrition_source = updatesWithoutTags.nutrition_source;
      if (updatesWithoutTags.is_favorite !== undefined) updateData.is_favorite = updatesWithoutTags.is_favorite;
      if (updatesWithoutTags.notes !== undefined) updateData.notes = updatesWithoutTags.notes;
      if (updatesWithoutTags.feedback !== undefined) updateData.feedback = updatesWithoutTags.feedback as unknown as Record<string, unknown>[];

      // Handle tags update
      if (selectedTagIds !== undefined) {
        // Convert selectedTagIds to tag names (treating them as strings)
        updateData.tags = selectedTagIds;
      } else if (updatesWithoutTags.tags !== undefined) {
        // Convert tag objects to tag name strings
        updateData.tags = updatesWithoutTags.tags.map(tag => tag.name);
      }

      // Update recipe
      const { error: recipeError } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', id);

      if (recipeError) throw recipeError;

      // Note: recipe_items table has been removed. Ingredients are now stored in ingredient_list text array
      // Ingredients update is handled above in updateData.ingredient_list

      // Reload recipes to get the updated data
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
      throw err;
    }
  };

  const toggleFavorite = async (id: number) => {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
      await updateRecipe(id, { is_favorite: !recipe.is_favorite });
    }
  };

  const deleteRecipe = async (id: number) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setRecipes(prev => prev.filter(recipe => recipe.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
      throw err;
    }
  };

  const getRecipeById = (id: number) => {
    return recipes.find(recipe => recipe.id === id);
  };

  return {
    recipes: filteredRecipes,
    favorites: favoriteRecipes,
    allRecipes: recipes,
    loading,
    error,
    usingMockData,
    searchQuery,
    setSearchQuery,
    performSearch,
    addRecipe,
    updateRecipe,
    toggleFavorite,
    deleteRecipe,
    getRecipeById,
    refetch: loadRecipes,
  };
}
