import React, { useState, useEffect, useRef, useCallback } from 'react';
import { INITIAL_AGENTS, TICK_RATE_MS, DAY_LENGTH_TICKS, WORLD_SIZE } from './constants';
import { GameState, Agent, AgentState, AgentDecision, Building } from './types';
import World3D from './components/World3D';
import UIOverlay from './components/UIOverlay';
import { decideAgentAction } from './services/geminiService';

// Safe ID generator for environments where crypto.randomUUID might fail
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  // ---------------- STATE ----------------
  const [gameState, setGameState] = useState<GameState>({
    agents: INITIAL_AGENTS,
    buildings: [],
    time: 0,
    dayTime: 12, // Starts at noon
    logs: [{ id: 'init', timestamp: 0, type: 'SYSTEM', message: 'Engine initialized. Waiting for AI signals...' }],
    paused: false,
    selectedAgentId: null
  });

  // Refs for mutable state in interval without re-renders
  const stateRef = useRef<GameState>(gameState);
  const processingAgents = useRef<Set<string>>(new Set()); 

  // Sync ref
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

    // Call Gemini
    const decision: AgentDecision = await decideAgentAction(currentAgent, stateRef.current);

    // Apply Decision
    setGameState(prev => {
      const logs = [...prev.logs];
      logs.push({
        id: generateId(),
        timestamp: prev.time,
        type: 'AGENT',
        message: `${currentAgent.name}: ${decision.thoughtProcess}`
      });

      if (decision.action === 'TALK' && decision.dialogue) {
         logs.push({
          id: generateId(),
          timestamp: prev.time,
          type: 'DIALOGUE',
          message: `"${decision.dialogue}"`
        });
      }

      return {
        ...prev,
        logs: logs.slice(-50),
        agents: prev.agents.map(a => {
          if (a.id !== agentId) return a;

          let newState = AgentState.IDLE;
          let newTarget = null;
          let chatBubble = undefined;

          // Handle Actions
          if (decision.action === 'MOVE' && decision.targetLocation) {
            newState = AgentState.MOVING;
            newTarget = { 
              x: Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, decision.targetLocation.x)), 
              y: 0, 
              z: Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, decision.targetLocation.z)) 
            };
          } else if (decision.action === 'TALK') {
            newState = AgentState.SOCIALIZING;
            chatBubble = decision.dialogue;
          } else if (decision.action === 'SLEEP') {
            newState = AgentState.SLEEPING;
          } else if (decision.action === 'WORK') {
            newState = AgentState.WORKING;
          }

          return {
            ...a,
            state: newState,
            targetPosition: newTarget,
            currentActionLabel: decision.thoughtProcess,
            chatBubble: chatBubble
          };
        })
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
        const newBuildings = [...prev.buildings];

        // Update Agents (Movement & Needs Decay)
        const nextAgents = prev.agents.map(agent => {
          let { position, targetPosition, needs, state, chatBubble, rotation } = agent;
          
          // Initialize newNeeds based on current needs
          let newNeeds = { ...needs };

          // Movement Logic with Rotation
          if (state === AgentState.MOVING && targetPosition) {
            const dx = targetPosition.x - position.x;
            const dz = targetPosition.z - position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            const speed = 0.15; // Slower, more realistic speed

            // Calculate facing rotation
            const targetRotation = Math.atan2(dx, dz);
            // Simple lerp rotation
            let diff = targetRotation - rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            rotation += diff * 0.2;

            if (dist < speed) {
              position = targetPosition;
              targetPosition = null;
              state = AgentState.IDLE;
            } else {
              position = {
                x: position.x + Math.sin(rotation) * speed,
                y: 0, 
                z: position.z + Math.cos(rotation) * speed
              };
            }
          }

          // Work Logic: Differentiate between Foraging and Building
          if (state === AgentState.WORKING) {
            // If hungry, they are Foraging/Eating
            if (needs.hunger < 50) {
                newNeeds.hunger = Math.min(100, newNeeds.hunger + 5); // Eat
            } else {
                // If not hungry, they are building/working
                newNeeds.hunger = Math.max(0, newNeeds.hunger - 0.5); // Work makes you hungry
                newNeeds.energy = Math.max(0, newNeeds.energy - 0.5); // Work tires you out
                
                // Spawn buildings randomly if working
                if (Math.random() < 0.02) { 
                  const offsetX = Math.sin(rotation) * 1.5;
                  const offsetZ = Math.cos(rotation) * 1.5;
                  newBuildings.push({
                    id: generateId(),
                    position: { x: position.x + offsetX, y: 0, z: position.z + offsetZ },
                    ownerId: agent.id,
                    type: agent.personality.bio.includes("gardener") ? 'PLANT' : 'CRATE',
                    scale: 0.5 + Math.random() * 0.5
                  });
                }
            }
          } else {
            // Idle hunger decay
            newNeeds.hunger = Math.max(0, newNeeds.hunger - 0.1);
          }

          // Needs Decay / Regen
          if (state === AgentState.SLEEPING) {
             newNeeds.energy = Math.min(100, newNeeds.energy + 5);
          } else {
             newNeeds.energy = Math.max(0, newNeeds.energy - 0.1);
          }
          
          if (state === AgentState.SOCIALIZING) {
             newNeeds.social = Math.min(100, newNeeds.social + 5);
          } else {
             newNeeds.social = Math.max(0, newNeeds.social - 0.15);
          }
          
          if (chatBubble && Math.random() > 0.8) {
            chatBubble = undefined;
          }

          return { ...agent, position, targetPosition, state, needs: newNeeds, chatBubble, rotation };
        });

        // AI Trigger
        if (nextTime % 10 === 0) {
           nextAgents.forEach(a => {
             if (a.state === AgentState.IDLE || a.state === AgentState.SOCIALIZING || a.state === AgentState.SLEEPING) {
                if (Math.random() > 0.3) processAgentAI(a.id);
             }
           });
        }

        return {
          ...prev,
          time: nextTime,
          dayTime: nextDayTime,
          agents: nextAgents,
          buildings: newBuildings
        };
      });

    }, TICK_RATE_MS / 10); // Faster smooth simulation

    return () => clearInterval(interval);
  }, [processAgentAI]);


  // ---------------- RENDER ----------------
  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <World3D 
        agents={gameState.agents} 
        buildings={gameState.buildings}
        onSelectAgent={(id) => setGameState(prev => ({ ...prev, selectedAgentId: id }))}
        selectedAgentId={gameState.selectedAgentId}
        dayTime={gameState.dayTime}
      />
      <UIOverlay 
        gameState={gameState} 
        onTogglePause={() => setGameState(prev => ({ ...prev, paused: !prev.paused }))}
        selectedAgent={gameState.agents.find(a => a.id === gameState.selectedAgentId)}
      />
      
      {!process.env.API_KEY && (
         <div className="absolute top-0 left-0 w-full h-full bg-black/80 z-50 flex items-center justify-center text-center p-10">
           <div>
             <h1 className="text-4xl text-red-500 font-bold mb-4">Configuration Error</h1>
             <p className="text-xl text-gray-300">
               Missing <code>process.env.API_KEY</code> for Gemini API.
             </p>
           </div>
         </div>
      )}
    </div>
  );
}

export default App;