import { Agent, AgentDecision, GameState } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434";
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:0.5b";

const getDist = (pos1: { x: number; z: number }, pos2: { x: number; z: number }) =>
  Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));

export const decideAgentAction = async (
  agent: Agent,
  gameState: GameState
): Promise<AgentDecision> => {
  const visibleRadius = 15;

  const nearbyFlora = gameState.flora
    .filter((f) => getDist(f.position, agent.position) < visibleRadius)
    .slice(0, 6)
    .map((f) => `${f.type}(${Math.round(getDist(f.position, agent.position))}m)`)
    .join(", ");

  const nearbyFauna = gameState.fauna
    .filter((f) => getDist(f.position, agent.position) < visibleRadius)
    .map((f) => `${f.type}${f.isAggressive ? "!" : ""}(${Math.round(getDist(f.position, agent.position))}m)`)
    .join(", ");

  const nearbyBuildings = gameState.buildings
    .filter((b) => getDist(b.position, agent.position) < visibleRadius)
    .map((b) => `${b.type}(${Math.round(getDist(b.position, agent.position))}m)`)
    .join(", ");

  // Compact prompt for small models
  const prompt = `You are ${agent.name}, an AI agent in a survival game.
Stats: Hunger=${Math.round(agent.needs.hunger)}/100, Energy=${Math.round(agent.needs.energy)}/100, Temp=${Math.round(agent.needs.temperature)}/100
Inventory: ${JSON.stringify(agent.inventory)}
Time: ${Math.floor(gameState.dayTime)}:00, Season: ${gameState.season}
Nearby: ${nearbyFlora || "nothing"} | Animals: ${nearbyFauna || "none"} | Buildings: ${nearbyBuildings || "none"}
Recipes: CAMPFIRE=2 WOOD, HOUSE=4 WOOD+2 STONE+2 MUD

Choose ONE action. Respond ONLY with valid JSON:
{"action":"MOVE|GATHER|CRAFT|SLEEP|FLEE|TALK|WAIT","target":"id or null","thought":"brief reason","say":"short dialogue or null"}`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        system: SYSTEM_INSTRUCTION,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 100,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.response?.trim() || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      action: parsed.action || "WAIT",
      targetId: parsed.target || undefined,
      thoughtProcess: parsed.thought || "Thinking...",
      dialogue: parsed.say || undefined,
    };
  } catch (error) {
    console.error("Ollama Decision Error:", error);
    return {
      action: "WAIT",
      thoughtProcess: "My mind wanders...",
    };
  }
};

// Check if Ollama is available
export const checkOllamaConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
};

// Pull model if not available
export const ensureModel = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const hasModel = data.models?.some((m: { name: string }) => m.name.startsWith(MODEL.split(":")[0]));

    if (!hasModel) {
      console.log(`Pulling model ${MODEL}...`);
      await fetch(`${OLLAMA_URL}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: MODEL }),
      });
    }
    return true;
  } catch {
    return false;
  }
};
