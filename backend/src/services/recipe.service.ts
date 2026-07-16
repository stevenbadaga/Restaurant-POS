import { z } from 'zod';
import { prisma } from '../database';
import { createAuditLog } from './audit.service';

export const recipeSchema = z.object({
  name: z.string().min(1).max(200),
  yieldQuantity: z.number().positive().default(1),
  notes: z.string().optional(),
});

export const ingredientSchema = z.object({
  inventoryItemId: z.string().uuid(),
  stockLocationId: z.string().uuid().optional(),
  quantityRequired: z.number().positive(),
  wastagePercentage: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export const inventoryLinkSchema = z.object({
  inventoryItemId: z.string().uuid(),
  stockLocationId: z.string().uuid().optional(),
  quantityPerSale: z.number().positive(),
});

export async function getRecipe(restaurantId: string, menuItemId: string) {
  return prisma.recipe.findFirst({
    where: { menuItemId, restaurantId },
    include: {
      ingredients: {
        include: {
          inventoryItem: {
            select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true, isActive: true },
          },
          stockLocation: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function createRecipe(restaurantId: string, menuItemId: string, data: z.infer<typeof recipeSchema>, userId: string, ipAddress?: string) {
  const existing = await prisma.recipe.findFirst({ where: { menuItemId, restaurantId } });
  if (existing) throw new Error('A recipe already exists for this menu item');

  const recipe = await prisma.recipe.create({
    data: {
      restaurantId,
      menuItemId,
      name: data.name,
      yieldQuantity: data.yieldQuantity,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'RECIPE_CREATED',
    entityType: 'Recipe',
    entityId: recipe.id,
    description: `Recipe "${recipe.name}" created for menu item`,
    ipAddress,
  });

  return recipe;
}

export async function updateRecipe(restaurantId: string, menuItemId: string, data: Partial<z.infer<typeof recipeSchema>>, userId: string, ipAddress?: string) {
  const recipe = await prisma.recipe.findFirst({ where: { menuItemId, restaurantId } });
  if (!recipe) return null;

  const updated = await prisma.recipe.update({
    where: { id: recipe.id },
    data: {
      name: data.name,
      yieldQuantity: data.yieldQuantity,
      notes: data.notes,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'RECIPE_UPDATED',
    entityType: 'Recipe',
    entityId: updated.id,
    description: `Recipe "${updated.name}" updated`,
    ipAddress,
  });

  return updated;
}

export async function addIngredient(restaurantId: string, menuItemId: string, data: z.infer<typeof ingredientSchema>, userId: string, ipAddress?: string) {
  const recipe = await prisma.recipe.findFirst({ where: { menuItemId, restaurantId } });
  if (!recipe) throw new Error('Recipe not found');

  const ingredient = await prisma.recipeIngredient.create({
    data: {
      recipeId: recipe.id,
      inventoryItemId: data.inventoryItemId,
      stockLocationId: data.stockLocationId || null,
      quantityRequired: data.quantityRequired,
      wastagePercentage: data.wastagePercentage,
      notes: data.notes || null,
    },
    include: {
      inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'RECIPE_INGREDIENT_ADDED',
    entityType: 'Recipe',
    entityId: recipe.id,
    description: `Ingredient added to recipe "${recipe.name}"`,
    metadata: { inventoryItemName: ingredient.inventoryItem.name, quantityRequired: Number(data.quantityRequired) },
    ipAddress,
  });

  return ingredient;
}

export async function updateIngredient(restaurantId: string, menuItemId: string, ingredientId: string, data: Partial<z.infer<typeof ingredientSchema>>, userId: string, ipAddress?: string) {
  const recipe = await prisma.recipe.findFirst({ where: { menuItemId, restaurantId } });
  if (!recipe) return null;

  const updated = await prisma.recipeIngredient.update({
    where: { id: ingredientId },
    data: {
      quantityRequired: data.quantityRequired,
      wastagePercentage: data.wastagePercentage,
      stockLocationId: data.stockLocationId,
      notes: data.notes,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'RECIPE_INGREDIENT_UPDATED',
    entityType: 'Recipe',
    entityId: recipe.id,
    description: `Recipe ingredient updated`,
    ipAddress,
  });

  return updated;
}

export async function removeIngredient(restaurantId: string, menuItemId: string, ingredientId: string, userId: string, ipAddress?: string) {
  const recipe = await prisma.recipe.findFirst({ where: { menuItemId, restaurantId } });
  if (!recipe) return false;

  await prisma.recipeIngredient.delete({ where: { id: ingredientId } });

  await createAuditLog({
    restaurantId, userId,
    action: 'RECIPE_INGREDIENT_REMOVED',
    entityType: 'Recipe',
    entityId: recipe.id,
    description: `Recipe ingredient removed`,
    ipAddress,
  });

  return true;
}

// Direct inventory link management
export async function getInventoryLink(restaurantId: string, menuItemId: string) {
  return prisma.menuItemInventoryLink.findFirst({
    where: { menuItemId, restaurantId, isActive: true },
    include: {
      inventoryItem: {
        select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true, isActive: true },
      },
      stockLocation: { select: { id: true, name: true } },
    },
  });
}

export async function createInventoryLink(restaurantId: string, menuItemId: string, data: z.infer<typeof inventoryLinkSchema>, userId: string, ipAddress?: string) {
  const link = await prisma.menuItemInventoryLink.create({
    data: {
      restaurantId,
      menuItemId,
      inventoryItemId: data.inventoryItemId,
      stockLocationId: data.stockLocationId || null,
      quantityPerSale: data.quantityPerSale,
    },
    include: {
      inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'DIRECT_INVENTORY_LINK_CREATED',
    entityType: 'MenuItemInventoryLink',
    entityId: link.id,
    description: `Direct inventory link created for menu item`,
    metadata: { inventoryItemName: link.inventoryItem.name, quantityPerSale: Number(data.quantityPerSale) },
    ipAddress,
  });

  return link;
}

export async function updateInventoryLink(restaurantId: string, menuItemId: string, data: Partial<z.infer<typeof inventoryLinkSchema>>, userId: string, ipAddress?: string) {
  const existing = await prisma.menuItemInventoryLink.findFirst({
    where: { menuItemId, restaurantId, isActive: true },
  });
  if (!existing) return null;

  const updated = await prisma.menuItemInventoryLink.update({
    where: { id: existing.id },
    data: {
      inventoryItemId: data.inventoryItemId,
      stockLocationId: data.stockLocationId,
      quantityPerSale: data.quantityPerSale,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'DIRECT_INVENTORY_LINK_UPDATED',
    entityType: 'MenuItemInventoryLink',
    entityId: updated.id,
    description: `Direct inventory link updated`,
    ipAddress,
  });

  return updated;
}

export async function removeInventoryLink(restaurantId: string, menuItemId: string, userId: string, ipAddress?: string) {
  const existing = await prisma.menuItemInventoryLink.findFirst({
    where: { menuItemId, restaurantId, isActive: true },
  });
  if (!existing) return false;

  await prisma.menuItemInventoryLink.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'DIRECT_INVENTORY_LINK_REMOVED',
    entityType: 'MenuItemInventoryLink',
    entityId: existing.id,
    description: `Direct inventory link removed`,
    ipAddress,
  });

  return true;
}
