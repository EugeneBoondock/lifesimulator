import { Agent, AgentState, GameState, Flora, Fauna, Building, Season, Weather, Discovery, WorldEvent, Era, Settlement, ActiveEvent, Vector3, WaterPatch } from '../types';
import { TECHNOLOGIES, CRAFTING_RECIPES, BUILDING_RECIPES, SEASON_PROPERTIES, getTerrainHeight, ERA_ORDER, WORLD_SIZE, MAX_INVENTORY_SIZE, generateSettlementName, generateBabyName, MAX_POPULATION, CHILD_AGE_DAYS, ELDER_AGE_DAYS, MAX_AGE_DAYS, PREGNANCY_DURATION } from '../constants';

const generateId = () => Math.random().toString(36).substr(2, 9);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const updateNeeds = (agent: Agent, gs: GameState): Agent => {
  const a = { ...agent, needs: { ...agent.needs }, neuro: { ...agent.neuro } };
  const isNight = gs.dayTime < 6 || gs.dayTime > 19;
  const seasonMod = SEASON_PROPERTIES[gs.season];
  const hasShield = gs.buildings.some(b =>
    (b.type === 'HUT' || b.type === 'STONE_HOUSE' || b.type === 'LEAN_TO') &&
    b.ownerId === a.id && dist(b.position, a.position) < 4
  );
  const nearFire = gs.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, a.position) < 5);

  const hungerRate = a.isPregnant ? 0.05 : a.lifeStage === 'CHILD' ? 0.04 : 0.03;
  a.needs.hunger = Math.max(0, a.needs.hunger - hungerRate);
  a.needs.thirst = Math.max(0, a.needs.thirst - 0.04);

  if (a.state === AgentState.SLEEPING) {
    a.needs.energy = Math.min(100, a.needs.energy + 0.15);
  } else {
    const exertion = [AgentState.FLEEING, AgentState.FIGHTING, AgentState.HUNTING, AgentState.DEFENDING].includes(a.state) ? 0.06 :
      [AgentState.COURTING, AgentState.PLAYING].includes(a.state) ? 0.04 : 0.02;
    a.needs.energy = Math.max(0, a.needs.energy - exertion);
  }

  let targetTemp = 60 + seasonMod.tempMod;
  if (isNight) targetTemp -= 10;
  if (gs.weather === 'RAIN' || gs.weather === 'STORM') targetTemp -= 8;
  if (gs.weather === 'SNOW') targetTemp -= 15;
  if (gs.weather === 'HEAT_WAVE') targetTemp += 10;
  if (nearFire) targetTemp += 20;
  if (hasShield) targetTemp += 15;
  a.needs.temperature += (targetTemp - a.needs.temperature) * 0.02;
  a.needs.temperature = clamp(a.needs.temperature, 0, 100);

  if (a.needs.hunger < 15 || a.needs.thirst < 15) a.needs.health = Math.max(0, a.needs.health - 0.05);
  if (a.needs.temperature < 20) a.needs.health = Math.max(0, a.needs.health - 0.03);
  if (a.needs.hunger > 50 && a.needs.thirst > 50 && a.needs.temperature > 30) {
    a.needs.health = Math.min(100, a.needs.health + 0.01);
  }

  if (a.lifeStage === 'ELDER') {
    a.needs.health = Math.max(0, a.needs.health - 0.005);
  }

  const nearbyFriends = gs.agents.filter(o => o.id !== a.id && dist(o.position, a.position) < 6);
  if (nearbyFriends.length > 0) {
    a.needs.social = Math.min(100, a.needs.social + 0.1 * a.personality.extraversion);
    if (a.partnerId && nearbyFriends.some(f => f.id === a.partnerId)) {
      a.neuro.oxytocin = Math.min(100, a.neuro.oxytocin + 0.3);
    }
  } else {
    a.needs.social = Math.max(0, a.needs.social - 0.02);
  }

  const threats = gs.fauna.filter(f => f.isAggressive && dist(f.position, a.position) < 10);
  if (threats.length > 0) {
    a.needs.safety = Math.max(0, a.needs.safety - 2);
    a.neuro.adrenaline = Math.min(100, a.neuro.adrenaline + 3);
    a.neuro.cortisol = Math.min(100, a.neuro.cortisol + 2);
  } else {
    a.needs.safety = Math.min(100, a.needs.safety + 0.1);
    a.neuro.adrenaline = Math.max(0, a.neuro.adrenaline - 0.3);
  }

  if (nearFire) { a.neuro.cortisol = Math.max(0, a.neuro.cortisol - 0.5); a.neuro.serotonin = Math.min(100, a.neuro.serotonin + 0.2); }
  if (hasShield) a.neuro.cortisol = Math.max(0, a.neuro.cortisol - 0.3);
  a.neuro.cortisol = Math.max(0, a.neuro.cortisol - 0.1);
  a.neuro.dopamine = Math.max(5, a.neuro.dopamine - 0.05);

  if (a.sickness !== 'NONE') {
    a.sicknessDuration = Math.max(0, a.sicknessDuration - 1);
    a.needs.health = Math.max(0, a.needs.health - 0.02);
    if (a.sicknessDuration <= 0) a.sickness = 'NONE';
  }

  a.needs.curiosity = Math.min(100, a.needs.curiosity + 0.01 * a.personality.openness);

  if (a.isPregnant) {
    a.pregnancyTimer = Math.max(0, a.pregnancyTimer - 1);
  }

  return a;
};

