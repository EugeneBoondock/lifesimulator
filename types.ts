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
  currentActionLabel: string;
  chatBubble?: string;
}

export interface Building {
  id: string;
  position: Vector3;
  type: 'CRATE' | 'WALL' | 'PLANT';
  ownerId: string;
  scale: number;
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'AGENT' | 'DIALOGUE';
  message: string;
}

export interface GameState {
  agents: Agent[];
  buildings: Building[];
  time: number; // Tick count
  dayTime: number; // 0-24 hours
  logs: WorldEvent[];
  paused: boolean;
  selectedAgentId: string | null;
}

// AI Response Schemas

export interface AgentDecision {
  action: 'MOVE' | 'TALK' | 'WAIT' | 'WORK' | 'SLEEP';
  targetAgentId?: string; // For TALK
  targetLocation?: { x: number, z: number }; // For MOVE
  thoughtProcess: string;
  dialogue?: string; // If talking
}