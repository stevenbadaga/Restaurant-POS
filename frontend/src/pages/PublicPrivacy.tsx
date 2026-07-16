import { Link } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PublicPrivacy() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-amber-500" />
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      </div>
      <div className="prose prose-gray max-w-none text-gray-600 text-sm leading-relaxed space-y-4">
        <p>
          This privacy policy explains how we collect, use, and protect your personal information
          when you use our website and services.
        </p>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Name and contact information you provide when placing orders or making reservations</li>
          <li>Order history and preferences</li>
          <li>Information provided voluntarily through our contact forms</li>
        </ul>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">How We Use Your Information</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and fulfill your orders</li>
          <li>To manage your reservations</li>
          <li>To communicate about your orders and requests</li>
          <li>To improve our services</li>
        </ul>
        <h2 className="text-lg font-semibold text-gray-900 mt-6">Data Protection</h2>
        <p>
          We implement appropriate security measures to protect your personal information.
          We do not share your personal data with third parties except as necessary to fulfill your orders.
        </p>
        <p className="mt-8 text-xs text-gray-400 italic">
          This privacy policy is a placeholder and should be reviewed by a legal professional before public launch.
        </p>
      </div>
    </div>
  );
}
