import { z } from 'zod';

const id = z.string().min(1);

export const locationSchema = z.object({
  id,
  name: z.string().min(1),
  next: z.array(id),
  kind: z.enum(['safe', 'danger']),
  description: z.string().min(1),
});

export const itemSchema = z.object({
  id,
  name: z.string().min(1),
  weight: z.number().int().min(0).max(30),
  kind: z.enum(['consumable', 'equipment', 'loot', 'quest', 'manual']),
  coinValue: z.number().int().nonnegative().optional(),
  buyPrice: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});

export const npcSchema = z.object({
  id,
  name: z.string().min(1),
  locationId: id,
  hp: z.number().int().positive().optional(),
  itemsSold: z.array(id).optional(),
  rumorsOffered: z.array(id).optional(),
  description: z.string().optional(),
});

export const artSchema = z.object({
  id,
  name: z.string().min(1),
  tags: z.array(id).min(2).max(4),
  manualItemId: id.optional(),
  technique: z.string().min(1),
  mapActions: z.array(id),
  description: z.string().optional(),
});

export const rumorSchema = z.object({
  id,
  title: z.string().min(1),
  source: z.string().min(1),
  credibility: z.number().min(0).max(1),
  targetLocation: id,
  valueHint: z.string().min(1),
  dangerHint: z.string().min(1),
  cost: z.number().int().nonnegative(),
  confirmationFlag: id.optional(),
  important: z.boolean().optional(),
});

const conditionSchema = z.object({
  type: z.enum(['flagAbsent', 'hasFlag', 'hasItem', 'hasArtTag', 'hasRumor', 'heatAtLeast', 'heatBelow', 'relationAtLeast']),
  value: id,
  amount: z.number().int().optional(),
});

const effectSchema = z.object({
  type: z.enum(['move', 'setFlag', 'addLoot', 'addHeat', 'addRumor', 'startBattle', 'addItem', 'takeItem', 'addCoins', 'heal', 'addRelation', 'confirmRumor']),
  value: z.union([id, z.number()]),
  amount: z.number().int().optional(),
});

export const eventSchema = z.object({
  id,
  locationId: id,
  text: z.string().min(1),
  npcId: id.optional(),
  rumorId: id.optional(),
  choices: z.array(z.object({
    id,
    label: z.string().min(1),
    conditions: z.array(conditionSchema),
    effects: z.array(effectSchema),
    riskHint: z.string(),
  })),
});

export const contentSchema = z.object({
  locations: z.array(locationSchema),
  events: z.array(eventSchema),
  npcs: z.array(npcSchema),
  arts: z.array(artSchema),
  items: z.array(itemSchema),
  rumors: z.array(rumorSchema),
});
