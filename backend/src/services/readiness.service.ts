import { prisma } from '../database';

interface ReadinessCheck {
  key: string;
  label: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'WARNING' | 'NOT_APPLICABLE';
  severity: 'CRITICAL' | 'WARNING' | 'INFORMATION';
  description: string;
  resolutionRoute?: string;
  count?: number;
  metadata?: Record<string, unknown>;
}

interface ReadinessGroup {
  group: string;
  label: string;
  checks: ReadinessCheck[];
}

interface ReadinessResult {
  ready: boolean;
  completionPercentage: number;
  criticalIssues: number;
  warnings: number;
  groups: ReadinessGroup[];
}

export async function getSetupReadiness(restaurantId: string): Promise<ReadinessResult> {
  const groups: ReadinessGroup[] = [];

  // ==========================================
  // RESTAURANT GROUP
  // ==========================================
  const restaurantChecks: ReadinessCheck[] = [];
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  });

  if (!restaurant) {
    restaurantChecks.push({
      key: 'restaurant_exists',
      label: 'Restaurant exists',
      status: 'INCOMPLETE',
      severity: 'CRITICAL',
      description: 'No restaurant record found. System cannot operate.',
    });
  } else {
    // Restaurant name
    restaurantChecks.push({
      key: 'restaurant_name',
      label: 'Restaurant name',
      status: restaurant.name?.trim() ? 'COMPLETE' : 'INCOMPLETE',
      severity: 'CRITICAL',
      description: restaurant.name?.trim()
        ? `Restaurant name is set to "${restaurant.name}"`
        : 'Restaurant name is not configured',
      resolutionRoute: '/settings',
    });

    // Phone
    restaurantChecks.push({
      key: 'restaurant_phone',
      label: 'Phone number',
      status: restaurant.phone?.trim() ? 'COMPLETE' : 'INCOMPLETE',
      severity: 'INFORMATION',
      description: restaurant.phone?.trim()
        ? `Phone: ${restaurant.phone}`
        : 'Phone number is not configured',
      resolutionRoute: '/settings',
    });

    // Email
    restaurantChecks.push({
      key: 'restaurant_email',
      label: 'Email address',
      status: restaurant.email?.trim() ? 'COMPLETE' : 'WARNING',
      severity: 'WARNING',
      description: restaurant.email?.trim()
        ? `Email: ${restaurant.email}`
        : 'Email address is not configured',
      resolutionRoute: '/settings',
    });

    // Currency
    restaurantChecks.push({
      key: 'restaurant_currency',
      label: 'Currency',
      status: restaurant.currency?.trim() ? 'COMPLETE' : 'INCOMPLETE',
      severity: 'CRITICAL',
      description: `Currency: ${restaurant.currency || 'Not set'}`,
      resolutionRoute: '/settings',
    });

    // Timezone
    restaurantChecks.push({
      key: 'restaurant_timezone',
      label: 'Timezone',
      status: restaurant.timezone?.trim() ? 'COMPLETE' : 'INCOMPLETE',
      severity: 'CRITICAL',
      description: `Timezone: ${restaurant.timezone || 'Not set'}`,
      resolutionRoute: '/settings',
    });

    // Receipt footer
    restaurantChecks.push({
      key: 'receipt_footer',
      label: 'Receipt footer',
      status: restaurant.settings?.receiptFooter?.trim() ? 'COMPLETE' : 'WARNING',
      severity: 'INFORMATION',
      description: restaurant.settings?.receiptFooter?.trim()
        ? 'Receipt footer is configured'
        : 'No receipt footer set — receipts will show footer area as blank',
      resolutionRoute: '/settings/receipts',
    });

    // Business day start time
    restaurantChecks.push({
      key: 'business_day_start',
      label: 'Business day start time',
      status: restaurant.settings?.businessDayStartTime?.trim() ? 'COMPLETE' : 'INCOMPLETE',
      severity: 'WARNING',
      description: `Business day starts at: ${restaurant.settings?.businessDayStartTime || 'Not set (default: 00:00)'}`,
      resolutionRoute: '/settings',
    });
  }

  groups.push({ group: 'restaurant', label: 'Restaurant', checks: restaurantChecks });

  // ==========================================
  // STAFF GROUP
  // ==========================================
  const staffChecks: ReadinessCheck[] = [];
  const users = await prisma.user.findMany({
    where: { restaurantId },
    include: { roles: { include: { role: true } } },
  });

  const roleNames = users.flatMap((u) => u.roles.map((r) => r.role.name));
  const _rolesPresent = new Set(roleNames);

  // At least one ADMIN
  const admins = users.filter((u) => u.roles.some((r) => r.role.name === 'ADMIN'));
  staffChecks.push({
    key: 'admin_exists',
    label: 'At least one ADMIN',
    status: admins.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: admins.length > 0
      ? `${admins.length} admin(s) active`
      : 'No active administrator found',
    resolutionRoute: '/staff',
    count: admins.length,
  });

  // Required roles
  for (const role of ['MANAGER', 'WAITER', 'CHEF', 'CASHIER', 'STOCK_KEEPER']) {
    const count = users.filter((u) => u.roles.some((r) => r.role.name === role)).length;
    staffChecks.push({
      key: `${role.toLowerCase()}_exists`,
      label: `At least one ${role.replace(/_/g, ' ')}`,
      status: count > 0 ? 'COMPLETE' : 'WARNING',
      severity: 'WARNING',
      description: count > 0
        ? `${count} ${role.toLowerCase().replace(/_/g, ' ')}(s) active`
        : `No ${role.toLowerCase().replace(/_/g, ' ')} accounts exist`,
      resolutionRoute: '/staff',
      count,
    });
  }

  // Employee codes
  const usersWithoutCode = users.filter((u) => !u.employeeCode?.trim());
  staffChecks.push({
    key: 'employee_codes',
    label: 'All active users have employee codes',
    status: usersWithoutCode.length === 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: usersWithoutCode.length === 0
      ? 'All users have employee codes'
      : `${usersWithoutCode.length} user(s) missing employee code`,
    resolutionRoute: '/staff',
    count: usersWithoutCode.length,
  });

  // Temporary passwords changed
  const mustChangePw = users.filter((u) => u.mustChangePassword);
  staffChecks.push({
    key: 'temp_passwords_changed',
    label: 'Temporary passwords changed',
    status: mustChangePw.length === 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: mustChangePw.length === 0
      ? 'All users have changed temporary passwords'
      : `${mustChangePw.length} user(s) still need to change password`,
    resolutionRoute: '/staff',
    count: mustChangePw.length,
  });

  // Suspended accounts
  const suspended = users.filter((u) => u.status === 'SUSPENDED');
  if (suspended.length > 0) {
    staffChecks.push({
      key: 'unexpected_suspended',
      label: 'No unexpected suspended accounts',
      status: 'WARNING',
      severity: 'WARNING',
      description: `${suspended.length} account(s) are suspended. Verify this is intentional before launch.`,
      count: suspended.length,
      resolutionRoute: '/staff',
    });
  }

  groups.push({ group: 'staff', label: 'Staff', checks: staffChecks });

  // ==========================================
  // DINING GROUP
  // ==========================================
  const diningChecks: ReadinessCheck[] = [];
  const diningAreas = await prisma.diningArea.findMany({
    where: { restaurantId, isActive: true },
  });
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    include: { orders: { where: { status: { notIn: ['CLOSED', 'CANCELLED'] } } } },
  });

  diningChecks.push({
    key: 'dining_area_exists',
    label: 'At least one dining area',
    status: diningAreas.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: diningAreas.length > 0
      ? `${diningAreas.length} dining area(s) configured`
      : 'No dining areas created',
    resolutionRoute: '/tables',
    count: diningAreas.length,
  });

  const activeTables = tables.filter((t) => t.isActive);
  diningChecks.push({
    key: 'active_tables',
    label: 'At least one active table',
    status: activeTables.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: activeTables.length > 0
      ? `${activeTables.length} active table(s)`
      : 'No active tables configured',
    resolutionRoute: '/tables',
    count: activeTables.length,
  });

  // Table code uniqueness
  const codes = tables.map((t) => t.code);
  const duplicateCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
  diningChecks.push({
    key: 'table_codes_unique',
    label: 'Table codes are unique',
    status: duplicateCodes.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: duplicateCodes.length > 0
      ? `Duplicate table codes found: ${[...new Set(duplicateCodes)].join(', ')}`
      : 'All table codes are unique',
    resolutionRoute: '/tables',
    count: duplicateCodes.length,
  });

  // Table capacities
  const tablesWithoutCapacity = activeTables.filter((t) => !t.capacity || t.capacity < 1);
  diningChecks.push({
    key: 'table_capacities',
    label: 'Table capacities configured',
    status: tablesWithoutCapacity.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'WARNING',
    description: tablesWithoutCapacity.length === 0
      ? 'All tables have valid capacity'
      : `${tablesWithoutCapacity.length} table(s) missing capacity`,
    resolutionRoute: '/tables',
    count: tablesWithoutCapacity.length,
  });

  // Incorrectly occupied before launch
  const occupiedBeforeLaunch = tables.filter((t) => t.status === 'OCCUPIED' && t.orders.length === 0);
  if (occupiedBeforeLaunch.length > 0) {
    diningChecks.push({
      key: 'tables_occupied_no_order',
      label: 'No table is incorrectly occupied before launch',
      status: 'WARNING',
      severity: 'WARNING',
      description: `${occupiedBeforeLaunch.length} table(s) marked OCCUPIED with no active orders`,
      resolutionRoute: '/tables',
      count: occupiedBeforeLaunch.length,
    });
  }

  groups.push({ group: 'dining', label: 'Dining & Tables', checks: diningChecks });

  // ==========================================
  // MENU GROUP
  // ==========================================
  const menuChecks: ReadinessCheck[] = [];
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId, isActive: true },
  });
  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId },
    include: {
      category: true,
      kitchenStation: true,
      recipes: { include: { ingredients: true } },
    },
  });

  const activeCategories = categories.filter((c) => c.isActive);
  menuChecks.push({
    key: 'active_categories',
    label: 'At least one active category',
    status: activeCategories.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: activeCategories.length > 0
      ? `${activeCategories.length} active category(ies)`
      : 'No active menu categories',
    resolutionRoute: '/menu',
    count: activeCategories.length,
  });

  const activeItems = menuItems.filter((i) => i.isActive);
  menuChecks.push({
    key: 'active_menu_items',
    label: 'At least one active menu item',
    status: activeItems.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: activeItems.length > 0
      ? `${activeItems.length} active menu item(s)`
      : 'No active menu items',
    resolutionRoute: '/menu',
    count: activeItems.length,
  });

  // Menu items have prices
  const itemsWithoutPrice = activeItems.filter((i) => !i.price || i.price.lte(0));
  menuChecks.push({
    key: 'menu_items_prices',
    label: 'All active menu items have prices',
    status: itemsWithoutPrice.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: itemsWithoutPrice.length === 0
      ? 'All menu items have prices'
      : `${itemsWithoutPrice.length} item(s) missing price`,
    resolutionRoute: '/menu',
    count: itemsWithoutPrice.length,
  });

  // Kitchen station for prep items
  const prepItems = activeItems.filter((i) => i.requiresPreparation);
  const prepItemsWithoutStation = prepItems.filter((i) => !i.kitchenStationId);
  menuChecks.push({
    key: 'prep_items_have_station',
    label: 'Preparation items have kitchen stations',
    status: prepItemsWithoutStation.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'CRITICAL',
    description: prepItemsWithoutStation.length === 0
      ? 'All preparation-required items route to a kitchen station'
      : `${prepItemsWithoutStation.length} preparation item(s) missing kitchen station`,
    resolutionRoute: '/menu',
    count: prepItemsWithoutStation.length,
  });

  // Tracked items have recipes or inventory links
  const trackedItems = activeItems.filter((i) => i.trackInventory);
  const trackedWithoutRecipe = trackedItems.filter(
    (i) => i.recipes.length === 0 && i.trackInventory
  );

  // Check direct-service links separately
  const directServiceLinks = await prisma.menuItemInventoryLink.findMany({
    where: { restaurantId, menuItemId: { in: trackedItems.map((i) => i.id) }, isActive: true },
  });
  const linkedItemIds = new Set(directServiceLinks.map((l) => l.menuItemId));
  const trackedUnlinked = trackedWithoutRecipe.filter((i) => !linkedItemIds.has(i.id));

  menuChecks.push({
    key: 'tracked_items_have_recipe_or_link',
    label: 'Tracked inventory items have recipes or direct-service links',
    status: trackedUnlinked.length === 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: trackedUnlinked.length === 0
      ? 'All tracked menu items have recipes or direct-service links'
      : `${trackedUnlinked.length} tracked item(s) without recipes or links — stock will not be deducted`,
    resolutionRoute: '/menu',
    count: trackedUnlinked.length,
  });

  // Tax rates reviewed
  const itemsWithTaxVariation = activeItems.filter((i) => i.taxRate.gt(0));
  menuChecks.push({
    key: 'tax_rates_reviewed',
    label: 'Tax rates reviewed',
    status: itemsWithTaxVariation.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'INFORMATION',
    description: itemsWithTaxVariation.length > 0
      ? `${itemsWithTaxVariation.length} item(s) have tax configured`
      : 'No items have tax rates set — verify this is intended',
    count: itemsWithTaxVariation.length,
  });

  groups.push({ group: 'menu', label: 'Menu', checks: menuChecks });

  // ==========================================
  // KITCHEN GROUP
  // ==========================================
  const kitchenChecks: ReadinessCheck[] = [];
  const stations = await prisma.kitchenStation.findMany({
    where: { restaurantId, isActive: true },
  });

  kitchenChecks.push({
    key: 'active_stations',
    label: 'At least one active kitchen station',
    status: stations.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: stations.length > 0
      ? `${stations.length} active kitchen station(s)`
      : 'No kitchen stations configured',
    resolutionRoute: '/menu',
    count: stations.length,
  });

  // Unresolved test tickets
  const unresolvedTickets = await prisma.kitchenTicket.count({
    where: {
      restaurantId,
      status: { in: ['NEW', 'ACCEPTED', 'PREPARING', 'PARTIALLY_READY'] },
    },
  });
  if (unresolvedTickets > 0) {
    kitchenChecks.push({
      key: 'no_unresolved_tickets',
      label: 'No unresolved test tickets remain',
      status: 'WARNING',
      severity: 'WARNING',
      description: `${unresolvedTickets} ticket(s) still open. Resolve before launch.`,
      count: unresolvedTickets,
      resolutionRoute: '/kitchen',
    });
  }

  groups.push({ group: 'kitchen', label: 'Kitchen', checks: kitchenChecks });

  // ==========================================
  // INVENTORY GROUP
  // ==========================================
  const inventoryChecks: ReadinessCheck[] = [];
  const stockLocations = await prisma.stockLocation.findMany({
    where: { restaurantId, isActive: true },
  });

  inventoryChecks.push({
    key: 'default_stock_location',
    label: 'Default stock location exists',
    status: stockLocations.some((l) => l.isDefault) ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: stockLocations.some((l) => l.isDefault)
      ? `Default location: ${stockLocations.find((l) => l.isDefault)?.name}`
      : 'No default stock location — stock operations may fail',
    resolutionRoute: '/inventory/locations',
    count: stockLocations.length,
  });

  // Inventory items have units
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { restaurantId, isActive: true },
  });
  inventoryChecks.push({
    key: 'inventory_items_units',
    label: 'Inventory items have units',
    status: inventoryItems.every((i) => i.baseUnit) ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: inventoryItems.length > 0
      ? `${inventoryItems.length} item(s) with valid units`
      : 'No inventory items configured',
    resolutionRoute: '/inventory/items',
    count: inventoryItems.length,
  });

  // Reorder levels reviewed
  const itemsWithReorder = inventoryItems.filter((i) => i.reorderLevel.gt(0));
  inventoryChecks.push({
    key: 'reorder_levels_reviewed',
    label: 'Reorder levels reviewed',
    status: inventoryItems.length === 0 ? 'NOT_APPLICABLE' : 'COMPLETE',
    severity: 'INFORMATION',
    description: itemsWithReorder.length > 0
      ? `${itemsWithReorder.length} item(s) have reorder levels`
      : 'No reorder levels set — inventory alerts may not trigger',
    count: itemsWithReorder.length,
  });

  // Negative stock check
  const negativeBalances = await prisma.inventoryBalance.count({
    where: { restaurantId, onHandQuantity: { lt: 0 } },
  });
  if (negativeBalances > 0) {
    inventoryChecks.push({
      key: 'no_negative_stock',
      label: 'No unexplained negative stock',
      status: 'WARNING',
      severity: 'WARNING',
      description: `${negativeBalances} item(s) have negative stock balance`,
      count: negativeBalances,
      resolutionRoute: '/inventory/items',
    });
  }

  // Expired batches
  const expiredBatches = await prisma.stockBatch.count({
    where: {
      restaurantId,
      expiryDate: { lt: new Date() },
      remainingQuantity: { gt: 0 },
    },
  });
  if (expiredBatches > 0) {
    inventoryChecks.push({
      key: 'expired_batches_reviewed',
      label: 'Expired batches reviewed',
      status: 'WARNING',
      severity: 'WARNING',
      description: `${expiredBatches} expired batch(es) with remaining stock`,
      count: expiredBatches,
      resolutionRoute: '/inventory/items',
    });
  }

  groups.push({ group: 'inventory', label: 'Inventory', checks: inventoryChecks });

  // ==========================================
  // PAYMENTS GROUP
  // ==========================================
  const paymentChecks: ReadinessCheck[] = [];
  const settings = restaurant?.settings;
  const cashRegisters = await prisma.cashRegister.findMany({
    where: { restaurantId, status: 'ACTIVE' },
  });

  paymentChecks.push({
    key: 'payment_methods_reviewed',
    label: 'Payment methods reviewed',
    status: settings ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'WARNING',
    description: settings
      ? `Partial payments: ${settings.allowPartialPayments ? 'Yes' : 'No'}, Split payments: ${settings.allowSplitPayments ? 'Yes' : 'No'}`
      : 'Payment settings not configured',
    resolutionRoute: '/settings/payments',
  });

  paymentChecks.push({
    key: 'receipt_paper_size',
    label: 'Receipt paper size selected',
    status: settings?.receiptPaperSize ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'WARNING',
    description: settings?.receiptPaperSize
      ? `Paper size: ${settings.receiptPaperSize.replace(/_/g, ' ')}`
      : 'Receipt paper size not selected',
    resolutionRoute: '/settings/receipts',
  });

  paymentChecks.push({
    key: 'tax_service_charge_reviewed',
    label: 'Tax and service charge reviewed',
    status: settings ? 'COMPLETE' : 'INCOMPLETE',
    severity: 'INFORMATION',
    description: settings
      ? `Tax: ${settings.defaultTaxRate}%, Service charge: ${settings.serviceChargeRate}%`
      : 'Tax and service charge not configured',
    resolutionRoute: '/settings/payments',
  });

  paymentChecks.push({
    key: 'cash_register_exists',
    label: 'Cash register created',
    status: cashRegisters.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: cashRegisters.length > 0
      ? `${cashRegisters.length} active register(s)`
      : 'No cash registers configured',
    resolutionRoute: '/cash-registers',
    count: cashRegisters.length,
  });

  groups.push({ group: 'payments', label: 'Payments', checks: paymentChecks });

  // ==========================================
  // OPERATIONS GROUP
  // ==========================================
  const operationsChecks: ReadinessCheck[] = [];
  const shiftTemplates = await prisma.shiftTemplate.findMany({
    where: { restaurantId, isActive: true },
  });

  operationsChecks.push({
    key: 'shift_templates',
    label: 'Shift templates configured',
    status: shiftTemplates.length > 0 ? 'COMPLETE' : 'WARNING',
    severity: 'WARNING',
    description: shiftTemplates.length > 0
      ? `${shiftTemplates.length} active template(s)`
      : 'No shift templates created',
    resolutionRoute: '/shifts',
    count: shiftTemplates.length,
  });

  // Reservation settings
  operationsChecks.push({
    key: 'reservation_settings',
    label: 'Reservation settings reviewed',
    status: settings ? 'COMPLETE' : 'WARNING',
    severity: 'INFORMATION',
    description: settings?.reservationsEnabled
      ? `Reservations: Enabled, Default duration: ${settings.defaultReservationDurationMinutes} min`
      : 'Reservation settings not configured',
    resolutionRoute: '/settings',
  });

  // Loyalty settings
  operationsChecks.push({
    key: 'loyalty_settings',
    label: 'Loyalty settings reviewed',
    status: settings && settings.loyaltyEnabled ? 'COMPLETE' : 'NOT_APPLICABLE',
    severity: 'INFORMATION',
    description: settings?.loyaltyEnabled
      ? `Loyalty: Enabled, Points per currency: ${settings.pointsPerCurrencyUnit}`
      : 'Loyalty is disabled',
    resolutionRoute: '/settings',
  });

  // Backup location — check if any audit logs exist as proxy for backup config awareness
  operationsChecks.push({
    key: 'backup_awareness',
    label: 'Backup location configured',
    status: 'WARNING',
    severity: 'WARNING',
    description: 'Database backups should be configured at the infrastructure level. Ensure PostgreSQL backups are scheduled.',
  });

  groups.push({ group: 'operations', label: 'Operations', checks: operationsChecks });

  // ==========================================
  // CALCULATE RESULTS
  // ==========================================
  const allChecks = groups.flatMap((g) => g.checks);
  const totalChecks = allChecks.filter((c) => c.status !== 'NOT_APPLICABLE').length;
  const completeChecks = allChecks.filter((c) => c.status === 'COMPLETE').length;
  const criticalIssues = allChecks.filter(
    (c) => c.severity === 'CRITICAL' && c.status !== 'COMPLETE' && c.status !== 'NOT_APPLICABLE'
  ).length;
  const warnings = allChecks.filter(
    (c) => c.severity === 'WARNING' && c.status !== 'COMPLETE' && c.status !== 'NOT_APPLICABLE'
  ).length;

  return {
    ready: criticalIssues === 0,
    completionPercentage: totalChecks > 0 ? Math.round((completeChecks / totalChecks) * 100) : 0,
    criticalIssues,
    warnings,
    groups,
  };
}
