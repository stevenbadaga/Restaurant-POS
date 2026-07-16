import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QrCode, Store, AlertTriangle, ArrowRight, ShoppingBag, UtensilsCrossed, Coffee } from 'lucide-react';
import api from '@/services/api';
import { useCart } from '@/contexts/CartContext';

interface ValidationResult {
  tableName: string;
  tableCode: string;
  diningAreaName: string | null;
  restaurantId: string;
}

export default function QrMenu() {
  const { tableToken } = useParams<{ tableToken: string }>();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [restaurant, setRestaurant] = useState<{ name: string; logoUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setRestaurantId, setTableContext, itemCount, tableId } = useCart();

  useEffect(() => {
    if (!tableToken) {
      setError('Invalid QR code.');
      setLoading(false);
      return;
    }

    async function validate() {
      try {
        const res = await api.get(`/public/qr/validate/${tableToken}`);
        const data = res.data.data;
        setValidation(data);
        setRestaurantId(data.restaurantId);
        setTableContext(data.tableId, data.tableName);

        // Fetch restaurant info
        const restRes = await api.get('/public/restaurant');
        setRestaurant(restRes.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Invalid or expired QR code.');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [tableToken, setRestaurantId, setTableContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid QR Code</h1>
        <p className="text-gray-500 mb-8">{error}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
      {/* Table Info Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
        {restaurant?.logoUrl ? (
          <img
            src={restaurant.logoUrl}
            alt={restaurant.name}
            className="h-16 w-16 rounded-full object-cover mx-auto mb-4"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-amber-600" />
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {restaurant?.name || 'Restaurant'}
        </h1>

        <div className="mt-6 p-4 bg-amber-50 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <QrCode className="h-5 w-5 text-amber-600" />
            <span className="text-lg font-bold text-gray-900">{validation?.tableName}</span>
          </div>
          {validation?.diningAreaName && (
            <p className="text-sm text-amber-700">{validation.diningAreaName}</p>
          )}
          <p className="text-xs text-amber-600 mt-1">Table Code: {validation?.tableCode}</p>
        </div>

        <p className="text-gray-500 mt-6 text-sm">
          Browse the menu and order from your table. Your order will be prepared and brought to you.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Link
          to="/menu"
          className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
        >
          <ShoppingBag className="h-5 w-5" />
          Browse Menu
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/order?dinein=1"
          className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
        >
          <Coffee className="h-5 w-5" />
          Order to Table
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/order"
          className="w-full py-3.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-amber-300 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
        >
          <UtensilsCrossed className="h-5 w-5" />
          Order for Pickup / Delivery
        </Link>
      </div>

      {/* Cart indicator */}
      {itemCount > 0 && (
        <Link
          to="/order/checkout"
          className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-600 font-medium hover:text-amber-700 transition-colors"
        >
          <ShoppingBag className="h-4 w-4" />
          You have {itemCount} item{itemCount !== 1 ? 's' : ''} in your cart — Checkout
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
