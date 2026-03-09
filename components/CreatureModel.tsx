import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentState } from '../types';
import { getCharacterVariation, computeEmotionState, CharacterVariation, EmotionState } from './CharacterVariation';

interface CreatureModelProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
  debugMode?: boolean;
}

const _targetPos = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _currentQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _v3 = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();

function lerpN(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function desaturateColor(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.max(0, hsl.s * (1 - amount));
  hsl.l = Math.min(1, hsl.l + amount * 0.08);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + c.getHexString();
}

function shiftHue(hex: string, shift: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + shift) % 1;
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + c.getHexString();
}

interface Particle {
  id: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  color: string; size: number;
}

const MAX_PARTICLES = 16;

function ParticleSystem({ particlesRef }: { particlesRef: React.MutableRefObject<Particle[]> }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array.from({ length: MAX_PARTICLES }, () => null));
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>(Array.from({ length: MAX_PARTICLES }, () => null));
  const geo = useMemo(() => new THREE.SphereGeometry(1, 4, 3), []);

  useFrame(() => {
    const ps = particlesRef.current;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = meshRefs.current[i];
      const mat = matRefs.current[i];
      if (!mesh || !mat) continue;
      if (i < ps.length) {
        mesh.visible = true;
        mesh.position.set(ps[i].x, ps[i].y, ps[i].z);
        mesh.scale.setScalar(ps[i].size * (ps[i].life / ps[i].maxLife));
        mat.opacity = ps[i].life / ps[i].maxLife;
        mat.color.set(ps[i].color);
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_PARTICLES }).map((_, i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el; }} visible={false}>
          <primitive object={geo} attach="geometry" />
          <meshBasicMaterial ref={el => { matRefs.current[i] = el as any; }} transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function EquippedTool({ tool, mat }: { tool: string; mat: THREE.Material }) {
  if (tool.includes('axe') || tool.includes('hatchet')) {
    const metalColor = tool.includes('iron') ? '#777' : tool.includes('copper') ? '#b87333' : '#999';
    return (
      <group rotation={[0.3, 0.1, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.02, 0.44, 5]} />
          <meshStandardMaterial color="#7a4e2d" flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0.07, -0.04, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.14, 0.09, 0.035]} />
          <meshStandardMaterial color={metalColor} flatShading roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
    );
  }
  if (tool.includes('spear') || tool.includes('lance')) {
    return (
      <group rotation={[0.15, 0, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.62, 5]} />
          <meshStandardMaterial color="#7a4e2d" flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <coneGeometry args={[0.045, 0.13, 4]} />
          <meshStandardMaterial color="#aaa" flatShading roughness={0.4} metalness={0.5} />
        </mesh>
      </group>
    );
  }
  if (tool.includes('bow')) {
    return (
      <group rotation={[0, 0, 0.4]}>
        <mesh>
          <torusGeometry args={[0.12, 0.012, 4, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color="#8b5a2b" flatShading roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (tool.includes('basket') || tool.includes('bag') || tool.includes('pouch')) {
    return (
      <group>
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.09, 6, 5]} />
          <meshStandardMaterial color="#c8a46e" flatShading roughness={0.9} />
        </mesh>
      </group>
    );
  }
  return null;
}

function AntennaGeometry({ style }: { style: string }) {
  if (style === 'twin') return (
    <>
      <mesh position={[-0.1, 0.21, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.015, 0.025, 0.18, 4]} />
        <meshStandardMaterial color="#888" flatShading roughness={0.6} />
      </mesh>
      <mesh position={[-0.1, 0.32, 0]} rotation={[0, 0, -0.25]}>
        <sphereGeometry args={[0.028, 5, 4]} />
        <meshStandardMaterial color="#cc4444" flatShading roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.21, 0]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.015, 0.025, 0.18, 4]} />
        <meshStandardMaterial color="#888" flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.32, 0]} rotation={[0, 0, 0.25]}>
        <sphereGeometry args={[0.028, 5, 4]} />
        <meshStandardMaterial color="#cc4444" flatShading roughness={0.5} />
      </mesh>
    </>
  );
  if (style === 'single') return (
    <>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.22, 4]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <sphereGeometry args={[0.035, 5, 4]} />
        <meshStandardMaterial color="#4499cc" flatShading roughness={0.4} />
      </mesh>
    </>
  );
  if (style === 'curl') return (
    <>
      <mesh position={[-0.08, 0.22, 0]} rotation={[0, 0, -0.6]}>
        <torusGeometry args={[0.06, 0.012, 4, 8, Math.PI * 1.2]} />
        <meshStandardMaterial color="#996633" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[0.08, 0.22, 0]} rotation={[0, 0, 0.6]}>
        <torusGeometry args={[0.06, 0.012, 4, 8, Math.PI * 1.2]} />
        <meshStandardMaterial color="#996633" flatShading roughness={0.7} />
      </mesh>
    </>
  );
  return null;
}

function CarriedItem({ item }: { item: string }) {
  if (!item) return null;
  if (item.includes('wood') || item.includes('log') || item.includes('branch')) {
    return (
      <mesh position={[0, -0.05, 0.04]} rotation={[Math.PI / 2, 0, 0.3]}>
        <cylinderGeometry args={[0.025, 0.03, 0.35, 5]} />
        <meshStandardMaterial color="#8B6914" flatShading roughness={0.9} />
      </mesh>
    );
  }
  if (item.includes('stone') || item.includes('rock') || item.includes('ore')) {
    return (
      <mesh position={[0, -0.06, 0.02]}>
        <dodecahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#888" flatShading roughness={0.9} />
      </mesh>
    );
  }
  if (item.includes('food') || item.includes('berry') || item.includes('fruit') || item.includes('herb')) {
    return (
      <mesh position={[0, -0.04, 0]}>
        <sphereGeometry args={[0.055, 5, 4]} />
        <meshStandardMaterial color="#cc5533" flatShading roughness={0.7} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, -0.05, 0]}>
      <boxGeometry args={[0.09, 0.07, 0.05]} />
      <meshStandardMaterial color="#c8a46e" flatShading roughness={0.8} />
    </mesh>
  );
}

const STATE_ICONS: Partial<Record<AgentState, string>> = {
  [AgentState.EATING]: '🍖',
  [AgentState.DRINKING]: '💧',
  [AgentState.SLEEPING]: '💤',
  [AgentState.GATHERING]: '🌿',
  [AgentState.CRAFTING]: '⚒',
  [AgentState.BUILDING]: '🏗',
  [AgentState.SOCIALIZING]: '💬',
  [AgentState.RESEARCHING]: '🔬',
  [AgentState.TEACHING]: '📖',
  [AgentState.CELEBRATING]: '🎉',
  [AgentState.COURTING]: '💕',
  [AgentState.MOURNING]: '😢',
  [AgentState.FLEEING]: '💨',
  [AgentState.FIGHTING]: '⚔',
  [AgentState.HUNTING]: '🏹',
  [AgentState.THINKING]: '💭',
  [AgentState.EXPLORING]: '🔭',
};

const SICK_TINT: Record<string, string> = {
  COLD: '#aaddff',
  FOOD_POISON: '#aaffaa',
  INJURY: '#ffaaaa',
  NONE: '',
};

function buildMaterial(color: string, roughness = 0.75, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness });
}