export const deriveFeelings = (agent: Agent): { feelings: string[]; mood: string } => {
  const { dopamine, serotonin, adrenaline, oxytocin, cortisol } = agent.neuro;
  const f = new Set<string>();
  if (dopamine > 70) f.add('motivated');
  if (dopamine < 25) f.add('listless');
  if (serotonin > 70) f.add('content');
  if (serotonin < 30) f.add('restless');
  if (cortisol > 70) f.add('stressed');
  if (cortisol > 85) f.add('panicked');
  if (adrenaline > 60) f.add('alert');
  if (adrenaline < 20 && cortisol < 35) f.add('calm');
  if (oxytocin > 60) f.add('bonded');
  if (oxytocin > 80) f.add('loving');
  if (oxytocin < 20 && serotonin < 35) f.add('lonely');
  if (agent.needs.energy < 25) f.add('exhausted');
  if (agent.needs.hunger < 25) f.add('starving');
  if (agent.needs.thirst < 25) f.add('parched');
  if (agent.needs.curiosity > 70) f.add('curious');
  if (agent.isPregnant) f.add('expecting');
  if (agent.lifeStage === 'CHILD') f.add('playful');

  const mood =
    (['panicked', 'stressed', 'starving', 'parched', 'exhausted'].find(x => f.has(x))) ||
    (['loving', 'motivated', 'alert', 'curious', 'bonded'].find(x => f.has(x))) ||
    (['content', 'calm', 'playful'].find(x => f.has(x))) ||
    (['restless', 'listless', 'lonely'].find(x => f.has(x))) ||
    'neutral';

  return { feelings: Array.from(f), mood };
};

export const tryDiscoverTechnology = (
  agent: Agent, gs: GameState
): { techId: string; description: string } | null => {
  const discoveryTarget = agent.targetId?.startsWith('RESEARCH:') ? agent.targetId.split(':')[1] : null;
  if (!discoveryTarget) return null;

  const tech = TECHNOLOGIES[discoveryTarget];
  if (!tech) return null;
  if (agent.knownTechnologies.includes(tech.id)) return null;
  if (!tech.prerequisites.every(p => agent.knownTechnologies.includes(p))) return null;

  let chance = 0.05 + agent.personality.creativity * 0.1 + agent.personality.openness * 0.05;
  const skill = agent.skillLevels[tech.era] || 0;
  chance += skill * 0.02;

  switch (tech.id) {
    case 'FIRE':
      if ((agent.inventory.FLINT || 0) > 0 && (agent.inventory.WOOD || 0) > 0) chance += 0.15;
      else chance = 0.01;
      break;
    case 'STONE_KNAPPING':
      if ((agent.inventory.STONE || 0) >= 2 || (agent.inventory.FLINT || 0) > 0) chance += 0.15;
      else chance = 0.02;
      break;
    case 'COOKING':
      if (gs.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 5)) chance += 0.2;
      else chance = 0.01;
      break;
    case 'SHELTER_BUILDING':
      if ((agent.inventory.WOOD || 0) >= 3) chance += 0.15;
      else chance = 0.02;
      break;
    case 'SPEAR_MAKING':
      if ((agent.inventory.STICK || 0) > 0 && (agent.inventory.FLINT || 0) > 0) chance += 0.15;
      else chance = 0.02;
      break;
    case 'AGRICULTURE':
      if ((agent.inventory.SEEDS || 0) > 0) chance += 0.15;
      else chance = 0.02;
      break;
    case 'POTTERY':
      if ((agent.inventory.CLAY || 0) >= 2 && gs.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 5)) chance += 0.2;
      else chance = 0.01;
      break;
    case 'COPPER_SMELTING':
      if ((agent.inventory.COPPER_ORE || 0) > 0 && gs.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 5)) chance += 0.1;
      else chance = 0.01;
      break;
    default:
      chance = Math.min(0.15, chance);
  }

  if (Math.random() < chance) {
    return { techId: tech.id, description: `${agent.name} discovered ${tech.name}! ${tech.description}` };
  }
  return null;
};

export const calculateEra = (techs: string[]): Era => {
  const techSet = new Set(techs);
  if (techSet.has('IRON_SMELTING') || techSet.has('ENGINEERING')) return 'IRON_AGE';
  if (techSet.has('COPPER_SMELTING') || techSet.has('BRONZE_WORKING') || techSet.has('MASONRY')) return 'BRONZE_AGE';
  if (techSet.has('AGRICULTURE') || techSet.has('POTTERY') || techSet.has('ANIMAL_HUSBANDRY')) return 'AGRICULTURAL';
  if (techSet.has('STONE_KNAPPING') || techSet.has('FIRE') || techSet.has('SHELTER_BUILDING')) return 'STONE_AGE';
  return 'PRIMITIVE';
};

export const performGathering = (agent: Agent, flora: Flora): { agent: Agent; flora: Flora; log?: string } => {
  const a = { ...agent, inventory: { ...agent.inventory } };
  const f = { ...flora };
  const invCount = Object.values(a.inventory).reduce((s, v) => s + v, 0);
  if (invCount >= MAX_INVENTORY_SIZE) return { agent: a, flora: f };
  if (!f.resourceYield || (f.resourcesLeft || 0) <= 0) {
    if (f.isEdible && !f.isPoisonous) {
      a.needs = { ...a.needs, hunger: Math.min(100, a.needs.hunger + f.nutritionValue) };
      f.resourcesLeft = 0;
      return { agent: a, flora: f, log: `${a.name} ate ${f.type.replace('_', ' ').toLowerCase()}` };
    }
    return { agent: a, flora: f };
  }

  const yield_ = f.resourceYield;
  a.inventory[yield_] = (a.inventory[yield_] || 0) + 1;
  f.resourcesLeft = (f.resourcesLeft || 0) - 1;

  if (yield_ === 'WOOD') a.inventory['STICK'] = (a.inventory['STICK'] || 0) + 1;
  if (f.type === 'BUSH_BERRY' && Math.random() < 0.3) a.inventory['SEEDS'] = (a.inventory['SEEDS'] || 0) + 1;
  if (f.type === 'TALL_GRASS' || f.type === 'REED') a.inventory['FIBER'] = (a.inventory['FIBER'] || 0) + 1;

  const skillKey = 'gathering';
  a.skillLevels = { ...a.skillLevels, [skillKey]: (a.skillLevels[skillKey] || 0) + 0.01 };
  a.neuro = { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 3) };

  return { agent: a, flora: f, log: `${a.name} gathered ${yield_}` };
};

