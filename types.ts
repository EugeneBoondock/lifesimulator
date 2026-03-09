export enum AgentState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  GATHERING = 'GATHERING',
  CRAFTING = 'CRAFTING',
  BUILDING = 'BUILDING',
  SOCIALIZING = 'SOCIALIZING',
  SLEEPING = 'SLEEPING',
  THINKING = 'THINKING',
  FLEEING = 'FLEEING',
  FIGHTING = 'FIGHTING',
  HUNTING = 'HUNTING',
  EATING = 'EATING',
  DRINKING = 'DRINKING',
  EXPLORING = 'EXPLORING',
  TEACHING = 'TEACHING',
  RESEARCHING = 'RESEARCHING',
  COURTING = 'COURTING',
  MATING = 'MATING',
  PLAYING = 'PLAYING',
  MOURNING = 'MOURNING',
  CELEBRATING = 'CELEBRATING',
  DEFENDING = 'DEFENDING'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AgentNeeds {
  hunger: number;
  energy: number;
  thirst: number;
  social: number;
  safety: number;
  health: number;
  temperature: number;
  curiosity: number;
}

export interface NeuroChemistry {
  dopamine: number;
  serotonin: number;
  adrenaline: number;
  oxytocin: number;
  cortisol: number;
}

export interface Personality {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  creativity: number;
  courage: number;
  bio: string;
}

export interface Memory {
  timestamp: number;
  description: string;
  importance: number;
  type: 'event' | 'discovery' | 'social' | 'danger' | 'landmark' | 'family';
}

export interface ActionMemory {
  targetType: string;
  action: string;
  outcome: number;
  confidence: number;
}

export type Era = 'PRIMITIVE' | 'STONE_AGE' | 'AGRICULTURAL' | 'BRONZE_AGE' | 'IRON_AGE';
export type LifeStage = 'CHILD' | 'ADULT' | 'ELDER';
export type RelationshipType = 'STRANGER' | 'ACQUAINTANCE' | 'FRIEND' | 'RIVAL' | 'PARTNER' | 'PARENT' | 'CHILD_REL' | 'SIBLING';
export type SocialRole = 'MEMBER' | 'LEADER' | 'ELDER_ROLE' | 'HEALER' | 'TEACHER' | 'OUTCAST';

export interface GeneticTraits {
  immuneStrength: number;
  metabolicRate: number;
  muscleCapacity: number;
  brainPlasticity: number;
  reproductiveHealth: number;
}

export interface MentalEvent {
  type: 'TRAUMA' | 'JOY' | 'LOSS' | 'DISCOVERY' | 'INSIGHT' | 'LONELINESS';
  intensity: number;
  description: string;
  tick: number;
}

export interface Technology {
  id: string;
  name: string;
  era: Era;
  description: string;
  prerequisites: string[];
  unlocks: string[];
  discoveryHint: string;
}

export interface Agent {
  id: string;
  name: string;
  color: string;
  skinTone: string;
  markings: string;
  ageDays: number;
  sex: 'MALE' | 'FEMALE';
  lifeStage: LifeStage;
  position: Vector3;
  rotation: number;
  targetPosition: Vector3 | null;
  targetId?: string;
  state: AgentState;
  needs: AgentNeeds;
  neuro: NeuroChemistry;
  personality: Personality;
  memories: Memory[];
  actionMemories: ActionMemory[];
  relationships: Record<string, number>;
  relationshipTypes: Record<string, RelationshipType>;
  inventory: Record<string, number>;
  knownTechnologies: string[];
  currentActionLabel: string;
  chatBubble?: string;
  lastChatTime?: number;
  equippedTool?: string;
  feelings: string[];
  mood: string;
  aiThoughts: string[];
  aiConversations: { with: string; message: string; time: number }[];
  velocity: Vector3;
  radius: number;
  sickness: 'NONE' | 'COLD' | 'FOOD_POISON' | 'INJURY';
  sicknessDuration: number;
  skillLevels: Record<string, number>;
  parentIds?: [string, string];
  partnerId?: string;
  children: string[];
  generation: number;
  isPregnant: boolean;
  pregnancyTimer: number;
  settlementId?: string;
  causeOfDeath?: string;
  birthDay: number;
  socialRole?: SocialRole;
  genetics?: GeneticTraits;
  mentalHealth?: number;
  mentalEvents?: MentalEvent[];
  craftingVisual?: string;
  lastBuiltType?: string;
}

export type FloraType =
  | 'TREE_OAK' | 'TREE_PINE' | 'TREE_BIRCH' | 'TREE_WILLOW'
  | 'BUSH_BERRY' | 'BUSH_HERB' | 'TALL_GRASS' | 'FLOWER_FIELD'
  | 'MUSHROOM_RED' | 'MUSHROOM_BROWN' | 'MUSHROOM_GLOW'
  | 'RESOURCE_ROCK' | 'RESOURCE_FLINT' | 'RESOURCE_CLAY' | 'RESOURCE_COPPER_ORE' | 'RESOURCE_TIN_ORE' | 'RESOURCE_IRON_ORE'
  | 'FARM_CROP' | 'CACTUS' | 'REED';

