
import { Agent, AgentState, GameState, Flora, Fauna, Building, Vector3, NeuroChemistry, ActionMemory, Personality } from "../types";
import { CRAFTING_RECIPES, CHAT_TEMPLATES, WORLD_SIZE, getTerrainHeight } from "../constants";

// Helper for distances
const dist = (a: Vector3, b: Vector3) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));

const getRandomTemplate = (category: keyof typeof CHAT_TEMPLATES) => {
  const templates = CHAT_TEMPLATES[category];
  return templates[Math.floor(Math.random() * templates.length)];
};

// --- 1. CHEMICAL SIMULATION (PERSONALITY AFFECTED) ---
const updateHormones = (agent: Agent, gameState: GameState): NeuroChemistry => {
  const neuro = { ...agent.neuro };
  const isNight = gameState.dayTime < 6 || gameState.dayTime > 19;
  const hasHouse = gameState.buildings.some(b => b.type === 'HOUSE' && b.ownerId === agent.id);
  const isWinter = gameState.season === 'WINTER';

  // PERSONALITY MODIFIERS
  const stressMultiplier = 1.0 + (agent.personality.neuroticism * 0.5); 
  const workStressMitigation = agent.personality.conscientiousness * 0.3;

  let stressFactors = 0;
  
  if (agent.needs.hunger < 30) stressFactors += 2;
  if ((agent.needs as any).thirst !== undefined && agent.needs.thirst < 40) stressFactors += 3;
  if (agent.needs.temperature < 40) stressFactors += 3;
  if (!hasHouse) { 
      const homelessStress = 5 + (agent.personality.conscientiousness * 5); 
      stressFactors += homelessStress; 
      if (isNight) stressFactors += 15; 
      if (isWinter) stressFactors += 10; 
  }
  if (agent.sickness && agent.sickness !== 'NONE') stressFactors += 5;
  
  // Only get stressed by predators if they are very close
  const predators = gameState.fauna.filter(f => f.isAggressive && dist(f.position, agent.position) < 8);
  if (predators.length > 0) stressFactors += 10;

  neuro.cortisol = Math.min(100, Math.max(0, neuro.cortisol + (stressFactors * stressMultiplier * 0.5) - 0.2));
  if (gameState.governance) {
    const cohesionEffect = (gameState.governance.cohesion - 50) * 0.01;
    neuro.cortisol = Math.max(0, neuro.cortisol - cohesionEffect);
  }
  
  const panicThreshold = 90 - (agent.personality.neuroticism * 20);
  if (neuro.cortisol > panicThreshold) neuro.adrenaline = Math.min(100, neuro.adrenaline + 5);
  else neuro.adrenaline = Math.max(0, neuro.adrenaline - 0.5);

  neuro.dopamine = Math.max(10, neuro.dopamine - 0.1);

  const nearCampfire = gameState.buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 6);

  const nearbyFriends = gameState.agents.filter(a => a.id !== agent.id && dist(a.position, agent.position) < 5);
  if (nearbyFriends.length > 0) {
      const socialGain = 0.5 + (agent.personality.extraversion * 0.5);
      neuro.oxytocin = Math.min(100, neuro.oxytocin + socialGain);
  } else {
      const socialDecay = 0.1 + (agent.personality.extraversion * 0.1);
      neuro.oxytocin = Math.max(0, neuro.oxytocin - socialDecay);
  }

  // Fires provide psychological safety even if not built by this agent
  if (nearCampfire) {
      neuro.cortisol = Math.max(0, neuro.cortisol - 1.5);
      neuro.adrenaline = Math.max(0, neuro.adrenaline - 0.8);
      neuro.dopamine = Math.min(100, neuro.dopamine + 0.3);
  }

  return neuro;
};

// --- 2. GOAL SOLVERS (GOAP) WITH PERSONALITY ---

