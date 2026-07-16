import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Truck, Store, ArrowRight, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import { useCart } from '@/contexts/CartContext';

export default function PublicOrder() {
  const [options, setOptions] = useState<{ pickupEnabled: boolean; deliveryEnabled: boolean } | null>(null);
  const [restaurant, setRestaurant] = useState<{ name: string; isOpen: boolean; currentStatus: string } | null>(null);
  const { itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [restRes, optRes] = await Promise.all([
          api.get('/public/restaurant'),
          api.get('/public/order-options'),
        ]);
        setRestaurant(restRes.data.data);
        setOptions(optRes.data.data);
      } catch {
        // Silent fail
      }
    }
    load();
  }, []);

  const isOpen = restaurant?.isOpen && restaurant?.currentStatus !== 'paused';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Cart indicator */}
      {itemCount > 0 && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">
              You have {itemCount} item{itemCount !== 1 ? 's' : ''} in your cart
            </p>
          </div>
          <Link
            to="/order/checkout"
            className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Go to checkout
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">Place Your Order</h1>
        <p className="text-gray-500 mt-2">
          {restaurant?.name ? `Order from ${restaurant.name}` : 'Choose how you\'d like to receive your order'}
        </p>
        {!isOpen && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
            <Store className="h-4 w-4" />
            {restaurant?.currentStatus === 'paused' ? 'Online ordering is currently paused' : 'Restaurant is currently closed'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pickup */}
        {options?.pickupEnabled !== false && (
          <button
            onClick={() => isOpen && navigate('/order/checkout?type=pickup')}
            disabled={!isOpen}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 p-8 text-left hover:border-amber-300 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-5 group-hover:bg-amber-100 transition-colors">
              <Store className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pickup</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              Order online and pick up your food at the restaurant. Pay when you arrive.
            </p>
            <div className="flex items-center gap-1 text-amber-600 font-medium text-sm group-hover:gap-2 transition-all">
              Order for pickup
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        )}

        {/* Delivery */}
        {options?.deliveryEnabled && (
          <button
            onClick={() => isOpen && navigate('/order/checkout?type=delivery')}
            disabled={!isOpen}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 p-8 text-left hover:border-amber-300 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-5 group-hover:bg-orange-100 transition-colors">
              <Truck className="h-7 w-7 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delivery</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              Get your food delivered to your door. Track your order in real-time.
            </p>
            <div className="flex items-center gap-1 text-orange-600 font-medium text-sm group-hover:gap-2 transition-all">
              Order for delivery
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        )}

        {/* Browse Menu */}
        <button
          onClick={() => navigate('/menu')}
          className="group relative bg-white rounded-2xl border-2 border-gray-100 p-8 text-left hover:border-gray-300 hover:shadow-xl transition-all duration-300 md:col-span-2"
        >
          <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <ShoppingBag className="h-7 w-7 text-gray-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Browse Full Menu</h2>
              <p className="text-gray-500 text-sm">Not sure what to order? Explore our menu first.</p>
            </div>
            <ChevronRight className="h-6 w-6 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
