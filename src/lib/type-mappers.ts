// Type mapping utilities to convert between database and application types
// This ensures consistent data transformations and handles the ID type differences

import type { Database } from '@/types/database';
import type { FoodItem, DbItem, Recipe, DbRecipe, MealLog, DbMealLog, Tag, DbTag } from '@/types';

// Database types from Supabase
type DbItemRow = Database['public']['Tables']['items']['Row'];
type DbRecipeRow = Database['public']['Tables']['recipes']['Row'];
type DbMealLogRow = Database['public']['Tables']['meal_logs']['Row'];
type DbTagRow = Database['public']['Tables']['tags']['Row'];

/**
 * Convert database item row to application FoodItem
 */
export function dbItemToFoodItem(dbItem: DbItemRow): FoodItem {
  return {
    id: dbItem.id,
    name: dbItem.name,
    brand: dbItem.brand || undefined,
    category: dbItem.category || 'Uncategorized',
    in_stock: true, // Default to in stock since in_stock field was removed from schema
    serving_size: undefined, // Serving fields were removed from schema
    serving_quantity: undefined,
    serving_unit: undefined,
    serving_unit_type: undefined,
    image_url: dbItem.image_url || undefined,
    ingredients: dbItem.ingredients || undefined,
    notes: (dbItem.notes as { text: string; date: string }[]) || [],
    nutrition: {
      calories_per_serving: 0, // Nutrition fields were removed from schema
      protein_per_serving: 0,
      carbs_per_serving: 0,
      fat_per_serving: 0,
      fiber_per_serving: 0,
    },
    last_purchased: undefined, // last_purchased field was removed
    rating: dbItem.rating || undefined,
    last_edited: dbItem.last_edited || dbItem.updated_at,
    created_at: dbItem.created_at,
    updated_at: dbItem.updated_at,
  };
}

/**
 * Convert application FoodItem to database item insert/update format
 */
export function foodItemToDbInsert(item: Partial<FoodItem>): Database['public']['Tables']['items']['Insert'] {
  return {
    name: item.name!,
    brand: item.brand || null,
    category: item.category || null,
    image_url: item.image_url || null,
    ingredients: item.ingredients || null,
    rating: item.rating || null,
    notes: item.notes || null,
    // Removed fields: in_stock, price, serving_*, nutrition fields, last_purchased
    // purchase_count and normalized_name are auto-handled by database
  };
}

/**
 * Convert database recipe row to application Recipe
 */
export function dbRecipeToRecipe(
  dbRecipe: DbRecipeRow,
  ingredients: Array<{item_id: number, quantity: number, unit: string}> = []
): Recipe {
  const nutrition = (dbRecipe.nutrition_per_serving as Record<string, number>) || {};

  // Convert tags array to Tag objects with simple structure
  const tags: Tag[] = (dbRecipe.tags || []).map((tagName: string, index: number) => ({
    id: index + 1, // Simple index-based ID for display purposes
    name: tagName,
    color: '#3b82f6', // Default color
    description: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  return {
    id: dbRecipe.id,
    name: dbRecipe.name,
    instructions: dbRecipe.instructions || '',
    servings: dbRecipe.servings || 1,
    total_time_minutes: dbRecipe.total_time || undefined,
    ingredients: [], // No longer using recipe_items table - ingredients stored as text array
    ingredient_list: dbRecipe.ingredient_list || undefined,
    nutrition_source: (dbRecipe.nutrition_source as 'calculated' | 'ai_generated' | 'manual') || 'calculated',
    nutrition: {
      calories_per_serving: nutrition.calories_per_serving || nutrition.calories || 0,
      protein_per_serving: nutrition.protein_per_serving || nutrition.protein || 0,
      carbs_per_serving: nutrition.carbs_per_serving || nutrition.carbs || 0,
      fat_per_serving: nutrition.fat_per_serving || nutrition.fat || 0,
    },
    is_favorite: dbRecipe.is_favorite || false,
    notes: dbRecipe.notes || undefined,
    tags: tags,
    created_at: dbRecipe.created_at || new Date().toISOString(),
    updated_at: dbRecipe.updated_at || new Date().toISOString(),
    ...(dbRecipe.feedback
      ? { feedback: dbRecipe.feedback as NonNullable<DbRecipeRow['feedback']> }
      : {}),
  };
}

/**
 * Convert application Recipe to database recipe insert/update format
 */
export function recipeToDbInsert(recipe: Partial<Recipe>): Database['public']['Tables']['recipes']['Insert'] {
  return {
    name: recipe.name!,
    instructions: recipe.instructions || null,
    servings: recipe.servings || null,
    total_time: recipe.total_time_minutes || null,
    ingredient_list: recipe.ingredient_list || null,
    nutrition_source: recipe.nutrition_source || 'calculated',
    nutrition_per_serving: recipe.nutrition ? {
      calories: recipe.nutrition.calories_per_serving,
      protein: recipe.nutrition.protein_per_serving,
      carbs: recipe.nutrition.carbs_per_serving,
      fat: recipe.nutrition.fat_per_serving,
    } : null,
    is_favorite: recipe.is_favorite || false,
    notes: recipe.notes || null,
    feedback: recipe.feedback || null,
    tags: recipe.tags ? recipe.tags.map(tag => tag.name) : [],
  };
}

/**
 * Convert database meal log row to application MealLog
 */
export function dbMealLogToMealLog(dbMealLog: DbMealLogRow): MealLog {
  const macros = (dbMealLog.macros as Record<string, number>) || {};

  return {
    id: dbMealLog.id,
    items: dbMealLog.items || [],
    meal_name: dbMealLog.meal_name || '',
    notes: dbMealLog.notes || undefined,
    rating: dbMealLog.rating || undefined,
    macros: {
      calories: macros.calories || 0,
      protein: macros.protein || 0,
      carbs: macros.carbs || 0,
      fat: macros.fat || 0,
    },
    eaten_on: dbMealLog.eaten_on || dbMealLog.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    created_at: dbMealLog.created_at || new Date().toISOString(),
  };
}

/**
 * Convert application MealLog to database meal log insert/update format
 */
export function mealLogToDbInsert(mealLog: Partial<MealLog>): Database['public']['Tables']['meal_logs']['Insert'] {
  return {
    items: mealLog.items || [],
    meal_name: mealLog.meal_name!,
    notes: mealLog.notes || null,
    rating: mealLog.rating || null,
    macros: mealLog.macros ? {
      calories: mealLog.macros.calories,
      protein: mealLog.macros.protein,
      carbs: mealLog.macros.carbs,
      fat: mealLog.macros.fat,
    } : null,
    eaten_on: mealLog.eaten_on || new Date().toISOString().split('T')[0], // Default to today if not provided
  };
}

/**
 * Convert database tag row to application Tag
 */
export function dbTagToTag(dbTag: DbTagRow): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color || '#3b82f6',
    description: dbTag.description || undefined,
    created_at: dbTag.created_at || new Date().toISOString(),
    updated_at: dbTag.updated_at || new Date().toISOString(),
  };
}

/**
 * Convert application Tag to database tag insert/update format
 */
export function tagToDbInsert(tag: Partial<Tag>): Database['public']['Tables']['tags']['Insert'] {
  return {
    name: tag.name!,
    color: tag.color || '#3b82f6',
    description: tag.description || null,
  };
}