const solveGoal_Safety = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const threatDistance = 8; 
  const threat = gameState.fauna.find(f => f.isAggressive && dist(f.position, agent.position) < threatDistance);
  const safeFire = gameState.buildings.find(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 6);
  
  if (threat && (dist(threat.position, agent.position) < 4 || neuro.cortisol > 75)) {
     // If near a fire and the threat isn't on top of it, stay by the flames instead of panicking
     if (safeFire && dist(threat.position, safeFire.position) > 5) {
        return {
          state: AgentState.IDLE,
          targetPosition: safeFire.position,
          currentActionLabel: "Staying by the fire",
          chatBubble: "The fire keeps me safe.",
          lastChatTime: gameState.time,
          neuro
        };
     }
     return {
        state: AgentState.FLEEING,
        targetPosition: { x: -agent.position.x + (Math.random()*10), y: 0, z: -agent.position.z + (Math.random()*10) },
        currentActionLabel: "Avoiding predator",
        chatBubble: getRandomTemplate('DANGER'),
        lastChatTime: gameState.time,
        neuro
     };
  }

  const tempThreshold = 20 + (agent.personality.conscientiousness * 20) + (gameState.season === 'WINTER' ? 20 : 0);
  
  if (agent.needs.temperature < tempThreshold) {
     const fire = gameState.buildings.find(b => b.type === 'CAMPFIRE');
     if (fire) return { state: AgentState.MOVING, targetPosition: fire.position, currentActionLabel: "Seeking warmth", neuro };
     if ((agent.inventory['WOOD'] || 0) >= 2) return { state: AgentState.WORKING, targetId: 'BUILD_CAMPFIRE', currentActionLabel: "Building fire", neuro };
     
     const trees = gameState.flora.filter(f => f.resourceYield === 'WOOD' && (f.resourcesLeft || 0) > 0);
     const tree = trees.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position))[0];
     if (tree) return { state: AgentState.MOVING, targetPosition: tree.position, targetId: tree.id, currentActionLabel: "Need wood for warmth", neuro };
  }
  return null;
};

const solveGoal_Sickness = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
   if (agent.sickness && agent.sickness !== 'NONE') {
      const restThreshold = agent.personality.conscientiousness > 0.5 ? 90 : 60;
      if (agent.needs.energy < restThreshold) {
          return { state: AgentState.SLEEPING, currentActionLabel: "Resting (Sick)", chatBubble: "I don't feel so good...", lastChatTime: gameState.time, neuro };
      }
   }
   return null;
};

const memoryScore = (agent: Agent, targetType: string, action: string) => {
  const records = (agent.actionMemories || []).filter(m => m.targetType === targetType && m.action === action);
  if (!records.length) return 0;
  const sum = records.reduce((acc, r) => acc + r.outcome * (r.confidence || 1), 0);
  const weight = records.reduce((acc, r) => acc + (r.confidence || 1), 0);
  return sum / weight;
};

const solveGoal_Hunger = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
   const hungerThreshold = 50 + (agent.personality.neuroticism * 20);

   // If already cooking, keep going
   if (agent.targetId === 'COOK_MEAT') return null;

   // Cook meat if hungry and have meat + fire nearby (or build one)
   if (agent.needs.hunger < hungerThreshold && (agent.inventory['MEAT'] || 0) > 0) {
      const fire = gameState.buildings.find(b => b.type === 'CAMPFIRE' && dist(b.position, agent.position) < 8);
      if (fire) return { state: AgentState.WORKING, targetId: 'COOK_MEAT', currentActionLabel: "Cooking meat", neuro };
      if ((agent.inventory['WOOD'] || 0) >= 2) {
         return { state: AgentState.WORKING, targetId: 'BUILD_CAMPFIRE', currentActionLabel: "Building fire to cook", neuro };
      }
   }

   // If already moving to food, don't change target constantly
   if (agent.state === AgentState.MOVING && agent.targetId && agent.targetId.startsWith('FOOD')) return null;

   if (agent.needs.hunger < hungerThreshold) {
      const foods = gameState.flora
        .filter(f => f.isEdible && (f.resourcesLeft||0) > 0 && dist(f.position, agent.position) < 60)
        .map(f => ({
          f,
          d: dist(agent.position, f.position),
          score: memoryScore(agent, f.type, 'EAT')
        }))
        .sort((a,b) => (b.score - a.score) || (a.d - b.d))[0];
      if (foods) {
        return { state: AgentState.MOVING, targetPosition: foods.f.position, targetId: foods.f.id, currentActionLabel: "Foraging", neuro };
      }
   }
   return null;
};

