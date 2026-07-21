import { Router } from 'express';
import { csrfTokenHandler } from '../middleware/csrf';
import healthRouter from './health';
import authRouter from './auth';
import setupRouter from './setup';
import staffRouter from './staff';
import diningAreasRouter from './dining-areas';
import tablesRouter from './tables';
import menuCategoriesRouter from './menu-categories';
import kitchenStationsRouter from './kitchen-stations';
import menuItemsRouter from './menu-items';
import menuImagesRouter from './menu-images';
import inventoryLocationsRouter from './inventory-locations';
import inventoryCategoriesRouter from './inventory-categories';
import inventoryItemsRouter from './inventory-items';
import suppliersRouter from './suppliers';
import stockReceiptsRouter from './stock-receipts';
import stockMovementsRouter from './stock-movements';
import recipesRouter from './recipes';
import ordersRouter from './orders';
import orderPaymentsRouter from './order-payments';
import kitchenRouter from './kitchen';
import notificationsRouter from './notifications';
import paymentsRouter from './payments';
import receiptsRouter from './receipts';
import reportRoutes from '../modules/reports/report.routes';
import shiftTemplatesRouter from './shift-templates';
import workShiftsRouter from './work-shifts';
import attendanceRouter from './attendance';
import cashRegistersRouter from './cash-registers';
import cashierSessionsRouter from './cashier-sessions';
import handoversRouter from './handovers';
import customersRouter from './customers';
import reservationsRouter from './reservations';
import waitingListRouter from './waiting-list';
import loyaltyRouter from './loyalty';
import promotionsRouter from './promotions';
import orderDiscountsRouter from './order-discounts';
import tipsRouter from './tips';
import settingsRouter from './settings';
import setupReadinessRouter from './setup-readiness';
import publicRouter from './public';
import publicOrdersRouter from './public-orders';
import qrRouter from './qr';
import publicQrRouter from './public-qr';
import approvalRequestsRouter from './approval-requests';
import printersRouter from './printers';
import backupRouter from './backup';

const router = Router();

// Security
router.get('/security/csrf-token', csrfTokenHandler);

// Health
router.use('/health', healthRouter);

// === Phase 1: Auth & Setup ===
router.use('/auth', authRouter);
router.use('/setup', setupRouter);
router.use('/setup', setupReadinessRouter);
router.use('/staff', staffRouter);

// === Phase 2: Menu (specific routes BEFORE general /menu) ===
router.use('/menu/items/images', menuImagesRouter);
router.use('/menu/categories', menuCategoriesRouter);
router.use('/menu/kitchen-stations', kitchenStationsRouter);
router.use('/menu/items', menuItemsRouter);
// General /menu routes (recipes, inventory links)
// Note: Ensure specific /menu/* routes above take precedence
router.use('/menu', recipesRouter);

// === Phase 2: Dining & Tables ===
router.use('/dining-areas', diningAreasRouter);
router.use('/tables', tablesRouter);

// === Phase 3: Orders & Kitchen ===
router.use('/orders', ordersRouter);
router.use('/orders', orderPaymentsRouter);
router.use('/kitchen', kitchenRouter);
router.use('/notifications', notificationsRouter);
router.use('/approval-requests', approvalRequestsRouter);

// === Phase 4: Inventory ===
router.use('/inventory/locations', inventoryLocationsRouter);
router.use('/inventory/categories', inventoryCategoriesRouter);
router.use('/inventory/items', inventoryItemsRouter);
router.use('/inventory/receipts', stockReceiptsRouter);
router.use('/inventory/movements', stockMovementsRouter);
router.use('/inventory/alerts', stockMovementsRouter);
router.use('/suppliers', suppliersRouter);

// === Phase 5: Payments & Receipts ===
router.use('/payments', paymentsRouter);
router.use('/receipts', receiptsRouter);

// === Tips & Tip Pooling ===
router.use('/tips', tipsRouter);

// === Phase 6: Reports ===
router.use('/reports', reportRoutes);

// === Phase 7: Shifts, Attendance & Cash ===
router.use('/shifts/templates', shiftTemplatesRouter);
router.use('/shifts', workShiftsRouter);
router.use('/attendance', attendanceRouter);
router.use('/cash-registers', cashRegistersRouter);
router.use('/cashier-sessions', cashierSessionsRouter);
router.use('/handovers', handoversRouter);

// Settings & Backup
router.use('/settings', settingsRouter);
// === Printing Infrastructure ===
router.use('/printers', printersRouter);

router.use('/backup', backupRouter);

// === Phase 10: Public website & online ordering ===
// Must be mounted before authenticated root-level routers below.
router.use('/public', publicRouter);
router.use('/public', publicOrdersRouter);
router.use('/public', publicQrRouter);

// === Phase 8: Customers, Reservations, Loyalty, Promotions ===
// Loyalty and discount routes must be mounted BEFORE customer/order routers
// to avoid prefix matching conflicts
router.use('/', loyaltyRouter);
router.use('/', orderDiscountsRouter);
router.use('/customers', customersRouter);
router.use('/reservations', reservationsRouter);
router.use('/waiting-list', waitingListRouter);
router.use('/promotions', promotionsRouter);

// === QR Code Management ===
router.use('/tables', qrRouter);

export default router;
