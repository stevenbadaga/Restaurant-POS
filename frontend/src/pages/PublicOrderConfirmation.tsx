import { useParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, ShoppingBag, Clock } from 'lucide-react';

export default function PublicOrderConfirmation() {
  const { publicReference } = useParams<{ publicReference: string }>();
  const location = useLocation();
  const trackingToken = (location.state as any)?.trackingToken;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500">Thank you for your order</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <p className="text-sm text-gray-500 mb-1">Order Reference</p>
        <p className="text-2xl font-bold font-mono text-gray-900 tracking-wider">
          {publicReference}
        </p>
        <p className="text-xs text-gray-400 mt-2">Please save this reference for tracking</p>
      </div>

      {trackingToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
          <p className="text-xs text-amber-700 font-medium mb-1">Tracking Token (save this)</p>
          <p className="text-sm font-mono text-amber-800">{trackingToken}</p>
        </div>
      )}

      <div className="space-y-3">
        <Link
          to={`/track-order/${publicReference}`}
          className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
        >
          <Package className="h-5 w-5" />
          Track Your Order
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/menu"
          className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingBag className="h-5 w-5" />
          Order More
        </Link>
        <Link
          to="/"
          className="w-full py-3 text-gray-500 rounded-xl font-medium hover:text-gray-700 transition-colors text-sm"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
