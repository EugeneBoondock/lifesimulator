import { Agent, GeneticTraits, GameState } from '../types';

export function deriveGenetics(agent: Agent): GeneticTraits {
  const seed = (agent.name.charCodeAt(0) + agent.name.charCodeAt(agent.name.length - 1)) / 256;
  const p = agent.personality;
  return {
    immuneStrength: clamp(0.2 + (1 - p.neuroticism) * 0.5 + seed * 0.3, 0.1, 1),
    metabolicRate:  clamp(0.3 + p.extraversion * 0.4 + (1 - seed) * 0.3, 0.2, 1),
    muscleCapacity: clamp(0.3 + p.conscientiousness * 0.5 + seed * 0.2, 0.1, 1),
    brainPlasticity:clamp(0.2 + p.openness * 0.5 + p.creativity * 0.3, 0.1, 1),
    reproductiveHealth: clamp(0.3 + p.agreeableness * 0.3 + seed * 0.4, 0.1, 1),
  };
}

export function inheritGenetics(motherGenetics: GeneticTraits, fatherGenetics?: GeneticTraits): GeneticTraits {
  const f = fatherGenetics ?? {
    immuneStrength: 0.5, metabolicRate: 0.5, muscleCapacity: 0.5,
    brainPlasticity: 0.5, reproductiveHealth: 0.5,
  };
  const mutate = () => (Math.random() - 0.5) * 0.12;
  return {
    immuneStrength:     clamp((motherGenetics.immuneStrength + f.immuneStrength) / 2 + mutate(), 0.05, 1),
    metabolicRate:      clamp((motherGenetics.metabolicRate + f.metabolicRate) / 2 + mutate(), 0.1, 1),
    muscleCapacity:     clamp((motherGenetics.muscleCapacity + f.muscleCapacity) / 2 + mutate(), 0.05, 1),
    brainPlasticity:    clamp((motherGenetics.brainPlasticity + f.brainPlasticity) / 2 + mutate(), 0.05, 1),
    reproductiveHealth: clamp((motherGenetics.reproductiveHealth + f.reproductiveHealth) / 2 + mutate(), 0.05, 1),
  };
}

export function applyBiologyTick(agent: Agent, gs: GameState): Partial<Agent> {
  const genetics = agent.genetics ?? deriveGenetics(agent);
  const needs = { ...agent.needs };
  const neuro = { ...agent.neuro };
  let updates: Partial<Agent> = { genetics };

  const extraHunger = (genetics.metabolicRate - 0.5) * 0.015;
  needs.hunger = Math.max(0, needs.hunger - extraHunger);
  needs.thirst = Math.max(0, needs.thirst - extraHunger * 0.6);

  if (agent.sickness !== 'NONE') {
    const recoveryBase = 0.003 + genetics.immuneStrength * 0.018;
    if (Math.random() < recoveryBase) {
      updates.sickness = 'NONE';
      updates.sicknessDuration = 0;
      neuro.serotonin = Math.min(100, neuro.serotonin + 8);
    }
  }

  if (agent.sickness === 'NONE' && Math.random() < 0.0008) {
    const nearbySick = gs.agents.find(a =>
      a.sickness !== 'NONE' && dist3(a.position, agent.position) < 5
    );
    if (nearbySick) {
      const catchChance = (1 - genetics.immuneStrength) * 0.04;
      if (Math.random() < catchChance) {
        updates.sickness = nearbySick.sickness;
        updates.sicknessDuration = 50 + Math.round((1 - genetics.immuneStrength) * 50);
      }
    }
  }

  if (agent.lifeStage === 'ELDER') {
    const ageFactor = Math.max(0, (agent.ageDays - 100) / 100);
    needs.health = Math.max(0, needs.health - 0.015 * (1 + ageFactor) * (1 - genetics.immuneStrength * 0.4));
    needs.energy = Math.max(0, needs.energy - 0.02 * ageFactor);
  }

  const totalCarried = Object.values(agent.inventory).reduce((s, v) => s + v, 0);
  const maxCarry = 5 + Math.round(genetics.muscleCapacity * 12);
  if (totalCarried > maxCarry) {
    needs.energy = Math.max(0, needs.energy - 0.08);
  }

  const learningBonus = genetics.brainPlasticity;
  if (Math.random() < 0.005 * learningBonus && agent.state?.toString().includes('CRAFT')) {
    const skillKeys = Object.keys(agent.skillLevels);
    if (skillKeys.length > 0) {
      const skill = skillKeys[Math.floor(Math.random() * skillKeys.length)];
      updates.skillLevels = {
        ...agent.skillLevels,
        [skill]: Math.min(1, agent.skillLevels[skill] + 0.002 * learningBonus),
      };
    }
  }

  updates.needs = needs;
  updates.neuro = neuro;
  return updates;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist3 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
