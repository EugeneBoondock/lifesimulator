import { Agent, AgentState, AgentDecision, GameState } from '../types';
import { SYSTEM_INSTRUCTION, TECHNOLOGIES, CRAFTING_RECIPES, BUILDING_RECIPES } from '../constants';

const API_URL = '/api/ai/decide';
const AI_COOLDOWN_MS = 8000;
const MAX_CONCURRENT = 1;

const lastDecisionTime = new Map<string, number>();
const pendingDecisions = new Set<string>();
let lastAIThought: { agent: string; thought: string; time: number } | null = null;
let aiAvailable = true;
let totalRequests = 0;
let totalErrors = 0;

const getDist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

export const getAIStatus = () => ({
  available: aiAvailable,
  lastThought: lastAIThought,
  requests: totalRequests,
  errors: totalErrors,
  pending: pendingDecisions.size,
});

const buildPrompt = (agent: Agent, gs: GameState): string => {
  const vis = 18;

  const nearFlora = gs.flora
    .filter(f => getDist(f.position, agent.position) < vis && ((f.resourcesLeft || 0) > 0 || f.isEdible))
    .slice(0, 6)
    .map(f => {
      const d = Math.round(getDist(f.position, agent.position));
      const info = f.resourceYield ? `yields ${f.resourceYield}` : f.isEdible ? (f.isPoisonous ? 'POISONOUS' : 'edible') : '';
      return `${f.type}[${f.id.slice(0, 5)}](${d}m,${info})`;
    }).join(', ');

  const nearFauna = gs.fauna
    .filter(f => getDist(f.position, agent.position) < vis)
    .slice(0, 4)
    .map(f => {
      const d = Math.round(getDist(f.position, agent.position));
      return `${f.type}[${f.id.slice(0, 5)}](${d}m,hp:${f.health}${f.isAggressive ? ',DANGER' : ''}${f.isTamed ? ',tamed' : ''})`;
    }).join(', ');

  const nearAgents = gs.agents
    .filter(a => a.id !== agent.id && getDist(a.position, agent.position) < vis)
    .slice(0, 5)
    .map(a => {
      const d = Math.round(getDist(a.position, agent.position));
      const rel = agent.relationships[a.id] || 0;
      const relType = agent.relationshipTypes[a.id] || (rel > 50 ? 'friend' : rel > 20 ? 'acquaintance' : rel < -20 ? 'rival' : 'stranger');
      const extras: string[] = [];
      if (a.id === agent.partnerId) extras.push('PARTNER');
      if (agent.children.includes(a.id)) extras.push('MY_CHILD');
      if (a.children.includes(agent.id)) extras.push('MY_PARENT');
      if (a.needs.hunger < 30) extras.push('hungry');
      if (a.lifeStage === 'CHILD') extras.push('child');
      return `${a.name}[${a.id.slice(0, 5)}](${d}m,${relType}${extras.length ? ',' + extras.join(',') : ''},doing:${a.state})`;
    }).join(', ');

  const nearBuildings = gs.buildings
    .filter(b => getDist(b.position, agent.position) < vis)
    .slice(0, 4)
    .map(b => `${b.type}[${b.id.slice(0, 5)}](${Math.round(getDist(b.position, agent.position))}m${b.ownerId === agent.id ? ',MINE' : ''})`).join(', ');

  const nearWater = gs.water
    .filter(w => getDist(w.position, agent.position) < vis)
    .slice(0, 2)
    .map(w => `${w.kind}(${Math.round(getDist(w.position, agent.position))}m)`).join(', ');

  const incomingSpeaker = gs.agents.find(a =>
    a.id !== agent.id && a.state === AgentState.SOCIALIZING &&
    a.targetId === agent.id && a.chatBubble &&
    getDist(a.position, agent.position) < 5
  );

  const knownTechs = agent.knownTechnologies.join(', ') || 'none yet';
  const availableCrafts = Object.values(CRAFTING_RECIPES)
    .filter(r => !r.requiredTech || agent.knownTechnologies.includes(r.requiredTech))
    .map(r => `${r.name}(${Object.entries(r.ingredients).map(([k, v]) => `${v}${k}`).join('+')})`).join(', ');

  const availableBuilds = Object.values(BUILDING_RECIPES)
    .filter(r => !r.requiredTech || agent.knownTechnologies.includes(r.requiredTech))
    .map(r => `${r.name}(${Object.entries(r.ingredients).map(([k, v]) => `${v}${k}`).join('+')})`).join(', ');

  const discoverableTechs = Object.values(TECHNOLOGIES)
    .filter(t => !agent.knownTechnologies.includes(t.id) &&
      t.prerequisites.every(p => agent.knownTechnologies.includes(p)))
    .map(t => `${t.id} (${t.name}): "${t.discoveryHint}"`).join('\n  ');

  const inv = Object.entries(agent.inventory).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ') || 'empty';
  const recentThoughts = (agent.aiThoughts || []).slice(-2).join('; ');
  const isNight = gs.dayTime < 6 || gs.dayTime > 19;

  let familyInfo = '';
  if (agent.partnerId) {
    const partner = gs.agents.find(a => a.id === agent.partnerId);
    familyInfo += `Partner: ${partner?.name || 'unknown'}. `;
  }
  if (agent.children.length > 0) {
    const childNames = agent.children.map(cid => gs.agents.find(a => a.id === cid)?.name).filter(Boolean);
    if (childNames.length > 0) familyInfo += `Children: ${childNames.join(', ')}. `;
  }
  if (agent.isPregnant) familyInfo += 'You are expecting a baby! ';

  const activeEvents = gs.activeEvents?.map(e => `${e.name}: ${e.description}`).join('; ') || '';

  const lifeContext = agent.lifeStage === 'CHILD'
    ? 'You are a CHILD - you can play, learn, and explore but cannot mate or research.'
    : agent.lifeStage === 'ELDER'
    ? 'You are an ELDER - you are wise, prefer to teach and share knowledge.'
    : '';

  let courtActions = '';
  if (agent.lifeStage === 'ADULT' && !agent.partnerId) {
    const prospects = gs.agents.filter(a =>
      a.id !== agent.id && a.sex !== agent.sex && a.lifeStage === 'ADULT' && !a.partnerId &&
      getDist(a.position, agent.position) < vis && (agent.relationships[a.id] || 0) >= 40
    );
    if (prospects.length > 0) {
      courtActions = `\n  COURT <targetId> - court ${prospects.map(p => `${p.name}[${p.id.slice(0, 5)}]`).join('/')} to become partners`;
    }
  }

  let mateAction = '';
  if (agent.partnerId && agent.lifeStage === 'ADULT') {
    const partner = gs.agents.find(a => a.id === agent.partnerId);
    if (partner && getDist(agent.position, partner.position) < vis) {
      mateAction = `\n  MATE - spend time with your partner ${partner.name}`;
    }
  }

  return `You are ${agent.name}, an Aetheri creature. ${agent.personality.bio}
${lifeContext}
Traits: ${agent.personality.courage > 0.6 ? 'Brave' : 'Cautious'}, ${agent.personality.creativity > 0.6 ? 'Creative' : 'Practical'}, ${agent.personality.extraversion > 0.6 ? 'Social' : 'Solitary'}, ${agent.personality.agreeableness > 0.6 ? 'Kind' : 'Independent'}
Life stage: ${agent.lifeStage} | Age: ${agent.ageDays} days | Sex: ${agent.sex}
${familyInfo}
STATUS:
  Health:${Math.round(agent.needs.health)} Hunger:${Math.round(agent.needs.hunger)} Energy:${Math.round(agent.needs.energy)} Thirst:${Math.round(agent.needs.thirst)} Temp:${Math.round(agent.needs.temperature)} Safety:${Math.round(agent.needs.safety)} Social:${Math.round(agent.needs.social)} Curiosity:${Math.round(agent.needs.curiosity)}
  Mood: ${agent.mood} | Feelings: ${agent.feelings.join(', ') || 'neutral'}
  Inventory: ${inv}
  Tool: ${agent.equippedTool || 'bare hands'}
  Known Tech: ${knownTechs}

ENVIRONMENT:
  ${isNight ? 'NIGHT TIME - dark and cold' : `Day, ~${Math.floor(gs.dayTime)}:00`} | Day ${gs.day} | ${gs.season} | ${gs.weather}
  Era: ${gs.currentEra} | Population: ${gs.agents.length}
  Resources nearby: ${nearFlora || 'nothing'}
  Animals: ${nearFauna || 'none'}
  Others: ${nearAgents || 'alone'}
  Buildings: ${nearBuildings || 'none'}
  Water: ${nearWater || 'none nearby'}
${activeEvents ? `  Active Events: ${activeEvents}` : ''}
${incomingSpeaker ? `\n  "${incomingSpeaker.name}" says to you: "${incomingSpeaker.chatBubble}"` : ''}
${recentThoughts ? `\n  Recent thoughts: ${recentThoughts}` : ''}

AVAILABLE ACTIONS:
  GATHER <targetId> - collect resources from flora
  CRAFT <item> - make: ${availableCrafts || 'nothing yet (discover technology!)'}
  BUILD <type> - construct: ${availableBuilds || 'nothing yet'}
  HUNT <targetId> - attack animal for food
  EAT - eat food from inventory
  DRINK - go to nearest water
  SLEEP - rest to recover energy
  TALK <targetId> - socialize with another Aetheri
  RESPOND - reply to someone talking to you
  EXPLORE - wander to discover new things
  RESEARCH - experiment to discover new technology
  FLEE - run from danger
  DEFEND - protect nearby allies from threats
  SHARE_FOOD <targetId> - give food to a hungry Aetheri
  FIGHT_AGENT <targetId> - fight a rival Aetheri${courtActions}${mateAction}
  ${agent.lifeStage === 'CHILD' ? 'PLAY - play with other children' : ''}
  WANDER - walk around idly

DISCOVERABLE TECHNOLOGIES:
  ${discoverableTechs || 'none currently available - discover prerequisites first'}

IMPORTANT: To discover technology, choose RESEARCH and set discoveryAttempt to the EXACT tech ID (e.g. FIRE, STONE_KNAPPING, COOKING, etc). You need the right materials/conditions nearby.

Decide your next action. Think about survival first, then relationships and advancement.
Respond ONLY with JSON:
{"action":"<ACTION>","target":"<id or item>","thought":"<your inner monologue, max 30 words>","say":"<what you say aloud or null>","discoveryAttempt":"<TECH_ID or null>","placeName":"<name for landmark or null>"}`;
};

