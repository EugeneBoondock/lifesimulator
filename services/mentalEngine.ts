import { Agent, AgentState, GameState, MentalEvent } from '../types';

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

export function processMentalHealth(agent: Agent, gs: GameState): Partial<Agent> {
  const existingEvents: MentalEvent[] = agent.mentalEvents ?? [];
  const now = gs.time;

  const recentEvents = existingEvents.filter(e => now - e.tick < 500);
  let mentalHealth = agent.mentalHealth ?? 50;

  if (agent.neuro.serotonin > 60) mentalHealth = Math.min(100, mentalHealth + 0.08);
  if (agent.neuro.oxytocin  > 60) mentalHealth = Math.min(100, mentalHealth + 0.06);
  if (agent.neuro.dopamine  > 70) mentalHealth = Math.min(100, mentalHealth + 0.04);
  if (agent.needs.social    > 65) mentalHealth = Math.min(100, mentalHealth + 0.04);

  if (agent.neuro.cortisol  > 70) mentalHealth = Math.max(0, mentalHealth - 0.12);
  if (agent.needs.social    < 20) mentalHealth = Math.max(0, mentalHealth - 0.08);
  if (agent.sickness !== 'NONE')   mentalHealth = Math.max(0, mentalHealth - 0.04);
  if (agent.personality.neuroticism > 0.7) mentalHealth = Math.max(0, mentalHealth - 0.02);

  for (const event of recentEvents) {
    const age   = now - event.tick;
    const decay = Math.max(0, 1 - age / 500);
    if (event.type === 'TRAUMA' || event.type === 'LOSS') {
      mentalHealth = Math.max(0, mentalHealth - event.intensity * 0.008 * decay);
    } else if (event.type === 'JOY' || event.type === 'DISCOVERY' || event.type === 'INSIGHT') {
      mentalHealth = Math.min(100, mentalHealth + event.intensity * 0.004 * decay);
    } else if (event.type === 'LONELINESS') {
      mentalHealth = Math.max(0, mentalHealth - event.intensity * 0.006 * decay);
    }
  }

  const neuro = { ...agent.neuro };
  if (mentalHealth < 30) {
    neuro.cortisol  = Math.min(100, neuro.cortisol + 0.18);
    neuro.serotonin = Math.max(0, neuro.serotonin - 0.08);
  } else if (mentalHealth > 75) {
    neuro.serotonin = Math.min(100, neuro.serotonin + 0.04);
    neuro.cortisol  = Math.max(0, neuro.cortisol - 0.04);
  }

  const newEvents = [...recentEvents];

  const nearbyAgents = gs.agents.filter(a => a.id !== agent.id && dist2(a.position, agent.position) < 15);
  if (nearbyAgents.length === 0 && agent.needs.social < 35 && Math.random() < 0.02) {
    newEvents.push({
      type: 'LONELINESS', intensity: (35 - agent.needs.social) / 35 * 6,
      description: 'Alone and isolated', tick: now,
    });
  }

  if (agent.state === AgentState.CELEBRATING && Math.random() < 0.1) {
    newEvents.push({ type: 'JOY', intensity: 5, description: 'Celebrated with the tribe', tick: now });
  }
  if (agent.state === AgentState.MOURNING && Math.random() < 0.1) {
    newEvents.push({ type: 'LOSS', intensity: 4, description: 'Mourning a loss', tick: now });
  }

  return { mentalHealth, mentalEvents: newEvents.slice(-25), neuro } as Partial<Agent>;
}

export function processSleepInsight(agent: Agent): Partial<Agent> {
  if (agent.state !== AgentState.SLEEPING) return {};
  const updates: Partial<Agent> = {};

  const mentalHealth = Math.min(100, (agent.mentalHealth ?? 50) + 0.25);
  (updates as any).mentalHealth = mentalHealth;

  if (Math.random() < 0.025) {
    const skills = Object.keys(agent.skillLevels);
    if (skills.length > 0) {
      const skill = skills[Math.floor(Math.random() * skills.length)];
      updates.skillLevels = {
        ...agent.skillLevels,
        [skill]: Math.min(1, agent.skillLevels[skill] + 0.004),
      };
    }
  }

  if (Math.random() < 0.003 && agent.personality.openness > 0.55) {
    const dreamNeuro = { ...agent.neuro };
    dreamNeuro.dopamine  = Math.min(100, dreamNeuro.dopamine + 12);
    dreamNeuro.serotonin = Math.min(100, dreamNeuro.serotonin + 8);
    updates.neuro = dreamNeuro;
    updates.chatBubble = '💭 Dreaming of discoveries...';

    const mentalEvents = [...(agent.mentalEvents ?? [])];
    mentalEvents.push({ type: 'INSIGHT', intensity: 4, description: 'Vivid dream insight', tick: Date.now() });
    updates.mentalEvents = mentalEvents.slice(-25);
  }

  return updates;
}

export function recordMentalEvent(
  agent: Agent, eventType: MentalEvent['type'], intensity: number, description: string, tick: number
): Partial<Agent> {
  const existing = agent.mentalEvents ?? [];
  return {
    mentalEvents: [...existing.slice(-24), { type: eventType, intensity, description, tick }],
  } as Partial<Agent>;
}
