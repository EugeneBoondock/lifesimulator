import { Agent, AgentState, Flora, Fauna, FaunaType, Season, WaterPatch, Technology, CraftingRecipe, BuildingRecipe, Era } from "./types";

export const WORLD_SIZE = 160;
export const TICK_RATE_MS = 800;
export const DAY_LENGTH_TICKS = 2400;
export const SEASON_LENGTH_DAYS = 5;
export const MAX_INVENTORY_SIZE = 12;

export const ERA_ORDER: Era[] = ['PRIMITIVE', 'STONE_AGE', 'AGRICULTURAL', 'BRONZE_AGE', 'IRON_AGE'];

export const ERA_NAMES: Record<Era, string> = {
  PRIMITIVE: 'The Awakening',
  STONE_AGE: 'Age of Stone',
  AGRICULTURAL: 'Age of Growth',
  BRONZE_AGE: 'Age of Bronze',
  IRON_AGE: 'Age of Iron'
};

export const TECHNOLOGIES: Record<string, Technology> = {
  FIRE: {
    id: 'FIRE', name: 'Fire', era: 'PRIMITIVE',
    description: 'The mastery of flame for warmth, cooking, and light.',
    prerequisites: [], unlocks: ['COOKING', 'TORCH'],
    discoveryHint: 'Strike flint near dry wood...'
  },
  STONE_KNAPPING: {
    id: 'STONE_KNAPPING', name: 'Stone Knapping', era: 'STONE_AGE',
    description: 'Shaping stones into useful tools by striking them.',
    prerequisites: [], unlocks: ['STONE_AXE', 'STONE_KNIFE'],
    discoveryHint: 'Hit rocks together...'
  },
  COOKING: {
    id: 'COOKING', name: 'Cooking', era: 'STONE_AGE',
    description: 'Using fire to prepare food, making it safer and more nutritious.',
    prerequisites: ['FIRE'], unlocks: ['COOKED_MEAT'],
    discoveryHint: 'Place raw food near fire...'
  },
  SHELTER_BUILDING: {
    id: 'SHELTER_BUILDING', name: 'Shelter Building', era: 'STONE_AGE',
    description: 'Constructing basic shelters from natural materials.',
    prerequisites: ['STONE_KNAPPING'], unlocks: ['LEAN_TO', 'HUT'],
    discoveryHint: 'Gather enough wood and figure out how to stack it...'
  },
  SPEAR_MAKING: {
    id: 'SPEAR_MAKING', name: 'Spear Making', era: 'STONE_AGE',
    description: 'Crafting pointed weapons for hunting.',
    prerequisites: ['STONE_KNAPPING'], unlocks: ['SPEAR'],
    discoveryHint: 'Attach sharp stone to a long stick...'
  },
  WEAVING: {
    id: 'WEAVING', name: 'Weaving', era: 'STONE_AGE',
    description: 'Creating baskets and simple textiles from plant fibers.',
    prerequisites: ['STONE_KNAPPING'], unlocks: ['BASKET', 'ROPE'],
    discoveryHint: 'Twist plant fibers together...'
  },
  POTTERY: {
    id: 'POTTERY', name: 'Pottery', era: 'AGRICULTURAL',
    description: 'Shaping clay into vessels and firing them.',
    prerequisites: ['FIRE', 'STONE_KNAPPING'], unlocks: ['CLAY_POT', 'STORAGE'],
    discoveryHint: 'Shape clay and expose to fire...'
  },
  AGRICULTURE: {
    id: 'AGRICULTURE', name: 'Agriculture', era: 'AGRICULTURAL',
    description: 'Growing food intentionally from seeds.',
    prerequisites: ['STONE_KNAPPING'], unlocks: ['FARM_PLOT', 'SEEDS'],
    discoveryHint: 'Notice that dropped seeds grow into plants...'
  },
  ANIMAL_HUSBANDRY: {
    id: 'ANIMAL_HUSBANDRY', name: 'Animal Husbandry', era: 'AGRICULTURAL',
    description: 'Taming and breeding animals for food and labor.',
    prerequisites: ['AGRICULTURE'], unlocks: ['TAME_ADVANCED'],
    discoveryHint: 'Feed and befriend wild animals repeatedly...'
  },
  MASONRY: {
    id: 'MASONRY', name: 'Masonry', era: 'BRONZE_AGE',
    description: 'Building with shaped stone blocks.',
    prerequisites: ['SHELTER_BUILDING', 'STONE_KNAPPING'], unlocks: ['STONE_HOUSE', 'WALL'],
    discoveryHint: 'Stack shaped stones to build stronger structures...'
  },
  COPPER_SMELTING: {
    id: 'COPPER_SMELTING', name: 'Copper Smelting', era: 'BRONZE_AGE',
    description: 'Extracting metal from ore using extreme heat.',
    prerequisites: ['FIRE', 'POTTERY'], unlocks: ['COPPER_TOOLS', 'SMELTER'],
    discoveryHint: 'Heat copper ore in a very hot fire...'
  },
  BRONZE_WORKING: {
    id: 'BRONZE_WORKING', name: 'Bronze Working', era: 'BRONZE_AGE',
    description: 'Combining copper and tin to create bronze.',
    prerequisites: ['COPPER_SMELTING'], unlocks: ['BRONZE_AXE', 'BRONZE_SWORD'],
    discoveryHint: 'Mix copper and tin in the smelter...'
  },
  WRITING: {
    id: 'WRITING', name: 'Writing', era: 'BRONZE_AGE',
    description: 'Recording knowledge in permanent form.',
    prerequisites: ['POTTERY'], unlocks: ['TOTEM', 'KNOWLEDGE_SHARE'],
    discoveryHint: 'Mark clay tablets with symbols...'
  },
  IRON_SMELTING: {
    id: 'IRON_SMELTING', name: 'Iron Smelting', era: 'IRON_AGE',
    description: 'Working with iron ore to create strong tools.',
    prerequisites: ['BRONZE_WORKING'], unlocks: ['IRON_TOOLS', 'IRON_SWORD'],
    discoveryHint: 'Smelt iron ore at very high temperatures...'
  },
  ENGINEERING: {
    id: 'ENGINEERING', name: 'Engineering', era: 'IRON_AGE',
    description: 'Advanced construction techniques.',
    prerequisites: ['MASONRY', 'BRONZE_WORKING'], unlocks: ['GRANARY', 'AQUEDUCT'],
    discoveryHint: 'Plan and build complex structures...'
  }
};