export const getAIDecision = async (agent: Agent, gs: GameState): Promise<AgentDecision | null> => {
  if (pendingDecisions.has(agent.id)) return null;
  if (pendingDecisions.size >= MAX_CONCURRENT) return null;

  const lastTime = lastDecisionTime.get(agent.id) || 0;
  if (Date.now() - lastTime < AI_COOLDOWN_MS) return null;

  pendingDecisions.add(agent.id);
  totalRequests++;

  try {
    const prompt = buildPrompt(agent, gs);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt }
        ],
        temperature: 0.75,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();
    const text = data.content || '{}';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);

    const decision: AgentDecision = {
      action: parsed.action || 'WANDER',
      targetId: parsed.target || undefined,
      thoughtProcess: parsed.thought || '...',
      dialogue: parsed.say || undefined,
      discoveryAttempt: parsed.discoveryAttempt || undefined,
      placeName: parsed.placeName || undefined,
      craftItem: parsed.action === 'CRAFT' ? parsed.target : undefined,
      buildType: parsed.action === 'BUILD' ? parsed.target : undefined,
    };

    lastAIThought = { agent: agent.name, thought: decision.thoughtProcess, time: Date.now() };
    lastDecisionTime.set(agent.id, Date.now());
    aiAvailable = true;

    console.log(`%c🧠 ${agent.name}: ${decision.action} - "${decision.thoughtProcess}"`, 'color: #8b5cf6');
    return decision;
  } catch (e: any) {
    totalErrors++;
    if (totalErrors > 5) aiAvailable = false;
    console.warn(`AI error for ${agent.name}:`, e.message);
    return null;
  } finally {
    pendingDecisions.delete(agent.id);
  }
};