export const performCrafting = (agent: Agent, recipeId: string, buildings: Building[]): { agent: Agent; log?: string } | null => {
  const recipe = CRAFTING_RECIPES[recipeId.toUpperCase()];
  if (!recipe) return null;
  if (recipe.requiredTech && !agent.knownTechnologies.includes(recipe.requiredTech)) return null;
  if (recipe.requiredBuilding && !buildings.some(b => b.type === recipe.requiredBuilding && dist(b.position, agent.position) < 5)) return null;

  const a = { ...agent, inventory: { ...agent.inventory } };
  for (const [mat, qty] of Object.entries(recipe.ingredients)) {
    if ((a.inventory[mat] || 0) < qty) return null;
  }

  for (const [mat, qty] of Object.entries(recipe.ingredients)) {
    a.inventory[mat] -= qty;
    if (a.inventory[mat] <= 0) delete a.inventory[mat];
  }

  a.inventory[recipe.result] = (a.inventory[recipe.result] || 0) + recipe.resultCount;
  a.neuro = { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 10) };
  a.skillLevels = { ...a.skillLevels, crafting: (a.skillLevels.crafting || 0) + 0.02 };

  return { agent: a, log: `${a.name} crafted ${recipe.name}` };
};

export const startBuilding = (agent: Agent, buildType: string): { agent: Agent; building: Building; log?: string } | null => {
  const key = buildType.toUpperCase().replace(/\s+/g, '_');
  const recipe = BUILDING_RECIPES[key];
  if (!recipe) return null;
  if (recipe.requiredTech && !agent.knownTechnologies.includes(recipe.requiredTech)) return null;

  const a = { ...agent, inventory: { ...agent.inventory } };
  for (const [mat, qty] of Object.entries(recipe.ingredients)) {
    if ((a.inventory[mat] || 0) < qty) return null;
  }

  for (const [mat, qty] of Object.entries(recipe.ingredients)) {
    a.inventory[mat] -= qty;
    if (a.inventory[mat] <= 0) delete a.inventory[mat];
  }

  const buildPos = a.targetPosition || { x: a.position.x + (Math.random() - 0.5) * 4, y: 0, z: a.position.z + (Math.random() - 0.5) * 4 };
  buildPos.y = getTerrainHeight(buildPos.x, buildPos.z);

  const building: Building = {
    id: `bld_${generateId()}`,
    position: buildPos,
    type: recipe.type,
    ownerId: a.id,
    scale: 1,
    radius: recipe.radius,
    health: recipe.health,
    maxHealth: recipe.health,
    buildProgress: 100,
    rotation: Math.random() * Math.PI * 2,
  };

  a.neuro = { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 15) };
  a.skillLevels = { ...a.skillLevels, building: (a.skillLevels.building || 0) + 0.03 };

  return { agent: a, building, log: `${a.name} built a ${recipe.name}!` };
};

export const performHunting = (agent: Agent, animal: Fauna): { agent: Agent; animal: Fauna; killed: boolean; log?: string } => {
  const a = { ...agent, inventory: { ...agent.inventory }, neuro: { ...agent.neuro } };
  const f = { ...animal };

  const tool = a.equippedTool || (a.inventory.SPEAR ? 'SPEAR' : a.inventory.STONE_AXE ? 'STONE_AXE' : a.inventory.STONE_KNIFE ? 'STONE_KNIFE' : a.inventory.STICK ? 'STICK' : undefined);
  const dmg = tool === 'SPEAR' ? 20 : tool === 'STONE_AXE' ? 15 : tool === 'STONE_KNIFE' ? 12 : tool === 'BRONZE_AXE' ? 25 : tool === 'STICK' ? 8 : 5;

  f.health -= dmg;
  a.neuro.adrenaline = Math.min(100, a.neuro.adrenaline + 5);

  if (f.health <= 0) {
    a.inventory['RAW_MEAT'] = (a.inventory['RAW_MEAT'] || 0) + f.meat;
    a.inventory['HIDE'] = (a.inventory['HIDE'] || 0) + f.hide;
    a.neuro.dopamine = Math.min(100, a.neuro.dopamine + 10);
    a.skillLevels = { ...a.skillLevels, hunting: (a.skillLevels.hunting || 0) + 0.03 };
    return { agent: a, animal: f, killed: true, log: `${a.name} hunted a ${f.type} and gathered ${f.meat} meat` };
  }

  return { agent: a, animal: f, killed: false, log: `${a.name} attacked a ${f.type}` };
};