export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {
  STONE_AXE: {
    id: 'STONE_AXE', name: 'Stone Axe',
    ingredients: { STONE: 2, STICK: 1 },
    result: 'STONE_AXE', resultCount: 1,
    requiredTech: 'STONE_KNAPPING', craftTime: 3
  },
  STONE_KNIFE: {
    id: 'STONE_KNIFE', name: 'Stone Knife',
    ingredients: { STONE: 1, FLINT: 1 },
    result: 'STONE_KNIFE', resultCount: 1,
    requiredTech: 'STONE_KNAPPING', craftTime: 2
  },
  SPEAR: {
    id: 'SPEAR', name: 'Spear',
    ingredients: { STICK: 2, FLINT: 1 },
    result: 'SPEAR', resultCount: 1,
    requiredTech: 'SPEAR_MAKING', craftTime: 3
  },
  BASKET: {
    id: 'BASKET', name: 'Basket',
    ingredients: { FIBER: 3 },
    result: 'BASKET', resultCount: 1,
    requiredTech: 'WEAVING', craftTime: 4
  },
  ROPE: {
    id: 'ROPE', name: 'Rope',
    ingredients: { FIBER: 2 },
    result: 'ROPE', resultCount: 1,
    requiredTech: 'WEAVING', craftTime: 2
  },
  CLAY_POT: {
    id: 'CLAY_POT', name: 'Clay Pot',
    ingredients: { CLAY: 2 },
    result: 'CLAY_POT', resultCount: 1,
    requiredTech: 'POTTERY', requiredBuilding: 'CAMPFIRE', craftTime: 5
  },
  COOKED_MEAT: {
    id: 'COOKED_MEAT', name: 'Cooked Meat',
    ingredients: { RAW_MEAT: 1 },
    result: 'COOKED_MEAT', resultCount: 1,
    requiredTech: 'COOKING', requiredBuilding: 'CAMPFIRE', craftTime: 2
  },
  TORCH: {
    id: 'TORCH', name: 'Torch',
    ingredients: { STICK: 1, FIBER: 1 },
    result: 'TORCH', resultCount: 1,
    requiredTech: 'FIRE', craftTime: 1
  },
  COPPER_INGOT: {
    id: 'COPPER_INGOT', name: 'Copper Ingot',
    ingredients: { COPPER_ORE: 2 },
    result: 'COPPER_INGOT', resultCount: 1,
    requiredTech: 'COPPER_SMELTING', requiredBuilding: 'SMELTER', craftTime: 6
  },
  BRONZE_AXE: {
    id: 'BRONZE_AXE', name: 'Bronze Axe',
    ingredients: { COPPER_INGOT: 2, TIN_ORE: 1, STICK: 1 },
    result: 'BRONZE_AXE', resultCount: 1,
    requiredTech: 'BRONZE_WORKING', requiredBuilding: 'SMELTER', craftTime: 8
  }
};

