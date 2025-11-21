import { Agent } from "../types";

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434";
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:1.5b";

const addFeeling = (feelings: Set<string>, condition: boolean, label: string) => {
  if (condition) feelings.add(label);
};

export const deriveFeelings = (agent: Agent): { feelings: string[]; mood: string } => {
  const { dopamine, serotonin, adrenaline, oxytocin, cortisol } = agent.neuro;
  const feelings = new Set<string>();

  addFeeling(feelings, dopamine > 70, "motivated");
  addFeeling(feelings, dopamine < 30, "apathetic");
  addFeeling(feelings, serotonin > 70, "content");
  addFeeling(feelings, serotonin < 35, "irritable");
  addFeeling(feelings, cortisol > 70, "stressed");
  addFeeling(feelings, cortisol > 85, "panicked");
  addFeeling(feelings, adrenaline > 70, "alert");
  addFeeling(feelings, adrenaline < 25 && cortisol < 40, "relaxed");
  addFeeling(feelings, oxytocin > 65, "bonded");
  addFeeling(feelings, oxytocin < 25 && serotonin < 40, "lonely");

  // Energy and hunger/thirst context push feelings
  addFeeling(feelings, agent.needs.energy < 30, "exhausted");
  addFeeling(feelings, agent.needs.hunger < 30, "hungry");
  addFeeling(feelings, (agent.needs as any).thirst !== undefined && agent.needs.thirst < 30, "thirsty");

  const orderedFeeling = (priority: string[]): string | undefined =>
    priority.find(p => feelings.has(p));

  const mood =
    orderedFeeling(["panicked", "stressed", "hungry", "thirsty", "exhausted"]) ||
    orderedFeeling(["motivated", "alert", "bonded"]) ||
    orderedFeeling(["content", "relaxed"]) ||
    orderedFeeling(["irritable", "apathetic", "lonely"]) ||
    "neutral";

  return { feelings: Array.from(feelings), mood };
};

const lastSubconsciousRun: Map<string, number> = new Map();
const SUBCONSCIOUS_COOLDOWN_MS = 4000;

export const deriveFeelingsAI = async (agent: Agent): Promise<{ feelings: string[]; mood: string } | null> => {
  const now = Date.now();
  const last = lastSubconsciousRun.get(agent.id) || 0;
  if (now - last < SUBCONSCIOUS_COOLDOWN_MS) return null;
  lastSubconsciousRun.set(agent.id, now);

  const prompt = `You are the subconscious for ${agent.name}. Interpret their body chemistry into feelings and a single mood.
Chemistry:
- dopamine:${agent.neuro.dopamine.toFixed(0)}
- serotonin:${agent.neuro.serotonin.toFixed(0)}
- adrenaline:${agent.neuro.adrenaline.toFixed(0)}
- oxytocin:${agent.neuro.oxytocin.toFixed(0)}
- cortisol:${agent.neuro.cortisol.toFixed(0)}
Needs:
- hunger:${agent.needs.hunger.toFixed(0)}
- thirst:${(agent.needs as any).thirst !== undefined ? (agent.needs as any).thirst.toFixed(0) : "n/a"}
- energy:${agent.needs.energy.toFixed(0)}
- temperature:${agent.needs.temperature.toFixed(0)}

Return compact JSON: {"feelings":["label","label2"],"mood":"one_or_two_words"}`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 60 }
      })
    });
    if (!res.ok) throw new Error(`ollama feelings error ${res.status}`);
    const data = await res.json();
    const text = data.response?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("no feelings JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const feelings: string[] = Array.isArray(parsed.feelings) ? parsed.feelings.map((f: any) => String(f)) : [];
    const mood: string = parsed.mood ? String(parsed.mood) : "neutral";
    return { feelings, mood };
  } catch (err) {
    console.warn("Subconscious AI failed; fallback to deterministic", err);
    return deriveFeelings(agent);
  }
};
