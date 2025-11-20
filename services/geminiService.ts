
import { GoogleGenAI, Type } from "@google/genai";
import { Agent, AgentDecision, GameState } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const decideAgentAction = async (
  agent: Agent,
  gameState: GameState
): Promise<AgentDecision> => {
  
  // Helper to check distance
  const getDist = (pos1: any, pos2: any) => Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));

  // Construct context with nearby entities
  const visibleRadius = 15;

  const nearbyAgents = gameState.agents
    .filter(a => a.id !== agent.id && getDist(a.position, agent.position) < visibleRadius)
    .map(a => `${a.name} (Dist: ${Math.round(getDist(a.position, agent.position))}m)`)
    .join(", ");

  // Flora Context with Knowledge Check
  const nearbyFlora = gameState.flora
    .filter(f => getDist(f.position, agent.position) < visibleRadius)
    .slice(0, 5) // Limit to 5 closest to save tokens
    .map(f => {
      const knowledge = gameState.knowledge[f.type];
      const name = knowledge ? knowledge.customName : `Unknown ${f.type}`;
      return `[ID: ${f.id}] ${name} (Dist: ${Math.round(getDist(f.position, agent.position))}m)`;
    })
    .join("\n    ");

  const context = `
    My Name: ${agent.name}
    My Bio: ${agent.personality.bio}
    My Needs: Hunger=${Math.round(agent.needs.hunger)}, Energy=${Math.round(agent.needs.energy)}, Social=${Math.round(agent.needs.social)}, Health=${Math.round(agent.needs.health)}
    My Position: ${Math.round(agent.position.x)}, ${Math.round(agent.position.z)}
    
    Nearby People: ${nearbyAgents || "None"}
    
    Nearby Nature:
    ${nearbyFlora || "Just dirt and grass."}

    Civilization Knowledge:
    ${Object.entries(gameState.knowledge).map(([key, val]) => `${key} is known as "${val.customName}"`).join(", ") || "Nothing discovered yet."}

    Recent Memories:
    ${agent.memories.slice(-5).map(m => `- ${m.description}`).join("\n    ")}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Based on my state and the world, what is my next move? \n\n CONTEXT: ${context}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["MOVE", "TALK", "WAIT", "WORK", "SLEEP", "BUILD", "INSPECT", "HARVEST"] },
            targetId: { type: Type.STRING, description: "ID of the Agent, Flora, or Fauna to interact with" },
            targetLocation: {
              type: Type.OBJECT,
              properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } }
            },
            thoughtProcess: { type: Type.STRING, description: "Internal monologue. If INSPECTING, explain why." },
            dialogue: { type: Type.STRING, description: "Spoken words if action is TALK" },
            namingProposal: { type: Type.STRING, description: "If INSPECTING an unknown object, invent a name for it here (e.g. 'Sun Berry')" }
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