export const applyAIDecision = (agent: Agent, decision: AgentDecision, gs: GameState): Partial<Agent> | null => {
  const update: Partial<Agent> = {};

  if (decision.dialogue) {
    update.chatBubble = decision.dialogue;
    update.lastChatTime = Date.now();
  }
  update.currentActionLabel = decision.thoughtProcess;

  switch (decision.action) {
    case 'GATHER': {
      const target = gs.flora.find(f =>
        f.id.startsWith(decision.targetId?.slice(0, 5) || 'XXX') ||
        f.type.toLowerCase().includes((decision.targetId || '').toLowerCase())
      );
      if (target) {
        update.state = AgentState.MOVING;
        update.targetPosition = target.position;
        update.targetId = target.id;
      } else {
        const nearest = gs.flora
          .filter(f => (f.resourcesLeft || 0) > 0 && getDist(f.position, agent.position) < 30)
          .sort((a, b) => getDist(a.position, agent.position) - getDist(b.position, agent.position))[0];
        if (nearest) {
          update.state = AgentState.MOVING;
          update.targetPosition = nearest.position;
          update.targetId = nearest.id;
        }
      }
      break;
    }
    case 'CRAFT': {
      update.state = AgentState.CRAFTING;
      update.targetId = `CRAFT:${decision.craftItem || decision.targetId || ''}`;
      break;
    }
    case 'BUILD': {
      update.state = AgentState.BUILDING;
      const buildX = agent.position.x + (Math.random() - 0.5) * 6;
      const buildZ = agent.position.z + (Math.random() - 0.5) * 6;
      update.targetPosition = { x: buildX, y: 0, z: buildZ };
      update.targetId = `BUILD:${decision.buildType || decision.targetId || ''}`;
      break;
    }
    case 'HUNT': {
      const prey = gs.fauna.find(f => f.id.startsWith(decision.targetId?.slice(0, 5) || 'XXX'))
        || gs.fauna.filter(f => !f.isAggressive).sort((a, b) => getDist(a.position, agent.position) - getDist(b.position, agent.position))[0];
      if (prey) {
        update.state = AgentState.HUNTING;
        update.targetPosition = prey.position;
        update.targetId = prey.id;
      }
      break;
    }
    case 'EAT': {
      update.state = AgentState.EATING;
      update.targetId = 'EAT';
      break;
    }
    case 'DRINK': {
      const water = gs.water?.sort((a, b) => getDist(a.position, agent.position) - getDist(b.position, agent.position))[0];
      if (water) {
        update.state = AgentState.MOVING;
        update.targetPosition = water.position;
        update.targetId = 'DRINK';
      }
      break;
    }
    case 'SLEEP': {
      update.state = AgentState.SLEEPING;
      break;
    }
    case 'TALK':
    case 'SOCIAL': {
      const target = decision.targetId
        ? gs.agents.find(a => a.id.startsWith(decision.targetId?.slice(0, 5) || 'X'))
        : gs.agents.filter(a => a.id !== agent.id).sort((a, b) => getDist(a.position, agent.position) - getDist(b.position, agent.position))[0];
      if (target) {
        update.state = AgentState.MOVING;
        update.targetPosition = target.position;
        update.targetId = target.id;
      }
      break;
    }
    case 'RESPOND': {
      const talker = gs.agents.find(a => a.state === AgentState.SOCIALIZING && a.targetId === agent.id);
      if (talker) {
        update.state = AgentState.SOCIALIZING;
        update.targetId = talker.id;
        const newRel = { ...agent.relationships };
        newRel[talker.id] = (newRel[talker.id] || 0) + 5;
        update.relationships = newRel;
      }
      break;
    }
    case 'EXPLORE': {
      update.state = AgentState.EXPLORING;
      const range = 10 + agent.personality.openness * 20;
      const angle = Math.random() * Math.PI * 2;
      update.targetPosition = {
        x: agent.position.x + Math.sin(angle) * range,
        y: 0,
        z: agent.position.z + Math.cos(angle) * range,
      };
      break;
    }
    case 'RESEARCH': {
      update.state = AgentState.RESEARCHING;
      let techKey = decision.discoveryAttempt || '';
      techKey = techKey.toUpperCase().replace(/\s+/g, '_');
      if (!TECHNOLOGIES[techKey]) {
        const match = Object.values(TECHNOLOGIES).find(t =>
          t.name.toUpperCase() === techKey || t.id === techKey
        );
        if (match) techKey = match.id;
      }
      update.targetId = `RESEARCH:${techKey}`;
      break;
    }
    case 'FLEE': {
      update.state = AgentState.FLEEING;
      update.targetPosition = {
        x: agent.position.x + (Math.random() - 0.5) * 25,
        y: 0,
        z: agent.position.z + (Math.random() - 0.5) * 25,
      };
      break;
    }
    case 'COURT': {
      const courtTarget = decision.targetId
        ? gs.agents.find(a => a.id.startsWith(decision.targetId?.slice(0, 5) || 'X'))
        : undefined;
      if (courtTarget) {
        update.state = AgentState.MOVING;
        update.targetPosition = courtTarget.position;
        update.targetId = `COURT:${courtTarget.id}`;
      }
      break;
    }
    case 'MATE': {
      if (agent.partnerId) {
        const partner = gs.agents.find(a => a.id === agent.partnerId);
        if (partner) {
          update.state = AgentState.MOVING;
          update.targetPosition = partner.position;
          update.targetId = `MATE:${partner.id}`;
        }
      }
      break;
    }
    case 'FIGHT_AGENT': {
      const fightTarget = decision.targetId
        ? gs.agents.find(a => a.id.startsWith(decision.targetId?.slice(0, 5) || 'X'))
        : undefined;
      if (fightTarget) {
        update.state = AgentState.MOVING;
        update.targetPosition = fightTarget.position;
        update.targetId = `FIGHT_AGENT:${fightTarget.id}`;
      }
      break;
    }
    case 'SHARE_FOOD': {
      const shareTarget = decision.targetId
        ? gs.agents.find(a => a.id.startsWith(decision.targetId?.slice(0, 5) || 'X'))
        : gs.agents.filter(a => a.id !== agent.id && a.needs.hunger < 40).sort((a, b) => getDist(a.position, agent.position) - getDist(b.position, agent.position))[0];
      if (shareTarget) {
        update.state = AgentState.MOVING;
        update.targetPosition = shareTarget.position;
        update.targetId = 'SHARE_FOOD';
      }
      break;
    }
    case 'DEFEND': {
      update.state = AgentState.DEFENDING;
      const threat = gs.fauna.find(f => f.isAggressive && getDist(f.position, agent.position) < 15);
      if (threat) {
        update.targetPosition = threat.position;
        update.targetId = threat.id;
      }
      break;
    }
    case 'PLAY': {
      if (agent.lifeStage === 'CHILD') {
        update.state = AgentState.PLAYING;
        const playmate = gs.agents.find(a => a.id !== agent.id && getDist(a.position, agent.position) < 10);
        if (playmate) update.targetId = playmate.id;
      }
      break;
    }
    case 'WANDER':
    default: {
      update.state = AgentState.MOVING;
      update.targetPosition = {
        x: agent.position.x + (Math.random() - 0.5) * 12,
        y: 0,
        z: agent.position.z + (Math.random() - 0.5) * 12,
      };
      break;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
};

export const checkAIHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    aiAvailable = data.apiKeyConfigured;
    return aiAvailable;
  } catch {
    aiAvailable = false;
    return false;
  }
};

checkAIHealth();
setInterval(() => { if (!aiAvailable) checkAIHealth(); }, 15000);