export const performAgentCombat = (attacker: Agent, defender: Agent): { attacker: Agent; defender: Agent; log: string } => {
  const a = { ...attacker, neuro: { ...attacker.neuro }, needs: { ...attacker.needs }, inventory: { ...attacker.inventory } };
  const d = { ...defender, neuro: { ...defender.neuro }, needs: { ...defender.needs }, inventory: { ...defender.inventory } };

  const aTool = a.equippedTool || (a.inventory.SPEAR ? 'SPEAR' : a.inventory.STONE_AXE ? 'STONE_AXE' : undefined);
  const dTool = d.equippedTool || (d.inventory.SPEAR ? 'SPEAR' : d.inventory.STONE_AXE ? 'STONE_AXE' : undefined);

  const toolDmg = (t?: string) => t === 'SPEAR' ? 12 : t === 'BRONZE_AXE' ? 15 : t === 'STONE_AXE' ? 10 : t === 'STONE_KNIFE' ? 8 : 4;
  const aDmg = toolDmg(aTool) + a.personality.courage * 3;
  const dDmg = toolDmg(dTool) + d.personality.courage * 2;

  d.needs.health = Math.max(0, d.needs.health - aDmg);
  a.needs.health = Math.max(0, a.needs.health - dDmg * 0.5);
  a.neuro.adrenaline = Math.min(100, a.neuro.adrenaline + 10);
  d.neuro.adrenaline = Math.min(100, d.neuro.adrenaline + 10);
  a.neuro.cortisol = Math.min(100, a.neuro.cortisol + 5);
  d.neuro.cortisol = Math.min(100, d.neuro.cortisol + 8);

  const rel = { ...a.relationships };
  rel[d.id] = (rel[d.id] || 0) - 15;
  a.relationships = rel;
  a.relationshipTypes = { ...a.relationshipTypes, [d.id]: 'RIVAL' };

  const dRel = { ...d.relationships };
  dRel[a.id] = (dRel[a.id] || 0) - 15;
  d.relationships = dRel;
  d.relationshipTypes = { ...d.relationshipTypes, [a.id]: 'RIVAL' };

  return { attacker: a, defender: d, log: `⚔️ ${a.name} fought ${d.name}!` };
};

export const attemptCourting = (agent: Agent, target: Agent, allAgents: Agent[]): boolean => {
  if (agent.lifeStage !== 'ADULT' || target.lifeStage !== 'ADULT') return false;
  if (agent.sex === target.sex) return false;
  if (agent.partnerId || target.partnerId) return false;
  if ((agent.relationships[target.id] || 0) < 40) return false;
  if (allAgents.length >= MAX_POPULATION) return false;
  return true;
};

export const formPartnership = (agent: Agent, target: Agent): { agent: Agent; target: Agent; log: string } => {
  const a = { ...agent, relationships: { ...agent.relationships }, relationshipTypes: { ...agent.relationshipTypes } };
  const t = { ...target, relationships: { ...target.relationships }, relationshipTypes: { ...target.relationshipTypes } };

  a.partnerId = t.id;
  t.partnerId = a.id;
  a.relationships[t.id] = Math.min(100, (a.relationships[t.id] || 0) + 20);
  t.relationships[a.id] = Math.min(100, (t.relationships[a.id] || 0) + 20);
  a.relationshipTypes[t.id] = 'PARTNER';
  t.relationshipTypes[a.id] = 'PARTNER';
  a.neuro = { ...a.neuro, oxytocin: Math.min(100, a.neuro.oxytocin + 30), dopamine: Math.min(100, a.neuro.dopamine + 20) };
  t.neuro = { ...t.neuro, oxytocin: Math.min(100, t.neuro.oxytocin + 30), dopamine: Math.min(100, t.neuro.dopamine + 20) };

  return { agent: a, target: t, log: `💕 ${a.name} and ${t.name} have become partners!` };
};

export const startPregnancy = (female: Agent): Agent => {
  return { ...female, isPregnant: true, pregnancyTimer: PREGNANCY_DURATION };
};

export const giveBirth = (mother: Agent, father: Agent | undefined, day: number): { mother: Agent; baby: Agent; log: string } => {
  const m = { ...mother, children: [...mother.children], isPregnant: false, pregnancyTimer: 0 };
  const fatherName = father?.name || 'unknown';
  const babyName = generateBabyName(m.name, fatherName);
  const sex = Math.random() > 0.5 ? 'MALE' as const : 'FEMALE' as const;

  const skinTones = ['#c4956a', '#a67c52', '#8d6e63', '#d4a574', '#b8926a', '#e8c4a0'];
  const markings = ['#5c6bc0', '#26a69a', '#ef5350', '#ffa726', '#ab47bc', '#66bb6a', '#42a5f5', '#ec407a'];

  const inheritTrait = (m: number, f: number) => {
    const base = (m + f) / 2;
    return clamp(base + (Math.random() - 0.5) * 0.3, 0, 1);
  };

  const baby: Agent = {
    id: `aetheri_${generateId()}`,
    name: babyName,
    color: Math.random() > 0.5 ? m.color : (father?.color || markings[Math.floor(Math.random() * markings.length)]),
    skinTone: Math.random() > 0.5 ? m.skinTone : (father?.skinTone || skinTones[Math.floor(Math.random() * skinTones.length)]),
    markings: markings[Math.floor(Math.random() * markings.length)],
    ageDays: 0,
    sex,
    lifeStage: 'CHILD',
    position: { x: m.position.x + (Math.random() - 0.5) * 2, y: m.position.y, z: m.position.z + (Math.random() - 0.5) * 2 },
    rotation: Math.random() * Math.PI * 2,
    targetPosition: null,
    state: AgentState.IDLE,
    needs: {
      hunger: 80, energy: 90, thirst: 80, social: 70,
      safety: 50, health: 100, temperature: 65, curiosity: 80
    },
    neuro: { dopamine: 60, serotonin: 70, adrenaline: 5, oxytocin: 80, cortisol: 10 },
    personality: {
      openness: inheritTrait(m.personality.openness, father?.personality.openness || 0.5),
      conscientiousness: inheritTrait(m.personality.conscientiousness, father?.personality.conscientiousness || 0.5),
      extraversion: inheritTrait(m.personality.extraversion, father?.personality.extraversion || 0.5),
      agreeableness: inheritTrait(m.personality.agreeableness, father?.personality.agreeableness || 0.5),
      neuroticism: inheritTrait(m.personality.neuroticism, father?.personality.neuroticism || 0.3),
      creativity: inheritTrait(m.personality.creativity, father?.personality.creativity || 0.5),
      courage: inheritTrait(m.personality.courage, father?.personality.courage || 0.5),
      bio: `Child of ${m.name} and ${fatherName}. Born on day ${day}.`
    },
    memories: [{ timestamp: 0, description: `I was born to ${m.name} and ${fatherName}`, importance: 10, type: 'family' }],
    actionMemories: [],
    relationships: { [m.id]: 80 },
    relationshipTypes: { [m.id]: 'PARENT' },
    inventory: {},
    knownTechnologies: [],
    currentActionLabel: 'Newborn',
    feelings: ['playful'],
    mood: 'playful',
    aiThoughts: [],
    aiConversations: [],
    velocity: { x: 0, y: 0, z: 0 },
    radius: 0.3,
    sickness: 'NONE',
    sicknessDuration: 0,
    skillLevels: {},
    children: [],
    generation: m.generation + 1,
    isPregnant: false,
    pregnancyTimer: 0,
    birthDay: day,
    parentIds: [m.id, father?.id || ''],
  };

  if (father) {
    baby.relationships[father.id] = 80;
    baby.relationshipTypes[father.id] = 'PARENT';
  }

  m.children.push(baby.id);
  m.neuro = { ...m.neuro, oxytocin: Math.min(100, m.neuro.oxytocin + 40), dopamine: Math.min(100, m.neuro.dopamine + 30) };
  m.relationships = { ...m.relationships, [baby.id]: 90 };
  m.relationshipTypes = { ...m.relationshipTypes, [baby.id]: 'CHILD_REL' };

  return { mother: m, baby, log: `🍼 ${m.name} gave birth to ${babyName}!` };
};

