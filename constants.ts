
import { Agent, AgentState, Flora, Fauna } from "./types";

export const WORLD_SIZE = 60; // Expanded for exploration
export const TICK_RATE_MS = 1000; // Game loop speed base (running at 10x in App)
export const DAY_LENGTH_TICKS = 2400; // 4 minutes per day cycle (at 100ms tick)

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'npc_1',
    name: 'Elara',
    color: '#ef4444', // Red
    position: { x: -5, y: 0, z: -5 },
    rotation: 0,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 80, energy: 90, social: 50, fun: 60, health: 100 },
    personality: {
      openness: 0.8,
      conscientiousness: 0.6,
      extraversion: 0.9,
      agreeableness: 0.7,
      neuroticism: 0.3,
      bio: "An energetic leader who wants to establish a village and name everything she finds."
    },
    memories: [],
    relationships: { 'npc_2': 50, 'npc_3': 50 },
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
    needs: { hunger: 60, energy: 70, social: 30, fun: 40, health: 100 },
    personality: {
      openness: 0.9,
      conscientiousness: 0.8,
      extraversion: 0.2,
      agreeableness: 0.5,
      neuroticism: 0.4,
      bio: "Cautious and analytical. He prefers to test plants before eating them."
    },
    memories: [],
    relationships: { 'npc_1': 50, 'npc_3': 40 },
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
    needs: { hunger: 50, energy: 50, social: 80, fun: 20, health: 100 },
    personality: {
      openness: 0.4,
      conscientiousness: 0.9,
      extraversion: 0.5,
      agreeableness: 0.2,
      neuroticism: 0.6,
      bio: "A survivalist who connects deeply with nature."
    },
    memories: [],
    relationships: { 'npc_1': 50, 'npc_2': 40 },
    currentActionLabel: 'Checking soil levels...'
  }
];

// Procedural Generation Helpers
const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateFlora = (count: number): Flora[] => {
  const items: Flora[] = [];
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let type: any = 'TREE_OAK';
    let edible = false;
    let poisonous = false;
    let nutrition = 0;
    let scale = 1 + Math.random() * 0.5;

    if (typeRoll < 0.3) {
      type = 'TREE_OAK';
    } else if (typeRoll < 0.5) {
      type = 'TREE_PINE';
    } else if (typeRoll < 0.7) {
      type = 'BUSH_BERRY';
      scale = 0.5;
      edible = true;
      nutrition = 20;
      if (Math.random() < 0.2) { poisonous = true; edible = false; } // 20% chance poisonous berries
    } else {
      type = Math.random() > 0.5 ? 'MUSHROOM_RED' : 'MUSHROOM_BROWN';
      scale = 0.3;
      edible = true;
      nutrition = 10;
      if (Math.random() < 0.4) { poisonous = true; edible = false; } // 40% chance poisonous mushrooms
    }

    items.push({
      id: generateId(),
      type,
      position: {
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.9,
        y: 0,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.9
      },
      scale,
      isEdible: edible,
      isPoisonous: poisonous,
      nutritionValue: nutrition
    });
  }
  return items;
};

export const generateFauna = (count: number): Fauna[] => {
  const items: Fauna[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: generateId(),
      type: Math.random() > 0.5 ? 'RABBIT' : 'CHICKEN',
      position: {
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.8,
        y: 0,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.8
      },
      rotation: Math.random() * Math.PI * 2,
      state: 'IDLE',
      targetPosition: null
    });
  }
  return items;
};

export const INITIAL_FLORA = generateFlora(40);
export const INITIAL_FAUNA = generateFauna(10);

export const SYSTEM_INSTRUCTION = `
You are the AI Brain for a survivor in a new world.
Your goal: **ESTABLISH CIVILIZATION**. Discover new plants, name them, build shelter, and survive.

Rules:
1. **Discovery**: 
   - If you see a plant/item defined as "Unknown" or by its raw type (e.g., BUSH_BERRY), use **INSPECT** to examine it.
   - When Inspecting, **INVENT A NAME** for it in the 'namingProposal' field (e.g., "Sun Fruit", "Death Cap").

2. **Survival**: 
   - Eat logic: Unknown things might be poisonous! Test them or ask others.
   - If Hungry: HARVEST plants or fruits.
   - If Tired: SLEEP.
   - If Homeless: BUILD a house.

3. **Social**:
   - Share knowledge! "Don't eat the red mushrooms, they are poison!"

4. **Action - INSPECT/HARVEST**:
   - targetId: The ID of the flora/fauna you are interacting with.
   - To Harvest/Eat, you must be CLOSE (within 2 meters). If not, MOVE there first.
`;
