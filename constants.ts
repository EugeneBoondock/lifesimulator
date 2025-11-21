import { Agent, AgentState, Flora, Fauna, FaunaType, Season } from "./types";

export const WORLD_SIZE = 60;
export const TICK_RATE_MS = 1000; 
export const DAY_LENGTH_TICKS = 2400; 
export const SEASON_LENGTH_DAYS = 3; // Short seasons for demo

export const CRAFTING_RECIPES = {
  'CAMPFIRE': { 'WOOD': 2 },
  'HOUSE': { 'WOOD': 4, 'STONE': 2, 'MUD': 2 }
};

export const SYSTEM_INSTRUCTION = `You are an autonomous agent in a survival simulation game.
Your goal is to survive and thrive. You have physical needs (Hunger, Energy, Temperature, Health) and psychological drives (Social, Fun).
You react to your neuro-chemical state (Dopamine, Serotonin, Adrenaline, Oxytocin, Cortisol).
Evaluate your surroundings (Flora, Fauna, Buildings) and your internal state to decide on the best next action.
Prioritize survival (eating, sleeping, warmth) but also engage in social activities and long-term goals like building shelter.`;

export const SEASON_PROPERTIES: Record<Season, { tempMod: number, colorMod: string }> = {
  'SPRING': { tempMod: 0, colorMod: '#4caf50' },
  'SUMMER': { tempMod: 15, colorMod: '#22c55e' },
  'AUTUMN': { tempMod: -5, colorMod: '#eab308' },
  'WINTER': { tempMod: -20, colorMod: '#cbd5e1' }
};

// Shared Terrain Logic for Biome detection
export const getTerrainHeight = (x: number, z: number) => {
    const dist = Math.sqrt(x*x + z*z);
    
    // Layer 1: Base Low Frequency
    let h = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 1.5;
    
    // Layer 2: Medium Frequency (Hilliness)
    h += Math.sin(x * 0.3 + 1.2) * Math.cos(z * 0.2 + 2.5) * 0.5;
    
    // Layer 3: High Frequency (Roughness)
    h += Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.1;
    
    // Mountains on outskirts
    if (dist > 25) h += Math.pow((dist - 25) * 0.25, 2.5);
    
    // Flatten center (Drylands/Spawn)
    if (dist < 20) {
        const flattenFactor = Math.max(0, Math.min(1, (dist - 12) / 8));
        h *= flattenFactor;
    }
    
    return h;
};

