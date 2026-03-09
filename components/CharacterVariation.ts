import { Agent } from '../types';

export interface CharacterVariation {
  heightScale: number;
  shoulderWidth: number;
  headSize: number;
  limbLength: number;
  torsoWidth: number;
  idlePhase: number;
  idleIntensity: number;
  walkBobScale: number;
  personalityPhase: number;
  posturePreset: 'upright' | 'relaxed' | 'slouched';
  idleTendency: 'still' | 'curious' | 'restless';
  primaryColor: string;
  accentColor: string;
  outfitVariant: number;
  antennaStyle: 'twin' | 'single' | 'curl' | 'none';
  eyeColor: string;
  hairColor: string;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

const variationCache = new Map<string, CharacterVariation>();

export function getCharacterVariation(agent: Agent): CharacterVariation {
  if (variationCache.has(agent.id)) return variationCache.get(agent.id)!;

  const rng = seededRandom(hashString(agent.id));

  const isChild = agent.lifeStage === 'CHILD';
  const isElder = agent.lifeStage === 'ELDER';

  const extraversion = agent.personality?.extraversion ?? 0.5;
  const conscientiousness = agent.personality?.conscientiousness ?? 0.5;
  const openness = agent.personality?.openness ?? 0.5;

  let posturePreset: 'upright' | 'relaxed' | 'slouched';
  if (conscientiousness > 0.65) posturePreset = 'upright';
  else if (conscientiousness < 0.35 || isElder) posturePreset = 'slouched';
  else posturePreset = 'relaxed';

  let idleTendency: 'still' | 'curious' | 'restless';
  if (extraversion > 0.65 || openness > 0.65) idleTendency = 'restless';
  else if (openness > 0.45) idleTendency = 'curious';
  else idleTendency = 'still';

  const eyeColors = ['#3a8fd1', '#5cb85c', '#c87941', '#8b5e9e', '#d95f5f', '#4ac4c4'];
  const hairColors = ['#2c1a0e', '#5c3a1e', '#8b6914', '#c0a96e', '#1a1a2e', '#4a0e4e'];
  const antennaStyles: Array<'twin' | 'single' | 'curl' | 'none'> = ['twin', 'twin', 'single', 'curl', 'none'];

  const variation: CharacterVariation = {
    heightScale: isChild ? 0.68 : isElder ? (0.88 + rng() * 0.06) : (0.92 + rng() * 0.16),
    shoulderWidth: 0.88 + rng() * 0.24,
    headSize: isChild ? (1.1 + rng() * 0.08) : (0.94 + rng() * 0.12),
    limbLength: 0.92 + rng() * 0.16,
    torsoWidth: 0.9 + rng() * 0.2,
    idlePhase: rng() * Math.PI * 2,
    idleIntensity: 0.6 + rng() * 0.8,
    walkBobScale: 0.7 + rng() * 0.6,
    personalityPhase: rng() * Math.PI * 2,
    posturePreset,
    idleTendency,
    primaryColor: agent.color,
    accentColor: agent.markings,
    outfitVariant: Math.floor(rng() * 4),
    antennaStyle: antennaStyles[Math.floor(rng() * antennaStyles.length)],
    eyeColor: eyeColors[Math.floor(rng() * eyeColors.length)],
    hairColor: hairColors[Math.floor(rng() * hairColors.length)],
  };

  variationCache.set(agent.id, variation);
  return variation;
}

export function clearVariationCache() {
  variationCache.clear();
}

export interface EmotionState {
  postureHunch: number;
  energyLevel: number;
  urgency: number;
  happiness: number;
  fear: number;
  socialOpenness: number;
}

export function computeEmotionState(agent: Agent): EmotionState {
  const { hunger, energy, thirst, social, safety, health } = agent.needs;
  const { dopamine, serotonin, adrenaline, cortisol } = agent.neuro;

  const hungerPressure = Math.max(0, (hunger - 50) / 50);
  const thirstPressure = Math.max(0, (thirst - 50) / 50);
  const lowEnergy = Math.max(0, (50 - energy) / 50);
  const happiness = Math.min(1, (dopamine * 0.4 + serotonin * 0.6) / 100);
  const fear = Math.min(1, (adrenaline * 0.5 + cortisol * 0.3 + Math.max(0, 50 - safety) / 50 * 40) / 100);
  const urgency = Math.min(1, (hungerPressure * 0.4 + thirstPressure * 0.4 + adrenaline * 0.004 + Math.max(0, cortisol - 50) * 0.005));
  const postureHunch = Math.min(0.8, hungerPressure * 0.3 + lowEnergy * 0.4 + (1 - health / 100) * 0.3);
  const socialOpenness = Math.min(1, (social / 100) * 0.5 + happiness * 0.5);

  return { postureHunch, energyLevel: energy / 100, urgency, happiness, fear, socialOpenness };
}
