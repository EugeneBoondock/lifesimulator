
// Core Entity Types

export enum AgentState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  SOCIALIZING = 'SOCIALIZING',
  WORKING = 'WORKING',
  SLEEPING = 'SLEEPING',
  THINKING = 'THINKING' // When querying LLM
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
}

export interface Personality {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  bio: string; // Backstory
}

export interface Memory {
  timestamp: number;
  description: string;
  importance: number; // 0-1
}

export interface Agent {
  id: string;
  name: string;
  color: string;
  position: Vector3;
  rotation: number; // Y-axis rotation in radians
  targetPosition: Vector3 | null;
  state: AgentState;
  needs: AgentNeeds;
  personality: Personality;
  memories: Memory[];
  relationships: Record<string, number>; // AgentID -> 0-100 Score (50 is neutral)
  partnerId?: string;
  currentActionLabel: string;
  chatBubble?: string;
  lastChatTime?: number; // Timestamp when chat started
}

export interface Building {
  id: string;
  position: Vector3;
  type: 'CRATE' | 'WALL' | 'PLANT' | 'HOUSE';
  ownerId: string;
  scale: number;
}

// --- NATURE & DISCOVERY ---

export type FloraType = 'TREE_OAK' | 'TREE_PINE' | 'BUSH_BERRY' | 'MUSHROOM_RED' | 'MUSHROOM_BROWN';
export type FaunaType = 'RABBIT' | 'CHICKEN' | 'WOLF';

export interface Flora {
  id: string;
  type: FloraType;
  position: Vector3;
  scale: number;
  isEdible: boolean;
  isPoisonous: boolean;
  nutritionValue: number;
  regrowsAt?: number; // Tick when it respawns
}

export interface Fauna {
  id: string;
  type: FaunaType;
  position: Vector3;
  rotation: number;
  state: 'IDLE' | 'MOVING' | 'FLEEING';
  targetPosition: Vector3 | null;
}

// Global Knowledge: What the civilization has named things
// Key = FloraType (e.g., 'MUSHROOM_RED'), Value = "Fire Spore"
export interface KnowledgeBase {
  [key: string]: {
    customName: string;
    discoveredBy: string; // Agent Name
    description: string; // "It made me sick" or "It was delicious"
  };
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'AGENT' | 'DIALOGUE' | 'DISCOVERY';
  message: string;
}

export interface GameState {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  knowledge: KnowledgeBase;
  time: number; // Tick count
  dayTime: number; // 0-24 hours
  logs: WorldEvent[];
  paused: boolean;
  selectedAgentId: string | null;
}

// AI Response Schemas

export interface AgentDecision {
  action: 'MOVE' | 'TALK' | 'WAIT' | 'WORK' | 'SLEEP' | 'BUILD' | 'INSPECT' | 'HARVEST';
  targetId?: string; // ID of Agent, Flora, or Fauna
  targetLocation?: { x: number, z: number }; // For MOVE
  thoughtProcess: string;
  dialogue?: string; // If talking
  namingProposal?: string; // If inspecting something new, propose a name (e.g., "Sun Berry")
}
