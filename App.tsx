import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, INITIAL_WATER, DAY_LENGTH_TICKS, WORLD_SIZE, getTerrainHeight, SEASON_LENGTH_DAYS, SEASON_PROPERTIES, TECHNOLOGIES, CRAFTING_RECIPES, BUILDING_RECIPES, TICK_RATE_MS, MAX_POPULATION, MAX_AGE_DAYS } from './constants';
import { GameState, Agent, AgentState, Building, Flora, Fauna, Season, Weather, WaterPatch, Discovery, WorldEvent, Era, Settlement, ActiveEvent, CameraMode, PopulationSnapshot } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { getAIDecision, applyAIDecision } from './services/deepseekService';
import { updateNeeds, deriveFeelings, tryDiscoverTechnology, calculateEra, performGathering, performCrafting, startBuilding, performHunting, updateFauna, updateWeather, fallbackBehavior, performAgentCombat, attemptCourting, formPartnership, startPregnancy, giveBirth, updateLifeStage, shareFood, detectSettlements, rollForEvent, processActiveEvents } from './services/worldEngine';
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
    settlements: [],
    activeEvents: [],
    cameraMode: 'FREE',
    populationHistory: [{ time: 0, count: INITIAL_AGENTS.length }],
    totalBirths: 0,
    totalDeaths: 0,
  });

  const stateRef = useRef<GameState>(gameState);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const agentPosHistory = useRef<Record<string, { x: number; z: number; ticks: number }>>({});
  const courtingTimers = useRef<Record<string, number>>({});

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
        let isNewDay = false;

        if (rawDayTime >= 24 && prev.dayTime < 24) {
          nextDay = prev.day + 1;
          isNewDay = true;
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
        let totalBirths = prev.totalBirths;
        let totalDeaths = prev.totalDeaths;
        const newBabies: Agent[] = [];

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

        let activeEvents = [...prev.activeEvents];
        if (nextTime % 50 === 0) {
          const newEvent = rollForEvent({ ...prev, activeEvents });
          if (newEvent) {
            activeEvents.push(newEvent);
            logs.push({ id: generateId(), timestamp: nextTime, type: 'EVENT', message: `⚡ ${newEvent.name}: ${newEvent.description}`, importance: 8 });
          }
        }

        let eventAgents = prev.agents;
        if (activeEvents.length > 0) {
          const eventResult = processActiveEvents({ ...prev, flora, fauna, water, buildings, activeEvents, agents: eventAgents });
          flora = eventResult.flora;
          fauna = eventResult.fauna;
          water = eventResult.water;
          buildings = eventResult.buildings;
          eventAgents = eventResult.agents;
          activeEvents = eventResult.events;
          eventResult.logs.forEach(l => logs.push(l));
        }

        let nextAgents = eventAgents.map(agent => {
          let a = updateNeeds(agent, { ...prev, season: nextSeason, weather: nextWeather });
          const { feelings, mood } = deriveFeelings(a);
          a = { ...a, feelings, mood };

          if (isNewDay) {
            a.ageDays += 1;
            a = updateLifeStage(a);

            if (a.lifeStage === 'ELDER' && a.ageDays > MAX_AGE_DAYS) {
              const deathChance = (a.ageDays - MAX_AGE_DAYS) * 0.02;
              if (Math.random() < deathChance) {
                a.needs = { ...a.needs, health: 0 };
                a.causeOfDeath = 'old age';
              }
            }
          }

          if (a.needs.health <= 0) {
            const cause = a.causeOfDeath || (a.needs.hunger < 5 ? 'starvation' : a.needs.thirst < 5 ? 'dehydration' : a.needs.temperature < 10 ? 'exposure' : 'unknown causes');
            logs.push({ id: generateId(), timestamp: nextTime, type: 'DEATH', message: `💀 ${a.name} has perished from ${cause}...`, importance: 10 });
            totalDeaths++;
            const partner = prev.agents.find(p => p.id === a.partnerId);
            if (partner) {
              const pIdx = eventAgents.findIndex(p => p.id === partner.id);
              if (pIdx >= 0) {
                eventAgents[pIdx] = {
                  ...eventAgents[pIdx],
                  partnerId: undefined,
                  state: AgentState.MOURNING,
                  currentActionLabel: `Mourning ${a.name}`,
                  neuro: { ...eventAgents[pIdx].neuro, cortisol: Math.min(100, eventAgents[pIdx].neuro.cortisol + 30), serotonin: Math.max(0, eventAgents[pIdx].neuro.serotonin - 20) }
                };
              }
            }
            a.children.forEach(childId => {
              const childIdx = eventAgents.findIndex(c => c.id === childId);
              if (childIdx >= 0) {
                eventAgents[childIdx] = {
                  ...eventAgents[childIdx],
                  state: AgentState.MOURNING,
                  currentActionLabel: `Mourning ${a.name}`,
                  neuro: { ...eventAgents[childIdx].neuro, cortisol: Math.min(100, eventAgents[childIdx].neuro.cortisol + 20) }
                };
              }
            });
            return null;
          }

          if (a.isPregnant && a.pregnancyTimer <= 0) {
            const father = prev.agents.find(p => p.id === a.partnerId);
            if (prev.agents.length + newBabies.length < MAX_POPULATION) {
              const result = giveBirth(a, father, nextDay);
              a = result.mother;
              newBabies.push(result.baby);
              logs.push({ id: generateId(), timestamp: nextTime, type: 'BIRTH', message: result.log, importance: 10 });
              totalBirths++;
              if (father) {
                const fIdx = eventAgents.findIndex(p => p.id === father.id);
                if (fIdx >= 0) {
                  eventAgents[fIdx] = {
                    ...eventAgents[fIdx],
                    children: [...eventAgents[fIdx].children, result.baby.id],
                    relationships: { ...eventAgents[fIdx].relationships, [result.baby.id]: 90 },
                    relationshipTypes: { ...eventAgents[fIdx].relationshipTypes, [result.baby.id]: 'CHILD_REL' },
                    state: AgentState.CELEBRATING,
                    currentActionLabel: `Celebrating ${result.baby.name}'s birth!`,
                    neuro: { ...eventAgents[fIdx].neuro, dopamine: Math.min(100, eventAgents[fIdx].neuro.dopamine + 30), oxytocin: Math.min(100, eventAgents[fIdx].neuro.oxytocin + 40) }
                  };
                }
              }
              a.state = AgentState.CELEBRATING;
              a.currentActionLabel = `Celebrating ${result.baby.name}'s birth!`;
            } else {
              a.isPregnant = false;
              a.pregnancyTimer = 0;
            }
          }

          if (a.state === AgentState.MOVING && a.targetPosition) {
            const h = agentPosHistory.current[a.id] || { x: a.position.x, z: a.position.z, ticks: 0 };
            if (dist(h, a.position) < 0.05) {
              h.ticks++;
              if (h.ticks > 40) { a.state = AgentState.IDLE; a.targetPosition = null; a.currentActionLabel = 'Path blocked'; h.ticks = 0; }
            } else { h.x = a.position.x; h.z = a.position.z; h.ticks = 0; }
            agentPosHistory.current[a.id] = h;
          }

          const moveSpeed = a.state === AgentState.FLEEING ? 0.12 :
            a.state === AgentState.HUNTING ? 0.08 :
            a.lifeStage === 'CHILD' ? 0.06 :
            a.lifeStage === 'ELDER' ? 0.035 : 0.05;

          if (a.targetPosition && [AgentState.MOVING, AgentState.FLEEING, AgentState.HUNTING, AgentState.EXPLORING, AgentState.COURTING].includes(a.state)) {
            const dx = a.targetPosition.x - a.position.x;
            const dz = a.targetPosition.z - a.position.z;
            const d = Math.sqrt(dx * dx + dz * dz);

            if (d < 1.0) {
              if (a.targetId) {
                const targetFlora = flora.find(f => f.id === a.targetId);
                const targetFauna = fauna.find(f => f.id === a.targetId);
                const targetAgent = prev.agents.find(ag => ag.id === a.targetId);

                if (a.targetId.startsWith('COURT:')) {
                  const courtTargetId = a.targetId.split(':')[1];
                  const courtTarget = prev.agents.find(ag => ag.id === courtTargetId);
                  if (courtTarget && attemptCourting(a, courtTarget, prev.agents)) {
                    a.state = AgentState.COURTING;
                    a.currentActionLabel = `Courting ${courtTarget.name}`;
                    const timerKey = `${a.id}_${courtTargetId}`;
                    courtingTimers.current[timerKey] = (courtingTimers.current[timerKey] || 0) + 1;
                    if (courtingTimers.current[timerKey] >= 3) {
                      const result = formPartnership(a, courtTarget);
                      a = result.agent;
                      const tIdx = eventAgents.findIndex(ag => ag.id === courtTargetId);
                      if (tIdx >= 0) eventAgents[tIdx] = result.target;
                      logs.push({ id: generateId(), timestamp: nextTime, type: 'RELATIONSHIP', message: result.log, importance: 8 });
                      delete courtingTimers.current[timerKey];
                    }
                  }
                  a.targetPosition = null;
                  a.targetId = undefined;
                } else if (a.targetId === 'SHARE_FOOD') {
                  const nearbyHungry = prev.agents.find(ag => ag.id !== a.id && dist(ag.position, a.position) < 3 && ag.needs.hunger < 40);
                  if (nearbyHungry) {
                    const result = shareFood(a, nearbyHungry);
                    if (result) {
                      a = result.giver;
                      const rIdx = eventAgents.findIndex(ag => ag.id === nearbyHungry.id);
                      if (rIdx >= 0) eventAgents[rIdx] = result.receiver;
                      logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: result.log });
                    }
                  }
                  a.state = AgentState.IDLE;
                  a.targetPosition = null;
                  a.targetId = undefined;
                } else if (a.targetId.startsWith('FIGHT_AGENT:')) {
                  const fightTargetId = a.targetId.split(':')[1];
                  const fightTarget = prev.agents.find(ag => ag.id === fightTargetId);
                  if (fightTarget && dist(a.position, fightTarget.position) < 2) {
                    const result = performAgentCombat(a, fightTarget);
                    a = result.attacker;
                    const fIdx = eventAgents.findIndex(ag => ag.id === fightTargetId);
                    if (fIdx >= 0) eventAgents[fIdx] = result.defender;
                    logs.push({ id: generateId(), timestamp: nextTime, type: 'DANGER', message: result.log });
                    a.state = AgentState.FIGHTING;
                  }
                  a.targetPosition = null;
                  a.targetId = undefined;
                } else if (targetFlora && (targetFlora.resourceYield || targetFlora.isEdible)) {
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
                  if ((rel[targetAgent.id] || 0) > 50 && !a.relationshipTypes[targetAgent.id]) {
                    a.relationshipTypes = { ...a.relationshipTypes, [targetAgent.id]: 'FRIEND' };
                  }
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
            a.state = AgentState.CRAFTING;
            setTimeout(() => {
              setGameState(g => ({
                ...g,
                agents: g.agents.map(ag => ag.id === a.id ? { ...ag, state: AgentState.IDLE } : ag)
              }));
            }, 2000);
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
            a.state = AgentState.BUILDING;
            setTimeout(() => {
              setGameState(g => ({
                ...g,
                agents: g.agents.map(ag => ag.id === a.id ? { ...ag, state: AgentState.IDLE } : ag)
              }));
            }, 3000);
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
                a.state = AgentState.CELEBRATING;
                a.currentActionLabel = `Eureka! Discovered ${TECHNOLOGIES[disc.techId]?.name}!`;
              } else {
                a.knownTechnologies = [...new Set([...a.knownTechnologies, disc.techId])];
                logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${a.name} learned ${TECHNOLOGIES[disc.techId]?.name || disc.techId} from the tribe's knowledge` });
              }
              a.neuro = { ...a.neuro, dopamine: Math.min(100, a.neuro.dopamine + 25) };
              a.needs = { ...a.needs, curiosity: Math.max(0, a.needs.curiosity - 30) };
            }
            if (Math.random() < 0.3 || disc) {
              if (a.state !== AgentState.CELEBRATING) a.state = AgentState.IDLE;
              a.targetId = undefined;
            }
          }

          if (a.targetId?.startsWith('MATE:')) {
            const mateId = a.targetId.split(':')[1];
            const partner = prev.agents.find(p => p.id === mateId);
            if (partner && a.partnerId === mateId) {
              a.state = AgentState.MATING;
              a.currentActionLabel = `With ${partner.name}`;
              if (Math.random() < 0.3 && partner.sex === 'FEMALE' && !partner.isPregnant && prev.agents.length + newBabies.length < MAX_POPULATION) {
                const pIdx = eventAgents.findIndex(p => p.id === mateId);
                if (pIdx >= 0) eventAgents[pIdx] = startPregnancy(eventAgents[pIdx]);
                logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `🌟 ${partner.name} is expecting!` });
              } else if (Math.random() < 0.3 && a.sex === 'FEMALE' && !a.isPregnant && prev.agents.length + newBabies.length < MAX_POPULATION) {
                a = startPregnancy(a);
                logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `🌟 ${a.name} is expecting!` });
              }
            }
            a.targetId = undefined;
            a.targetPosition = null;
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
                  logs.push({ id: generateId(), timestamp: nextTime, type: 'AGENT', message: `📚 ${a.name} taught ${target.name} about ${techToTeach}!` });
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

          if ([AgentState.MOURNING, AgentState.CELEBRATING, AgentState.PLAYING].includes(a.state)) {
            if (Math.random() < 0.03) {
              a.state = AgentState.IDLE;
              a.currentActionLabel = '';
            }
          }

          if (a.state === AgentState.DEFENDING) {
            if (Math.random() < 0.05) {
              a.state = AgentState.IDLE;
            }
          }

          if (a.partnerId && a.lifeStage === 'ADULT' && !a.isPregnant && Math.random() < 0.005) {
            const partner = prev.agents.find(p => p.id === a.partnerId);
            if (partner && dist(a.position, partner.position) < 5) {
              a.targetId = `MATE:${partner.id}`;
              a.targetPosition = partner.position;
              a.state = AgentState.MOVING;
              a.currentActionLabel = `Going to ${partner.name}`;
            }
          }

          if (a.state === AgentState.IDLE) {
            const fb = fallbackBehavior(a, { ...prev, flora, buildings, fauna, water, season: nextSeason, weather: nextWeather, agents: eventAgents });
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

        nextAgents = [...nextAgents, ...newBabies];

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
          logs.push({ id: generateId(), timestamp: nextTime, type: 'ERA', message: `🏛️ A new era dawns: ${newEra.replace('_', ' ')}!`, importance: 10 });
        }

        let settlements = prev.settlements;
        if (nextTime % 100 === 0) {
          const detected = detectSettlements(buildings, nextAgents, settlements);
          if (detected.length !== settlements.length) {
            for (const s of detected) {
              if (!settlements.find(es => es.id === s.id)) {
                logs.push({ id: generateId(), timestamp: nextTime, type: 'SETTLEMENT', message: `🏘️ A new settlement has formed: ${s.name}!`, importance: 8 });
              }
            }
            settlements = detected;
          } else {
            settlements = detected;
          }
        }

        let populationHistory = prev.populationHistory;
        if (nextTime % 50 === 0) {
          populationHistory = [...populationHistory.slice(-99), { time: nextTime, count: nextAgents.length }];
        }

        if (logs.length > 150) logs.splice(0, logs.length - 120);

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
          settlements,
          activeEvents,
          populationHistory,
          totalBirths,
          totalDeaths,
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

  const handleSetCameraMode = useCallback((cameraMode: CameraMode) => {
    setGameState(prev => ({ ...prev, cameraMode }));
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
          settlements={gameState.settlements}
          activeEvents={gameState.activeEvents}
          onSelectAgent={handleSelectAgent}
          selectedAgentId={gameState.selectedAgentId}
          dayTime={gameState.dayTime}
          season={gameState.season}
          weather={gameState.weather}
          currentEra={gameState.currentEra}
          cameraMode={gameState.cameraMode}
        />
      </Canvas3DErrorBoundary>
      <UIOverlay
        gameState={gameState}
        onTogglePause={handleTogglePause}
        onSetSpeed={handleSetSpeed}
        onSetCameraMode={handleSetCameraMode}
        selectedAgent={selectedAgent}
      />
    </div>
  );
}

export default App;
