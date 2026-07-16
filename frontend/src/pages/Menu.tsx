import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, Edit3, Plus, RefreshCw, X, Image, Layers,
  ChefHat, Utensils, AlertTriangle, CheckCircle, Trash2,
  ToggleLeft, ToggleRight, Package,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import api from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface MenuCategory {
  id: string; name: string; description?: string | null;
  imageUrl?: string | null; displayOrder: number; isActive: boolean;
  totalItems?: number; activeItems?: number;
}

interface KitchenStation {
  id: string; name: string; description?: string | null;
  displayOrder: number; isActive: boolean; menuItemCount?: number;
}

interface MenuItem {
  id: string; name: string; code: string; description?: string | null;
  itemType: 'FOOD' | 'DRINK' | 'DESSERT' | 'OTHER';
  price: string | number; costPrice?: string | number | null;
  taxRate: string | number; isAvailable: boolean; isActive: boolean;
  requiresPreparation: boolean; trackInventory: boolean;
  preparationTimeMinutes?: number | null;
  imageUrl?: string | null; displayOrder: number;
  category?: MenuCategory | null; kitchenStation?: KitchenStation | null;
  dietaryLabels?: string | null; allergenInformation?: string | null;
  publicDescription?: string | null; isFeatured?: boolean;
  isPubliclyVisible?: boolean;
}

interface RecipeIngredient {
  id: string; inventoryItemId: string; inventoryItemName: string;
  stockLocationName?: string | null;
  quantityRequired: string | number; wastagePercentage: number;
}

interface RecipeData {
  id: string; name: string; yieldQuantity: number; notes?: string | null;
  ingredients: RecipeIngredient[];
}

type TabType = 'items' | 'categories' | 'stations' | 'recipes';

interface ItemForm {
  name: string; code: string; description: string;
  itemType: MenuItem['itemType']; price: string; costPrice: string;
  taxRate: string; categoryId: string; kitchenStationId: string;
  preparationTimeMinutes: string; requiresPreparation: boolean;
  trackInventory: boolean; imageUrl: string; displayOrder: string;
  dietaryLabels: string; allergenInformation: string;
  publicDescription: string; isFeatured: boolean; isPubliclyVisible: boolean;
}

interface CategoryForm { name: string; description: string; displayOrder: string; }

interface StationForm { name: string; description: string; displayOrder: string; }

interface InventoryItem {
  id: string; name: string; sku: string; baseUnit: string;
}

interface StockLocation {
  id: string; name: string; code: string; isDefault?: boolean;
}

// ==========================================
// UNSLASH FALLBACK IMAGES BY ITEM TYPE
// ==========================================

const FALLBACK_IMAGES: Record<string, string> = {
  FOOD: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  DRINK: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
  DESSERT: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop',
  OTHER: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
};

function getItemImage(item: MenuItem): string {
  return item.imageUrl || FALLBACK_IMAGES[item.itemType] || FALLBACK_IMAGES.OTHER;
}

// ==========================================
// BLANK FORMS
// ==========================================

const blankItem: ItemForm = {
  name: '', code: '', description: '', itemType: 'FOOD', price: '0', costPrice: '',
  taxRate: '0', categoryId: '', kitchenStationId: '', preparationTimeMinutes: '0',
  requiresPreparation: true, trackInventory: false, imageUrl: '',
  displayOrder: '0', dietaryLabels: '', allergenInformation: '',
  publicDescription: '', isFeatured: false, isPubliclyVisible: true,
};

const blankCategory: CategoryForm = { name: '', description: '', displayOrder: '0' };
const blankStation: StationForm = { name: '', description: '', displayOrder: '0' };

// ==========================================
// COMPONENT
// ==========================================

