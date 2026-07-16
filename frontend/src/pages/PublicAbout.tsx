import { Link } from 'react-router-dom';
import { UtensilsCrossed, ChevronRight } from 'lucide-react';

export default function PublicAbout() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        Home <ChevronRight className="h-3 w-3" /> About
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">About Us</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-gray-600 leading-relaxed">
          Welcome to our restaurant. We are dedicated to providing exceptional dining experiences
          with carefully prepared dishes made from fresh, quality ingredients.
        </p>
        <div className="mt-8 p-6 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Our Philosophy</h2>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            We believe in great food served with a smile. Every dish is prepared with attention to detail,
            using the finest ingredients to create memorable meals for our guests.
          </p>
        </div>
      </div>
    </div>
  );
}
