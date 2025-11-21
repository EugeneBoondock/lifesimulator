
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, DAY_LENGTH_TICKS, WORLD_SIZE, getTerrainHeight, SEASON_LENGTH_DAYS, SEASON_PROPERTIES, INITIAL_WATER } from './constants';
import { GameState, Agent, AgentState, Building, Flora, Fauna, Season, Weather, WaterPatch } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { updateAgentBehavior, learnActionOutcome } from './services/neuroEngine';
import { getAIDecision, applyAIDecision } from './services/aiMindEngine';
import { audioManager } from './services/audioService';
import { initDB, loadAllAgents, saveAllAgents } from './services/memoryStorage';

const generateId = () => Math.random().toString(36).substr(2, 9);
const dist = (p1: {x:number, z:number}, p2: {x:number, z:number}) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));

function App() {
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    flora: INITIAL_FLORA,
    fauna: INITIAL_FAUNA,
    water: INITIAL_WATER,
    knowledge: {},
    time: 0,
    dayTime: 12, 
    day: 1,
    season: 'SPRING',
    weather: 'CLEAR',
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'Neuro-Chemical Engine Initiated.' }],
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
        
        if (Math.floor(rawDayTime) > Math.floor(prev.dayTime) && Math.floor(rawDayTime) % 24 === 0) {
            nextDay = prev.day + 1;
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
        const nextAgents = activeAgents.map(agent => {
          let updatedAgent = { ...agent };
          
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

          // Only use neuroEngine fallback if agent is IDLE (AI not controlling)
          if (updatedAgent.state === AgentState.IDLE) {
            const behaviorUpdates = updateAgentBehavior(updatedAgent, { ...prev, season: nextSeason, agents: activeAgents, buildings, flora, fauna: nextFauna });
            if (behaviorUpdates.chatBubble && behaviorUpdates.lastChatTime !== agent.lastChatTime) audioManager.playChat();
            updatedAgent = { ...updatedAgent, ...behaviorUpdates };
          }

          // AI Mind: Core decision engine via Ollama (cooldown handled in aiMindEngine)
          // Try AI for any idle agent
          getAIDecision(updatedAgent, { ...prev, season: nextSeason, agents: activeAgents, buildings, flora, fauna: nextFauna })
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
                      // Store conversation if dialogue exists
                      if (decision.dialogue) {
                        const targetName = aiUpdate.targetId
                          ? g.agents.find(t => t.id === aiUpdate.targetId)?.name || 'someone'
                          : 'self';
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
                       if ((f.resourcesLeft||0) > 0) {
                           updatedAgent.inventory[f.resourceYield] = (updatedAgent.inventory[f.resourceYield]||0) + 1;
                           f.resourcesLeft = (f.resourcesLeft||0) - 1;
                           logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} gathered ${f.resourceYield}`});
                           audioManager.playBuild();
                       }
                   } else {
                       updatedAgent.needs.hunger = Math.min(100, updatedAgent.needs.hunger + 20);
                       f.resourcesLeft = 0; 
                       updatedAgent = learnActionOutcome(updatedAgent, f.type, 'EAT', 50);
                       logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} ate ${f.type}`});
                   }
               }
               else if (tFaunaIdx !== -1) {
                   const animal = activeFauna[tFaunaIdx];
                   if (!animal.isAggressive && !animal.isTamed) {
                       animal.isTamed = true;
                       animal.ownerId = updatedAgent.id;
                       updatedAgent.neuro.dopamine += 30;
                       updatedAgent.neuro.oxytocin += 20;
                       logs.push({id: generateId(), timestamp: nextTime, type: 'AGENT', message: `${updatedAgent.name} tamed a ${animal.type}!`});
                   }
               }
               else if (targetId === 'BUILD_HOUSE_SITE') {
                   if (updatedAgent.inventory['WOOD']>=4 && updatedAgent.inventory['STONE']>=2 && updatedAgent.inventory['MUD']>=2) {
                       buildings.push({ id: generateId(), position: { ...updatedAgent.position }, type: 'HOUSE', ownerId: updatedAgent.id, scale: 1, radius: 2, health: 100 });
                       updatedAgent.inventory['WOOD']-=4; updatedAgent.inventory['STONE']-=2; updatedAgent.inventory['MUD']-=2;
                       updatedAgent.neuro.serotonin += 50;
                       audioManager.playBuild();
                       logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} constructed a HOUSE!`});
                   }
               }
               else if (targetId === 'BUILD_CAMPFIRE' && updatedAgent.inventory['WOOD'] >= 2) {
                   buildings.push({ id: generateId(), position: { x: updatedAgent.position.x + 2, y: 0, z: updatedAgent.position.z }, type: 'CAMPFIRE', ownerId: updatedAgent.id, scale: 1, radius: 1, health: 50 });
                   updatedAgent.inventory['WOOD'] -= 2;
                   audioManager.playBuild();
                   logs.push({id: generateId(), timestamp: nextTime, type: 'SYSTEM', message: `${updatedAgent.name} built a fire!`});
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
          if (updatedAgent.targetId && !updatedAgent.targetId.startsWith('BUILD_')) {
               const exists = flora.some(f => f.id === updatedAgent.targetId && (f.resourcesLeft || 0) > 0) || activeFauna.some(f => f.id === updatedAgent.targetId);
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
               if (d < 3 && updatedAgent.chatBubble && partner.state === AgentState.IDLE) {
                 // Partner responds
                 const responses = ["Hello!", "Nice to see you!", "How are you?", "Interesting...", "I agree!", "Let's work together!"];
                 partner.chatBubble = responses[Math.floor(Math.random() * responses.length)];
                 partner.lastChatTime = nextTime;
                 partner.state = AgentState.SOCIALIZING;
                 partner.targetId = updatedAgent.id;
                 partner.rotation = Math.atan2(updatedAgent.position.x - partner.position.x, updatedAgent.position.z - partner.position.z);
                 // Boost social needs for both
                 updatedAgent.needs.social = Math.min(100, updatedAgent.needs.social + 10);
                 partner.needs.social = Math.min(100, partner.needs.social + 10);
                 logs.push({id: generateId(), timestamp: nextTime, type: 'DIALOGUE', message: `${updatedAgent.name} and ${partner.name} are chatting`});
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
          if (updatedAgent.chatBubble && updatedAgent.lastChatTime && (nextTime - updatedAgent.lastChatTime > 100)) updatedAgent.chatBubble = undefined;
          
          // STAT DECAY & DISEASE
          if (updatedAgent.state !== AgentState.SLEEPING) {
             updatedAgent.needs.energy -= 0.02; updatedAgent.needs.hunger -= 0.03; updatedAgent.needs.social -= 0.02;
             let tempChange = isNight ? -0.1 : 0.2;
             tempChange += SEASON_PROPERTIES[nextSeason].tempMod * 0.01;
             // Weather affects temperature
             if (nextWeather === 'RAIN' || nextWeather === 'STORM') tempChange -= 0.15;
             if (nextWeather === 'SNOW') tempChange -= 0.25;
             const nearFire = buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, updatedAgent.position) < 5);
             if (nearFire) tempChange += 0.5;
             if (updatedAgent.sickness !== 'NONE') updatedAgent.needs.energy -= 0.05;
             updatedAgent.needs.temperature = Math.min(100, Math.max(0, updatedAgent.needs.temperature + tempChange));
          }
          
          return updatedAgent;
        });

        // Filter out depleted flora
        flora = flora.filter(f => !f.isOnFire && (f.resourcesLeft || 0) > 0);

        return { ...prev, time: nextTime, dayTime: nextDayTime, day: nextDay, season: nextSeason, weather: nextWeather, agents: nextAgents, fauna: nextFauna, flora, buildings, water, logs: logs.slice(-50) };
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen relative overflow-hidden" onClick={() => audioManager.playStep()}>
      <World3D
        agents={gameState.agents} buildings={gameState.buildings} flora={gameState.flora} fauna={gameState.fauna} water={gameState.water}
        onSelectAgent={(id) => setGameState(prev => ({ ...prev, selectedAgentId: id }))}
        selectedAgentId={gameState.selectedAgentId} dayTime={gameState.dayTime}
        season={gameState.season} weather={gameState.weather}
      />
      <UIOverlay gameState={gameState} onTogglePause={() => setGameState(prev => ({ ...prev, paused: !prev.paused }))} selectedAgent={gameState.agents.find(a => a.id === gameState.selectedAgentId)} />
    </div>
  );
}
export default App;
