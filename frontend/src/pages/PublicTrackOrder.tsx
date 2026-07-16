import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Package, Store, Truck, Clock, CheckCircle2,
  AlertCircle, ChevronRight, X,
} from 'lucide-react';
import api from '@/services/api';

interface TrackedOrder {
  restaurantName: string;
  publicReference: string;
  orderType: string;
  status: string;
  statusLabel: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  total: string;
  paymentChoice: string;
  paymentStatus: string;
  submittedAt: string;
  estimatedCompletion: string | null;
  pickupSummary: string | null;
  deliverySummary: string | null;
  cancellationStatus: string | null;
}

const STATUS_FLOW: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  RECEIVED: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Received' },
  AWAITING_CONFIRMATION: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Awaiting Confirmation' },
  ACCEPTED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Accepted' },
  PREPARING: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Being Prepared' },
  READY_FOR_PICKUP: { icon: Store, color: 'text-green-600', bg: 'bg-green-50', label: 'Ready for Pickup' },
  OUT_FOR_DELIVERY: { icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Out for Delivery' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Completed' },
  CANCELLED: { icon: X, color: 'text-red-600', bg: 'bg-red-50', label: 'Cancelled' },
  REJECTED: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Rejected' },
};

const STATUS_ORDER = [
  'RECEIVED', 'AWAITING_CONFIRMATION', 'ACCEPTED', 'PREPARING',
  'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED',
];

export default function PublicTrackOrder() {
  const { publicReference } = useParams<{ publicReference: string }>();
  const navigate = useNavigate();
  const [reference, setReference] = useState(publicReference || '');
  const [trackingToken, setTrackingToken] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (publicReference) {
      handleTrack();
    }
  }, [publicReference]);

  async function handleTrack(e?: React.FormEvent) {
    e?.preventDefault();
    if (!reference.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { reference: reference.trim() };
      if (trackingToken) params.token = trackingToken;

      const res = await api.get('/public/orders/track', { params });
      setOrder(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order not found. Please check your reference.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!cancelReason.trim() || !order) return;
    try {
      const params: Record<string, string> = {};
      if (trackingToken) params.token = trackingToken;

      await api.post(`/public/orders/${order.publicReference}/cancel-request`, {
        reason: cancelReason.trim(),
        ...params,
      });
      setShowCancel(false);
      setCancelReason('');
      // Refresh order
      handleTrack();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit cancellation request.');
    }
  }

  const statusInfo = order ? STATUS_FLOW[order.status] || null : null;
  const currentStepIndex = order ? STATUS_ORDER.indexOf(order.status) : -1;
  const canCancel = order && (order.status === 'AWAITING_CONFIRMATION' || order.status === 'ACCEPTED');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
        <p className="text-gray-500 mt-1">Enter your order reference to check the status</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleTrack} className="mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Order reference"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !reference.trim()}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={trackingToken}
            onChange={(e) => setTrackingToken(e.target.value)}
            placeholder="Tracking token (optional)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
          />
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Order Details */}
      {order && statusInfo && (
        <div className="space-y-6">
          {/* Status card */}
          <div className={`p-6 rounded-2xl ${statusInfo.bg}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-12 w-12 rounded-xl ${statusInfo.bg} flex items-center justify-center`}>
                <statusInfo.icon className={`h-6 w-6 ${statusInfo.color}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{statusInfo.label}</h2>
                <p className="text-sm text-gray-500">
                  {order.orderType === 'PICKUP' ? 'Pickup Order' : 'Delivery Order'} · {order.restaurantName}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Order reference: <span className="font-mono font-medium text-gray-700">{order.publicReference}</span>
            </p>
          </div>

          {/* Progress Steps */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Progress</h3>
            <div className="space-y-3">
              {STATUS_ORDER.slice(0, -1).map((step, index) => {
                const info = STATUS_FLOW[step];
                const isComplete = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isFuture = index > currentStepIndex;

                return (
                  <div key={step} className="flex items-start gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isComplete
                        ? 'bg-green-500'
                        : isCurrent
                          ? 'bg-amber-500'
                          : 'bg-gray-200'
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      ) : isCurrent ? (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        isCurrent ? 'text-amber-700' : isComplete ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        {info.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.quantity}x {item.name}</span>
                  <span className="text-gray-900 font-medium">{item.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-semibold text-gray-900">
              <span>Total</span>
              <span>{order.total}</span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3 text-sm">
            {order.pickupSummary && (
              <div className="flex items-start gap-2">
                <Store className="h-4 w-4 text-gray-400 mt-0.5" />
                <span className="text-gray-600">{order.pickupSummary}</span>
              </div>
            )}
            {order.deliverySummary && (
              <div className="flex items-start gap-2">
                <Truck className="h-4 w-4 text-gray-400 mt-0.5" />
                <span className="text-gray-600">{order.deliverySummary}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">
                Submitted: {new Date(order.submittedAt).toLocaleString()}
              </span>
            </div>
            {order.estimatedCompletion && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">
                  Estimated: {new Date(order.estimatedCompletion).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Payment:</span>
              <span className="text-gray-600">{order.paymentChoice} · {order.paymentStatus}</span>
            </div>
          </div>

          {/* Cancel Request */}
          {canCancel && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {!showCancel ? (
                <button
                  onClick={() => setShowCancel(true)}
                  className="w-full px-6 py-4 text-left text-sm text-red-600 hover:bg-red-50 transition-colors font-medium flex items-center justify-between"
                >
                  Request cancellation
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="p-6 space-y-3">
                  <h3 className="font-semibold text-gray-900">Request Cancellation</h3>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please tell us why you'd like to cancel..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-400 outline-none resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancel(false)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Keep Order
                    </button>
                    <button
                      onClick={handleCancelRequest}
                      disabled={!cancelReason.trim()}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      Submit Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!order && !loading && !error && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Enter your order reference to track it.</p>
        </div>
      )}
    </div>
  );
}