const solveGoal_Thirst = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const thirstThreshold = 50 - (agent.personality.conscientiousness * 20);
  if ((agent.needs as any).thirst !== undefined && agent.needs.thirst < thirstThreshold) {
    const puddles = (gameState.water || []).filter(w => w.kind === 'PUDDLE').map(w => ({ w, d: dist(agent.position, w.position) })).sort((a,b) => a.d - b.d);
    const rivers = (gameState.water || []).filter(w => w.kind === 'RIVER').map(w => ({ w, d: dist(agent.position, w.position) })).sort((a,b) => a.d - b.d);
    const nearby = puddles.concat(rivers)[0];
    if (nearby && nearby.d < 100) {
      return { state: AgentState.MOVING, targetPosition: nearby.w.position, targetId: 'WATER_SOURCE', currentActionLabel: nearby.w.kind === 'PUDDLE' ? "Drinking from puddle" : "Heading to water", neuro };
    }
    // No water found nearby: dig for a pit
    if (agent.needs.thirst < thirstThreshold - 10) {
      return { state: AgentState.WORKING, targetId: 'DIG_TERRAIN', currentActionLabel: "Digging for water", neuro };
    }
  }
  return null;
};

const solveGoal_Farming = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const seeds = agent.inventory['SEEDS'] || 0;
  const nearbyCrops = gameState.flora.filter(f => f.type === 'FARM_CROP' && dist(agent.position, f.position) < 20);
  const needFoodSoon = agent.needs.hunger < 70;

  // Water crops if nearby and not recently watered
  const dryCrop = nearbyCrops.find(c => (c as any).lastWateredTick === undefined || (gameState.time - (c as any).lastWateredTick) > 120);
  if (dryCrop) {
    return { state: AgentState.WORKING, targetId: 'WATER_CROP', currentActionLabel: "Watering crops", neuro };
  }

  // If hungry and a crop is nearby, harvest it
  if (needFoodSoon && nearbyCrops.length > 0) {
    const crop = nearbyCrops.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position))[0];
    return { state: AgentState.MOVING, targetPosition: crop.position, targetId: crop.id, currentActionLabel: "Harvesting crop", neuro };
  }

  // Plant seeds if we have them and not already on a planting task
  if (seeds > 0 && needFoodSoon && agent.targetId !== 'PLANT_SEEDS') {
    const plantX = agent.position.x + (Math.random() - 0.5) * 4;
    const plantZ = agent.position.z + (Math.random() - 0.5) * 4;
    const plantY = getTerrainHeight(plantX, plantZ);
    return { state: AgentState.WORKING, targetId: 'PLANT_SEEDS', targetPosition: { x: plantX, y: plantY, z: plantZ }, currentActionLabel: "Planting seeds", neuro };
  }

  // Forage for seeds if none
  if (seeds === 0 && agent.targetId !== 'FORAGE_SEEDS') {
    const forageX = agent.position.x + (Math.random() - 0.5) * 8;
    const forageZ = agent.position.z + (Math.random() - 0.5) * 8;
    return { state: AgentState.WORKING, targetId: 'FORAGE_SEEDS', targetPosition: { x: forageX, y: 0, z: forageZ }, currentActionLabel: "Foraging for seeds", neuro };
  }

  return null;
};

const solveGoal_BuildShelter = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const hasHouse = gameState.buildings.some(b => b.type === 'HOUSE' && b.ownerId === agent.id);
  if (hasHouse) return null;

  const isNight = gameState.dayTime < 6 || gameState.dayTime > 19;
  const badWeather = gameState.weather === 'RAIN' || gameState.weather === 'STORM' || gameState.weather === 'SNOW';
  const seasonalPressure = gameState.season === 'WINTER';
  const cold = agent.needs.temperature < 55;
  const shelterUrgent = badWeather || seasonalPressure || isNight || cold;

  // Keep existing house plan active
  if (agent.targetId === 'BUILD_HOUSE_SITE') return null;

  const wood = agent.inventory['WOOD'] || 0;
  const stone = agent.inventory['STONE'] || 0;
  const mud = agent.inventory['MUD'] || 0;

  // Quick warmth if exposed and we have wood
  if ((badWeather || cold || isNight) && wood >= 2) {
    return { state: AgentState.WORKING, targetId: 'BUILD_CAMPFIRE', currentActionLabel: "Building fire", neuro };
  }

  // Build house if we have all materials
  if (wood >= 4 && stone >= 2 && mud >= 2) {
    const range = 6 + agent.personality.openness * 25;
    const angle = Math.random() * Math.PI * 2;
    const buildX = agent.position.x + Math.sin(angle) * range;
    const buildZ = agent.position.z + Math.cos(angle) * range;
    const buildY = getTerrainHeight(buildX, buildZ);

    return {
      state: AgentState.MOVING,
      targetPosition: { x: buildX, y: buildY, z: buildZ },
      targetId: `BUILD_HOUSE_SITE:${agent.id}`,
      currentActionLabel: `Building my shelter`,
      neuro
    };
  }

  // Only gather materials if shelter is urgent OR we're close to having enough
  const totalMaterials = wood + stone + mud;
  const closeToReady = totalMaterials >= 6; // At least 75% of materials

  if (!shelterUrgent && !closeToReady) {
    return null; // Let other goals take priority
  }

  let needed = '';
  if (wood < 4) needed = 'WOOD';
  else if (stone < 2) needed = 'STONE';
  else needed = 'MUD';

  // If already gathering the right thing, don't switch targets
  if (agent.state === AgentState.MOVING && agent.targetId) {
    const currentTarget = gameState.flora.find(f => f.id === agent.targetId);
    if (currentTarget && currentTarget.resourceYield === needed) return null;
  }

  const resources = gameState.flora.filter(f => f.resourceYield === needed && (f.resourcesLeft || 0) > 0);

  if (agent.personality.conscientiousness > 0.4) {
    resources.sort((a, b) => dist(agent.position, a.position) - dist(agent.position, b.position));
  } else {
    resources.sort(() => Math.random() - 0.5);
  }

  const resource = resources[0];

  if (resource) {
    return {
      state: AgentState.MOVING,
      targetPosition: resource.position,
      targetId: resource.id,
      currentActionLabel: `Gathering ${needed}`,
      neuro
    };
  }

  return null;
};

