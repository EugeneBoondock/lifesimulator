import { Agent, AgentState, GameState, Flora, Fauna, Building, Season, Weather, Discovery, WorldEvent, Era } from '../types';
import { TECHNOLOGIES, CRAFTING_RECIPES, BUILDING_RECIPES, SEASON_PROPERTIES, getTerrainHeight, ERA_ORDER, WORLD_SIZE, MAX_INVENTORY_SIZE } from '../constants';

const generateId = () => Math.random().toString(36).substr(2, 9);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

export const updateNeeds = (agent: Agent, gs: GameState): Agent => {
  const a = { ...agent, needs: { ...agent.needs }, neuro: { ...agent.neuro } };
  const isNight = gs.dayTime < 6 || gs.dayTime > 19;
  const seasonMod = SEASON_PROPERTIES[gs.season];
  const hasShield = gs.buildings.some(b =>
    (b.type === 'HUT' || b.type === 'STONE_HOUSE' || b.type === 'LEAN_TO') &&
    b.ownerId === a.id && dist(b.position, a.position) < 4
  );
  const nearFire = gs.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, a.position) < 5);

  a.needs.hunger = Math.max(0, a.needs.hunger - 0.03);
  a.needs.thirst = Math.max(0, a.needs.thirst - 0.04);

  if (a.state === AgentState.SLEEPING) {
    a.needs.energy = Math.min(100, a.needs.energy + 0.15);
  } else {
    const exertion = [AgentState.FLEEING, AgentState.FIGHTING, AgentState.HUNTING].includes(a.state) ? 0.06 : 0.02;
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
  a.needs.temperature = Math.max(0, Math.min(100, a.needs.temperature));

  if (a.needs.hunger < 15 || a.needs.thirst < 15) a.needs.health = Math.max(0, a.needs.health - 0.05);
  if (a.needs.temperature < 20) a.needs.health = Math.max(0, a.needs.health - 0.03);
  if (a.needs.hunger > 50 && a.needs.thirst > 50 && a.needs.temperature > 30) {
    a.needs.health = Math.min(100, a.needs.health + 0.01);
  }

  const nearbyFriends = gs.agents.filter(o => o.id !== a.id && dist(o.position, a.position) < 6);
  if (nearbyFriends.length > 0) {
    a.needs.social = Math.min(100, a.needs.social + 0.1 * a.personality.extraversion);
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
  if (oxytocin < 20 && serotonin < 35) f.add('lonely');
  if (agent.needs.energy < 25) f.add('exhausted');
  if (agent.needs.hunger < 25) f.add('starving');
  if (agent.needs.thirst < 25) f.add('parched');
  if (agent.needs.curiosity > 70) f.add('curious');

  const mood =
    (['panicked', 'stressed', 'starving', 'parched', 'exhausted'].find(x => f.has(x))) ||
    (['motivated', 'alert', 'curious', 'bonded'].find(x => f.has(x))) ||
    (['content', 'calm'].find(x => f.has(x))) ||
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

  if (agent.needs.safety < 30) {
    const threat = gs.fauna.find(f => f.isAggressive && dist(f.position, agent.position) < 10);
    if (threat) {
      return {
        state: AgentState.FLEEING,
        targetPosition: { x: agent.position.x + (agent.position.x - threat.position.x) * 2, y: 0, z: agent.position.z + (agent.position.z - threat.position.z) * 2 },
        currentActionLabel: 'Fleeing from danger!'
      };
    }
  }

  if (agent.needs.hunger < 30) {
    const food = gs.flora.filter(f => f.isEdible && !f.isPoisonous && (f.resourcesLeft || 0) > 0)
      .sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
    if (food) return { state: AgentState.MOVING, targetPosition: food.position, targetId: food.id, currentActionLabel: 'Searching for food' };
  }

  if (agent.needs.thirst < 30) {
    const water = gs.water.sort((a, b) => dist(a.position, agent.position) - dist(b.position, agent.position))[0];
    if (water) return { state: AgentState.MOVING, targetPosition: water.position, targetId: 'DRINK', currentActionLabel: 'Seeking water' };
  }

  if (agent.needs.energy < 25 || (isNight && agent.needs.energy < 60)) {
    return { state: AgentState.SLEEPING, currentActionLabel: 'Resting' };
  }

  if (agent.needs.temperature < 30) {
    const fire = gs.buildings.find(b => b.type === 'CAMPFIRE');
    if (fire) return { state: AgentState.MOVING, targetPosition: fire.position, currentActionLabel: 'Seeking warmth' };
  }

  if (Math.random() < 0.03) {
    const range = 5 + agent.personality.openness * 15;
    const angle = Math.random() * Math.PI * 2;
    return {
      state: AgentState.MOVING,
      targetPosition: { x: agent.position.x + Math.sin(angle) * range, y: 0, z: agent.position.z + Math.cos(angle) * range },
      currentActionLabel: 'Wandering'
    };
  }

  return {};
};