export const BUILDING_RECIPES: Record<string, BuildingRecipe> = {
  CAMPFIRE: {
    type: 'CAMPFIRE', name: 'Campfire',
    ingredients: { WOOD: 3, STONE: 1 },
    requiredTech: 'FIRE', buildTime: 2,
    health: 50, radius: 1.0
  },
  LEAN_TO: {
    type: 'LEAN_TO', name: 'Lean-To Shelter',
    ingredients: { WOOD: 5, STICK: 3 },
    requiredTech: 'SHELTER_BUILDING', buildTime: 5,
    health: 80, radius: 1.5
  },
  HUT: {
    type: 'HUT', name: 'Hut',
    ingredients: { WOOD: 8, STICK: 4, CLAY: 3 },
    requiredTech: 'SHELTER_BUILDING', buildTime: 10,
    health: 150, radius: 2.0
  },
  STORAGE_PIT: {
    type: 'STORAGE_PIT', name: 'Storage Pit',
    ingredients: { STONE: 3, WOOD: 2 },
    requiredTech: 'STONE_KNAPPING', buildTime: 3,
    health: 100, radius: 1.0
  },
  DRYING_RACK: {
    type: 'DRYING_RACK', name: 'Drying Rack',
    ingredients: { WOOD: 4, ROPE: 2 },
    requiredTech: 'WEAVING', buildTime: 3,
    health: 60, radius: 1.2
  },
  WORKSHOP: {
    type: 'WORKSHOP', name: 'Workshop',
    ingredients: { WOOD: 6, STONE: 4 },
    requiredTech: 'STONE_KNAPPING', buildTime: 8,
    health: 120, radius: 2.0
  },
  FARM_PLOT: {
    type: 'FARM_PLOT', name: 'Farm Plot',
    ingredients: { WOOD: 2, STONE: 1 },
    requiredTech: 'AGRICULTURE', buildTime: 3,
    health: 50, radius: 1.5
  },
  STONE_HOUSE: {
    type: 'STONE_HOUSE', name: 'Stone House',
    ingredients: { STONE: 10, WOOD: 6, CLAY: 4 },
    requiredTech: 'MASONRY', buildTime: 15,
    health: 300, radius: 2.5
  },
  SMELTER: {
    type: 'SMELTER', name: 'Smelter',
    ingredients: { STONE: 8, CLAY: 6 },
    requiredTech: 'COPPER_SMELTING', buildTime: 12,
    health: 200, radius: 1.5
  },
  WALL: {
    type: 'WALL', name: 'Stone Wall',
    ingredients: { STONE: 4 },
    requiredTech: 'MASONRY', buildTime: 4,
    health: 250, radius: 0.5
  },
  TOTEM: {
    type: 'TOTEM', name: 'Knowledge Totem',
    ingredients: { WOOD: 3, STONE: 2 },
    requiredTech: 'WRITING', buildTime: 6,
    health: 100, radius: 0.6
  },
  GRANARY: {
    type: 'GRANARY', name: 'Granary',
    ingredients: { STONE: 6, WOOD: 8, CLAY: 4 },
    requiredTech: 'ENGINEERING', buildTime: 14,
    health: 250, radius: 2.0
  },
  WELL: {
    type: 'WELL', name: 'Well',
    ingredients: { STONE: 6, WOOD: 3 },
    requiredTech: 'MASONRY', buildTime: 8,
    health: 200, radius: 1.0
  }
};

