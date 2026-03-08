import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, INITIAL_WATER, DAY_LENGTH_TICKS, WORLD_SIZE, getTerrainHeight, SEASON_LENGTH_DAYS, SEASON_PROPERTIES, TECHNOLOGIES, CRAFTING_RECIPES, BUILDING_RECIPES, TICK_RATE_MS } from './constants';
import { GameState, Agent, AgentState, Building, Flora, Fauna, Season, Weather, WaterPatch, Discovery, WorldEvent, Era } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { getAIDecision, applyAIDecision } from './services/deepseekService';
import { updateNeeds, deriveFeelings, tryDiscoverTechnology, calculateEra, performGathering, performCrafting, startBuilding, performHunting, updateFauna, updateWeather, fallbackBehavior } from './services/worldEngine';
import { initDB, loadAllAgents, saveAllAgents } from './services/memoryStorage';

const generateId = () => Math.random().toString(36).substr(2, 9);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

class Canvas3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('3D canvas error:', error.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
          <div className="text-center space-y-4 p-8">
            <div className="text-6xl">🌍</div>
            <h2 className="text-2xl font-bold text-white">Aetheria</h2>
            <p className="text-slate-400 max-w-md">The 3D world requires WebGL support. The simulation is running - check the UI panels for details.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    flora: INITIAL_FLORA,
    fauna: INITIAL_FAUNA,
    water: INITIAL_WATER,
    places: [],
    discoveries: [],
    knowledge: {},
    globalTechsDiscovered: [],
    currentEra: 'PRIMITIVE',
    time: 0,
    dayTime: 8,
    day: 1,
    season: 'SPRING',
    weather: 'CLEAR',
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'The Aetheri awaken in a strange new world...', importance: 10 }],
    paused: false,
    speed: 1,
    selectedAgentId: null,
    populationPeak: INITIAL_AGENTS.length,
  });

  const stateRef = useRef<GameState>(gameState);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const agentPosHistory = useRef<Record<string, { x: number; z: number; ticks: number }>>({});

  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    initDB().then(() => loadAllAgents()).then(saved => {
      if (Object.keys(saved).length > 0) {
        setGameState(prev => ({
          ...prev,
          agents: prev.agents.map(agent => {
            const s = saved[agent.id];
            if (s) return { ...agent, memories: s.memories || agent.memories, actionMemories: s.actionMemories || agent.actionMemories, aiThoughts: s.aiThoughts || agent.aiThoughts, aiConversations: s.aiConversations || agent.aiConversations, relationships: s.relationships || agent.relationships, knownTechnologies: (s as any).knownTechnologies || agent.knownTechnologies };
            return agent;
          })
        }));
      }
      setMemoryLoaded(true);
    }).catch(() => setMemoryLoaded(true));
  }, []);

  useEffect(() => {
    if (!memoryLoaded) return;
    const id = setInterval(() => {
      saveAllAgents(stateRef.current.agents);
    }, 30000);
    return () => clearInterval(id);
  }, [memoryLoaded]);

  const resolveCollisions = useCallback((agent: Agent, agents: Agent[], buildings: Building[], flora: Flora[]): { x: number; y: number; z: number } => {
    let pos = { ...agent.position };
    const obstacles = [
      ...agents.filter(a => a.id !== agent.id).map(a => ({ pos: a.position, r: a.radius + agent.radius })),
      ...buildings.map(b => ({ pos: b.position, r: b.radius + agent.radius })),
      ...flora.filter(f => f.type.startsWith('TREE')).map(f => ({ pos: f.position, r: f.radius + agent.radius + 0.3 })),
    ];
    for (const obs of obstacles) {
      const dx = pos.x - obs.pos.x;
      const dz = pos.z - obs.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < obs.r && d > 0.01) {
        const f = (obs.r - d) / d;
        pos.x += dx * f * 0.5;
        pos.z += dz * f * 0.5;
      }
    }
    pos.x = Math.max(-WORLD_SIZE / 2, Math.min(WORLD_SIZE / 2, pos.x));
    pos.z = Math.max(-WORLD_SIZE / 2, Math.min(WORLD_SIZE / 2, pos.z));
    pos.y = getTerrainHeight(pos.x, pos.z);
    return pos;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (stateRef.current.paused) return;

      setGameState(prev => {
        const nextTime = prev.time + 1;
        const rawDayTime = prev.dayTime + (24 / DAY_LENGTH_TICKS);
        const nextDayTime = rawDayTime % 24;
        let nextDay = prev.day;
        let nextSeason = prev.season;

        if (rawDayTime >= 24 && prev.dayTime < 24) {
          nextDay = prev.day + 1;
          const seasonIdx = Math.floor((nextDay - 1) / SEASON_LENGTH_DAYS) % 4;
          nextSeason = (['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as Season[])[seasonIdx];
        }

        const logs: WorldEvent[] = [...prev.logs];
        if (nextSeason !== prev.season) logs.push({ id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `Season changed to ${nextSeason}` });

        const nextWeather = updateWeather(prev.weather, nextSeason);
        if (nextWeather !== prev.weather) logs.push({ id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `Weather: ${nextWeather.toLowerCase().replace('_', ' ')}` });

        let buildings = [...prev.buildings];
        let flora = [...prev.flora];
        let fauna = prev.fauna.map(f => updateFauna(f, prev.agents, prev));
        let water = [...prev.water];
        let discoveries = [...prev.discoveries];
        let globalTechs = [...prev.globalTechsDiscovered];
        const faunaToRemove: string[] = [];

        const isRaining = nextWeather === 'RAIN' || nextWeather === 'STORM';
        if (isRaining && water.filter(w => w.kind === 'PUDDLE').length < 30 && Math.random() < 0.06) {
          const x = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
          const z = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
          const h = getTerrainHeight(x, z);
          if (h < 1.5) {
            water.push({ id: `puddle_${generateId()}`, kind: 'PUDDLE', position: { x, y: h + 0.02, z }, size: 1 + Math.random() * 2, ttl: 500 + Math.random() * 300 });
          }
        }
        water = water.map(w => w.kind === 'PUDDLE' ? { ...w, ttl: (w.ttl || 600) - (isRaining ? -1 : 0.5) } : w).filter(w => w.kind !== 'PUDDLE' || (w.ttl || 0) > 0);

        flora = flora.map(f => {
          if (f.type === 'FARM_CROP' && f.growthStage !== undefined && f.growthStage < 2) {
            const growthMod = SEASON_PROPERTIES[nextSeason].growthMod;
            const timer = (f.growthTimer || 0) + growthMod;
            if (timer > 200) return { ...f, growthStage: Math.min(2, (f.growthStage || 0) + 1), growthTimer: 0 };
            return { ...f, growthTimer: timer };
          }
          if (f.resourcesLeft !== undefined && f.maxResources && f.resourcesLeft < f.maxResources && Math.random() < 0.0005 * SEASON_PROPERTIES[nextSeason].growthMod) {
            return { ...f, resourcesLeft: Math.min(f.maxResources, f.resourcesLeft + 1) };
          }
          return f;
        });

        let nextAgents = prev.agents.map(agent => {
          let a = updateNeeds(agent, { ...prev, season: nextSeason, weather: nextWeather });
          const { feelings, mood } = deriveFeelings(a);
          a = { ...a, feelings, mood };

          if (a.needs.health <= 0) {
            logs.push({ id: generateId(), timestamp: nextTime, type: 'DEATH', message: `${a.name} has perished...`, importance: 10 });
            return null;
          }

          if (a.state === AgentState.MOVING && a.targetPosition) {
            const h = agentPosHistory.current[a.id] || { x: a.position.x, z: a.position.z, ticks: 0 };
            if (dist(h, a.position) < 0.05) {
              h.ticks++;
              if (h.ticks > 40) { a.state = AgentState.IDLE; a.targetPosition = null; a.currentActionLabel = 'Path blocked'; h.ticks = 0; }
            } else { h.x = a.position.x; h.z = a.position.z; h.ticks = 0; }
            agentPosHistory.current[a.id] = h;
          }

          const moveSpeed = a.state === AgentState.FLEEING ? 0.12 : a.state === AgentState.HUNTING ? 0.08 : 0.05;

          if (a.targetPosition && [AgentState.MOVING, AgentState.FLEEING, AgentState.HUNTING, AgentState.EXPLORING].includes(a.state)) {
            const dx = a.targetPosition.x - a.position.x;
            const dz = a.targetPosition.z - a.position.z;
            const d = Math.sqrt(dx * dx + dz * dz);

            if (d < 1.0) {
              if (a.targetId) {
                const targetFlora = flora.find(f => f.id === a.targetId);
                const targetFauna = fauna.find(f => f.id === a.targetId);
                const targetAgent = prev.agents.find(ag => ag.id === a.targetId);

                if (targetFlora && (targetFlora.resourceYield || targetFlora.isEdible)) {
                  const result = performGathering(a, targetFlora);
                  a = result.agent;
                  const floraIdx = flora.findIndex(f => f.id === targetFlora.id);
                  if (floraIdx >= 0) flora[floraIdx] = result.flora;
                  if (result.log) logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: result.log });
                  a.state = AgentState.GATHERING;
                  a.targetPosition = null;
                  a.targetId = undefined;
                } else if (targetFauna && a.state === AgentState.HUNTING) {
                  const result = performHunting(a, targetFauna);
                  a = result.agent;
                  const faunaIdx = fauna.findIndex(f => f.id === targetFauna.id);
                  if (faunaIdx >= 0) fauna[faunaIdx] = result.animal;
                  if (result.killed) faunaToRemove.push(targetFauna.id);
                  if (result.log) logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: result.log });
                  if (result.killed) { a.state = AgentState.IDLE; a.targetPosition = null; a.targetId = undefined; }
                } else if (targetAgent) {
                  a.state = AgentState.SOCIALIZING;
                  a.needs = { ...a.needs, social: Math.min(100, a.needs.social + 5) };
                  const rel = { ...a.relationships };
                  rel[targetAgent.id] = (rel[targetAgent.id] || 0) + 2;
                  a.relationships = rel;
                  a.targetPosition = null;
                } else if (a.targetId === 'DRINK') {
                  a.needs = { ...a.needs, thirst: Math.min(100, a.needs.thirst + 30) };
                  a.state = AgentState.DRINKING;
                  a.targetPosition = null;
                  a.targetId = undefined;
                  logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${a.name} drank water` });
                } else {
                  a.state = AgentState.IDLE;
                  a.targetPosition = null;
                  a.targetId = undefined;
                }
              } else {
                a.state = AgentState.IDLE;
                a.targetPosition = null;
              }
            } else {
              const nx = a.position.x + (dx / d) * moveSpeed;
              const nz = a.position.z + (dz / d) * moveSpeed;
              a.position = { x: nx, y: getTerrainHeight(nx, nz), z: nz };
              a.rotation = Math.atan2(dx, dz);
            }
          }

          if (a.targetId?.startsWith('CRAFT:')) {
            const recipeId = a.targetId.split(':')[1];
            const result = performCrafting(a, recipeId, buildings);
            if (result) {
              a = result.agent;
              if (result.log) logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: result.log });
            }
            a.state = AgentState.IDLE;
            a.targetId = undefined;
          }

          if (a.targetId?.startsWith('BUILD:')) {
            const buildType = a.targetId.split(':')[1];
            const result = startBuilding(a, buildType);
            if (result) {
              a = result.agent;
              buildings.push(result.building);
              if (result.log) logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: result.log });
            }
            a.state = AgentState.IDLE;
            a.targetId = undefined;
            a.targetPosition = null;
          }

          if (a.targetId?.startsWith('RESEARCH:')) {
            const disc = tryDiscoverTechnology(a, { ...prev, flora, buildings, fauna, globalTechsDiscovered: globalTechs });
            if (disc) {
              a.knownTechnologies = [...a.knownTechnologies, disc.techId];
              if (!globalTechs.includes(disc.techId)) {
                globalTechs.push(disc.techId);
                discoveries.push({ id: generateId(), techId: disc.techId, discoveredBy: a.name, discoveredAt: nextTime, day: nextDay, description: disc.description });
                logs.push({ id: generateId(), timestamp: nextTime, type: 'DISCOVERY', message: disc.description, importance: 10 });
              } else {
                a.knownTechnologies = [...new Set([...a.knownTechnologies, disc.techId])];
                logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${a.name} learned ${TECHNOLOGIES[disc.techId]?.name || disc.techId} from the tribe's knowledge` });
              }
              a.neuro = { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 25) };
              a.needs = { ...a.needs, curiosity: Math.max(0, a.needs.curiosity - 30) };
            }
            if (Math.random() < 0.3 || disc) {
              a.state = AgentState.IDLE;
              a.targetId = undefined;
            }
          }

          if (a.state === AgentState.EATING) {
            const foods = ['COOKED_MEAT', 'RAW_MEAT', 'BERRY', 'SEEDS'];
            for (const food of foods) {
              if ((a.inventory[food] || 0) > 0) {
                a.inventory = { ...a.inventory, [food]: a.inventory[food] - 1 };
                const nutrition = food === 'COOKED_MEAT' ? 35 : food === 'RAW_MEAT' ? 20 : 12;
                a.needs = { ...a.needs, hunger: Math.min(100, a.needs.hunger + nutrition) };
                if (food === 'RAW_MEAT' && Math.random() < 0.2) {
                  a.sickness = 'FOOD_POISON';
                  a.sicknessDuration = 100;
                }
                break;
              }
            }
            a.state = AgentState.IDLE;
            a.targetId = undefined;
          }

          if (a.state === AgentState.SOCIALIZING && a.targetId) {
            if (Math.random() < 0.05) {
              const target = prev.agents.find(ag => ag.id === a.targetId);
              let taught = false;
              if (target) {
                const sharedTechs = a.knownTechnologies.filter(t => !target.knownTechnologies.includes(t));
                if (sharedTechs.length > 0 && Math.random() < 0.2) {
                  const techToTeach = sharedTechs[Math.floor(Math.random() * sharedTechs.length)];
                  target.knownTechnologies.push(techToTeach);
                  a.state = AgentState.TEACHING;
                  a.currentActionLabel = `Teaching ${target.name} about ${techToTeach}`;
                  target.currentActionLabel = `Learning ${techToTeach} from ${a.name}`;
                  logs.push(`📚 ${a.name} taught ${target.name} about ${techToTeach}!`);
                  taught = true;
                }
              }
              if (!taught) {
                a.state = AgentState.IDLE;
                a.targetId = undefined;
                a.targetPosition = null;
              }
            }
          }

          if (a.state === AgentState.SLEEPING) {
            if (a.needs.energy >= 95) {
              a.state = AgentState.IDLE;
              a.currentActionLabel = 'Waking up';
            }
          }

          if (a.state === AgentState.IDLE) {
            const fb = fallbackBehavior(a, { ...prev, flora, buildings, fauna, water, season: nextSeason, weather: nextWeather });
            a = { ...a, ...fb };
          }

          if ((a.state === AgentState.IDLE || a.state === AgentState.EXPLORING) && nextTime % 5 === 0) {
            getAIDecision(a, { ...prev, flora, buildings, fauna, water, season: nextSeason, weather: nextWeather, globalTechsDiscovered: globalTechs, discoveries })
              .then(decision => {
                if (decision) {
                  const aiUpdate = applyAIDecision(a, decision, prev) || {};
                  setGameState(g => ({
                    ...g,
                    agents: g.agents.map(ag => {
                      if (ag.id !== a.id) return ag;
                      const updated = { ...ag, ...aiUpdate };
                      if (decision.thoughtProcess) updated.aiThoughts = [...(ag.aiThoughts || []).slice(-9), decision.thoughtProcess];
                      if (decision.dialogue && aiUpdate.targetId) {
                        const targetName = g.agents.find(t => t.id === aiUpdate.targetId)?.name || 'someone';
                        updated.aiConversations = [...(ag.aiConversations || []).slice(-9), { with: targetName, message: decision.dialogue, time: g.time }];
                      }
                      return updated;
                    })
                  }));
                }
              });
          }

          a.position = resolveCollisions(a, prev.agents, buildings, flora);

          return a;
        }).filter(Boolean) as Agent[];

        fauna = fauna.filter(f => !faunaToRemove.includes(f.id));

        if (fauna.length < 30 && Math.random() < 0.005) {
          const types: Array<{ type: any; hp: number; meat: number; hide: number; speed: number; flee: number; radius: number; aggressive: boolean }> = [
            { type: 'RABBIT', hp: 15, meat: 1, hide: 1, speed: 0.09, flee: 15, radius: 0.25, aggressive: false },
            { type: 'DEER', hp: 35, meat: 4, hide: 2, speed: 0.08, flee: 18, radius: 0.6, aggressive: false },
            { type: 'BIRD', hp: 10, meat: 1, hide: 0, speed: 0.06, flee: 20, radius: 0.2, aggressive: false },
          ];
          const t = types[Math.floor(Math.random() * types.length)];
          const x = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
          const z = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
          fauna.push({
            id: generateId(), type: t.type, position: { x, y: getTerrainHeight(x, z), z },
            rotation: Math.random() * Math.PI * 2, state: 'IDLE', targetPosition: null,
            isAggressive: t.aggressive, isTamed: false, health: t.hp, maxHealth: t.hp,
            radius: t.radius, meat: t.meat, hide: t.hide, speed: t.speed, fleeDistance: t.flee
          });
        }

        const newEra = calculateEra(globalTechs);
        if (newEra !== prev.currentEra) {
          logs.push({ id: generateId(), timestamp: nextTime, type: 'ERA', message: `A new era dawns: ${newEra.replace('_', ' ')}!`, importance: 10 });
        }

        if (logs.length > 100) logs.splice(0, logs.length - 80);

        return {
          ...prev,
          agents: nextAgents,
          buildings,
          flora,
          fauna,
          water,
          discoveries,
          globalTechsDiscovered: globalTechs,
          currentEra: newEra,
          time: nextTime,
          dayTime: nextDayTime,
          day: nextDay,
          season: nextSeason,
          weather: nextWeather,
          logs,
          populationPeak: Math.max(prev.populationPeak, nextAgents.length),
        };
      });
    }, TICK_RATE_MS / (stateRef.current.speed || 1));

    return () => clearInterval(interval);
  }, [resolveCollisions, gameState.speed]);

  const handleSelectAgent = useCallback((id: string) => {
    setGameState(prev => ({ ...prev, selectedAgentId: prev.selectedAgentId === id ? null : id }));
  }, []);

  const handleTogglePause = useCallback(() => {
    setGameState(prev => ({ ...prev, paused: !prev.paused }));
  }, []);

  const handleSetSpeed = useCallback((speed: number) => {
    setGameState(prev => ({ ...prev, speed }));
  }, []);

  const selectedAgent = gameState.agents.find(a => a.id === gameState.selectedAgentId);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-900 relative">
      <Canvas3DErrorBoundary>
        <World3D
          agents={gameState.agents}
          buildings={gameState.buildings}
          flora={gameState.flora}
          fauna={gameState.fauna}
          places={gameState.places}
          water={gameState.water}
          onSelectAgent={handleSelectAgent}
          selectedAgentId={gameState.selectedAgentId}
          dayTime={gameState.dayTime}
          season={gameState.season}
          weather={gameState.weather}
        />
      </Canvas3DErrorBoundary>
      <UIOverlay
        gameState={gameState}
        onTogglePause={handleTogglePause}
        onSetSpeed={handleSetSpeed}
        selectedAgent={selectedAgent}
      />
    </div>
  );
}

export default App;
