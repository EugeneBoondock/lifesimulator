
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, DAY_LENGTH_TICKS, WORLD_SIZE, getTerrainHeight, SEASON_LENGTH_DAYS, SEASON_PROPERTIES } from './constants';
import { GameState, Agent, AgentState, Building, Flora, Fauna, Season } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { updateAgentBehavior, learnActionOutcome } from './services/neuroEngine';
import { audioManager } from './services/audioService';

const generateId = () => Math.random().toString(36).substr(2, 9);
const dist = (p1: {x:number, z:number}, p2: {x:number, z:number}) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));

function App() {
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    flora: INITIAL_FLORA,
    fauna: INITIAL_FAUNA,
    knowledge: {},
    time: 0,
    dayTime: 12, 
    day: 1,
    season: 'SPRING',
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'Neuro-Chemical Engine Initiated.' }],
    paused: false,
    selectedAgentId: null
  });

  const stateRef = useRef<GameState>(gameState);
  
  // Stuck detection refs
  const agentPosHistory = useRef<Record<string, {x:number, z:number, ticks:number}>>({});

  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // --- PHYSICS ---
  const resolveCollisions = (agent: Agent, agents: Agent[], buildings: Building[], flora: Flora[]) => {
      let pos = { ...agent.position };
      const obstacles = [
        ...agents.filter(a => a.id !== agent.id).map(a => ({ pos: a.position, r: a.radius + agent.radius })),
        ...buildings.map(b => ({ pos: b.position, r: b.radius + agent.radius })),
        ...flora.filter(f => f.resourceYield || !f.isEdible).map(f => ({ pos: f.position, r: f.radius + agent.radius }))
      ];
      obstacles.forEach(obs => {
          const dx = pos.x - obs.pos.x;
          const dz = pos.z - obs.pos.z;
          const d = Math.sqrt(dx*dx + dz*dz);
          if (d < obs.r && d > 0) {
              const f = (obs.r - d) / d;
              pos.x += dx * f * 0.5; pos.z += dz * f * 0.5;
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

        let buildings = [...prev.buildings];
        let flora = [...prev.flora];
        let activeAgents = [...prev.agents];
        let activeFauna = [...prev.fauna];
        let faunaToRemove: string[] = [];

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
               else { nextAnimal.position.x = nextX; nextAnimal.position.z = nextZ; }
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

          const behaviorUpdates = updateAgentBehavior(updatedAgent, { ...prev, season: nextSeason, agents: activeAgents, buildings, flora, fauna: nextFauna });
          
          if (behaviorUpdates.chatBubble && behaviorUpdates.lastChatTime !== agent.lastChatTime) audioManager.playChat();
          updatedAgent = { ...updatedAgent, ...behaviorUpdates };

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

          // Handle Movement Completion
          if (updatedAgent.state === AgentState.MOVING && updatedAgent.targetPosition) {
            const dx = updatedAgent.targetPosition.x - updatedAgent.position.x;
            const dz = updatedAgent.targetPosition.z - updatedAgent.position.z;
            const d = Math.sqrt(dx*dx + dz*dz);
            const speed = updatedAgent.state === AgentState.FLEEING ? 0.15 : 0.08;
            
            // Increased arrival threshold to avoid collision lock
            if (d > 0.8) { 
                updatedAgent.rotation = Math.atan2(dx, dz);
                updatedAgent.position.x += Math.sin(updatedAgent.rotation) * speed;
                updatedAgent.position.z += Math.cos(updatedAgent.rotation) * speed;
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

          // SOCIAL ROTATION
          if (updatedAgent.state === AgentState.SOCIALIZING && updatedAgent.targetId) {
             const p = activeAgents.find(a => a.id === updatedAgent.targetId);
             if (p) updatedAgent.rotation = Math.atan2(p.position.x - updatedAgent.position.x, p.position.z - updatedAgent.position.z);
             if (p && p.sickness && p.sickness !== 'NONE' && updatedAgent.sickness === 'NONE' && Math.random() < 0.05) {
                 updatedAgent.sickness = 'COLD';
                 updatedAgent.sicknessDuration = 500;
                 logs.push({id: generateId(), timestamp: nextTime, type: 'DANGER', message: `${updatedAgent.name} caught a cold from ${p.name}!`});
             }
          }

          updatedAgent.position = resolveCollisions(updatedAgent, activeAgents, buildings, flora);
          if (updatedAgent.chatBubble && updatedAgent.lastChatTime && (nextTime - updatedAgent.lastChatTime > 100)) updatedAgent.chatBubble = undefined;
          
          // STAT DECAY & DISEASE
          if (updatedAgent.state !== AgentState.SLEEPING) {
             updatedAgent.needs.energy -= 0.02; updatedAgent.needs.hunger -= 0.03; updatedAgent.needs.social -= 0.02;
             let tempChange = isNight ? -0.1 : 0.2;
             tempChange += SEASON_PROPERTIES[nextSeason].tempMod * 0.01;
             const nearFire = buildings.some(b => b.type === 'CAMPFIRE' && dist(b.position, updatedAgent.position) < 5);
             if (nearFire) tempChange += 0.5;
             if (updatedAgent.sickness !== 'NONE') updatedAgent.needs.energy -= 0.05;
             updatedAgent.needs.temperature = Math.min(100, Math.max(0, updatedAgent.needs.temperature + tempChange));
          }
          
          return updatedAgent;
        });

        // Filter out depleted flora
        flora = flora.filter(f => !f.isOnFire && (f.resourcesLeft || 0) > 0);

        return { ...prev, time: nextTime, dayTime: nextDayTime, day: nextDay, season: nextSeason, agents: nextAgents, fauna: nextFauna, flora, buildings, logs: logs.slice(-50) };
      });
    }, 125);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen relative overflow-hidden" onClick={() => audioManager.playStep()}>
      <World3D 
        agents={gameState.agents} buildings={gameState.buildings} flora={gameState.flora} fauna={gameState.fauna}
        onSelectAgent={(id) => setGameState(prev => ({ ...prev, selectedAgentId: id }))}
        selectedAgentId={gameState.selectedAgentId} dayTime={gameState.dayTime}
        season={gameState.season}
      />
      <UIOverlay gameState={gameState} onTogglePause={() => setGameState(prev => ({ ...prev, paused: !prev.paused }))} selectedAgent={gameState.agents.find(a => a.id === gameState.selectedAgentId)} />
    </div>
  );
}
export default App;
