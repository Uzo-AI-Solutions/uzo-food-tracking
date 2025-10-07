import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Target, Calendar, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatAppDateForDisplay, parseAppDate, formatDateToIsoString } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface AnalyticsData {
  daily_averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    days_count: number;
  };
  weekly_averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    weeks_count: number;
  };
  monthly_averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    months_count: number;
  };
  calorie_extremes: {
    highest: { date: string; calories: number } | null;
    lowest: { date: string; calories: number } | null;
  };
  summary: {
    total_meals: number;
    days_with_data: number;
  };
}

interface DailyCache {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_count: number;
}

interface WeeklyCache {
  week_start: string;
  avg_calories: number;
  avg_protein: number;
  avg_carbs: number;
  avg_fat: number;
  days_with_data: number;
}

interface MonthlyCache {
  month_start: string;
  avg_calories: number;
  avg_protein: number;
  avg_carbs: number;
  avg_fat: number;
  days_with_data: number;
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentDays, setRecentDays] = useState<DailyCache[]>([]);
  const [recentWeeks, setRecentWeeks] = useState<WeeklyCache[]>([]);
  const [recentMonths, setRecentMonths] = useState<MonthlyCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 30 | 60 | 90>(30);

  // Helper function to build cache queries with optional date filtering
  const buildCacheQuery = useCallback((tableName: string, orderField: string) => {
    // No user_id filtering needed - all data is shared across users
    let query = supabase.from(tableName).select('*');

    if (selectedPeriod !== 'all') {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (selectedPeriod - 1));
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      if (tableName === 'daily_analytics_cache') {
        query = query.gte('date', cutoffDateStr);
      } else if (tableName === 'weekly_analytics_cache') {
        query = query.gte('week_start', cutoffDateStr);
      } else if (tableName === 'monthly_analytics_cache') {
        query = query.gte('month_start', cutoffDateStr);
      }
    }

    return query.order(orderField, { ascending: false }).limit(
      tableName === 'daily_analytics_cache' ? 7 :
      tableName === 'weekly_analytics_cache' ? 4 : 2
    );
  }, [selectedPeriod]);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('🔄 Loading analytics data from cache system...');

      // RPC function now aggregates all data, no user_id filtering needed
      const rpcParams = selectedPeriod !== 'all'
        ? { p_days_back: selectedPeriod }
        : {};

      // Load all data in parallel
      const [
        analyticsResult,
        recentDaysResult,
        recentWeeksResult,
        recentMonthsResult
      ] = await Promise.all([
        // Get aggregated analytics from RPC
        supabase.rpc('get_analytics_data', rpcParams),

        // Get recent days from cache table
        buildCacheQuery('daily_analytics_cache', 'date'),

        // Get recent weeks from cache table
        buildCacheQuery('weekly_analytics_cache', 'week_start'),

        // Get recent months from cache table
        buildCacheQuery('monthly_analytics_cache', 'month_start')
      ]);

      // Check for errors
      if (analyticsResult.error) {
        throw new Error(`Analytics RPC error: ${analyticsResult.error.message}`);
      }
      if (recentDaysResult.error) {
        throw new Error(`Recent days error: ${recentDaysResult.error.message}`);
      }
      if (recentWeeksResult.error) {
        throw new Error(`Recent weeks error: ${recentWeeksResult.error.message}`);
      }
      if (recentMonthsResult.error) {
        throw new Error(`Recent months error: ${recentMonthsResult.error.message}`);
      }

      logger.info('✅ Analytics data loaded successfully');
      logger.debug('📊 Analytics summary:', analyticsResult.data);
      logger.debug('📅 Recent days:', recentDaysResult.data?.length);
      logger.debug('📅 Recent weeks:', recentWeeksResult.data?.length);
      logger.debug('📅 Recent months:', recentMonthsResult.data?.length);

      setAnalytics(analyticsResult.data);
      setRecentDays(recentDaysResult.data || []);
      setRecentWeeks(recentWeeksResult.data || []);
      setRecentMonths(recentMonthsResult.data || []);
      setUsingMockData(false);

    } catch (error) {
      logger.error('❌ Error loading analytics:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      // TODO: Could fallback to mock data here if needed
      setUsingMockData(false);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, buildCacheQuery]);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod, loadAnalyticsData]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return formatAppDateForDisplay(dateString, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format week period for display
  const formatWeekPeriod = (weekStart: string) => {
    const start = formatAppDateForDisplay(weekStart, {
      month: 'short',
      day: 'numeric'
    });
    const endDate = parseAppDate(weekStart);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const end = formatAppDateForDisplay(formatDateToIsoString(endDate), {
      month: 'short',
      day: 'numeric'
    });

    return `${start} - ${end}`;
  };

  // Format month period for display
  const formatMonthPeriod = (monthStart: string) => {
    return formatAppDateForDisplay(monthStart, { month: 'long', year: 'numeric' });
  };

  // Get period label for display
  const getPeriodLabel = () => {
    if (selectedPeriod === 'all') return 'All Time';
    return `Last ${selectedPeriod} Days`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Your food tracking insights</p>
        </div>

        {/* Period Filter Buttons */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Time Period</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 30 as const, label: '30 Days' },
              { value: 60 as const, label: '60 Days' },
              { value: 90 as const, label: '90 Days' },
              { value: 'all' as const, label: 'All Time' }
            ].map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
                className="min-w-[80px]"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading analytics data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !usingMockData && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">Error loading analytics data: {error}</p>
            <Button
              onClick={loadAnalyticsData}
              className="mt-2"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Mock Data Indicator */}
        {usingMockData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              <p className="text-sm text-amber-800">
                <strong>Demo Mode:</strong> Showing sample analytics with realistic data.
                Connect to Supabase to see your real food tracking insights and history.
              </p>
            </div>
          </div>
        )}

        {/* Content when not loading */}
        {!loading && analytics && (
          <>
            {/* Daily Nutrition Averages */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Averages ({analytics.daily_averages.days_count} days) - {getPeriodLabel()}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{analytics.daily_averages.calories}</div>
                  <div className="text-sm text-muted-foreground">Avg Calories/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{analytics.daily_averages.protein}g</div>
                  <div className="text-sm text-muted-foreground">Avg Protein/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{analytics.daily_averages.carbs}g</div>
                  <div className="text-sm text-muted-foreground">Avg Carbs/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{analytics.daily_averages.fat}g</div>
                  <div className="text-sm text-muted-foreground">Avg Fat/Day</div>
                </Card>
              </div>

              {/* Recent days breakdown */}
              {recentDays.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent 7 Days</h3>
                  <div className="space-y-2">
                    {recentDays.map((day) => (
                      <Card key={day.date} className="p-3">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium">{formatDate(day.date)}</div>
                          <div className="text-sm text-muted-foreground">{day.meals_count} meals</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{Math.round(day.calories)}</div>
                            <div className="text-muted-foreground">cal</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{Math.round(day.protein)}g</div>
                            <div className="text-muted-foreground">protein</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">{Math.round(day.carbs)}g</div>
                            <div className="text-muted-foreground">carbs</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-purple-600">{Math.round(day.fat)}g</div>
                            <div className="text-muted-foreground">fat</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Nutrition Averages */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Averages ({analytics.weekly_averages.weeks_count} weeks) - {getPeriodLabel()}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{analytics.weekly_averages.calories}</div>
                  <div className="text-sm text-muted-foreground">Avg Calories/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{analytics.weekly_averages.protein}g</div>
                  <div className="text-sm text-muted-foreground">Avg Protein/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{analytics.weekly_averages.carbs}g</div>
                  <div className="text-sm text-muted-foreground">Avg Carbs/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{analytics.weekly_averages.fat}g</div>
                  <div className="text-sm text-muted-foreground">Avg Fat/Day</div>
                </Card>
              </div>

              {/* Recent weeks breakdown */}
              {recentWeeks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent 4 Weeks</h3>
                  <div className="space-y-2">
                    {recentWeeks.map((week) => (
                      <Card key={week.week_start} className="p-3">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium">{formatWeekPeriod(week.week_start)}</div>
                          <div className="text-sm text-muted-foreground">{week.days_with_data} days</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{Math.round(week.avg_calories)}</div>
                            <div className="text-muted-foreground">cal</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{Math.round(week.avg_protein)}g</div>
                            <div className="text-muted-foreground">protein</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">{Math.round(week.avg_carbs)}g</div>
                            <div className="text-muted-foreground">carbs</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-purple-600">{Math.round(week.avg_fat)}g</div>
                            <div className="text-muted-foreground">fat</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Monthly Nutrition Averages */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Monthly Averages ({analytics.monthly_averages.months_count} months) - {getPeriodLabel()}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{analytics.monthly_averages.calories}</div>
                  <div className="text-sm text-muted-foreground">Avg Calories/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{analytics.monthly_averages.protein}g</div>
                  <div className="text-sm text-muted-foreground">Avg Protein/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{analytics.monthly_averages.carbs}g</div>
                  <div className="text-sm text-muted-foreground">Avg Carbs/Day</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{analytics.monthly_averages.fat}g</div>
                  <div className="text-sm text-muted-foreground">Avg Fat/Day</div>
                </Card>
              </div>

              {/* Recent months breakdown */}
              {recentMonths.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent 2 Months</h3>
                  <div className="space-y-2">
                    {recentMonths.map((month) => (
                      <Card key={month.month_start} className="p-3">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium">{formatMonthPeriod(month.month_start)}</div>
                          <div className="text-sm text-muted-foreground">{month.days_with_data} days</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{Math.round(month.avg_calories)}</div>
                            <div className="text-muted-foreground">cal</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{Math.round(month.avg_protein)}g</div>
                            <div className="text-muted-foreground">protein</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">{Math.round(month.avg_carbs)}g</div>
                            <div className="text-muted-foreground">carbs</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-purple-600">{Math.round(month.avg_fat)}g</div>
                            <div className="text-muted-foreground">fat</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calorie Extremes */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Award className="h-5 w-5" />
                Calorie Records
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.calorie_extremes.highest && (
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-full">
                        <ArrowUp className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-bold text-red-600">
                          {analytics.calorie_extremes.highest.calories} calories
                        </div>
                        <div className="text-sm text-muted-foreground">Highest Day</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(analytics.calorie_extremes.highest.date)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {analytics.calorie_extremes.lowest && (
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <ArrowDown className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-bold text-blue-600">
                          {analytics.calorie_extremes.lowest.calories} calories
                        </div>
                        <div className="text-sm text-muted-foreground">Lowest Day</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(analytics.calorie_extremes.lowest.date)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {!analytics.calorie_extremes.highest && !analytics.calorie_extremes.lowest && (
                  <Card className="p-4 col-span-full text-center">
                    <div className="text-muted-foreground">No meal data available</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Start logging meals to see your calorie records
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Summary
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{analytics.summary.total_meals}</div>
                  <div className="text-sm text-muted-foreground">Total Meals Logged</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{analytics.summary.days_with_data}</div>
                  <div className="text-sm text-muted-foreground">Days with Data</div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}