export const updateLifeStage = (agent: Agent): Agent => {
  const a = { ...agent };
  if (a.ageDays >= ELDER_AGE_DAYS && a.lifeStage !== 'ELDER') {
    a.lifeStage = 'ELDER';
    a.radius = 0.4;
  } else if (a.ageDays >= CHILD_AGE_DAYS && a.lifeStage === 'CHILD') {
    a.lifeStage = 'ADULT';
    a.radius = 0.4;
  }
  return a;
};

export const shareFood = (giver: Agent, receiver: Agent): { giver: Agent; receiver: Agent; log: string } | null => {
  const foods = ['COOKED_MEAT', 'RAW_MEAT', 'BERRY', 'SEEDS'];
  const g = { ...giver, inventory: { ...giver.inventory }, relationships: { ...giver.relationships }, relationshipTypes: { ...giver.relationshipTypes } };
  const r = { ...receiver, inventory: { ...receiver.inventory }, relationships: { ...receiver.relationships }, needs: { ...receiver.needs } };

  for (const food of foods) {
    if ((g.inventory[food] || 0) > 0) {
      g.inventory[food] -= 1;
      if (g.inventory[food] <= 0) delete g.inventory[food];
      const nutrition = food === 'COOKED_MEAT' ? 35 : food === 'RAW_MEAT' ? 20 : 12;
      r.needs.hunger = Math.min(100, r.needs.hunger + nutrition);
      g.relationships[r.id] = Math.min(100, (g.relationships[r.id] || 0) + 10);
      r.relationships[g.id] = Math.min(100, (r.relationships[g.id] || 0) + 15);
      if ((g.relationships[r.id] || 0) > 50) {
        g.relationshipTypes[r.id] = g.relationshipTypes[r.id] || 'FRIEND';
        r.relationshipTypes = { ...r.relationshipTypes, [g.id]: r.relationshipTypes[g.id] || 'FRIEND' };
      }
      return { giver: g, receiver: r, log: `🤝 ${g.name} shared ${food.toLowerCase().replace('_', ' ')} with ${r.name}` };
    }
  }
  return null;
};

export const detectSettlements = (buildings: Building[], agents: Agent[], existing: Settlement[]): Settlement[] => {
  const buildingClusters: Building[][] = [];
  const assigned = new Set<string>();

  for (const b of buildings) {
    if (assigned.has(b.id)) continue;
    const cluster = [b];
    assigned.add(b.id);
    for (const other of buildings) {
      if (assigned.has(other.id)) continue;
      if (dist(b.position, other.position) < 12) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }
    if (cluster.length >= 3) buildingClusters.push(cluster);
  }

  const settlements: Settlement[] = [];

  for (const cluster of buildingClusters) {
    const cx = cluster.reduce((s, b) => s + b.position.x, 0) / cluster.length;
    const cz = cluster.reduce((s, b) => s + b.position.z, 0) / cluster.length;
    const center: Vector3 = { x: cx, y: getTerrainHeight(cx, cz), z: cz };
    const radius = Math.max(8, ...cluster.map(b => dist(b.position, center) + 3));

    const members = agents.filter(a => dist(a.position, center) < radius + 5).map(a => a.id);
    if (members.length < 2) continue;

    const existingSettlement = existing.find(s => dist(s.position, center) < 15);
    if (existingSettlement) {
      settlements.push({
        ...existingSettlement,
        position: center,
        radius,
        members,
        buildings: cluster.map(b => b.id),
      });
    } else {
      settlements.push({
        id: `settlement_${generateId()}`,
        name: generateSettlementName(),
        position: center,
        radius,
        members,
        buildings: cluster.map(b => b.id),
        founded: 0,
        founderName: agents.find(a => members.includes(a.id))?.name || 'Unknown',
      });
    }
  }

  return settlements;
};

