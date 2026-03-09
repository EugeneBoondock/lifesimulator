import { Building, GameState, Weather } from '../types';

type WeatherEffect = { damageChance: number; damageAmt: number };

const WEATHER_EFFECTS: Partial<Record<Weather, WeatherEffect>> = {
  STORM:     { damageChance: 0.08, damageAmt: 2.0 },
  SNOW:      { damageChance: 0.04, damageAmt: 0.8 },
  HEAT_WAVE: { damageChance: 0.02, damageAmt: 0.5 },
  RAIN:      { damageChance: 0.01, damageAmt: 0.3 },
};

const STONE_TYPES = new Set(['STONE_HOUSE', 'WALL', 'WELL', 'SMELTER']);
const FLAMMABLE   = new Set(['LEAN_TO', 'HUT', 'WORKSHOP', 'DRYING_RACK', 'FARM_PLOT', 'GRANARY', 'TOTEM']);

function dist2(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

export function applyWeatherDamage(buildings: Building[], weather: Weather): Building[] {
  const effect = WEATHER_EFFECTS[weather];
  if (!effect) return buildings;

  return buildings.map(b => {
    if (b.buildProgress < 100) return b;
    const resistanceMod = STONE_TYPES.has(b.type) ? 0.2 : 1.0;
    if (Math.random() < effect.damageChance * resistanceMod) {
      return { ...b, health: Math.max(0, b.health - effect.damageAmt) };
    }
    return b;
  });
}

export function spreadFire(buildings: Building[], gs: GameState): { buildings: Building[]; logs: string[] } {
  const logs: string[] = [];
  const updated = buildings.map(b => ({ ...b }));

  for (const source of updated) {
    if (!source.isOnFire) continue;
    source.health = Math.max(0, source.health - 1.2);

    for (const target of updated) {
      if (target.id === source.id || target.isOnFire) continue;
      if (!FLAMMABLE.has(target.type)) continue;
      if (dist2(source.position, target.position) > 5) continue;

      const windBonus = gs.weather === 'STORM' || gs.weather === 'HEAT_WAVE' ? 2.5 : 1;
      if (Math.random() < 0.008 * windBonus) {
        target.isOnFire = true;
        logs.push(`🔥 Fire spread from ${source.type} to ${target.type}!`);
      }
    }
  }

  return { buildings: updated, logs };
}

export function applyStructuralDecay(buildings: Building[], tick: number): { buildings: Building[]; destroyed: string[] } {
  const destroyed: string[] = [];
  const remaining: Building[] = [];

  for (const b of buildings) {
    if (b.health <= 0) {
      destroyed.push(b.id);
      continue;
    }
    if (tick % 200 === 0 && Math.random() < 0.005) {
      remaining.push({ ...b, health: Math.max(0, b.health - 1) });
    } else {
      remaining.push(b);
    }
  }

  return { buildings: remaining, destroyed };
}

export function advanceConstruction(buildings: Building[], agentBuilderIds: Set<string>, allAgents: import('../types').Agent[]): Building[] {
  return buildings.map(b => {
    if (b.buildProgress >= 100) return b;
    const builderNearby = allAgents.some(a =>
      agentBuilderIds.has(a.id) &&
      dist2(a.position, b.position) < 5 &&
      a.state.toString() === 'BUILDING'
    );
    const progressRate = builderNearby ? 8 : 2;
    return { ...b, buildProgress: Math.min(100, b.buildProgress + progressRate) };
  });
}
