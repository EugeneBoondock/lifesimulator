import React, { useEffect, useState } from 'react';
import { Agent, GameState } from '../types';
import { Activity, MessageSquare, Zap, Brain, Clock, Pause, Play, HeartPulse, Cpu, Hexagon, ActivitySquare, Box } from 'lucide-react';
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

  const getPercentageColor = (val: number, isGoodHigh: boolean = true) => {
    if (isGoodHigh) {
      if (val > 70) return 'from-emerald-400 to-teal-400';
      if (val > 30) return 'from-amber-400 to-orange-400';
      return 'from-rose-500 to-red-500';
    } else {
      if (val < 30) return 'from-emerald-400 to-teal-400';
      if (val < 70) return 'from-amber-400 to-orange-400';
      return 'from-rose-500 to-red-500';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-8 flex flex-col justify-between overflow-hidden font-sans">

      {/* ===== TOP BAR WIDGETS ===== */}
      <div className="flex justify-between items-start w-full">

        {/* Top Left: Simulation Status Pill */}
        <div className="pointer-events-auto group">
          <div className="bg-black/20 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col gap-1 transition-all duration-300 hover:bg-black/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3">
              <Hexagon size={20} className="text-cyan-400" />
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                AETHERIA <span className="text-cyan-400 font-light opacity-80">OS</span>
              </h1>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs font-mono tracking-widest text-slate-300 opacity-80 pl-1 uppercase">
              <div className="flex items-center gap-1.5"><Clock size={12} className="text-indigo-400" /> {Math.floor(gameState.dayTime)}:00 • Day {gameState.day}</div>
              <div className="w-1 h-1 rounded-full bg-slate-500"></div>
              <div className="flex items-center gap-1.5">{gameState.season} • {gameState.weather}</div>
              <div className="w-1 h-1 rounded-full bg-slate-500"></div>
              <div className="flex items-center gap-1.5"><ActivitySquare size={12} /> {gameState.agents.length} Entities</div>
            </div>
          </div>

          {/* AI Core Thoughts Toast (Floats slightly below) */}
          <div className={`mt-4 ml-4 transition-all duration-500 transform ${aiStatus.lastThought && Date.now() - aiStatus.lastThought.time < 6000 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
            <div className="bg-fuchsia-900/40 backdrop-blur-xl border border-fuchsia-400/30 px-4 py-2 rounded-2xl shadow-[0_4px_24px_rgba(217,70,239,0.2)] max-w-sm flex items-start gap-3">
              <Cpu size={14} className="text-fuchsia-400 mt-0.5 shrink-0 animate-pulse" />
              <div className="text-xs text-fuchsia-100 font-medium leading-relaxed">
                <span className="text-fuchsia-300 mr-2">{aiStatus.lastThought?.agent}:</span>
                {aiStatus.lastThought?.thought}
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: Play/Pause */}
        <button
          onClick={onTogglePause}
          className="pointer-events-auto bg-black/20 backdrop-blur-2xl hover:bg-white/10 text-white w-14 h-14 rounded-full border border-white/20 shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] group"
        >
          {gameState.paused
            ? <Play fill="currentColor" size={24} className="ml-1 text-emerald-400 group-hover:scale-110 transition-transform" />
            : <Pause fill="currentColor" size={24} className="text-cyan-400 group-hover:scale-110 transition-transform" />
          }
        </button>
      </div>

      {/* ===== BOTTOM WIDGETS ===== */}
      <div className="flex items-end justify-between w-full gap-8 h-96 pointer-events-none">

        {/* Bottom Left: Event Stream */}
        <div className="w-80 h-full flex flex-col justify-end pointer-events-auto mask-image-b-to-t pb-2">
          <div className="space-y-3 flex flex-col-reverse justify-start overflow-hidden h-[90%] fade-mask-top pt-4">
            {gameState.logs.slice().reverse().slice(0, 8).map((log, index) => (
              <div key={log.id} className="animate-slideUp fade-in group w-full">
                <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-lg transform transition-transform group-hover:translate-x-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-widest font-mono text-slate-500">T-{log.timestamp}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${log.type === 'DIALOGUE' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : log.type === 'DANGER' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : log.type === 'SYSTEM' ? 'bg-indigo-400' : 'bg-emerald-400'}`}></div>
                  </div>
                  <p className={`text-xs font-medium leading-relaxed opacity-90 ${log.type === 'DIALOGUE' ? 'text-cyan-100 italic' : log.type === 'DANGER' ? 'text-rose-200' : 'text-slate-200'}`}>
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Center & Right: Agent Inspector Container */}
        {selectedAgent ? (
          <div className="flex gap-6 h-full max-w-4xl w-full justify-end animate-slideUp pointer-events-auto pb-2">

            {/* Component 1: Physical Status & Inventory */}
            <div className="w-72 bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto hide-scrollbar">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)] border border-white/20 shrink-0 text-white" style={{ backgroundColor: selectedAgent.color }}>
                  {selectedAgent.name[0]}
                </div>
                <div className="overflow-hidden">
                  <h2 className="text-xl font-bold text-white tracking-wide truncate">{selectedAgent.name}</h2>
                  <div className="text-[10px] uppercase tracking-widest text-cyan-200 font-semibold bg-cyan-900/30 px-2 py-0.5 rounded-md inline-block border border-cyan-800/50 mt-1 shadow-inner">
                    {selectedAgent.state}
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

              {/* Status Bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                    <span>Energy</span><span>{Math.round(selectedAgent.needs.energy)}%</span>
                  </div>
                  <div className="h-1.5 bg-black/60 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full bg-gradient-to-r ${getPercentageColor(selectedAgent.needs.energy)} rounded-full shadow-[inset_0_1px_rgba(255,255,255,0.4)] transition-all duration-500`} style={{ width: `${selectedAgent.needs.energy}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                    <span>Hunger</span><span>{Math.round(selectedAgent.needs.hunger)}%</span>
                  </div>
                  <div className="h-1.5 bg-black/60 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full bg-gradient-to-r ${getPercentageColor(selectedAgent.needs.hunger)} rounded-full shadow-[inset_0_1px_rgba(255,255,255,0.4)] transition-all duration-500`} style={{ width: `${selectedAgent.needs.hunger}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                    <span>Social</span><span>{Math.round(selectedAgent.needs.social)}%</span>
                  </div>
                  <div className="h-1.5 bg-black/60 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full bg-gradient-to-r ${getPercentageColor(selectedAgent.needs.social)} rounded-full shadow-[inset_0_1px_rgba(255,255,255,0.4)] transition-all duration-500`} style={{ width: `${selectedAgent.needs.social}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Inventory Map */}
              <div className="mt-auto">
                <div className="text-[10px] font-bold text-amber-500/80 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                  <Box size={10} /> Pocket
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedAgent.inventory).filter(([_, c]) => (c as number) > 0).length === 0 && <span className="text-xs text-slate-500 italic px-2">Empty...</span>}
                  {Object.entries(selectedAgent.inventory).map(([item, count]) => (
                    (count as number) > 0 && (
                      <div key={item} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center justify-between gap-3 shadow-inner">
                        <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">{item}</span>
                        <span className="text-xs text-white font-bold">{count as number}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>

            {/* Component 2: The Brain (Neuro & AI) */}
            <div className="w-80 bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl p-6 flex flex-col overflow-hidden relative group">
              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-purple-500/30 transition-colors"></div>

              <div className="flex items-center gap-2 text-purple-300 tracking-widest uppercase font-bold text-xs mb-5 z-10 shrink-0">
                <Brain size={14} className="animate-pulse" /> Neural State
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar space-y-6 z-10 pr-1">
                {/* Neurochem Block */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {Object.entries(selectedAgent.neuro).map(([chem, val]) => (
                    <div key={chem} className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold">{chem}</span>
                      <div className="text-sm font-bold text-white tracking-widest flex items-baseline gap-1">
                        {Math.round(val as number)}
                        <span className="opacity-50 text-[10px] font-normal">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-px w-full bg-white/10"></div>

                {/* AI Internal Monologue */}
                <div className="flex flex-col gap-3">
                  <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 opacity-80">
                    <Zap size={10} /> Stream of Consciousness
                  </div>
                  <div className="space-y-3">
                    {(selectedAgent.aiThoughts?.length ?? 0) > 0 ? (
                      selectedAgent.aiThoughts?.slice(-3).reverse().map((thought, i) => (
                        <div key={i} className={`text-[11px] leading-relaxed p-3 rounded-xl border border-white/5 backdrop-blur-sm shadow-inner
                                      ${i === 0 ? 'bg-indigo-500/10 text-indigo-100 font-medium' : 'bg-white/5 text-slate-300 opacity-70'}
                                  `}>
                          {thought}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic">Static...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Action HUD */}
              <div className="mt-4 pt-4 border-t border-white/10 shrink-0 z-10">
                <div className="text-[9px] font-bold text-rose-300 uppercase tracking-widest mb-1.5 opacity-80">Executing Matrix</div>
                <div className="text-sm text-white font-medium bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 shadow-inner break-words">
                  "{selectedAgent.currentActionLabel}"
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 h-full flex items-end justify-end pointer-events-none pb-2">
            {/* Optional minimal hint to click an agent can go here */}
          </div>
        )}
      </div>

    </div>
  );
};

export default UIOverlay;
