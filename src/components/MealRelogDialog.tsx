import { useState, useEffect, useRef } from 'react';
import { Search, Clock, Plus, Minus, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { MealLog } from '../types';
import { getTodayLocalDate, formatAppDateForDisplay } from '@/lib/utils';
import { useDebounce, searchMealLogs } from '@/lib/search';

interface MealRelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealLogs: MealLog[];
  onRelogMeal: (mealLog: MealLog, multiplier: number, notes?: string, eatenOn?: string) => Promise<void>;
}

export function MealRelogDialog({ open, onOpenChange, mealLogs, onRelogMeal }: MealRelogDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [eatenOn, setEatenOn] = useState(getTodayLocalDate());
  const [isRelogging, setIsRelogging] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [serverResults, setServerResults] = useState<MealLog[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSearchQuery('');
      setSelectedMeal(null);
      setMultiplier(1);
      setAdditionalNotes('');
      setEatenOn(getTodayLocalDate());
      setIsKeyboardVisible(false);
    }
  }, [open]);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        // Detect if keyboard is likely visible on mobile
        const isMobile = window.innerWidth <= 768;
        const heightDifference = window.screen.height - window.innerHeight;
        const keyboardThreshold = 150; // Adjust this value as needed

        if (isMobile && heightDifference > keyboardThreshold) {
          setIsKeyboardVisible(true);
        } else {
          setIsKeyboardVisible(false);
        }
      }
    };

    // Handle focus events to scroll input into view
    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setTimeout(() => {
          e.target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 300); // Delay to allow keyboard animation
      }
    };

    if (open) {
      window.addEventListener('resize', handleResize);
      document.addEventListener('focusin', handleFocus);
      handleResize(); // Check initial state
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocus);
    };
  }, [open]);

  // Server-side search (FTS + trigram) with debouncing; fallback to client filtering on error
  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setSearchError(null);
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        setServerResults([]);
        setIsSearching(false);
        return;
      }
      try {
        setIsSearching(true);
        const { items } = await searchMealLogs(debouncedQuery, { limit: 50 });
        if (!canceled) {
          setServerResults(items);
        }
      } catch (e) {
        if (!canceled) {
          setSearchError(e instanceof Error ? e.message : 'Search failed');
          setServerResults([]);
        }
      } finally {
        if (!canceled) setIsSearching(false);
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [debouncedQuery]);

  // Filter meals based on search query
  const filteredMeals = mealLogs.filter(meal =>
    meal.meal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meal.items?.some(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get unique meals by name (most recent version of each meal)
  const uniqueMeals = filteredMeals.reduce((acc, meal) => {
    const existing = acc.find(m => m.meal_name === meal.meal_name);
    if (!existing || new Date(meal.created_at) > new Date(existing.created_at)) {
      const filtered = acc.filter(m => m.meal_name !== meal.meal_name);
      filtered.push(meal);
      return filtered;
    }
    return acc;
  }, [] as MealLog[]);

  const handleMealSelect = (meal: MealLog) => {
    setSelectedMeal(meal);
  };

  const handleRelogMeal = async () => {
    if (!selectedMeal) return;

    try {
      setIsRelogging(true);

      // Create notes combining original notes and additional notes
      const combinedNotes = [
        selectedMeal.notes,
        additionalNotes && `Re-logged with ${multiplier}x multiplier: ${additionalNotes}`
      ].filter(Boolean).join(' | ');

      await onRelogMeal(selectedMeal, multiplier, combinedNotes, eatenOn);

      toast({
        title: 'Meal re-logged successfully',
        description: `${selectedMeal.meal_name} (${multiplier}x) has been logged for ${eatenOn === getTodayLocalDate() ? 'today' : eatenOn}.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to re-log meal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRelogging(false);
    }
  };

  const adjustMultiplier = (delta: number) => {
    setMultiplier(Math.max(0.25, multiplier + delta));
  };

  const formatDate = (dateString: string) => {
    const today = getTodayLocalDate();
    if (dateString === today) return 'Today';

    return formatAppDateForDisplay(dateString);
  };

  const steps = [
    { number: 1, title: 'Find Meal', description: 'Search and select a meal' },
    { number: 2, title: 'Adjust & Log', description: 'Set quantity and log' }
  ];

  const canProceedToStep2 = selectedMeal !== null;

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === step.number
                ? 'bg-primary text-primary-foreground'
                : currentStep > step.number
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep > step.number ? (
              <Check className="h-4 w-4" />
            ) : (
              step.number
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-2 ${
                currentStep > step.number ? 'bg-green-500' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Find a Meal to Re-log</h3>
        <p className="text-sm text-muted-foreground">
          Search for a previously logged meal
        </p>
      </div>

      {/* Search Section */}
      <div className="space-y-3">
        <Label htmlFor="meal-search">Search Meals</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            id="meal-search"
            placeholder="Search by meal name or ingredient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${isMobile ? 'h-12' : ''}`}
            autoComplete="off"
            inputMode="search"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-3">
          <Label>
            Search Results ({(serverResults.length || uniqueMeals.length)}) meals
          </Label>
          <div className={`${isMobile ? 'max-h-64' : 'max-h-72'} overflow-y-auto space-y-2`}>
            {(serverResults.length > 0 ? serverResults : uniqueMeals).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No meals found matching "{searchQuery}"
              </p>
            ) : (
              (serverResults.length > 0 ? serverResults : uniqueMeals).map((meal) => (
                <Card
                  key={meal.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedMeal?.id === meal.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleMealSelect(meal)}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{meal.meal_name}</h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(meal.eaten_on)}
                      </div>
                    </div>

                    {/* Items */}
                    {meal.items && meal.items.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {meal.items.slice(0, 3).map((item, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {item.length > 15 ? item.substring(0, 15) + '...' : item}
                          </Badge>
                        ))}
                        {meal.items.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{meal.items.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Nutrition */}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{meal.macros?.calories?.toFixed(0) || 0} cal</span>
                      <span>P: {meal.macros?.protein?.toFixed(1) || 0}g</span>
                      <span>C: {meal.macros?.carbs?.toFixed(1) || 0}g</span>
                      <span>F: {meal.macros?.fat?.toFixed(1) || 0}g</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!searchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            Use the search box above to find a meal
          </p>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Adjust & Log Meal</h3>
        <p className="text-sm text-muted-foreground">
          Set quantity, date, and log your meal
        </p>
      </div>

      {/* Selected Meal Summary */}
      {selectedMeal && (
        <Card className="p-4 bg-primary/5">
          <div className="space-y-2">
            <h4 className="font-medium">{selectedMeal.meal_name}</h4>
            <p className="text-sm text-muted-foreground">
              Originally eaten on {formatDate(selectedMeal.eaten_on)}
            </p>

            {/* Items */}
            {selectedMeal.items && selectedMeal.items.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedMeal.items.slice(0, 5).map((item, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {item.length > 15 ? item.substring(0, 15) + '...' : item}
                  </Badge>
                ))}
                {selectedMeal.items.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedMeal.items.length - 5} more
                  </Badge>
                )}
              </div>
            )}

            <div className="flex gap-3 text-sm text-muted-foreground pt-1">
              <span>{selectedMeal.macros?.calories?.toFixed(0) || 0} cal</span>
              <span>P: {selectedMeal.macros?.protein?.toFixed(1) || 0}g</span>
              <span>C: {selectedMeal.macros?.carbs?.toFixed(1) || 0}g</span>
              <span>F: {selectedMeal.macros?.fat?.toFixed(1) || 0}g</span>
            </div>
          </div>
        </Card>
      )}

      {/* Quantity Multiplier */}
      <div className="space-y-4">
        <Label>Quantity Multiplier</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => adjustMultiplier(-0.25)}
            disabled={multiplier <= 0.25}
            className={isMobile ? 'h-10 w-10 p-0' : ''}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <span className="text-xl font-bold">{multiplier}x</span>
            <p className="text-xs text-muted-foreground">
              ~{Math.round((selectedMeal?.macros?.calories || 0) * multiplier)} calories
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => adjustMultiplier(0.25)}
            className={isMobile ? 'h-10 w-10 p-0' : ''}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0.5, 1, 1.5, 2].map((value) => (
            <Button
              key={value}
              type="button"
              variant={multiplier === value ? "default" : "outline"}
              size="sm"
              onClick={() => setMultiplier(value)}
              className={isMobile ? 'h-10' : ''}
            >
              {value}x
            </Button>
          ))}
        </div>
      </div>

      {/* Updated Nutrition Preview */}
      {selectedMeal && (
        <Card className="p-4 bg-green-50 border-green-200">
          <h4 className="font-medium mb-2 text-green-800 text-sm">Total Nutrition to Log</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-lg text-green-700">
                {((selectedMeal.macros?.calories || 0) * multiplier).toFixed(0)} cal
              </span>
            </div>
            <div className="space-y-0.5 text-green-700 text-xs">
              <div>Protein: {((selectedMeal.macros?.protein || 0) * multiplier).toFixed(1)}g</div>
              <div>Carbs: {((selectedMeal.macros?.carbs || 0) * multiplier).toFixed(1)}g</div>
              <div>Fat: {((selectedMeal.macros?.fat || 0) * multiplier).toFixed(1)}g</div>
            </div>
          </div>
        </Card>
      )}

      {/* Date Selection */}
      <div className="space-y-3">
        <Label htmlFor="eaten-on">Date to Log</Label>
        <Input
          id="eaten-on"
          type="date"
          value={eatenOn}
          onChange={(e) => setEatenOn(e.target.value)}
          className={isMobile ? 'h-12' : ''}
        />
      </div>

      {/* Additional Notes */}
      <div className="space-y-3">
        <Label htmlFor="additional-notes">Additional Notes (Optional)</Label>
        <Textarea
          id="additional-notes"
          placeholder="Add any notes about this re-logged meal..."
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isMobile ? 'max-w-[95vw] h-[80vh] p-0' : 'max-w-2xl max-h-[85vh]'} flex flex-col`}
      >
        <div className={`${isMobile ? 'px-6 pt-4 pb-3' : 'px-6 pt-6'} border-b flex-shrink-0`}>
          <DialogHeader>
            <DialogTitle className={`${isMobile ? 'text-left pr-8' : 'text-center'}`}>
              Re-log Previous Meal
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className={`flex-1 overflow-y-auto ${isMobile ? 'px-6 py-4' : 'px-6 pt-4'}`}>
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
        </div>

        {/* Navigation Footer */}
        <div className={`flex-shrink-0 border-t bg-background ${isMobile ? 'px-6 py-4' : 'px-6 pt-4'}`}>
          {currentStep === 1 ? (
            // Step 1: Show only Next button
            <div className="flex gap-3">
              <div className="flex-1" />
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToStep2}
                className={`${isMobile ? 'h-12' : ''} gap-2`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            // Step 2: Show Back, Cancel, and Re-log buttons
            <div className={`${isMobile ? 'space-y-3' : 'flex gap-3'}`}>
              {!isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}

              <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'flex gap-3 flex-1 justify-end'}`}>
                {isMobile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    className="h-12 gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className={`${isMobile ? 'h-12' : ''} ${isMobile ? 'col-span-1' : ''}`}
                >
                  Cancel
                </Button>
              </div>

              <Button
                type="button"
                onClick={handleRelogMeal}
                disabled={isRelogging || multiplier <= 0}
                className={`${isMobile ? 'h-12 w-full' : ''} gap-2`}
              >
                {isRelogging ? 'Re-logging...' : (
                  <>
                    <Check className="h-4 w-4" />
                    Re-log {multiplier}x
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}