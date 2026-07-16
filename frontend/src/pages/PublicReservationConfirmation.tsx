import { useParams, Link } from 'react-router-dom';
import { Calendar, ChevronRight } from 'lucide-react';

export default function PublicReservationConfirmation() {
  const { publicReference } = useParams<{ publicReference: string }>();

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <Calendar className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Requested!</h1>
        <p className="text-gray-500">We'll confirm your reservation shortly</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <p className="text-sm text-gray-500 mb-1">Reservation Reference</p>
        <p className="text-2xl font-bold font-mono text-gray-900 tracking-wider">
          {publicReference || 'RES-XXXX'}
        </p>
        <p className="text-xs text-gray-400 mt-2">Please save this reference</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
        <p className="text-sm text-amber-700">
          Your reservation is pending confirmation. We will notify you once it's confirmed.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          to="/menu"
          className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
        >
          Browse Our Menu
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          to="/"
          className="w-full py-3 text-gray-500 rounded-xl font-medium hover:text-gray-700 transition-colors text-sm block"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
