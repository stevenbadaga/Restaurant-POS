import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, MapPin, Phone, ArrowRight, ShoppingBag,
  ChevronRight, Star, UtensilsCrossed, Truck,
} from 'lucide-react';
import api from '@/services/api';

interface RestaurantInfo {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  currency: string;
  isOpen: boolean;
  currentStatus: 'open' | 'closed' | 'paused';
  openingHoursSummary: Array<{
    dayOfWeek: string;
    isClosed: boolean;
    periods: Array<{ openTime: string; closeTime: string }>;
  }>;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  itemCount: number;
}

interface FeaturedItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  publicDescription: string | null;
  categoryName: string | null;
  price: string;
  imageUrl: string | null;
  publicImageUrl: string | null;
  dietaryLabels: string | null;
  promotionBadge: string | null;
  isFeatured?: boolean;
}

interface Promotion {
  id: string;
  name: string;
  publicDescription: string | null;
  bannerImageUrl: string | null;
  percentageValue: string | null;
  fixedAmountValue: string | null;
  endAt: string;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function getDayLabel(day: string): string {
  const labels: Record<string, string> = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed',
    THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
  };
  return labels[day] || day;
}

export default function PublicHome() {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [restRes, catRes, menuRes, promoRes] = await Promise.all([
          api.get('/public/restaurant'),
          api.get('/public/menu/categories'),
          api.get('/public/menu'),
          api.get('/public/promotions'),
        ]);

        setRestaurant(restRes.data.data);
        setCategories(catRes.data.data || []);

        // Extract featured items from menu
        const menuData: Array<{ name: string; items: FeaturedItem[] }> = menuRes.data.data || [];
        const featured: FeaturedItem[] = [];
        for (const cat of menuData) {
          for (const item of cat.items) {
            if (item.isFeatured) featured.push(item);
            if (featured.length >= 6) break;
          }
          if (featured.length >= 6) break;
        }
        // Fallback: show first items if none featured
        if (featured.length === 0) {
          for (const cat of menuData) {
            for (const item of cat.items.slice(0, 3)) {
              featured.push(item);
              if (featured.length >= 6) break;
            }
            if (featured.length >= 6) break;
          }
        }
        setFeaturedItems(featured);
        setPromotions(promoRes.data.data || []);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <UtensilsCrossed className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">Restaurant not available</h2>
          <p className="text-gray-400 mt-2">Please check back later.</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayName = dayNames[today.getDay()];
  const todayHours = restaurant.openingHoursSummary.find((h) => h.dayOfWeek === todayName);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
        {restaurant.heroImageUrl && (
          <div className="absolute inset-0 opacity-30">
            <img
              src={restaurant.heroImageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                restaurant.currentStatus === 'paused'
                  ? 'bg-yellow-900/50 text-yellow-300'
                  : restaurant.isOpen
                    ? 'bg-green-900/50 text-green-300'
                    : 'bg-red-900/50 text-red-300'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  restaurant.currentStatus === 'paused'
                    ? 'bg-yellow-400'
                    : restaurant.isOpen
                      ? 'bg-green-400'
                      : 'bg-red-400'
                }`} />
                {restaurant.currentStatus === 'paused' ? 'Take a Break' : restaurant.isOpen ? 'Open Now' : 'Closed'}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              {restaurant.description
                ? restaurant.description.split('.')[0] + '.'
                : 'Delicious Food, Great Vibes'}
            </h1>

            <p className="text-lg text-gray-300 mb-8 max-w-xl">
              {restaurant.description || 'Experience exceptional cuisine crafted with passion.'}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/25"
              >
                <ShoppingBag className="h-5 w-5" />
                View Menu
                <ChevronRight className="h-4 w-4" />
              </Link>
              {restaurant.isOpen && (
                <Link
                  to="/order"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/10"
                >
                  <Truck className="h-5 w-5" />
                  Order Online
                </Link>
              )}
              <Link
                to="/reserve"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/10"
              >
                Reserve a Table
              </Link>
            </div>

            {/* Quick info */}
            <div className="flex flex-wrap gap-6 mt-10 text-sm text-gray-400">
              {restaurant.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-400" />
                  {restaurant.address}
                </span>
              )}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="flex items-center gap-2 hover:text-amber-400 transition-colors">
                  <Phone className="h-4 w-4 text-amber-400" />
                  {restaurant.phone}
                </a>
              )}
              {todayHours && !todayHours.isClosed && todayHours.periods[0] && (
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Open today: {formatTime(todayHours.periods[0].openTime)} – {formatTime(todayHours.periods[todayHours.periods.length - 1].closeTime)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Promotions Banner */}
      {promotions.length > 0 && (
        <section className="bg-gradient-to-r from-amber-500 to-orange-500 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center overflow-x-auto gap-6 scrollbar-hide">
              {promotions.map((promo) => (
                <div key={promo.id} className="flex items-center gap-3 shrink-0">
                  <span className="text-white text-sm font-semibold">{promo.name}</span>
                  {promo.percentageValue && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {promo.percentageValue}% OFF
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Items */}
      {featuredItems.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Featured Dishes</h2>
                <p className="text-gray-500 mt-1">Our most popular selections</p>
              </div>
              <Link
                to="/menu"
                className="hidden sm:inline-flex items-center gap-1 text-amber-600 font-medium hover:text-amber-700 transition-colors"
              >
                View Full Menu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredItems.map((item) => (
                <Link
                  key={item.id}
                  to="/public-menu"
                  className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-amber-200 transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                    {(item.publicImageUrl || item.imageUrl) ? (
                      <img
                        src={item.publicImageUrl || item.imageUrl!}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    {item.promotionBadge && (
                      <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                        {item.promotionBadge}
                      </span>
                    )}
                    {item.dietaryLabels && (
                      <div className="absolute top-3 right-3 flex gap-1">
                        {item.dietaryLabels.split(',').slice(0, 2).map((label) => (
                          <span key={label} className="bg-white/90 text-gray-700 text-[10px] font-medium px-1.5 py-0.5 rounded">
                            {label.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                      {item.name}
                    </h3>
                    {item.categoryName && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.categoryName}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-gray-900">
                        {restaurant.currency} {item.price}
                      </span>
                      <span className="text-xs text-amber-600 group-hover:translate-x-1 transition-transform">
                        Order now →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link
                to="/public-menu"
                className="inline-flex items-center gap-1 text-amber-600 font-medium hover:text-amber-700 transition-colors"
              >
                View Full Menu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">Explore Our Menu</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/menu/category/${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-amber-200 transition-all duration-300"
                >
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-24 object-cover rounded-lg mb-3"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg mb-3 flex items-center justify-center">
                      <Star className="h-8 w-8 text-amber-300" />
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{cat.itemCount} items</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Opening Hours */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Opening Hours</h2>
            <div className="space-y-2">
              {restaurant.openingHoursSummary.map((day) => {
                const isToday = day.dayOfWeek === todayName;
                return (
                  <div
                    key={day.dayOfWeek}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${
                      isToday ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-medium text-sm ${isToday ? 'text-amber-700' : 'text-gray-700'}`}>
                      {getDayLabel(day.dayOfWeek)}
                      {isToday && <span className="ml-2 text-xs text-amber-500">Today</span>}
                    </span>
                    <span className={`text-sm ${day.isClosed ? 'text-red-400' : 'text-gray-500'}`}>
                      {day.isClosed
                        ? 'Closed'
                        : day.periods.map((p) => `${formatTime(p.openTime)} – ${formatTime(p.closeTime)}`).join(', ')
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Order?</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Experience the finest dining from the comfort of your home.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 px-8 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/25"
            >
              <ShoppingBag className="h-5 w-5" />
              Order Now
            </Link>
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-8 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/10"
            >
              Browse Menu
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
