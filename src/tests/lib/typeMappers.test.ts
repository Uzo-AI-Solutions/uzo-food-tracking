import { describe, it, expect } from 'vitest';
import { dbItemToFoodItem, foodItemToDbInsert, dbRecipeToRecipe, recipeToDbInsert, dbMealLogToMealLog, mealLogToDbInsert, dbTagToTag, tagToDbInsert } from '../../lib/typeMappers';
import { FoodItem, Recipe, MealLog, Tag } from '../../types';

describe('typeMappers', () => {
  describe('dbItemToFoodItem', () => {
    it('should convert database item to FoodItem format', () => {
      const dbItem = {
        id: 1,
        name: 'Apple',
        brand: 'Organic Brand',
        category: 'Fruit',
        in_stock: true,
        calories_per_serving: 95,
        carbs_per_serving: 25,
        fat_per_serving: 0.3,
        protein_per_serving: 0.5,
        serving_size_grams: 100,
        serving_quantity: null,
        serving_unit: null,
        serving_unit_type: null,
        image_url: 'https://example.com/apple.jpg',
        ingredients: null,
        nutrition_source: 'manual',
        barcode: null,
        last_purchased: null,
        purchase_count: null,
        rating: null,
        last_edited: '2025-01-01T00:00:00Z',
        normalized_name: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = dbItemToFoodItem(dbItem);

      expect(result).toEqual({
        id: 1,
        name: 'Apple',
        brand: 'Organic Brand',
        category: 'Fruit',
        in_stock: true,
        serving_size: 100,
        serving_quantity: undefined,
        serving_unit: undefined,
        serving_unit_type: undefined,
        image_url: 'https://example.com/apple.jpg',
        ingredients: undefined,
        nutrition: {
          calories_per_serving: 95,
          protein_per_serving: 0.5,
          carbs_per_serving: 25,
          fat_per_serving: 0.3,
          fiber_per_serving: 0,
        },
        last_purchased: undefined,
        rating: undefined,
        last_edited: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
    });

    it('should handle null database values gracefully', () => {
      const dbItem = {
        id: 2,
        name: 'Test Item',
        brand: null,
        category: null,
        in_stock: null,
        calories_per_serving: null,
        carbs_per_serving: null,
        fat_per_serving: null,
        protein_per_serving: null,
        serving_size_grams: null,
        serving_quantity: null,
        serving_unit: null,
        serving_unit_type: null,
        image_url: null,
        ingredients: null,
        nutrition_source: null,
        barcode: null,
        last_purchased: null,
        purchase_count: null,
        rating: null,
        last_edited: null,
        normalized_name: null,
        created_at: null,
        updated_at: null,
      };

      const result = dbItemToFoodItem(dbItem);

      expect(result).toEqual({
        id: 2,
        name: 'Test Item',
        brand: undefined,
        category: 'Other',
        in_stock: true,
        serving_size: 100,
        serving_quantity: undefined,
        serving_unit: undefined,
        serving_unit_type: undefined,
        image_url: undefined,
        ingredients: undefined,
        nutrition: {
          calories_per_serving: 0,
          protein_per_serving: 0,
          carbs_per_serving: 0,
          fat_per_serving: 0,
          fiber_per_serving: 0,
        },
        last_purchased: undefined,
        rating: undefined,
        last_edited: undefined,
        created_at: undefined,
        updated_at: undefined,
      });
    });
  });

  describe('foodItemToDbInsert', () => {
    it('should convert FoodItem to database insert format', () => {
      const foodItem: Omit<FoodItem, 'id'> = {
        name: 'Apple',
        brand: 'Organic Brand',
        category: 'Fruit',
        in_stock: true,
        serving_size: 100,
        image_url: 'https://example.com/apple.jpg',
        nutrition: {
          calories_per_serving: 95,
          protein_per_serving: 0.5,
          carbs_per_serving: 25,
          fat_per_serving: 0.3,
          fiber_per_serving: 0,
        },
        last_edited: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = foodItemToDbInsert(foodItem);

      expect(result).toEqual({
        name: 'Apple',
        brand: 'Organic Brand',
        category: 'Fruit',
        in_stock: true,
        calories_per_serving: 95,
        carbs_per_serving: 25,
        fat_per_serving: 0.3,
        protein_per_serving: 0.5,
        serving_size_grams: 100,
        serving_quantity: null,
        serving_unit: null,
        serving_unit_type: null,
        image_url: 'https://example.com/apple.jpg',
        ingredients: null,
        nutrition_source: 'manual',
        barcode: null,
        rating: null,
        last_edited: '2025-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('dbRecipeToRecipe', () => {
    it('should convert database recipe to Recipe format', () => {
      const dbRecipe = {
        id: 1,
        name: 'Apple Pie',
        total_time: 75,
        servings: 8,
        instructions: 'Mix ingredients and bake',
        nutrition_per_serving: {
          calories: 250,
          protein: 3,
          carbs: 35,
          fat: 12,
        },
        ingredient_list: null,
        nutrition_source: 'manual',
        is_favorite: false,
        source_link: null,
        notes: 'Great for holidays',
        times_cooked: null,
        last_cooked: null,
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const ingredients = [
        { item_id: 1, quantity: 6, unit: 'pieces', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { item_id: 2, quantity: 2, unit: 'cups', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ];

      const result = dbRecipeToRecipe(dbRecipe, ingredients);

      expect(result).toEqual({
        id: 1,
        name: 'Apple Pie',
        instructions: 'Mix ingredients and bake',
        servings: 8,
        total_time_minutes: 75,
        ingredients,
        nutrition: {
          calories_per_serving: 250,
          protein_per_serving: 3,
          carbs_per_serving: 35,
          fat_per_serving: 12,
        },
        is_favorite: false,
        notes: 'Great for holidays',
        tags: [],
        created_at: '2024-12-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('recipeToDbInsert', () => {
    it('should convert Recipe to database insert format', () => {
      const recipe: Omit<Recipe, 'id'> = {
        name: 'Apple Pie',
        instructions: 'Mix ingredients and bake',
        servings: 8,
        total_time_minutes: 30,
        ingredients: [],
        nutrition: {
          calories_per_serving: 250,
          protein_per_serving: 3,
          carbs_per_serving: 35,
          fat_per_serving: 12,
        },
        is_favorite: true,
        notes: undefined,
        tags: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = recipeToDbInsert(recipe);

      expect(result).toEqual({
        name: 'Apple Pie',
        total_time: 30,
        servings: 8,
        instructions: 'Mix ingredients and bake',
        nutrition_per_serving: {
          calories: 250,
          protein: 3,
          carbs: 35,
          fat: 12,
        },
        is_favorite: true,
        source_link: null,
        notes: null,
        feedback: null,
      });
    });

    it('should handle non-favorite recipes', () => {
      const recipe: Omit<Recipe, 'id'> = {
        name: 'Simple Recipe',
        instructions: 'Basic instructions',
        servings: 4,
        total_time_minutes: undefined,
        ingredients: [],
        nutrition: {
          calories_per_serving: 100,
          protein_per_serving: 5,
          carbs_per_serving: 15,
          fat_per_serving: 2,
        },
        is_favorite: false,
        notes: undefined,
        tags: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = recipeToDbInsert(recipe);

      expect(result.is_favorite).toBe(false);
      expect(result.total_time).toBe(null);
    });
  });

  describe('dbMealLogToMealLog', () => {
    it('should convert database meal log to MealLog format', () => {
      const dbMealLog = {
        id: 1,
        recipe_ids: [1, 2],
        meal_name: 'Lunch',
        cooked_at: '2025-01-15',
        notes: 'Delicious meal',
        rating: 5,
        macros: {
          calories: 500,
          protein: 25,
          carbs: 60,
          fat: 20,
        },
        cost: 12.50,
        created_at: '2025-01-15T12:00:00Z',
      };

      const result = dbMealLogToMealLog(dbMealLog);

      expect(result).toEqual({
        id: 1,
        recipe_ids: [1, 2],
        date: '2025-01-15',
        meal_name: 'Lunch',
        notes: 'Delicious meal',
        nutrition: {
          calories: 500,
          protein: 25,
          carbs: 60,
          fat: 20,
        },
        created_at: '2025-01-15T12:00:00Z',
      });
    });
  });

  describe('mealLogToDbInsert', () => {
    it('should convert MealLog to database insert format', () => {
      const mealLog: Omit<MealLog, 'id'> = {
        recipe_ids: [1, 2],
        date: '2025-01-15',
        meal_name: 'Lunch',
        notes: 'Delicious meal',
        nutrition: {
          calories: 500,
          protein: 25,
          carbs: 60,
          fat: 20,
        },
        created_at: '2025-01-15T12:00:00Z',
      };

      const result = mealLogToDbInsert(mealLog);

      expect(result).toEqual({
        recipe_ids: [1, 2],
        meal_name: 'Lunch',
        cooked_at: '2025-01-15',
        notes: 'Delicious meal',
        rating: null,
        macros: {
          calories: 500,
          protein: 25,
          carbs: 60,
          fat: 20,
        },
      });
    });
  });

  describe('dbTagToTag', () => {
    it('should convert database tag to Tag format', () => {
      const dbTag = {
        id: 1,
        name: 'Vegetarian',
        color: '#4ade80',
        description: 'Vegetarian-friendly recipes',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = dbTagToTag(dbTag);

      expect(result).toEqual({
        id: 1,
        name: 'Vegetarian',
        color: '#4ade80',
        description: 'Vegetarian-friendly recipes',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
    });

    it('should handle null values gracefully', () => {
      const dbTag = {
        id: 2,
        name: 'Quick',
        color: null,
        description: null,
        created_at: null,
        updated_at: null,
      };

      const result = dbTagToTag(dbTag);

      expect(result).toEqual({
        id: 2,
        name: 'Quick',
        color: '#3b82f6',
        description: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });
  });

  describe('tagToDbInsert', () => {
    it('should convert Tag to database insert format', () => {
      const tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Vegetarian',
        color: '#4ade80',
        description: 'Vegetarian-friendly recipes',
      };

      const result = tagToDbInsert(tag);

      expect(result).toEqual({
        name: 'Vegetarian',
        color: '#4ade80',
        description: 'Vegetarian-friendly recipes',
      });
    });

    it('should handle undefined description', () => {
      const tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Quick',
        color: '#3b82f6',
        description: undefined,
      };

      const result = tagToDbInsert(tag);

      expect(result).toEqual({
        name: 'Quick',
        color: '#3b82f6',
        description: null,
      });
    });
  });
});
