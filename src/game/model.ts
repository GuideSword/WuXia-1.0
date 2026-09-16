export type Id = string;
export type Counts = Record<Id, number>;
export type Phase = 'town' | 'rumors' | 'prep' | 'explore' | 'combat' | 'result' | 'error';

export interface PermanentState {
  coins: number;
  stash: Counts;
  learnedArts: Id[];
  heardRumors: Id[];
  confirmedRumors: Id[];
  flags: Id[];
  relations: Record<Id, number>;
  raids: number;
}

export interface BattleState {
  npcId: Id;
  enemyHp: number;
  round: number;
  intent: 'strike' | 'heavy' | 'guard';
  defending: boolean;
}

export interface RunState {
  locationId: Id;
  hp: number;
  heat: number;
  coins: number;
  inventory: Counts;
  loot: Counts;
  pendingRumors: Id[];
  flags: Id[];
  seed: number;
  battle: BattleState | null;
}

export interface ResultState {
  success: boolean;
  coins: number;
  loot: Counts;
  rumors: Id[];
  lost: Counts;
  route: Id | null;
  message: string;
}

export interface GameState {
  phase: Phase;
  permanent: PermanentState;
  run: RunState | null;
  safeLocationId: Id;
  selectedRumorId: Id | null;
  lastResult: ResultState | null;
  notice: string | null;
}

export interface Location {
  id: Id;
  name: string;
  next: Id[];
  kind: 'safe' | 'danger';
  description: string;
  requiresFlag?: Id;
}

export interface ItemDefinition {
  id: Id;
  name: string;
  weight: number;
  kind: 'consumable' | 'equipment' | 'loot' | 'quest' | 'manual';
  coinValue?: number;
  buyPrice?: number;
  description?: string;
}

export interface NpcDefinition {
  id: Id;
  name: string;
  locationId: Id;
  hp?: number;
  itemsSold?: Id[];
  rumorsOffered?: Id[];
  description?: string;
}

export interface ArtDefinition {
  id: Id;
  name: string;
  tags: Id[];
  manualItemId?: Id;
  technique: string;
  mapActions: Id[];
  description?: string;
}

export interface RumorDefinition {
  id: Id;
  title: string;
  source: string;
  credibility: number;
  targetLocation: Id;
  valueHint: string;
  dangerHint: string;
  cost: number;
  confirmationFlag?: Id;
  important?: boolean;
}

export type ConditionType =
  | 'flagAbsent'
  | 'hasFlag'
  | 'hasItem'
  | 'hasArtTag'
  | 'hasRumor'
  | 'heatAtLeast'
  | 'heatBelow'
  | 'relationAtLeast';

export interface Condition {
  type: ConditionType;
  value: Id;
  amount?: number;
}

export type EffectType =
  | 'move'
  | 'setFlag'
  | 'addLoot'
  | 'addHeat'
  | 'addRumor'
  | 'startBattle'
  | 'addItem'
  | 'takeItem'
  | 'addCoins'
  | 'heal'
  | 'addRelation'
  | 'confirmRumor';

export interface Effect {
  type: EffectType;
  value: Id | number;
  amount?: number;
}

export interface EventChoice {
  id: Id;
  label: string;
  conditions: Condition[];
  effects: Effect[];
  riskHint: string;
}

export interface EventDefinition {
  id: Id;
  locationId: Id;
  text: string;
  npcId?: Id;
  rumorId?: Id;
  choices: EventChoice[];
}

export interface Content {
  locations: Location[];
  events: EventDefinition[];
  npcs: NpcDefinition[];
  arts: ArtDefinition[];
  items: ItemDefinition[];
  rumors: RumorDefinition[];
}
