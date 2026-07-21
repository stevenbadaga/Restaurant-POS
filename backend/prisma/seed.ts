import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// ==========================================
// HELPERS
// ==========================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function formatCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

const SEEDED_LOCAL_MENU_IMAGES: Record<string, { filename: string; label: string; color: string }> = {
  'Caesar Salad': { filename: 'seed-caesar-salad.svg', label: 'Caesar Salad', color: '#4f8f46' },
  'Ribeye Steak': { filename: 'seed-ribeye-steak.svg', label: 'Ribeye Steak', color: '#7f2f24' },
  'Tiramisu': { filename: 'seed-tiramisu.svg', label: 'Tiramisu', color: '#8a623d' },
  'Cappuccino': { filename: 'seed-cappuccino.svg', label: 'Cappuccino', color: '#9a6b42' },
};

async function createSeedLocalMenuImages(): Promise<Record<string, string>> {
  const uploadRoot = path.resolve(process.env.UPLOAD_DIRECTORY || './uploads');
  const menuDirectory = path.join(uploadRoot, 'menu');
  await fs.mkdir(menuDirectory, { recursive: true });

  const imageUrls: Record<string, string> = {};
  for (const [itemName, image] of Object.entries(SEEDED_LOCAL_MENU_IMAGES)) {
    const filePath = path.join(menuDirectory, image.filename);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${image.label}">
  <rect width="800" height="600" fill="${image.color}"/>
  <circle cx="650" cy="120" r="170" fill="rgba(255,255,255,0.16)"/>
  <circle cx="120" cy="520" r="210" fill="rgba(0,0,0,0.12)"/>
  <text x="64" y="308" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700">${image.label}</text>
  <text x="68" y="366" fill="rgba(255,255,255,0.82)" font-family="Arial, Helvetica, sans-serif" font-size="28">Savanna Bistro</text>
</svg>`;
    await fs.writeFile(filePath, svg, 'utf8');
    imageUrls[itemName] = `/uploads/menu/${image.filename}`;
  }

  return imageUrls;
}

// ==========================================
// DATA DEFINITIONS
// ==========================================

const ROLES = [
  { name: 'ADMIN', description: 'Full system access and control' },
  { name: 'MANAGER', description: 'Manage restaurant operations' },
  { name: 'WAITER', description: 'Handle tables and orders' },
  { name: 'CHEF', description: 'View and manage kitchen orders' },
  { name: 'CASHIER', description: 'Process payments and generate receipts' },
  { name: 'STOCK_KEEPER', description: 'Manage inventory and stock' },
] as const;

const RESTAURANT_DATA = {
  name: "Savanna Bistro",
  email: "info@savannabistro.com",
  phone: "+250 788 123 456",
  address: "123 KG 7 Ave, Kigali, Rwanda",
  currency: "USD",
  timezone: "Africa/Kigali",
};

interface UserSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  roles: string[];
}

const USERS: UserSeed[] = [
  {
    firstName: "Alice",
    lastName: "Mukamana",
    email: "manager@savannabistro.com",
    phone: "+250 788 111 001",
    employeeCode: "EMP001",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    firstName: "Bob",
    lastName: "Habimana",
    email: "waiter1@savannabistro.com",
    phone: "+250 788 111 002",
    employeeCode: "EMP002",
    roles: ["WAITER"],
  },
  {
    firstName: "Claire",
    lastName: "Uwimana",
    email: "waiter2@savannabistro.com",
    phone: "+250 788 111 003",
    employeeCode: "EMP003",
    roles: ["WAITER"],
  },
  {
    firstName: "David",
    lastName: "Niyonzima",
    email: "waiter3@savannabistro.com",
    phone: "+250 788 111 004",
    employeeCode: "EMP004",
    roles: ["WAITER"],
  },
  {
    firstName: "Elena",
    lastName: "Mugisha",
    email: "chef1@savannabistro.com",
    phone: "+250 788 111 005",
    employeeCode: "EMP005",
    roles: ["CHEF"],
  },
  {
    firstName: "Francis",
    lastName: "Kagame",
    email: "chef2@savannabistro.com",
    phone: "+250 788 111 006",
    employeeCode: "EMP006",
    roles: ["CHEF"],
  },
];

const KITCHEN_STATIONS = [
  { name: "Hot Kitchen", description: "Grill, fry & stove-top cooking" },
  { name: "Cold Kitchen", description: "Salads, cold appetizers & prep" },
  { name: "Pastry & Dessert", description: "Baking, pastries & desserts" },
  { name: "Bar", description: "Beverages, wines & cocktails" },
];

const MENU_CATEGORIES = [
  { name: "Starters & Appetizers", description: "Light dishes to begin your meal" },
  { name: "Main Courses", description: "Hearty and satisfying main dishes" },
  { name: "Pasta & Risotto", description: "Italian classics prepared fresh" },
  { name: "Desserts", description: "Sweet endings to your meal" },
  { name: "Beverages", description: "Hot and cold drinks" },
  { name: "Wines & Cocktails", description: "Curated wine selection and signature cocktails" },
];

interface MenuItemSeed {
  name: string;
  categoryName: string;
  kitchenStationName: string;
  description: string;
  itemType: "FOOD" | "DRINK" | "DESSERT" | "OTHER";
  price: number;
  costPrice: number;
  taxRate: number;
  preparationTimeMinutes: number;
  requiresPreparation: boolean;
  trackInventory: boolean;
  imageUrl: string;
  displayOrder: number;
}

const MENU_ITEMS: MenuItemSeed[] = [
  // Starters
  {
    name: "Bruschetta al Pomodoro",
    categoryName: "Starters & Appetizers",
    kitchenStationName: "Cold Kitchen",
    description: "Toasted sourdough topped with vine-ripened tomatoes, fresh basil, garlic, and extra virgin olive oil",
    itemType: "FOOD",
    price: 8.50,
    costPrice: 2.80,
    taxRate: 0,
    preparationTimeMinutes: 10,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400&h=300&fit=crop",
    displayOrder: 1,
  },
  {
    name: "Caesar Salad",
    categoryName: "Starters & Appetizers",
    kitchenStationName: "Cold Kitchen",
    description: "Crisp romaine lettuce, house-made croutons, parmesan shavings, and classic Caesar dressing",
    itemType: "FOOD",
    price: 10.00,
    costPrice: 3.20,
    taxRate: 0,
    preparationTimeMinutes: 8,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop",
    displayOrder: 2,
  },
  {
    name: "Calamari Fritti",
    categoryName: "Starters & Appetizers",
    kitchenStationName: "Hot Kitchen",
    description: "Lightly battered squid rings, flash-fried and served with spicy marinara and lemon aioli",
    itemType: "FOOD",
    price: 12.00,
    costPrice: 4.00,
    taxRate: 0,
    preparationTimeMinutes: 12,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop",
    displayOrder: 3,
  },
  {
    name: "Tomato Basil Soup",
    categoryName: "Starters & Appetizers",
    kitchenStationName: "Hot Kitchen",
    description: "Slow-roasted tomato soup with fresh basil, cream, and garlic croutons",
    itemType: "FOOD",
    price: 7.50,
    costPrice: 2.00,
    taxRate: 0,
    preparationTimeMinutes: 15,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
    displayOrder: 4,
  },
  // Main Courses
  {
    name: "Grilled Atlantic Salmon",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "Fresh Atlantic salmon fillet, herb-crusted, served with lemon butter sauce and seasonal vegetables",
    itemType: "FOOD",
    price: 24.00,
    costPrice: 8.50,
    taxRate: 0,
    preparationTimeMinutes: 20,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop",
    displayOrder: 5,
  },
  {
    name: "Ribeye Steak",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "12oz prime ribeye, char-grilled to perfection, served with truffle mash and grilled asparagus",
    itemType: "FOOD",
    price: 32.00,
    costPrice: 14.00,
    taxRate: 0,
    preparationTimeMinutes: 25,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop",
    displayOrder: 6,
  },
  {
    name: "Chicken Marsala",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "Pan-seared chicken breast in a rich Marsala wine sauce with mushrooms and fresh herbs",
    itemType: "FOOD",
    price: 18.00,
    costPrice: 6.00,
    taxRate: 0,
    preparationTimeMinutes: 20,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    displayOrder: 7,
  },
  {
    name: "Vegetarian Stir Fry",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "Wok-tossed seasonal vegetables with tofu, ginger, and soy glaze, served with jasmine rice",
    itemType: "FOOD",
    price: 15.00,
    costPrice: 4.50,
    taxRate: 0,
    preparationTimeMinutes: 15,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop",
    displayOrder: 8,
  },
  {
    name: "Lamb Chops",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "Herb-crusted New Zealand lamb chops with rosemary jus, roasted potatoes, and mint sauce",
    itemType: "FOOD",
    price: 28.00,
    costPrice: 12.00,
    taxRate: 0,
    preparationTimeMinutes: 22,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=400&h=300&fit=crop",
    displayOrder: 9,
  },
  {
    name: "Grilled Chicken Breast",
    categoryName: "Main Courses",
    kitchenStationName: "Hot Kitchen",
    description: "Free-range chicken breast marinated in herbs and lemon, served with roasted vegetables",
    itemType: "FOOD",
    price: 16.00,
    costPrice: 5.50,
    taxRate: 0,
    preparationTimeMinutes: 18,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop",
    displayOrder: 10,
  },
  // Pasta & Risotto
  {
    name: "Spaghetti Carbonara",
    categoryName: "Pasta & Risotto",
    kitchenStationName: "Hot Kitchen",
    description: "Classic Roman carbonara with guanciale, pecorino, egg yolk, and black pepper",
    itemType: "FOOD",
    price: 14.00,
    costPrice: 4.00,
    taxRate: 0,
    preparationTimeMinutes: 18,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop",
    displayOrder: 11,
  },
  {
    name: "Penne Arrabbiata",
    categoryName: "Pasta & Risotto",
    kitchenStationName: "Hot Kitchen",
    description: "Penne in a spicy tomato sauce with garlic, chili, and fresh parsley",
    itemType: "FOOD",
    price: 12.00,
    costPrice: 3.00,
    taxRate: 0,
    preparationTimeMinutes: 15,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1608219992759-8d74ed8d76eb?w=400&h=300&fit=crop",
    displayOrder: 12,
  },
  {
    name: "Risotto ai Funghi",
    categoryName: "Pasta & Risotto",
    kitchenStationName: "Hot Kitchen",
    description: "Creamy arborio risotto with wild mushrooms, parmesan, truffle oil, and fresh thyme",
    itemType: "FOOD",
    price: 16.00,
    costPrice: 5.00,
    taxRate: 0,
    preparationTimeMinutes: 25,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=300&fit=crop",
    displayOrder: 13,
  },
  // Desserts
  {
    name: "Tiramisu",
    categoryName: "Desserts",
    kitchenStationName: "Pastry & Dessert",
    description: "Classic Italian tiramisu with mascarpone, espresso-soaked ladyfingers, and cocoa dusting",
    itemType: "DESSERT",
    price: 8.00,
    costPrice: 2.50,
    taxRate: 0,
    preparationTimeMinutes: 5,
    requiresPreparation: false,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop",
    displayOrder: 14,
  },
  {
    name: "Chocolate Lava Cake",
    categoryName: "Desserts",
    kitchenStationName: "Pastry & Dessert",
    description: "Warm dark chocolate cake with a molten center, served with vanilla gelato",
    itemType: "DESSERT",
    price: 9.00,
    costPrice: 3.00,
    taxRate: 0,
    preparationTimeMinutes: 12,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop",
    displayOrder: 15,
  },
  {
    name: "Panna Cotta",
    categoryName: "Desserts",
    kitchenStationName: "Pastry & Dessert",
    description: "Silky vanilla panna cotta with mixed berry compote and fresh mint",
    itemType: "DESSERT",
    price: 7.50,
    costPrice: 2.00,
    taxRate: 0,
    preparationTimeMinutes: 5,
    requiresPreparation: false,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",
    displayOrder: 16,
  },
  // Beverages
  {
    name: "Espresso",
    categoryName: "Beverages",
    kitchenStationName: "Bar",
    description: "Single-origin espresso, rich and full-bodied",
    itemType: "DRINK",
    price: 3.00,
    costPrice: 0.50,
    taxRate: 0,
    preparationTimeMinutes: 3,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&h=300&fit=crop",
    displayOrder: 17,
  },
  {
    name: "Cappuccino",
    categoryName: "Beverages",
    kitchenStationName: "Bar",
    description: "Smooth espresso with velvety steamed milk and a thick foam crown",
    itemType: "DRINK",
    price: 4.50,
    costPrice: 0.80,
    taxRate: 0,
    preparationTimeMinutes: 5,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop",
    displayOrder: 18,
  },
  {
    name: "Fresh Orange Juice",
    categoryName: "Beverages",
    kitchenStationName: "Bar",
    description: "Freshly squeezed Valencia oranges, served chilled",
    itemType: "DRINK",
    price: 5.00,
    costPrice: 1.50,
    taxRate: 0,
    preparationTimeMinutes: 4,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop",
    displayOrder: 19,
  },
  {
    name: "Still Mineral Water",
    categoryName: "Beverages",
    kitchenStationName: "Bar",
    description: "Premium still mineral water, 500ml",
    itemType: "DRINK",
    price: 2.50,
    costPrice: 0.60,
    taxRate: 0,
    preparationTimeMinutes: 1,
    requiresPreparation: false,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1560023907-5f3395ea0d20?w=400&h=300&fit=crop",
    displayOrder: 20,
  },
  // Wines & Cocktails
  {
    name: "Red Wine (Glass)",
    categoryName: "Wines & Cocktails",
    kitchenStationName: "Bar",
    description: "House-selected red wine — served by the glass (180ml)",
    itemType: "DRINK",
    price: 8.00,
    costPrice: 3.00,
    taxRate: 0,
    preparationTimeMinutes: 2,
    requiresPreparation: false,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop",
    displayOrder: 21,
  },
  {
    name: "White Wine (Glass)",
    categoryName: "Wines & Cocktails",
    kitchenStationName: "Bar",
    description: "House-selected white wine — served by the glass (180ml)",
    itemType: "DRINK",
    price: 7.00,
    costPrice: 2.50,
    taxRate: 0,
    preparationTimeMinutes: 2,
    requiresPreparation: false,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=400&h=300&fit=crop",
    displayOrder: 22,
  },
  {
    name: "Mojito",
    categoryName: "Wines & Cocktails",
    kitchenStationName: "Bar",
    description: "White rum, fresh mint, lime, sugar, and soda water — refreshingly cool",
    itemType: "DRINK",
    price: 10.00,
    costPrice: 3.50,
    taxRate: 0,
    preparationTimeMinutes: 5,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop",
    displayOrder: 23,
  },
  {
    name: "Margarita",
    categoryName: "Wines & Cocktails",
    kitchenStationName: "Bar",
    description: "Tequila, triple sec, fresh lime juice, served on the rocks with salt rim",
    itemType: "DRINK",
    price: 11.00,
    costPrice: 4.00,
    taxRate: 0,
    preparationTimeMinutes: 5,
    requiresPreparation: true,
    trackInventory: false,
    imageUrl: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&h=300&fit=crop",
    displayOrder: 24,
  },
];

const INVENTORY_CATEGORIES = [
  { name: "Produce", description: "Fresh fruits, vegetables, and herbs" },
  { name: "Meat & Poultry", description: "Fresh and frozen meat products" },
  { name: "Seafood", description: "Fresh and frozen fish and seafood" },
  { name: "Dairy & Eggs", description: "Milk products, cheese, and eggs" },
  { name: "Dry Goods", description: "Pasta, rice, flour, canned goods, and spices" },
  { name: "Beverages", description: "Coffee, tea, juices, and soft drinks" },
  { name: "Wine & Spirits", description: "Wines, liquors, and cocktail ingredients" },
  { name: "Cleaning & Supplies", description: "Cleaning products and disposable supplies" },
];

interface InventoryItemSeed {
  name: string;
  categoryName: string;
  sku: string;
  description: string;
  baseUnit: "PIECE" | "PORTION" | "BOTTLE" | "CAN" | "PACK" | "BOX" | "GRAM" | "KILOGRAM" | "MILLILITRE" | "LITRE" | "OTHER";
  reorderLevel: number;
  targetStockLevel: number;
  averageCost: number;
}

const INVENTORY_ITEMS: InventoryItemSeed[] = [
  { name: "Tomatoes (Roma)", categoryName: "Produce", sku: "PRO-001", description: "Fresh Roma tomatoes", baseUnit: "KILOGRAM", reorderLevel: 5, targetStockLevel: 20, averageCost: 2.00 },
  { name: "Mixed Salad Greens", categoryName: "Produce", sku: "PRO-002", description: "Pre-washed mixed salad greens", baseUnit: "KILOGRAM", reorderLevel: 3, targetStockLevel: 10, averageCost: 3.50 },
  { name: "Fresh Basil", categoryName: "Produce", sku: "PRO-003", description: "Fresh basil bunches", baseUnit: "PIECE", reorderLevel: 10, targetStockLevel: 30, averageCost: 1.00 },
  { name: "Garlic", categoryName: "Produce", sku: "PRO-004", description: "Fresh garlic bulbs", baseUnit: "KILOGRAM", reorderLevel: 2, targetStockLevel: 8, averageCost: 4.00 },
  { name: "Lemons", categoryName: "Produce", sku: "PRO-005", description: "Fresh lemons", baseUnit: "KILOGRAM", reorderLevel: 3, targetStockLevel: 10, averageCost: 2.50 },
  { name: "Chicken Breast", categoryName: "Meat & Poultry", sku: "MEAT-001", description: "Free-range chicken breast fillet", baseUnit: "KILOGRAM", reorderLevel: 5, targetStockLevel: 20, averageCost: 8.50 },
  { name: "Beef Ribeye", categoryName: "Meat & Poultry", sku: "MEAT-002", description: "Prime ribeye steaks", baseUnit: "KILOGRAM", reorderLevel: 3, targetStockLevel: 12, averageCost: 22.00 },
  { name: "Lamb Rack", categoryName: "Meat & Poultry", sku: "MEAT-003", description: "New Zealand lamb rack", baseUnit: "KILOGRAM", reorderLevel: 2, targetStockLevel: 8, averageCost: 18.00 },
  { name: "Atlantic Salmon", categoryName: "Seafood", sku: "SEA-001", description: "Fresh Atlantic salmon fillet", baseUnit: "KILOGRAM", reorderLevel: 3, targetStockLevel: 10, averageCost: 14.00 },
  { name: "Squid (Calamari)", categoryName: "Seafood", sku: "SEA-002", description: "Fresh cleaned squid tubes", baseUnit: "KILOGRAM", reorderLevel: 2, targetStockLevel: 8, averageCost: 9.00 },
  { name: "Parmesan Cheese", categoryName: "Dairy & Eggs", sku: "DRY-001", description: "Aged parmesan cheese wedge", baseUnit: "KILOGRAM", reorderLevel: 2, targetStockLevel: 6, averageCost: 15.00 },
  { name: "Mascarpone Cheese", categoryName: "Dairy & Eggs", sku: "DRY-002", description: "Italian mascarpone cheese", baseUnit: "KILOGRAM", reorderLevel: 1, targetStockLevel: 4, averageCost: 12.00 },
  { name: "Eggs (Free Range)", categoryName: "Dairy & Eggs", sku: "DRY-003", description: "Free-range large eggs", baseUnit: "PACK", reorderLevel: 5, targetStockLevel: 20, averageCost: 4.00 },
  { name: "Heavy Cream", categoryName: "Dairy & Eggs", sku: "DRY-004", description: "Fresh heavy whipping cream", baseUnit: "LITRE", reorderLevel: 2, targetStockLevel: 8, averageCost: 5.00 },
  { name: "Spaghetti Pasta", categoryName: "Dry Goods", sku: "DRY-005", description: "Premium durum wheat spaghetti", baseUnit: "KILOGRAM", reorderLevel: 5, targetStockLevel: 15, averageCost: 3.00 },
  { name: "Arborio Rice", categoryName: "Dry Goods", sku: "DRY-006", description: "Italian arborio rice for risotto", baseUnit: "KILOGRAM", reorderLevel: 3, targetStockLevel: 10, averageCost: 4.50 },
  { name: "Olive Oil", categoryName: "Dry Goods", sku: "DRY-007", description: "Extra virgin olive oil", baseUnit: "LITRE", reorderLevel: 3, targetStockLevel: 10, averageCost: 12.00 },
  { name: "Coffee Beans", categoryName: "Beverages", sku: "BEV-001", description: "Single-origin espresso coffee beans", baseUnit: "KILOGRAM", reorderLevel: 2, targetStockLevel: 8, averageCost: 18.00 },
  { name: "Orange Juice Concentrate", categoryName: "Beverages", sku: "BEV-002", description: "Premium orange juice concentrate", baseUnit: "LITRE", reorderLevel: 3, targetStockLevel: 10, averageCost: 4.00 },
  { name: "Red Wine (House)", categoryName: "Wine & Spirits", sku: "WIN-001", description: "House red wine (Cabernet Sauvignon)", baseUnit: "BOTTLE", reorderLevel: 6, targetStockLevel: 24, averageCost: 8.00 },
  { name: "White Wine (House)", categoryName: "Wine & Spirits", sku: "WIN-002", description: "House white wine (Sauvignon Blanc)", baseUnit: "BOTTLE", reorderLevel: 6, targetStockLevel: 24, averageCost: 7.00 },
  { name: "White Rum", categoryName: "Wine & Spirits", sku: "SPI-001", description: "Premium white rum for cocktails", baseUnit: "BOTTLE", reorderLevel: 2, targetStockLevel: 6, averageCost: 15.00 },
  { name: "Tequila", categoryName: "Wine & Spirits", sku: "SPI-002", description: "Silver tequila for cocktails", baseUnit: "BOTTLE", reorderLevel: 2, targetStockLevel: 6, averageCost: 18.00 },
];

const STOCK_LOCATIONS = [
  { name: "Main Store", code: "MAIN", description: "Main dry goods and bulk storage", isDefault: true },
  { name: "Kitchen Store", code: "KITCHEN", description: "Walk-in fridge and kitchen prep area", isDefault: false },
  { name: "Bar Store", code: "BAR", description: "Bar beverages and spirits storage", isDefault: false },
];

const SUPPLIERS = [
  { name: "Fresh Farm Produce Ltd", supplierCode: "SUP-001", contactPerson: "Jean-Pierre Habimana", phone: "+250 788 200 001", email: "orders@freshfarm.rw", address: "15 KG 15 Ave, Kigali", notes: "Delivery every Mon, Wed, Fri" },
  { name: "Premium Meats Co", supplierCode: "SUP-002", contactPerson: "Patrick Niyibizi", phone: "+250 788 200 002", email: "sales@premiummeats.rw", address: "42 KN 5 Rd, Kigali", notes: "Requires 48hr advance order" },
  { name: "Dairy Delight Ltd", supplierCode: "SUP-003", contactPerson: "Marie Claire Uwase", phone: "+250 788 200 003", email: "info@dairydelight.rw", address: "8 KG 218 St, Kigali", notes: "Delivers daily by 7am" },
  { name: "Global Beverages Inc", supplierCode: "SUP-004", contactPerson: "David Mugabo", phone: "+250 788 200 004", email: "orders@globalbeverages.rw", address: "100 KN 3 Rd, Kigali", notes: "Monthly bulk order discount available" },
];

const DINING_AREAS = [
  { name: "Main Hall", description: "Indoor main dining area", displayOrder: 1 },
  { name: "Terrace", description: "Outdoor terrace with garden view", displayOrder: 2 },
  { name: "VIP Room", description: "Private dining room for special occasions", displayOrder: 3 },
];

interface TableSeed {
  name: string;
  code: string;
  capacity: number;
  shape: "SQUARE" | "RECTANGLE" | "ROUND" | "OVAL";
  diningAreaName: string;
  positionX: number;
  positionY: number;
}

const TABLES: TableSeed[] = [
  { name: "T1", code: "T01", capacity: 2, shape: "SQUARE", diningAreaName: "Main Hall", positionX: 10, positionY: 10 },
  { name: "T2", code: "T02", capacity: 2, shape: "SQUARE", diningAreaName: "Main Hall", positionX: 10, positionY: 40 },
  { name: "T3", code: "T03", capacity: 4, shape: "ROUND", diningAreaName: "Main Hall", positionX: 40, positionY: 10 },
  { name: "T4", code: "T04", capacity: 4, shape: "ROUND", diningAreaName: "Main Hall", positionX: 40, positionY: 40 },
  { name: "T5", code: "T05", capacity: 6, shape: "RECTANGLE", diningAreaName: "Main Hall", positionX: 70, positionY: 10 },
  { name: "T6", code: "T06", capacity: 6, shape: "RECTANGLE", diningAreaName: "Main Hall", positionX: 70, positionY: 40 },
  { name: "T7", code: "T07", capacity: 2, shape: "ROUND", diningAreaName: "Terrace", positionX: 10, positionY: 10 },
  { name: "T8", code: "T08", capacity: 4, shape: "ROUND", diningAreaName: "Terrace", positionX: 10, positionY: 40 },
  { name: "T9", code: "T09", capacity: 4, shape: "RECTANGLE", diningAreaName: "Terrace", positionX: 40, positionY: 10 },
  { name: "T10", code: "T10", capacity: 8, shape: "RECTANGLE", diningAreaName: "Terrace", positionX: 40, positionY: 40 },
  { name: "T11", code: "T11", capacity: 10, shape: "ROUND", diningAreaName: "VIP Room", positionX: 25, positionY: 25 },
  { name: "T12", code: "T12", capacity: 12, shape: "RECTANGLE", diningAreaName: "VIP Room", positionX: 25, positionY: 60 },
];

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

async function main() {
  console.log('🌱 Seeding database...\n');

  // --- Check if already seeded ---
  const existingRestaurant = await prisma.restaurant.findFirst();
  if (existingRestaurant) {
    console.log('ℹ️  Database already seeded. Skipping.\n');
    console.log('📋 Test login credentials (password: "password123"):');
    console.log('   Manager: manager@savannabistro.com');
    console.log('   Waiters: waiter1@savannabistro.com, waiter2@savannabistro.com, waiter3@savannabistro.com');
    console.log('   Chefs:   chef1@savannabistro.com, chef2@savannabistro.com');
    return;
  }

  // --- 1. Roles ---
  console.log('📋 Creating roles...');
  const roleRecords: Record<string, string> = {};
  for (const role of ROLES) {
    const existing = await prisma.role.findUnique({ where: { name: role.name } });
    if (existing) {
      roleRecords[role.name] = existing.id;
      console.log(`   ℹ️  Role "${role.name}" already exists`);
    } else {
      const created = await prisma.role.create({ data: role });
      roleRecords[role.name] = created.id;
      console.log(`   ✅ Role "${role.name}" created`);
    }
  }

  // --- 2. Restaurant ---
  console.log('\n🏪 Creating restaurant...');
  const restaurant = await prisma.restaurant.create({
    data: {
      ...RESTAURANT_DATA,
      settings: {
        create: {
          defaultTaxRate: 0,
          serviceChargeRate: 10,
          receiptFooter: 'Thank you for dining at Savanna Bistro!',
          orderNumberPrefix: 'ORD',
          receiptNumberPrefix: 'REC',
          allowPartialPayments: true,
          allowSplitPayments: true,
          requireReferenceForMobileMoney: true,
          receiptShowWaiter: true,
          receiptShowTaxBreakdown: true,
          businessDayStartTime: '08:00',
          // Shift settings
          allowUnscheduledClockIn: true,
          allowEmployeeSelfClockIn: true,
          allowEmployeeSelfClockOut: true,
          // Phase 8 settings
          reservationsEnabled: true,
          defaultReservationDurationMinutes: 120,
          publicWebsiteEnabled: true,
          publicOrderingEnabled: true,
          pickupEnabled: true,
          publicRestaurantDescription: 'A contemporary bistro serving fresh, locally-sourced international cuisine in the heart of Kigali.',
        },
      },
    },
  });
  console.log(`   ✅ Restaurant "${restaurant.name}" created (ID: ${restaurant.id})`);

  // --- 3. Users ---
  console.log('\n👤 Creating users...');
  const passwordHash = await hashPassword('password123');
  const userRecords: Record<string, { id: string; email: string }> = {};

  for (const userData of USERS) {
    // Create user
    const user = await prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        employeeCode: userData.employeeCode,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    // Assign roles
    for (const roleName of userData.roles) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecords[roleName],
        },
      });
    }

    const key = userData.email.split('@')[0]; // e.g., "manager", "waiter1"
    userRecords[key] = { id: user.id, email: userData.email };
    console.log(`   ✅ User "${userData.email}" created with role(s): ${userData.roles.join(', ')}`);
  }

  // --- 4. Kitchen Stations ---
  console.log('\n🍳 Creating kitchen stations...');
  const kitchenStationRecords: Record<string, string> = {};
  for (let i = 0; i < KITCHEN_STATIONS.length; i++) {
    const ks = await prisma.kitchenStation.create({
      data: {
        restaurantId: restaurant.id,
        name: KITCHEN_STATIONS[i].name,
        description: KITCHEN_STATIONS[i].description,
        displayOrder: i + 1,
      },
    });
    kitchenStationRecords[ks.name] = ks.id;
    console.log(`   ✅ Kitchen Station "${ks.name}" created`);
  }

  // --- 5. Menu Categories ---
  console.log('\n📂 Creating menu categories...');
  const menuCategoryRecords: Record<string, string> = {};
  for (let i = 0; i < MENU_CATEGORIES.length; i++) {
    const cat = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: MENU_CATEGORIES[i].name,
        description: MENU_CATEGORIES[i].description,
        displayOrder: i + 1,
      },
    });
    menuCategoryRecords[cat.name] = cat.id;
    console.log(`   ✅ Menu Category "${cat.name}" created`);
  }

  // --- 6. Menu Items ---
  console.log('\n🍽️  Creating menu items...');
  const localMenuImages = await createSeedLocalMenuImages();
  const menuItemRecords: Array<{ id: string; name: string; code: string; price: number; kitchenStationName: string }> = [];
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const itemCode = `MI-${String(i + 1).padStart(3, '0')}`;
    const mi = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: menuCategoryRecords[item.categoryName],
        kitchenStationId: kitchenStationRecords[item.kitchenStationName],
        name: item.name,
        code: itemCode,
        description: item.description,
        itemType: item.itemType,
        price: item.price,
        costPrice: item.costPrice,
        taxRate: item.taxRate,
        preparationTimeMinutes: item.preparationTimeMinutes,
        requiresPreparation: item.requiresPreparation,
        trackInventory: item.trackInventory,
        isAvailable: true,
        isActive: true,
        imageUrl: localMenuImages[item.name] || item.imageUrl,
        displayOrder: item.displayOrder,
      },
    });
    menuItemRecords.push({ id: mi.id, name: mi.name, code: itemCode, price: item.price, kitchenStationName: item.kitchenStationName });
    console.log(`   ✅ Menu Item "${mi.name}" (${itemCode}) created`);
  }

  // --- 7. Inventory Categories ---
  console.log('\n📦 Creating inventory categories...');
  const inventoryCategoryRecords: Record<string, string> = {};
  for (let i = 0; i < INVENTORY_CATEGORIES.length; i++) {
    const cat = await prisma.inventoryCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: INVENTORY_CATEGORIES[i].name,
        description: INVENTORY_CATEGORIES[i].description,
        displayOrder: i + 1,
      },
    });
    inventoryCategoryRecords[cat.name] = cat.id;
    console.log(`   ✅ Inventory Category "${cat.name}" created`);
  }

  // --- 8. Stock Locations ---
  console.log('\n📍 Creating stock locations...');
  const stockLocationRecords: Record<string, string> = {};
  for (const loc of STOCK_LOCATIONS) {
    const sl = await prisma.stockLocation.create({
      data: {
        restaurantId: restaurant.id,
        name: loc.name,
        code: loc.code,
        description: loc.description,
        isDefault: loc.isDefault,
      },
    });
    stockLocationRecords[sl.name] = sl.id;
    console.log(`   ✅ Stock Location "${sl.name}" created`);
  }

  // --- 9. Inventory Items + Balances + Movements ---
  console.log('\n🥩 Creating inventory items...');
  const inventoryItemRecords: Array<{ id: string; name: string; averageCost: number }> = [];
  for (let i = 0; i < INVENTORY_ITEMS.length; i++) {
    const item = INVENTORY_ITEMS[i];
    const ii = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: inventoryCategoryRecords[item.categoryName],
        name: item.name,
        sku: item.sku,
        description: item.description,
        baseUnit: item.baseUnit,
        reorderLevel: item.reorderLevel,
        targetStockLevel: item.targetStockLevel,
        averageCost: item.averageCost,
        lastPurchaseCost: item.averageCost,
      },
    });

    // Create balance at Main Store
    const mainQty = Math.floor(Math.random() * 15) + item.targetStockLevel / 2;
    const mainLocationId = stockLocationRecords['Main Store'];
    await prisma.inventoryBalance.create({
      data: {
        restaurantId: restaurant.id,
        inventoryItemId: ii.id,
        stockLocationId: mainLocationId,
        onHandQuantity: mainQty,
        reservedQuantity: 0,
      },
    });

    // Opening balance stock movement
    await prisma.stockMovement.create({
      data: {
        restaurantId: restaurant.id,
        inventoryItemId: ii.id,
        stockLocationId: mainLocationId,
        movementType: 'OPENING_BALANCE',
        quantity: mainQty,
        quantityBefore: 0,
        quantityAfter: mainQty,
        reservedBefore: 0,
        reservedAfter: 0,
        unitCost: item.averageCost,
        totalCost: formatCurrency(item.averageCost * mainQty),
        actorUserId: userRecords['manager'].id,
        reason: 'Opening balance during setup',
      },
    });

    inventoryItemRecords.push({ id: ii.id, name: ii.name, averageCost: item.averageCost });
    console.log(`   ✅ Inventory Item "${ii.name}" (${item.sku}) created with balance: ${mainQty}`);
  }

  // --- 10. Suppliers ---
  console.log('\n🚚 Creating suppliers...');
  const supplierRecords: Record<string, { id: string; name: string }> = {};
  for (const sup of SUPPLIERS) {
    const s = await prisma.supplier.create({
      data: {
        restaurantId: restaurant.id,
        ...sup,
      },
    });
    supplierRecords[s.name] = { id: s.id, name: s.name };
    console.log(`   ✅ Supplier "${s.name}" created`);
  }

  // --- 11. Dining Areas ---
  console.log('\n🏠 Creating dining areas...');
  const diningAreaRecords: Record<string, string> = {};
  for (const area of DINING_AREAS) {
    const da = await prisma.diningArea.create({
      data: {
        restaurantId: restaurant.id,
        name: area.name,
        description: area.description,
        displayOrder: area.displayOrder,
      },
    });
    diningAreaRecords[da.name] = da.id;
    console.log(`   ✅ Dining Area "${da.name}" created`);
  }

  // --- 12. Tables ---
  console.log('\n🪑 Creating tables...');
  const tableRecords: Array<{ id: string; name: string }> = [];
  for (const table of TABLES) {
    const t = await prisma.restaurantTable.create({
      data: {
        restaurantId: restaurant.id,
        diningAreaId: diningAreaRecords[table.diningAreaName],
        name: table.name,
        code: table.code,
        capacity: table.capacity,
        shape: table.shape,
        status: 'AVAILABLE',
        positionX: table.positionX,
        positionY: table.positionY,
      },
    });
    tableRecords.push({ id: t.id, name: t.name });
    console.log(`   ✅ Table "${t.name}" (capacity: ${t.capacity}) created`);
  }

  // --- 13. Document Sequences ---
  console.log('\n🔢 Creating document sequences...');
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  await prisma.documentSequence.createMany({
    data: [
      { restaurantId: restaurant.id, sequenceType: 'ORDER', businessDate: today, currentValue: 5 },
      { restaurantId: restaurant.id, sequenceType: 'PAYMENT', businessDate: today, currentValue: 5 },
      { restaurantId: restaurant.id, sequenceType: 'RECEIPT', businessDate: today, currentValue: 5 },
      { restaurantId: restaurant.id, sequenceType: 'STOCK_RECEIPT', businessDate: today, currentValue: 2 },
    ],
  });
  console.log('   ✅ Document sequences created');

  // --- 14. Sample Orders ---
  console.log('\n📋 Creating sample orders...');
  const managerId = userRecords['manager'].id;
  const waiterIds = [userRecords['waiter1'].id, userRecords['waiter2'].id, userRecords['waiter3'].id];

  // Order 1: Dine-in, completed and paid
  const order1Items = [
    { menuItemName: 'Caesar Salad', qty: 1 },
    { menuItemName: 'Ribeye Steak', qty: 1 },
    { menuItemName: 'Spaghetti Carbonara', qty: 1 },
    { menuItemName: 'Still Mineral Water', qty: 2 },
  ];
  const order1 = await createOrder({
    restaurantId: restaurant.id,
    orderNumber: 'ORD-000001',
    orderType: 'DINE_IN',
    status: 'CLOSED',
    paymentStatus: 'PAID',
    tableId: tableRecords[1].id,
    guestCount: 2,
    customerName: 'John Smith',
    waiterId: waiterIds[0],
    createdById: waiterIds[0],
    closedById: managerId,
    items: order1Items,
    menuItemRecords,
    kitchenStationRecords,
    now: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
  });
  // Payment for order 1
  const payment1 = await createPayment(order1, restaurant.id, userRecords['waiter1'].id, 'CASH', order1.totalAmount);
  // Receipt for order 1
  await createReceipt(order1, payment1, restaurant, userRecords['waiter1'].id);
  console.log(`   ✅ Order "${order1.orderNumber}" (${order1.paymentStatus}) created`);

  // Order 2: Dine-in, completed and paid (card)
  const order2Items = [
    { menuItemName: 'Bruschetta al Pomodoro', qty: 1 },
    { menuItemName: 'Grilled Atlantic Salmon', qty: 1 },
    { menuItemName: 'Fresh Orange Juice', qty: 1 },
    { menuItemName: 'Tiramisu', qty: 1 },
  ];
  const order2 = await createOrder({
    restaurantId: restaurant.id,
    orderNumber: 'ORD-000002',
    orderType: 'DINE_IN',
    status: 'CLOSED',
    paymentStatus: 'PAID',
    tableId: tableRecords[2].id,
    guestCount: 2,
    customerName: 'Sarah Johnson',
    waiterId: waiterIds[1],
    createdById: waiterIds[1],
    closedById: managerId,
    items: order2Items,
    menuItemRecords,
    kitchenStationRecords,
    now: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });
  const payment2 = await createPayment(order2, restaurant.id, userRecords['waiter2'].id, 'CARD', order2.totalAmount);
  await createReceipt(order2, payment2, restaurant, userRecords['waiter2'].id);
  console.log(`   ✅ Order "${order2.orderNumber}" (${order2.paymentStatus}) created`);

  // Order 3: Dine-in, partially paid
  const order3Items = [
    { menuItemName: 'Calamari Fritti', qty: 1 },
    { menuItemName: 'Chicken Marsala', qty: 2 },
    { menuItemName: 'Red Wine (Glass)', qty: 2 },
    { menuItemName: 'Chocolate Lava Cake', qty: 1 },
  ];
  const order3 = await createOrder({
    restaurantId: restaurant.id,
    orderNumber: 'ORD-000003',
    orderType: 'DINE_IN',
    status: 'SERVED',
    paymentStatus: 'PARTIALLY_PAID',
    tableId: tableRecords[4].id,
    guestCount: 4,
    customerName: 'Michael Brown',
    waiterId: waiterIds[2],
    createdById: waiterIds[2],
    items: order3Items,
    menuItemRecords,
    kitchenStationRecords,
    now: new Date(Date.now() - 1 * 60 * 60 * 1000),
  });
  const partialPayment = order3.totalAmount * 0.5;
  await createPayment(order3, restaurant.id, userRecords['waiter3'].id, 'MOBILE_MONEY', partialPayment);
  console.log(`   ✅ Order "${order3.orderNumber}" (${order3.paymentStatus}) created`);

  // Order 4: Takeaway, paid
  const order4Items = [
    { menuItemName: 'Spaghetti Carbonara', qty: 2 },
    { menuItemName: 'Panna Cotta', qty: 2 },
  ];
  const order4 = await createOrder({
    restaurantId: restaurant.id,
    orderNumber: 'ORD-000004',
    orderType: 'TAKEAWAY',
    status: 'CLOSED',
    paymentStatus: 'PAID',
    tableId: null,
    guestCount: null,
    customerName: 'Emily Davis',
    waiterId: waiterIds[0],
    createdById: waiterIds[0],
    closedById: managerId,
    items: order4Items,
    menuItemRecords,
    kitchenStationRecords,
    now: new Date(Date.now() - 4 * 60 * 60 * 1000),
  });
  const payment4 = await createPayment(order4, restaurant.id, userRecords['waiter1'].id, 'CASH', order4.totalAmount);
  await createReceipt(order4, payment4, restaurant, userRecords['waiter1'].id);
  console.log(`   ✅ Order "${order4.orderNumber}" (${order4.paymentStatus}) created`);

  // Order 5: Current open order (in preparation)
  const order5Items = [
    { menuItemName: 'Lamb Chops', qty: 1 },
    { menuItemName: 'Risotto ai Funghi', qty: 1 },
    { menuItemName: 'Mojito', qty: 1 },
  ];
  const order5 = await createOrder({
    restaurantId: restaurant.id,
    orderNumber: 'ORD-000005',
    orderType: 'DINE_IN',
    status: 'IN_PREPARATION',
    paymentStatus: 'UNPAID',
    tableId: tableRecords[6].id,
    guestCount: 2,
    customerName: 'James Wilson',
    waiterId: waiterIds[1],
    createdById: waiterIds[1],
    items: order5Items,
    menuItemRecords,
    kitchenStationRecords,
    now: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
  });
  console.log(`   ✅ Order "${order5.orderNumber}" (${order5.status}) created`);

  // --- 15. Stock Receipts ---
  console.log('\n📦 Creating sample stock receipts...');
  const receipt1 = await prisma.stockReceipt.create({
    data: {
      restaurantId: restaurant.id,
      receiptNumber: 'SR-000001',
      supplierId: supplierRecords['Fresh Farm Produce Ltd'].id,
      stockLocationId: stockLocationRecords['Main Store'],
      status: 'POSTED',
      receiptDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      notes: 'Weekly produce delivery',
      subtotalCost: 145.00,
      totalCost: 145.00,
      createdById: userRecords['manager'].id,
      postedById: userRecords['manager'].id,
      postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lines: {
        create: [
          { inventoryItemId: inventoryItemRecords[0].id, quantity: 15, unitCost: 2.00, lineCost: 30.00, batchNumber: 'BATCH-PRO-001' },
          { inventoryItemId: inventoryItemRecords[1].id, quantity: 8, unitCost: 3.50, lineCost: 28.00, batchNumber: 'BATCH-PRO-001' },
          { inventoryItemId: inventoryItemRecords[2].id, quantity: 25, unitCost: 1.00, lineCost: 25.00, batchNumber: 'BATCH-PRO-001' },
          { inventoryItemId: inventoryItemRecords[3].id, quantity: 5, unitCost: 4.00, lineCost: 20.00, batchNumber: 'BATCH-PRO-001' },
          { inventoryItemId: inventoryItemRecords[4].id, quantity: 7, unitCost: 2.50, lineCost: 17.50, batchNumber: 'BATCH-PRO-001' },
        ],
      },
    },
    include: { lines: true },
  });
  console.log(`   ✅ Stock Receipt "${receipt1.receiptNumber}" created`);

  // Add stock movements for the receipt
  for (const line of receipt1.lines) {
    const invItem = inventoryItemRecords.find(i => i.id === line.inventoryItemId);
    if (invItem) {
      await prisma.stockMovement.create({
        data: {
          restaurantId: restaurant.id,
          inventoryItemId: line.inventoryItemId,
          stockLocationId: stockLocationRecords['Main Store'],
          movementType: 'STOCK_RECEIPT',
          quantity: line.quantity,
          quantityBefore: 0,
          quantityAfter: line.quantity,
          reservedBefore: 0,
          reservedAfter: 0,
          unitCost: line.unitCost,
          totalCost: line.lineCost,
          stockReceiptId: receipt1.id,
          stockReceiptLineId: line.id,
          actorUserId: userRecords['manager'].id,
          reason: 'Stock receipt from Fresh Farm Produce Ltd',
        },
      });
    }
  }
  console.log('      ✅ Stock movements created for receipt');

  // Update balances for received items
  for (const line of receipt1.lines) {
    await prisma.inventoryBalance.updateMany({
      where: { inventoryItemId: line.inventoryItemId, stockLocationId: stockLocationRecords['Main Store'] },
      data: { onHandQuantity: { increment: line.quantity } },
    });
  }

  console.log('\n✅✅✅ Seeding complete! ✅✅✅\n');
  console.log('📋 Test Login Credentials (password: "password123" for ALL users):');
  console.log('──────────────────────────────────────────────────────');
  console.log('   Manager: manager@savannabistro.com');
  console.log('   Waiter 1: waiter1@savannabistro.com');
  console.log('   Waiter 2: waiter2@savannabistro.com');
  console.log('   Waiter 3: waiter3@savannabistro.com');
  console.log('   Chef 1:   chef1@savannabistro.com');
  console.log('   Chef 2:   chef2@savannabistro.com');
  console.log('');
  console.log('   Restaurant: Savanna Bistro');
  console.log('   Currency: USD');
  console.log('   Timezone: Africa/Kigali');
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function createOrder(params: {
  restaurantId: string;
  orderNumber: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'PICKUP' | 'DELIVERY';
  status: 'DRAFT' | 'SUBMITTED' | 'IN_PREPARATION' | 'PARTIALLY_READY' | 'READY' | 'SERVED' | 'CANCELLED' | 'CLOSED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  tableId: string | null;
  guestCount: number | null;
  customerName: string;
  waiterId: string;
  createdById: string;
  closedById?: string;
  items: Array<{ menuItemName: string; qty: number }>;
  menuItemRecords: Array<{ id: string; name: string; code: string; price: number; kitchenStationName: string }>;
  kitchenStationRecords: Record<string, string>;
  now: Date;
}) {
  let subtotal = 0;
  const orderItems: Array<{
    menuItemId: string;
    menuItemNameSnapshot: string;
    menuItemCodeSnapshot: string;
    itemTypeSnapshot: 'FOOD' | 'DRINK' | 'DESSERT' | 'OTHER';
    unitPrice: number;
    taxRate: number;
    quantity: number;
    lineSubtotal: number;
    lineTaxAmount: number;
    lineTotal: number;
    requiresPreparation: boolean;
    status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
    kitchenStationId: string | null;
  }> = [];

  const hiddenKitchenStationId = params.kitchenStationRecords ? Object.values(params.kitchenStationRecords)[0] : null;

  for (const orderItem of params.items) {
    const menuItem = params.menuItemRecords.find(m => m.name === orderItem.menuItemName);
    if (!menuItem) {
      console.warn(`      ⚠️  Menu item "${orderItem.menuItemName}" not found, skipping`);
      continue;
    }

    const lineSubtotal = formatCurrency(menuItem.price * orderItem.qty);
    subtotal += lineSubtotal;

    orderItems.push({
      menuItemId: menuItem.id,
      menuItemNameSnapshot: menuItem.name,
      menuItemCodeSnapshot: menuItem.code,
      itemTypeSnapshot: 'FOOD' as const,
      unitPrice: menuItem.price,
      taxRate: 0,
      quantity: orderItem.qty,
      lineSubtotal,
      lineTaxAmount: 0,
      lineTotal: lineSubtotal,
      requiresPreparation: true,
      status: 'SERVED' as const,
      kitchenStationId: params.kitchenStationRecords[menuItem.kitchenStationName] || hiddenKitchenStationId,
    });
  }

  const serviceCharge = formatCurrency(subtotal * 0.10); // 10% service charge
  const discountAmount = 0;
  const totalAmount = formatCurrency(subtotal + serviceCharge);
  const amountPaid = params.paymentStatus === 'PAID' ? totalAmount : params.paymentStatus === 'PARTIALLY_PAID' ? formatCurrency(totalAmount * 0.5) : 0;
  const amountDue = formatCurrency(totalAmount - amountPaid);

  const closedAt = params.status === 'CLOSED' ? new Date(params.now.getTime() + 45 * 60 * 1000) : null;

  return prisma.order.create({
    data: {
      restaurantId: params.restaurantId,
      orderNumber: params.orderNumber,
      orderType: params.orderType,
      status: params.status,
      paymentStatus: params.paymentStatus,
      tableId: params.tableId,
      guestCount: params.guestCount,
      customerName: params.customerName,
      subtotal,
      taxAmount: 0,
      serviceCharge,
      discountAmount,
      totalAmount,
      amountPaid,
      amountDue,
      totalBeforeDiscount: subtotal,
      submittedAt: params.now,
      preparationStartedAt: params.status !== 'DRAFT' ? new Date(params.now.getTime() + 2 * 60 * 1000) : null,
      servedAt: ['SERVED', 'CLOSED'].includes(params.status) ? new Date(params.now.getTime() + 30 * 60 * 1000) : null,
      closedAt,
      closedById: closedAt ? params.closedById : null,
      createdAt: params.now,
      updatedAt: params.now,
      waiterId: params.waiterId,
      createdById: params.createdById,
      items: {
        create: orderItems,
      },
    },
  });
}

async function createPayment(order: { id: string; totalAmount: number; restaurantId: string }, restaurantId: string, receivedById: string, method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'VOUCHER' | 'OTHER', amount: number) {
  const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return prisma.payment.create({
    data: {
      restaurantId,
      orderId: order.id,
      paymentNumber,
      transactionType: 'PAYMENT',
      method,
      status: 'COMPLETED',
      amount,
      amountTendered: method === 'CASH' ? formatCurrency(amount + 5) : amount,
      changeAmount: method === 'CASH' ? 5 : 0,
      receivedById,
      completedAt: new Date(),
    },
  });
}

async function createReceipt(order: { id: string; orderNumber: string; orderType: string; subtotal: number; taxAmount: number; serviceCharge: number; discountAmount: number; totalAmount: number; amountPaid: number; tableId: string | null; restaurantId: string; waiterId: string; customerName: string | null; items: Array<{ id: string }> | any }, payment: { id: string; method: string; amount: number; referenceNumber: string | null }, restaurant: { id: string; name: string; email: string; phone: string | null; address: string | null; currency: string }, issuedById: string) {
  const lineItems = order.items || [];
  const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  // Fetch order items with snapshots
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    select: { id: true, menuItemNameSnapshot: true, menuItemCodeSnapshot: true, quantity: true, unitPrice: true, lineSubtotal: true, lineTaxAmount: true, lineTotal: true, specialInstructions: true },
  });

  return prisma.receipt.create({
    data: {
      restaurantId: restaurant.id,
      orderId: order.id,
      receiptNumber,
      status: 'ISSUED',
      currency: restaurant.currency,
      restaurantNameSnapshot: restaurant.name,
      restaurantEmailSnapshot: restaurant.email,
      restaurantPhoneSnapshot: restaurant.phone,
      restaurantAddressSnapshot: restaurant.address,
      orderNumberSnapshot: order.orderNumber,
      orderTypeSnapshot: order.orderType,
      tableNameSnapshot: null,
      tableCodeSnapshot: null,
      waiterNameSnapshot: 'Staff',
      customerNameSnapshot: order.customerName,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceChargeAmount: order.serviceCharge,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      changeAmount: order.amountPaid - order.totalAmount > 0 ? order.amountPaid - order.totalAmount : 0,
      receiptFooterSnapshot: 'Thank you for dining at Savanna Bistro!',
      issuedById,
      lines: {
        create: orderItems.map(oi => ({
          orderItemId: oi.id,
          itemNameSnapshot: oi.menuItemNameSnapshot,
          itemCodeSnapshot: oi.menuItemCodeSnapshot,
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          lineSubtotal: oi.lineSubtotal,
          lineTaxAmount: oi.lineTaxAmount,
          lineTotal: oi.lineTotal,
          specialInstructions: oi.specialInstructions,
        })),
      },
      payments: {
        create: {
          paymentId: payment.id,
          method: payment.method as any,
          amount: payment.amount,
          referenceNumber: payment.referenceNumber,
        },
      },
    },
  });
}

// ==========================================
// EXECUTION
// ==========================================

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
