import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout, DashboardLayout, PublicRouteLayout } from '@/components/layout';
import { CartProvider } from '@/contexts/CartContext';
import {
  Login,
  Dashboard,
  Tables,
  Tips,
  Orders,
  NewOrder,
  Kitchen,
  Menu,
  Inventory,
  Payments,
  Receipts,
  Staff,
  Reports,
  Settings,
  MyShift,
  Shifts,
  Attendance,
  CashierSessions,
  Handovers,
  NewHandover,
  SetupChecklist,
  Customers,
  Reservations,
  PublicHome,
  PublicMenu,
  PublicOrder,
  PublicCheckout,
  PublicTrackOrder,
  PublicReserve,
  PublicOrderConfirmation,
  PublicAbout,
  PublicContact,
  PublicPrivacy,
  PublicTerms,
  PublicReservationConfirmation,
  QrCodes,
  QrMenu,
  Notifications,
  NotFound,
} from '@/pages';

function PublicLayoutWrapper() {
  return (
    <CartProvider>
      <PublicRouteLayout />
    </CartProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <Login />,
      },
    ],
  },
  {
    element: <DashboardLayout />,
    children: [
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/tables',
        element: <Tables />,
      },
      {
        path: '/tables/qr-codes',
        element: <QrCodes />,
      },
      {
        path: '/orders',
        element: <Orders />,
      },
      {
        path: '/orders/new',
        element: <NewOrder />,
      },
      {
        path: '/kitchen',
        element: <Kitchen />,
      },
      {
        path: '/menu',
        element: <Menu />,
      },
      // Inventory routes
      {
        path: '/inventory',
        element: <Inventory />,
      },
      {
        path: '/inventory/items',
        element: <Inventory />,
      },
      {
        path: '/inventory/items/:id',
        element: <Inventory />,
      },
      {
        path: '/inventory/categories',
        element: <Inventory />,
      },
      {
        path: '/inventory/locations',
        element: <Inventory />,
      },
      {
        path: '/inventory/suppliers',
        element: <Inventory />,
      },
      {
        path: '/inventory/receipts',
        element: <Inventory />,
      },
      {
        path: '/inventory/receipts/new',
        element: <Inventory />,
      },
      {
        path: '/inventory/receipts/:id',
        element: <Inventory />,
      },
      {
        path: '/inventory/movements',
        element: <Inventory />,
      },
      {
        path: '/inventory/adjustments',
        element: <Inventory />,
      },
      {
        path: '/inventory/waiter-usage',
        element: <Inventory />,
      },
      {
        path: '/inventory/waiter-usage/:waiterId',
        element: <Inventory />,
      },
      {
        path: '/inventory/alerts',
        element: <Inventory />,
      },
      // Payment routes
      {
        path: '/payments',
        element: <Payments />,
      },
      {
        path: '/payments/queue',
        element: <Payments />,
      },
      {
        path: '/payments/:id',
        element: <Payments />,
      },
      // Receipt routes
      {
        path: '/receipts',
        element: <Receipts />,
      },
      {
        path: '/receipts/:id',
        element: <Receipts />,
      },
      // Settings routes
      {
        path: '/settings/setup-checklist',
        element: <SetupChecklist />,
      },
      {
        path: '/settings',
        element: <Settings />,
      },
      {
        path: '/settings/payments',
        element: <Settings />,
      },
      {
        path: '/settings/receipts',
        element: <Settings />,
      },
      // Customers & Reservations
      {
        path: '/customers',
        element: <Customers />,
      },
      {
        path: '/customers/:id',
        element: <Customers />,
      },
      {
        path: '/reservations',
        element: <Reservations />,
      },
      {
        path: '/reservations/:id',
        element: <Reservations />,
      },
      // Phase 7: Shifts, Attendance & Cash
      {
        path: '/my-shift',
        element: <MyShift />,
      },
      {
        path: '/shifts',
        element: <Shifts />,
      },
      {
        path: '/shifts/new',
        element: <Shifts />,
      },
      {
        path: '/shifts/:id',
        element: <Shifts />,
      },
      {
        path: '/attendance',
        element: <Attendance />,
      },
      {
        path: '/attendance/:assignmentId',
        element: <Attendance />,
      },
      {
        path: '/cash-registers',
        element: <CashierSessions />,
      },
      {
        path: '/cashier-sessions',
        element: <CashierSessions />,
      },
      {
        path: '/cashier-sessions/:id',
        element: <CashierSessions />,
      },
      {
        path: '/handovers',
        element: <Handovers />,
      },
      {
        path: '/handovers/new',
        element: <NewHandover />,
      },
      {
        path: '/handovers/:id',
        element: <Handovers />,
      },
      // Tips & Pooling
      {
        path: '/tips',
        element: <Tips />,
      },
      // Notifications
      {
        path: '/notifications',
        element: <Notifications />,
      },
      // Other pages
      {
        path: '/staff',
        element: <Staff />,
      },
      // Reports library
      {
        path: '/reports',
        element: <Reports />,
      },
      // Report detail pages (dynamic route)
      {
        path: '/reports/:reportType',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      // Individual report pages (named routes for direct access)
      {
        path: '/reports/sales',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/sales-by-waiter',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/sales-by-item',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/sales-by-category',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/payments',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/payment-methods',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/outstanding',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/cashiers',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/refunds',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/receipts',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/kitchen',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/kitchen-stations',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/preparation-items',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/tables',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/dining-areas',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/order-types',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/order-statuses',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/cancellations',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/inventory-usage',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/inventory-cost',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/wastage',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/low-stock',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
      {
        path: '/reports/tax-service-charge',
        lazy: async () => ({
          Component: (await import('@/pages/reports/ReportDetail')).default,
        }),
      },
    ],
  },
  {
    element: <PublicLayoutWrapper />,
    children: [
      {
        path: '/welcome',
        element: <PublicHome />,
      },
      {
        path: '/menu',
        element: <PublicMenu />,
      },
      {
        path: '/menu/category/:categorySlug',
        element: <PublicMenu />,
      },
      {
        path: '/order',
        element: <PublicOrder />,
      },
      {
        path: '/order/checkout',
        element: <PublicCheckout />,
      },
      {
        path: '/order/confirmation/:publicReference',
        element: <PublicOrderConfirmation />,
      },
      {
        path: '/track-order',
        element: <PublicTrackOrder />,
      },
      {
        path: '/track-order/:publicReference',
        element: <PublicTrackOrder />,
      },
      {
        path: '/reserve',
        element: <PublicReserve />,
      },
      {
        path: '/reservation/confirmation/:publicReference',
        element: <PublicReservationConfirmation />,
      },
      {
        path: '/about',
        element: <PublicAbout />,
      },
      {
        path: '/contact',
        element: <PublicContact />,
      },
      {
        path: '/privacy',
        element: <PublicPrivacy />,
      },
      {
        path: '/terms',
        element: <PublicTerms />,
      },
      {
        path: '/qr/:tableToken',
        element: <QrMenu />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