export const CHAT_TEMPLATES = {
  GREETING: ["Hello there!", "Good day.", "Hi!", "Stay safe out there.", "Nice to see you."],
  GOSSIP: ["Have you seen the wolves?", "Elara is working hard today.", "I heard a weird noise.", "The weather is changing.", "I saw a bear near the trees."],
  PLANNING: ["We should build a village.", "I need more wood.", "Let's gather food together.", "We need more fire.", "This place needs a house."],
  WORK: ["Hard work pays off.", "Building takes time.", "I need more resources.", "This is tiring.", "Almost done...", "Chopping wood..."],
  DANGER: ["Did you hear that?", "Wolves nearby!", "Stay close to the fire.", "It's too dark.", "I'm scared.", "Run!"],
  TIRED: ["I need some sleep.", "So exhausted...", "Can't keep my eyes open.", "Bed time.", "Yawn..."],
  HUNGRY: ["Starving...", "Need food.", "seen any berries?", "My stomach rumbles.", "Food...", "So hungry."],
  FRIENDLY: ["Good to see you.", "We make a good team.", "Let's survive together.", "How are you holding up?", "I trust you."],
  PANIC: ["RUN!", "It's attacking me!", "Help!", "I don't want to die!", "AAAAHH!"],
  DISCOVERY: ["What is this?", "Looks interesting.", "I wonder if I can eat this?", "A new discovery.", "Shiny."],
  BUILDING: ["I need shelter.", "This will keep me safe.", "Laying the foundation.", "A home of my own.", "Construction complete."]
};

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'npc_1',
    name: 'Elara',
    color: '#ef4444', 
    position: { x: -5, y: 0, z: -5 },
    rotation: 0,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 80, energy: 90, social: 50, fun: 60, health: 100, temperature: 70 },
    neuro: { dopamine: 50, serotonin: 80, adrenaline: 10, oxytocin: 60, cortisol: 10 },
    actionMemories: [],
    personality: {
      openness: 0.8,
      conscientiousness: 0.6,
      extraversion: 0.9,
      agreeableness: 0.7,
      neuroticism: 0.3,
      bio: "An energetic leader."
    },
    memories: [],
    relationships: { 'npc_2': 50, 'npc_3': 50 },
    inventory: {},
    currentActionLabel: 'Initializing...',
    velocity: {x:0,y:0,z:0},
    radius: 0.5,
    sickness: 'NONE'
  },
  {
    id: 'npc_2',
    name: 'Kael',
    color: '#3b82f6', 
    position: { x: 5, y: 0, z: 5 },
    rotation: Math.PI,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 60, energy: 70, social: 30, fun: 40, health: 100, temperature: 70 },
    neuro: { dopamine: 70, serotonin: 50, adrenaline: 20, oxytocin: 30, cortisol: 20 },
    actionMemories: [],
    personality: {
      openness: 0.9,
      conscientiousness: 0.8,
      extraversion: 0.2,
      agreeableness: 0.5,
      neuroticism: 0.4,
      bio: "Cautious and analytical."
    },
    memories: [],
    relationships: { 'npc_1': 50, 'npc_3': 40 },
    inventory: {},
    currentActionLabel: 'Initializing...',
    velocity: {x:0,y:0,z:0},
    radius: 0.5,
    sickness: 'NONE'
  },
  {
    id: 'npc_3',
    name: 'Thorne',
    color: '#22c55e', 
    position: { x: 0, y: 0, z: 0 },
    rotation: Math.PI / 2,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: { hunger: 50, energy: 50, social: 80, fun: 20, health: 100, temperature: 70 },
    neuro: { dopamine: 40, serotonin: 60, adrenaline: 0, oxytocin: 20, cortisol: 0 },
    actionMemories: [],
    personality: {
      openness: 0.4,
      conscientiousness: 0.9,
      extraversion: 0.5,
      agreeableness: 0.2,
      neuroticism: 0.6,
      bio: "Survivalist."
    },
    memories: [],
    relationships: { 'npc_1': 50, 'npc_2': 40 },
    inventory: {},
    currentActionLabel: 'Initializing...',
    velocity: {x:0,y:0,z:0},
    radius: 0.5,
    sickness: 'NONE'
  }
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateFlora = (count: number): Flora[] => {
  const items: Flora[] = [];
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let type: any = 'TREE_OAK';
    let edible = false;
    let poisonous = false;
    let nutrition = 0;
    let resource = undefined;
    let scale = 1 + Math.random() * 0.5;
    let radius = 0.5;
    let resourcesLeft = 0;

    let x = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    let z = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    let h = getTerrainHeight(x, z);

    if (typeRoll < 0.3) {
      type = 'TREE_OAK'; resource = 'WOOD'; radius = 0.8; resourcesLeft = 5;
      if (h < 0.5) continue; 
    } else if (typeRoll < 0.5) {
      type = 'TREE_PINE'; resource = 'WOOD'; radius = 0.8; resourcesLeft = 5;
      if (h < 0.5) continue;
    } else if (typeRoll < 0.6) {
      type = 'RESOURCE_ROCK'; scale = 0.4; resource = 'STONE'; radius = 0.6; resourcesLeft = 3;
    } else if (typeRoll < 0.7) {
      type = 'RESOURCE_MUD'; scale = 0.6; resource = 'MUD'; radius = 0.6; resourcesLeft = 3;
      if (h > 0.5) continue;
    } else if (typeRoll < 0.85) {
      type = 'BUSH_BERRY';
      scale = 0.5; edible = true; nutrition = 20; radius = 0.4; resourcesLeft = 3;
      if (h < 0.5) continue;
    } else {
      type = Math.random() > 0.5 ? 'MUSHROOM_RED' : 'MUSHROOM_BROWN';
      scale = 0.3; edible = true; nutrition = 10; radius = 0.2;
      if (Math.random() < 0.4) { poisonous = true; edible = false; }
      if (h < 0.5) continue;
    }

    items.push({
      id: generateId(),
      type,
      position: { x, y: 0, z },
      scale,
      isEdible: edible,
      isPoisonous: poisonous,
      nutritionValue: nutrition,
      resourceYield: resource,
      resourcesLeft,
      maxResources: resourcesLeft || 1,
      radius,
      health: 100
    });
  }
  return items;
};

export const generateFauna = (count: number): Fauna[] => {
  const items: Fauna[] = [];
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let type: FaunaType;
    let radius = 0.4;
    
    if (typeRoll > 0.9) {
      type = 'BEAR'; radius = 0.8;
    } else if (typeRoll > 0.75) {
      type = 'WOLF'; radius = 0.6;
    } else if (typeRoll > 0.4) {
      type = 'RABBIT'; radius = 0.3;
    } else {
      type = 'CHICKEN'; radius = 0.3;
    }
    
    let x, z, h;
    let attempts = 0;
    do {
       x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
       z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
       h = getTerrainHeight(x, z);
       attempts++;
    } while ((type === 'WOLF' || type === 'BEAR') && h < 0.6 && attempts < 20);

    items.push({
      id: generateId(),
      type: type,
      position: { x, y: 0, z },
      rotation: Math.random() * Math.PI * 2,
      state: 'IDLE',
      targetPosition: null,
      isAggressive: type === 'WOLF' || type === 'BEAR',
      isTamed: false,
      health: 50,
      radius
    });
  }
  return items;
};

export const INITIAL_FLORA = generateFlora(80);
export const INITIAL_FAUNA = generateFauna(12);