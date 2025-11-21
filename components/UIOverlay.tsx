
import React, { useEffect, useState } from 'react';
import { Agent, GameState } from '../types';
import { Activity, MessageSquare, Zap, Brain, Clock, Pause, Play, Eye, Box, HeartPulse, Cpu } from 'lucide-react';
import { getAIStatus } from '../services/aiMindEngine';

interface UIOverlayProps {
  gameState: GameState;
  onTogglePause: () => void;
  selectedAgent: Agent | undefined;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onTogglePause, selectedAgent }) => {
  const [aiStatus, setAIStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => setAIStatus(getAIStatus()), 500);
    return () => clearInterval(interval);
  }, []);

  const getMoodColor = (val: number) => {
    if (val > 70) return 'bg-green-500';
    if (val > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-slate-900/80 backdrop-blur p-4 rounded-xl border border-slate-700 shadow-xl">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Aetheria: Neuro-Engine
          </h1>
          <div className="flex items-center gap-4 text-slate-300 text-sm font-mono">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>Tick: {gameState.time}</span>
            </div>
             <div className="flex items-center gap-2">
              <span>Time: {Math.floor(gameState.dayTime)}:00</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{gameState.season} | {gameState.weather}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={16} />
              <span>Agents: {gameState.agents.length}</span>
            </div>
            <div className={`flex items-center gap-2 ${aiStatus.available ? 'text-green-400' : 'text-slate-500'}`}>
              <Cpu size={16} />
              <span>{aiStatus.available ? 'AI: On' : 'AI: Off'}</span>
            </div>
          </div>
          {aiStatus.lastThought && Date.now() - aiStatus.lastThought.time < 5000 && (
            <div className="mt-2 text-xs text-purple-300 flex items-center gap-2 animate-pulse">
              <Brain size={12} />
              <span className="truncate max-w-[250px]">{aiStatus.lastThought.agent}: "{aiStatus.lastThought.thought}"</span>
            </div>
          )}
        </div>

        <button 
          onClick={onTogglePause}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full shadow-lg transition-transform active:scale-95"
        >
          {gameState.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
        </button>
      </div>

      {/* Middle Section (Empty for 3D view) */}
      <div className="flex-1"></div>

      {/* Bottom Section */}
      <div className="flex gap-6 items-end pointer-events-auto h-80">
        
        {/* Event Log */}
        <div className="w-1/3 h-full bg-slate-900/80 backdrop-blur rounded-xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-700 bg-slate-800/50 font-semibold text-slate-200 flex items-center gap-2">
            <MessageSquare size={16} /> World Events
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm font-mono">
            {gameState.logs.length === 0 && <div className="text-slate-500 italic">Simulation starting...</div>}
            {gameState.logs.slice().reverse().map((log) => (
              <div key={log.id} className="border-l-2 border-indigo-500 pl-2 py-1">
                <span className="text-xs text-slate-500 block">T-{log.timestamp}</span>
                <span className={`text-slate-200 ${log.type === 'DIALOGUE' ? 'text-cyan-300' : log.type === 'DANGER' ? 'text-red-400' : ''}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Inspector */}
        {selectedAgent ? (
          <div className="w-1/3 h-full bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: selectedAgent.color }}>
                  {selectedAgent.name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{selectedAgent.state}</p>
                </div>
              </div>
              <Brain className="text-indigo-400" />
            </div>

            {/* Neuro Chemistry Panel */}
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
               <div className="flex items-center gap-2 text-xs font-bold text-pink-300 mb-2">
                  <HeartPulse size={12} /> NEURO-CHEMISTRY
               </div>
               <div className="space-y-2">
                   <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400">Cortisol</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full"><div className="h-full bg-red-500 rounded-full" style={{width: `${selectedAgent.neuro.cortisol}%`}}></div></div>
                   </div>
                   <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400">Dopamine</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{width: `${selectedAgent.neuro.dopamine}%`}}></div></div>
                   </div>
                   <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400">Adrenaline</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full"><div className="h-full bg-yellow-400 rounded-full" style={{width: `${selectedAgent.neuro.adrenaline}%`}}></div></div>
                   </div>
                   <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400">Oxytocin</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full"><div className="h-full bg-pink-400 rounded-full" style={{width: `${selectedAgent.neuro.oxytocin}%`}}></div></div>
                   </div>
               </div>
            </div>

            {/* Physical Needs */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Energy</span></div>
                  <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getMoodColor(selectedAgent.needs.energy)}`} style={{ width: `${selectedAgent.needs.energy}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Hunger</span></div>
                  <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${getMoodColor(selectedAgent.needs.hunger)}`} style={{ width: `${selectedAgent.needs.hunger}%` }}></div>
                  </div>
                </div>
            </div>

            {/* Inventory Grid */}
            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-2">
                    <Box size={12} /> INVENTORY
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {Object.entries(selectedAgent.inventory).map(([item, count]) => (
                        (count as number) > 0 && (
                            <div key={item} className="bg-slate-700 p-1 rounded text-center text-xs">
                                <div className="text-slate-400 text-[10px]">{item}</div>
                                <div className="font-bold">{count as number}</div>
                            </div>
                        )
                    ))}
                    {Object.keys(selectedAgent.inventory).length === 0 && <span className="text-xs text-slate-500">Empty</span>}
                </div>
            </div>

            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
                <Zap size={12} /> CURRENT ACTION
              </div>
              <p className="text-xs text-slate-300 italic">"{selectedAgent.currentActionLabel}"</p>
            </div>
          </div>
        ) : (
          <div className="w-1/3 h-full flex items-center justify-center bg-slate-900/50 backdrop-blur rounded-xl border border-slate-700 text-slate-500 flex-col gap-2">
            <Eye size={48} />
            <p>Select an agent to inspect brain</p>
          </div>
        )}

        {/* AI Mind Panel */}
        <div className="w-1/3 h-full bg-slate-900/80 backdrop-blur rounded-xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-700 bg-slate-800/50 font-semibold text-slate-200 flex items-center gap-2">
            <Brain size={16} className="text-purple-400" /> AI Mind
            {selectedAgent && <span className="text-xs text-slate-400 ml-2">({selectedAgent.name})</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {selectedAgent ? (
              <>
                {/* Thoughts */}
                <div>
                  <div className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-1">
                    <Zap size={10} /> THOUGHTS
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {(selectedAgent.aiThoughts?.length ?? 0) > 0 ? (
                      selectedAgent.aiThoughts?.slice(-5).reverse().map((thought, i) => (
                        <div key={i} className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded border-l-2 border-purple-500">
                          "{thought}"
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic">No thoughts yet...</div>
                    )}
                  </div>
                </div>

                {/* Conversations */}
                <div>
                  <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1">
                    <MessageSquare size={10} /> CONVERSATIONS
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(selectedAgent.aiConversations?.length ?? 0) > 0 ? (
                      selectedAgent.aiConversations?.slice(-5).reverse().map((conv, i) => (
                        <div key={i} className="text-xs bg-slate-800/50 p-2 rounded border-l-2 border-cyan-500">
                          <span className="text-cyan-400 font-semibold">To {conv.with}:</span>
                          <span className="text-slate-300 ml-1">"{conv.message}"</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic">No conversations yet...</div>
                    )}
                  </div>
                </div>

                {/* Current Action */}
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                  <div className="text-xs text-slate-400">Current Action:</div>
                  <div className="text-sm text-white font-medium">{selectedAgent.currentActionLabel}</div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Brain size={32} className="mb-2 opacity-50" />
                <p className="text-xs">Select an agent to view AI mind</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default UIOverlay;
