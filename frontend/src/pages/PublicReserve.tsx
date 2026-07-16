import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Send, ChevronLeft, AlertCircle } from 'lucide-react';
import api from '@/services/api';

export default function PublicReserve() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [occasion, setOccasion] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<{
    enabled: boolean;
    maxPartySize: number | null;
    minLeadMinutes: number;
  } | null>(null);

  useEffect(() => {
    api.get('/public/reservation-options')
      .then((res) => setOptions(res.data.data))
      .catch(() => {});
  }, []);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
    setTime('19:00');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !date || !time) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/public/reservations', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        date,
        time,
        partySize,
        occasion: occasion.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
      });

      navigate(`/reservation/confirmation/${res.data.data.publicReference}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reserve a Table</h1>
        <p className="text-gray-500 mt-1">We'll confirm your reservation shortly</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {options && !options.enabled ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Online reservations are not currently available.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate.toISOString().split('T')[0]}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Party Size *</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-lg"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-gray-900 w-8 text-center">{partySize}</span>
                <button
                  type="button"
                  onClick={() => setPartySize(Math.min(options?.maxPartySize || 20, partySize + 1))}
                  className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-lg"
                >
                  +
                </button>
              </div>
              {options?.maxPartySize && partySize > options.maxPartySize && (
                <p className="text-xs text-red-500 mt-1">Maximum party size is {options.maxPartySize}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Occasion <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              >
                <option value="">Select...</option>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="business">Business Meeting</option>
                <option value="date">Date Night</option>
                <option value="family">Family Gathering</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Any special requirements?"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Request Reservation
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
