import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { addUserIdToInsert } from '../lib/auth-helpers';
import { MealLog, DbMealLog } from '../types';
import { dbMealLogToMealLog, mealLogToDbInsert } from '../lib/type-mappers';
import { mockMealLogs } from '../data/mockData';
import { getTodayLocalDate } from '../lib/utils';
import { processMealLogWithAI, processBatchMealLogsWithAI } from '../lib/mealLogAI';
import { logger } from '@/lib/logger';

interface UseMealLogsByDateOptions {
  startDate: string;
  endDate: string;
  autoLoad?: boolean;
}

export function useMealLogsByDate({ startDate, endDate, autoLoad = true }: UseMealLogsByDateOptions) {
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  const loadMealLogsForDateRange = useCallback(async (customStartDate?: string, customEndDate?: string) => {
    try {
      setLoading(true);
      setError(null);

      const queryStartDate = customStartDate || startDate;
      const queryEndDate = customEndDate || endDate;

      logger.info(`🔄 Loading meal logs from ${queryStartDate} to ${queryEndDate}...`);

      // Query meal logs for the specific date range
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .gte('eaten_on', queryStartDate)
        .lte('eaten_on', queryEndDate)
        .order('eaten_on', { ascending: false })
        .order('created_at', { ascending: false }); // Secondary sort by creation time

      if (error) {
        logger.warn('⚠️ Supabase connection failed, falling back to mock data:', error.message);
        // Filter mock data to the date range
        const filteredMockData = mockMealLogs.filter(log =>
          log.eaten_on >= queryStartDate && log.eaten_on <= queryEndDate
        );
        setMealLogs(filteredMockData);
        setUsingMockData(true);
        logger.info('✅ Loaded filtered mock data:', filteredMockData.length, 'meal logs');
        return;
      }

      // Successfully connected to Supabase
      logger.info('✅ Connected to Supabase successfully');

      if (data) {
        logger.info(`✅ Loaded ${data.length} meal logs for date range ${queryStartDate} to ${queryEndDate}`);
        const mappedMealLogs = data.map(dbMealLogToMealLog);
        setMealLogs(mappedMealLogs);
        setUsingMockData(false);
      } else {
        // Database is connected but no data for this range
        logger.info(`ℹ️ No meal logs found for date range ${queryStartDate} to ${queryEndDate}`);
        setMealLogs([]);
        setUsingMockData(false);
      }
    } catch (err) {
      logger.warn('⚠️ Error loading meal logs, falling back to mock data:', err);
      // Filter mock data to the date range on error
      const filteredMockData = mockMealLogs.filter(log =>
        log.eaten_on >= (customStartDate || startDate) &&
        log.eaten_on <= (customEndDate || endDate)
      );
      setMealLogs(filteredMockData);
      setUsingMockData(true);
      setError(err instanceof Error ? err.message : 'Failed to load meal logs');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (autoLoad) {
      loadMealLogsForDateRange();
    }
  }, [startDate, endDate, autoLoad, loadMealLogsForDateRange]);

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

      // Only add to local state if it falls within the current date range
      if (newMealLog.eaten_on >= startDate && newMealLog.eaten_on <= endDate) {
        setMealLogs(prev => [newMealLog, ...prev]);
      }

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

      const updatedMealLog = { ...updatedData, id };

      // Handle meal log moving in/out of date range
      if (updatedMealLog.eaten_on >= startDate && updatedMealLog.eaten_on <= endDate) {
        // Update if it's in range
        setMealLogs(prev => prev.map(log =>
          log.id === id ? updatedMealLog : log
        ));
      } else {
        // Remove if it moved out of range
        setMealLogs(prev => prev.filter(log => log.id !== id));
      }
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
      logger.info('🤖 Processing items with AI:', items);
      const aiResult = await processMealLogWithAI(items);

      // Create meal log with AI-generated data
      const mealLogData: Omit<MealLog, 'id'> = {
        items,
        meal_name: aiResult.meal_name,
        notes,
        rating,
        macros: aiResult.macros,
        eaten_on: eatenOn || getTodayLocalDate(),
        created_at: new Date().toISOString(),
      };

      logger.info('📝 Creating meal log:', mealLogData);
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
      logger.info('🤖 Processing batch meals with AI:', mealEntries.length, 'meals');
      const aiResults = await processBatchMealLogsWithAI(mealEntries);

      // Create meal logs with AI-generated data
      const mealLogsToAdd: Array<Omit<MealLog, 'id'>> = mealEntries.map((entry, index) => ({
        items: entry.items,
        meal_name: aiResults[index].meal_name,
        notes: entry.notes,
        rating: entry.rating,
        macros: aiResults[index].macros,
        eaten_on: entry.eatenOn || getTodayLocalDate(),
        created_at: new Date().toISOString(),
      }));

      // Add all meal logs to database
      logger.info('📝 Creating batch meal logs:', mealLogsToAdd.length, 'meals');
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

  // Helper function to get meals for a specific date
  const getMealLogsForDate = (date: string) => {
    return mealLogs.filter(log => log.eaten_on === date);
  };

  // Helper function to load a single day
  const loadSingleDay = async (date: string) => {
    await loadMealLogsForDateRange(date, date);
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
    getMealLogsForDate,
    loadSingleDay,
    refetch: loadMealLogsForDateRange,
    dateRange: { startDate, endDate }
  };
}