import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Scale } from 'lucide-react';

export default function PublicTerms() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center gap-3 mb-6">
        <Scale className="h-8 w-8 text-amber-500" />
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      </div>
      <div className="prose prose-gray max-w-none text-gray-600 text-sm leading-relaxed space-y-4">
        <p>
          By using our website and services, you agree to these terms of service.
          Please read them carefully.
        </p>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Use of Service</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must provide accurate information when placing orders or making reservations</li>
          <li>You agree not to misuse our ordering system or submit fraudulent orders</li>
          <li>Menu items, prices, and availability are subject to change without notice</li>
        </ul>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Ordering</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>All orders are subject to acceptance by the restaurant</li>
          <li>We reserve the right to cancel or refuse orders</li>
          <li>Prices displayed on the website are subject to verification</li>
        </ul>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Limitation of Liability</h2>
        <p>
          We strive to provide accurate information but cannot guarantee that menu items,
          prices, or availability are always current. We are not liable for delays beyond
          our reasonable control.
        </p>
        <p className="mt-8 text-xs text-gray-400 italic">
          These terms of service are a placeholder and should be reviewed by a legal professional before public launch.
        </p>
      </div>
    </div>
  );
}
