import { Agent, AgentState, GameState, AgentDecision } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434";
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:1.5b";

const getDist = (pos1: { x: number; z: number }, pos2: { x: number; z: number }) =>
  Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));

// Queue to prevent overwhelming Ollama
const decisionQueue: Map<string, Promise<AgentDecision>> = new Map();
const lastDecisionTime: Map<string, number> = new Map();
const AI_COOLDOWN_MS = 3000; // 3 seconds between AI decisions per agent
let ollamaAvailable = false;
let lastAIThought: { agent: string; thought: string; time: number } | null = null;

export const getAIStatus = () => ({ available: ollamaAvailable, model: MODEL, lastThought: lastAIThought });

export const checkOllama = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    ollamaAvailable = response.ok;
    return ollamaAvailable;
  } catch {
    ollamaAvailable = false;
    return false;
  }
};

export const getAIDecision = async (agent: Agent, gameState: GameState): Promise<AgentDecision | null> => {
  if (!ollamaAvailable) return null;

  // Rate limit: one decision per agent at a time + cooldown
  if (decisionQueue.has(agent.id)) {
    return null;
  }
  const lastTime = lastDecisionTime.get(agent.id) || 0;
  if (Date.now() - lastTime < AI_COOLDOWN_MS) {
    return null;
  }

  const visibleRadius = 15;

  const nearbyFlora = gameState.flora
    .filter((f) => getDist(f.position, agent.position) < visibleRadius && (f.resourcesLeft || 0) > 0)
    .slice(0, 5)
    .map((f) => `${f.type.replace('RESOURCE_', '').replace('TREE_', '')}[${f.id.slice(0,4)}](${Math.round(getDist(f.position, agent.position))}m)`)
    .join(", ");

  const nearbyFauna = gameState.fauna
    .filter((f) => getDist(f.position, agent.position) < visibleRadius)
    .slice(0, 3)
    .map((f) => `${f.type}${f.isAggressive ? "!" : ""}(${Math.round(getDist(f.position, agent.position))}m)`)
    .join(", ");

  const nearbyAgents = gameState.agents
    .filter((a) => a.id !== agent.id && getDist(a.position, agent.position) < visibleRadius)
    .slice(0, 3)
    .map((a) => {
      const rel = agent.relationships[a.id] || 0;
      const relLabel = rel > 30 ? "friend" : rel < -30 ? "dislike" : "neutral";
      return `${a.name}[${a.id.slice(0,4)}](${Math.round(getDist(a.position, agent.position))}m,${relLabel})`;
    })
    .join(", ");

  // Check if someone is talking to this agent
  const talkingToMe = gameState.agents.find(a =>
    a.id !== agent.id &&
    a.state === AgentState.SOCIALIZING &&
    a.targetId === agent.id &&
    a.chatBubble &&
    getDist(a.position, agent.position) < 4
  );
  const incomingMessage = talkingToMe ? `${talkingToMe.name} says: "${talkingToMe.chatBubble}"` : null;

  const hasHouse = gameState.buildings.some(b => b.type === 'HOUSE' && b.ownerId === agent.id);
  const nearCampfire = gameState.buildings.some(b => b.type === 'CAMPFIRE' && getDist(b.position, agent.position) < 5);

  // Rich identity-aware prompt
  const recentThoughts = (agent.aiThoughts || []).slice(-2).join("; ");
  const prompt = `You are ${agent.name}, a unique individual in a survival world.
Personality: ${agent.personality.bio}
Traits: ${agent.personality.extraversion > 0.6 ? "Social" : "Introverted"}, ${agent.personality.neuroticism > 0.5 ? "Anxious" : "Calm"}, ${agent.personality.conscientiousness > 0.6 ? "Hardworking" : "Relaxed"}

Your current state:
- Health:${Math.round(agent.needs.health)} Hunger:${Math.round(agent.needs.hunger)} Energy:${Math.round(agent.needs.energy)} Temperature:${Math.round(agent.needs.temperature)}
- Inventory: Wood=${agent.inventory.WOOD||0}, Stone=${agent.inventory.STONE||0}, Mud=${agent.inventory.MUD||0}
- ${gameState.dayTime < 6 || gameState.dayTime > 19 ? "It's NIGHT" : "Daytime"}, Season: ${gameState.season}
- ${hasHouse ? "You have a home" : "You are homeless"} ${nearCampfire ? "| Near warm fire" : ""}
${recentThoughts ? `Recent thoughts: ${recentThoughts}` : ""}

What you see nearby:
- Resources: ${nearbyFlora || "nothing useful"}
- Animals: ${nearbyFauna || "none"}
- People: ${nearbyAgents || "you are alone"}
${incomingMessage ? `\n⚠️ INCOMING: ${incomingMessage} - You should RESPOND or IGNORE based on your relationship and mood.` : ""}

Crafting: CAMPFIRE needs 2 Wood, HOUSE needs 4 Wood + 2 Stone + 2 Mud

As ${agent.name}, decide what to do next. Think about your personality and needs.
IMPORTANT: Avoid walking into trees. If someone talks to you, decide to RESPOND (friendly) or IGNORE (hurts relationship).
Respond with JSON only:
{"action":"GATHER|CRAFT|SLEEP|FLEE|SOCIAL|RESPOND|IGNORE|WANDER","target":"id_from_brackets","thought":"your inner monologue as ${agent.name}","say":"what you say out loud or null"}`;

  const decision = fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      system: "You are an AI agent in a survival sim. Be brief. Survive: eat, sleep, build shelter, stay warm. Respond ONLY with JSON.",
      stream: false,
      options: { temperature: 0.8, num_predict: 150 },
    }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Ollama error");
      const data = await res.json();
      const text = data.response?.trim() || "";
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("No JSON in: " + text.slice(0, 100));
      const parsed = JSON.parse(jsonMatch[0]);
      const decision = {
        action: parsed.action || "WANDER",
        targetId: parsed.target || undefined,
        thoughtProcess: parsed.thought || "...",
        dialogue: parsed.say || undefined,
      } as AgentDecision;
      console.log(`%c🧠 ${agent.name}: ${decision.action} - "${decision.thoughtProcess}"`, "color: #8b5cf6");
      lastAIThought = { agent: agent.name, thought: decision.thoughtProcess, time: Date.now() };
      lastDecisionTime.set(agent.id, Date.now());

      return decision;
    })
    .catch((e) => {
      console.warn("AI decision failed:", e.message);
      return null;
    })
    .finally(() => {
      decisionQueue.delete(agent.id);
    });

  decisionQueue.set(agent.id, decision as Promise<AgentDecision>);
  return decision;
};