const solveGoal_Social = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
    const socialThreshold = 50 - (agent.personality.extraversion * 30); 
    
    // If already socializing, don't interrupt
    if (agent.state === AgentState.SOCIALIZING) return null;

    if (agent.needs.social < socialThreshold || neuro.oxytocin > 60) {
        if (agent.personality.agreeableness > 0.6) {
            const animal = gameState.fauna.find(f => !f.isAggressive && !f.isTamed && dist(f.position, agent.position) < 10);
            if (animal) {
                if (dist(animal.position, agent.position) < 2) {
                    return { state: AgentState.WORKING, targetId: animal.id, currentActionLabel: "Taming animal", neuro };
                }
                return { state: AgentState.MOVING, targetPosition: animal.position, targetId: animal.id, currentActionLabel: "Approaching animal", neuro };
            }
        }

        let closestFriend = null;
        let minD = 999;
        gameState.agents.forEach(a => {
            if (a.id !== agent.id) {
                const d = dist(agent.position, a.position);
                if (d < minD) { minD = d; closestFriend = a; }
            }
        });

        if (closestFriend) {
            if (minD < 3) return { state: AgentState.SOCIALIZING, targetId: closestFriend.id, currentActionLabel: "Chatting", chatBubble: getRandomTemplate('GREETING'), lastChatTime: gameState.time, neuro };
            return { state: AgentState.MOVING, targetPosition: closestFriend.position, targetId: closestFriend.id, currentActionLabel: `Seeking ${closestFriend.name}`, neuro };
        }
    }
    return null;
};

const solveGoal_Hunt = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  // Necessity-driven: if hunger is low OR reserves are low
  const meatStock = agent.inventory['MEAT'] || 0;
  if (agent.needs.hunger > 65 && meatStock >= 4) return null;

  const hasWeapon = !!(agent.equippedTool || agent.inventory['SPEAR'] || agent.inventory['STONE_AXE'] || agent.inventory['STICK']);
  if (!hasWeapon) {
    const tree = gameState.flora
      .filter(f => f.resourceYield === 'WOOD' && (f.resourcesLeft || 0) > 0)
      .sort((a, b) => dist(agent.position, a.position) - dist(agent.position, b.position))[0];
    if (tree) {
      return { state: AgentState.MOVING, targetPosition: tree.position, targetId: tree.id, currentActionLabel: "Grabbing a stick", neuro };
    }
  }

  const prey = gameState.fauna
    .filter(f => !f.isAggressive)
    .map(f => ({ f, d: dist(agent.position, f.position) }))
    .sort((a, b) => a.d - b.d)[0];
  if (prey && prey.d < 70) {
    return { state: AgentState.MOVING, targetPosition: prey.f.position, targetId: prey.f.id, currentActionLabel: "Hunting prey", neuro };
  }
  return null;
};

const solveGoal_Tools = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const hasTool = agent.equippedTool || agent.inventory['SPEAR'] || agent.inventory['STONE_AXE'];
  if (!hasTool && (agent.needs.hunger < 70 || neuro.cortisol > 60)) {
    if ((agent.inventory['WOOD'] || 0) >= 1 && (agent.inventory['STONE'] || 0) >= 1) {
      return { state: AgentState.WORKING, targetId: 'CRAFT_SPEAR', currentActionLabel: "Crafting a spear", neuro };
    }
  }
  return null;
};

