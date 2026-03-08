
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, DAY_LENGTH_TICKS, WORLD_SIZE, getTerrainHeight, SEASON_LENGTH_DAYS, SEASON_PROPERTIES, INITIAL_WATER, CHAT_TEMPLATES, MAX_INVENTORY_SIZE } from './constants';
import { GameState, Agent, AgentState, Building, Flora, Fauna, Season, Weather, WaterPatch, NamedPlace } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { updateAgentBehavior, learnActionOutcome } from './services/neuroEngine';
import { deriveFeelings, deriveFeelingsAI } from './services/subconsciousEngine';
import { getAIDecision, applyAIDecision } from './services/aiMindEngine';
import { audioManager } from './services/audioService';
import { initDB, loadAllAgents, saveAllAgents } from './services/memoryStorage';

const generateId = () => Math.random().toString(36).substr(2, 9);
  const dist = (p1: {x:number, z:number}, p2: {x:number, z:number}) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));
const TRADE_BASE_VALUES: Record<string, number> = { WOOD: 2, STONE: 3, MUD: 2, MEAT: 6, SPEAR: 12, STONE_AXE: 10, STICK: 3 };

const getItemValue = (agent: Agent, buildings: Building[], item: string) => {
  const base = TRADE_BASE_VALUES[item] ?? 1;
  const hasHouse = buildings.some(b => b.type === 'HOUSE' && b.ownerId === agent.id);
  let value = base;
  if (!hasHouse && (item === 'WOOD' || item === 'STONE' || item === 'MUD')) value *= 1.3;
  if (item === 'WOOD' && agent.needs.temperature < 55) value *= 1.25;
  if (item === 'MEAT' && agent.needs.hunger < 70) value *= 1.5;
  return value;
};

const pickTrade = (a: Agent, b: Agent, buildings: Building[]) => {
  const aItems = Object.entries(a.inventory || {}).filter(([_, q]) => (q || 0) > 0);
  const bItems = Object.entries(b.inventory || {}).filter(([_, q]) => (q || 0) > 0);
  let best: { giveA: string; giveB: string; gain: number } | null = null;

  aItems.forEach(([giveA]) => {
    bItems.forEach(([giveB]) => {
      const aGain = getItemValue(a, buildings, giveB) - getItemValue(a, buildings, giveA);
      const bGain = getItemValue(b, buildings, giveA) - getItemValue(b, buildings, giveB);
      const fairForA = getItemValue(a, buildings, giveB) >= getItemValue(a, buildings, giveA) * 0.9;
      const fairForB = getItemValue(b, buildings, giveA) >= getItemValue(b, buildings, giveB) * 0.9;
      if (aGain > 0 && bGain > 0 && fairForA && fairForB) {
        const total = aGain + bGain;
        if (!best || total > best.gain) best = { giveA, giveB, gain: total };
      }
    });
  });
  return best;
};
const recordActionMemory = (agent: Agent, targetType: string, action: string, outcome: number) => {
  const mem = { targetType, action, outcome, confidence: 1 };
  agent.actionMemories = [...(agent.actionMemories || [])].slice(-20).concat(mem);
};
const mixColor = (c1?: string, c2?: string) => {
  const a = parseInt((c1 || "#888888").replace("#",""), 16);
  const b = parseInt((c2 || "#888888").replace("#",""), 16);
  const r = ((a >> 16) + (b >> 16)) >> 1;
  const g = (((a >> 8) & 0xff) + ((b >> 8) & 0xff)) >> 1;
  const bl = ((a & 0xff) + (b & 0xff)) >> 1;
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
};

