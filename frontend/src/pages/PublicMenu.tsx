import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, SlidersHorizontal, ChevronDown, ChevronRight,
  ShoppingCart, UtensilsCrossed, Clock, Info, X,
} from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import api from '@/services/api';

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  publicDescription: string | null;
  categoryName: string | null;
  itemType: string;
  price: string;
  imageUrl: string | null;
  publicImageUrl: string | null;
  isAvailable: boolean;
  preparationTimeMinutes: number | null;
  dietaryLabels: string | null;
  allergenInformation: string | null;
  isFeatured: boolean;
  promotionBadge: string | null;
}

interface ItemDetailModal {
  item: MenuItem;
  categoryName: string;
}

function getItemImage(item: MenuItem): string | null {
  return item.publicImageUrl || item.imageUrl || null;
}

export default function PublicMenu() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [itemDetail, setItemDetail] = useState<ItemDetailModal | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addInstructions, setAddInstructions] = useState('');
  const [currency, setCurrency] = useState('');
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    async function load() {
      try {
        const [restRes, menuRes] = await Promise.all([
          api.get('/public/restaurant'),
          api.get('/public/menu'),
        ]);
        setCurrency(restRes.data.data.currency);
        const menuData: MenuCategory[] = menuRes.data.data || [];
        setCategories(menuData);

        // If category slug in URL, select that category
        if (categorySlug) {
          const found = menuData.find(
            (c) => c.name.toLowerCase().replace(/\s+/g, '-') === categorySlug.toLowerCase(),
          );
          if (found) setSelectedCategory(found.id);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [categorySlug]);

  const allItems = useMemo(() => {
    const items: MenuItem[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        items.push(item);
      }
    }
    return items;
  }, [categories]);

  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.publicDescription || i.description || '').toLowerCase().includes(q) ||
          (i.categoryName || '').toLowerCase().includes(q),
      );
    }

    // Filter by category
    if (selectedCategory) {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat) items = cat.items;
    }

    return items;
  }, [allItems, searchQuery, selectedCategory, categories]);

  function handleOpenDetail(item: MenuItem) {
    setItemDetail({
      item,
      categoryName: item.categoryName || '',
    });
    setAddQuantity(1);
    setAddInstructions('');
  }

  function handleAddToCart() {
    if (!itemDetail) return;
    addItem({
      menuItemId: itemDetail.item.id,
      name: itemDetail.item.name,
      price: itemDetail.item.price,
      quantity: addQuantity,
      instructions: addInstructions,
      imageUrl: getItemImage(itemDetail.item),
      categoryName: itemDetail.categoryName,
      itemType: itemDetail.item.itemType,
      promotionBadge: itemDetail.item.promotionBadge,
      isAvailable: itemDetail.item.isAvailable,
    });
    setItemDetail(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Our Menu</h1>
        <p className="text-gray-500 mt-1">Explore our selection of dishes</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide sm:pb-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              !selectedCategory
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-gray-500 mb-4">
          {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for "{searchQuery}"
        </p>
      )}

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">No items found</h3>
          <p className="text-gray-400 mt-1">Try adjusting your search or filter</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
            className="mt-4 px-4 py-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleOpenDetail(item)}
              className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden text-left hover:shadow-xl hover:border-amber-200 transition-all duration-300"
            >
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {getItemImage(item) ? (
                  <img
                    src={getItemImage(item)!}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UtensilsCrossed className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                {item.promotionBadge && (
                  <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                    {item.promotionBadge}
                  </span>
                )}
                {item.dietaryLabels && (
                  <div className="absolute top-3 right-3 flex gap-1">
                    {item.dietaryLabels.split(',').slice(0, 2).map((label) => (
                      <span key={label} className="bg-white/90 text-gray-700 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm">
                        {label.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                  {item.name}
                </h3>
                {item.categoryName && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.categoryName}</p>
                )}
                <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
                  {item.publicDescription || item.description || ''}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-gray-900">
                    {currency} {item.price}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Item Detail Modal */}
      {itemDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setItemDetail(null)}
          />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Image */}
            <div className="aspect-video bg-gray-100 relative overflow-hidden rounded-t-2xl sm:rounded-t-2xl">
              {getItemImage(itemDetail.item) ? (
                <img
                  src={getItemImage(itemDetail.item)!}
                  alt={itemDetail.item.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UtensilsCrossed className="h-16 w-16 text-gray-300" />
                </div>
              )}
              {itemDetail.item.promotionBadge && (
                <span className="absolute top-4 left-4 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
                  {itemDetail.item.promotionBadge}
                </span>
              )}
              <button
                onClick={() => setItemDetail(null)}
                className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{itemDetail.item.name}</h2>
                  {itemDetail.item.categoryName && (
                    <p className="text-sm text-gray-400">{itemDetail.item.categoryName}</p>
                  )}
                </div>
                <span className="text-2xl font-bold text-amber-600">
                  {currency} {itemDetail.item.price}
                </span>
              </div>

              <p className="text-gray-600 mt-4 text-sm leading-relaxed">
                {itemDetail.item.publicDescription || itemDetail.item.description || 'No description available.'}
              </p>

              {/* Dietary & allergen info */}
              {itemDetail.item.dietaryLabels && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {itemDetail.item.dietaryLabels.split(',').map((label) => (
                    <span key={label} className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                      {label.trim()}
                    </span>
                  ))}
                </div>
              )}

              {itemDetail.item.allergenInformation && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Allergen information: {itemDetail.item.allergenInformation}
                  </p>
                </div>
              )}

              <p className="mt-2 text-[10px] text-gray-400 italic">
                Please inform the restaurant about allergies. Cross-contamination may occur.
              </p>

              {itemDetail.item.preparationTimeMinutes && (
                <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>~{itemDetail.item.preparationTimeMinutes} min preparation</span>
                </div>
              )}

              {/* Quantity & Instructions */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-lg font-medium"
                    >
                      −
                    </button>
                    <span className="text-lg font-semibold text-gray-900 w-8 text-center">{addQuantity}</span>
                    <button
                      onClick={() => setAddQuantity(addQuantity + 1)}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special instructions
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    value={addInstructions}
                    onChange={(e) => setAddInstructions(e.target.value)}
                    placeholder="E.g., no onions, extra sauce..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none resize-none text-sm"
                  />
                </div>
              </div>

              {/* Add to cart button */}
              <button
                onClick={handleAddToCart}
                className="mt-6 w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Order — {currency} {(Number(itemDetail.item.price) * addQuantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart indicator */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Link
            to="/order/checkout"
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-full shadow-xl hover:bg-amber-600 transition-all hover:shadow-2xl hover:scale-105"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