export const SEASON_PROPERTIES: Record<Season, { tempMod: number, growthMod: number, colorHex: number }> = {
  'SPRING': { tempMod: 0, growthMod: 1.2, colorHex: 0x4caf50 },
  'SUMMER': { tempMod: 15, growthMod: 1.5, colorHex: 0x22c55e },
  'AUTUMN': { tempMod: -5, growthMod: 0.5, colorHex: 0xeab308 },
  'WINTER': { tempMod: -25, growthMod: 0.0, colorHex: 0xcbd5e1 }
};

export const SYSTEM_INSTRUCTION = `You are the mind of an Aetheri - a small, intelligent creature in a primitive world. You must survive and discover technologies to advance your civilization. You start knowing NOTHING - no fire, no tools, no shelter. Everything must be discovered through experimentation and observation. Think carefully about your needs, surroundings, and what you might learn from interacting with the world.`;

export const getTerrainHeight = (x: number, z: number): number => {
  const dist = Math.sqrt(x * x + z * z);
  let h = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 3.5;
  h += Math.sin(x * 0.08 + 1.5) * Math.cos(z * 0.08 + 2.0) * 1.5;
  h += Math.sin(x * 0.25) * Math.cos(z * 0.22) * 0.3;
  h += Math.sin(x * 0.5 + z * 0.3) * 0.15;
  if (dist > 65) h += Math.pow((dist - 65) * 0.12, 2.2);
  if (dist < 40) {
    const flattenFactor = Math.max(0, Math.min(1, (dist - 20) / 20));
    h *= flattenFactor;
  }
  return h;
};