export default function Menu() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const canEdit = userRoles.some((r) => ['ADMIN', 'MANAGER'].includes(r));
  const canEditStock = userRoles.some((r) => ['ADMIN', 'MANAGER', 'STOCK_KEEPER'].includes(r));

  // Data state
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(blankItem);

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);

  // Station form
  const [showStationForm, setShowStationForm] = useState(false);
  const [editingStation, setEditingStation] = useState<KitchenStation | null>(null);
  const [stationForm, setStationForm] = useState<StationForm>(blankStation);

  // Recipe state
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItem | null>(null);
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);

  useEffect(() => { void loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemRes, catRes, staRes] = await Promise.all([
        api.get('/menu/items'),
        api.get('/menu/categories'),
        api.get('/menu/kitchen-stations'),
      ]);
      setItems(itemRes.data.data ?? []);
      setCategories(catRes.data.data ?? []);
      setStations(staRes.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load menu data'));
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => { setError(null); setSuccess(null); };

  // ==========================================
  // MENU ITEM CRUD
  // ==========================================

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      ...blankItem,
      code: `MI-${String(items.length + 1).padStart(3, '0')}`,
      categoryId: categories.find((c) => c.isActive)?.id ?? '',
      kitchenStationId: stations.find((s) => s.isActive)?.id ?? '',
    });
    setShowItemForm(true);
    clearMessages();
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name, code: item.code,
      description: item.description ?? '',
      itemType: item.itemType, price: String(item.price),
      costPrice: item.costPrice ? String(item.costPrice) : '',
      taxRate: String(item.taxRate ?? 0),
      categoryId: item.category?.id ?? '',
      kitchenStationId: item.kitchenStation?.id ?? '',
      preparationTimeMinutes: String(item.preparationTimeMinutes ?? 0),
      requiresPreparation: item.requiresPreparation,
      trackInventory: item.trackInventory,
      imageUrl: item.imageUrl ?? '',
      displayOrder: String(item.displayOrder ?? 0),
      dietaryLabels: item.dietaryLabels ?? '',
      allergenInformation: item.allergenInformation ?? '',
      publicDescription: item.publicDescription ?? '',
      isFeatured: item.isFeatured ?? false,
      isPubliclyVisible: item.isPubliclyVisible ?? true,
    });
    setShowItemForm(true);
    clearMessages();
  };

  const submitItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) { setError('You do not have permission to modify menu items.'); return; }
    setSaving(true);
    clearMessages();
    try {
      const payload: Record<string, any> = {
        name: itemForm.name.trim(),
        code: itemForm.code.trim().toUpperCase(),
        description: itemForm.description.trim() || null,
        itemType: itemForm.itemType,
        price: Number(itemForm.price),
        costPrice: itemForm.costPrice ? Number(itemForm.costPrice) : null,
        taxRate: Number(itemForm.taxRate || 0),
        categoryId: itemForm.categoryId || null,
        kitchenStationId: itemForm.kitchenStationId || null,
        preparationTimeMinutes: Number(itemForm.preparationTimeMinutes || 0) || null,
        requiresPreparation: itemForm.requiresPreparation,
        trackInventory: itemForm.trackInventory,
        imageUrl: itemForm.imageUrl.trim() || null,
        displayOrder: Number(itemForm.displayOrder || 0),
        dietaryLabels: itemForm.dietaryLabels.trim() || null,
        allergenInformation: itemForm.allergenInformation.trim() || null,
        publicDescription: itemForm.publicDescription.trim() || null,
        isFeatured: itemForm.isFeatured,
        isPubliclyVisible: itemForm.isPubliclyVisible,
      };
      if (!payload.name || !payload.code || Number.isNaN(payload.price)) {
        throw new Error('Name, code, and valid price are required.');
      }

      const response = editingItem
        ? await api.patch(`/menu/items/${editingItem.id}`, payload)
        : await api.post('/menu/items', payload);

      const updated = response.data.data;
      setItems((prev) => editingItem
        ? prev.map((i) => i.id === editingItem.id ? updated : i)
        : [...prev, updated]);
      setSuccess(`${payload.name} ${editingItem ? 'updated' : 'created'}.`);
      setShowItemForm(false);
      setEditingItem(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save menu item'));
    } finally {
      setSaving(false);
    }
  };

  const toggleItemStatus = async (item: MenuItem, field: 'isActive' | 'isAvailable') => {
    if (!canEdit) { setError('Permission denied.'); return; }
    try {
      const response = await api.patch(`/menu/items/${item.id}/status`, {
        [field]: !item[field],
      });
      const updated = response.data.data;
      setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
      setSuccess(`${item.name} ${field.replace('is', '').toLowerCase()} updated.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update item'));
    }
  };

  // ==========================================
  // CATEGORY CRUD
  // ==========================================

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ ...blankCategory, displayOrder: String(categories.length + 1) });
    setShowCategoryForm(true);
    clearMessages();
  };

  const openEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name, description: cat.description ?? '',
      displayOrder: String(cat.displayOrder ?? 0),
    });
    setShowCategoryForm(true);
    clearMessages();
  };

  const submitCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) { setError('Permission denied.'); return; }
    setSaving(true);
    clearMessages();
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        displayOrder: Number(categoryForm.displayOrder || 0),
      };
      if (!payload.name) throw new Error('Category name is required.');

      const response = editingCategory
        ? await api.patch(`/menu/categories/${editingCategory.id}`, payload)
        : await api.post('/menu/categories', payload);

      const updated = response.data.data;
      if (editingCategory) {
        setCategories((prev) => prev.map((c) => c.id === editingCategory.id ? { ...c, ...updated } : c));
      } else {
        setCategories((prev) => [...prev, { ...updated, totalItems: 0, activeItems: 0 }]);
      }
      setSuccess(`Category ${editingCategory ? 'updated' : 'created'}.`);
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save category'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (cat: MenuCategory) => {
    if (!canEdit) { setError('Permission denied.'); return; }
    try {
      const response = await api.patch(`/menu/categories/${cat.id}/status`, {
        isActive: !cat.isActive,
      });
      const updated = response.data.data;
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: updated.isActive } : c));
      setSuccess(`Category ${updated.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update category'));
    }
  };

  // ==========================================
  // STATION CRUD
  // ==========================================

  const openCreateStation = () => {
    setEditingStation(null);
    setStationForm({ ...blankStation, displayOrder: String(stations.length + 1) });
    setShowStationForm(true);
    clearMessages();
  };

  const openEditStation = (st: KitchenStation) => {
    setEditingStation(st);
    setStationForm({
      name: st.name, description: st.description ?? '',
      displayOrder: String(st.displayOrder ?? 0),
    });
    setShowStationForm(true);
    clearMessages();
  };

  const submitStation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) { setError('Permission denied.'); return; }
    setSaving(true);
    clearMessages();
    try {
      const payload = {
        name: stationForm.name.trim(),
        description: stationForm.description.trim() || undefined,
        displayOrder: Number(stationForm.displayOrder || 0),
      };
      if (!payload.name) throw new Error('Station name is required.');

      const response = editingStation
        ? await api.patch(`/menu/kitchen-stations/${editingStation.id}`, payload)
        : await api.post('/menu/kitchen-stations', payload);

      const updated = response.data.data;
      if (editingStation) {
        setStations((prev) => prev.map((s) => s.id === editingStation.id ? { ...s, ...updated } : s));
      } else {
        setStations((prev) => [...prev, { ...updated, menuItemCount: 0 }]);
      }
      setSuccess(`Station ${editingStation ? 'updated' : 'created'}.`);
      setShowStationForm(false);
      setEditingStation(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save station'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStation = async (st: KitchenStation) => {
    if (!canEdit) { setError('Permission denied.'); return; }
    try {
      const response = await api.patch(`/menu/kitchen-stations/${st.id}/status`, { isActive: !st.isActive });
      const updated = response.data.data;
      setStations((prev) => prev.map((s) => s.id === st.id ? { ...s, isActive: updated.isActive } : s));
      setSuccess(`Station ${updated.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update station'));
    }
  };

  // ==========================================
  // RECIPE VIEWER
  // ==========================================

  const loadRecipe = async (menuItem: MenuItem) => {
    setSelectedRecipeItem(menuItem);
    setLoadingRecipe(true);
    setError(null);
    try {
      const [recipeRes, invRes, locRes] = await Promise.all([
        api.get(`/menu/items/${menuItem.id}/recipe`).catch(() => ({ data: { data: null } })),
        api.get('/inventory/items?pageSize=200'),
        api.get('/inventory/locations'),
      ]);
      setRecipeData(recipeRes.data.data);
      setInventoryItems(invRes.data.items ?? []);
      setLocations(locRes.data.data ?? []);
    } catch (err) {
      setRecipeData(null);
      setError(getErrorMessage(err, 'Could not load recipe'));
    } finally {
      setLoadingRecipe(false);
    }
  };

  const addIngredient = async () => {
    if (!selectedRecipeItem || !canEditStock) return;
    const invItem = inventoryItems[0];
    if (!invItem) { setError('No inventory items available.'); return; }
    try {
      const payload = {
        inventoryItemId: invItem.id,
        stockLocationId: locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? null,
        quantityRequired: 1,
        wastagePercentage: 0,
      };
      const res = await api.post(`/menu/items/${selectedRecipeItem.id}/recipe/ingredients`, payload);
      // Reload recipe
      await loadRecipe(selectedRecipeItem);
      setSuccess('Ingredient added to recipe.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add ingredient'));
    }
  };

  const removeIngredient = async (ingredientId: string) => {
    if (!selectedRecipeItem || !canEditStock) return;
    try {
      await api.delete(`/menu/items/${selectedRecipeItem.id}/recipe/ingredients/${ingredientId}`);
      await loadRecipe(selectedRecipeItem);
      setSuccess('Ingredient removed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove ingredient'));
    }
  };

  // ==========================================
  // FILTERING
  // ==========================================

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
  });

  // ==========================================
  // RENDER
  // ==========================================

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Menu" description="Manage menu items, categories, stations, and recipes" />
        <Loading size="lg" message="Loading menu..." />
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: ReactNode; count?: number }[] = [
    { key: 'items', label: 'Menu Items', icon: <BookOpen className="h-4 w-4" />, count: items.length },
    { key: 'categories', label: 'Categories', icon: <Layers className="h-4 w-4" />, count: categories.length },
    { key: 'stations', label: 'Stations', icon: <ChefHat className="h-4 w-4" />, count: stations.length },
    { key: 'recipes', label: 'Recipes', icon: <Utensils className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Menu"
        description="Manage menu items, categories, kitchen stations, and recipes"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            {activeTab === 'items' && canEdit && (
              <Button onClick={openCreateItem} leftIcon={<Plus className="h-4 w-4" />}>Add Item</Button>
            )}
            {activeTab === 'categories' && canEdit && (
              <Button onClick={openCreateCategory} leftIcon={<Plus className="h-4 w-4" />}>Add Category</Button>
            )}
            {activeTab === 'stations' && canEdit && (
              <Button onClick={openCreateStation} leftIcon={<Plus className="h-4 w-4" />}>Add Station</Button>
            )}
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.key
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && renderItems()}
      {activeTab === 'categories' && renderCategories()}
      {activeTab === 'stations' && renderStations()}
      {activeTab === 'recipes' && renderRecipes()}
    </div>
  );

  // ==========================================
  // RENDER: ITEMS TAB
  // ==========================================

  function renderItems() {
    return (
      <div className="space-y-4">
        {/* Item form modal */}
        {showItemForm && (
          <Card>
            <CardContent>
              <form onSubmit={submitItem} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {editingItem ? 'Edit menu item' : 'Add menu item'}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Configure pricing, availability, kitchen station, and public visibility.
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowItemForm(false)}
                    className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Row 1: Basic info */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Name *"><input className="input-field" value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required /></Field>
                  <Field label="Code *"><input className="input-field uppercase" value={itemForm.code}
                    onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} required /></Field>
                  <Field label="Price *">
                    <input className="input-field" type="number" min="0" step="0.01" value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
                  </Field>
                  <Field label="Type">
                    <select className="input-field" value={itemForm.itemType}
                      onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value as MenuItem['itemType'] })}>
                      <option value="FOOD">Food</option>
                      <option value="DRINK">Drink</option>
                      <option value="DESSERT">Dessert</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                </div>

                {/* Row 2: Pricing & Tax */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Cost Price">
                    <input className="input-field" type="number" min="0" step="0.01" value={itemForm.costPrice}
                      onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })} />
                  </Field>
                  <Field label="Tax Rate (%)">
                    <input className="input-field" type="number" min="0" max="100" step="0.1" value={itemForm.taxRate}
                      onChange={(e) => setItemForm({ ...itemForm, taxRate: e.target.value })} />
                  </Field>
                  <Field label="Prep Time (min)">
                    <input className="input-field" type="number" min="0" value={itemForm.preparationTimeMinutes}
                      onChange={(e) => setItemForm({ ...itemForm, preparationTimeMinutes: e.target.value })} />
                  </Field>
                </div>

                {/* Row 3: References */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Category">
                    <select className="input-field" value={itemForm.categoryId}
                      onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                      <option value="">None</option>
                      {categories.filter((c) => c.isActive).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Kitchen Station">
                    <select className="input-field" value={itemForm.kitchenStationId}
                      onChange={(e) => setItemForm({ ...itemForm, kitchenStationId: e.target.value })}>
                      <option value="">None</option>
                      {stations.filter((s) => s.isActive).map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Display Order">
                    <input className="input-field" type="number" min="0" value={itemForm.displayOrder}
                      onChange={(e) => setItemForm({ ...itemForm, displayOrder: e.target.value })} />
                  </Field>
                </div>

                {/* Row 4: Image */}
                <Field label="Image URL">
                  <div className="flex gap-3">
                    <input className="input-field flex-1" type="url" value={itemForm.imageUrl}
                      onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..." />
                    {itemForm.imageUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border shrink-0">
                        <img src={itemForm.imageUrl} alt="Preview" className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[itemForm.itemType]; }} />
                      </div>
                    )}
                    {!itemForm.imageUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border shrink-0 bg-[var(--color-bg-secondary)] flex items-center justify-center">
                        <Image className="h-6 w-6 text-[var(--color-text-muted)]" />
                      </div>
                    )}
                  </div>
                </Field>

                {/* Row 5: Description */}
                <Field label="Description">
                  <textarea className="input-field min-h-[60px]" value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
                </Field>

                {/* Row 6: Toggles */}
                <div className="grid gap-4 md:grid-cols-4">
                  <ToggleField label="Requires Prep" checked={itemForm.requiresPreparation}
                    onChange={(v) => setItemForm({ ...itemForm, requiresPreparation: v })} />
                  <ToggleField label="Track Inventory" checked={itemForm.trackInventory}
                    onChange={(v) => setItemForm({ ...itemForm, trackInventory: v })} />
                  <ToggleField label="Featured" checked={itemForm.isFeatured}
                    onChange={(v) => setItemForm({ ...itemForm, isFeatured: v })} />
                  <ToggleField label="Publicly Visible" checked={itemForm.isPubliclyVisible}
                    onChange={(v) => setItemForm({ ...itemForm, isPubliclyVisible: v })} />
                </div>

                {/* Row 7: Public & Dietary */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Dietary Labels">
                    <select className="input-field" value={itemForm.dietaryLabels}
                      onChange={(e) => setItemForm({ ...itemForm, dietaryLabels: e.target.value })}>
                      <option value="">None</option>
                      <option value="VEGETARIAN">Vegetarian</option>
                      <option value="VEGAN">Vegan</option>
                      <option value="HALAL">Halal</option>
                      <option value="GLUTEN_AWARE">Gluten Aware</option>
                      <option value="SPICY">Spicy</option>
                      <option value="CONTAINS_NUTS">Contains Nuts</option>
                    </select>
                  </Field>
                  <Field label="Allergen Info">
                    <input className="input-field" value={itemForm.allergenInformation}
                      onChange={(e) => setItemForm({ ...itemForm, allergenInformation: e.target.value })}
                      placeholder="e.g. Contains milk, gluten" />
                  </Field>
                </div>

                <Field label="Public Description (shown on website)">
                  <textarea className="input-field min-h-[60px]" value={itemForm.publicDescription}
                    onChange={(e) => setItemForm({ ...itemForm, publicDescription: e.target.value })} />
                </Field>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <Button type="button" variant="secondary" onClick={() => setShowItemForm(false)}>Cancel</Button>
                  <Button type="submit" isLoading={saving}>{editingItem ? 'Update Item' : 'Save Item'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name or code..."
            className="flex-1 px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
          />
          <span className="text-xs text-[var(--color-text-muted)] self-center">
            {filteredItems.length} of {items.length} items
          </span>
        </div>

        {/* Items table */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<BookOpen className="h-12 w-12" />}
                title={search ? 'No matching items' : 'Menu is empty'}
                description={search ? 'Try a different search term.' : 'Add menu items, categorize them, and set pricing for your restaurant.'}
                action={canEdit && !search ? <Button onClick={openCreateItem}>Add Item</Button> : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                      <th className="px-4 py-3 w-12"></th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Station</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--color-bg-secondary)] transition-colors">
                        <td className="px-4 py-2">
                          <img src={getItemImage(item)} alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[item.itemType]; }} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{item.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
                            {item.isFeatured && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Featured
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">{item.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                          {item.category?.name ?? <span className="italic">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                          {item.kitchenStation?.name ?? <span className="italic">None</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={itemTypeBadge(item.itemType)}>{item.itemType}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{Number(item.price).toLocaleString()} RWF</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button onClick={() => toggleItemStatus(item, 'isAvailable')}
                              className={item.isAvailable ? badgeGreen : badgeRed}>
                              {item.isAvailable ? 'Avail' : 'Unavail'}
                            </button>
                            <button onClick={() => toggleItemStatus(item, 'isActive')}
                              className={item.isActive ? badgeGreen : badgeRed}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEditItem(item)}
                              className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                              title={canEdit ? 'Edit item' : 'View details'}>
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: CATEGORIES TAB
  // ==========================================

  function renderCategories() {
    return (
      <div className="space-y-4">
        {showCategoryForm && (
          <Card>
            <CardContent>
              <form onSubmit={submitCategory} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {editingCategory ? 'Edit category' : 'Add category'}
                  </h2>
                  <button type="button" onClick={() => setShowCategoryForm(false)}
                    className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Name *"><input className="input-field" value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></Field>
                  <Field label="Description">
                    <input className="input-field" value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                  </Field>
                  <Field label="Display Order">
                    <input className="input-field" type="number" min="0" value={categoryForm.displayOrder}
                      onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                  <Button type="submit" isLoading={saving}>{editingCategory ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {categories.length === 0 ? (
          <Card><CardContent>
            <EmptyState icon={<Layers className="h-12 w-12" />} title="No categories"
              description="Create menu categories to organize your items." action={canEdit ? <Button onClick={openCreateCategory}>Add Category</Button> : undefined} />
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.id}
                className={`p-4 rounded-xl border transition-all ${
                  cat.isActive ? 'border-[var(--color-border)]' : 'border-dashed border-[var(--color-border)] opacity-60'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditCategory(cat)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleCategory(cat)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                        title={cat.isActive ? 'Deactivate' : 'Activate'}>
                        {cat.isActive ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>Order: {cat.displayOrder}</span>
                  {cat.totalItems !== undefined && <span>{cat.totalItems} items</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: STATIONS TAB
  // ==========================================

  function renderStations() {
    return (
      <div className="space-y-4">
        {showStationForm && (
          <Card>
            <CardContent>
              <form onSubmit={submitStation} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {editingStation ? 'Edit station' : 'Add station'}
                  </h2>
                  <button type="button" onClick={() => setShowStationForm(false)}
                    className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Name *"><input className="input-field" value={stationForm.name}
                    onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} required /></Field>
                  <Field label="Description">
                    <input className="input-field" value={stationForm.description}
                      onChange={(e) => setStationForm({ ...stationForm, description: e.target.value })} />
                  </Field>
                  <Field label="Display Order">
                    <input className="input-field" type="number" min="0" value={stationForm.displayOrder}
                      onChange={(e) => setStationForm({ ...stationForm, displayOrder: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowStationForm(false)}>Cancel</Button>
                  <Button type="submit" isLoading={saving}>{editingStation ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {stations.length === 0 ? (
          <Card><CardContent>
            <EmptyState icon={<ChefHat className="h-12 w-12" />} title="No kitchen stations"
              description="Create kitchen stations to route orders to the right preparation area."
              action={canEdit ? <Button onClick={openCreateStation}>Add Station</Button> : undefined} />
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((st) => (
              <div key={st.id}
                className={`p-4 rounded-xl border transition-all ${
                  st.isActive ? 'border-[var(--color-border)]' : 'border-dashed border-[var(--color-border)] opacity-60'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-[var(--color-accent)]" />
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{st.name}</h3>
                      {st.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{st.description}</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditStation(st)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleStation(st)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                        title={st.isActive ? 'Deactivate' : 'Activate'}>
                        {st.isActive ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>Order: {st.displayOrder}</span>
                  {st.menuItemCount !== undefined && <span>{st.menuItemCount} items</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: RECIPES TAB
  // ==========================================

  function renderRecipes() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item selector */}
        <div>
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Select Menu Item</h3>
              <input
                type="text" placeholder="Search items..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm mb-3"
              />
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {(search ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : items).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadRecipe(item)}
                    className={`w-full text-left p-2.5 rounded-lg text-sm transition-all flex items-center gap-2 ${
                      selectedRecipeItem?.id === item.id
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-transparent'
                    }`}
                  >
                    <img src={getItemImage(item)} alt="" className="w-8 h-8 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[item.itemType]; }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{item.code}</p>
                    </div>
                    {item.trackInventory && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                        Tracked
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recipe detail */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent>
              {!selectedRecipeItem ? (
                <div className="py-12 text-center">
                  <Utensils className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)]">Select a menu item to view or edit its recipe</p>
                </div>
              ) : loadingRecipe ? (
                <Loading message="Loading recipe..." />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]">
                    <img src={getItemImage(selectedRecipeItem)} alt="" className="w-12 h-12 rounded-lg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[selectedRecipeItem.itemType]; }} />
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{selectedRecipeItem.name}</h3>
                      <p className="text-xs text-[var(--color-text-muted)]">{selectedRecipeItem.code}</p>
                    </div>
                  </div>

                  {!recipeData ? (
                    <div className="py-8 text-center">
                      <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm text-[var(--color-text-muted)]">No recipe defined for this item.</p>
                      {canEditStock && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Use inventory links or recipe ingredients to track stock deductions.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Recipe Name</p>
                          <p className="text-sm font-medium">{recipeData.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Yield</p>
                          <p className="text-sm font-medium">{recipeData.yieldQuantity} servings</p>
                        </div>
                      </div>

                      {recipeData.notes && (
                        <p className="text-sm text-[var(--color-text-muted)] italic">{recipeData.notes}</p>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Ingredients ({recipeData.ingredients.length})
                          </h4>
                          {canEditStock && (
                            <Button size="sm" variant="secondary" onClick={addIngredient}
                              leftIcon={<Plus className="h-3 w-3" />}>
                              Add Ingredient
                            </Button>
                          )}
                        </div>
                        {recipeData.ingredients.length === 0 ? (
                          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center italic">
                            No ingredients. Click "Add Ingredient" to define recipe components.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {recipeData.ingredients.map((ing) => (
                              <div key={ing.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                    <Package className="h-3.5 w-3.5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                      {ing.inventoryItemName}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                      Qty: {String(ing.quantityRequired)}
                                      {ing.wastagePercentage > 0 && ` · ${ing.wastagePercentage}% wastage`}
                                      {ing.stockLocationName && ` · ${ing.stockLocationName}`}
                                    </p>
                                  </div>
                                </div>
                                {canEditStock && (
                                  <button onClick={() => removeIngredient(ing.id)}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Remove ingredient">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
    </label>
  );
}

function Message({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${styles}`}>
      {tone === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      {children}
    </div>
  );
}

const badgeGreen = 'rounded-full bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300 cursor-pointer hover:ring-1 hover:ring-green-400';
const badgeRed = 'rounded-full bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300 cursor-pointer hover:ring-1 hover:ring-red-400';
const badgeGray = 'rounded-full bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 dark:bg-gray-900/40 dark:text-gray-400';

function itemTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    FOOD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    DRINK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    DESSERT: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  };
  return `rounded-full px-2 py-1 text-[10px] font-medium ${colors[type] || colors.OTHER}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
