import { useState, useEffect } from 'react';
import { Plus, Calendar, Utensils, Edit, Trash2, Clock, Search, ChevronDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { MacroRing } from '@/components/ui/macro-ring';
import { Layout } from '../components/Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { LogMealDialog } from '../components/LogMealDialog';
import { MealRelogDialog } from '../components/MealRelogDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useMealLogsByDate } from '../hooks/useMealLogsByDate';
import { useDateNavigation } from '../hooks/useDateNavigation';
import { useToast } from '@/hooks/use-toast';
import { MealLog } from '../types';
import { logger } from '@/lib/logger';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTodayLocalDate, getYesterdayLocalDate, formatAppDateForDisplay, shiftAppDate } from '@/lib/utils';
import { getSettings } from '@/lib/settings-utils';

export default function Meals() {
  const { toast } = useToast();
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isRelogDialogOpen, setIsRelogDialogOpen] = useState(false);
  const [editingMealLog, setEditingMealLog] = useState<MealLog | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; mealLog: MealLog | null }>({ open: false, mealLog: null });
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);

  // Date navigation hook
  const {
    currentDate,
    viewMode,
    dateRange,
    displayText,
    canGoNext,
    goToToday,
    goToPrevious,
    goToNext,
    goToDate,
    setViewMode,
    goToLastWeek,
    goToLastMonth
  } = useDateNavigation({ initialDate: getTodayLocalDate(), defaultRange: 'day' });

  // Meal logs hook with date-based loading
  const {
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
    refetch
  } = useMealLogsByDate({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    autoLoad: true
  });
  const isMobile = useIsMobile();

  // Debug logging (no-op in production)
  logger.debug('Meals component render:', { loading, mealLogs: mealLogs?.length, error, usingMockData, dateRange });

  // Ensure mealLogs is always an array
  const safeMealLogs = Array.isArray(mealLogs) ? mealLogs : [];

  // Filter meals by current date range from navigation hook
  const filteredMeals = safeMealLogs.filter(log =>
    (!dateRange.startDate || log.eaten_on >= dateRange.startDate) &&
    (!dateRange.endDate || log.eaten_on <= dateRange.endDate)
  );
  const recentLogs = filteredMeals.slice(0, 50); // Show more since we're loading efficiently

  // If current date range has no results but we have logs, jump to most recent log's month
  useEffect(() => {
    if (!loading && safeMealLogs.length > 0 && filteredMeals.length === 0) {
      const mostRecent = safeMealLogs[0]; // loaded in desc order
      if (mostRecent?.eaten_on) {
        goToDate(mostRecent.eaten_on);
        setViewMode('month');
      }
    }
  }, [loading, safeMealLogs, filteredMeals.length, goToDate, setViewMode]);

  const formatDate = (eatenOn: string) => {
    if (!eatenOn) return 'Unknown Date';
    const todayLocal = getTodayLocalDate();
    const yesterdayLocal = getYesterdayLocalDate();

    if (eatenOn === todayLocal) {
      return 'Today';
    } else if (eatenOn === yesterdayLocal) {
      return 'Yesterday';
    } else {
      return formatAppDateForDisplay(eatenOn);
    }
  };

  // Navigation handlers
  const handleQuickDateSelect = (option: string) => {
    switch (option) {
      case 'Today':
        goToToday();
        setViewMode('day');
        break;
      case 'Yesterday': {
        const yesterday = shiftAppDate(getTodayLocalDate(), { days: -1 });
        goToDate(yesterday);
        setViewMode('day');
        break;
      }
      case 'This Week':
        goToToday();
        setViewMode('week');
        break;
      case 'Last Week':
        goToLastWeek();
        break;
    }
    setIsDateSheetOpen(false);
  };

  const handleDatePickerChange = (date: string) => {
    goToDate(date);
    setViewMode('day');
  };

  const clearDateFilter = () => {
    goToToday();
    setViewMode('day');
    setIsDateSheetOpen(false);
  };

  const handleDeleteMealLog = async () => {
    if (!deleteConfirm.mealLog) return;
    
    try {
      await deleteMealLog(deleteConfirm.mealLog.id);
      toast({
        title: 'Meal deleted',
        description: `${deleteConfirm.mealLog.meal_name} has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete meal log. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReLogMeal = async (mealLog: MealLog, multiplier: number = 1, notes?: string, eatenOn?: string) => {
    try {
      await reLogMeal(mealLog, multiplier, notes, eatenOn);
      toast({
        title: 'Meal re-logged',
        description: `${mealLog.meal_name} has been logged for ${eatenOn || 'today'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to re-log meal. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Allow relogging any meal unlimited times
  const isMealLoggedToday = (mealLog: MealLog) => {
    // Always return false so relog button is never disabled
    return false;
  };

  // Calculate nutrition aggregates
  const totalCalories = filteredMeals.reduce((sum, log) => sum + (log.macros?.calories || 0), 0);
  const totalProtein = filteredMeals.reduce((sum, log) => sum + (log.macros?.protein || 0), 0);
  const totalCarbs = filteredMeals.reduce((sum, log) => sum + (log.macros?.carbs || 0), 0);
  const totalFat = filteredMeals.reduce((sum, log) => sum + (log.macros?.fat || 0), 0);
  const totalMacros = totalProtein + totalCarbs + totalFat;

  const proteinPercentage = totalMacros > 0 ? (totalProtein / totalMacros * 100) : 0;
  const carbsPercentage = totalMacros > 0 ? (totalCarbs / totalMacros * 100) : 0;
  const fatPercentage = totalMacros > 0 ? (totalFat / totalMacros * 100) : 0;

  // Get dynamic targets from settings
  const settings = getSettings();
  const calorieTarget = settings.calorieTarget;
  const proteinTarget = settings.proteinTarget;
  const carbsTarget = settings.carbsTarget;
  const fatTarget = settings.fatTarget;
  const caloriesPercent = Math.min((totalCalories / calorieTarget) * 100, 100);
  const proteinPercent = Math.min((totalProtein / proteinTarget) * 100, 100);
  const carbsPercent = Math.min((totalCarbs / carbsTarget) * 100, 100);
  const fatPercent = Math.min((totalFat / fatTarget) * 100, 100);

  const getDateLabel = () => {
    return `${displayText} ▾`;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background">

        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-4">

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Date Pill */}
            <Sheet open={isDateSheetOpen} onOpenChange={setIsDateSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="gap-2 rounded-full h-10 w-full sm:w-auto">
                  {getDateLabel()}
                </Button>
              </SheetTrigger>

              <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[80vh]" : ""}>
                <SheetHeader>
                  <SheetTitle>Navigate by Date</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Navigation Controls */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Navigate</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPrevious}
                        className="flex-1"
                      >
                        ← Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        className="flex-1"
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNext}
                        disabled={!canGoNext}
                        className="flex-1"
                      >
                        Next →
                      </Button>
                    </div>
                  </div>

                  {/* View Mode */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">View mode</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['day', 'week', 'month'] as const).map(mode => (
                        <Button
                          key={mode}
                          variant={viewMode === mode ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode(mode)}
                          className="capitalize"
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Select */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Quick select</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {["Today", "Yesterday", "This Week", "Last Week"].map(option => (
                        <Button
                          key={option}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickDateSelect(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Date Picker */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Pick a date</h4>
                    <Input
                      type="date"
                      value={currentDate}
                      onChange={(e) => handleDatePickerChange(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => setIsDateSheetOpen(false)}
                      className="flex-1"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearDateFilter}
                    >
                      Today
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full sm:w-auto"
                  aria-label="Meal actions"
                >
                  <Plus className="h-4 w-4" />
                  Log Meal
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsLogDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Meal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsRelogDialogOpen(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Re-log Meal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading meal logs...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !usingMockData && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">Error loading meal logs: {error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-2"
              variant="outline"
            >
              Reload Page
            </Button>
          </div>
        )}

        {/* Content when not loading */}
        {!loading && (
          <>
            {/* Mock Data Indicator - Only show when actually using mock data due to connection issues */}
            {usingMockData && (
              <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <p className="text-sm text-amber-800">
                    <strong>Demo Mode:</strong> Cannot connect to database. Showing sample meal logs.
                    {error && <span className="block mt-1">Error: {error}</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Sticky KPI Section */}
            <div className="sticky top-16 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="px-4 pt-3 pb-3 space-y-3">
                {/* Top Row - Calories and Meals */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Calories Card - Always show, but conditional tracking */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold">Calories</h3>
                        <div className="text-xl font-bold text-primary">
                          {totalCalories.toFixed(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {settings.calorieTargetEnabled
                            ? `of ${calorieTarget} target`
                            : 'logged today'
                          }
                        </p>
                      </div>
                      {settings.calorieTargetEnabled && (
                        <div className="relative w-14 h-14">
                          {/* Ring gauge */}
                          <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              className="text-muted-foreground/20"
                            />
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              strokeDasharray={`${(caloriesPercent / 100) * 138.2} 138.2`}
                              className="text-primary transition-all duration-500"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-medium">{caloriesPercent.toFixed(0)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Meals Card */}
                  <Card className="p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold">Meals</h3>
                      <div className="text-xl font-bold">
                        {filteredMeals.length}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        logged today
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Macros Row - Enhanced Circular Rings showing percentage distribution */}
                <div className="flex justify-around items-center py-4">
                  <MacroRing
                    label="Protein"
                    value={totalProtein}
                    totalMacros={totalMacros}
                    color="protein"
                  />
                  <MacroRing
                    label="Carbs"
                    value={totalCarbs}
                    totalMacros={totalMacros}
                    color="carbs"
                  />
                  <MacroRing
                    label="Fat"
                    value={totalFat}
                    totalMacros={totalMacros}
                    color="fat"
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Meal List */}
            <div className="px-4 pt-4 pb-4 space-y-4">
              
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Utensils className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No meals yet</h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    Log your first meal to see calories and macros.
                  </p>
                  <Button onClick={() => setIsLogDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Log Meal
                  </Button>
                </div>
              ) : (
                recentLogs.map(log => {
                  // Split comma-separated items for preview
                  const allItems: string[] = [];
                  log.items?.forEach(item => {
                    const splitItems = item.split(',')
                      .map(i => i.trim())
                      .filter(i => i.length > 0);
                    allItems.push(...splitItems);
                  });
                  const firstTwoItems = allItems.slice(0, 2);
                  const restCount = Math.max(0, allItems.length - 2);

                  return (
                    <Card key={log.id} className="p-4">
                      <div className="space-y-3">
                        {/* Title and Meta */}
                        <div>
                          <h3 className="font-medium text-lg">{log.meal_name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(log.eaten_on)}
                            </div>
                            {log.macros?.calories && (
                              <div className="flex items-center gap-1">
                                <span>🔥</span>
                                {log.macros.calories.toFixed(0)} kcal
                              </div>
                            )}
                          </div>

                          {/* Macro Pills */}
                          {log.macros && (log.macros.protein > 0 || log.macros.carbs > 0 || log.macros.fat > 0) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {log.macros.protein > 0 && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">
                                  {log.macros.protein.toFixed(0)}p
                                </Badge>
                              )}
                              {log.macros.carbs > 0 && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-100">
                                  {log.macros.carbs.toFixed(0)}c
                                </Badge>
                              )}
                              {log.macros.fat > 0 && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                                  {log.macros.fat.toFixed(0)}f
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Items and Actions Row */}
                        <div className="flex items-center justify-between">
                          {/* Items Preview - Show more items */}
                          {allItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2 flex-1 mr-3">
                              {allItems.slice(0, 4).map((item, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                              {allItems.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{allItems.length - 4}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1"></div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReLogMeal(log);
                              }}
                              className="h-8 w-8 p-0"
                              title="Re-log meal"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMealLog(log);
                                setIsLogDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0"
                              title="Edit meal"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ open: true, mealLog: log });
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete meal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}


        {/* Log Meal Dialog */}
        <LogMealDialog
          open={isLogDialogOpen}
          onOpenChange={(open) => {
            setIsLogDialogOpen(open);
            if (!open) {
              setEditingMealLog(null);
            }
          }}
          editingMealLog={editingMealLog}
          addMealLogFromItems={addMealLogFromItems}
          addBatchMealLogsFromItems={addBatchMealLogsFromItems}
          updateMealLog={updateMealLog}
        />

        {/* Meal Relog Dialog */}
        <MealRelogDialog
          open={isRelogDialogOpen}
          onOpenChange={setIsRelogDialogOpen}
          mealLogs={filteredMeals}
          onRelogMeal={handleReLogMeal}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ open, mealLog: open ? deleteConfirm.mealLog : null })}
          title="Delete Meal Log"
          description={`Are you sure you want to delete "${deleteConfirm.mealLog?.meal_name}"? This action cannot be undone.`}
          onConfirm={handleDeleteMealLog}
          confirmText="Delete"
          variant="destructive"
        />
      </div>
    </Layout>
  );
}
