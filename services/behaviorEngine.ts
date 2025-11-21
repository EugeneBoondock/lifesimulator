
import { Agent, AgentState, GameState, Flora, Fauna, Building, Vector3 } from "../types";
import { CRAFTING_RECIPES, CHAT_TEMPLATES, WORLD_SIZE } from "../constants";
import { audioManager } from "./audioService";

// Helper for distances
const dist = (a: Vector3, b: Vector3) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));

const getRandomTemplate = (category: keyof typeof CHAT_TEMPLATES) => {
  const templates = CHAT_TEMPLATES[category];
  return templates[Math.floor(Math.random() * templates.length)];
};

// THE UTILITY AI ENGINE
// Calculates scores for actions and executes the best one
export const updateAgentBehavior = (agent: Agent, gameState: GameState): Partial<Agent> => {
  // 1. Safety Checks (Override all logic if in danger)
  const isNight = gameState.dayTime < 6 || gameState.dayTime > 19;
  const predators = gameState.fauna.filter(f => f.isAggressive && dist(f.position, agent.position) < 10);
  
  // FLEE LOGIC
  if (predators.length > 0 && agent.state !== AgentState.FLEEING) {
    return {
      state: AgentState.FLEEING,
      targetPosition: { x: -agent.position.x, y: 0, z: -agent.position.z }, // Run to center-ish/opposite
      currentActionLabel: `Fleeing from ${predators[0].type}!`,
      chatBubble: "Run away!!",
      lastChatTime: gameState.time
    };
  }

  // 2. Utility Scoring
  const scores = {
    EAT: (100 - agent.needs.hunger) * 1.5,
    SLEEP: (100 - agent.needs.energy) * 2 + (isNight ? 50 : 0),
    WARMTH: (100 - agent.needs.temperature) * 2,
    SOCIAL: (100 - agent.needs.social),
    WORK: 30 + (agent.personality.conscientiousness * 20) // Base work drive
  };

  // 3. State Machine Transition
  
  // If already doing something important, continue unless complete
  if (agent.state === AgentState.SLEEPING) {
    if (agent.needs.energy >= 95 && !isNight) {
       return { state: AgentState.IDLE, currentActionLabel: "Waking up", chatBubble: "Good morning." };
    }
    return {}; // Continue sleeping
  }
  
  if (agent.state === AgentState.MOVING && agent.targetPosition) {
    // If moving, keep moving unless target reached (handled in physics loop)
    return {}; 
  }

  // DECISION TREE
  
  // Critical: FREEZING
  if (scores.WARMTH > 80 && isNight) {
    // Find Campfire or House
    const shelter = gameState.buildings.find(b => dist(b.position, agent.position) < 40);
    if (shelter) {
       return {
          state: AgentState.MOVING,
          targetPosition: shelter.position,
          currentActionLabel: "Seeking warmth",
          targetId: shelter.id
       };
    } else {
       // Try to build fire if has wood
       if ((agent.inventory['WOOD'] || 0) >= 2) {
          return {
             state: AgentState.WORKING,
             currentActionLabel: "Building emergency fire",
             targetId: "BUILD_CAMPFIRE"
          };
       }
    }
  }

  // Critical: HUNGER
  if (scores.EAT > 80) {
     // Find food
     const berry = gameState.flora.find(f => f.type === 'BUSH_BERRY' && dist(f.position, agent.position) < 20);
     if (berry) {
        return {
           state: AgentState.MOVING,
           targetPosition: berry.position,
           targetId: berry.id,
           currentActionLabel: "Going to eat berries"
        };
     }
  }

  // Critical: SLEEP
  if (scores.SLEEP > 80) {
     return {
        state: AgentState.SLEEPING,
        currentActionLabel: "Sleeping",
        chatBubble: getRandomTemplate('TIRED'),
        lastChatTime: gameState.time
     };
  }

  // Socialize
  if (scores.SOCIAL > 60) {
     const friend = gameState.agents.find(a => a.id !== agent.id && dist(a.position, agent.position) < 15);
     if (friend) {
        if (dist(friend.position, agent.position) < 3) {
           return {
              state: AgentState.SOCIALIZING,
              targetId: friend.id,
              currentActionLabel: `Talking to ${friend.name}`,
              chatBubble: getRandomTemplate(Math.random() > 0.5 ? 'GREETING' : 'FRIENDLY'),
              lastChatTime: gameState.time
           };
        } else {
           return {
              state: AgentState.MOVING,
              targetPosition: friend.position,
              targetId: friend.id,
              currentActionLabel: "Going to talk"
           };
        }
     }
  }

  // Default: Work / Gather / Build
  if (Math.random() < 0.05) { // Don't switch tasks too fast
      // Gather Resources
      const resource = gameState.flora.find(f => (f.resourceYield) && dist(f.position, agent.position) < 20);
      if (resource) {
         return {
            state: AgentState.MOVING,
            targetPosition: resource.position,
            targetId: resource.id,
            currentActionLabel: "Gathering resources"
         };
      }
  }

  // Idle Fallback
  if (agent.state === AgentState.IDLE && Math.random() < 0.02) {
     // Random wander
     const angle = Math.random() * Math.PI * 2;
     const dist = 5 + Math.random() * 5;
     return {
        state: AgentState.MOVING,
        targetPosition: {
           x: Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, agent.position.x + Math.sin(angle) * dist)),
           y: 0,
           z: Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, agent.position.z + Math.cos(angle) * dist))
        },
        currentActionLabel: "Wandering"
     };
  }

  return {};
};