export const getBiome = (x: number, z: number, h: number): string => {
  const dist = Math.sqrt(x * x + z * z);
  if (h < 0.2) return 'WETLAND';
  if (h > 6) return 'MOUNTAIN';
  if (h > 3.5) return 'HIGHLAND';
  if (dist > 55) return 'FOREST';
  const noise = Math.sin(x * 0.1) * Math.cos(z * 0.08);
  if (noise > 0.3) return 'DENSE_FOREST';
  if (noise < -0.3) return 'SAVANNA';
  return 'PLAINS';
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const AETHERI_NAMES_MALE = ['Zyn', 'Kael', 'Thren', 'Orax', 'Fen', 'Dusk', 'Riven', 'Ash', 'Mote', 'Glyph', 'Ember', 'Crag'];
const AETHERI_NAMES_FEMALE = ['Lyra', 'Mira', 'Elka', 'Nova', 'Fae', 'Dawn', 'Sylph', 'Ivy', 'Luna', 'Echo', 'Petal', 'Spark'];
const SKIN_TONES = ['#c4956a', '#a67c52', '#8d6e63', '#d4a574', '#b8926a', '#e8c4a0'];
const MARKING_COLORS = ['#5c6bc0', '#26a69a', '#ef5350', '#ffa726', '#ab47bc', '#66bb6a', '#42a5f5', '#ec407a'];

const createAgent = (id: string, index: number): Agent => {
  const sex = index % 2 === 0 ? 'FEMALE' : 'MALE';
  const names = sex === 'MALE' ? AETHERI_NAMES_MALE : AETHERI_NAMES_FEMALE;
  const name = names[index % names.length];
  const angle = (index / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
  const dist = 3 + Math.random() * 6;
  const x = Math.sin(angle) * dist;
  const z = Math.cos(angle) * dist;

  return {
    id,
    name,
    color: MARKING_COLORS[index % MARKING_COLORS.length],
    skinTone: SKIN_TONES[index % SKIN_TONES.length],
    markings: MARKING_COLORS[(index + 3) % MARKING_COLORS.length],
    ageDays: Math.floor(18 + Math.random() * 15) * 365,
    sex,
    position: { x, y: getTerrainHeight(x, z), z },
    rotation: Math.random() * Math.PI * 2,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: {
      hunger: 70 + Math.random() * 20,
      energy: 80 + Math.random() * 20,
      thirst: 75 + Math.random() * 20,
      social: 50 + Math.random() * 30,
      safety: 60 + Math.random() * 30,
      health: 100,
      temperature: 65 + Math.random() * 10,
      curiosity: 30 + Math.random() * 50,
    },
    neuro: {
      dopamine: 40 + Math.random() * 30,
      serotonin: 50 + Math.random() * 30,
      adrenaline: 5 + Math.random() * 10,
      oxytocin: 30 + Math.random() * 30,
      cortisol: 10 + Math.random() * 20,
    },
    personality: {
      openness: 0.3 + Math.random() * 0.6,
      conscientiousness: 0.3 + Math.random() * 0.6,
      extraversion: 0.2 + Math.random() * 0.7,
      agreeableness: 0.3 + Math.random() * 0.6,
      neuroticism: 0.1 + Math.random() * 0.6,
      creativity: 0.2 + Math.random() * 0.7,
      courage: 0.2 + Math.random() * 0.7,
      bio: ''
    },
    memories: [],
    actionMemories: [],
    relationships: {},
    inventory: {},
    knownTechnologies: [],
    currentActionLabel: 'Awakening...',
    feelings: [],
    mood: 'curious',
    aiThoughts: [],
    aiConversations: [],
    velocity: { x: 0, y: 0, z: 0 },
    radius: 0.4,
    sickness: 'NONE',
    sicknessDuration: 0,
    skillLevels: {},
    equippedTool: undefined,
  };
};

export const INITIAL_AGENTS: Agent[] = Array.from({ length: 8 }, (_, i) =>
  createAgent(`aetheri_${i + 1}`, i)
);

INITIAL_AGENTS.forEach(a => {
  INITIAL_AGENTS.forEach(b => {
    if (a.id !== b.id) a.relationships[b.id] = 30 + Math.floor(Math.random() * 30);
  });
  const bios = [
    'Endlessly curious, always poking at things.',
    'Quiet and observant, notices small details.',
    'Brave and impulsive, charges into the unknown.',
    'Gentle and caring, stays close to the group.',
    'Clever and resourceful, figures things out fast.',
    'Stubborn but loyal, never gives up.',
    'Playful and social, lifts everyone\'s spirits.',
    'Cautious and wise, thinks before acting.'
  ];
  a.personality.bio = bios[INITIAL_AGENTS.indexOf(a) % bios.length];
});

export const generateFlora = (count: number): Flora[] => {
  const items: Flora[] = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    const h = getTerrainHeight(x, z);
    const biome = getBiome(x, z, h);
    const roll = Math.random();
    let type: any, edible = false, poisonous = false, nutrition = 0, resource: string | undefined, scale = 1, radius = 0.5, resourcesLeft = 0;

    if (biome === 'WETLAND') {
      if (roll < 0.4) { type = 'REED'; scale = 0.6; resource = 'FIBER'; resourcesLeft = 3; radius = 0.3; }
      else if (roll < 0.7) { type = 'RESOURCE_CLAY'; scale = 0.5; resource = 'CLAY'; resourcesLeft = 4; radius = 0.5; }
      else { type = 'MUSHROOM_GLOW'; scale = 0.3; edible = true; nutrition = 8; radius = 0.2; }
    } else if (biome === 'MOUNTAIN' || biome === 'HIGHLAND') {
      if (roll < 0.4) { type = 'RESOURCE_ROCK'; scale = 0.5 + Math.random() * 0.3; resource = 'STONE'; resourcesLeft = 4; radius = 0.6; }
      else if (roll < 0.6) { type = 'RESOURCE_FLINT'; scale = 0.3; resource = 'FLINT'; resourcesLeft = 2; radius = 0.4; }
      else if (roll < 0.75) { type = 'RESOURCE_COPPER_ORE'; scale = 0.4; resource = 'COPPER_ORE'; resourcesLeft = 3; radius = 0.5; }
      else if (roll < 0.85) { type = 'RESOURCE_TIN_ORE'; scale = 0.35; resource = 'TIN_ORE'; resourcesLeft = 2; radius = 0.5; }
      else if (roll < 0.95) { type = 'RESOURCE_IRON_ORE'; scale = 0.4; resource = 'IRON_ORE'; resourcesLeft = 3; radius = 0.5; }
      else { type = 'BUSH_HERB'; scale = 0.3; edible = true; nutrition = 5; radius = 0.3; }
    } else if (biome === 'DENSE_FOREST' || biome === 'FOREST') {
      if (roll < 0.35) { type = Math.random() > 0.5 ? 'TREE_OAK' : 'TREE_BIRCH'; scale = 0.8 + Math.random() * 0.6; resource = 'WOOD'; resourcesLeft = 5; radius = 0.8; }
      else if (roll < 0.55) { type = 'TREE_PINE'; scale = 0.9 + Math.random() * 0.5; resource = 'WOOD'; resourcesLeft = 5; radius = 0.7; }
      else if (roll < 0.7) { type = 'BUSH_BERRY'; scale = 0.5; edible = true; nutrition = 15; resourcesLeft = 3; radius = 0.4; }
      else if (roll < 0.8) { type = 'TALL_GRASS'; scale = 0.4; resource = 'FIBER'; resourcesLeft = 2; radius = 0.3; }
      else if (roll < 0.9) {
        type = Math.random() > 0.5 ? 'MUSHROOM_RED' : 'MUSHROOM_BROWN';
        scale = 0.25; edible = true; nutrition = 8; radius = 0.2;
        if (type === 'MUSHROOM_RED' && Math.random() < 0.4) { poisonous = true; edible = false; }
      }
      else { type = 'BUSH_HERB'; scale = 0.3; edible = true; nutrition = 5; radius = 0.3; }
    } else if (biome === 'SAVANNA') {
      if (roll < 0.3) { type = 'TALL_GRASS'; scale = 0.5; resource = 'FIBER'; resourcesLeft = 2; radius = 0.3; }
      else if (roll < 0.5) { type = 'RESOURCE_ROCK'; scale = 0.4; resource = 'STONE'; resourcesLeft = 3; radius = 0.5; }
      else if (roll < 0.65) { type = 'BUSH_BERRY'; scale = 0.4; edible = true; nutrition = 12; resourcesLeft = 2; radius = 0.4; }
      else if (roll < 0.8) { type = 'CACTUS'; scale = 0.5; radius = 0.3; resourcesLeft = 1; resource = 'FIBER'; }
      else { type = 'TREE_OAK'; scale = 0.7 + Math.random() * 0.3; resource = 'WOOD'; resourcesLeft = 4; radius = 0.7; }
    } else {
      if (roll < 0.25) { type = 'TREE_OAK'; scale = 0.8 + Math.random() * 0.5; resource = 'WOOD'; resourcesLeft = 5; radius = 0.7; }
      else if (roll < 0.4) { type = 'TREE_PINE'; scale = 0.9 + Math.random() * 0.4; resource = 'WOOD'; resourcesLeft = 5; radius = 0.7; }
      else if (roll < 0.55) { type = 'BUSH_BERRY'; scale = 0.5; edible = true; nutrition = 15; resourcesLeft = 3; radius = 0.4; }
      else if (roll < 0.65) { type = 'RESOURCE_ROCK'; scale = 0.4 + Math.random() * 0.2; resource = 'STONE'; resourcesLeft = 3; radius = 0.5; }
      else if (roll < 0.75) { type = 'RESOURCE_FLINT'; scale = 0.3; resource = 'FLINT'; resourcesLeft = 2; radius = 0.4; }
      else if (roll < 0.85) { type = 'TALL_GRASS'; scale = 0.4; resource = 'FIBER'; resourcesLeft = 2; radius = 0.3; }
      else if (roll < 0.92) { type = 'FLOWER_FIELD'; scale = 0.3; radius = 0.3; }
      else { type = 'MUSHROOM_BROWN'; scale = 0.25; edible = true; nutrition = 8; radius = 0.2; }
    }

    items.push({
      id: generateId(), type, position: { x, y: h, z }, scale,
      isEdible: edible, isPoisonous: poisonous, nutritionValue: nutrition,
      resourceYield: resource, resourcesLeft, maxResources: resourcesLeft || 1,
      radius, health: 100
    });
  }
  return items;
};

export const generateFauna = (count: number): Fauna[] => {
  const items: Fauna[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let type: FaunaType, radius = 0.4, meat = 2, hide = 1, speed = 0.04, fleeD = 12, aggressive = false, hp = 30;

    if (roll > 0.92) { type = 'BEAR'; radius = 0.9; meat = 5; hide = 3; speed = 0.05; fleeD = 0; aggressive = true; hp = 80; }
    else if (roll > 0.82) { type = 'WOLF'; radius = 0.5; meat = 3; hide = 2; speed = 0.07; fleeD = 0; aggressive = true; hp = 40; }
    else if (roll > 0.65) { type = 'DEER'; radius = 0.6; meat = 4; hide = 2; speed = 0.08; fleeD = 18; hp = 35; }
    else if (roll > 0.50) { type = 'BOAR'; radius = 0.5; meat = 3; hide = 2; speed = 0.05; fleeD = 8; hp = 45; }
    else if (roll > 0.30) { type = 'RABBIT'; radius = 0.25; meat = 1; hide = 1; speed = 0.09; fleeD = 15; hp = 15; }
    else if (roll > 0.15) { type = 'BIRD'; radius = 0.2; meat = 1; hide = 0; speed = 0.06; fleeD = 20; hp = 10; }
    else { type = 'FISH'; radius = 0.2; meat = 1; hide = 0; speed = 0.03; fleeD = 5; hp = 10; }

    let x: number, z: number, h: number;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
      h = getTerrainHeight(x, z);
      attempts++;
    } while (type === 'FISH' ? h > 0.5 : h < 0.3 && attempts < 20);

    items.push({
      id: generateId(), type, position: { x, y: h, z },
      rotation: Math.random() * Math.PI * 2, state: 'IDLE', targetPosition: null,
      isAggressive: aggressive, isTamed: false, health: hp, maxHealth: hp,
      radius, meat, hide, speed, fleeDistance: fleeD
    });
  }
  return items;
};

