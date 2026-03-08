import React, { useEffect, useState } from 'react';
import { Agent, GameState, Era } from '../types';
import { getAIStatus } from '../services/deepseekService';
import { ERA_NAMES, TECHNOLOGIES } from '../constants';
import {
  Activity, Brain, Clock, Pause, Play, Zap, Cpu, Hexagon, Box,
  Eye, Flame, FastForward, SkipForward, Sparkles, Shield, Droplets,
  Heart, Sun, Thermometer, Users
} from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  selectedAgent: Agent | undefined;
}

const EVENT_COLORS: Record<string, string> = {
  SYSTEM: 'bg-indigo-400',
  AGENT: 'bg-emerald-400',
  DIALOGUE: 'bg-cyan-400',
  DISCOVERY: 'bg-amber-400',
  DANGER: 'bg-rose-500',
  ERA: 'bg-purple-500',
  DEATH: 'bg-rose-600',
  BIRTH: 'bg-emerald-500',
};

const EVENT_TEXT_COLORS: Record<string, string> = {
  SYSTEM: 'text-indigo-100',
  AGENT: 'text-emerald-100',
  DIALOGUE: 'text-cyan-100',
  DISCOVERY: 'text-amber-100',
  DANGER: 'text-rose-200',
  ERA: 'text-purple-100',
  DEATH: 'text-rose-200',
  BIRTH: 'text-emerald-100',
};

const SEASON_ICONS: Record<string, string> = {
  SPRING: '🌱',
  SUMMER: '☀️',
  AUTUMN: '🍂',
  WINTER: '❄️',
};

const WEATHER_ICONS: Record<string, string> = {
  CLEAR: '☀️',
  CLOUDY: '☁️',
  RAIN: '🌧️',
  STORM: '⛈️',
  SNOW: '🌨️',
  FOG: '🌫️',
  HEAT_WAVE: '🔥',
};

const ERA_ORDER: Era[] = ['PRIMITIVE', 'STONE_AGE', 'AGRICULTURAL', 'BRONZE_AGE', 'IRON_AGE'];

