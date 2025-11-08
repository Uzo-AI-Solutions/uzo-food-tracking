import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import RecipeViewer from '@/pages/RecipeViewer';
import { renderWithProviders } from '../setup';
import * as recipesHook from '@/hooks/useRecipes';
import * as inventoryHook from '@/hooks/useInventorySearch';
import * as mobileHook from '@/hooks/use-mobile';

vi.mock('@/hooks/useRecipes');
vi.mock('@/hooks/useInventorySearch');
vi.mock('@/hooks/use-mobile');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

const mockRecipe = {
  id: 1,
  name: 'Pancakes',
  servings: 2,
  total_time_minutes: 10,
  instructions: 'Mix\nCook',
  ingredients: [
    { item_id: 1, quantity: 1, unit: 'cup' },
    { item_id: 2, quantity: 2, unit: 'pcs' },
  ],
  nutrition: {
    calories_per_serving: 0,
    protein_per_serving: 0,
    carbs_per_serving: 0,
    fat_per_serving: 0,
  },
  is_favorite: false,
  tags: [],
  notes: '',
  created_at: '',
  updated_at: '',
};

describe('RecipeViewer Page', () => {
  beforeEach(() => {
    vi.mocked(recipesHook.useRecipes).mockReturnValue({
      getRecipeById: () => mockRecipe,
    } as unknown as ReturnType<typeof recipesHook.useRecipes>);
    vi.mocked(inventoryHook.useInventorySearch).mockReturnValue({
      allItems: [
        { id: 1, name: 'Flour' },
        { id: 2, name: 'Eggs' },
      ],
    } as unknown as ReturnType<typeof inventoryHook.useInventorySearch>);
    vi.mocked(mobileHook.useIsMobile).mockReturnValue(false);
  });

  it('displays recipe details', () => {
    renderWithProviders(<RecipeViewer />);
    expect(screen.getByText('Pancakes')).toBeInTheDocument();
    expect(screen.getByText('Mix')).toBeInTheDocument();
  });

  it('shows progress tracking for steps', () => {
    renderWithProviders(<RecipeViewer />);
    const progressElements = screen.getAllByText('0/2');
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('toggles step completion', () => {
    renderWithProviders(<RecipeViewer />);
    const stepButton = screen.getByLabelText(/Step 1.*Mix/);
    fireEvent.click(stepButton);
    const progressElements = screen.getAllByText('1/2');
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('shows reset button when steps are completed', () => {
    renderWithProviders(<RecipeViewer />);
    const stepButton = screen.getByLabelText(/Step 1.*Mix/);
    fireEvent.click(stepButton);
    expect(screen.getByLabelText('Reset all step progress')).toBeInTheDocument();
  });


  it('handles mobile view properly', () => {
    vi.mocked(mobileHook.useIsMobile).mockReturnValue(true);
    renderWithProviders(<RecipeViewer />);
    // Check if mobile-specific styling is applied
    expect(screen.getByLabelText('Go back to previous page')).toBeInTheDocument();
  });
});