export const generateWater = (): WaterPatch[] => {
  const patches: WaterPatch[] = [];
  for (let i = 0; i < 4; i++) {
    const segCount = 10 + Math.floor(Math.random() * 8);
    const width = 2.5 + Math.random() * 2;
    let x = (Math.random() - 0.5) * WORLD_SIZE * 0.5;
    let z = -WORLD_SIZE / 2.5;
    let angle = (Math.random() * Math.PI) / 4 - Math.PI / 8;

    for (let s = 0; s < segCount; s++) {
      const length = 6 + Math.random() * 8;
      x += Math.sin(angle) * length;
      z += Math.cos(angle) * length;
      x = Math.max(-WORLD_SIZE / 2 + width, Math.min(WORLD_SIZE / 2 - width, x));
      z = Math.max(-WORLD_SIZE / 2 + width, Math.min(WORLD_SIZE / 2 - width, z));
      angle += (Math.random() - 0.5) * 0.35;
      const h = getTerrainHeight(x, z);
      patches.push({
        id: `river_${i}_${s}_${generateId()}`, kind: 'RIVER',
        position: { x, y: h, z }, size: width, length, rotation: angle, hasFish: Math.random() > 0.6
      });
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
    const h = getTerrainHeight(x, z);
    if (h < 1.5) {
      patches.push({
        id: `lake_${generateId()}`, kind: 'LAKE',
        position: { x, y: h - 0.1, z }, size: 4 + Math.random() * 6, hasFish: true
      });
    }
  }
  return patches;
};

export const INITIAL_FLORA = generateFlora(350);
export const INITIAL_FAUNA = generateFauna(45);
export const INITIAL_WATER = generateWater();
