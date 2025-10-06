import { FoodItem, DbItem, Recipe, DbRecipe, MealLog, DbMealLog, RecipeIngredient, Tag, DbTag } from '../types';
import { logger } from '@/lib/logger';

// Convert database item to FoodItem format
export function dbItemToFoodItem(dbItem: DbItem): FoodItem {
  return {
    id: dbItem.id, // Now using number directly
    name: dbItem.name,
    brand: dbItem.brand ?? undefined,
    category: dbItem.category ?? 'Other',
    in_stock: dbItem.in_stock ?? true,
    serving_size: dbItem.serving_size_grams ?? 100,
    serving_quantity: dbItem.serving_quantity ?? undefined,
    serving_unit: dbItem.serving_unit ?? undefined,
    serving_unit_type: dbItem.serving_unit_type ?? undefined,
    image_url: dbItem.image_url ?? undefined,
    ingredients: dbItem.ingredients ?? undefined,
    nutrition: {
      calories_per_serving: dbItem.calories_per_serving ?? 
        Math.round(((dbItem.protein_per_serving ?? 0) * 4 + 
                   (dbItem.carbs_per_serving ?? 0) * 4 + 
                   (dbItem.fat_per_serving ?? 0) * 9) * 10) / 10,
      protein_per_serving: dbItem.protein_per_serving ?? 0,
      carbs_per_serving: dbItem.carbs_per_serving ?? 0,
      fat_per_serving: dbItem.fat_per_serving ?? 0,
      fiber_per_serving: 0, // Not in database schema
    },
    last_purchased: dbItem.last_purchased ?? undefined,
    rating: dbItem.rating ?? undefined,
    last_edited: dbItem.last_edited ?? dbItem.updated_at ?? undefined, // Use updated_at as fallback
    created_at: dbItem.created_at ?? undefined,
    updated_at: dbItem.updated_at ?? undefined,
  };
}

// Convert FoodItem to database insert format
export function foodItemToDbInsert(item: Omit<FoodItem, 'id'>): Omit<DbItem, 'id' | 'normalized_name'> {
  const servingSizeGrams = item.serving_size || 100;
  return {
    name: item.name,
    brand: item.brand || null,
    category: item.category,
    in_stock: item.in_stock,
    calories_per_serving: item.nutrition.calories_per_serving,
    carbs_per_serving: item.nutrition.carbs_per_serving,
    fat_per_serving: item.nutrition.fat_per_serving,
    protein_per_serving: item.nutrition.protein_per_serving,
    serving_size_grams: servingSizeGrams,
    serving_quantity: item.serving_quantity || null,
    serving_unit: item.serving_unit || null,
    serving_unit_type: item.serving_unit_type || null,
    image_url: item.image_url || null,
    ingredients: item.ingredients || null,
    nutrition_source: 'manual',
    barcode: null,
    rating: item.rating || null,
    last_edited: item.last_edited,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

// Convert database recipe to Recipe format
export function dbRecipeToRecipe(dbRecipe: DbRecipe, ingredients: RecipeIngredient[] = [], tags: Tag[] = []): Recipe {
  const nutrition = dbRecipe.nutrition_per_serving || {};
  
  return {
    id: dbRecipe.id, // Now using number directly
    name: dbRecipe.name,
    instructions: dbRecipe.instructions || '',
    servings: dbRecipe.servings || 1,
    total_time_minutes: dbRecipe.total_time || undefined,
    ingredients,
    nutrition: {
      // Handle both formats: with and without _per_serving suffix
      calories_per_serving: (nutrition.calories_per_serving as number) || (nutrition.calories as number) || 0,
      protein_per_serving: (nutrition.protein_per_serving as number) || (nutrition.protein as number) || 0,
      carbs_per_serving: (nutrition.carbs_per_serving as number) || (nutrition.carbs as number) || 0,
      fat_per_serving: (nutrition.fat_per_serving as number) || (nutrition.fat as number) || 0,
    },
    is_favorite: dbRecipe.is_favorite || false,
    notes: dbRecipe.notes || undefined,
    tags,
    created_at: dbRecipe.created_at || new Date().toISOString(),
    updated_at: dbRecipe.updated_at || new Date().toISOString(),
    ...(dbRecipe.feedback ? { feedback: dbRecipe.feedback } : {}),
  };
}

// Convert Recipe to database insert format
export function recipeToDbInsert(recipe: Omit<Recipe, 'id'>): Omit<DbRecipe, 'id' | 'created_at' | 'updated_at' | 'times_cooked' | 'average_rating' | 'last_cooked'> {
  return {
    name: recipe.name,
    total_time: recipe.total_time_minutes || null,
    servings: recipe.servings,
    instructions: recipe.instructions,
    nutrition_per_serving: {
      calories: recipe.nutrition.calories_per_serving,
      protein: recipe.nutrition.protein_per_serving,
      carbs: recipe.nutrition.carbs_per_serving,
      fat: recipe.nutrition.fat_per_serving,
    },
    is_favorite: recipe.is_favorite || false,
    source_link: null,
    notes: recipe.notes || null,
    feedback: recipe.feedback || null,
  };
}

// Convert database meal log to MealLog format
export function dbMealLogToMealLog(dbMealLog: DbMealLog): MealLog {
  const macros = dbMealLog.macros || {};
  
  const mealLog = {
    id: dbMealLog.id, // Now using number directly
    recipe_ids: dbMealLog.recipe_ids, // Already numbers
    date: dbMealLog.cooked_at || new Date().toISOString().split('T')[0],
    meal_name: dbMealLog.meal_name || 'Meal',
    notes: dbMealLog.notes || undefined,
    nutrition: {
      calories: (macros.calories as number) || 0,
      protein: (macros.protein as number) || 0,
      carbs: (macros.carbs as number) || 0,
      fat: (macros.fat as number) || 0,
    },
    created_at: dbMealLog.created_at || new Date().toISOString(),
  };
  
  logger.debug('Mapped meal log:', mealLog);
  return mealLog;
}

// Convert MealLog to database insert format
export function mealLogToDbInsert(mealLog: Omit<MealLog, 'id'>): Omit<DbMealLog, 'id' | 'created_at'> {
  // recipe_ids are already numbers in the updated type system
  return {
    recipe_ids: mealLog.recipe_ids,
    meal_name: mealLog.meal_name || null,
    cooked_at: mealLog.date,
    notes: mealLog.notes || null,
    rating: null,
    macros: mealLog.nutrition,
  };
}

// Convert database tag to Tag format
export function dbTagToTag(dbTag: DbTag): Tag {
  return {
    id: dbTag.id, // Now using number directly
    name: dbTag.name,
    color: dbTag.color || '#3b82f6',
    description: dbTag.description || undefined,
    created_at: dbTag.created_at || new Date().toISOString(),
    updated_at: dbTag.updated_at || new Date().toISOString(),
  };
}

// Convert Tag to database insert format
export function tagToDbInsert(tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'>): Omit<DbTag, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: tag.name,
    color: tag.color,
    description: tag.description || null,
  };
}
