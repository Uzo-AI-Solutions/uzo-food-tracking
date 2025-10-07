import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { addUserIdToInsert } from '../lib/auth-helpers';
import { MealLog, DbMealLog } from '../types';
import { dbMealLogToMealLog, mealLogToDbInsert } from '../lib/type-mappers';
import { mockMealLogs } from '../data/mockData';
import { getTodayLocalDate } from '../lib/utils';
import { processMealLogWithAI, processBatchMealLogsWithAI } from '../lib/mealLogAI';
import { logger } from '../lib/logger';

export function useMealLogs() {
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    loadMealLogs();
  }, []);

  const loadMealLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.log('🔄 Attempting to load meal logs from Supabase...');

      // Try to connect to Supabase first
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('⚠️ Supabase connection failed, falling back to mock data:', error.message);
        // Fall back to mock data
        setMealLogs(mockMealLogs);
        setUsingMockData(true);
        logger.log('✅ Loaded mock data:', mockMealLogs.length, 'meal logs');
        return;
      }

      // Successfully connected to Supabase
      logger.log('✅ Connected to Supabase successfully');

      if (data && data.length > 0) {
        logger.log('✅ Loaded data from Supabase:', data.length, 'meal logs');
        const mappedMealLogs = data.map(dbMealLogToMealLog);
        setMealLogs(mappedMealLogs);
        setUsingMockData(false);
      } else {
        // Database is connected but empty - this is a valid state
        logger.log('ℹ️ Database is connected but empty');
        setMealLogs([]);
        setUsingMockData(false);
      }
    } catch (err) {
      logger.warn('⚠️ Error loading meal logs, falling back to mock data:', err);
      // Fall back to mock data on any error
      setMealLogs(mockMealLogs);
      setUsingMockData(true);
      setError(err instanceof Error ? err.message : 'Failed to load meal logs');
    } finally {
      setLoading(false);
    }
  };


  const addMealLog = async (mealLog: Omit<MealLog, 'id'>) => {
    try {
      const dbMealLog = await addUserIdToInsert(mealLogToDbInsert(mealLog));

      const { data, error } = await supabase
        .from('meal_logs')
        .insert([dbMealLog])
        .select()
        .single();

      if (error) throw error;

      const newMealLog = dbMealLogToMealLog(data as DbMealLog);
      setMealLogs(prev => [newMealLog, ...prev]);
      return newMealLog;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add meal log');
      throw err;
    }
  };

  const updateMealLog = async (id: number, updatedData: Omit<MealLog, 'id'>) => {
    try {
      const dbMealLog = mealLogToDbInsert(updatedData);
      
      const { error } = await supabase
        .from('meal_logs')
        .update(dbMealLog)
        .eq('id', id);
      
      if (error) throw error;
      
      setMealLogs(prev => prev.map(log => 
        log.id === id ? { ...updatedData, id } : log
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meal log');
      throw err;
    }
  };

  const deleteMealLog = async (id: number) => {
    try {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setMealLogs(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal log');
      throw err;
    }
  };

  const getMealLogsByDateRange = (startDate: string, endDate: string) => {
    return mealLogs.filter(log => {
      return log.eaten_on >= startDate && log.eaten_on <= endDate;
    });
  };

  const getRecentMealLogs = (days: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    return mealLogs.filter(log => {
      return log.eaten_on >= cutoffDateString;
    });
  };

  const reLogMeal = async (mealLog: MealLog, multiplier: number = 1, notes?: string, eatenOn?: string) => {
    try {
      // Create a copy of the meal log with adjusted macros and date
      const adjustedMacros = mealLog.macros ? {
        calories: mealLog.macros.calories * multiplier,
        protein: mealLog.macros.protein * multiplier,
        carbs: mealLog.macros.carbs * multiplier,
        fat: mealLog.macros.fat * multiplier,
      } : undefined;

      const newMealLog: Omit<MealLog, 'id'> = {
        items: mealLog.items,
        meal_name: multiplier !== 1 ? `${mealLog.meal_name} (${multiplier}x)` : mealLog.meal_name,
        notes: notes || mealLog.notes,
        rating: mealLog.rating,
        macros: adjustedMacros,
        eaten_on: eatenOn || getTodayLocalDate(),
        created_at: new Date().toISOString(),
      };

      // Use the existing addMealLog function
      const addedMealLog = await addMealLog(newMealLog);
      return addedMealLog;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-log meal');
      throw err;
    }
  };

  const addMealLogFromItems = async (items: string[], notes?: string, rating?: number, eatenOn?: string) => {
    try {
      setError(null);

      // Process the items through AI to get meal name and macros
      logger.log('🤖 Processing items with AI:', items);
      const aiResult = await processMealLogWithAI(items);

      // Create meal log with AI-generated data
      const mealLogData: Omit<MealLog, 'id'> = {
        items,
        meal_name: aiResult.meal_name,
        notes,
        rating,
        macros: aiResult.macros,
        eaten_on: eatenOn || getTodayLocalDate(), // Use provided date or default to today
        created_at: new Date().toISOString(),
      };

      logger.log('📝 Creating meal log:', mealLogData);
      return await addMealLog(mealLogData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process meal with AI';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const addBatchMealLogsFromItems = async (
    mealEntries: Array<{ items: string[]; notes?: string; rating?: number; eatenOn?: string }>
  ) => {
    try {
      setError(null);

      // Process all meal entries through AI
      logger.log('🤖 Processing batch meals with AI:', mealEntries.length, 'meals');
      const aiResults = await processBatchMealLogsWithAI(mealEntries);

      // Create meal logs with AI-generated data
      const mealLogsToAdd: Array<Omit<MealLog, 'id'>> = mealEntries.map((entry, index) => ({
        items: entry.items,
        meal_name: aiResults[index].meal_name,
        notes: entry.notes,
        rating: entry.rating,
        macros: aiResults[index].macros,
        eaten_on: entry.eatenOn || getTodayLocalDate(), // Use provided date or default to today
        created_at: new Date().toISOString(),
      }));

      // Add all meal logs to database
      logger.log('📝 Creating batch meal logs:', mealLogsToAdd.length, 'meals');
      const addedMealLogs: MealLog[] = [];

      for (const mealLogData of mealLogsToAdd) {
        const addedMealLog = await addMealLog(mealLogData);
        addedMealLogs.push(addedMealLog);
      }

      return addedMealLogs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process batch meals with AI';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    mealLogs,
    loading,
    error,
    usingMockData,
    addMealLog,
    addMealLogFromItems,
    addBatchMealLogsFromItems,
    updateMealLog,
    deleteMealLog,
    reLogMeal,
    getMealLogsByDateRange,
    getRecentMealLogs,
    refetch: loadMealLogs,
  };
}
