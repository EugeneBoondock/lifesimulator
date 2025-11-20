import { GoogleGenAI, Type } from "@google/genai";
import { Agent, AgentDecision, GameState } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize client
// Note: process.env.API_KEY is injected by the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// We use a cached client or recreate if needed, but standard usage is fine.
// For this simulation, we will call this per agent per decision tick.

export const decideAgentAction = async (
  agent: Agent,
  gameState: GameState
): Promise<AgentDecision> => {
  
  // Construct context
  const nearbyAgents = gameState.agents
    .filter(a => a.id !== agent.id)
    .map(a => `${a.name} (at ${Math.round(a.position.x)},${Math.round(a.position.z)})`)
    .join(", ");

  const context = `
    My Name: ${agent.name}
    My Bio: ${agent.personality.bio}
    My Current State: ${agent.state}
    My Needs: Hunger=${agent.needs.hunger}, Energy=${agent.needs.energy}, Social=${agent.needs.social}
    My Position: ${Math.round(agent.position.x)}, ${Math.round(agent.position.z)}
    Nearby Agents: ${nearbyAgents || "None"}
    Recent Memories: ${agent.memories.slice(-3).map(m => m.description).join("; ")}
    Current Time: Tick ${gameState.time}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on my state and personality, what should I do next? \n\n CONTEXT: ${context}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["MOVE", "TALK", "WAIT", "WORK", "SLEEP"] },
            targetAgentId: { type: Type.STRING, description: "Name of agent to talk to if action is TALK" },
            targetLocation: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                z: { type: Type.NUMBER }
              }
            },
            thoughtProcess: { type: Type.STRING, description: "Internal monologue explaining why" },
            dialogue: { type: Type.STRING, description: "Spoken words if action is TALK" }
          },
          required: ["action", "thoughtProcess"]
        }
      }
    });

    if (!response.text) throw new Error("No response text");
    return JSON.parse(response.text) as AgentDecision;

  } catch (error) {
    console.error("AI Decision Error:", error);
    // Fallback action
    return {
      action: "WAIT",
      thoughtProcess: "My brain feels foggy... (AI Error)",
    };
  }
};
