import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, Phone, MapPin, Clock } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import api from '@/services/api';

interface RestaurantInfo {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isOpen: boolean;
  currentStatus: 'open' | 'closed' | 'paused';
  currency: string;
}

export function PublicRouteLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const { items, itemCount, estimatedSubtotal, removeItem, updateQuantity, clearCart, setRestaurantId } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.get('/public/restaurant')
      .then((res) => {
        const data = res.data.data;
        setRestaurant(data);
        setRestaurantId(data.id);
      })
      .catch(() => {
        // Silent fail — restaurant info is not critical for layout
      });
  }, [setRestaurantId]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/welcome', label: 'Home' },
    { to: '/public-menu', label: 'Menu' },
    { to: '/order', label: 'Order Online' },
    { to: '/track-order', label: 'Track Order' },
    { to: '/reserve', label: 'Reserve' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      {restaurant && (
        <div className="bg-gray-900 text-white text-xs py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1 hover:text-amber-400 transition-colors">
                  <Phone className="h-3 w-3" />
                  <span>{restaurant.phone}</span>
                </a>
              )}
              {restaurant.address && (
                <span className="hidden sm:flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{restaurant.address}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span className={`font-medium ${restaurant.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                {restaurant.currentStatus === 'paused' ? 'Paused' : restaurant.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              {restaurant?.logoUrl ? (
                <img src={restaurant.logoUrl} alt={restaurant.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-lg">
                  {restaurant?.name?.charAt(0) || 'R'}
                </div>
              )}
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                {restaurant?.name || 'Restaurant'}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Cart button */}
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-6 w-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Cart Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCartDrawerOpen(false)}
          />

          {/* Drawer */}
          <div className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Your Order
                {itemCount > 0 && (
                  <span className="text-sm font-normal text-gray-500">({itemCount} items)</span>
                )}
              </h2>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close cart"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Your cart is empty</p>
                  <p className="text-sm text-gray-400 mt-1">Add items from the menu to get started</p>
                  <button
                    onClick={() => { setCartDrawerOpen(false); navigate('/public-menu'); }}
                    className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                  >
                    View Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-2 p-0.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                            aria-label={`Remove ${item.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {item.instructions && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.instructions}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-sm font-medium"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="text-sm font-medium text-gray-900 w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-sm font-medium"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">
                            {(Number(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Estimated subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {restaurant?.currency || ''} {estimatedSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearCart}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => { setCartDrawerOpen(false); navigate('/order/checkout'); }}
                    className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-3">
                {restaurant?.name || 'Restaurant'}
              </h3>
              {restaurant?.address && (
                <p className="text-sm flex items-start gap-2 mb-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                  <span>{restaurant.address}</span>
                </p>
              )}
              {restaurant?.phone && (
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-amber-400" />
                  <a href={`tel:${restaurant.phone}`} className="hover:text-white transition-colors">
                    {restaurant.phone}
                  </a>
                </p>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hours & Info */}
            <div>
              <h4 className="text-white font-semibold mb-3">Hours</h4>
              <p className="text-sm">
                {restaurant?.isOpen ? (
                  <span className="text-green-400 font-medium">Currently Open</span>
                ) : (
                  <span className="text-red-400 font-medium">Currently Closed</span>
                )}
              </p>
              <p className="text-xs mt-4 text-gray-500">
                Powered by Restaurant POS System
              </p>
              <div className="flex gap-3 mt-2">
                <Link to="/privacy" className="text-xs hover:text-white transition-colors">Privacy</Link>
                <Link to="/terms" className="text-xs hover:text-white transition-colors">Terms</Link>
                <Link to="/about" className="text-xs hover:text-white transition-colors">About</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs">
            <p>&copy; {new Date().getFullYear()} {restaurant?.name || 'Restaurant'}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
