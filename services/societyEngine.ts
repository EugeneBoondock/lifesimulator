import { Agent, Building, GameState, Settlement } from '../types';

export type GovernanceType = 'TRIBAL' | 'CHIEFTAIN' | 'COUNCIL';

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

export function determineGovernance(agents: Agent[], settlement: Settlement): GovernanceType {
  const members = agents.filter(a => settlement.members.includes(a.id));
  if (members.length < 3) return 'TRIBAL';
  const hasCouncil = members.filter(a => a.socialRole === 'ELDER_ROLE').length >= 2;
  if (hasCouncil) return 'COUNCIL';
  const hasLeader = members.some(a => a.socialRole === 'LEADER');
  if (hasLeader) return 'CHIEFTAIN';
  return 'TRIBAL';
}

export function processCollectiveResources(
  agents: Agent[], buildings: Building[], gs: GameState
): { agents: Agent[]; buildings: Building[]; logs: string[] } {
  const logs: string[] = [];
  const updatedAgents = agents.map(a => ({ ...a, inventory: { ...a.inventory } }));
  const updatedBuildings = buildings.map(b => ({ ...b, inventory: { ...(b.inventory ?? {}) } }));

  const granary = updatedBuildings.find(b => b.type === 'GRANARY');
  const storagePit = updatedBuildings.find(b => b.type === 'STORAGE_PIT');
  const collective = granary ?? storagePit;
  if (!collective) return { agents: updatedAgents, buildings: updatedBuildings, logs };

  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (dist2(agent.position, collective.position) > 7) continue;

    const foodItems = ['COOKED_MEAT', 'BERRY', 'SEEDS'];
    for (const food of foodItems) {
      const qty = agent.inventory[food] ?? 0;
      if (qty > 3) {
        const deposit = 1;
        updatedAgents[i].inventory[food] = qty - deposit;
        if (updatedAgents[i].inventory[food] <= 0) delete updatedAgents[i].inventory[food];
        collective.inventory![food] = (collective.inventory![food] ?? 0) + deposit;
        updatedAgents[i].neuro = {
          ...updatedAgents[i].neuro,
          oxytocin: Math.min(100, updatedAgents[i].neuro.oxytocin + 1.5),
        };
        break;
      }
    }
  }

  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (agent.needs.hunger > 55) continue;
    if (dist2(agent.position, collective.position) > 7) continue;

    const foodItems = ['COOKED_MEAT', 'BERRY', 'SEEDS'];
    for (const food of foodItems) {
      const stored = collective.inventory![food] ?? 0;
      if (stored > 0) {
        collective.inventory![food] = stored - 1;
        const nutrition = food === 'COOKED_MEAT' ? 30 : 12;
        updatedAgents[i].needs = {
          ...updatedAgents[i].needs,
          hunger: Math.min(100, updatedAgents[i].needs.hunger + nutrition),
        };
        updatedAgents[i].neuro = {
          ...updatedAgents[i].neuro,
          oxytocin: Math.min(100, updatedAgents[i].neuro.oxytocin + 3),
        };
        logs.push(`${agent.name} ate from collective ${collective.type}`);
        break;
      }
    }
  }

  return { agents: updatedAgents, buildings: updatedBuildings, logs };
}

export function applyGovernanceEffects(agents: Agent[], gs: GameState): Agent[] {
  if (gs.settlements.length === 0) return agents;
  const settlement = gs.settlements[0];
  const governance = determineGovernance(agents, settlement);
  const memberSet = new Set(settlement.members);

  return agents.map(agent => {
    if (!memberSet.has(agent.id)) return agent;
    const neuro = { ...agent.neuro };

    if (governance === 'TRIBAL') {
      neuro.oxytocin = Math.min(100, neuro.oxytocin + 0.04);
    } else if (governance === 'CHIEFTAIN') {
      if (agent.socialRole === 'LEADER') {
        neuro.dopamine = Math.min(100, neuro.dopamine + 0.08);
      } else {
        neuro.serotonin = Math.min(100, neuro.serotonin + 0.02);
      }
    } else if (governance === 'COUNCIL') {
      neuro.cortisol  = Math.max(0, neuro.cortisol - 0.04);
      neuro.serotonin = Math.min(100, neuro.serotonin + 0.04);
    }

    return { ...agent, neuro };
  });
}

export function enforceSocialNorms(agents: Agent[], gs: GameState): { agents: Agent[]; logs: string[] } {
  const logs: string[] = [];
  const updated = agents.map(a => ({ ...a }));

  for (let i = 0; i < updated.length; i++) {
    const agent = updated[i];
    if (agent.socialRole !== 'OUTCAST') continue;

    const nearby = updated.filter(a => a.id !== agent.id && Math.sqrt((a.position.x - agent.position.x) ** 2 + (a.position.z - agent.position.z) ** 2) < 8);
    for (const other of nearby) {
      const otherIdx = updated.findIndex(a => a.id === other.id);
      if (otherIdx < 0) continue;
      const rel = updated[otherIdx].relationships[agent.id] ?? 0;
      if (rel > -10) {
        updated[otherIdx] = {
          ...updated[otherIdx],
          relationships: { ...updated[otherIdx].relationships, [agent.id]: Math.max(-80, rel - 0.5) },
        };
      }
    }
  }

  return { agents: updated, logs };
}
