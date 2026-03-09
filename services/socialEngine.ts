import { Agent, GameState, AgentState, SocialRole } from '../types';

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

function leaderScore(a: Agent) {
  return a.personality.conscientiousness * 2 + a.personality.extraversion * 2 +
    Object.values(a.relationships).filter(r => r > 30).length * 0.4;
}
function teacherScore(a: Agent) {
  return a.knownTechnologies.length * 1.5 + a.personality.openness * 2 + a.personality.conscientiousness;
}
function healerScore(a: Agent) {
  return a.personality.agreeableness * 2.5 + a.personality.conscientiousness +
    (a.skillLevels['medicine'] || 0) * 3;
}

export function assignSocialRoles(agents: Agent[]): Agent[] {
  const adults = agents.filter(a => a.lifeStage !== 'CHILD');
  if (adults.length < 2) return agents;

  const sortedLeader  = [...adults].sort((a, b) => leaderScore(b) - leaderScore(a));
  const sortedTeacher = [...adults].sort((a, b) => teacherScore(b) - teacherScore(a));
  const sortedHealer  = [...adults].sort((a, b) => healerScore(b) - healerScore(a));

  const leaderId   = sortedLeader[0]?.id;
  const teacherId  = sortedTeacher.find(a => a.id !== leaderId)?.id;
  const healerId   = sortedHealer.find(a => a.id !== leaderId && a.id !== teacherId)?.id;
  const elders     = new Set(adults.filter(a => a.lifeStage === 'ELDER').slice(0, 2).map(a => a.id));
  const outcasts   = new Set(
    adults.filter(a => Object.values(a.relationships).reduce((s, r) => s + r, 0) < -60).map(a => a.id)
  );

  return agents.map(a => {
    if (a.lifeStage === 'CHILD') return { ...a, socialRole: 'MEMBER' as SocialRole };
    if (outcasts.has(a.id)) return { ...a, socialRole: 'OUTCAST' as SocialRole };
    if (a.id === leaderId) return { ...a, socialRole: 'LEADER' as SocialRole };
    if (elders.has(a.id)) return { ...a, socialRole: 'ELDER_ROLE' as SocialRole };
    if (a.id === teacherId) return { ...a, socialRole: 'TEACHER' as SocialRole };
    if (a.id === healerId) return { ...a, socialRole: 'HEALER' as SocialRole };
    return { ...a, socialRole: 'MEMBER' as SocialRole };
  });
}

export function processSocialInfluence(agents: Agent[], gs: GameState): Agent[] {
  return agents.map(agent => {
    const nearby = gs.agents.filter(a => a.id !== agent.id && dist2(a.position, agent.position) < 8);
    if (nearby.length === 0) return agent;

    const neuro = { ...agent.neuro };
    const empathy = agent.personality.agreeableness * 0.25;

    for (const other of nearby) {
      neuro.serotonin = neuro.serotonin * (1 - empathy) + other.neuro.serotonin * empathy;
      neuro.cortisol  = neuro.cortisol  * (1 - empathy * 0.4) + other.neuro.cortisol * empathy * 0.4;

      if (other.socialRole === 'LEADER' && (agent.relationships[other.id] ?? 0) > 10) {
        neuro.dopamine  = Math.min(100, neuro.dopamine + 0.15);
        neuro.serotonin = Math.min(100, neuro.serotonin + 0.08);
      }
      if (other.socialRole === 'HEALER' && agent.sickness !== 'NONE') {
        neuro.cortisol  = Math.max(0, neuro.cortisol - 0.2);
        neuro.serotonin = Math.min(100, neuro.serotonin + 0.1);
      }
    }

    return { ...agent, neuro };
  });
}

export function spreadKnowledge(agents: Agent[], gs: GameState): { agents: Agent[]; logs: string[] } {
  const logs: string[] = [];
  const updated = agents.map(a => ({ ...a }));

  for (let i = 0; i < updated.length; i++) {
    const teacher = updated[i];
    const isTeaching = teacher.state === AgentState.TEACHING || teacher.state === AgentState.SOCIALIZING;
    const canTeach = teacher.socialRole === 'TEACHER' || teacher.socialRole === 'ELDER_ROLE';
    if (!isTeaching || !canTeach) continue;

    const students = updated.filter((a, idx) =>
      idx !== i && dist2(a.position, teacher.position) < 7 && a.lifeStage !== 'CHILD'
    );

    for (const student of students) {
      const unlearned = teacher.knownTechnologies.filter(t => !student.knownTechnologies.includes(t));
      if (unlearned.length === 0) continue;
      if (Math.random() > 0.04 * teacher.personality.conscientiousness) continue;

      const tech = unlearned[Math.floor(Math.random() * unlearned.length)];
      const idx = updated.findIndex(a => a.id === student.id);
      if (idx < 0) continue;

      updated[idx] = {
        ...updated[idx],
        knownTechnologies: [...updated[idx].knownTechnologies, tech],
        skillLevels: { ...updated[idx].skillLevels, knowledge: (updated[idx].skillLevels.knowledge || 0) + 0.08 },
        neuro: { ...updated[idx].neuro, dopamine: Math.min(100, updated[idx].neuro.dopamine + 10) },
      };
      logs.push(`${teacher.name} [${teacher.socialRole}] taught ${student.name}: ${tech}`);
    }
  }

  return { agents: updated, logs };
}