const getBarColor = (val: number): string => {
  if (val > 70) return 'from-emerald-400 to-teal-400';
  if (val > 30) return 'from-amber-400 to-orange-400';
  return 'from-rose-500 to-red-500';
};

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onTogglePause, onSetSpeed, selectedAgent }) => {
  const [aiStatus, setAIStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => setAIStatus(getAIStatus()), 500);
    return () => clearInterval(interval);
  }, []);

  const totalTechs = Object.keys(TECHNOLOGIES).length;
  const discoveredCount = gameState.globalTechsDiscovered?.length || 0;

  const needBars: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: 'health', label: 'Health', icon: <Heart size={10} /> },
    { key: 'hunger', label: 'Hunger', icon: <Flame size={10} /> },
    { key: 'energy', label: 'Energy', icon: <Zap size={10} /> },
    { key: 'thirst', label: 'Thirst', icon: <Droplets size={10} /> },
    { key: 'temperature', label: 'Temp', icon: <Thermometer size={10} /> },
    { key: 'safety', label: 'Safety', icon: <Shield size={10} /> },
    { key: 'social', label: 'Social', icon: <Users size={10} /> },
    { key: 'curiosity', label: 'Curiosity', icon: <Eye size={10} /> },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden font-sans" style={{ zIndex: 10 }}>

      <div className="flex justify-between items-start w-full p-4 md:p-6">

        <div className="pointer-events-auto flex flex-col gap-3">
          <div className="bg-black/20 backdrop-blur-2xl px-5 py-4 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-2 transition-all duration-300 hover:bg-black/30">
            <div className="flex items-center gap-3">
              <Hexagon size={18} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
              <h1 className="text-lg font-bold tracking-tight text-white" style={{ textShadow: '0 0 20px rgba(34,211,238,0.3)' }}>
                AETHERIA
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-cyan-300/70 font-medium bg-cyan-900/20 px-2 py-0.5 rounded-md border border-cyan-800/30">
                {ERA_NAMES[gameState.currentEra]}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider text-slate-300/80 uppercase">
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-indigo-400" />
                {String(Math.floor(gameState.dayTime)).padStart(2, '0')}:00
              </div>
              <span className="text-slate-600">•</span>
              <span>Day {gameState.day}</span>
              <span className="text-slate-600">•</span>
              <span>{SEASON_ICONS[gameState.season]} {gameState.season}</span>
              <span className="text-slate-600">•</span>
              <span>{WEATHER_ICONS[gameState.weather]} {gameState.weather}</span>
            </div>

            <div className="flex items-center gap-4 text-[10px] font-mono tracking-wider text-slate-400 uppercase mt-1">
              <div className="flex items-center gap-1">
                <Users size={10} className="text-emerald-400" />
                <span className="text-white font-semibold">{gameState.agents.length}</span> pop
              </div>
              <div className="flex items-center gap-1">
                <Sparkles size={10} className="text-amber-400" />
                <span className="text-white font-semibold">{discoveredCount}</span>/{totalTechs} tech
              </div>
            </div>
          </div>

          <div className={`ml-2 transition-all duration-500 transform ${aiStatus.lastThought && Date.now() - aiStatus.lastThought.time < 6000 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'}`}>
            <div className="bg-fuchsia-900/40 backdrop-blur-xl border border-fuchsia-400/30 px-4 py-2.5 rounded-2xl shadow-[0_4px_24px_rgba(217,70,239,0.15)] max-w-sm flex items-start gap-3">
              <Cpu size={12} className="text-fuchsia-400 mt-0.5 shrink-0 animate-pulse" />
              <div className="text-[11px] text-fuchsia-100 font-medium leading-relaxed">
                <span className="text-fuchsia-300 mr-1.5">{aiStatus.lastThought?.agent}:</span>
                {aiStatus.lastThought?.thought}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <button
              key={s}
              onClick={() => onSetSpeed?.(s)}
              className={`w-9 h-9 rounded-full border text-[11px] font-bold transition-all duration-200 active:scale-90 flex items-center justify-center ${
                gameState.speed === s
                  ? 'bg-cyan-500/30 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                  : 'bg-black/20 backdrop-blur-xl border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={onTogglePause}
            className="bg-black/20 backdrop-blur-2xl hover:bg-white/10 text-white w-12 h-12 rounded-full border border-white/20 shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ml-1"
          >
            {gameState.paused
              ? <Play fill="currentColor" size={20} className="ml-0.5 text-emerald-400" />
              : <Pause fill="currentColor" size={20} className="text-cyan-400" />
            }
          </button>
        </div>
      </div>

      <div className="flex items-end w-full gap-4 p-4 md:p-6">

        <div className="w-72 shrink-0 flex flex-col justify-end pointer-events-auto max-h-80">
          <div className="space-y-2 flex flex-col-reverse overflow-hidden">
            {gameState.logs.slice().reverse().slice(0, 10).map((log) => {
              const isDiscovery = log.type === 'DISCOVERY';
              return (
                <div key={log.id} className="w-full">
                  <div className={`bg-black/40 backdrop-blur-md rounded-xl px-3 py-2 border transition-all ${
                    isDiscovery
                      ? 'border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                      : 'border-white/5 shadow-lg'
                  }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_COLORS[log.type] || 'bg-slate-400'} ${
                        isDiscovery ? 'shadow-[0_0_8px_rgba(245,158,11,0.8)]' : ''
                      }`} />
                      <span className="text-[8px] uppercase tracking-widest font-mono text-slate-500">
                        D{log.timestamp}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${EVENT_TEXT_COLORS[log.type] || 'text-slate-200'} ${
                      log.type === 'DIALOGUE' ? 'italic' : ''
                    }`}>
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex items-end justify-center pointer-events-none pb-2">
          <div className="pointer-events-auto bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 max-w-xl w-full">
            <div className="flex items-center justify-between mb-2">
              {ERA_ORDER.map((era, i) => {
                const isCurrent = gameState.currentEra === era;
                const isPast = ERA_ORDER.indexOf(gameState.currentEra) > i;
                return (
                  <React.Fragment key={era}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-3 h-3 rounded-full border transition-all ${
                        isCurrent
                          ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                          : isPast
                            ? 'bg-emerald-400/60 border-emerald-400/40'
                            : 'bg-white/10 border-white/20'
                      }`} />
                      <span className={`text-[8px] uppercase tracking-wider font-mono ${
                        isCurrent ? 'text-cyan-300 font-bold' : isPast ? 'text-emerald-400/60' : 'text-slate-500'
                      }`}>
                        {era.replace('_', ' ')}
                      </span>
                    </div>
                    {i < ERA_ORDER.length - 1 && (
                      <div className={`flex-1 h-px mx-2 ${isPast ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex gap-1 flex-wrap mt-1">
              {(gameState.globalTechsDiscovered || []).map(techId => (
                <div
                  key={techId}
                  className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                  title={TECHNOLOGIES[techId]?.name || techId}
                />
              ))}
            </div>
          </div>
        </div>

        {selectedAgent ? (
          <div className="flex gap-3 max-h-96 shrink-0 pointer-events-auto">

            <div className="w-64 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)] border border-white/20 shrink-0 text-white"
                  style={{ backgroundColor: selectedAgent.color }}
                >
                  {selectedAgent.name[0]}
                </div>
                <div className="overflow-hidden">
                  <h2 className="text-base font-bold text-white tracking-wide truncate">{selectedAgent.name}</h2>
                  <div className="text-[9px] uppercase tracking-widest text-cyan-200 font-semibold bg-cyan-900/30 px-2 py-0.5 rounded-md inline-block border border-cyan-800/50 mt-0.5">
                    {selectedAgent.state}
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <div className="space-y-2">
                {needBars.map(({ key, label, icon }) => {
                  const val = selectedAgent.needs[key as keyof typeof selectedAgent.needs] as number;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-0.5 uppercase tracking-widest">
                        <span className="flex items-center gap-1">{icon} {label}</span>
                        <span>{Math.round(val)}%</span>
                      </div>
                      <div className="h-1 bg-black/60 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full bg-gradient-to-r ${getBarColor(val)} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div>
                <div className="text-[9px] font-bold text-amber-500/80 mb-1.5 uppercase tracking-widest flex items-center gap-1">
                  <Box size={9} /> Inventory
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selectedAgent.inventory).filter(([, c]) => (c as number) > 0).length === 0 && (
                    <span className="text-[10px] text-slate-500 italic">Empty...</span>
                  )}
                  {Object.entries(selectedAgent.inventory).map(([item, count]) =>
                    (count as number) > 0 && (
                      <div key={item} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-300 font-medium uppercase tracking-wider">{item}</span>
                        <span className="text-[10px] text-white font-bold">{count as number}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {selectedAgent.knownTechnologies.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-purple-400/80 mb-1.5 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={9} /> Known Tech
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.knownTechnologies.map(t => (
                      <span key={t} className="text-[9px] bg-purple-500/15 text-purple-200 border border-purple-500/20 px-1.5 py-0.5 rounded-md">
                        {TECHNOLOGIES[t]?.name || t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-72 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/15 rounded-full blur-[40px] pointer-events-none" />

              <div className="flex items-center gap-2 text-purple-300 tracking-widest uppercase font-bold text-[10px] mb-3 z-10 shrink-0">
                <Brain size={12} className="animate-pulse" /> Neural State
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 z-10 pr-1" style={{ scrollbarWidth: 'none' }}>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(selectedAgent.neuro).map(([chem, val]) => (
                    <div key={chem} className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-slate-400 font-semibold">{chem}</span>
                      <span className="text-sm font-bold text-white">{Math.round(val as number)}<span className="text-[9px] text-slate-500 ml-0.5">%</span></span>
                    </div>
                  ))}
                </div>

                {(selectedAgent.feelings.length > 0 || selectedAgent.mood) && (
                  <div>
                    <div className="text-[8px] font-bold text-pink-400/80 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Activity size={9} /> Mood
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedAgent.mood && (
                        <span className="text-[9px] bg-pink-500/15 text-pink-200 border border-pink-500/20 px-1.5 py-0.5 rounded-md font-medium">
                          {selectedAgent.mood}
                        </span>
                      )}
                      {selectedAgent.feelings.map((f, i) => (
                        <span key={i} className="text-[9px] bg-white/5 text-slate-300 border border-white/10 px-1.5 py-0.5 rounded-md">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="h-px w-full bg-white/10" />

                <div>
                  <div className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Zap size={9} /> Stream of Consciousness
                  </div>
                  <div className="space-y-1.5">
                    {(selectedAgent.aiThoughts?.length ?? 0) > 0 ? (
                      selectedAgent.aiThoughts?.slice(-3).reverse().map((thought, i) => (
                        <div
                          key={i}
                          className={`text-[10px] leading-relaxed p-2 rounded-lg border border-white/5 ${
                            i === 0
                              ? 'bg-indigo-500/10 text-indigo-100 font-medium'
                              : 'bg-white/5 text-slate-400 opacity-70'
                          }`}
                        >
                          {thought}
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">No thoughts yet...</div>
                    )}
                  </div>
                </div>

                {(selectedAgent.aiConversations?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Users size={9} /> Recent Conversations
                    </div>
                    <div className="space-y-1">
                      {selectedAgent.aiConversations?.slice(-3).reverse().map((conv, i) => (
                        <div key={i} className="text-[10px] bg-white/5 rounded-lg p-2 border border-white/5 text-slate-300">
                          <span className="text-emerald-300 font-medium">→ {conv.with}:</span> {conv.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 shrink-0 z-10">
                <div className="text-[8px] font-bold text-rose-300/80 uppercase tracking-widest mb-1">Current Action</div>
                <div className="text-[11px] text-white font-medium bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 break-words">
                  "{selectedAgent.currentActionLabel}"
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="w-72 shrink-0" />
        )}
      </div>

    </div>
  );
};

export default UIOverlay;