export const rollForEvent = (gs: GameState): ActiveEvent | null => {
  if (gs.activeEvents.length >= 2) return null;
  if (Math.random() > 0.02) return null;

  const eraWeight = ERA_ORDER.indexOf(gs.currentEra);
  const events: Array<{ type: ActiveEvent['type']; name: string; desc: string; dur: number; intensity: number; weight: number }> = [
    { type: 'PREDATOR_WAVE', name: 'Wolf Pack Attack', desc: 'A pack of wolves descends from the mountains!', dur: 150, intensity: 1 + eraWeight * 0.2, weight: 3 },
    { type: 'RESOURCE_BOUNTY', name: 'Abundant Harvest', desc: 'The land blooms with resources!', dur: 200, intensity: 1, weight: 4 },
    { type: 'DISEASE_OUTBREAK', name: 'Plague Spreads', desc: 'A mysterious illness spreads through the tribe.', dur: 180, intensity: 0.5 + eraWeight * 0.3, weight: 2 },
    { type: 'EARTHQUAKE', name: 'Earthquake', desc: 'The ground shakes violently!', dur: 30, intensity: 1 + eraWeight * 0.5, weight: 1 },
    { type: 'WILDFIRE', name: 'Wildfire', desc: 'Flames spread across the land!', dur: 100, intensity: 1, weight: gs.season === 'SUMMER' ? 3 : 1 },
    { type: 'METEOR', name: 'Fallen Star', desc: 'A glowing stone falls from the sky, bringing rare materials!', dur: 50, intensity: 1, weight: 1 },
    { type: 'DROUGHT', name: 'Drought', desc: 'Water sources begin to dry up.', dur: 250, intensity: 1, weight: gs.season === 'SUMMER' ? 2 : 0 },
    { type: 'MIGRATION', name: 'Animal Migration', desc: 'Herds of animals pass through the area.', dur: 150, intensity: 1, weight: gs.season === 'AUTUMN' ? 4 : 2 },
    { type: 'FESTIVAL', name: 'Festival of Light', desc: 'The Aetheri celebrate their achievements!', dur: 80, intensity: 1, weight: gs.settlements.length > 0 ? 3 : 0 },
  ];

  const totalWeight = events.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return null;
  let roll = Math.random() * totalWeight;
  for (const e of events) {
    roll -= e.weight;
    if (roll <= 0) {
      const cx = (Math.random() - 0.5) * WORLD_SIZE * 0.5;
      const cz = (Math.random() - 0.5) * WORLD_SIZE * 0.5;
      return {
        id: `evt_${generateId()}`,
        type: e.type,
        name: e.name,
        description: e.desc,
        duration: e.dur,
        ticksRemaining: e.dur,
        affectedArea: { x: cx, y: 0, z: cz },
        intensity: e.intensity,
      };
    }
  }
  return null;
};

export const processActiveEvents = (gs: GameState): { flora: Flora[]; fauna: Fauna[]; water: WaterPatch[]; agents: Agent[]; buildings: Building[]; logs: WorldEvent[]; events: ActiveEvent[] } => {
  let { flora, fauna, water, agents, buildings } = gs;
  const logs: WorldEvent[] = [];
  const events = gs.activeEvents.map(e => ({ ...e, ticksRemaining: e.ticksRemaining - 1 })).filter(e => e.ticksRemaining > 0);

  for (const event of events) {
    const area = event.affectedArea;
    if (!area) continue;

    switch (event.type) {
      case 'PREDATOR_WAVE':
        if (event.ticksRemaining === event.duration - 1) {
          for (let i = 0; i < 4; i++) {
            const x = area.x + (Math.random() - 0.5) * 20;
            const z = area.z + (Math.random() - 0.5) * 20;
            fauna = [...fauna, {
              id: `wolf_evt_${generateId()}`, type: 'WOLF',
              position: { x, y: getTerrainHeight(x, z), z },
              rotation: Math.random() * Math.PI * 2, state: 'IDLE', targetPosition: null,
              isAggressive: true, isTamed: false, health: 50, maxHealth: 50,
              radius: 0.5, meat: 3, hide: 2, speed: 0.07, fleeDistance: 0
            }];
          }
        }
        break;
      case 'RESOURCE_BOUNTY':
        if (event.ticksRemaining % 40 === 0 && flora.length < 500) {
          const x = area.x + (Math.random() - 0.5) * 30;
          const z = area.z + (Math.random() - 0.5) * 30;
          const h = getTerrainHeight(x, z);
          flora = [...flora, {
            id: `bounty_${generateId()}`, type: 'BUSH_BERRY',
            position: { x, y: h, z }, scale: 0.5,
            isEdible: true, isPoisonous: false, nutritionValue: 15,
            resourceYield: undefined, resourcesLeft: 3, maxResources: 3,
            radius: 0.4, health: 100
          }];
        }
        break;
      case 'DISEASE_OUTBREAK':
        if (event.ticksRemaining % 20 === 0) {
          agents = agents.map(a => {
            if (dist(a.position, area) < 25 && a.sickness === 'NONE' && Math.random() < 0.05 * event.intensity) {
              return { ...a, sickness: 'COLD' as const, sicknessDuration: 150 };
            }
            return a;
          });
        }
        break;
      case 'EARTHQUAKE':
        if (event.ticksRemaining % 5 === 0) {
          buildings = buildings.map(b => {
            if (dist(b.position, area) < 30) {
              const dmg = 5 * event.intensity;
              return { ...b, health: Math.max(0, b.health - dmg) };
            }
            return b;
          }).filter(b => b.health > 0);
        }
        break;
      case 'WILDFIRE':
        if (event.ticksRemaining % 10 === 0) {
          flora = flora.map(f => {
            if (dist(f.position, area) < 20 && f.type.startsWith('TREE') && Math.random() < 0.03) {
              return { ...f, isOnFire: true, health: 0 };
            }
            return f;
          }).filter(f => f.health > 0 || !f.isOnFire);
        }
        break;
      case 'METEOR':
        if (event.ticksRemaining === event.duration - 1) {
          const resources: Flora[] = [];
          for (let i = 0; i < 5; i++) {
            const x = area.x + (Math.random() - 0.5) * 8;
            const z = area.z + (Math.random() - 0.5) * 8;
            const types = ['RESOURCE_COPPER_ORE', 'RESOURCE_TIN_ORE', 'RESOURCE_IRON_ORE'] as const;
            const t = types[Math.floor(Math.random() * types.length)];
            const yields: Record<string, string> = { RESOURCE_COPPER_ORE: 'COPPER_ORE', RESOURCE_TIN_ORE: 'TIN_ORE', RESOURCE_IRON_ORE: 'IRON_ORE' };
            resources.push({
              id: `meteor_${generateId()}`, type: t,
              position: { x, y: getTerrainHeight(x, z), z }, scale: 0.4,
              isEdible: false, isPoisonous: false, nutritionValue: 0,
              resourceYield: yields[t], resourcesLeft: 5, maxResources: 5,
              radius: 0.5, health: 100
            });
          }
          flora = [...flora, ...resources];
        }
        break;
      case 'DROUGHT':
        if (event.ticksRemaining % 30 === 0) {
          water = water.map(w => {
            if (w.kind === 'PUDDLE') return { ...w, ttl: (w.ttl || 100) - 50 };
            return w;
          });
        }
        break;
      case 'MIGRATION':
        if (event.ticksRemaining === event.duration - 1) {
          for (let i = 0; i < 8; i++) {
            const x = area.x + (Math.random() - 0.5) * 30;
            const z = area.z + (Math.random() - 0.5) * 30;
            const types = [
              { type: 'DEER' as const, hp: 35, meat: 4, hide: 2, speed: 0.08, flee: 18, radius: 0.6 },
              { type: 'RABBIT' as const, hp: 15, meat: 1, hide: 1, speed: 0.09, flee: 15, radius: 0.25 },
              { type: 'BOAR' as const, hp: 45, meat: 3, hide: 2, speed: 0.05, flee: 8, radius: 0.5 },
            ];
            const t = types[Math.floor(Math.random() * types.length)];
            fauna = [...fauna, {
              id: `migr_${generateId()}`, type: t.type,
              position: { x, y: getTerrainHeight(x, z), z },
              rotation: Math.random() * Math.PI * 2, state: 'IDLE' as const, targetPosition: null,
              isAggressive: false, isTamed: false, health: t.hp, maxHealth: t.hp,
              radius: t.radius, meat: t.meat, hide: t.hide, speed: t.speed, fleeDistance: t.flee
            }];
          }
        }
        break;
      case 'FESTIVAL':
        if (event.ticksRemaining % 10 === 0) {
          agents = agents.map(a => {
            if (dist(a.position, area) < 30) {
              return {
                ...a,
                neuro: { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 2), serotonin: Math.min(100, a.neuro.serotonin + 2), oxytocin: Math.min(100, a.neuro.oxytocin + 1) },
                needs: { ...a.needs, social: Math.min(100, a.needs.social + 2) }
              };
            }
            return a;
          });
        }
        break;
    }
  }

  return { flora, fauna, water, agents, buildings, logs, events };
};

