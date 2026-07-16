import { Router, Request, Response, NextFunction } from 'express';
import { recipeService } from '../services';
import { recipeSchema, ingredientSchema, inventoryLinkSchema } from '../services/recipe.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}

// Read-only endpoints accessible to all authenticated users
router.get('/items/:menuItemId/recipe', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const recipe = await recipeService.getRecipe(restaurantId, req.params.menuItemId);

  return res.json({ success: true, data: recipe });
}));

router.get('/items/:menuItemId/inventory-link', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const link = await recipeService.getInventoryLink(restaurantId, req.params.menuItemId);

  return res.json({ success: true, data: link });
}));

// Mutating endpoints restricted to ADMIN, MANAGER, STOCK_KEEPER
router.post('/items/:menuItemId/recipe', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = recipeSchema.parse(req.body);
  const recipe = await recipeService.createRecipe(restaurantId, req.params.menuItemId, data, userId);
  res.status(201).json({ success: true, data: recipe, message: 'Recipe created' });
}));

router.patch('/items/:menuItemId/recipe', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = recipeSchema.partial().parse(req.body);
  const recipe = await recipeService.updateRecipe(restaurantId, req.params.menuItemId, data, userId);
  if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

  return res.json({ success: true, data: recipe, message: 'Recipe updated' });
}));

router.post('/items/:menuItemId/recipe/ingredients', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = ingredientSchema.parse(req.body);
  const ingredient = await recipeService.addIngredient(restaurantId, req.params.menuItemId, data, userId);
  res.status(201).json({ success: true, data: ingredient, message: 'Ingredient added' });
}));

router.patch('/items/:menuItemId/recipe/ingredients/:ingredientId', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = ingredientSchema.partial().parse(req.body);
  const ingredient = await recipeService.updateIngredient(restaurantId, req.params.menuItemId, req.params.ingredientId, data, userId);
  if (!ingredient) return res.status(404).json({ success: false, message: 'Ingredient not found' });

  return res.json({ success: true, data: ingredient, message: 'Ingredient updated' });
}));

router.delete('/items/:menuItemId/recipe/ingredients/:ingredientId', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const removed = await recipeService.removeIngredient(restaurantId, req.params.menuItemId, req.params.ingredientId, userId);
  if (!removed) return res.status(404).json({ success: false, message: 'Ingredient not found' });

  return res.json({ success: true, message: 'Ingredient removed' });
}));

router.post('/items/:menuItemId/inventory-link', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = inventoryLinkSchema.parse(req.body);
  const link = await recipeService.createInventoryLink(restaurantId, req.params.menuItemId, data, userId);
  res.status(201).json({ success: true, data: link, message: 'Inventory link created' });
}));

router.patch('/items/:menuItemId/inventory-link', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = inventoryLinkSchema.partial().parse(req.body);
  const link = await recipeService.updateInventoryLink(restaurantId, req.params.menuItemId, data, userId);
  if (!link) return res.status(404).json({ success: false, message: 'Inventory link not found' });

  return res.json({ success: true, data: link, message: 'Inventory link updated' });
}));

router.delete('/items/:menuItemId/inventory-link', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const removed = await recipeService.removeInventoryLink(restaurantId, req.params.menuItemId, userId);
  if (!removed) return res.status(404).json({ success: false, message: 'Inventory link not found' });

  return res.json({ success: true, message: 'Inventory link removed' });
}));

export default router;