export type FaunaType = 'RABBIT' | 'DEER' | 'BOAR' | 'WOLF' | 'BEAR' | 'FISH' | 'BIRD';

export type WaterKind = 'RIVER' | 'LAKE' | 'PUDDLE';

export interface Flora {
  id: string;
  type: FloraType;
  position: Vector3;
  scale: number;
  growthStage?: number;
  growthTimer?: number;
  isEdible: boolean;
  isPoisonous: boolean;
  nutritionValue: number;
  resourceYield?: string;
  resourcesLeft?: number;
  maxResources?: number;
  radius: number;
  isOnFire?: boolean;
  health: number;
}

export interface Fauna {
  id: string;
  type: FaunaType;
  position: Vector3;
  rotation: number;
  state: 'IDLE' | 'MOVING' | 'FLEEING' | 'HUNTING' | 'GRAZING' | 'SLEEPING';
  targetPosition: Vector3 | null;
  isAggressive: boolean;
  isTamed: boolean;
  ownerId?: string;
  health: number;
  maxHealth: number;
  radius: number;
  meat: number;
  hide: number;
  speed: number;
  fleeDistance: number;
  packId?: string;
}

export interface WaterPatch {
  id: string;
  kind: WaterKind;
  position: Vector3;
  size: number;
  length?: number;
  rotation?: number;
  ttl?: number;
  hasFish?: boolean;
}

export type BuildingType =
  | 'CAMPFIRE' | 'LEAN_TO' | 'HUT' | 'STONE_HOUSE'
  | 'STORAGE_PIT' | 'DRYING_RACK' | 'WORKSHOP'
  | 'FARM_PLOT' | 'WELL' | 'WALL' | 'SMELTER'
  | 'TOTEM' | 'GRANARY';

export interface Building {
  id: string;
  position: Vector3;
  type: BuildingType;
  ownerId: string;
  scale: number;
  radius: number;
  health: number;
  maxHealth: number;
  isOnFire?: boolean;
  inventory?: Record<string, number>;
  buildProgress: number;
  rotation?: number;
}

export interface Discovery {
  id: string;
  techId: string;
  discoveredBy: string;
  discoveredAt: number;
  day: number;
  description: string;
}

export interface NamedPlace {
  id: string;
  name: string;
  position: Vector3;
  namedBy: string;
  namedAt: number;
  type: 'LANDMARK' | 'SETTLEMENT' | 'RESOURCE_SITE' | 'DANGER_ZONE' | 'SACRED';
}

export interface Settlement {
  id: string;
  name: string;
  position: Vector3;
  radius: number;
  members: string[];
  buildings: string[];
  founded: number;
  founderName: string;
}

export interface ActiveEvent {
  id: string;
  type: 'PREDATOR_WAVE' | 'RESOURCE_BOUNTY' | 'DISEASE_OUTBREAK' | 'EARTHQUAKE' | 'WILDFIRE' | 'METEOR' | 'DROUGHT' | 'MIGRATION' | 'FESTIVAL';
  name: string;
  description: string;
  duration: number;
  ticksRemaining: number;
  affectedArea?: Vector3;
  intensity: number;
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'AGENT' | 'DIALOGUE' | 'DISCOVERY' | 'DANGER' | 'ERA' | 'DEATH' | 'BIRTH' | 'SETTLEMENT' | 'EVENT' | 'RELATIONSHIP';
  message: string;
  importance?: number;
}

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
export type Weather = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'STORM' | 'SNOW' | 'FOG' | 'HEAT_WAVE';
export type CameraMode = 'FREE' | 'FOLLOW' | 'CINEMATIC';

export interface PopulationSnapshot {
  time: number;
  count: number;
}

export interface GameState {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  water: WaterPatch[];
  places: NamedPlace[];
  discoveries: Discovery[];
  knowledge: Record<string, Technology>;
  globalTechsDiscovered: string[];
  currentEra: Era;
  time: number;
  dayTime: number;
  day: number;
  season: Season;
  weather: Weather;
  logs: WorldEvent[];
  paused: boolean;
  speed: number;
  selectedAgentId: string | null;
  populationPeak: number;
  settlements: Settlement[];
  activeEvents: ActiveEvent[];
  cameraMode: CameraMode;
  populationHistory: PopulationSnapshot[];
  totalBirths: number;
  totalDeaths: number;
}

export interface AgentDecision {
  action: string;
  targetId?: string;
  targetLocation?: { x: number; z: number };
  craftItem?: string;
  buildType?: string;
  thoughtProcess: string;
  dialogue?: string;
  placeName?: string;
  discoveryAttempt?: string;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  ingredients: Record<string, number>;
  result: string;
  resultCount: number;
  requiredTech?: string;
  requiredBuilding?: BuildingType;
  craftTime: number;
}

export interface BuildingRecipe {
  type: BuildingType;
  name: string;
  ingredients: Record<string, number>;
  requiredTech?: string;
  buildTime: number;
  health: number;
  radius: number;
}
