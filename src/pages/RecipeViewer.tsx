import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Users, AlertCircle, RotateCcw, Loader2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRecipes } from '@/hooks/useRecipes';
import { useInventorySearch } from '@/hooks/useInventorySearch';
import { useIsMobile } from '@/hooks/use-mobile';

export default function RecipeViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecipeById, loading } = useRecipes();
  const { allItems } = useInventorySearch();
  const isMobile = useIsMobile();

  // Memoize recipe lookup with proper validation
  const recipe = useMemo(() => {
    if (!id) return undefined;
    const recipeId = Number(id);
    if (isNaN(recipeId)) return undefined;
    return getRecipeById(recipeId);
  }, [id, getRecipeById]);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [hasError, setHasError] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [currentServings, setCurrentServings] = useState<number>(recipe?.servings || 1);

  // Process recipe instructions into steps
  const steps = useMemo(() => {
    if (!recipe?.instructions) return [];
    return recipe.instructions
      .split('\n')
      .map(step => step.trim())
      .filter(Boolean);
  }, [recipe?.instructions]);

  const toggleStep = useCallback((idx: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setCompletedSteps(new Set());
  }, []);

  const getIngredientName = useCallback((itemId: number) => {
    const item = allItems.find(item => item.id === itemId);
    return item?.name || 'Unknown item';
  }, [allItems]);

  // Handle errors in useEffect to avoid side effects during render
  useEffect(() => {
    if (recipe && recipe.instructions) {
      try {
        recipe.instructions
          .split('\n')
          .map(step => step.trim())
          .filter(Boolean);
        setLoadingError(null);
      } catch (error) {
        setLoadingError('Failed to parse recipe instructions');
        setHasError(true);
      }
    }
  }, [recipe]);

  // Update current servings when recipe changes
  useEffect(() => {
    if (recipe) {
      setCurrentServings(recipe.servings);
    }
  }, [recipe]);

  // Scale ingredient quantities based on serving size
  const scaleIngredient = useCallback((ingredient: string, originalServings: number, newServings: number): string => {
    if (originalServings === newServings) return ingredient;

    const scaleFactor = newServings / originalServings;

    // Regex to match numbers (including fractions and decimals) at the start of ingredient
    const quantityMatch = ingredient.match(/^(\d+(?:\.\d+)?(?:\/\d+)?|\d+\/\d+)\s*/);

    if (!quantityMatch) return ingredient;

    const originalQuantityStr = quantityMatch[1];
    const restOfIngredient = ingredient.replace(quantityMatch[0], '');

    // Parse fractions and decimals
    let originalQuantity: number;
    if (originalQuantityStr.includes('/')) {
      const [numerator, denominator] = originalQuantityStr.split('/').map(Number);
      originalQuantity = numerator / denominator;
    } else {
      originalQuantity = parseFloat(originalQuantityStr);
    }

    const scaledQuantity = originalQuantity * scaleFactor;

    // Format the scaled quantity nicely
    let formattedQuantity: string;
    if (scaledQuantity < 1) {
      // For quantities less than 1, try to represent as fraction if reasonable
      const commonFractions: { [key: string]: string } = {
        '0.25': '1/4',
        '0.33': '1/3',
        '0.5': '1/2',
        '0.67': '2/3',
        '0.75': '3/4'
      };
      const rounded = Math.round(scaledQuantity * 100) / 100;
      formattedQuantity = commonFractions[rounded.toString()] || rounded.toString();
    } else if (scaledQuantity % 1 === 0) {
      // Whole numbers
      formattedQuantity = scaledQuantity.toString();
    } else {
      // Decimals rounded to 2 places
      formattedQuantity = (Math.round(scaledQuantity * 100) / 100).toString();
    }

    return `${formattedQuantity} ${restOfIngredient}`;
  }, []);

  // Get scaled ingredients for AI recipes
  const scaledIngredients = useMemo(() => {
    if (!recipe?.ingredient_list) return [];

    return recipe.ingredient_list.map(ingredient =>
      scaleIngredient(ingredient, recipe.servings, currentServings)
    );
  }, [recipe, currentServings, scaleIngredient]);

  // Format quantity for display (handles decimals and fractions)
  const formatQuantity = useCallback((quantity: number): string => {
    // Common fractions for better display
    const commonFractions: { [key: string]: string } = {
      '0.25': '1/4',
      '0.33': '1/3',
      '0.5': '1/2',
      '0.67': '2/3',
      '0.75': '3/4'
    };

    if (quantity % 1 === 0) {
      // Whole numbers
      return quantity.toString();
    }

    const rounded = Math.round(quantity * 100) / 100;

    // Check if it matches a common fraction
    const fraction = commonFractions[rounded.toString()];
    if (fraction) {
      return fraction;
    }

    // For other decimals, show up to 2 decimal places
    return rounded.toString();
  }, []);

  // Get scaled manual recipe ingredients
  const scaledManualIngredients = useMemo(() => {
    if (!recipe?.ingredients) return [];

    const scaleFactor = currentServings / recipe.servings;

    return recipe.ingredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.quantity * scaleFactor
    }));
  }, [recipe, currentServings]);

  // Adjust servings
  const adjustServings = useCallback((increment: boolean) => {
    setCurrentServings(prev => increment ? prev + 1 : Math.max(1, prev - 1));
  }, []);

  const retryLoad = useCallback(() => {
    setHasError(false);
    setLoadingError(null);
    // The hooks will automatically refetch data
    window.location.reload();
  }, []);

  // Loading screen for smoother transition into full-screen cook mode
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col bg-background">
        <header className="p-3 sm:p-4 border-b flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 sm:gap-2"
            size={isMobile ? "sm" : "default"}
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="w-8 sm:w-12" />
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3" role="status" aria-busy="true">
            <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm sm:text-base text-muted-foreground">Loading recipe…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!recipe) {
    const isInvalidId = id && isNaN(Number(id));
    return (
      <main className="min-h-screen flex flex-col bg-background">
        <header className="p-4 border-b flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            Back
          </Button>
          <div className="w-12" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">
              {isInvalidId ? 'Invalid Recipe ID' : 'Recipe Not Found'}
            </h1>
            <p className="text-muted-foreground mb-4">
              {isInvalidId 
                ? 'The recipe ID provided is not valid.'
                : 'The recipe you\'re looking for doesn\'t exist or has been removed.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/recipes')}>
                Browse Recipes
              </Button>
              <Button variant="ghost" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const completedCount = completedSteps.size;
  const totalSteps = steps.length;

  if (hasError || loadingError) {
    return (
      <main className="min-h-screen flex flex-col bg-background">
        <header className="p-3 sm:p-4 border-b flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 sm:gap-2"
            size={isMobile ? "sm" : "default"}
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="w-8 sm:w-12" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="mt-2">
              {loadingError || "Something went wrong loading the recipe. Please try again."}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 w-full min-h-[44px] touch-manipulation"
                onClick={retryLoad}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="p-3 sm:p-4 border-b flex items-center justify-between gap-2 sm:gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 sm:gap-2 shrink-0"
          size={isMobile ? "sm" : "default"}
          aria-label="Go back to previous page"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <h1 className="text-base sm:text-lg font-bold truncate text-center flex-1 px-2">
          {recipe.name}
        </h1>
        <div className="w-8 sm:w-12 shrink-0" />
      </header>

      <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground flex justify-center gap-4 sm:gap-6 border-b">
        {/* Show scaling controls for all recipes */}
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustServings(false)}
            disabled={currentServings <= 1}
            className="h-6 w-6 p-0 rounded-full"
            aria-label="Decrease servings"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="font-medium min-w-[60px] text-center">
            {currentServings} serving{currentServings !== 1 ? 's' : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustServings(true)}
            className="h-6 w-6 p-0 rounded-full"
            aria-label="Increase servings"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {recipe.total_time_minutes && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{recipe.total_time_minutes} min</span>
          </div>
        )}
        {totalSteps > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-medium">{completedCount}/{totalSteps}</span>
            <span className="hidden sm:inline">completed</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-6 sm:space-y-8">
        {/* Ingredients Section */}
        <section aria-label="Recipe ingredients">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-foreground">Ingredients</h2>
          {(recipe.ingredients.length === 0 && (!recipe.ingredient_list || recipe.ingredient_list.length === 0)) ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No ingredients listed for this recipe.</p>
            </div>
          ) : (
            <ul className="space-y-2 sm:space-y-3" role="list">
              {/* Display ingredient_list if available (AI recipes) */}
              {recipe.ingredient_list && recipe.ingredient_list.length > 0 ? (
                scaledIngredients.map((ingredient, i) => (
                  <li
                    key={`ingredient-list-${i}`}
                    className="flex items-center p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors min-h-[56px]"
                    role="listitem"
                  >
                    <span className="text-sm sm:text-base font-medium text-foreground">
                      {ingredient}
                    </span>
                    {currentServings !== recipe.servings && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (scaled from {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''})
                      </span>
                    )}
                  </li>
                ))
              ) : (
                /* Display linked ingredients (manual recipes) */
                scaledManualIngredients.map((ing, i) => (
                  <li
                    key={`ingredient-${ing.item_id}-${i}`}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors min-h-[56px]"
                    role="listitem"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm sm:text-base font-medium text-foreground">
                        {getIngredientName(ing.item_id)}
                      </span>
                      {currentServings !== recipe.servings && (
                        <span className="text-xs text-muted-foreground">
                          (scaled from {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-primary shrink-0 ml-2">
                      {formatQuantity(ing.quantity)} {ing.unit}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        {/* Instructions Section */}
        <section aria-label="Recipe cooking instructions">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Instructions</h2>
            {totalSteps > 0 && (
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalSteps}
              </span>
            )}
          </div>
          {steps.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No instructions provided for this recipe.</p>
            </div>
          ) : (
            <>
              {completedCount > 0 && (
                <div className="flex justify-between items-center mb-4 p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    Progress: {completedCount} of {totalSteps} steps completed
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetProgress}
                    className="text-xs min-h-[36px] touch-manipulation"
                    aria-label="Reset all step progress"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              )}
              <ol className="space-y-3 sm:space-y-4" role="list">
                {steps.map((step, i) => {
                  const isCompleted = completedSteps.has(i);
                  return (
                    <li key={`step-${i}`} role="listitem">
                      <button
                        onClick={() => toggleStep(i)}
                        className={`w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg text-left border transition-all duration-200 touch-manipulation min-h-[56px] ${
                          isCompleted
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 opacity-75'
                            : 'bg-card hover:bg-accent/50 border-border hover:border-accent-foreground/20'
                        }`}
                        aria-pressed={isCompleted}
                        aria-label={`Step ${i + 1}${isCompleted ? ' - completed' : ''}: ${step.replace(/^\d+\.\s*/, '').substring(0, 50)}...`}
                      >
                        <span className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm transition-colors ${
                          isCompleted
                            ? 'bg-green-600 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          {i + 1}
                        </span>
                        <span className={`text-sm sm:text-base leading-relaxed transition-all ${
                          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}>
                          {step.replace(/^\d+\.\s*/, '')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