function App() {
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    flora: INITIAL_FLORA,
    fauna: INITIAL_FAUNA,
        water: INITIAL_WATER,
        eggs: [],
        places: [],
    knowledge: {},
    time: 0,
    dayTime: 12,
    day: 1,
    season: 'SPRING',
    weather: 'CLEAR',
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'Neuro-Chemical Engine Initiated.' }],
    governance: { leaderId: INITIAL_AGENTS[0]?.id || null, cohesion: 60 },
    paused: false,
    selectedAgentId: null
  });

  const stateRef = useRef<GameState>(gameState);
  const [memoryLoaded, setMemoryLoaded] = useState(false);

  // Stuck detection refs
  const agentPosHistory = useRef<Record<string, {x:number, z:number, ticks:number}>>({});

  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Load memories from IndexedDB on startup
  useEffect(() => {
    initDB().then(() => loadAllAgents()).then(savedMemories => {
      if (Object.keys(savedMemories).length > 0) {
        setGameState(prev => ({
          ...prev,
          agents: prev.agents.map(agent => {
            const saved = savedMemories[agent.id];
            if (saved) {
              return {
                ...agent,
                memories: saved.memories || agent.memories,
                actionMemories: saved.actionMemories || agent.actionMemories,
                aiThoughts: saved.aiThoughts || agent.aiThoughts,
                aiConversations: saved.aiConversations || agent.aiConversations,
                relationships: saved.relationships || agent.relationships,
              };
            }
            return agent;
          })
        }));
        console.log('%c💾 Memories loaded from IndexedDB', 'color: #22c55e');
      }
      setMemoryLoaded(true);
    }).catch(err => {
      console.warn('Failed to load memories:', err);
      setMemoryLoaded(true);
    });
  }, []);

  // Auto-save memories every 30 seconds
  useEffect(() => {
    if (!memoryLoaded) return;
    const saveInterval = setInterval(() => {
      saveAllAgents(stateRef.current.agents).then(() => {
        console.log('%c💾 Memories saved', 'color: #64748b; font-size: 10px');
      });
    }, 30000);
    return () => clearInterval(saveInterval);
  }, [memoryLoaded]);

  // --- PHYSICS ---
  const resolveCollisions = (agent: Agent, agents: Agent[], buildings: Building[], flora: Flora[]) => {
      let pos = { ...agent.position };
      const obstacles = [
        ...agents.filter(a => a.id !== agent.id).map(a => ({ pos: a.position, r: a.radius + agent.radius, strong: false })),
        ...buildings.map(b => ({ pos: b.position, r: b.radius + agent.radius, strong: true })),
        // Trees have larger collision radius to keep agents away
        ...flora.filter(f => f.type.startsWith('TREE')).map(f => ({ pos: f.position, r: f.radius + agent.radius + 0.5, strong: true })),
        ...flora.filter(f => f.resourceYield && !f.type.startsWith('TREE')).map(f => ({ pos: f.position, r: f.radius + agent.radius, strong: false }))
      ];
      obstacles.forEach(obs => {
          const dx = pos.x - obs.pos.x;
          const dz = pos.z - obs.pos.z;
          const d = Math.sqrt(dx*dx + dz*dz);
          if (d < obs.r && d > 0) {
              const pushStrength = obs.strong ? 1.0 : 0.5;
              const f = (obs.r - d) / d;
              pos.x += dx * f * pushStrength; pos.z += dz * f * pushStrength;
          }
      });
      pos.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, pos.x));
      pos.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, pos.z));
      pos.y = getTerrainHeight(pos.x, pos.z);
      return pos;
  };

  // --- LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateRef.current.paused) return;

      setGameState(prev => {
        const nextTime = prev.time + 1;
        // Day Cycle
        const rawDayTime = prev.dayTime + (24 / DAY_LENGTH_TICKS);
        const nextDayTime = rawDayTime % 24;
        let nextDay = prev.day;
        let nextSeason = prev.season;
        let ageIncrement = 0;
        
        if (Math.floor(rawDayTime) > Math.floor(prev.dayTime) && Math.floor(rawDayTime) % 24 === 0) {
            nextDay = prev.day + 1;
            ageIncrement = 1;
            const seasonIdx = Math.floor((nextDay - 1) / SEASON_LENGTH_DAYS) % 4;
            nextSeason = (['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as Season[])[seasonIdx];
        }

        const isNight = nextDayTime < 6 || nextDayTime > 19;

        const logs = [...prev.logs];
        if (nextSeason !== prev.season) logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `Season changed to ${nextSeason}`});

        // Weather changes randomly every few hours
        let nextWeather = prev.weather;
        if (Math.random() < 0.002) { // ~0.2% per tick = changes every few in-game hours
            const weatherOptions: Record<Season, Weather[]> = {
                'SPRING': ['CLEAR', 'CLOUDY', 'RAIN', 'RAIN'],
                'SUMMER': ['CLEAR', 'CLEAR', 'CLOUDY', 'STORM'],
                'AUTUMN': ['CLOUDY', 'RAIN', 'CLEAR', 'STORM'],
                'WINTER': ['CLOUDY', 'SNOW', 'SNOW', 'CLEAR']
            };
            const options = weatherOptions[nextSeason];
            nextWeather = options[Math.floor(Math.random() * options.length)];
            if (nextWeather !== prev.weather) {
                logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `Weather changed to ${nextWeather.toLowerCase()}`});
            }
        }
        const isRaining = nextWeather === 'RAIN' || nextWeather === 'STORM';
        const isSnowing = nextWeather === 'SNOW';

        let buildings = [...prev.buildings];
        let flora = [...prev.flora];
        let activeAgents = [...prev.agents];
        let activeFauna = [...prev.fauna];
        let water: WaterPatch[] = prev.water.map(w => ({ ...w }));
        let eggs = [...prev.eggs];
        let governance = { ...(prev.governance || { leaderId: INITIAL_AGENTS[0]?.id || null, cohesion: 60 }) };
        let faunaToRemove: string[] = [];

        // --- WATER FEATURES (Rivers & Puddles) ---
        const evaporation = isRaining ? -2 : isSnowing ? 0.2 : nextWeather === 'CLOUDY' ? 0.4 : 1;
        water = water
          .map(p => {
            if (p.kind !== 'PUDDLE') return p;
            const nextTtl = Math.min(900, (p.ttl ?? 600) - evaporation);
            return { ...p, ttl: nextTtl };
          })
          .filter(p => p.kind !== 'PUDDLE' || (p.ttl ?? 0) > 0);

        // Form new puddles during rain/storm on low ground
        if (isRaining && water.filter(w => w.kind === 'PUDDLE').length < 40) {
          const puddleChance = 0.08;
          if (Math.random() < puddleChance) {
            const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
            const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
            const h = getTerrainHeight(x, z);
            if (h < 1.2) {
              const size = 1 + Math.random() * 2;
              water.push({
                id: `puddle_${generateId()}`,
                kind: 'PUDDLE',
                position: { x, y: h + 0.02, z },
                size,
                length: size * 0.9,
                ttl: 500 + Math.random() * 300
              });
            }
          }
        }

        // --- ENVIRONMENT SIMULATION ---
        // Fire Spread
        buildings.forEach(b => {
            if (b.type === 'CAMPFIRE') {
                if (Math.random() < 0.005) {
                    const nearby = [...flora, ...buildings].filter(target => target.id !== b.id && dist(target.position, b.position) < 3);
                    nearby.forEach(n => { if (Math.random() < 0.1) n.isOnFire = true; });
                }
            }
            if (b.isOnFire) {
                b.health = (b.health || 100) - 1;
                if (Math.random() < 0.05) {
                    const nearby = [...flora, ...buildings].filter(target => target.id !== b.id && dist(target.position, b.position) < 2);
                    nearby.forEach(n => { if (Math.random() < 0.3) n.isOnFire = true; });
                }
            }
        });
        
        flora.forEach(f => {
            if (f.isOnFire) {
                f.resourcesLeft = Math.max(0, (f.resourcesLeft || 0) - 0.1);
                if (Math.random() < 0.05) {
                    const nearby = flora.filter(target => target.id !== f.id && dist(target.position, f.position) < 2);
                    nearby.forEach(n => { if (Math.random() < 0.3) n.isOnFire = true; });
                }
            }
        });

        buildings = buildings.filter(b => (b.health || 100) > 0);
        
        // 1. FAUNA LOGIC
        const nextFauna = activeFauna.map(animal => {
           if (faunaToRemove.includes(animal.id)) return animal;
           let nextAnimal = { ...animal };
           
           if (nextAnimal.isTamed && nextAnimal.ownerId) {
               const owner = activeAgents.find(a => a.id === nextAnimal.ownerId);
               if (owner) {
                   const d = dist(nextAnimal.position, owner.position);
                   if (d > 3) {
                       nextAnimal.state = 'MOVING';
                       nextAnimal.rotation = Math.atan2(owner.position.x - nextAnimal.position.x, owner.position.z - nextAnimal.position.z);
                   } else {
                       nextAnimal.state = 'IDLE';
                   }
               }
           } else {
               if (nextAnimal.state === 'IDLE' && Math.random() < 0.02) { nextAnimal.state = 'MOVING'; nextAnimal.rotation = Math.random() * Math.PI * 2; }
               else if (nextAnimal.state === 'MOVING' && Math.random() < 0.02) nextAnimal.state = 'IDLE';
           }

           if (nextAnimal.state === 'MOVING' || nextAnimal.state === 'HUNTING' || nextAnimal.state === 'FLEEING') {
               const speed = nextAnimal.state === 'HUNTING' ? 0.12 : 0.04;
               const nextX = nextAnimal.position.x + Math.sin(nextAnimal.rotation) * speed;
               const nextZ = nextAnimal.position.z + Math.cos(nextAnimal.rotation) * speed;
               const h = getTerrainHeight(nextX, nextZ);

               if (nextAnimal.isAggressive && h < 0.6) nextAnimal.rotation += Math.PI;
               else {
                 nextAnimal.position.x = nextX;
                 nextAnimal.position.z = nextZ;
                 nextAnimal.position.y = h; // Follow terrain height
               }
           }
           return nextAnimal;
        }).filter(f => !faunaToRemove.includes(f.id));

        // 2. AGENT LOGIC
        let nextAgents = activeAgents.map(agent => {
          let updatedAgent = { ...agent };
          if (ageIncrement > 0) {
            updatedAgent.ageDays = (updatedAgent.ageDays || 0) + ageIncrement;
          }
          
          // STUCK DETECTION
          if (updatedAgent.state === AgentState.MOVING) {
             const h = agentPosHistory.current[agent.id] || { x: agent.position.x, z: agent.position.z, ticks: 0 };
             if (dist(h, agent.position) < 0.1) {
                 h.ticks++;
                 if (h.ticks > 30) { // Stuck for 3 seconds
                     updatedAgent.state = AgentState.IDLE; // Reset
                     updatedAgent.targetPosition = null;
                     updatedAgent.currentActionLabel = "Path blocked...";
                     h.ticks = 0;
                 }
             } else {
                 h.x = agent.position.x; h.z = agent.position.z; h.ticks = 0;
             }
             agentPosHistory.current[agent.id] = h;
          }

          // Motherly instinct: move toward egg being cared for
          if (updatedAgent.caringEggId) {
            const targetEgg = eggs.find(e => e.id === updatedAgent.caringEggId);
            if (targetEgg) {
              const dEgg = dist(updatedAgent.position, targetEgg.position);
              if (dEgg > 3) {
                updatedAgent.state = AgentState.MOVING;
                updatedAgent.targetPosition = targetEgg.position;
                updatedAgent.targetId = targetEgg.id;
                updatedAgent.currentActionLabel = "Guarding egg";
              }
            } else {
              updatedAgent.caringEggId = undefined;
            }
          }

          // Only use neuroEngine fallback if agent is IDLE (AI not controlling)
          if (updatedAgent.state === AgentState.IDLE) {
            const behaviorUpdates = updateAgentBehavior(updatedAgent, { ...prev, season: nextSeason, agents: activeAgents, buildings, flora, fauna: nextFauna, water, governance });
            if (behaviorUpdates.chatBubble && behaviorUpdates.lastChatTime !== agent.lastChatTime) audioManager.playChat();
            updatedAgent = { ...updatedAgent, ...behaviorUpdates };
          }

          // AI Mind: Core decision engine via Ollama - runs for all agents regardless of state
          // The AI cooldown prevents overwhelming Ollama, and decisions are applied async
          getAIDecision(updatedAgent, { ...prev, season: nextSeason, agents: activeAgents, buildings, flora, fauna: nextFauna, water, governance })
                .then(decision => {
                  if (decision) {
                    const aiUpdate = applyAIDecision(updatedAgent, decision, prev) || {};
                    setGameState(g => ({
                      ...g,
                      agents: g.agents.map(a => {
                        if (a.id !== agent.id) return a;
                        const updated = { ...a, ...aiUpdate };
                        // Always store thought
                        if (decision.thoughtProcess) {
                          updated.aiThoughts = [...(a.aiThoughts || []).slice(-9), decision.thoughtProcess];
                        }
                        // Store conversation if dialogue exists AND there's a target (not self-talk)
                        if (decision.dialogue && aiUpdate.targetId) {
                          const targetName = g.agents.find(t => t.id === aiUpdate.targetId)?.name || 'someone';
                          updated.aiConversations = [...(a.aiConversations || []).slice(-9), {
                            with: targetName,
                            message: decision.dialogue,
                            time: g.time
                          }];
                        }
                        return updated;
                      })
                    }));
                  }
                });

          // -- ACTION EXECUTION --
          
          // Helper for interaction logic
          const performInteraction = (targetId: string) => {
               const tFloraIdx = flora.findIndex(f => f.id === targetId);
               const tFaunaIdx = activeFauna.findIndex(f => f.id === targetId);
               
               if (tFloraIdx !== -1) {
                   const f = flora[tFloraIdx];
                   if (f.resourceYield) {
                       const invCount = Object.values(updatedAgent.inventory || {}).reduce((a,b)=>a+b,0);
                       if (invCount >= MAX_INVENTORY_SIZE) {
                           updatedAgent.currentActionLabel = "Inventory full";
                           return;
                       }
                       if ((f.resourcesLeft||0) > 0) {
                           updatedAgent.inventory[f.resourceYield] = (updatedAgent.inventory[f.resourceYield]||0) + 1;
                           if (f.resourceYield === 'WOOD') {
                             updatedAgent.inventory['STICK'] = (updatedAgent.inventory['STICK'] || 0) + 1;
                           }
                           f.resourcesLeft = (f.resourcesLeft||0) - 1;
                           recordActionMemory(updatedAgent, f.resourceYield, 'GATHER', 10);
                           logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} gathered ${f.resourceYield}`});
                           audioManager.playBuild();
                       }
                   } else {
                       updatedAgent.needs.hunger = Math.min(100, updatedAgent.needs.hunger + 20);
                       f.resourcesLeft = 0; 
                       updatedAgent = learnActionOutcome(updatedAgent, f.type, 'EAT', 50);
                       recordActionMemory(updatedAgent, f.type, 'EAT', 15);
                       logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} ate ${f.type}`});
                   }
               }
                else if (tFaunaIdx !== -1) {
                   const animal = activeFauna[tFaunaIdx];
                   const hunting = animal.isAggressive || (updatedAgent.currentActionLabel || '').toLowerCase().includes('hunt');
                   if (!animal.isAggressive && !animal.isTamed && !hunting) {
                       animal.isTamed = true;
                       animal.ownerId = updatedAgent.id;
                       updatedAgent.neuro.dopamine += 30;
                       updatedAgent.neuro.oxytocin += 20;
                       logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} tamed a ${animal.type}!`});
                   } else {
                       const hasStick = (updatedAgent.inventory['STICK'] || 0) > 0;
                       const tool = updatedAgent.equippedTool || (updatedAgent.inventory['SPEAR'] ? 'SPEAR' : updatedAgent.inventory['STONE_AXE'] ? 'STONE_AXE' : hasStick ? 'STICK' : undefined);
                       if (!tool) {
                           const tree = flora.filter(f => f.resourceYield === 'WOOD' && (f.resourcesLeft || 0) > 0).sort((a,b) => dist(updatedAgent.position, a.position) - dist(updatedAgent.position, b.position))[0];
                           if (tree) {
                             updatedAgent.state = AgentState.MOVING;
                             updatedAgent.targetPosition = tree.position;
                             updatedAgent.targetId = tree.id;
                             updatedAgent.currentActionLabel = "Need a stick to hunt";
                           }
                           return;
                       }
                       const dmg = tool === 'SPEAR' ? 50 : tool === 'STONE_AXE' ? 40 : tool === 'STICK' ? 25 : 20;
                       animal.health -= dmg;
                       if (tool === 'STICK' && hasStick) {
                         updatedAgent.inventory['STICK'] = Math.max(0, (updatedAgent.inventory['STICK'] || 0) - 1);
                       }
                       updatedAgent.neuro.adrenaline = Math.min(100, updatedAgent.neuro.adrenaline + 5);
                       logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} attacked a ${animal.type}${tool ? ' with ' + tool : ''}`});
                       if (animal.health <= 0) {
                           faunaToRemove.push(animal.id);
                           const meatYield = animal.meat ?? 3;
                           updatedAgent.inventory['MEAT'] = (updatedAgent.inventory['MEAT'] || 0) + meatYield;
                           updatedAgent.currentActionLabel = "Harvested raw meat";
                           logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} hunted a ${animal.type} and gathered ${meatYield} meat.`});
                           governance.cohesion = Math.min(100, governance.cohesion + 1);
                           flora.push({
                             id: generateId(),
                             type: 'RESOURCE_BONE',
                             position: { ...animal.position },
                             scale: 0.4,
                             isEdible: false,
                             isPoisonous: false,
                             nutritionValue: 0,
                             resourceYield: 'BONE',
                             resourcesLeft: 2,
                             maxResources: 2,
                             radius: 0.3,
                             health: 100
                           });
                           recordActionMemory(updatedAgent, animal.type, 'HUNT', 20);
                       }
                    }
                }
               else if (targetId.startsWith('BUILD_HOUSE_SITE')) {
                   const parts = targetId.split(':');
                   const ownerId = parts[1] || updatedAgent.id;
                   const required = { WOOD: 4, STONE: 2, MUD: 2 };

                   // Check if THIS agent has enough materials
                   const wood = updatedAgent.inventory['WOOD'] || 0;
                   const stone = updatedAgent.inventory['STONE'] || 0;
                   const mud = updatedAgent.inventory['MUD'] || 0;

                   if (wood >= required.WOOD && stone >= required.STONE && mud >= required.MUD) {
                       // Build the house!
                       updatedAgent.inventory['WOOD'] = (updatedAgent.inventory['WOOD'] || 0) - required.WOOD;
                       updatedAgent.inventory['STONE'] = (updatedAgent.inventory['STONE'] || 0) - required.STONE;
                       updatedAgent.inventory['MUD'] = (updatedAgent.inventory['MUD'] || 0) - required.MUD;

                       buildings.push({
                         id: generateId(),
                         position: { ...updatedAgent.position },
                         type: 'HOUSE',
                         ownerId,
                         scale: 1,
                         radius: 2,
                         health: 100
                       });

                       updatedAgent.neuro.serotonin += 50;
                       updatedAgent.neuro.dopamine += 30;
                       audioManager.playBuild();
                       logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} built a HOUSE!`});
                       governance.cohesion = Math.min(100, governance.cohesion + 5);
                       updatedAgent.currentActionLabel = "Built my house!";
                   } else {
                       updatedAgent.currentActionLabel = `Building house... need: ${4-wood}W ${2-stone}S ${2-mud}M`;
                   }
               }
               else if (targetId === 'BUILD_CAMPFIRE' && updatedAgent.inventory['WOOD'] >= 2) {
                  const campfireX = updatedAgent.position.x + 2;
                  const campfireZ = updatedAgent.position.z;
                  const campfireY = getTerrainHeight(campfireX, campfireZ);
                  buildings.push({ id: generateId(), position: { x: campfireX, y: campfireY + 0.05, z: campfireZ }, type: 'CAMPFIRE', ownerId: updatedAgent.id, scale: 1, radius: 1, health: 50 });
                  updatedAgent.inventory['WOOD'] -= 2;
                  audioManager.playBuild();
                  logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} built a fire!`});
                  governance.cohesion = Math.min(100, governance.cohesion + 1);
              }
              else if (targetId === 'COOK_MEAT') {
                  const nearFire = buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, updatedAgent.position) < 4);
                  if ((updatedAgent.inventory['MEAT'] || 0) > 0 && nearFire) {
                      updatedAgent.inventory['MEAT'] -= 1;
                      updatedAgent.needs.hunger = Math.min(100, updatedAgent.needs.hunger + 35);
                      updatedAgent.currentActionLabel = "Cooked and ate meat";
                      logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} cooked meat over the fire.`});
                      recordActionMemory(updatedAgent, 'MEAT_COOKED', 'EAT', 25);
                  } else if (!nearFire) {
                      updatedAgent.currentActionLabel = "Need a fire to cook meat";
                  }
              }
              else if (targetId === 'FORAGE_SEEDS') {
                  updatedAgent.inventory['SEEDS'] = (updatedAgent.inventory['SEEDS'] || 0) + 1;
                  updatedAgent.currentActionLabel = "Found seeds";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} foraged seeds.`});
              }
              else if (targetId === 'PLANT_SEEDS') {
                  if ((updatedAgent.inventory['SEEDS'] || 0) > 0) {
                    updatedAgent.inventory['SEEDS'] -= 1;
                    const x = updatedAgent.position.x;
                    const z = updatedAgent.position.z;
                    const y = getTerrainHeight(x, z);
                    flora.push({
                      id: generateId(),
                      type: 'FARM_CROP',
                      position: { x, y, z },
                      scale: 0.8,
                      growthStage: 0,
                      growthTimer: 0,
                      regrowTicks: 400,
                      isEdible: true,
                      isPoisonous: false,
                      nutritionValue: 20,
                      resourceYield: undefined,
                      resourcesLeft: 1,
                      maxResources: 1,
                      radius: 0.6,
                      health: 100
                    });
                    updatedAgent.currentActionLabel = "Planted a crop";
                    recordActionMemory(updatedAgent, 'FARM_CROP', 'PLANT', 10);
                    logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} planted seeds.`});
                  } else {
                    updatedAgent.currentActionLabel = "No seeds to plant";
                  }
              }
              else if (targetId === 'DIG_TERRAIN') {
                  const size = 1 + Math.random() * 1.5;
                  const x = updatedAgent.position.x;
                  const z = updatedAgent.position.z;
                  const y = getTerrainHeight(x, z);
                  water.push({
                    id: `puddle_dig_${generateId()}`,
                    kind: 'PUDDLE',
                    position: { x, y: y + 0.02, z },
                    size,
                    length: size * 0.9,
                    ttl: 900
                  });
                  updatedAgent.needs.energy = Math.max(0, updatedAgent.needs.energy - 2);
                  updatedAgent.currentActionLabel = "Dug a small pit";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} dug into the ground.`});
              }
              else if (targetId === 'CRAFT_SPEAR' && updatedAgent.inventory['WOOD'] >= 1 && updatedAgent.inventory['STONE'] >= 1) {
                  updatedAgent.inventory['WOOD'] -= 1; updatedAgent.inventory['STONE'] -= 1;
                  updatedAgent.equippedTool = 'SPEAR';
                  updatedAgent.inventory['SPEAR'] = (updatedAgent.inventory['SPEAR'] || 0) + 1;
                  updatedAgent.currentActionLabel = "Crafted a spear";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} crafted a SPEAR.`});
              }
              else if (targetId === 'CRAFT_STONE_AXE' && updatedAgent.inventory['WOOD'] >= 1 && updatedAgent.inventory['STONE'] >= 2) {
                  updatedAgent.inventory['WOOD'] -= 1; updatedAgent.inventory['STONE'] -= 2;
                  updatedAgent.equippedTool = 'STONE_AXE';
                  updatedAgent.inventory['STONE_AXE'] = (updatedAgent.inventory['STONE_AXE'] || 0) + 1;
                  updatedAgent.currentActionLabel = "Crafted a stone axe";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} crafted a STONE AXE.`});
              }
              else if (targetId === 'CREATE_STORAGE') {
                  const crateId = generateId();
                  const toStore = ['WOOD', 'STONE', 'MUD', 'MEAT', 'SEEDS'];
                  const crateInventory: Record<string, number> = {};
                  toStore.forEach(k => {
                      if ((updatedAgent.inventory[k] || 0) > 0) {
                          crateInventory[k] = updatedAgent.inventory[k];
                          updatedAgent.inventory[k] = 0;
                      }
                  });
                  if (Object.keys(crateInventory).length > 0) {
                       buildings.push({ 
                           id: crateId, 
                           position: { ...updatedAgent.position, y: getTerrainHeight(updatedAgent.position.x, updatedAgent.position.z) + 0.05 }, 
                           type: 'CRATE', 
                           ownerId: updatedAgent.id, 
                           scale: 1, 
                           radius: 1, 
                           health: 100, 
                           inventory: crateInventory 
                       });
                       logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} created a resource pile.`});
                       audioManager.playBuild();
                  } else {
                      updatedAgent.currentActionLabel = "Nothing to store";
                  }
              }
              else if (buildings.some(b => b.id === targetId && b.type === 'CRATE')) {
                   const b = buildings.find(b => b.id === targetId && b.type === 'CRATE');
                   if (b) {
                        const toStore = ['WOOD', 'STONE', 'MUD', 'MEAT', 'SEEDS'];
                        let storedAny = false;
                        toStore.forEach(k => {
                            if ((updatedAgent.inventory[k] || 0) > 0) {
                                b.inventory = b.inventory || {};
                                b.inventory[k] = (b.inventory[k] || 0) + updatedAgent.inventory[k];
                                updatedAgent.inventory[k] = 0;
                                storedAny = true;
                            }
                        });
                        if (storedAny) {
                            logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} added to resource pile.`});
                            updatedAgent.currentActionLabel = "Stored resources";
                            audioManager.playBuild();
                        }
                   }
              }
              else if (targetId === 'WATER_SOURCE') {
                  updatedAgent.needs.thirst = Math.min(100, updatedAgent.needs.thirst + 40);
                  updatedAgent.currentActionLabel = "Drinking water";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} drank fresh water.`});
              }
              else if (targetId === 'WATER_CROP') {
                  const nearbyCrops = flora.filter(f => f.type === 'FARM_CROP' && dist(f.position, updatedAgent.position) < 3);
                  nearbyCrops.forEach(c => {
                    (c as any).lastWateredTick = nextTime;
                  });
                  updatedAgent.currentActionLabel = "Watered crops";
                  logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} watered crops.`});
              }
          };

          // Handle Movement Completion (walking or fleeing)
          if ((updatedAgent.state === AgentState.MOVING || updatedAgent.state === AgentState.FLEEING) && updatedAgent.targetPosition) {
            const dx = updatedAgent.targetPosition.x - updatedAgent.position.x;
            const dz = updatedAgent.targetPosition.z - updatedAgent.position.z;
            const d = Math.sqrt(dx*dx + dz*dz);
            const speed = updatedAgent.state === AgentState.FLEEING ? 0.15 : 0.08;
            
            // Increased arrival threshold to avoid collision lock
            if (d > 0.8) {
                updatedAgent.rotation = Math.atan2(dx, dz);
                updatedAgent.position.x += Math.sin(updatedAgent.rotation) * speed;
                updatedAgent.position.z += Math.cos(updatedAgent.rotation) * speed;
                // Update Y position based on terrain height
                updatedAgent.position.y = getTerrainHeight(updatedAgent.position.x, updatedAgent.position.z);
                if (nextTime % 12 === 0) audioManager.playStep();
            } else {
                // Arrived
                if (updatedAgent.targetId) {
                   performInteraction(updatedAgent.targetId);
                }
                updatedAgent.state = AgentState.IDLE;
                updatedAgent.targetPosition = null;
            }
          }
          // Handle Instant Work
          else if (updatedAgent.state === AgentState.WORKING && updatedAgent.targetId) {
             performInteraction(updatedAgent.targetId);
             updatedAgent.state = AgentState.IDLE;
             updatedAgent.targetPosition = null;
          }

          // Check if target still exists (prevent stuck state)
          if (updatedAgent.targetId && !updatedAgent.targetId.startsWith('BUILD_') && !['COOK_MEAT','DIG_TERRAIN'].includes(updatedAgent.targetId)) {
               const exists = flora.some(f => f.id === updatedAgent.targetId && (f.resourcesLeft || 0) > 0)
                 || activeFauna.some(f => f.id === updatedAgent.targetId)
                 || updatedAgent.targetId === 'WATER_SOURCE';
               if (!exists) {
                   updatedAgent.state = AgentState.IDLE;
                   updatedAgent.targetPosition = null;
                   updatedAgent.targetId = undefined;
                   updatedAgent.currentActionLabel = "Target lost...";
               }
          }

          // SOCIAL INTERACTION - Two-way conversation
          if (updatedAgent.state === AgentState.SOCIALIZING && updatedAgent.targetId) {
             const partner = activeAgents.find(a => a.id === updatedAgent.targetId);
             if (partner) {
               const d = dist(updatedAgent.position, partner.position);
               // Face each other
               updatedAgent.rotation = Math.atan2(partner.position.x - updatedAgent.position.x, partner.position.z - updatedAgent.position.z);

               // If close enough, trigger response from partner
               if (d < 3) {
                  if (!updatedAgent.chatBubble) {
                    updatedAgent.chatBubble = CHAT_TEMPLATES.GREETING[Math.floor(Math.random() * CHAT_TEMPLATES.GREETING.length)];
                    updatedAgent.lastChatTime = nextTime;
                  }
                  if (partner.state === AgentState.IDLE || partner.state === AgentState.SOCIALIZING) {
                    const responses = [...CHAT_TEMPLATES.FRIENDLY, ...CHAT_TEMPLATES.GOSSIP];
                    partner.chatBubble = responses[Math.floor(Math.random() * responses.length)];
                    partner.lastChatTime = nextTime;
                    partner.state = AgentState.SOCIALIZING;
                    partner.targetId = updatedAgent.id;
                    partner.rotation = Math.atan2(updatedAgent.position.x - partner.position.x, updatedAgent.position.z - partner.position.z);
                    // Boost social needs for both
                    updatedAgent.needs.social = Math.min(100, updatedAgent.needs.social + 12);
                    partner.needs.social = Math.min(100, partner.needs.social + 12);
                    governance.cohesion = Math.min(100, governance.cohesion + 0.5);
                    logs.push({id: generateId(), timestamp: nextTime, type: 'DIALOGUE', message: `${updatedAgent.name} and ${partner.name} are chatting`});

                    // Mating chance
                    if (Math.random() < 0.02 && !updatedAgent.caringEggId && !partner.caringEggId) {
                      const eggId = generateId();
                      const eggPos = {
                        x: (updatedAgent.position.x + partner.position.x) / 2,
                        y: getTerrainHeight((updatedAgent.position.x + partner.position.x)/2, (updatedAgent.position.z + partner.position.z)/2),
                        z: (updatedAgent.position.z + partner.position.z) / 2
                      };
                      eggs.push({
                        id: eggId,
                        position: eggPos,
                        hatchAt: nextTime + 400,
                        parents: [
                          { id: updatedAgent.id, color: updatedAgent.color, hairColor: updatedAgent.hairColor, clothesColor: updatedAgent.clothesColor },
                          { id: partner.id, color: partner.color, hairColor: partner.hairColor, clothesColor: partner.clothesColor }
                        ]
                      });
                      updatedAgent.caringEggId = eggId;
                      partner.caringEggId = eggId;
                      updatedAgent.currentActionLabel = "Protecting egg";
                      partner.currentActionLabel = "Protecting egg";
                      logs.push({ id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} and ${partner.name} created an egg.` });
                    }
                  }
                }

               // Disease spread
               if (partner.sickness && partner.sickness !== 'NONE' && updatedAgent.sickness === 'NONE' && Math.random() < 0.05) {
                 updatedAgent.sickness = 'COLD';
                 updatedAgent.sicknessDuration = 500;
                 logs.push({id: generateId(), timestamp: nextTime, type: 'DANGER', message: `${updatedAgent.name} caught a cold from ${partner.name}!`});
               }
             }
          }

          updatedAgent.position = resolveCollisions(updatedAgent, activeAgents, buildings, flora);
          // Subconscious feelings driven by neuro chemistry
          const felt = deriveFeelings(updatedAgent);
          updatedAgent.feelings = felt.feelings;
          updatedAgent.mood = felt.mood;
          deriveFeelingsAI(updatedAgent).then(aiFelt => {
            if (aiFelt) {
              setGameState(g => ({
                ...g,
                agents: g.agents.map(a =>
                  a.id === agent.id ? { ...a, feelings: aiFelt.feelings, mood: aiFelt.mood } : a
                )
              }));
            }
          }).catch(() => {});
          if (updatedAgent.chatBubble && updatedAgent.lastChatTime && (nextTime - updatedAgent.lastChatTime > 100)) updatedAgent.chatBubble = undefined;
          
          // STAT DECAY & DISEASE
          if (updatedAgent.state !== AgentState.SLEEPING) {
             updatedAgent.needs.energy -= 0.02; updatedAgent.needs.hunger -= 0.03; updatedAgent.needs.thirst -= 0.05; updatedAgent.needs.social -= 0.02;
             let tempChange = isNight ? -0.1 : 0.2;
             tempChange += SEASON_PROPERTIES[nextSeason].tempMod * 0.01;
             // Weather affects temperature
             if (nextWeather === 'RAIN' || nextWeather === 'STORM') tempChange -= 0.15;
             if (nextWeather === 'SNOW') tempChange -= 0.25;
             const nearFire = buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, updatedAgent.position) < 5);
             if (nearFire) tempChange += 0.5;
             if (updatedAgent.sickness !== 'NONE') updatedAgent.needs.energy -= 0.05;
             updatedAgent.needs.temperature = Math.min(100, Math.max(0, updatedAgent.needs.temperature + tempChange));
             // Hydrate if raining or near water
             const nearWater = water.some(w => dist(w.position, updatedAgent.position) < (w.kind === 'PUDDLE' ? 2.5 : 3.5));
             if (isRaining || nearWater) {
               updatedAgent.needs.thirst = Math.min(100, updatedAgent.needs.thirst + (nearWater ? 1.5 : 0.5));
             }
             if (updatedAgent.needs.thirst < 15) {
               updatedAgent.needs.health = Math.max(0, updatedAgent.needs.health - 0.05);
             }
             updatedAgent.needs.thirst = Math.max(0, updatedAgent.needs.thirst);
          }
          
          return updatedAgent;
        });

        // Eggs hatching
        const newAgents: Agent[] = [];
        eggs = eggs.filter(e => {
          if (nextTime >= e.hatchAt) {
            const parentA = e.parents[0];
            const parentB = e.parents[1];
            const babyColor = mixColor(parentA.color, parentB.color);
            const babyHair = mixColor(parentA.hairColor, parentB.hairColor);
            const babyClothes = mixColor(parentA.clothesColor, parentB.clothesColor);
            newAgents.push({
              id: generateId(),
              name: `Hatchling_${generateId().slice(0,4)}`,
              color: babyClothes,
              hairColor: babyHair,
              clothesColor: babyClothes,
              ageDays: 0,
              sex: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
              position: { ...e.position, y: getTerrainHeight(e.position.x, e.position.z) },
              rotation: 0,
              targetPosition: null,
              state: AgentState.IDLE,
              needs: { hunger: 80, thirst: 80, energy: 80, social: 50, fun: 50, health: 100, temperature: 70 },
              neuro: { dopamine: 60, serotonin: 60, adrenaline: 10, oxytocin: 50, cortisol: 20 },
              actionMemories: [],
              personality: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5, bio: "A newborn." },
              memories: [],
              relationships: {},
              inventory: {},
              currentActionLabel: "Just hatched",
              aiThoughts: [],
              aiConversations: [],
              velocity: { x:0, y:0, z:0 },
              radius: 0.5,
              feelings: [],
              mood: 'neutral'
            });
            return false;
          }
          return true;
        });
        activeAgents = nextAgents;
        if (newAgents.length) {
          activeAgents = activeAgents.concat(newAgents);
        }

        // Barter trades between socializing pairs
        const tradedPairs = new Set<string>();
        activeAgents.forEach(agent => {
          if (agent.state !== AgentState.SOCIALIZING || !agent.targetId) return;
          const partner = activeAgents.find(a => a.id === agent.targetId);
          if (!partner || partner.state !== AgentState.SOCIALIZING || partner.targetId !== agent.id) return;
          if (dist(agent.position, partner.position) > 3) return;
          const key = [agent.id, partner.id].sort().join('_');
          if (tradedPairs.has(key)) return;
          const trade = pickTrade(agent, partner, buildings);
          if (trade) {
            agent.inventory[trade.giveA] = Math.max(0, (agent.inventory[trade.giveA] || 0) - 1);
            partner.inventory[trade.giveA] = (partner.inventory[trade.giveA] || 0) + 1;
            partner.inventory[trade.giveB] = Math.max(0, (partner.inventory[trade.giveB] || 0) - 1);
            agent.inventory[trade.giveB] = (agent.inventory[trade.giveB] || 0) + 1;
            agent.currentActionLabel = `Traded ${trade.giveA} for ${trade.giveB}`;
            partner.currentActionLabel = `Traded ${trade.giveB} for ${trade.giveA}`;
            agent.relationships = { ...agent.relationships, [partner.id]: (agent.relationships[partner.id] || 0) + 2 };
            partner.relationships = { ...partner.relationships, [agent.id]: (partner.relationships[agent.id] || 0) + 2 };
            logs.push({ id: generateId(), timestamp: nextTime, type: 'DIALOGUE', message: `${agent.name} traded ${trade.giveA} with ${partner.name} for ${trade.giveB}` });
            tradedPairs.add(key);
          }
        });

        // Crop growth/regrowth
        const rainingNow = nextWeather === 'RAIN' || nextWeather === 'STORM';
        flora = flora.map(f => {
          if (f.type === 'FARM_CROP') {
            const regrow = f.regrowTicks ?? 400;
            const nextTimer = (f.growthTimer || 0) + (rainingNow ? 2 : 0);
            let growthStage = f.growthStage || 0;
            // Crops only advance if watered or rained on
            const canGrow = rainingNow || (f as any).lastWateredTick >= (nextTime - 80);
            const timerProgress = canGrow ? nextTimer : (f.growthTimer || 0);
            if (growthStage < 2 && timerProgress >= regrow) growthStage = 2;
            else if (growthStage < 1 && timerProgress >= regrow * 0.5) growthStage = 1;
            const harvestable = growthStage >= 2;
            const resourcesLeft = harvestable ? 1 : f.resourcesLeft || 0;
            return { ...f, growthTimer: timerProgress, growthStage, resourcesLeft };
          }
          return f;
        }).filter(f => !f.isOnFire && ((f.resourcesLeft || 0) > 0 || f.type === 'FARM_CROP'));

        return { ...prev, time: nextTime, dayTime: nextDayTime, day: nextDay, season: nextSeason, weather: nextWeather, agents: activeAgents, fauna: nextFauna, flora, buildings, water, eggs, governance, logs: logs.slice(-50) };
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen relative overflow-hidden" onClick={() => audioManager.playStep()}>
      <World3D
        agents={gameState.agents.map(a => ({ ...a, position: { ...a.position, y: getTerrainHeight(a.position.x, a.position.z) } }))}
        buildings={gameState.buildings}
        flora={gameState.flora}
        fauna={gameState.fauna}
        water={gameState.water}
        places={gameState.places}
        onSelectAgent={(id) => setGameState(prev => ({ ...prev, selectedAgentId: id }))}
        selectedAgentId={gameState.selectedAgentId}
        dayTime={gameState.dayTime}
        season={gameState.season}
        weather={gameState.weather}
      />
      <UIOverlay gameState={gameState} onTogglePause={() => setGameState(prev => ({ ...prev, paused: !prev.paused }))} selectedAgent={gameState.agents.find(a => a.id === gameState.selectedAgentId)} />
    </div>
  );
}
export default App;
