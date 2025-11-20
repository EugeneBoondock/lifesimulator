import React from 'react';
import { Agent, GameState, AgentState } from '../types';
import { Activity, MessageSquare, Zap, Brain, Clock, Pause, Play, Eye } from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  onTogglePause: () => void;
  selectedAgent: Agent | undefined;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onTogglePause, selectedAgent }) => {
  
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
            Aetheria Engine
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
              <Activity size={16} />
              <span>Agents: {gameState.agents.length}</span>
            </div>
          </div>
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
      <div className="flex gap-6 items-end pointer-events-auto h-64">
        
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
                <span className={`text-slate-200 ${log.type === 'DIALOGUE' ? 'text-cyan-300' : ''}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Inspector */}
        {selectedAgent ? (
          <div className="w-1/3 h-full bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 overflow-y-auto p-4 flex flex-col gap-4">
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

            <div className="space-y-3">
              {/* Needs Bars */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Energy</span><span>{selectedAgent.needs.energy}%</span></div>
                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${getMoodColor(selectedAgent.needs.energy)}`} style={{ width: `${selectedAgent.needs.energy}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Social</span><span>{selectedAgent.needs.social}%</span></div>
                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${getMoodColor(selectedAgent.needs.social)}`} style={{ width: `${selectedAgent.needs.social}%` }}></div>
                </div>
              </div>
               <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Hunger</span><span>{selectedAgent.needs.hunger}%</span></div>
                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                   <div className={`h-full ${getMoodColor(selectedAgent.needs.hunger)}`} style={{ width: `${selectedAgent.needs.hunger}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
                <Zap size={12} /> CURRENT THOUGHT
              </div>
              <p className="text-sm text-slate-300 italic">"{selectedAgent.currentActionLabel}"</p>
            </div>
            
            <div className="text-xs text-slate-500">
              <p><strong>Bio:</strong> {selectedAgent.personality.bio}</p>
            </div>
          </div>
        ) : (
          <div className="w-1/3 h-full flex items-center justify-center bg-slate-900/50 backdrop-blur rounded-xl border border-slate-700 text-slate-500 flex-col gap-2">
            <Eye size={48} />
            <p>Select an agent to view brain state</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default UIOverlay;