export const updateFauna = (animal: Fauna, agents: Agent[], gs: GameState): Fauna => {
  const a = { ...animal, position: { ...animal.position } };

  if (a.isTamed && a.ownerId) {
    const owner = agents.find(ag => ag.id === a.ownerId);
    if (owner && dist(a.position, owner.position) > 4) {
      a.state = 'MOVING';
      a.rotation = Math.atan2(owner.position.x - a.position.x, owner.position.z - a.position.z);
    } else {
      a.state = Math.random() < 0.02 ? 'MOVING' : 'IDLE';
    }
  } else {
    const nearbyAgents = agents.filter(ag => dist(ag.position, a.position) < a.fleeDistance);
    if (nearbyAgents.length > 0 && !a.isAggressive) {
      a.state = 'FLEEING';
      const closest = nearbyAgents[0];
      a.rotation = Math.atan2(a.position.x - closest.position.x, a.position.z - closest.position.z);
    } else if (a.isAggressive && nearbyAgents.length > 0 && dist(nearbyAgents[0].position, a.position) < 8) {
      a.state = 'HUNTING';
      a.rotation = Math.atan2(nearbyAgents[0].position.x - a.position.x, nearbyAgents[0].position.z - a.position.z);
    } else {
      if (a.state === 'FLEEING') a.state = 'IDLE';
      if (Math.random() < 0.015) a.state = a.state === 'IDLE' ? 'MOVING' : 'IDLE';
      if (a.state === 'MOVING' && Math.random() < 0.03) a.rotation += (Math.random() - 0.5) * 1.0;

      const isNight = gs.dayTime < 5 || gs.dayTime > 20;
      if (isNight && Math.random() < 0.02) a.state = 'SLEEPING';
      if (a.state === 'SLEEPING' && !isNight && Math.random() < 0.05) a.state = 'IDLE';
    }
  }

  if (a.state === 'MOVING' || a.state === 'FLEEING' || a.state === 'HUNTING') {
    const spd = a.state === 'FLEEING' ? a.speed * 1.5 : a.state === 'HUNTING' ? a.speed * 1.2 : a.speed;
    const nx = a.position.x + Math.sin(a.rotation) * spd;
    const nz = a.position.z + Math.cos(a.rotation) * spd;
    if (Math.abs(nx) < WORLD_SIZE / 2 && Math.abs(nz) < WORLD_SIZE / 2) {
      a.position.x = nx;
      a.position.z = nz;
      a.position.y = getTerrainHeight(nx, nz);
    } else {
      a.rotation += Math.PI;
    }
  }

  return a;
};

export const updateWeather = (current: Weather, season: Season): Weather => {
  if (Math.random() > 0.003) return current;
  const opts: Record<Season, Weather[]> = {
    SPRING: ['CLEAR', 'CLOUDY', 'RAIN', 'RAIN', 'FOG'],
    SUMMER: ['CLEAR', 'CLEAR', 'CLOUDY', 'HEAT_WAVE', 'STORM'],
    AUTUMN: ['CLOUDY', 'RAIN', 'CLEAR', 'STORM', 'FOG'],
    WINTER: ['CLOUDY', 'SNOW', 'SNOW', 'CLEAR', 'STORM']
  };
  const options = opts[season];
  return options[Math.floor(Math.random() * options.length)];
};

