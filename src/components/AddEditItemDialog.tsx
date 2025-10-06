import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FoodItem, ItemNote } from '../types';
import { StarRating } from './StarRating';
import { ItemNotes } from './ItemNotes';

// Form-specific type that allows string values during editing
interface FoodItemFormData {
  name: string;
  brand: string;
  category: string;
  image_url: string;
  ingredients: string;
  rating: number;
  notes: ItemNote[];
}

interface AddEditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: FoodItem;
  onSave: (item: Omit<FoodItem, 'id' | 'last_edited'>) => Promise<void>;
}

const categories = ['Fruits', 'Vegetables', 'Proteins', 'Dairy & Eggs', 'Grains & Starches', 'Snacks', 'Beverages', 'Oils & Fats', 'Single-Ingredient Spices/Herbs', 'Seasoning Blends/Mixes', 'Seasonings & Spices', 'Condiments & Sauces', 'Baking Supplies'];

export function AddEditItemDialog({ open, onOpenChange, item, onSave }: AddEditItemDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<FoodItemFormData>({
    name: '',
    brand: '',
    category: '',
    image_url: '',
    ingredients: '',
    rating: 0,
    notes: [],
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        brand: item.brand || '',
        category: item.category,
        image_url: item.image_url || '',
        ingredients: item.ingredients || '',
        rating: item.rating || 0,
        notes: item.notes || [],
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        category: '',
        image_url: '',
        ingredients: '',
        rating: 0,
        notes: [],
      });
    }
  }, [item, open]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Name and category are required
    if (!formData.name.trim() || !formData.category) {
      toast({
        title: "Missing required fields",
        description: "Please fill in name and category.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Prepare the data to save with default values for removed fields
      const dataToSave = {
        ...formData,
        brand: formData.brand.trim() || undefined,
        image_url: formData.image_url.trim() || undefined,
        ingredients: formData.ingredients.trim() || undefined,
        // Default values for removed fields
        in_stock: true,
        serving_size: 100,
        serving_quantity: undefined,
        serving_unit: undefined,
        serving_unit_type: undefined,
        nutrition: {
          calories_per_serving: 0,
          protein_per_serving: 0,
          carbs_per_serving: 0,
          fat_per_serving: 0,
          fiber_per_serving: 0,
        },
        notes: formData.notes,
      };

      await onSave(dataToSave);
      
      toast({
        title: item ? "Item updated" : "Item added",
        description: `${formData.name} has been ${item ? 'updated' : 'added to your inventory'}.`,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'DuplicateItemError') {
        toast({
          title: "Item already exists",
          description: err.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to save item',
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the details of your food item.' : 'Add a new food item to your inventory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Organic Bananas"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="e.g., Whole Foods"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <StarRating
              rating={formData.rating}
              onRatingChange={(rating) => setFormData(prev => ({ ...prev, rating }))}
              size="md"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="e.g., https://example.com/product-image.jpg"
                className="flex-1"
              />
              {formData.image_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                  title="Clear image URL"
                >
                  Clear
                </Button>
              )}
            </div>
            {formData.image_url && (
              <div className="mt-2">
                <img 
                  src={formData.image_url} 
                  alt="Product preview" 
                  className="w-20 h-20 object-cover rounded-md border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {!formData.image_url && (
              <div className="mt-2 text-sm text-muted-foreground">
                No image URL set. Will use default category image.
              </div>
            )}
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients</Label>
            <textarea
              id="ingredients"
              value={formData.ingredients}
              onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
              placeholder="e.g., Organic chicken breast, water, salt, natural flavoring"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={4}
            />
          </div>

          {/* Notes */}
          <ItemNotes
            notes={formData.notes}
            onNotesChange={(notes) => setFormData(prev => ({ ...prev, notes }))}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : (item ? 'Update Item' : 'Add Item')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
