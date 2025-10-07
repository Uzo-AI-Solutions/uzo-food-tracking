import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addUserIdToInsert } from '../lib/auth-helpers';
import { Tag, DbTag } from '../types';
import { dbTagToTag, tagToDbInsert } from '../lib/type-mappers';
import { logger } from '@/lib/logger';

// Mock data for offline development
const mockTags: Tag[] = [
  { id: 1, name: 'paleo', color: '#8b5cf6', description: 'Paleo diet friendly', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'gluten-free', color: '#f59e0b', description: 'Contains no gluten', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'dairy-free', color: '#10b981', description: 'Contains no dairy products', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'vegetarian', color: '#22c55e', description: 'Suitable for vegetarians', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'vegan', color: '#059669', description: 'Suitable for vegans', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 6, name: 'keto-friendly', color: '#dc2626', description: 'Suitable for ketogenic diet', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 7, name: 'high-protein', color: '#3b82f6', description: 'High in protein content', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 8, name: 'low-carb', color: '#f97316', description: 'Low in carbohydrates', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 9, name: 'meal-prep', color: '#6366f1', description: 'Great for meal preparation', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 10, name: 'quick-meals', color: '#ec4899', description: 'Can be prepared quickly', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 11, name: 'breakfast', color: '#eab308', description: 'Breakfast dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 12, name: 'lunch', color: '#14b8a6', description: 'Lunch dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 13, name: 'dinner', color: '#8b5cf6', description: 'Dinner dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 14, name: 'snack', color: '#f59e0b', description: 'Snack foods', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 15, name: 'dessert', color: '#ec4899', description: 'Dessert dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 16, name: 'sauce', color: '#6b7280', description: 'Sauces and condiments', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 17, name: 'side-dish', color: '#84cc16', description: 'Side dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 18, name: 'main-dish', color: '#dc2626', description: 'Main course dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 19, name: 'protein-rich', color: '#3b82f6', description: 'Rich in protein', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 20, name: 'stir-fry', color: '#f97316', description: 'Stir-fry dishes', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

export function useTags() {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Query to fetch all tags
  const { data: tags, isLoading, error } = useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) {
        logger.error('Error fetching tags:', error);
        throw error;
      }

      return data.map(dbTagToTag);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (newTag: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => {
      const dbTag = await addUserIdToInsert(tagToDbInsert(newTag));
      const { data, error } = await supabase
        .from('tags')
        .insert([dbTag])
        .select()
        .single();

      if (error) throw error;
      return dbTagToTag(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Omit<Tag, 'id' | 'created_at' | 'updated_at'>> }) => {
      const { data, error } = await supabase
        .from('tags')
        .update(tagToDbInsert(updates as Omit<Tag, 'id' | 'created_at' | 'updated_at'>))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return dbTagToTag(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] }); // Invalidate recipes since tags changed
    },
  });

  // Check if using mock data (when Supabase is not connected)
  const usingMockData = !tags && !isLoading && error;

  // Filter tags based on search query
  const filteredTags = (tags || (usingMockData ? mockTags : [])).filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    tags: filteredTags,
    allTags: tags || (usingMockData ? mockTags : []),
    searchQuery,
    setSearchQuery,
    isLoading: isLoading && !usingMockData,
    error: usingMockData ? null : error,
    usingMockData: !!usingMockData,
    addTag: addTagMutation.mutate,
    updateTag: updateTagMutation.mutate,
    deleteTag: deleteTagMutation.mutate,
    isAdding: addTagMutation.isPending,
    isUpdating: updateTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
  };
}

// Hook to get tags for a specific recipe
export function useRecipeTags(recipeId: number) {
  const { data: recipeTags, isLoading, error } = useQuery({
    queryKey: ['recipe-tags', recipeId],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('recipe_tags')
        .select(`
          tag_id,
          tags (*)
        `)
        .eq('recipe_id', recipeId);

      if (error) throw error;

      return data.map(rt => dbTagToTag(rt.tags as DbTag));
    },
    enabled: !!recipeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    tags: recipeTags || [],
    isLoading,
    error,
  };
}

// Hook to manage tags for a recipe
export function useRecipeTagManagement(recipeId: number) {
  const queryClient = useQueryClient();

  // Add tag to recipe mutation
  const addTagToRecipeMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const { data, error } = await supabase
        .from('recipe_tags')
        .insert([{
          recipe_id: recipeId,
          tag_id: tagId,
        }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  // Remove tag from recipe mutation
  const removeTagFromRecipeMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const { error } = await supabase
        .from('recipe_tags')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('tag_id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  // Update recipe tags (replace all tags for a recipe)
  const updateRecipeTagsMutation = useMutation({
    mutationFn: async (tagIds: number[]) => {
      // First, remove all existing tags for this recipe
      await supabase
        .from('recipe_tags')
        .delete()
        .eq('recipe_id', recipeId);

      // Then, add the new tags
      if (tagIds.length > 0) {
        const { error } = await supabase
          .from('recipe_tags')
          .insert(
            tagIds.map(tagId => ({
              recipe_id: recipeId,
              tag_id: tagId,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  return {
    addTagToRecipe: addTagToRecipeMutation.mutate,
    removeTagFromRecipe: removeTagFromRecipeMutation.mutate,
    updateRecipeTags: updateRecipeTagsMutation.mutate,
    isUpdating: addTagToRecipeMutation.isPending || removeTagFromRecipeMutation.isPending || updateRecipeTagsMutation.isPending,
  };
}
