import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShoppingCart, Store, Truck, ChevronLeft, Clock, Shield, AlertTriangle } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import api from '@/services/api';

interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  minimumOrderAmount: string;
  deliveryFee: string;
  estimatedDeliveryMinutes: number;
}

interface QuoteResult {
  subtotal: string;
  deliveryFee: string;
  total: string;
}

export default function PublicCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { items, estimatedSubtotal, clearCart, restaurantId } = useCart();

  const orderType = searchParams.get('type') || 'pickup';

  // Checkout form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [promotionCode, setPromotionCode] = useState('');

  // Delivery-specific state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [city, setCity] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<{ name: string; currency: string } | null>(null);
  const [options, setOptions] = useState<{
    pickupPreparationMinutes: number;
    deliveryPreparationMinutes: number;
    publicMinimumOrderAmount: string;
  } | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isDelivery = orderType === 'delivery';

  // Suggested pickup times
  const suggestedTimes = useMemo(() => {
    const now = new Date();
    const prepMins = options?.pickupPreparationMinutes || 30;
    const slots: string[] = [];
    for (let i = 0; i < 6; i++) {
      const time = new Date(now.getTime() + prepMins * 60000 + i * 15 * 60000);
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = Math.ceil(time.getMinutes() / 15) * 15;
      if (minutes >= 60) continue;
      slots.push(`${hours}:${minutes.toString().padStart(2, '0')}`);
    }
    return slots;
  }, [options?.pickupPreparationMinutes]);

  useEffect(() => {
    async function load() {
      try {
        const [restRes, optRes, zoneRes] = await Promise.all([
          api.get('/public/restaurant'),
          api.get('/public/order-options'),
          api.get('/public/delivery-zones'),
        ]);
        setRestaurant(restRes.data.data);
        setOptions(optRes.data.data);
        setDeliveryZones(zoneRes.data.data || []);
      } catch {
        // Silent fail
      }
    }
    load();
  }, []);

  const selectedZone = useMemo(
    () => deliveryZones.find((z) => z.id === selectedZoneId),
    [deliveryZones, selectedZoneId],
  );

  const minimumOrder = isDelivery && selectedZone
    ? Number(selectedZone.minimumOrderAmount)
    : options ? Number(options.publicMinimumOrderAmount) : 0;

  const meetsMinimum = estimatedSubtotal >= minimumOrder;

  // Validate form
  const isFormValid = useMemo(() => {
    if (items.length === 0) return false;
    if (!customerName.trim()) return false;
    if (!phone.trim()) return false;
    if (isDelivery) {
      if (!selectedZoneId) return false;
      if (!addressLine1.trim()) return false;
      if (!city.trim()) return false;
    }
    return true;
  }, [items.length, customerName, phone, isDelivery, selectedZoneId, addressLine1, city]);

  async function handleSubmit() {
    if (!isFormValid || !meetsMinimum) return;

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        orderType: isDelivery ? 'DELIVERY' : 'PICKUP',
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          instructions: item.instructions || undefined,
        })),
        notes: orderNotes.trim() || undefined,
        promotionCode: promotionCode.trim() || undefined,
      };

      if (isDelivery) {
        payload.deliveryZoneId = selectedZoneId;
        payload.deliveryAddress = {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          neighbourhood: neighbourhood.trim() || undefined,
          city: city.trim(),
        };
        payload.deliveryInstructions = deliveryInstructions.trim() || undefined;
      } else {
        payload.requestedPickupTime = pickupTime || undefined;
      }

      const res = await api.post('/public/orders', payload);
      const order = res.data.data;

      clearCart();
      navigate(`/order/confirmation/${order.publicReference}`, {
        state: { trackingToken: order.trackingToken },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && !submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
        <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600">Your cart is empty</h2>
        <p className="text-gray-400 mt-1">Add items from the menu before checking out.</p>
        <Link
          to="/menu"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Order Summary */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </h3>

            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {restaurant?.currency || ''} {(Number(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {isDelivery && selectedZone && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Delivery fee</span>
                  <span className="text-gray-700">{restaurant?.currency || ''} {selectedZone.deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span>
                  {restaurant?.currency || ''}{' '}
                  {(
                    estimatedSubtotal +
                    (isDelivery && selectedZone ? Number(selectedZone.deliveryFee) : 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="flex items-center gap-3 mb-6">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              isDelivery ? 'bg-orange-50' : 'bg-amber-50'
            }`}>
              {isDelivery ? (
                <Truck className="h-5 w-5 text-orange-600" />
              ) : (
                <Store className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isDelivery ? 'Delivery Checkout' : 'Pickup Checkout'}
              </h1>
              <p className="text-sm text-gray-500">{restaurant?.name || 'Restaurant'}</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!meetsMinimum && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                Minimum order amount is {restaurant?.currency || ''} {minimumOrder.toFixed(2)}.
                Your current subtotal is {restaurant?.currency || ''} {estimatedSubtotal.toFixed(2)}.
              </p>
            </div>
          )}

          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            {isDelivery && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Delivery Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Zone *</label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                    >
                      <option value="">Select a zone</option>
                      {deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} ({restaurant?.currency || ''}{zone.deliveryFee} fee)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Street address"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 2
                        <span className="text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="Apartment, suite"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Neighbourhood
                        <span className="text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={neighbourhood}
                        onChange={(e) => setNeighbourhood(e.target.value)}
                        placeholder="Area"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Instructions
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      value={deliveryInstructions}
                      onChange={(e) => setDeliveryInstructions(e.target.value)}
                      placeholder="E.g., Gate code, landmark..."
                      rows={2}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pickup Time */}
            {!isDelivery && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Pickup Time</h3>
                <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Estimated preparation time: ~{options?.pickupPreparationMinutes || 30} minutes
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTimes.map((time) => (
                    <button
                      key={time}
                      onClick={() => setPickupTime(time)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        pickupTime === time
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Order Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Order Notes
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </h3>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Any special requests for the restaurant?"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Promotion Code */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Promotion Code
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                />
                <button className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
                  Apply
                </button>
              </div>
            </div>

            {/* Payment Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Payment</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-400" />
                  Pay on {isDelivery ? 'delivery' : 'pickup'} when you arrive.
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || !meetsMinimum || loading}
              className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Placing order...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  Place Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