// Convert AI decision to agent state update
export const applyAIDecision = (
  agent: Agent,
  decision: AgentDecision,
  gameState: GameState
): Partial<Agent> | null => {
  const update: Partial<Agent> = {};

  if (decision.dialogue) {
    update.chatBubble = decision.dialogue;
    update.lastChatTime = gameState.time;
  }
  update.currentActionLabel = decision.thoughtProcess;

  switch (decision.action) {
    case "GATHER": {
      const target = gameState.flora.find((f) => f.id.startsWith(decision.targetId?.slice(0, 4) || "XXX"));
      if (target) {
        update.state = AgentState.MOVING;
        update.targetPosition = target.position;
        update.targetId = target.id;
      }
      break;
    }
    case "CRAFT":
    case "BUILD": {
      update.state = AgentState.WORKING;
      if ((agent.inventory.WOOD || 0) >= 4 && (agent.inventory.STONE || 0) >= 2 && (agent.inventory.MUD || 0) >= 2) {
        update.targetId = "BUILD_HOUSE_SITE";
        update.targetPosition = {
          x: agent.position.x + (Math.random() - 0.5) * 10,
          y: 0,
          z: agent.position.z + (Math.random() - 0.5) * 10,
        };
        update.state = AgentState.MOVING;
      } else if ((agent.inventory.WOOD || 0) >= 2) {
        update.targetId = "BUILD_CAMPFIRE";
      }
      break;
    }
    case "SLEEP": {
      update.state = AgentState.SLEEPING;
      break;
    }
    case "FLEE": {
      update.state = AgentState.FLEEING;
      update.targetPosition = {
        x: agent.position.x + (Math.random() - 0.5) * 20,
        y: 0,
        z: agent.position.z + (Math.random() - 0.5) * 20,
      };
      break;
    }
    case "SOCIAL": {
      // Find target by ID prefix or nearest agent
      const target = decision.targetId
        ? gameState.agents.find((a) => a.id.startsWith(decision.targetId?.slice(0, 4) || "XXX"))
        : gameState.agents.find((a) => a.id !== agent.id);
      if (target) {
        update.state = AgentState.MOVING;
        update.targetPosition = target.position;
        update.targetId = target.id;
      }
      break;
    }
    case "RESPOND": {
      // Responding to someone talking - stay socializing, boost relationship
      const talker = gameState.agents.find(a =>
        a.state === AgentState.SOCIALIZING && a.targetId === agent.id
      );
      if (talker) {
        update.state = AgentState.SOCIALIZING;
        update.targetId = talker.id;
        // Relationship boost handled in App.tsx
        const newRel = { ...agent.relationships };
        newRel[talker.id] = (newRel[talker.id] || 0) + 5;
        update.relationships = newRel;
      }
      break;
    }
    case "IGNORE": {
      // Ignoring someone - relationship penalty
      const talker = gameState.agents.find(a =>
        a.state === AgentState.SOCIALIZING && a.targetId === agent.id
      );
      if (talker) {
        update.state = AgentState.IDLE;
        const newRel = { ...agent.relationships };
        newRel[talker.id] = (newRel[talker.id] || 0) - 10;
        update.relationships = newRel;
      }
      break;
    }
    case "WANDER":
    default: {
      update.state = AgentState.MOVING;
      update.targetPosition = {
        x: agent.position.x + (Math.random() - 0.5) * 15,
        y: 0,
        z: agent.position.z + (Math.random() - 0.5) * 15,
      };
      break;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
};

// Initialize on load and keep checking
checkOllama().then((available) => {
  console.log(`%c🧠 Ollama (${MODEL}): ${available ? "✓ Connected" : "✗ Not available"}`,
    available ? "color: green; font-weight: bold" : "color: red");
});

// Re-check every 10 seconds if not available
setInterval(() => {
  if (!ollamaAvailable) {
    checkOllama().then((available) => {
      if (available) console.log(`%c🧠 Ollama (${MODEL}): ✓ Connected`, "color: green; font-weight: bold");
    });
  }
}, 10000);