export const CreatureModel: React.FC<CreatureModelProps> = ({ agent, isSelected, onClick, debugMode = false }) => {
  const rootRef = useRef<THREE.Group>(null!);
  const wholeRef = useRef<THREE.Group>(null!);
  const hipsRef = useRef<THREE.Group>(null!);
  const spineRef = useRef<THREE.Group>(null!);
  const chestRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const neckRef = useRef<THREE.Mesh>(null!);
  const lShoulderRef = useRef<THREE.Group>(null!);
  const rShoulderRef = useRef<THREE.Group>(null!);
  const lElbowRef = useRef<THREE.Group>(null!);
  const rElbowRef = useRef<THREE.Group>(null!);
  const lWristRef = useRef<THREE.Group>(null!);
  const rWristRef = useRef<THREE.Group>(null!);
  const lHipJointRef = useRef<THREE.Group>(null!);
  const rHipJointRef = useRef<THREE.Group>(null!);
  const lKneeRef = useRef<THREE.Group>(null!);
  const rKneeRef = useRef<THREE.Group>(null!);
  const lAnkleRef = useRef<THREE.Group>(null!);
  const rAnkleRef = useRef<THREE.Group>(null!);
  const lEyeRef = useRef<THREE.Mesh>(null!);
  const rEyeRef = useRef<THREE.Mesh>(null!);
  const lEyeLidRef = useRef<THREE.Mesh>(null!);
  const rEyeLidRef = useRef<THREE.Mesh>(null!);
  const selRingRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);
  const tailRef = useRef<THREE.Group>(null!);
  const lAntennaRef = useRef<THREE.Group>(null!);
  const rAntennaRef = useRef<THREE.Group>(null!);

  const prevStateRef = useRef<AgentState>(agent.state);
  const blendRef = useRef(1);
  const particlesRef = useRef<Particle[]>([]);
  const pidRef = useRef(0);
  const blinkTimerRef = useRef(Math.random() * 3 + 2);
  const blinkPhaseRef = useRef(0);
  const idleSubstateRef = useRef(0);
  const idleSubstateTimerRef = useRef(Math.random() * 4 + 2);
  const weightShiftRef = useRef(0);
  const headGlanceTargetRef = useRef({ x: 0, y: 0 });
  const headGlanceRef = useRef({ x: 0, y: 0 });
  const fidgetTimerRef = useRef(Math.random() * 5 + 3);
  const prevVelocityRef = useRef(0);
  const settleRef = useRef(0);
  const emotionCacheRef = useRef<EmotionState>({ postureHunch: 0, energyLevel: 1, urgency: 0, happiness: 0.5, fear: 0, socialOpenness: 0.5 });
  const emotionUpdateTimerRef = useRef(0);

  const variation = useMemo(() => getCharacterVariation(agent), [agent.id]);
  const isChild = agent.lifeStage === 'CHILD';
  const isElder = agent.lifeStage === 'ELDER';
  const healthPct = agent.needs.health / 100;
  const sickTint = SICK_TINT[agent.sickness] || '';

  const skin = useMemo(() => {
    let col = isElder ? desaturateColor(agent.skinTone, 0.3) : agent.skinTone;
    if (sickTint) col = new THREE.Color(col).lerp(new THREE.Color(sickTint), 0.3).getStyle();
    return buildMaterial(col, 0.8);
  }, [agent.skinTone, isElder, sickTint]);

  const cloth = useMemo(() => {
    const col = isElder ? desaturateColor(agent.color, 0.25) : agent.color;
    return buildMaterial(col, 0.72);
  }, [agent.color, isElder]);

  const cloth2 = useMemo(() => {
    const base = isElder ? desaturateColor(agent.color, 0.25) : agent.color;
    const shifted = shiftHue(base, variation.outfitVariant * 0.08);
    return buildMaterial(shifted, 0.75);
  }, [agent.color, isElder, variation.outfitVariant]);

  const marking = useMemo(() => {
    const col = isElder ? desaturateColor(agent.markings, 0.25) : agent.markings;
    return buildMaterial(col, 0.7);
  }, [agent.markings, isElder]);

  const eyeWhite = useMemo(() => buildMaterial('#f0ede8', 0.5), []);
  const eyePupil = useMemo(() => buildMaterial(variation.eyeColor, 0.3), [variation.eyeColor]);
  const eyeLidMat = useMemo(() => buildMaterial(skin.color.getStyle(), 0.8), [agent.skinTone]);
  const noseMat = useMemo(() => buildMaterial(skin.color.getStyle(), 0.85), [agent.skinTone]);
  const toothMat = useMemo(() => buildMaterial('#f0ede8', 0.4), []);
  const mouthMat = useMemo(() => buildMaterial('#c46060', 0.6), []);
  const hairMat = useMemo(() => buildMaterial(variation.hairColor, 0.9), [variation.hairColor]);

  const sw = variation.shoulderWidth;
  const lLen = variation.limbLength;

  useFrame((_, delta) => {
    if (!rootRef.current) return;
    const dt = Math.min(delta, 0.1);
    const t = performance.now() * 0.001;
    const state = agent.state;

    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      blendRef.current = 0;
      const prevSpeed = prevVelocityRef.current;
      if (prevSpeed > 0.5) settleRef.current = 0.4;
    }
    blendRef.current = Math.min(1, blendRef.current + dt / 0.22);

    if (settleRef.current > 0) settleRef.current = Math.max(0, settleRef.current - dt * 1.5);

    emotionUpdateTimerRef.current -= dt;
    if (emotionUpdateTimerRef.current <= 0) {
      emotionUpdateTimerRef.current = 0.5;
      emotionCacheRef.current = computeEmotionState(agent);
    }
    const emo = emotionCacheRef.current;

    _targetPos.set(agent.position.x, agent.position.y, agent.position.z);
    rootRef.current.position.lerp(_targetPos, dt * 8);

    const speed = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.z ** 2);
    prevVelocityRef.current = speed;
    const rotSpeed = state === AgentState.FLEEING ? 12 : state === AgentState.MOVING ? 9 : 6;
    _targetQuat.setFromAxisAngle(_yAxis, agent.rotation);
    _currentQuat.copy(rootRef.current.quaternion);
    _currentQuat.slerp(_targetQuat, dt * rotSpeed);
    rootRef.current.quaternion.copy(_currentQuat);

    if (wholeRef.current) {
      const s = variation.heightScale;
      _scaleVec.set(s, s, s);
      wholeRef.current.scale.lerp(_scaleVec, dt * 5);
    }

    blinkTimerRef.current -= dt;
    let eyeScaleY = 1;
    if (state === AgentState.SLEEPING) {
      eyeScaleY = 0;
    } else if (blinkTimerRef.current <= 0) {
      blinkPhaseRef.current += dt * 18;
      const blinkVal = Math.sin(blinkPhaseRef.current);
      eyeScaleY = blinkVal < 0 ? 0.05 : 0.5 + blinkVal * 0.5;
      if (blinkPhaseRef.current >= Math.PI) {
        blinkPhaseRef.current = 0;
        blinkTimerRef.current = 2 + Math.random() * 4.5;
      }
    }

    idleSubstateTimerRef.current -= dt;
    if (idleSubstateTimerRef.current <= 0) {
      const numSubstates = variation.idleTendency === 'restless' ? 5 : variation.idleTendency === 'curious' ? 4 : 3;
      idleSubstateRef.current = (idleSubstateRef.current + 1) % numSubstates;
      idleSubstateTimerRef.current = 2.5 + Math.random() * 4;
      if (variation.idleTendency === 'restless') idleSubstateTimerRef.current *= 0.6;
      if (idleSubstateRef.current === 1 || idleSubstateRef.current === 3) {
        headGlanceTargetRef.current = {
          x: (Math.random() - 0.5) * 0.5,
          y: (Math.random() - 0.5) * 0.8,
        };
      }
    }

    headGlanceRef.current.x = lerpN(headGlanceRef.current.x, headGlanceTargetRef.current.x, dt * 2);
    headGlanceRef.current.y = lerpN(headGlanceRef.current.y, headGlanceTargetRef.current.y, dt * 2);

    fidgetTimerRef.current -= dt;

    const ip = variation.idlePhase;
    const ii = variation.idleIntensity;
    const pp = variation.personalityPhase;

    const postureHunch = emo.postureHunch;
    const energyMod = emo.energyLevel;
    const urgencyMod = emo.urgency;
    const happinessMod = emo.happiness;
    const fearMod = emo.fear;

    const breatheSpd = 1.8 + (1 - energyMod) * 0.5;
    const breatheAmp = 0.013 + (1 - energyMod) * 0.008;
    const breathe = Math.sin(t * breatheSpd + ip) * breatheAmp;

    const hip: { y: number; rotX: number; rotY: number; rotZ: number } = { y: 0, rotX: 0, rotY: 0, rotZ: 0 };
    const spine: { rotX: number; rotY: number; rotZ: number; scX: number; scY: number; scZ: number } = {
      rotX: postureHunch * 0.3,
      rotY: 0, rotZ: 0, scX: 1 + breathe, scY: 1, scZ: 1 + breathe
    };
    const head = { rotX: -postureHunch * 0.12, rotY: 0, rotZ: 0 };
    const lSh = { rotX: 0, rotY: 0, rotZ: 0.18 + postureHunch * 0.1 };
    const rSh = { rotX: 0, rotY: 0, rotZ: -(0.18 + postureHunch * 0.1) };
    const lEl = { rotX: 0, rotY: 0 };
    const rEl = { rotX: 0, rotY: 0 };
    const lWr = { rotX: 0, rotZ: 0 };
    const rWr = { rotX: 0, rotZ: 0 };
    const lHip = { rotX: 0, rotY: 0, rotZ: 0 };
    const rHip = { rotX: 0, rotY: 0, rotZ: 0 };
    const lKn = { rotX: 0 };
    const rKn = { rotX: 0 };
    const lAnk = { rotX: 0 };
    const rAnk = { rotX: 0 };
    const tail = { rotX: 0.4, rotY: 0, rotZ: 0 };

    const postureOffset = variation.posturePreset === 'upright' ? -0.06 : variation.posturePreset === 'slouched' ? 0.12 : 0.03;
    spine.rotX += postureOffset;

    switch (state) {
      case AgentState.IDLE: {
        const sub = idleSubstateRef.current;

        const swayX = Math.sin(t * 0.55 + ip) * 0.06 * ii;
        const swayZ = Math.sin(t * 0.38 + ip + 1) * 0.02 * ii;
        hip.y = Math.sin(t * 1.1 + ip) * 0.008 * ii;
        hip.rotZ = swayX * 0.3;
        spine.rotZ = swayZ;
        spine.rotY = Math.sin(t * 0.3 + pp) * 0.025 * ii;

        if (sub === 0) {
          head.rotY = lerpN(head.rotY, headGlanceRef.current.x, 0.1);
          head.rotX = lerpN(head.rotX, head.rotX + headGlanceRef.current.y * 0.15, 0.1);
          lSh.rotX = Math.sin(t * 0.5 + ip) * 0.05 * ii;
          rSh.rotX = Math.sin(t * 0.5 + ip + 1.2) * 0.05 * ii;
        } else if (sub === 1) {
          head.rotY = headGlanceRef.current.y;
          head.rotX += -0.05 + Math.sin(t * 1.2 + ip) * 0.04;
          rSh.rotX = -0.15 + Math.sin(t * 2 + pp) * 0.12;
          rEl.rotX = -0.2 + Math.sin(t * 2 + pp) * 0.1;
        } else if (sub === 2) {
          weightShiftRef.current = lerpN(weightShiftRef.current, -0.04, dt * 2);
          hip.rotZ += weightShiftRef.current;
          lHip.rotX = 0.04;
          rHip.rotX = -0.04;
          lSh.rotZ += 0.04;
          rSh.rotZ -= 0.04;
        } else if (sub === 3) {
          head.rotY = headGlanceRef.current.y * 1.2;
          head.rotX += 0.08 + Math.sin(t * 0.8) * 0.04;
          spine.rotX += 0.06;
          rSh.rotX = -1.4;
          rSh.rotZ = 0.15;
          rEl.rotX = -1.5;
        } else {
          if (fidgetTimerRef.current <= 0) {
            fidgetTimerRef.current = 4 + Math.random() * 6;
          }
          const fidgetPhase = Math.sin(t * 3 + pp);
          lSh.rotX = fidgetPhase * 0.1;
          lEl.rotX = -Math.abs(fidgetPhase) * 0.15;
          hip.y += Math.abs(Math.sin(t * 2.5)) * 0.012;
          tail.rotZ = Math.sin(t * 3 + ip) * 0.25;
        }

        tail.rotX = 0.3 + Math.sin(t * 1.5 + ip) * 0.12;
        tail.rotY = Math.sin(t * 0.7 + ip) * 0.2;

        if (variation.idleTendency === 'restless') {
          hip.y += Math.abs(Math.sin(t * 3 + ip)) * 0.015;
          lHip.rotX += Math.sin(t * 3 + ip) * 0.04;
          rHip.rotX += Math.sin(t * 3 + ip + Math.PI) * 0.04;
        }

        if (fearMod > 0.3) {
          spine.rotX += fearMod * 0.2;
          head.rotX += fearMod * 0.1;
          lSh.rotX -= fearMod * 0.3;
          rSh.rotX -= fearMod * 0.3;
        }
        break;
      }

      case AgentState.MOVING:
      case AgentState.EXPLORING: {
        const isExploring = state === AgentState.EXPLORING;
        const urgencyFactor = isExploring ? 0.6 : 1.0 + urgencyMod * 0.6;
        const walkSpeed = isExploring ? 5.5 : (7 + urgencyMod * 3) * urgencyFactor;
        const legSwing = (isExploring ? 0.45 : 0.58) + urgencyMod * 0.15;
        const armSwing = (isExploring ? 0.3 : 0.4) + urgencyMod * 0.1;
        const bobAmp = (0.05 + urgencyMod * 0.04) * variation.walkBobScale;
        const hipSway = 0.04 + urgencyMod * 0.02;

        const walkT = t * walkSpeed;
        const bounce = Math.abs(Math.sin(walkT)) * bobAmp;
        hip.y = bounce - (1 - energyMod) * 0.08;
        hip.rotZ = Math.sin(walkT) * hipSway;
        spine.rotX += -0.06 + urgencyMod * 0.1 + (1 - energyMod) * 0.15;
        spine.rotY = Math.sin(walkT) * 0.07;

        lHip.rotX = Math.sin(walkT) * legSwing;
        rHip.rotX = Math.sin(walkT + Math.PI) * legSwing;
        const lLegPhase = Math.sin(walkT);
        const rLegPhase = Math.sin(walkT + Math.PI);
        lKn.rotX = Math.max(0, -lLegPhase * 0.55);
        rKn.rotX = Math.max(0, -rLegPhase * 0.55);
        lAnk.rotX = lLegPhase > 0 ? lLegPhase * 0.15 : 0;
        rAnk.rotX = rLegPhase > 0 ? rLegPhase * 0.15 : 0;

        lSh.rotX = Math.sin(walkT + Math.PI) * armSwing;
        rSh.rotX = Math.sin(walkT) * armSwing;
        lEl.rotX = -Math.abs(Math.sin(walkT + Math.PI)) * 0.28;
        rEl.rotX = -Math.abs(Math.sin(walkT)) * 0.28;

        if (isExploring) {
          rSh.rotX = Math.sin(walkT) * 0.2 - 0.8;
          rSh.rotZ = -0.3;
          rEl.rotX = -0.4;
          head.rotY = Math.sin(t * 1.5 + ip) * 0.45;
          head.rotX = -0.12;
        }

        const settleOffset = settleRef.current;
        if (settleOffset > 0) {
          const s = settleOffset * 0.4;
          hip.y += Math.sin(t * 12) * s * 0.06;
          lKn.rotX += s * 0.2;
          rKn.rotX += s * 0.2;
        }

        if (fearMod > 0.4) {
          spine.rotX += fearMod * 0.15;
        }
        if (energyMod < 0.3) {
          spine.rotX += 0.12;
          hip.y -= 0.06;
        }

        tail.rotX = 0.2 + Math.sin(walkT * 0.5) * 0.2;
        tail.rotZ = Math.sin(walkT * 0.7) * 0.3;
        break;
      }

      case AgentState.FLEEING: {
        const spd = 14 + urgencyMod * 4;
        const runT = t * spd;
        const legSwing = 0.78 + urgencyMod * 0.12;
        const armSwing = 0.72;

        spine.rotX += 0.22 + fearMod * 0.12;
        hip.y = Math.abs(Math.sin(runT)) * 0.1 + fearMod * 0.04;
        hip.rotZ = Math.sin(runT) * 0.05;
        head.rotX = -0.1;

        lHip.rotX = Math.sin(runT) * legSwing;
        rHip.rotX = Math.sin(runT + Math.PI) * legSwing;
        lKn.rotX = Math.max(0, -Math.sin(runT) * 0.65);
        rKn.rotX = Math.max(0, -Math.sin(runT + Math.PI) * 0.65);
        lSh.rotX = Math.sin(runT + Math.PI) * armSwing;
        rSh.rotX = Math.sin(runT) * armSwing;
        lEl.rotX = -0.9;
        rEl.rotX = -0.9;

        tail.rotX = -0.2;
        tail.rotZ = Math.sin(runT * 0.5) * 0.4;
        break;
      }

      case AgentState.GATHERING: {
        const cycle = (Math.sin(t * 2.5) + 1) * 0.5;
        const reachPhase = Math.sin(t * 2.5);
        spine.rotX += 0.38 + cycle * 0.25 + postureHunch * 0.1;
        hip.y = -0.12 * cycle;
        head.rotX = 0.12 + cycle * 0.08;

        lSh.rotX = -0.85 + cycle * 0.45;
        rSh.rotX = -0.7 + reachPhase * 0.5;
        lEl.rotX = -0.75 + cycle * 0.35;
        rEl.rotX = -0.6 + reachPhase * 0.3;
        lWr.rotX = cycle * 0.3;
        rWr.rotX = cycle * 0.3;

        lHip.rotX = 0.18 + cycle * 0.08;
        rHip.rotX = 0.18;
        lKn.rotX = 0.25 * cycle;
        rKn.rotX = 0.18;

        tail.rotX = 0.1;
        tail.rotY = Math.sin(t * 2) * 0.15;
        break;
      }

      case AgentState.EATING: {
        hip.y = -0.22;
        lHip.rotX = -1.05;
        rHip.rotX = -1.05;
        lKn.rotX = 1.05;
        rKn.rotX = 1.05;
        spine.rotX += 0.12;

        const bite = Math.sin(t * 4.5);
        const chew = Math.sin(t * 8 + 0.5);
        rSh.rotX = -1.75 + bite * 0.22;
        rEl.rotX = -1.15 + bite * 0.12;
        rWr.rotX = bite * 0.1;
        lSh.rotX = -0.35;
        lEl.rotX = -0.45;
        head.rotX = chew * 0.06 + 0.1 + bite * 0.04;
        head.rotY = Math.sin(t * 0.5) * 0.06;

        if (happinessMod > 0.5) {
          tail.rotX = 0.5;
          tail.rotZ = Math.sin(t * 4) * 0.35;
        }
        break;
      }

      case AgentState.DRINKING: {
        hip.y = -0.28;
        spine.rotX += 0.45;
        lHip.rotX = -1.15;
        rHip.rotX = -1.15;
        lKn.rotX = 1.15;
        rKn.rotX = 1.15;
        const sip = Math.sin(t * 2) * 0.12;
        head.rotX = 0.35 + sip;
        lSh.rotX = -0.55 + sip * 0.3;
        rSh.rotX = -0.55 + sip * 0.3;
        lEl.rotX = -0.5;
        rEl.rotX = -0.5;
        lWr.rotX = 0.2;
        rWr.rotX = 0.2;
        break;
      }

      case AgentState.SLEEPING: {
        hip.rotZ = Math.PI / 2.1;
        hip.y = -0.22;
        head.rotX = 0.22;
        head.rotY = 0.15;
        eyeScaleY = 0;
        const sleepBreathe = Math.sin(t * 1.0) * 0.05;
        spine.scX = 1 + sleepBreathe;
        spine.scZ = 1 + sleepBreathe;
        lSh.rotX = 0.25;
        rSh.rotX = 0.25;
        lSh.rotZ = 0.5;
        rSh.rotZ = -0.5;
        lHip.rotX = 0.3;
        rHip.rotX = 0.1;
        lKn.rotX = 0.45;
        rKn.rotX = 0.2;
        tail.rotX = 0.1;
        break;
      }

      case AgentState.CRAFTING: {
        hip.y = -0.26;
        lHip.rotX = -1.4;
        rHip.rotX = -1.4;
        lKn.rotX = 1.4;
        rKn.rotX = 1.4;
        head.rotX = 0.28;
        spine.rotX += 0.18;

        const hammering = t * 7;
        const hammerDown = Math.sin(hammering);
        const hammerBounce = Math.max(0, -hammerDown);
        rSh.rotX = -0.65 + hammerBounce * 0.7;
        rEl.rotX = -0.9 + hammerBounce * 0.5;
        rWr.rotX = hammerBounce * 0.4;
        lSh.rotX = -0.45;
        lEl.rotX = -0.55;
        lWr.rotX = 0.2;
        spine.rotY = Math.sin(hammering * 0.5) * 0.06;
        head.rotY = Math.sin(hammering * 0.5) * 0.05;
        break;
      }

      case AgentState.BUILDING: {
        const reach = t * 4;
        const reachSin = Math.sin(reach);
        lSh.rotX = -2.4 + reachSin * 0.35;
        rSh.rotX = -2.4 + Math.sin(reach + 0.8) * 0.35;
        lEl.rotX = -0.25 + reachSin * 0.1;
        rEl.rotX = -0.25;
        head.rotX = -0.2;
        spine.rotX += -0.08;
        hip.y = Math.sin(reach * 0.5) * 0.04;

        const stepCycle = Math.sin(t * 1.8) * 0.12;
        lHip.rotX = stepCycle > 0 ? stepCycle * 0.25 : 0;
        rHip.rotX = stepCycle < 0 ? -stepCycle * 0.25 : 0;
        tail.rotX = 0.3;
        tail.rotY = Math.sin(t * 2) * 0.2;
        break;
      }

      case AgentState.THINKING: {
        const thinkSway = Math.sin(t * 0.7 + ip);
        rSh.rotX = -1.75;
        rSh.rotZ = 0.22;
        rEl.rotX = -1.8;
        lSh.rotX = -0.55;
        lSh.rotZ = 0.55;
        lEl.rotX = -0.7;
        hip.y = Math.sin(t * 0.7 + ip) * 0.01;
        head.rotX = -0.1 + thinkSway * 0.04;
        head.rotZ = Math.sin(t * 1.1 + pp) * 0.12;
        head.rotY = Math.sin(t * 0.5 + pp) * 0.1;
        spine.rotY = Math.sin(t * 0.4 + ip) * 0.04;
        tail.rotY = Math.sin(t * 1.2 + ip) * 0.2;
        break;
      }

      case AgentState.SOCIALIZING: {
        const socialEnergy = 1 + variation.idleIntensity * 0.3;
        const talkPhase = t * 3.5;
        const listening = Math.sin(t * 2) > 0;

        if (listening) {
          head.rotX = -0.08;
          head.rotY = headGlanceRef.current.y * 0.5;
          lSh.rotX = Math.sin(talkPhase * 0.7 + ip) * 0.12;
          rSh.rotX = Math.sin(talkPhase * 0.6 + ip + 1) * 0.1;
          hip.y = Math.sin(t * 1.5 + ip) * 0.01 * socialEnergy;
        } else {
          lSh.rotX = -0.45 + Math.sin(talkPhase + ip) * 0.55 * socialEnergy;
          rSh.rotX = -0.3 + Math.sin(talkPhase + ip + 1.3) * 0.45 * socialEnergy;
          lEl.rotX = -0.35 + Math.sin(talkPhase * 1.2) * 0.25;
          rEl.rotX = -0.35 + Math.sin(talkPhase * 1.2 + 0.8) * 0.2;
          head.rotY = Math.sin(t * 2 + pp) * 0.28;
          head.rotX = Math.sin(t * 3.5 + ip) * 0.1;
          hip.y = Math.max(0, Math.sin(t * 5 + ip)) * 0.05 * socialEnergy;
        }

        spine.rotY = Math.sin(t * 1.8 + pp) * 0.06;
        tail.rotX = 0.4 + Math.sin(t * 3) * 0.15;
        tail.rotZ = Math.sin(t * 2) * 0.25;

        if (happinessMod > 0.6) {
          hip.y += Math.abs(Math.sin(t * 6 + ip)) * 0.04;
          tail.rotZ *= 1.5;
        }
        break;
      }

      case AgentState.RESEARCHING: {
        hip.y = -0.22;
        lHip.rotX = -1.2;
        rHip.rotX = -1.2;
        lKn.rotX = 1.2;
        rKn.rotX = 1.2;
        rSh.rotX = -1.5;
        rEl.rotX = -1.25;
        lSh.rotX = -0.85 + Math.sin(t * 2 + ip) * 0.45;
        lEl.rotX = -0.55 + Math.sin(t * 2 + ip) * 0.35;
        head.rotZ = Math.sin(t * 1.0 + ip) * 0.18;
        head.rotX = -0.08 + Math.sin(t * 0.6 + pp) * 0.06;
        head.rotY = Math.sin(t * 0.9 + ip) * 0.1;
        spine.rotX += 0.08;
        spine.rotY = Math.sin(t * 0.5 + pp) * 0.04;
        break;
      }

      case AgentState.TEACHING: {
        const emphasis = Math.sin(t * 2.2 + pp);
        rSh.rotX = -2.75 + emphasis * 0.35;
        rEl.rotX = -0.28;
        lSh.rotX = -0.15 + Math.sin(t * 1.4 + ip) * 0.3;
        lEl.rotX = -0.2;
        head.rotX = Math.sin(t * 2.5 + pp) * 0.1;
        head.rotY = Math.sin(t * 1.6 + ip) * 0.18;
        hip.y = Math.sin(t * 1.8 + ip) * 0.015;
        spine.rotY = Math.sin(t * 1.8 + pp) * 0.06;
        spine.rotX += -0.04;
        tail.rotX = 0.25;
        tail.rotY = Math.sin(t * 1.5) * 0.2;
        break;
      }

      case AgentState.FIGHTING: {
        const punchT = t * 9;
        const punch = Math.sin(punchT);
        const dodge = Math.sin(t * 5.5 + pp);
        spine.rotY = dodge * 0.18 + fearMod * 0.08;
        hip.y = Math.abs(Math.sin(t * 4 + ip)) * 0.05;
        hip.rotY = dodge * 0.1;
        spine.rotX += 0.18 + fearMod * 0.1;

        rSh.rotX = -1.15 + punch * 0.88;
        rEl.rotX = -0.75 + Math.max(0, punch) * 0.55;
        lSh.rotX = -0.82 + Math.sin(punchT + 1) * 0.5;
        lEl.rotX = -0.6;
        lSh.rotZ = 0.35;
        rSh.rotZ = -0.35;
        head.rotX = -0.12;
        lHip.rotX = 0.22;
        rHip.rotX = -0.22;
        tail.rotX = -0.15;
        tail.rotZ = Math.sin(t * 8) * 0.3;
        break;
      }

      case AgentState.HUNTING: {
        hip.y = -0.14;
        spine.rotX += 0.32 + urgencyMod * 0.1;
        head.rotX = -0.22;
        const lurk = Math.sin(t * 2 + ip);
        lHip.rotX = 0.38;
        rHip.rotX = 0.38;
        lKn.rotX = 0.28;
        rKn.rotX = 0.28;
        rSh.rotX = -0.75 + (lurk > 0.7 ? (lurk - 0.7) * -3.5 : 0);
        rEl.rotX = -0.38;
        lSh.rotX = -0.28;
        lEl.rotX = -0.28;
        head.rotY = Math.sin(t * 1.2 + ip) * 0.15;
        tail.rotX = -0.1;
        tail.rotZ = Math.sin(t * 3 + ip) * 0.2;
        break;
      }

      case AgentState.COURTING: {
        const courtT = t * 4.5;
        const bounce = Math.abs(Math.sin(courtT + ip)) * 0.14;
        hip.y = bounce;
        lSh.rotX = -1.45 + Math.sin(courtT + ip) * 0.25;
        rSh.rotX = -1.45 + Math.sin(courtT + ip + 0.6) * 0.25;
        lEl.rotX = -0.25;
        rEl.rotX = -0.25;
        head.rotY = Math.sin(t * 4.5 + pp) * 0.22;
        head.rotX = -0.12;
        spine.rotY = Math.sin(t * 2.8 + ip) * 0.12;
        lHip.rotX = Math.sin(courtT + ip) * 0.22;
        rHip.rotX = Math.sin(courtT + ip + Math.PI) * 0.22;
        tail.rotX = 0.5;
        tail.rotZ = Math.sin(t * 5 + ip) * 0.4;
        break;
      }

      case AgentState.MATING: {
        hip.y = Math.sin(t * 1.8 + ip) * 0.04;
        spine.rotZ = Math.sin(t * 1.2 + ip) * 0.09;
        head.rotX = Math.sin(t * 1.8 + pp) * 0.07;
        head.rotY = Math.sin(t * 0.9 + ip) * 0.1;
        lSh.rotX = -0.45;
        rSh.rotX = -0.45;
        lEl.rotX = -0.55;
        rEl.rotX = -0.55;
        tail.rotX = 0.45;
        tail.rotZ = Math.sin(t * 2 + ip) * 0.3;
        break;
      }

      case AgentState.PLAYING: {
        const jumpT = t * 5.5;
        const jump = Math.max(0, Math.sin(jumpT + ip)) * 0.22;
        hip.y = jump;
        spine.rotZ = Math.sin(t * 3.5 + ip) * 0.28;
        lSh.rotX = Math.sin(t * 6.5 + ip) * 1.1;
        rSh.rotX = Math.sin(t * 6.5 + ip + Math.PI) * 1.1;
        lEl.rotX = -0.45;
        rEl.rotX = -0.45;
        lHip.rotX = Math.sin(jumpT + ip) * 0.65;
        rHip.rotX = Math.sin(jumpT + ip + Math.PI) * 0.65;
        lKn.rotX = Math.max(0, -Math.sin(jumpT + ip) * 0.45);
        rKn.rotX = Math.max(0, -Math.sin(jumpT + ip + Math.PI) * 0.45);
        head.rotY = Math.sin(t * 4.5 + pp) * 0.32;
        head.rotX = Math.sin(t * 7 + ip) * 0.1;
        tail.rotX = 0.3 + jump * 0.8;
        tail.rotZ = Math.sin(t * 5 + ip) * 0.45;
        break;
      }

      case AgentState.MOURNING: {
        head.rotX = 0.48;
        spine.rotX += 0.2;
        spine.rotZ = Math.sin(t * 0.5 + ip) * 0.06;
        hip.y = -0.08;
        lSh.rotX = -0.42;
        lSh.rotZ = 0.55;
        rSh.rotX = -0.42;
        rSh.rotZ = -0.55;
        lEl.rotX = -1.05;
        rEl.rotX = -1.05;
        lHip.rotX = 0.06;
        rHip.rotX = 0.06;
        tail.rotX = -0.1;
        tail.rotZ = Math.sin(t * 0.4 + ip) * 0.08;
        break;
      }

      case AgentState.CELEBRATING: {
        const jumpT = t * 6.5;
        const jump = Math.max(0, Math.sin(jumpT + ip)) * 0.22;
        hip.y = jump;
        spine.rotZ = Math.sin(t * 4.5 + ip) * 0.16;
        lSh.rotX = -2.95 + Math.sin(t * 5.5 + ip) * 0.42;
        rSh.rotX = -2.95 + Math.sin(t * 5.5 + ip + 0.6) * 0.42;
        lEl.rotX = -0.18;
        rEl.rotX = -0.18;
        head.rotX = -0.28;
        head.rotY = Math.sin(t * 4.5 + pp) * 0.22;
        lHip.rotX = Math.sin(jumpT + ip) * 0.42;
        rHip.rotX = Math.sin(jumpT + ip + Math.PI) * 0.42;
        tail.rotX = 0.5 + jump * 0.8;
        tail.rotZ = Math.sin(t * 6 + ip) * 0.5;
        break;
      }

      case AgentState.DEFENDING: {
        spine.rotX += 0.22 + fearMod * 0.1;
        lSh.rotX = -1.18;
        lSh.rotZ = 0.85;
        rSh.rotX = -1.18;
        rSh.rotZ = -0.85;
        lEl.rotX = -0.28;
        rEl.rotX = -0.28;
        head.rotX = -0.12;
        lHip.rotX = 0.28;
        rHip.rotX = -0.28;
        hip.y = Math.sin(t * 2.2 + ip) * 0.02;
        spine.rotY = Math.sin(t * 2.8 + pp) * 0.05;
        tail.rotX = 0.05;
        break;
      }
    }

    const blendSpeed = dt * (blendRef.current < 0.5 ? 14 : 7);

    if (hipsRef.current) {
      hipsRef.current.position.y = lerpN(hipsRef.current.position.y, 0.62 + hip.y, blendSpeed);
      hipsRef.current.rotation.x = lerpN(hipsRef.current.rotation.x, hip.rotX, blendSpeed);
      hipsRef.current.rotation.y = lerpN(hipsRef.current.rotation.y, hip.rotY, blendSpeed);
      hipsRef.current.rotation.z = lerpN(hipsRef.current.rotation.z, hip.rotZ, blendSpeed);
    }
    if (spineRef.current) {
      spineRef.current.rotation.x = lerpN(spineRef.current.rotation.x, spine.rotX, blendSpeed);
      spineRef.current.rotation.y = lerpN(spineRef.current.rotation.y, spine.rotY, blendSpeed);
      spineRef.current.rotation.z = lerpN(spineRef.current.rotation.z, spine.rotZ, blendSpeed);

      const pregnantX = agent.isPregnant ? 1.2 : 1;
      const pregnantZ = agent.isPregnant ? 1.25 : 1;
      spineRef.current.scale.x = lerpN(spineRef.current.scale.x, spine.scX * pregnantX, blendSpeed);
      spineRef.current.scale.y = lerpN(spineRef.current.scale.y, spine.scY, blendSpeed);
      spineRef.current.scale.z = lerpN(spineRef.current.scale.z, spine.scZ * pregnantZ, blendSpeed);
    }
    if (headRef.current) {
      headRef.current.rotation.x = lerpN(headRef.current.rotation.x, head.rotX, blendSpeed);
      headRef.current.rotation.y = lerpN(headRef.current.rotation.y, head.rotY, blendSpeed);
      headRef.current.rotation.z = lerpN(headRef.current.rotation.z, head.rotZ, blendSpeed);
    }
    if (lEyeRef.current) lEyeRef.current.scale.y = lerpN(lEyeRef.current.scale.y, eyeScaleY, dt * 14);
    if (rEyeRef.current) rEyeRef.current.scale.y = lerpN(rEyeRef.current.scale.y, eyeScaleY, dt * 14);
    if (lEyeLidRef.current) lEyeLidRef.current.scale.y = lerpN(lEyeLidRef.current.scale.y, eyeScaleY < 0.5 ? 1.8 - eyeScaleY : 0.05, dt * 14);
    if (rEyeLidRef.current) rEyeLidRef.current.scale.y = lerpN(rEyeLidRef.current.scale.y, eyeScaleY < 0.5 ? 1.8 - eyeScaleY : 0.05, dt * 14);

    if (lShoulderRef.current) {
      lShoulderRef.current.rotation.x = lerpN(lShoulderRef.current.rotation.x, lSh.rotX, blendSpeed);
      lShoulderRef.current.rotation.y = lerpN(lShoulderRef.current.rotation.y, lSh.rotY, blendSpeed);
      lShoulderRef.current.rotation.z = lerpN(lShoulderRef.current.rotation.z, lSh.rotZ, blendSpeed);
    }
    if (rShoulderRef.current) {
      rShoulderRef.current.rotation.x = lerpN(rShoulderRef.current.rotation.x, rSh.rotX, blendSpeed);
      rShoulderRef.current.rotation.y = lerpN(rShoulderRef.current.rotation.y, rSh.rotY, blendSpeed);
      rShoulderRef.current.rotation.z = lerpN(rShoulderRef.current.rotation.z, rSh.rotZ, blendSpeed);
    }
    if (lElbowRef.current) {
      lElbowRef.current.rotation.x = lerpN(lElbowRef.current.rotation.x, lEl.rotX, blendSpeed);
      lElbowRef.current.rotation.y = lerpN(lElbowRef.current.rotation.y, lEl.rotY, blendSpeed);
    }
    if (rElbowRef.current) {
      rElbowRef.current.rotation.x = lerpN(rElbowRef.current.rotation.x, rEl.rotX, blendSpeed);
      rElbowRef.current.rotation.y = lerpN(rElbowRef.current.rotation.y, rEl.rotY, blendSpeed);
    }
    if (lWristRef.current) lWristRef.current.rotation.x = lerpN(lWristRef.current.rotation.x, lWr.rotX, blendSpeed);
    if (rWristRef.current) rWristRef.current.rotation.x = lerpN(rWristRef.current.rotation.x, rWr.rotX, blendSpeed);
    if (lHipJointRef.current) {
      lHipJointRef.current.rotation.x = lerpN(lHipJointRef.current.rotation.x, lHip.rotX, blendSpeed);
      lHipJointRef.current.rotation.y = lerpN(lHipJointRef.current.rotation.y, lHip.rotY, blendSpeed);
    }
    if (rHipJointRef.current) {
      rHipJointRef.current.rotation.x = lerpN(rHipJointRef.current.rotation.x, rHip.rotX, blendSpeed);
      rHipJointRef.current.rotation.y = lerpN(rHipJointRef.current.rotation.y, rHip.rotY, blendSpeed);
    }
    if (lKneeRef.current) lKneeRef.current.rotation.x = lerpN(lKneeRef.current.rotation.x, lKn.rotX, blendSpeed);
    if (rKneeRef.current) rKneeRef.current.rotation.x = lerpN(rKneeRef.current.rotation.x, rKn.rotX, blendSpeed);
    if (lAnkleRef.current) lAnkleRef.current.rotation.x = lerpN(lAnkleRef.current.rotation.x, lAnk.rotX, blendSpeed);
    if (rAnkleRef.current) rAnkleRef.current.rotation.x = lerpN(rAnkleRef.current.rotation.x, rAnk.rotX, blendSpeed);

    if (tailRef.current) {
      tailRef.current.rotation.x = lerpN(tailRef.current.rotation.x, tail.rotX, blendSpeed);
      tailRef.current.rotation.y = lerpN(tailRef.current.rotation.y, tail.rotY, blendSpeed);
      tailRef.current.rotation.z = lerpN(tailRef.current.rotation.z, tail.rotZ, blendSpeed);
    }

    if (lAntennaRef.current) {
      lAntennaRef.current.rotation.z = lerpN(lAntennaRef.current.rotation.z, Math.sin(t * 2 + ip) * 0.08, dt * 4);
    }
    if (rAntennaRef.current) {
      rAntennaRef.current.rotation.z = lerpN(rAntennaRef.current.rotation.z, Math.sin(t * 2 + ip + 1) * 0.08, dt * 4);
    }

    if (selRingRef.current) selRingRef.current.rotation.z = t * 2.2;
    if (shadowRef.current) {
      const sh = shadowRef.current.material as THREE.MeshBasicMaterial;
      const hipY = hipsRef.current?.position.y ?? 0.62;
      const shadowScale = 0.9 + (hipY - 0.62) * 0.5;
      shadowRef.current.scale.set(shadowScale, shadowScale, 1);
      sh.opacity = 0.32 - (hipY - 0.62) * 0.3;
    }

    const ps = particlesRef.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      ps[i].life -= dt;
      ps[i].x += ps[i].vx * dt;
      ps[i].y += ps[i].vy * dt;
      ps[i].z += ps[i].vz * dt;
      ps[i].vy -= dt * 1.2;
      if (ps[i].life <= 0) ps.splice(i, 1);
    }

    const spawnChance = Math.random();
    const pid = pidRef.current++;
    const spreadV = () => (Math.random() - 0.5) * 2;
    if (state === AgentState.CRAFTING && spawnChance < 0.15) {
      ps.push({ id: pid, x: 0.18, y: 0.85, z: -0.22, vx: spreadV() * 1.8, vy: 1.2 + Math.random() * 1.5, vz: spreadV() * 1.8, life: 0.55, maxLife: 0.55, color: '#ff8800', size: 0.045 });
    } else if (state === AgentState.BUILDING && spawnChance < 0.1) {
      ps.push({ id: pid, x: spreadV() * 0.55, y: 0.12, z: spreadV() * 0.55, vx: spreadV() * 0.5, vy: 0.6 + Math.random() * 0.6, vz: spreadV() * 0.5, life: 0.9, maxLife: 0.9, color: '#d2b48c', size: 0.065 });
    } else if (state === AgentState.RESEARCHING && spawnChance < 0.12) {
      const a = Math.random() * Math.PI * 2;
      ps.push({ id: pid, x: Math.cos(a) * 0.42, y: 1.65 + Math.random() * 0.22, z: Math.sin(a) * 0.42, vx: Math.cos(a + 1) * 0.45, vy: 0.25 + Math.random() * 0.3, vz: Math.sin(a + 1) * 0.45, life: 0.9, maxLife: 0.9, color: '#ffff55', size: 0.038 });
    } else if (state === AgentState.SOCIALIZING && spawnChance < 0.08 * emo.happiness) {
      ps.push({ id: pid, x: spreadV() * 0.22, y: 1.5, z: 0, vx: spreadV() * 0.25, vy: 0.9 + Math.random() * 0.5, vz: spreadV() * 0.25, life: 1.3, maxLife: 1.3, color: '#ff4488', size: 0.05 });
    } else if (state === AgentState.CELEBRATING && spawnChance < 0.25) {
      const cols = ['#ff3333', '#33ff33', '#3399ff', '#ffff33', '#ff33ff', '#33ffff', '#ff9933'];
      ps.push({ id: pid, x: spreadV() * 0.45, y: 1.85, z: spreadV() * 0.45, vx: spreadV() * 2.2, vy: 2.2 + Math.random() * 1.5, vz: spreadV() * 2.2, life: 1.6, maxLife: 1.6, color: cols[Math.floor(Math.random() * cols.length)], size: 0.042 });
    } else if (state === AgentState.MOURNING && spawnChance < 0.06) {
      ps.push({ id: pid, x: spreadV() * 0.12, y: 1.5 + Math.random() * 0.2, z: -0.18, vx: spreadV() * 0.2, vy: 0.15 + Math.random() * 0.2, vz: -0.1, life: 0.8, maxLife: 0.8, color: '#aaaacc', size: 0.035 });
    } else if (state === AgentState.COURTING && spawnChance < 0.1) {
      ps.push({ id: pid, x: spreadV() * 0.3, y: 1.3 + Math.random() * 0.4, z: spreadV() * 0.3, vx: spreadV() * 0.4, vy: 0.5 + Math.random() * 0.5, vz: spreadV() * 0.4, life: 1.1, maxLife: 1.1, color: '#ff6699', size: 0.042 });
    } else if (state === AgentState.GATHERING && spawnChance < 0.08) {
      ps.push({ id: pid, x: spreadV() * 0.2, y: 0.3, z: spreadV() * 0.2, vx: spreadV() * 0.3, vy: 0.3 + Math.random() * 0.3, vz: spreadV() * 0.3, life: 0.5, maxLife: 0.5, color: '#66cc44', size: 0.04 });
    }

    if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
    particlesRef.current = ps;
  });

  const state = agent.state;
  const showChat = agent.chatBubble && agent.lastChatTime && (Date.now() - agent.lastChatTime < 8000);
  const chatText = showChat ? (agent.chatBubble!.length > 40 ? agent.chatBubble!.substring(0, 37) + '...' : agent.chatBubble!) : '';
  const isSleeping = state === AgentState.SLEEPING;
  const stateIcon = STATE_ICONS[state];
  const labelHeight = variation.heightScale * 2.05;
  const hasCarriedItem = (state === AgentState.GATHERING || state === AgentState.BUILDING) &&
    agent.inventory && Object.keys(agent.inventory).length > 0;
  const carriedItemName = hasCarriedItem ? Object.keys(agent.inventory)[0] : '';

  const lLegHipX = -0.115 * sw;
  const rLegHipX = 0.115 * sw;
  const lArmShoulderX = -(0.26 * sw);
  const rArmShoulderX = 0.26 * sw;

  const upperArmLen = 0.165 * lLen;
  const upperArmR = 0.052;
  const lowerArmLen = 0.13 * lLen;
  const lowerArmR = 0.042;

  const upperLegLen = 0.22 * lLen;
  const upperLegR = 0.068;
  const lowerLegLen = 0.2 * lLen;
  const lowerLegR = 0.055;

  return (
    <group
      ref={rootRef}
      position={[agent.position.x, agent.position.y, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {isSelected && (
        <mesh ref={selRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.58, 0.7, 28]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      <group ref={wholeRef} scale={[variation.heightScale, variation.heightScale, variation.heightScale]}>

        <group ref={hipsRef} position={[0, 0.62, 0]}>

          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.34 * sw, 0.14, 0.19]} />
            <primitive object={cloth} attach="material" />
          </mesh>

          <group ref={lHipJointRef} position={[lLegHipX, -0.07, 0]}>
            <mesh position={[0, -(upperLegLen / 2 + 0.02), 0]}>
              <capsuleGeometry args={[upperLegR, upperLegLen, 4, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>
            <group ref={lKneeRef} position={[0, -(upperLegLen + 0.06), 0]}>
              <mesh position={[0, -(lowerLegLen / 2 + 0.01), 0]}>
                <capsuleGeometry args={[lowerLegR, lowerLegLen, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <group ref={lAnkleRef} position={[0, -(lowerLegLen + 0.05), 0]}>
                <mesh position={[0, -0.025, -0.04]}>
                  <boxGeometry args={[0.1, 0.062, 0.17]} />
                  <primitive object={marking} attach="material" />
                </mesh>
                <mesh position={[0, -0.025, 0.04]}>
                  <sphereGeometry args={[0.038, 5, 4]} />
                  <primitive object={skin} attach="material" />
                </mesh>
              </group>
            </group>
          </group>

          <group ref={rHipJointRef} position={[rLegHipX, -0.07, 0]}>
            <mesh position={[0, -(upperLegLen / 2 + 0.02), 0]}>
              <capsuleGeometry args={[upperLegR, upperLegLen, 4, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>
            <group ref={rKneeRef} position={[0, -(upperLegLen + 0.06), 0]}>
              <mesh position={[0, -(lowerLegLen / 2 + 0.01), 0]}>
                <capsuleGeometry args={[lowerLegR, lowerLegLen, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <group ref={rAnkleRef} position={[0, -(lowerLegLen + 0.05), 0]}>
                <mesh position={[0, -0.025, -0.04]}>
                  <boxGeometry args={[0.1, 0.062, 0.17]} />
                  <primitive object={marking} attach="material" />
                </mesh>
                <mesh position={[0, -0.025, 0.04]}>
                  <sphereGeometry args={[0.038, 5, 4]} />
                  <primitive object={skin} attach="material" />
                </mesh>
              </group>
            </group>
          </group>

          <group ref={spineRef} position={[0, 0.07, 0]}>
            <mesh position={[0, 0.18, 0]}>
              <capsuleGeometry args={[0.17 * variation.torsoWidth, 0.26, 5, 8]} />
              <primitive object={cloth} attach="material" />
            </mesh>

            {variation.outfitVariant === 1 && (
              <mesh position={[0, 0.22, -0.14]}>
                <boxGeometry args={[0.22, 0.14, 0.04]} />
                <primitive object={cloth2} attach="material" />
              </mesh>
            )}
            {variation.outfitVariant === 2 && (
              <>
                <mesh position={[-0.12, 0.18, -0.14]} rotation={[0, 0, 0.3]}>
                  <boxGeometry args={[0.06, 0.12, 0.04]} />
                  <primitive object={marking} attach="material" />
                </mesh>
                <mesh position={[0.12, 0.18, -0.14]} rotation={[0, 0, -0.3]}>
                  <boxGeometry args={[0.06, 0.12, 0.04]} />
                  <primitive object={marking} attach="material" />
                </mesh>
              </>
            )}
            {variation.outfitVariant === 3 && (
              <mesh position={[0, 0.08, -0.14]}>
                <boxGeometry args={[0.28, 0.04, 0.04]} />
                <primitive object={cloth2} attach="material" />
              </mesh>
            )}

            {agent.isPregnant && (
              <mesh position={[0, 0.1, -0.16]}>
                <sphereGeometry args={[0.13, 6, 5]} />
                <primitive object={skin} attach="material" />
              </mesh>
            )}

            <group ref={lShoulderRef} position={[lArmShoulderX, 0.32, 0]}>
              <mesh position={[0, -upperArmLen / 2, 0]}>
                <capsuleGeometry args={[upperArmR, upperArmLen, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <mesh position={[lArmShoulderX < 0 ? 0.012 : -0.012, 0, 0]}>
                <sphereGeometry args={[upperArmR + 0.012, 5, 4]} />
                <primitive object={cloth} attach="material" />
              </mesh>
              <group ref={lElbowRef} position={[0, -(upperArmLen + 0.025), 0]}>
                <mesh position={[0, -lowerArmLen / 2, 0]}>
                  <capsuleGeometry args={[lowerArmR, lowerArmLen, 4, 6]} />
                  <primitive object={skin} attach="material" />
                </mesh>
                <group ref={lWristRef} position={[0, -(lowerArmLen + 0.018), 0]}>
                  <mesh position={[0, -0.024, 0]}>
                    <sphereGeometry args={[0.048, 5, 4]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                  <mesh position={[-0.018, -0.038, 0]}>
                    <sphereGeometry args={[0.022, 4, 3]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                  <mesh position={[0.018, -0.038, 0]}>
                    <sphereGeometry args={[0.022, 4, 3]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                </group>
              </group>
            </group>

            <group ref={rShoulderRef} position={[rArmShoulderX, 0.32, 0]}>
              <mesh position={[0, -upperArmLen / 2, 0]}>
                <capsuleGeometry args={[upperArmR, upperArmLen, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <mesh position={[rArmShoulderX > 0 ? -0.012 : 0.012, 0, 0]}>
                <sphereGeometry args={[upperArmR + 0.012, 5, 4]} />
                <primitive object={cloth} attach="material" />
              </mesh>
              <group ref={rElbowRef} position={[0, -(upperArmLen + 0.025), 0]}>
                <mesh position={[0, -lowerArmLen / 2, 0]}>
                  <capsuleGeometry args={[lowerArmR, lowerArmLen, 4, 6]} />
                  <primitive object={skin} attach="material" />
                </mesh>
                <group ref={rWristRef} position={[0, -(lowerArmLen + 0.018), 0]}>
                  <mesh position={[0, -0.024, 0]}>
                    <sphereGeometry args={[0.048, 5, 4]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                  <mesh position={[-0.018, -0.038, 0]}>
                    <sphereGeometry args={[0.022, 4, 3]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                  <mesh position={[0.018, -0.038, 0]}>
                    <sphereGeometry args={[0.022, 4, 3]} />
                    <primitive object={skin} attach="material" />
                  </mesh>
                  {agent.equippedTool && <EquippedTool tool={agent.equippedTool} mat={marking} />}
                  {hasCarriedItem && !agent.equippedTool && <CarriedItem item={carriedItemName} />}
                </group>
              </group>
            </group>

            <mesh ref={neckRef} position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.062, 0.072, 0.09, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>

            <group ref={headRef} position={[0, 0.5, 0]}>
              <mesh>
                <sphereGeometry args={[0.2 * variation.headSize, 8, 7]} />
                <primitive object={skin} attach="material" />
              </mesh>

              {isElder && (
                <>
                  <mesh position={[-0.06, -0.06, -0.17]}>
                    <boxGeometry args={[0.08, 0.01, 0.02]} />
                    <meshStandardMaterial color="#8a7060" flatShading roughness={0.9} />
                  </mesh>
                  <mesh position={[0.06, -0.06, -0.17]}>
                    <boxGeometry args={[0.08, 0.01, 0.02]} />
                    <meshStandardMaterial color="#8a7060" flatShading roughness={0.9} />
                  </mesh>
                </>
              )}

              {!isElder && (
                <>
                  <mesh position={[-0.08, 0.14, 0.04]}>
                    <sphereGeometry args={[0.04, 5, 4]} />
                    <primitive object={hairMat} attach="material" />
                  </mesh>
                  <mesh position={[0, 0.16, 0.01]}>
                    <sphereGeometry args={[0.05, 5, 4]} />
                    <primitive object={hairMat} attach="material" />
                  </mesh>
                  <mesh position={[0.08, 0.14, 0.04]}>
                    <sphereGeometry args={[0.04, 5, 4]} />
                    <primitive object={hairMat} attach="material" />
                  </mesh>
                  {variation.outfitVariant >= 2 && (
                    <mesh position={[-0.1, 0.1, 0.05]} rotation={[0, 0, -0.4]}>
                      <sphereGeometry args={[0.035, 5, 4]} />
                      <primitive object={hairMat} attach="material" />
                    </mesh>
                  )}
                </>
              )}

              <mesh position={[-0.195, 0.04, 0]}>
                <sphereGeometry args={[0.05, 5, 4]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <mesh position={[0.195, 0.04, 0]}>
                <sphereGeometry args={[0.05, 5, 4]} />
                <primitive object={skin} attach="material" />
              </mesh>

              <group ref={lAntennaRef}>
                <AntennaGeometry style={variation.antennaStyle} />
              </group>

              <group position={[-0.085, 0.04, -0.168]}>
                <mesh>
                  <sphereGeometry args={[0.052, 8, 6]} />
                  <primitive object={eyeWhite} attach="material" />
                </mesh>
                <mesh ref={lEyeRef} position={[0, 0, -0.028]}>
                  <sphereGeometry args={[0.033, 6, 5]} />
                  <primitive object={eyePupil} attach="material" />
                </mesh>
                <mesh position={[0, 0, -0.042]}>
                  <sphereGeometry args={[0.018, 5, 4]} />
                  <meshStandardMaterial color="#111" flatShading roughness={0.2} />
                </mesh>
                <mesh ref={lEyeLidRef} position={[0, 0.03, -0.022]} scale={[1, 0.05, 1]}>
                  <sphereGeometry args={[0.056, 6, 4]} />
                  <primitive object={eyeLidMat} attach="material" />
                </mesh>
              </group>

              <group position={[0.085, 0.04, -0.168]}>
                <mesh>
                  <sphereGeometry args={[0.052, 8, 6]} />
                  <primitive object={eyeWhite} attach="material" />
                </mesh>
                <mesh ref={rEyeRef} position={[0, 0, -0.028]}>
                  <sphereGeometry args={[0.033, 6, 5]} />
                  <primitive object={eyePupil} attach="material" />
                </mesh>
                <mesh position={[0, 0, -0.042]}>
                  <sphereGeometry args={[0.018, 5, 4]} />
                  <meshStandardMaterial color="#111" flatShading roughness={0.2} />
                </mesh>
                <mesh ref={rEyeLidRef} position={[0, 0.03, -0.022]} scale={[1, 0.05, 1]}>
                  <sphereGeometry args={[0.056, 6, 4]} />
                  <primitive object={eyeLidMat} attach="material" />
                </mesh>
              </group>

              <mesh position={[0, -0.025, -0.185]}>
                <sphereGeometry args={[0.028, 4, 3]} />
                <primitive object={noseMat} attach="material" />
              </mesh>
              <mesh position={[-0.01, -0.08, -0.168]}>
                <sphereGeometry args={[0.024, 4, 3]} />
                <primitive object={noseMat} attach="material" />
              </mesh>
              <mesh position={[0.01, -0.08, -0.168]}>
                <sphereGeometry args={[0.024, 4, 3]} />
                <primitive object={noseMat} attach="material" />
              </mesh>

              <mesh position={[0, -0.09, -0.168]}>
                <boxGeometry args={[0.055, 0.018, 0.018]} />
                <primitive object={mouthMat} attach="material" />
              </mesh>

              {healthPct > 0.6 && (
                <>
                  <mesh position={[-0.028, -0.088, -0.17]}>
                    <boxGeometry args={[0.01, 0.018, 0.016]} />
                    <primitive object={toothMat} attach="material" />
                  </mesh>
                  <mesh position={[0.028, -0.088, -0.17]}>
                    <boxGeometry args={[0.01, 0.018, 0.016]} />
                    <primitive object={toothMat} attach="material" />
                  </mesh>
                </>
              )}
            </group>
          </group>

          <group ref={tailRef} position={[0, 0, 0.13]} rotation={[0.4, 0, 0]}>
            <mesh position={[0, 0.06, 0.11]}>
              <coneGeometry args={[0.038, 0.21, 5]} />
              <primitive object={skin} attach="material" />
            </mesh>
            <mesh position={[0, 0.01, 0.24]}>
              <sphereGeometry args={[0.032, 4, 3]} />
              <primitive object={marking} attach="material" />
            </mesh>
          </group>
        </group>

        <ParticleSystem particlesRef={particlesRef} />

        {isSleeping && (
          <>
            <Billboard position={[0.32, 1.52, 0]} follow>
              <Text fontSize={0.18} color="#aaaaff" anchorX="center" anchorY="middle">Z</Text>
            </Billboard>
            <Billboard position={[0.48, 1.72, 0.06]} follow>
              <Text fontSize={0.13} color="#8888dd" anchorX="center" anchorY="middle">z</Text>
            </Billboard>
            <Billboard position={[0.28, 1.88, -0.05]} follow>
              <Text fontSize={0.09} color="#6666bb" anchorX="center" anchorY="middle">z</Text>
            </Billboard>
          </>
        )}
      </group>

      <Billboard position={[0, labelHeight, 0]} follow>
        <Text
          fontSize={0.12}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.014}
          outlineColor="#000000"
        >
          {agent.name}
        </Text>
        <mesh position={[0, -0.038, 0]}>
          <planeGeometry args={[0.52, 0.048]} />
          <meshBasicMaterial color="#111" transparent opacity={0.75} />
        </mesh>
        <mesh position={[(healthPct - 1) * 0.245, -0.038, 0.001]}>
          <planeGeometry args={[0.49 * healthPct, 0.034]} />
          <meshBasicMaterial color={healthPct > 0.5 ? '#4ade80' : healthPct > 0.25 ? '#facc15' : '#ef4444'} />
        </mesh>
      </Billboard>

      {stateIcon && (
        <Billboard position={[0.45, labelHeight - 0.05, 0]} follow>
          <Text fontSize={0.14} anchorX="center" anchorY="middle">
            {stateIcon}
          </Text>
        </Billboard>
      )}

      {agent.currentActionLabel && (
        <Billboard position={[0, labelHeight + 0.22, 0]} follow>
          <Text
            fontSize={0.075}
            color="#94a3b8"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            {agent.currentActionLabel.length > 32 ? agent.currentActionLabel.substring(0, 30) + '...' : agent.currentActionLabel}
          </Text>
        </Billboard>
      )}

      {showChat && (
        <Billboard position={[0, labelHeight + 0.42, 0]} follow>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[Math.min(chatText.length * 0.052 + 0.18, 2.6), 0.22]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.93} />
          </mesh>
          <Text
            fontSize={0.082}
            color="#222222"
            anchorX="center"
            anchorY="middle"
            maxWidth={2.3}
          >
            {chatText}
          </Text>
          <mesh position={[0, -0.13, 0]} rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.065, 0.065]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.93} />
          </mesh>
        </Billboard>
      )}

      {debugMode && (
        <Billboard position={[0, labelHeight + 0.75, 0]} follow>
          <Text fontSize={0.065} color="#00ff88" anchorX="center" anchorY="bottom" outlineWidth={0.005} outlineColor="#000">
            {`[${state}] H:${Math.round(agent.needs.hunger)} E:${Math.round(agent.needs.energy)} S:${Math.round(agent.needs.social)}`}
          </Text>
        </Billboard>
      )}
    </group>
  );
};