// --- MAIN BEHAVIOR UPDATE ---
export const updateAgentBehavior = (agent: Agent, gameState: GameState): Partial<Agent> => {
  const newNeuro = updateHormones(agent, gameState);

  if (agent.state === AgentState.FLEEING) {
      // Higher threshold to calm down easier
      const calmThreshold = 70; 
      if (newNeuro.cortisol < calmThreshold) return { state: AgentState.IDLE, neuro: newNeuro, currentActionLabel: "Calmed down" };
      return { neuro: newNeuro };
  }

  const sickAction = solveGoal_Sickness(agent, gameState, newNeuro);
  if (sickAction) return sickAction;

  // Shelter is priority one if no home or conditions are bad
  const shelterAction = solveGoal_BuildShelter(agent, gameState, newNeuro);
  if (shelterAction) return shelterAction;

  // Night behavior: gather at fire or sleep
  const isNight = gameState.dayTime < 6 || gameState.dayTime > 19;
  if (isNight) {
    const fire = gameState.buildings.find(b => b.type === 'CAMPFIRE');
    if (fire && dist(agent.position, fire.position) > 4) {
      return { state: AgentState.MOVING, targetPosition: fire.position, targetId: fire.id, currentActionLabel: "Gathering at fire", neuro: newNeuro };
    }
    return { state: AgentState.SLEEPING, currentActionLabel: "Sleeping by the fire", neuro: newNeuro };
  }

  const thirstAction = solveGoal_Thirst(agent, gameState, newNeuro);
  if (thirstAction) return thirstAction;

  const farmingAction = solveGoal_Farming(agent, gameState, newNeuro);
  if (farmingAction) return farmingAction;

  // Hunger Priority Increased (Above Safety)
  const hungerPriority = 55;
  if (agent.needs.health < 30 || agent.needs.hunger < hungerPriority) {
      const huntAction = solveGoal_Hunt(agent, gameState, newNeuro);
      if (huntAction) return huntAction;
      const hungerAction = solveGoal_Hunger(agent, gameState, newNeuro);
      if (hungerAction) return hungerAction;
  }

  const toolAction = solveGoal_Tools(agent, gameState, newNeuro);
  if (toolAction) return toolAction;

  // Rest when low energy: prefer shelter or fire
  if (agent.needs.energy < 50) {
    const house = gameState.buildings.find(b => b.type === 'HOUSE' && (b.ownerId === agent.id || true));
    const fire = gameState.buildings.find(b => b.type === 'CAMPFIRE');
    if (house) return { state: AgentState.MOVING, targetPosition: house.position, targetId: house.id, currentActionLabel: "Resting in shelter", neuro: newNeuro };
    if (fire) return { state: AgentState.MOVING, targetPosition: fire.position, targetId: fire.id, currentActionLabel: "Resting by the fire", neuro: newNeuro };
    return { state: AgentState.SLEEPING, currentActionLabel: "Resting", neuro: newNeuro };
  }

  // Safety next
  const safetyAction = solveGoal_Safety(agent, gameState, newNeuro);
  if (safetyAction) return safetyAction;

  const socialAction = solveGoal_Social(agent, gameState, newNeuro);
  if (socialAction) return socialAction;

  if (agent.state === AgentState.IDLE && Math.random() < 0.05) {
      const range = 5 + (agent.personality.openness * 20);
      const angle = Math.random() * Math.PI * 2;
      return { 
          state: AgentState.MOVING, 
          targetPosition: { x: agent.position.x + Math.sin(angle)*range, y: 0, z: agent.position.z + Math.cos(angle)*range },
          currentActionLabel: agent.personality.openness > 0.7 ? "Exploring the unknown" : "Wandering nearby",
          neuro: newNeuro
      };
  }

  return { neuro: newNeuro };
};

export const learnActionOutcome = (agent: Agent, targetType: string, action: string, outcomeScore: number): Agent => {
   const newAgent = { ...agent };
   const negMult = agent.personality.neuroticism > 0.7 ? 1.5 : 1.0;
   const posMult = agent.personality.openness > 0.7 ? 1.5 : 1.0;

   if (outcomeScore > 0) newAgent.neuro.dopamine += 5 * posMult;
   else newAgent.neuro.cortisol += 5 * negMult;
   return newAgent;
};
