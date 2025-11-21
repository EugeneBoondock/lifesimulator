
import { GoogleGenAI, Type } from "@google/genai";
import { Agent, AgentDecision, GameState } from "../types";
import { SYSTEM_INSTRUCTION, CRAFTING_RECIPES } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const decideAgentAction = async (
  agent: Agent,
  gameState: GameState
): Promise<AgentDecision> => {
  
  const getDist = (pos1: any, pos2: any) => Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));
  const visibleRadius = 15;

  // Nearby Flora (Resources)
  const nearbyFlora = gameState.flora
    .filter(f => getDist(f.position, agent.position) < visibleRadius)
    .slice(0, 6)
    .map(f => `[ID: ${f.id}] ${f.type} (Dist: ${Math.round(getDist(f.position, agent.position))}m)`)
    .join("\n    ");
    
  // Nearby Fauna (Dangers/Food)
  const nearbyFauna = gameState.fauna
    .filter(f => getDist(f.position, agent.position) < visibleRadius)
    .map(f => `[ID: ${f.id}] ${f.type} ${f.isAggressive ? '(DANGER)' : ''} ${f.isTamed ? '(TAMED)' : ''} (Dist: ${Math.round(getDist(f.position, agent.position))}m)`)
    .join("\n    ");

  const nearbyBuildings = gameState.buildings
    .filter(b => getDist(b.position, agent.position) < visibleRadius)
    .map(b => `${b.type} (Dist: ${Math.round(getDist(b.position, agent.position))}m)`)
    .join(", ");

  const context = `
    My Name: ${agent.name}
    My Condition: Hunger=${Math.round(agent.needs.hunger)}, Energy=${Math.round(agent.needs.energy)}, Temp=${Math.round(agent.needs.temperature)} (Freezing < 30)
    My Inventory: ${JSON.stringify(agent.inventory)}
    
    Environment:
    Time: ${Math.floor(gameState.dayTime)}:00
    Nearby Resources:
    ${nearbyFlora || "Nothing useful nearby."}
    Nearby Animals:
    ${nearbyFauna || "No animals."}
    Nearby Buildings:
    ${nearbyBuildings || "No shelter."}

    RECIPES:
    - CAMPFIRE: 2 WOOD
    - HOUSE: 4 WOOD, 2 STONE, 2 MUD
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on my needs and inventory, what is my next move? \n\n CONTEXT: ${context}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["MOVE", "TALK", "WAIT", "SLEEP", "CRAFT", "INSPECT", "GATHER", "TAME", "ATTACK", "FLEE"] },
            targetId: { type: Type.STRING, description: "ID of target" },
            targetLocation: {
              type: Type.OBJECT,
              properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } }
            },
            craftingRecipe: { type: Type.STRING, enum: ["HOUSE", "CAMPFIRE"] },
            thoughtProcess: { type: Type.STRING },
            dialogue: { type: Type.STRING }
          },
          required: ["action", "thoughtProcess"]
        }
      }
    });

    if (!response.text) throw new Error("No response text");
    return JSON.parse(response.text) as AgentDecision;

  } catch (error) {
    console.error("AI Decision Error:", error);
    return {
      action: "WAIT",
      thoughtProcess: "My mind is foggy...",
    };
  }
};
