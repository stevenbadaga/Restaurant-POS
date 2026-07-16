import { useState, useEffect } from 'react';
import { ChevronLeft, Phone, MapPin, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

export default function PublicContact() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<{
    phone: string | null;
    email: string | null;
    address: string | null;
    mapUrl: string | null;
  } | null>(null);

  useEffect(() => {
    api.get('/public/restaurant').then((res) => {
      const d = res.data.data;
      setInfo({
        phone: d.phone,
        email: d.email,
        address: d.address,
        mapUrl: d.mapUrl,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Contact Us</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {info?.phone && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <Phone className="h-6 w-6 text-amber-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
            <a href={`tel:${info.phone}`} className="text-gray-600 hover:text-amber-600 transition-colors">{info.phone}</a>
          </div>
        )}
        {info?.email && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <Mail className="h-6 w-6 text-amber-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
            <a href={`mailto:${info.email}`} className="text-gray-600 hover:text-amber-600 transition-colors">{info.email}</a>
          </div>
        )}
        {info?.address && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 md:col-span-2">
            <MapPin className="h-6 w-6 text-amber-500 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
            <p className="text-gray-600">{info.address}</p>
            {info.mapUrl && (
              <a href={info.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 mt-2 font-medium">
                View on map →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
