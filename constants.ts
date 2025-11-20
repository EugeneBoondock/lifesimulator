import { Agent, AgentState } from "./types";

export const WORLD_SIZE = 30; // Increased world size for terrain
export const TICK_RATE_MS = 1000; // Game loop speed
export const DAY_LENGTH_TICKS = 240; // 10 ticks = 1 hour approx if we mapped it, simply 240 ticks per day cycle

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'npc_1',
    name: 'Elara',
    color: '#ef4444', // Red
    position: { x: -5, y: 0, z: -5 },
    rotation: 0,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 80, energy: 90, social: 50, fun: 60 },
    personality: {
      openness: 0.8,
      conscientiousness: 0.6,
      extraversion: 0.9,
      agreeableness: 0.7,
      neuroticism: 0.3,
      bio: "An energetic architect who loves designing new structures and meeting people."
    },
    memories: [],
    currentActionLabel: 'Looking around...'
  },
  {
    id: 'npc_2',
    name: 'Kael',
    color: '#3b82f6', // Blue
    position: { x: 5, y: 0, z: 5 },
    rotation: Math.PI,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 60, energy: 70, social: 30, fun: 40 },
    personality: {
      openness: 0.9,
      conscientiousness: 0.8,
      extraversion: 0.2,
      agreeableness: 0.5,
      neuroticism: 0.4,
      bio: "A thoughtful scientist obsessed with the simulation theory. Introverted and observant."
    },
    memories: [],
    currentActionLabel: 'Observing the sky...'
  },
  {
    id: 'npc_3',
    name: 'Thorne',
    color: '#22c55e', // Green
    position: { x: 0, y: 0, z: 0 },
    rotation: Math.PI / 2,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 50, energy: 50, social: 80, fun: 20 },
    personality: {
      openness: 0.4,
      conscientiousness: 0.9,
      extraversion: 0.5,
      agreeableness: 0.2,
      neuroticism: 0.6,
      bio: "A grumpy but highly skilled gardener who prefers plants to people."
    },
    memories: [],
    currentActionLabel: 'Checking soil levels...'
  }
];

export const SYSTEM_INSTRUCTION = `
You are the AI Brain for a specific NPC in a simulation. 
Your goal is to simulate "Free Will" based on your needs, personality, and recent memories.

You will receive the current world state, your stats, and nearby agents.
You must return a JSON decision.

Rules:
1. If energy is < 20, you highly prioritize SLEEP.
2. If hunger is < 30, you prioritize EATING (Simulated as WORK/foraging).
3. If social is < 30, you prioritize TALK.
4. If you are an 'architect' or 'gardener', prioritize WORK to build structures or plant things.
5. Otherwise, act according to your personality (Bio).
6. Locations are X, Z coordinates between -${WORLD_SIZE/2} and ${WORLD_SIZE/2}.
`;