export const fallbackBehavior = (agent: Agent, gs: GameState): Partial<Agent> => {
  const isNight = gs.dayTime < 6 || gs.dayTime > 19;
  const p = agent.personality;

  if (agent.needs.safety < 30) {
    const threat = gs.fauna.find(f => f.isAggressive && dist(f.position, agent.position) < 10);
    if (threat) {
      return {
        state: AgentState.FLEEING,
        targetPosition: { x: agent.position.x + (agent.position.x - threat.position.x) * 3, y: 0, z: agent.position.z + (agent.position.z - threat.position.z) * 3 },
        currentActionLabel: 'Fleeing!'
      };
    }
  }

  if (agent.needs.hunger < 25) {
    const food = gs.flora.filter(f => f.isEdible && !f.isPoisonous && (f.resourcesLeft || 0) > 0)
      .sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
    if (food) return { state: AgentState.MOVING, targetPosition: food.position, targetId: food.id, currentActionLabel: 'Finding food' };
  }

  if (agent.needs.thirst < 25) {
    const water = gs.water.sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
    if (water) return { state: AgentState.MOVING, targetPosition: water.position, targetId: 'DRINK', currentActionLabel: 'Finding water' };
  }

  const sleepThreshold = isNight ? 55 : 20;
  if (agent.needs.energy < sleepThreshold) {
    return { state: AgentState.SLEEPING, currentActionLabel: isNight ? 'Sleeping' : 'Resting' };
  }

  if (agent.needs.temperature < 30) {
    const fire = gs.buildings.find(b => b.type === 'CAMPFIRE');
    if (fire) return { state: AgentState.MOVING, targetPosition: fire.position, currentActionLabel: 'Seeking warmth' };
  }

  if (agent.lifeStage === 'CHILD') {
    const playmate = gs.agents.find(a => a.id !== agent.id && dist(a.position, agent.position) < 12 && a.lifeStage === 'CHILD');
    if (playmate && Math.random() < 0.4 * p.extraversion) {
      return { state: AgentState.PLAYING, targetId: playmate.id, currentActionLabel: `Playing with ${playmate.name}` };
    }
    const angle = Math.random() * Math.PI * 2;
    const range = 5 + Math.random() * 8;
    return { state: AgentState.EXPLORING, targetPosition: { x: agent.position.x + Math.sin(angle) * range, y: 0, z: agent.position.z + Math.cos(angle) * range }, currentActionLabel: 'Playing' };
  }

  if (!agent.partnerId && agent.lifeStage === 'ADULT' && agent.needs.social > 50 && Math.random() < 0.15 * p.extraversion) {
    const prospect = gs.agents.find(a =>
      a.id !== agent.id && a.sex !== agent.sex && a.lifeStage === 'ADULT' && !a.partnerId &&
      (agent.relationships[a.id] || 0) >= 40 && dist(a.position, agent.position) < 18
    );
    if (prospect) {
      return { state: AgentState.MOVING, targetPosition: prospect.position, targetId: `COURT:${prospect.id}`, currentActionLabel: `Approaching ${prospect.name}` };
    }
  }

  type BehaviorChoice = { weight: number; fn: () => Partial<Agent> };
  const behaviors: BehaviorChoice[] = [];

  const wanderRange = 6 + p.openness * 22 + (p.neuroticism < 0.5 ? 6 : 0);
  behaviors.push({
    weight: 1.5 + p.openness * 3 + p.extraversion * 0.5,
    fn: () => {
      const angle = Math.random() * Math.PI * 2;
      const r = wanderRange * (0.5 + Math.random() * 0.8);
      return {
        state: AgentState.EXPLORING,
        targetPosition: { x: agent.position.x + Math.sin(angle) * r, y: 0, z: agent.position.z + Math.cos(angle) * r },
        currentActionLabel: p.openness > 0.6 ? 'Exploring' : 'Wandering'
      };
    }
  });

  const socialTarget = gs.agents.find(a =>
    a.id !== agent.id && dist(a.position, agent.position) < 20 &&
    a.lifeStage !== 'CHILD' && (agent.relationships[a.id] || 0) > -20
  );
  if (socialTarget) {
    behaviors.push({
      weight: 0.5 + p.extraversion * 3 + p.agreeableness * 1,
      fn: () => ({
        state: AgentState.MOVING,
        targetPosition: socialTarget.position,
        targetId: socialTarget.id,
        currentActionLabel: `Going to see ${socialTarget.name}`
      })
    });
  }

  const gatherTarget = gs.flora.filter(f => (f.resourceYield || f.isEdible) && (f.resourcesLeft || 0) > 0)
    .sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
  if (gatherTarget && dist(gatherTarget.position, agent.position) < 25) {
    behaviors.push({
      weight: 0.5 + p.conscientiousness * 2.5,
      fn: () => ({
        state: AgentState.MOVING,
        targetPosition: gatherTarget.position,
        targetId: gatherTarget.id,
        currentActionLabel: 'Gathering resources'
      })
    });
  }

  behaviors.push({
    weight: 0.3 + p.neuroticism * 1.5 + (1 - p.extraversion) * 0.8,
    fn: () => {
      const angle = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4;
      return {
        state: AgentState.EXPLORING,
        targetPosition: { x: agent.position.x + Math.sin(angle) * r, y: 0, z: agent.position.z + Math.cos(angle) * r },
        currentActionLabel: 'Looking around'
      };
    }
  });

  behaviors.push({
    weight: 0.2 + p.neuroticism * 0.8,
    fn: () => ({ state: AgentState.IDLE, currentActionLabel: 'Thinking' })
  });

  const totalWeight = behaviors.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * totalWeight;
  for (const b of behaviors) {
    r -= b.weight;
    if (r <= 0) return b.fn();
  }

  return {};
};
