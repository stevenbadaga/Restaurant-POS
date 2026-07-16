import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState } from '@/components/ui';
import {
  createOrder, getMenuItems, getMenuCategories, getAvailableTables,
  type MenuItem, type MenuCategory, type RestaurantTable, type CreateOrderInput,
} from '@/services/orders';
import { formatCurrency, cn } from '@/lib';
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart, ChefHat,
  UtensilsCrossed, Search, AlertCircle,
  CheckCircle2, Send, Clock,
} from 'lucide-react';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions: string;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'PICKUP' | 'DELIVERY'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMenuItems(),
      getMenuCategories(),
      getAvailableTables(),
    ]).then(([items, cats, tbls]) => {
      setMenuItems(items.filter(i => i.isActive && i.isAvailable));
      setCategories(cats);
      setTables(tbls.filter(t => t.status === 'AVAILABLE'));
    }).catch(err => {
      setError(err?.message || 'Failed to load data');
    }).finally(() => setLoading(false));
  }, []);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (selectedCategory !== 'all' && item.category?.id !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart helpers
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + parseFloat(item.menuItem.price) * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem: item, quantity: 1, specialInstructions: '' }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.menuItem.id !== itemId) return i;
        const newQty = i.quantity + delta;
        return newQty <= 0 ? i : { ...i, quantity: newQty };
      }).filter(i => i.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.menuItem.id !== itemId));
  };

  const updateInstructions = (itemId: string, instructions: string) => {
    setCart(prev => prev.map(i => i.menuItem.id === itemId ? { ...i, specialInstructions: instructions } : i));
  };

  const clearCart = () => setCart([]);

  // Submit order
  const handleSubmit = async () => {
    if (cart.length === 0) { setError('Add at least one item to the order'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const input: CreateOrderInput = {
        orderType,
        tableId: selectedTableId || null,
        guestCount: orderType === 'DINE_IN' ? guestCount : null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        notes: notes || null,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
        })),
      };

      const result = await createOrder(input);
      setSuccess(`Order ${result.data.orderNumber} created successfully!`);
      setTimeout(() => {
        navigate(`/orders`);
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const typeIcons: Record<string, typeof UtensilsCrossed> = {
    DINE_IN: UtensilsCrossed, TAKEAWAY: ShoppingCart,
    PICKUP: Clock, DELIVERY: ChefHat,
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="New Order" description="Create a new customer order" />
        <Loading size="lg" message="Loading menu and tables..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="New Order"
        description="Create a new customer order"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/orders')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Orders
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm text-red-500 hover:underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Menu Browser */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Type + Table Selection */}
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Order Type */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Order Type</label>
                  <div className="flex gap-1.5">
                    {(['DINE_IN', 'TAKEAWAY', 'PICKUP', 'DELIVERY'] as const).map(type => {
                      const Icon = typeIcons[type];
                      return (
                        <button
                          key={type}
                          onClick={() => { setOrderType(type); if (type !== 'DINE_IN') setSelectedTableId(''); }}
                          className={cn(
                            'flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all',
                            orderType === type
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{type === 'DINE_IN' ? 'Dine In' : type.charAt(0) + type.slice(1).toLowerCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Table (Dine In only) */}
                {orderType === 'DINE_IN' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Table</label>
                    <select
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)]"
                    >
                      <option value="">No table</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code}) - Cap. {t.capacity}</option>
                      ))}
                    </select>
                  </div>
                )}

                {orderType === 'DINE_IN' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Guests</label>
                    <input type="number" min={1} value={guestCount} onChange={e => setGuestCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
                  </div>
                )}

                {/* Customer info */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">Customer</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in"
                    className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
                </div>
              </div>

              {/* Notes */}
              <div className="mt-3">
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Order notes (optional)"
                  className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Search + Categories */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm text-[var(--color-text-primary)]"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                selectedCategory === 'all' ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              )}
            >
              All ({menuItems.length})
            </button>
            {categories.map(cat => {
              const count = menuItems.filter(i => i.category?.id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                    selectedCategory === cat.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  )}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Menu Items Grid */}
          {filteredItems.length === 0 ? (
            <Card><CardContent>
              <EmptyState title="No items found" description={searchQuery ? 'Try a different search term.' : 'No items in this category.'} />
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map(item => {
                const inCart = cart.find(i => i.menuItem.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all hover:shadow-md',
                      inCart
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                        : 'border-[var(--color-border)] bg-[var(--color-card-bg)] hover:border-[var(--color-accent)]'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded',
                        item.itemType === 'FOOD' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          item.itemType === 'DRINK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            item.itemType === 'DESSERT' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>
                        {item.itemType}
                      </span>
                      {inCart && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight mb-1">
                      {item.name}
                    </p>
                    <p className="text-xs font-bold text-[var(--color-accent)]">
                      {formatCurrency(parseFloat(item.price))}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Cart ({cartItemCount})
                </h3>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-red-500 hover:underline">Clear</button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingCart className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">Tap menu items to add</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.menuItem.id} className="p-3 rounded-lg border border-[var(--color-border)]">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.menuItem.name}</p>
                        <button onClick={() => removeFromCart(item.menuItem.id)} className="text-red-400 hover:text-red-600 p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(item.menuItem.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-mono font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.menuItem.id, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">
                          {formatCurrency(parseFloat(item.menuItem.price) * item.quantity)}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={item.specialInstructions}
                        onChange={e => updateInstructions(item.menuItem.id, e.target.value)}
                        placeholder="Special instructions..."
                        className="mt-2 w-full px-2 py-1.5 text-xs rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              {cart.length > 0 && (
                <>
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">Subtotal</span>
                      <span className="font-medium">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleSubmit}
                      isLoading={submitting}
                      disabled={cart.length === 0}
                    >
                      <Send className="h-4 w-4" />
                      Submit Order to Kitchen
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick actions info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <ChefHat className="h-4 w-4" />
                <span>Order will be sent to the kitchen for preparation.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
