
// Core Entity Types

export enum AgentState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  SOCIALIZING = 'SOCIALIZING',
  WORKING = 'WORKING',
  SLEEPING = 'SLEEPING',
  THINKING = 'THINKING',
  FLEEING = 'FLEEING',
  FIGHTING = 'FIGHTING'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AgentNeeds {
  hunger: number;   // 0-100, 100 is full
  energy: number;   // 0-100, 100 is fully rested
  social: number;   // 0-100, 100 is socially satisfied
  fun: number;      // 0-100
  health: number;   // 0-100
  temperature: number; // 0-100, < 30 is freezing, > 50 is comfortable
}

// NEW: The Chemical Brain
export interface NeuroChemistry {
  dopamine: number;   // Motivation / Reward seeking (0-100)
  serotonin: number;  // Mood stability / Contentment (0-100)
  adrenaline: number; // Fight or Flight / Speed (0-100)
  oxytocin: number;   // Social bonding / Trust (0-100)
  cortisol: number;   // Stress / Pain (0-100)
}

export interface ActionMemory {
  targetType: string; // e.g., "MUSHROOM_RED", "WOLF"
  action: string;     // "EAT", "ATTACK"
  outcome: number;    // -100 to 100 (Negative = Pain/Stress, Positive = Dopamine)
  confidence: number; // 0-1, how sure they are
}

export interface Personality {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  bio: string; 
}

export interface Memory {
  timestamp: number;
  description: string;
  importance: number; 
}

export interface Agent {
  id: string;
  name: string;
  color: string;
  position: Vector3;
  rotation: number; 
  targetPosition: Vector3 | null;
  targetId?: string; 
  state: AgentState;
  needs: AgentNeeds;
  neuro: NeuroChemistry; // The Brain
  actionMemories: ActionMemory[]; // Learned experiences
  personality: Personality;
  memories: Memory[];
  relationships: Record<string, number>; 
  inventory: Record<string, number>; 
  currentActionLabel: string;
  chatBubble?: string;
  lastChatTime?: number;
  // Internal Physics
  velocity: Vector3;
  radius: number;
  // Health
  sickness?: 'NONE' | 'COLD' | 'FLU';
  sicknessDuration?: number;
}

export interface Building {
  id: string;
  position: Vector3;
  type: 'CRATE' | 'WALL' | 'PLANT' | 'HOUSE' | 'CAMPFIRE';
  ownerId: string;
  scale: number;
  radius: number; 
  health: number; // Durability
  isOnFire?: boolean;
}

// --- NATURE & DISCOVERY ---

export type FloraType = 'TREE_OAK' | 'TREE_PINE' | 'BUSH_BERRY' | 'MUSHROOM_RED' | 'MUSHROOM_BROWN' | 'RESOURCE_ROCK' | 'RESOURCE_MUD';
export type FaunaType = 'RABBIT' | 'CHICKEN' | 'WOLF' | 'BEAR';

export interface Flora {
  id: string;
  type: FloraType;
  position: Vector3;
  scale: number;
  isEdible: boolean;
  isPoisonous: boolean;
  nutritionValue: number;
  resourceYield?: string; 
  resourcesLeft?: number; // Finite resources
  maxResources?: number;
  radius: number;
  isOnFire?: boolean;
  health?: number;
}

export interface Fauna {
  id: string;
  type: FaunaType;
  position: Vector3;
  rotation: number;
  state: 'IDLE' | 'MOVING' | 'FLEEING' | 'HUNTING' | 'FOLLOWING';
  targetPosition: Vector3 | null;
  targetId?: string; 
  isAggressive: boolean;
  isTamed: boolean;
  ownerId?: string;
  health: number;
  radius: number;
}

// Global Knowledge
export interface KnowledgeBase {
  [key: string]: {
    customName: string;
    discoveredBy: string;
    description: string;
  };
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'AGENT' | 'DIALOGUE' | 'DISCOVERY' | 'DANGER';
  message: string;
}

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export interface GameState {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  knowledge: KnowledgeBase;
  time: number; // Tick count
  dayTime: number; // 0-24 hours
  day: number; // Day count
  season: Season;
  logs: WorldEvent[];
  paused: boolean;
  selectedAgentId: string | null;
}

export interface AgentDecision {
  action: "MOVE" | "TALK" | "WAIT" | "SLEEP" | "CRAFT" | "INSPECT" | "GATHER" | "TAME" | "ATTACK" | "FLEE";
  targetId?: string;
  targetLocation?: { x: number; z: number };
  craftingRecipe?: string;
  thoughtProcess: string;
  dialogue?: string;
}
