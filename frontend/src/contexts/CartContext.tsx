import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface CartItem {
  id: string; // unique cart item ID
  menuItemId: string;
  name: string;
  price: string; // stored as string to avoid floating-point issues; backend is authoritative
  quantity: number;
  instructions: string;
  imageUrl: string | null;
  categoryName: string | null;
  itemType: string;
  promotionBadge: string | null;
  isAvailable: boolean;
}

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  setRestaurantId: (id: string | null) => void;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateInstructions: (cartItemId: string, instructions: string) => void;
  clearCart: () => void;
  itemCount: number;
  estimatedSubtotal: number;
}

const CART_STORAGE_KEY = 'public_cart';
const CART_EXPIRY_HOURS = 4;

interface StoredCart {
  restaurantId: string | null;
  items: CartItem[];
  createdAt: string;
}

function loadCart(): StoredCart {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return { restaurantId: null, items: [], createdAt: new Date().toISOString() };

    const cart: StoredCart = JSON.parse(stored);

    // Check expiry
    const created = new Date(cart.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > CART_EXPIRY_HOURS) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return { restaurantId: null, items: [], createdAt: now.toISOString() };
    }

    return cart;
  } catch {
    return { restaurantId: null, items: [], createdAt: new Date().toISOString() };
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [storedCart, setStoredCart] = useState<StoredCart>(loadCart);
  

  const persist = useCallback((cart: StoredCart) => {
    setStoredCart(cart);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, []);

  const restaurantId = storedCart.restaurantId;
  const items = storedCart.items;

  const setRestaurantId = useCallback((id: string | null) => {
    if (id !== storedCart.restaurantId) {
      persist({ restaurantId: id, items: [], createdAt: new Date().toISOString() });
    }
  }, [storedCart.restaurantId, persist]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setStoredCart((prev) => {
      // Check if same item already exists (by menuItemId)
      const existingIndex = prev.items.findIndex((i) => i.menuItemId === item.menuItemId);
      let newItems: CartItem[];

      if (existingIndex >= 0) {
        newItems = [...prev.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + item.quantity,
          instructions: item.instructions || newItems[existingIndex].instructions,
        };
      } else {
        newItems = [...prev.items, { ...item, id }];
      }

      const newCart = { ...prev, items: newItems };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setStoredCart((prev) => {
      const newItems = prev.items.filter((i) => i.id !== cartItemId);
      const newCart = { ...prev, items: newItems };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity < 1) return;
    setStoredCart((prev) => {
      const newItems = prev.items.map((i) =>
        i.id === cartItemId ? { ...i, quantity } : i,
      );
      const newCart = { ...prev, items: newItems };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const updateInstructions = useCallback((cartItemId: string, instructions: string) => {
    setStoredCart((prev) => {
      const newItems = prev.items.map((i) =>
        i.id === cartItemId ? { ...i, instructions } : i,
      );
      const newCart = { ...prev, items: newItems };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    const newCart = { restaurantId: null, items: [], createdAt: new Date().toISOString() };
    persist(newCart);
  }, [persist]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedSubtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        setRestaurantId,
        addItem,
        removeItem,
        updateQuantity,
        updateInstructions,
        clearCart,
        itemCount,
        estimatedSubtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
