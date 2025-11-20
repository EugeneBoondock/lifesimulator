
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { INITIAL_AGENTS, INITIAL_FLORA, INITIAL_FAUNA, TICK_RATE_MS, DAY_LENGTH_TICKS, WORLD_SIZE } from './constants';
import { GameState, Agent, AgentState, AgentDecision, Building, Flora, Fauna } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { decideAgentAction } from './services/geminiService';
import { audioManager } from './services/audioService';

// Safe ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  // ---------------- STATE ----------------
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    flora: INITIAL_FLORA,
    fauna: INITIAL_FAUNA,
    knowledge: {},
    time: 0,
    dayTime: 12, 
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'Civilization started. Explore the unknown.' }],
    paused: false,
    selectedAgentId: null
  });

  const stateRef = useRef<GameState>(gameState);
  const processingAgents = useRef<Set<string>>(new Set()); 

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // ---------------- AGENT AI LOGIC ----------------
  const processAgentAI = useCallback(async (agentId: string) => {
    if (processingAgents.current.has(agentId)) return;
    processingAgents.current.add(agentId);

    const currentAgent = stateRef.current.agents.find(a => a.id === agentId);
    if (!currentAgent) {
      processingAgents.current.delete(agentId);
      return;
    }

    setGameState(prev => ({
      ...prev,
      agents: prev.agents.map(a => a.id === agentId ? { ...a, state: AgentState.THINKING } : a)
    }));

    // 1. GET AI DECISION
    const decision: AgentDecision = await decideAgentAction(currentAgent, stateRef.current);

    // 2. APPLY DECISION LOGIC
    setGameState(prev => {
      const logs = [...prev.logs];
      let agents = [...prev.agents];
      const buildings = [...prev.buildings];
      let flora = [...prev.flora];
      let knowledge = { ...prev.knowledge };
      
      const myIndex = agents.findIndex(a => a.id === agentId);
      if (myIndex === -1) return prev;

      let me = { ...agents[myIndex] };
      let newState = AgentState.IDLE;
      let newTarget = null;
      let chatBubble = undefined;
      
      // --- LOGIC HANDLERS ---

      if (decision.action === 'MOVE' && decision.targetLocation) {
        newState = AgentState.MOVING;
        newTarget = { 
          x: Math.max(-WORLD_SIZE/2 + 1, Math.min(WORLD_SIZE/2 - 1, decision.targetLocation.x)), 
          y: 0, 
          z: Math.max(-WORLD_SIZE/2 + 1, Math.min(WORLD_SIZE/2 - 1, decision.targetLocation.z)) 
        };
      } 
      else if (decision.action === 'INSPECT' && decision.targetId) {
        const targetFlora = flora.find(f => f.id === decision.targetId);
        if (targetFlora) {
           newState = AgentState.WORKING;
           const known = knowledge[targetFlora.type];
           
           if (!known && decision.namingProposal) {
              // DISCOVERY!
              knowledge[targetFlora.type] = {
                customName: decision.namingProposal,
                discoveredBy: me.name,
                description: "A new discovery."
              };
              logs.push({
                id: generateId(),
                timestamp: prev.time,
                type: 'DISCOVERY',
                message: `${me.name} discovered ${targetFlora.type} and named it "${decision.namingProposal}"!`
              });
              chatBubble = `I name this... ${decision.namingProposal}!`;
           } else if (known) {
              chatBubble = `Ah, ${known.customName}.`;
           }
        }
      }
      else if (decision.action === 'HARVEST' && decision.targetId) {
        const targetFloraIndex = flora.findIndex(f => f.id === decision.targetId);
        if (targetFloraIndex !== -1) {
          const target = flora[targetFloraIndex];
          const dist = Math.sqrt(Math.pow(target.position.x - me.position.x, 2) + Math.pow(target.position.z - me.position.z, 2));
          
          if (dist < 3.0) {
            // HARVEST SUCCESS
            newState = AgentState.WORKING;
            audioManager.playBuild(); // Crunch sound reuse
            
            if (target.isPoisonous) {
               me.needs.health = Math.max(0, me.needs.health - 30);
               me.needs.hunger = Math.min(100, me.needs.hunger + 5); // Still fills belly
               logs.push({ id: generateId(), timestamp: prev.time, type: 'AGENT', message: `${me.name} ate poison!` });
               chatBubble = "Ugh... stomach hurts...";
            } else if (target.isEdible) {
               me.needs.hunger = Math.min(100, me.needs.hunger + target.nutritionValue);
               me.needs.health = Math.min(100, me.needs.health + 5);
               chatBubble = "Yummy!";
            } else {
               chatBubble = "Inedible.";
            }
            
            // Remove plant (or set it to regrow later - strictly remove for now to keep simple)
            flora.splice(targetFloraIndex, 1);
          } else {
             // Move to it
             newState = AgentState.MOVING;
             newTarget = target.position;
             chatBubble = "Going to harvest...";
          }
        }
      }
      else if (decision.action === 'TALK' && decision.targetId) {
         // (Existing Talk Logic simplified for brevity in this update)
         const target = agents.find(a => a.id === decision.targetId);
         if (target) {
            newState = AgentState.SOCIALIZING;
            chatBubble = decision.dialogue;
            audioManager.playChat(1.0);
            logs.push({ id: generateId(), timestamp: prev.time, type: 'DIALOGUE', message: `"${decision.dialogue}"` });
            me.relationships[target.id] = (me.relationships[target.id] || 50) + 2;
            me.needs.social += 10;
         }
      }
      else if (decision.action === 'BUILD') {
         newState = AgentState.WORKING;
         const type = 'HOUSE';
         buildings.push({
            id: generateId(),
            position: { x: me.position.x + Math.sin(me.rotation)*2, y: 0, z: me.position.z + Math.cos(me.rotation)*2 },
            ownerId: me.id,
            type: type,
            scale: 1
         });
         audioManager.playBuild();
         logs.push({ id: generateId(), timestamp: prev.time, type: 'SYSTEM', message: `${me.name} built a House.` });
      }
      else if (decision.action === 'SLEEP') newState = AgentState.SLEEPING;
      
      me.state = newState;
      me.targetPosition = newTarget;
      if(chatBubble) me.chatBubble = chatBubble;
      me.currentActionLabel = decision.thoughtProcess;

      agents[myIndex] = me;

      return {
        ...prev,
        logs: logs.slice(-50),
        agents,
        buildings,
        flora,
        knowledge
      };
    });

    processingAgents.current.delete(agentId);
  }, []);


  // ---------------- GAME LOOP ----------------
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateRef.current.paused) return;

      setGameState(prev => {
        const nextTime = prev.time + 1;
        const nextDayTime = (prev.dayTime + (24 / DAY_LENGTH_TICKS)) % 24;
        
        // Update Fauna (Random Movement)
        const nextFauna = prev.fauna.map(animal => {
           if (Math.random() < 0.02) {
              // Pick random destination
              return { 
                 ...animal, 
                 state: 'MOVING', 
                 targetPosition: { 
                    x: (Math.random() - 0.5) * WORLD_SIZE, 
                    y: 0, 
                    z: (Math.random() - 0.5) * WORLD_SIZE 
                 } 
              } as Fauna;
           }
           
           if (animal.state === 'MOVING' && animal.targetPosition) {
              const dx = animal.targetPosition.x - animal.position.x;
              const dz = animal.targetPosition.z - animal.position.z;
              const dist = Math.sqrt(dx*dx + dz*dz);
              const speed = 0.05;
              
              if (dist < 0.1) return { ...animal, state: 'IDLE', targetPosition: null } as Fauna;
              
              const rot = Math.atan2(dx, dz);
              return {
                 ...animal,
                 position: { x: animal.position.x + Math.sin(rot)*speed, y: 0, z: animal.position.z + Math.cos(rot)*speed },
                 rotation: rot
              } as Fauna;
           }
           return animal;
        });

        // Update Agents
        const nextAgents = prev.agents.map(agent => {
          let { position, targetPosition, needs, state, rotation } = agent;
          let newNeeds = { ...needs };

          if (state === AgentState.MOVING && targetPosition) {
            const dx = targetPosition.x - position.x;
            const dz = targetPosition.z - position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            const speed = 0.10; 
            const targetRotation = Math.atan2(dx, dz);
            rotation = targetRotation;

            if (dist < speed) {
              position = targetPosition;
              targetPosition = null;
              state = AgentState.IDLE; 
            } else {
              position = { x: position.x + Math.sin(rotation) * speed, y: 0, z: position.z + Math.cos(rotation) * speed };
              if (nextTime % 8 === 0) audioManager.playStep();
            }
          }

          // Stats decay
          if (state === AgentState.WORKING) { newNeeds.energy -= 0.05; newNeeds.hunger -= 0.05; }
          else if (state === AgentState.SLEEPING) { newNeeds.energy += 0.5; }
          else { newNeeds.energy -= 0.01; newNeeds.hunger -= 0.02; newNeeds.social -= 0.02; }
          
          // Health Regen/Decay
          if (newNeeds.hunger === 0) newNeeds.health -= 0.1;
          if (newNeeds.hunger > 80) newNeeds.health += 0.05;

          newNeeds.energy = Math.max(0, Math.min(100, newNeeds.energy));
          newNeeds.hunger = Math.max(0, Math.min(100, newNeeds.hunger));
          newNeeds.health = Math.max(0, Math.min(100, newNeeds.health));

          return { ...agent, position, targetPosition, state, needs: newNeeds, rotation };
        });

        // Trigger AI
        if (nextTime % 60 === 0) {
           nextAgents.forEach(a => {
             if (a.state !== AgentState.MOVING && a.state !== AgentState.THINKING) {
                if (Math.random() > 0.2) processAgentAI(a.id);
             }
           });
        }

        return {
          ...prev,
          time: nextTime,
          dayTime: nextDayTime,
          agents: nextAgents,
          fauna: nextFauna
        };
      });
    }, TICK_RATE_MS / 10);

    return () => clearInterval(interval);
  }, [processAgentAI]);

  return (
    <div className="w-screen h-screen relative overflow-hidden" onClick={() => audioManager.playStep()}>
      <World3D 
        agents={gameState.agents} 
        buildings={gameState.buildings}
        flora={gameState.flora}
        fauna={gameState.fauna}
        onSelectAgent={(id) => setGameState(prev => ({ ...prev, selectedAgentId: id }))}
        selectedAgentId={gameState.selectedAgentId}
        dayTime={gameState.dayTime}
      />
      <UIOverlay 
        gameState={gameState} 
        onTogglePause={() => setGameState(prev => ({ ...prev, paused: !prev.paused }))}
        selectedAgent={gameState.agents.find(a => a.id === gameState.selectedAgentId)}
      />
    </div>
  );
}

export default App;
