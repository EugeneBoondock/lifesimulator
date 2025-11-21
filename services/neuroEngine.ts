
import { Agent, AgentState, GameState, Flora, Fauna, Building, Vector3, NeuroChemistry, ActionMemory, Personality } from "../types";
import { CRAFTING_RECIPES, CHAT_TEMPLATES, WORLD_SIZE } from "../constants";

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
  
  const panicThreshold = 90 - (agent.personality.neuroticism * 20);
  if (neuro.cortisol > panicThreshold) neuro.adrenaline = Math.min(100, neuro.adrenaline + 5);
  else neuro.adrenaline = Math.max(0, neuro.adrenaline - 0.5);

  neuro.dopamine = Math.max(10, neuro.dopamine - 0.1);

  const nearbyFriends = gameState.agents.filter(a => a.id !== agent.id && dist(a.position, agent.position) < 5);
  if (nearbyFriends.length > 0) {
      const socialGain = 0.5 + (agent.personality.extraversion * 0.5);
      neuro.oxytocin = Math.min(100, neuro.oxytocin + socialGain);
  } else {
      const socialDecay = 0.1 + (agent.personality.extraversion * 0.1);
      neuro.oxytocin = Math.max(0, neuro.oxytocin - socialDecay);
  }

  return neuro;
};

// --- 2. GOAL SOLVERS (GOAP) WITH PERSONALITY ---

const solveGoal_Safety = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
  const threatDistance = 8; 
  const threat = gameState.fauna.find(f => f.isAggressive && dist(f.position, agent.position) < threatDistance);
  
  if (threat && (dist(threat.position, agent.position) < 4 || neuro.cortisol > 75)) {
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

const solveGoal_Hunger = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
   const hungerThreshold = 50 + (agent.personality.neuroticism * 20);
   // If already moving to food, don't change target constantly
   if (agent.state === AgentState.MOVING && agent.targetId && agent.targetId.startsWith('FOOD')) return null;

   if (agent.needs.hunger < hungerThreshold) {
      const foods = gameState.flora.filter(f => f.isEdible && (f.resourcesLeft||0) > 0 && dist(f.position, agent.position) < 50);
      const food = foods.sort((a,b) => dist(agent.position, a.position) - dist(agent.position, b.position))[0];
      if (food) return { state: AgentState.MOVING, targetPosition: food.position, targetId: food.id, currentActionLabel: "Foraging", neuro };
   }
   return null;
};

const solveGoal_BuildShelter = (agent: Agent, gameState: GameState, neuro: NeuroChemistry): Partial<Agent> | null => {
   const hasHouse = gameState.buildings.some(b => b.type === 'HOUSE' && b.ownerId === agent.id);
   if (hasHouse) return null;

   // Persist existing build plan
   if (agent.targetId === 'BUILD_HOUSE_SITE') return null;

   // More agents will try to build now, unless totally careless
   if (agent.personality.conscientiousness < 0.2 && neuro.cortisol < 80 && agent.needs.temperature > 30) {
       return null; 
   }

   const wood = agent.inventory['WOOD'] || 0;
   const stone = agent.inventory['STONE'] || 0;
   const mud = agent.inventory['MUD'] || 0;

   if (wood >= 4 && stone >= 2 && mud >= 2) {
       const range = agent.personality.openness * 40; 
       const angle = Math.random() * Math.PI * 2;
       const buildX = agent.position.x + Math.sin(angle) * (range + 5); 
       const buildZ = agent.position.z + Math.cos(angle) * (range + 5);
       
       return { state: AgentState.MOVING, targetPosition: {x: buildX, y:0, z: buildZ}, targetId: 'BUILD_HOUSE_SITE', currentActionLabel: "Found a spot for my house", neuro };
   }

   let needed = '';
   if (wood < 4) needed = 'WOOD';
   else if (stone < 2) needed = 'STONE';
   else if (mud < 2) needed = 'MUD';
   
   // If already gathering the right thing, don't switch targets
   if (agent.state === AgentState.MOVING && agent.targetId) {
       const currentTarget = gameState.flora.find(f => f.id === agent.targetId);
       if (currentTarget && currentTarget.resourceYield === needed) return null; 
   }

   const resources = gameState.flora.filter(f => f.resourceYield === needed && (f.resourcesLeft || 0) > 0);
   
   if (agent.personality.conscientiousness > 0.5) {
       resources.sort((a, b) => dist(agent.position, a.position) - dist(agent.position, b.position));
   } else {
       resources.sort(() => Math.random() - 0.5);
   }
   
   const resource = resources[0];

   if (resource) return { state: AgentState.MOVING, targetPosition: resource.position, targetId: resource.id, currentActionLabel: `Gathering ${needed}`, neuro };
   
   // Search if nothing found
   return { 
       state: AgentState.MOVING, 
       targetPosition: { x: (Math.random()-0.5)*WORLD_SIZE, y: 0, z: (Math.random()-0.5)*WORLD_SIZE }, 
       currentActionLabel: `Searching for ${needed}...`, 
       neuro 
   };
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

  // Hunger Priority Increased (Above Safety)
  const hungerPriority = 40;
  if (agent.needs.health < 30 || agent.needs.hunger < hungerPriority) {
      const hungerAction = solveGoal_Hunger(agent, gameState, newNeuro);
      if (hungerAction) return hungerAction;
  }

  // Safety (Moved Down)
  const safetyAction = solveGoal_Safety(agent, gameState, newNeuro);
  if (safetyAction) return safetyAction;

  const shelterAction = solveGoal_BuildShelter(agent, gameState, newNeuro);
  if (shelterAction) return shelterAction;

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
