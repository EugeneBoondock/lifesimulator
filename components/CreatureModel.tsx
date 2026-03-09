import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentState } from '../types';

interface CreatureModelProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

const _targetPos = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _currentQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, t);
}

function desaturateColor(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.max(0, hsl.s * (1 - amount));
  hsl.l = Math.min(1, hsl.l + 0.05);
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

const MAX_PARTICLES = 20;

function ParticleSystem({ particlesRef }: { particlesRef: React.MutableRefObject<Particle[]> }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(new Array(MAX_PARTICLES).fill(null));
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>(new Array(MAX_PARTICLES).fill(null));
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
        mesh.scale.setScalar(ps[i].size);
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

function EquippedTool({ tool }: { tool: string }) {
  if (tool.includes('axe')) {
    return (
      <group rotation={[0.3, 0, 0]}>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 5]} />
          <meshStandardMaterial color="#8B4513" flatShading />
        </mesh>
        <mesh position={[0.08, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.15, 0.1, 0.04]} />
          <meshStandardMaterial color={tool.includes('iron') ? '#666' : tool.includes('copper') ? '#b87333' : '#888'} flatShading />
        </mesh>
      </group>
    );
  }
  if (tool.includes('spear')) {
    return (
      <group rotation={[0.2, 0, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 5]} />
          <meshStandardMaterial color="#8B4513" flatShading />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <coneGeometry args={[0.05, 0.15, 4]} />
          <meshStandardMaterial color="#999" flatShading />
        </mesh>
      </group>
    );
  }
  return null;
}

export const CreatureModel: React.FC<CreatureModelProps> = ({ agent, isSelected, onClick }) => {
  const rootRef = useRef<THREE.Group>(null!);
  const hipsRef = useRef<THREE.Group>(null!);
  const spineRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const lShoulderRef = useRef<THREE.Group>(null!);
  const rShoulderRef = useRef<THREE.Group>(null!);
  const lElbowRef = useRef<THREE.Group>(null!);
  const rElbowRef = useRef<THREE.Group>(null!);
  const lHipJointRef = useRef<THREE.Group>(null!);
  const rHipJointRef = useRef<THREE.Group>(null!);
  const lKneeRef = useRef<THREE.Group>(null!);
  const rKneeRef = useRef<THREE.Group>(null!);
  const lEyeRef = useRef<THREE.Mesh>(null!);
  const rEyeRef = useRef<THREE.Mesh>(null!);
  const selRingRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);
  const wholeRef = useRef<THREE.Group>(null!);

  const prevStateRef = useRef<AgentState>(agent.state);
  const blendRef = useRef(1);
  const particlesRef = useRef<Particle[]>([]);
  const pidRef = useRef(0);
  const fidgetRef = useRef(Math.random() * 5);
  const blinkRef = useRef(Math.random() * 4 + 2);

  const isElder = agent.lifeStage === 'ELDER';
  const lifeScale = agent.lifeStage === 'CHILD' ? 0.65 : agent.lifeStage === 'ELDER' ? 0.92 : 1.0;
  const healthPct = agent.needs.health / 100;

  const skin = useMemo(() => {
    const col = isElder ? desaturateColor(agent.skinTone, 0.3) : agent.skinTone;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.8 });
  }, [agent.skinTone, isElder]);

  const cloth = useMemo(() => {
    const col = isElder ? desaturateColor(agent.color, 0.25) : agent.color;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.7 });
  }, [agent.color, isElder]);

  const marking = useMemo(() => {
    const col = isElder ? desaturateColor(agent.markings, 0.25) : agent.markings;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.7 });
  }, [agent.markings, isElder]);

  const eyeWhite = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f5f5f0', flatShading: true }), []);
  const eyePupil = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a2e', flatShading: true }), []);
  const mouthMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c46060', flatShading: true }), []);

  useFrame((_, delta) => {
    if (!rootRef.current) return;
    const dt = Math.min(delta, 0.1);
    const t = performance.now() * 0.001;
    const state = agent.state;

    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      blendRef.current = 0;
    }
    blendRef.current = Math.min(1, blendRef.current + dt / 0.25);

    _targetPos.set(agent.position.x, agent.position.y, agent.position.z);
    rootRef.current.position.lerp(_targetPos, dt * 6);
    _targetQuat.setFromAxisAngle(_yAxis, agent.rotation);
    _currentQuat.copy(rootRef.current.quaternion);
    _currentQuat.slerp(_targetQuat, dt * 6);
    rootRef.current.quaternion.copy(_currentQuat);

    if (wholeRef.current) {
      const s = lifeScale;
      wholeRef.current.scale.lerp(new THREE.Vector3(s, s, s), dt * 5);
    }

    blinkRef.current -= dt;
    let eyeScaleY = 1;
    if (blinkRef.current <= 0) {
      if (blinkRef.current > -0.12) {
        eyeScaleY = Math.abs(blinkRef.current) < 0.06 ? 0.05 : 0.5;
      } else {
        blinkRef.current = 2 + Math.random() * 4;
      }
    }
    fidgetRef.current -= dt;

    const hip = { y: 0, rotX: 0, rotY: 0, rotZ: 0 };
    const spine = { rotX: 0, rotY: 0, rotZ: 0, scX: 1, scY: 1, scZ: 1 };
    const head = { rotX: 0, rotY: 0, rotZ: 0 };
    const lSh = { rotX: 0, rotZ: 0.15 };
    const rSh = { rotX: 0, rotZ: -0.15 };
    const lEl = { rotX: 0 };
    const rEl = { rotX: 0 };
    const lHip = { rotX: 0 };
    const rHip = { rotX: 0 };
    const lKn = { rotX: 0 };
    const rKn = { rotX: 0 };

    const breathe = Math.sin(t * 2) * 0.012;
    spine.scX = 1 + breathe;
    spine.scZ = 1 + breathe;

    switch (state) {
      case AgentState.IDLE: {
        head.rotY = Math.sin(t * 0.7 + agent.position.x) * 0.2;
        head.rotX = Math.sin(t * 0.5) * 0.05;
        hip.y = Math.sin(t * 1.2) * 0.01;
        lSh.rotX = Math.sin(t * 0.6) * 0.06;
        rSh.rotX = Math.sin(t * 0.6 + 1) * 0.06;
        spine.rotY = Math.sin(t * 0.4) * 0.03;
        if (fidgetRef.current <= 0) {
          fidgetRef.current = 3 + Math.random() * 5;
          lSh.rotZ = 0.15 + Math.sin(t * 3) * 0.15;
        }
        break;
      }
      case AgentState.MOVING: {
        const spd = 8;
        const legSwing = 0.55;
        const armSwing = 0.4;
        const bounce = Math.abs(Math.sin(t * spd)) * 0.06;
        hip.y = bounce;
        hip.rotZ = Math.sin(t * spd) * 0.03;
        spine.rotX = -0.05;
        spine.rotY = Math.sin(t * spd) * 0.06;
        head.rotX = Math.sin(t * spd) * 0.04;
        lHip.rotX = Math.sin(t * spd) * legSwing;
        rHip.rotX = Math.sin(t * spd + Math.PI) * legSwing;
        lKn.rotX = Math.max(0, -Math.sin(t * spd) * 0.4);
        rKn.rotX = Math.max(0, -Math.sin(t * spd + Math.PI) * 0.4);
        lSh.rotX = Math.sin(t * spd + Math.PI) * armSwing;
        rSh.rotX = Math.sin(t * spd) * armSwing;
        lEl.rotX = -Math.abs(Math.sin(t * spd + Math.PI)) * 0.3;
        rEl.rotX = -Math.abs(Math.sin(t * spd)) * 0.3;
        break;
      }
      case AgentState.GATHERING: {
        const cycle = (Math.sin(t * 3) + 1) * 0.5;
        spine.rotX = 0.4 + cycle * 0.3;
        hip.y = -0.15 * cycle;
        head.rotX = 0.15;
        lSh.rotX = -0.9 + cycle * 0.5;
        rSh.rotX = -0.9 + cycle * 0.5;
        lEl.rotX = -0.8 + cycle * 0.3;
        rEl.rotX = -0.8 + cycle * 0.3;
        lHip.rotX = 0.2;
        rHip.rotX = 0.2;
        lKn.rotX = 0.3 * cycle;
        rKn.rotX = 0.3 * cycle;
        break;
      }
      case AgentState.CRAFTING: {
        hip.y = -0.25;
        lHip.rotX = -1.4;
        rHip.rotX = -1.4;
        lKn.rotX = 1.4;
        rKn.rotX = 1.4;
        head.rotX = 0.3;
        const hammer = Math.sin(t * 7);
        rSh.rotX = -0.7 + hammer * 0.5;
        rEl.rotX = -1.0 + hammer * 0.6;
        lSh.rotX = -0.4;
        lEl.rotX = -0.6;
        spine.rotX = 0.15;
        break;
      }
      case AgentState.BUILDING: {
        const reach = Math.sin(t * 4);
        lSh.rotX = -2.5 + reach * 0.3;
        rSh.rotX = -2.5 + reach * 0.3;
        lEl.rotX = -0.3;
        rEl.rotX = -0.3;
        head.rotX = -0.25;
        spine.rotX = -0.1;
        hip.y = Math.sin(t * 4) * 0.03;
        const step = Math.sin(t * 2) * 0.15;
        lHip.rotX = step > 0 ? step * 0.3 : 0;
        rHip.rotX = step < 0 ? -step * 0.3 : 0;
        break;
      }
      case AgentState.EATING: {
        hip.y = -0.2;
        lHip.rotX = -1.0;
        rHip.rotX = -1.0;
        lKn.rotX = 1.0;
        rKn.rotX = 1.0;
        const bite = Math.sin(t * 5);
        rSh.rotX = -1.8 + bite * 0.25;
        rEl.rotX = -1.2;
        lSh.rotX = -0.3;
        lEl.rotX = -0.4;
        head.rotX = bite * 0.08 + 0.1;
        spine.rotX = 0.1;
        break;
      }
      case AgentState.DRINKING: {
        hip.y = -0.3;
        spine.rotX = 0.5;
        lHip.rotX = -1.2;
        rHip.rotX = -1.2;
        lKn.rotX = 1.2;
        rKn.rotX = 1.2;
        head.rotX = 0.4 + Math.sin(t * 2.5) * 0.15;
        lSh.rotX = -0.4;
        rSh.rotX = -0.4;
        lEl.rotX = -0.3;
        rEl.rotX = -0.3;
        break;
      }
      case AgentState.SLEEPING: {
        hip.rotZ = Math.PI / 2.2;
        hip.y = -0.2;
        head.rotX = 0.25;
        eyeScaleY = 0.05;
        const br = Math.sin(t * 1.2) * 0.04;
        spine.scX = 1 + br;
        spine.scZ = 1 + br;
        lSh.rotX = 0.2;
        rSh.rotX = 0.2;
        lSh.rotZ = 0.4;
        rSh.rotZ = -0.4;
        break;
      }
      case AgentState.FIGHTING: {
        const punch = Math.sin(t * 9);
        const dodge = Math.sin(t * 6);
        spine.rotY = dodge * 0.15;
        hip.y = Math.abs(Math.sin(t * 4)) * 0.04;
        hip.rotY = dodge * 0.08;
        rSh.rotX = -1.2 + punch * 0.8;
        rEl.rotX = -0.8 + Math.max(0, punch) * 0.5;
        lSh.rotX = -0.8 + Math.sin(t * 9 + 1) * 0.5;
        lEl.rotX = -0.6;
        lSh.rotZ = 0.3;
        rSh.rotZ = -0.3;
        head.rotX = -0.1;
        lHip.rotX = 0.2;
        rHip.rotX = -0.2;
        break;
      }
      case AgentState.HUNTING: {
        hip.y = -0.15;
        spine.rotX = 0.35;
        head.rotX = -0.25;
        const lunge = Math.sin(t * 2.5);
        lHip.rotX = 0.4;
        rHip.rotX = 0.4;
        lKn.rotX = 0.3;
        rKn.rotX = 0.3;
        rSh.rotX = -0.8 + (lunge > 0.6 ? (lunge - 0.6) * -3.0 : 0);
        rEl.rotX = -0.4;
        lSh.rotX = -0.3;
        lEl.rotX = -0.3;
        head.rotY = Math.sin(t * 1.5) * 0.1;
        break;
      }
      case AgentState.RESEARCHING: {
        hip.y = -0.2;
        lHip.rotX = -1.2;
        rHip.rotX = -1.2;
        lKn.rotX = 1.2;
        rKn.rotX = 1.2;
        rSh.rotX = -1.5;
        rEl.rotX = -1.2;
        lSh.rotX = -0.8 + Math.sin(t * 2.5) * 0.4;
        lEl.rotX = -0.5 + Math.sin(t * 2.5) * 0.3;
        head.rotZ = Math.sin(t * 1.2) * 0.15;
        head.rotX = -0.1 + Math.sin(t * 0.8) * 0.05;
        spine.rotX = 0.05;
        break;
      }
      case AgentState.TEACHING: {
        rSh.rotX = -2.8 + Math.sin(t * 2.5) * 0.35;
        rEl.rotX = -0.3;
        lSh.rotX = -0.15;
        lEl.rotX = -0.15;
        head.rotX = Math.sin(t * 3) * 0.12;
        head.rotY = Math.sin(t * 1.8) * 0.15;
        hip.y = Math.sin(t * 2) * 0.015;
        spine.rotY = Math.sin(t * 2) * 0.05;
        break;
      }
      case AgentState.SOCIALIZING: {
        lSh.rotX = -0.5 + Math.sin(t * 3.5) * 0.6;
        rSh.rotX = -0.5 + Math.sin(t * 3.5 + 1.2) * 0.6;
        lEl.rotX = -0.4 + Math.sin(t * 4) * 0.3;
        rEl.rotX = -0.4 + Math.sin(t * 4 + 1) * 0.3;
        head.rotY = Math.sin(t * 2.5) * 0.3;
        head.rotX = Math.sin(t * 4) * 0.12;
        const laugh = Math.max(0, Math.sin(t * 6)) * 0.05;
        hip.y = laugh;
        spine.rotY = Math.sin(t * 2) * 0.06;
        break;
      }
      case AgentState.FLEEING: {
        const spd = 15;
        const legSwing = 0.75;
        const armSwing = 0.7;
        spine.rotX = 0.25;
        hip.y = Math.abs(Math.sin(t * spd)) * 0.1;
        head.rotX = 0.1;
        lHip.rotX = Math.sin(t * spd) * legSwing;
        rHip.rotX = Math.sin(t * spd + Math.PI) * legSwing;
        lKn.rotX = Math.max(0, -Math.sin(t * spd) * 0.6);
        rKn.rotX = Math.max(0, -Math.sin(t * spd + Math.PI) * 0.6);
        lSh.rotX = Math.sin(t * spd + Math.PI) * armSwing;
        rSh.rotX = Math.sin(t * spd) * armSwing;
        lEl.rotX = -0.8;
        rEl.rotX = -0.8;
        break;
      }
      case AgentState.EXPLORING: {
        const spd = 6;
        hip.y = Math.abs(Math.sin(t * spd)) * 0.03;
        lHip.rotX = Math.sin(t * spd) * 0.35;
        rHip.rotX = Math.sin(t * spd + Math.PI) * 0.35;
        lKn.rotX = Math.max(0, -Math.sin(t * spd) * 0.25);
        rKn.rotX = Math.max(0, -Math.sin(t * spd + Math.PI) * 0.25);
        lSh.rotX = Math.sin(t * spd + Math.PI) * 0.25;
        rSh.rotX = -2.0;
        rEl.rotX = -0.5;
        head.rotY = Math.sin(t * 1.2) * 0.5;
        head.rotX = -0.1;
        spine.rotY = Math.sin(t * 1.5) * 0.08;
        break;
      }
      case AgentState.THINKING: {
        rSh.rotX = -1.8;
        rSh.rotZ = 0.2;
        rEl.rotX = -1.8;
        lSh.rotX = -0.6;
        lSh.rotZ = 0.5;
        lEl.rotX = -0.8;
        hip.y = Math.sin(t * 0.8) * 0.01;
        head.rotX = -0.08;
        head.rotZ = Math.sin(t * 1.0) * 0.1;
        head.rotY = Math.sin(t * 0.6) * 0.08;
        spine.rotY = Math.sin(t * 0.5) * 0.04;
        break;
      }
      case AgentState.COURTING: {
        const bounce = Math.abs(Math.sin(t * 5)) * 0.12;
        hip.y = bounce;
        lSh.rotX = -1.5 + Math.sin(t * 4) * 0.25;
        rSh.rotX = -1.5 + Math.sin(t * 4 + 0.5) * 0.25;
        lEl.rotX = -0.3;
        rEl.rotX = -0.3;
        head.rotY = Math.sin(t * 5) * 0.2;
        head.rotX = -0.1;
        spine.rotY = Math.sin(t * 3) * 0.1;
        lHip.rotX = Math.sin(t * 5) * 0.2;
        rHip.rotX = Math.sin(t * 5 + Math.PI) * 0.2;
        break;
      }
      case AgentState.MATING: {
        hip.y = Math.sin(t * 2) * 0.03;
        spine.rotZ = Math.sin(t * 1.5) * 0.08;
        head.rotX = Math.sin(t * 2) * 0.06;
        lSh.rotX = -0.4;
        rSh.rotX = -0.4;
        lEl.rotX = -0.5;
        rEl.rotX = -0.5;
        head.rotY = Math.sin(t * 1) * 0.1;
        break;
      }
      case AgentState.PLAYING: {
        const jump = Math.max(0, Math.sin(t * 6)) * 0.2;
        hip.y = jump;
        spine.rotZ = Math.sin(t * 4) * 0.25;
        lSh.rotX = Math.sin(t * 7) * 1.0;
        rSh.rotX = Math.sin(t * 7 + Math.PI) * 1.0;
        lEl.rotX = -0.5;
        rEl.rotX = -0.5;
        lHip.rotX = Math.sin(t * 7) * 0.6;
        rHip.rotX = Math.sin(t * 7 + Math.PI) * 0.6;
        lKn.rotX = Math.max(0, -Math.sin(t * 7) * 0.4);
        rKn.rotX = Math.max(0, -Math.sin(t * 7 + Math.PI) * 0.4);
        head.rotY = Math.sin(t * 5) * 0.3;
        break;
      }
      case AgentState.MOURNING: {
        head.rotX = 0.45;
        spine.rotX = 0.15;
        spine.rotZ = Math.sin(t * 0.6) * 0.06;
        hip.y = -0.06;
        lSh.rotX = -0.4;
        lSh.rotZ = 0.5;
        rSh.rotX = -0.4;
        rSh.rotZ = -0.5;
        lEl.rotX = -1.0;
        rEl.rotX = -1.0;
        lHip.rotX = 0.05;
        rHip.rotX = 0.05;
        break;
      }
      case AgentState.CELEBRATING: {
        const jump = Math.max(0, Math.sin(t * 7)) * 0.2;
        hip.y = jump;
        spine.rotZ = Math.sin(t * 5) * 0.15;
        lSh.rotX = -3.0 + Math.sin(t * 6) * 0.4;
        rSh.rotX = -3.0 + Math.sin(t * 6 + 0.5) * 0.4;
        lEl.rotX = -0.2;
        rEl.rotX = -0.2;
        head.rotX = -0.25;
        head.rotY = Math.sin(t * 5) * 0.2;
        lHip.rotX = Math.sin(t * 7) * 0.4;
        rHip.rotX = Math.sin(t * 7 + Math.PI) * 0.4;
        break;
      }
      case AgentState.DEFENDING: {
        spine.rotX = 0.2;
        lSh.rotX = -1.2;
        lSh.rotZ = 0.8;
        rSh.rotX = -1.2;
        rSh.rotZ = -0.8;
        lEl.rotX = -0.3;
        rEl.rotX = -0.3;
        head.rotX = -0.1;
        lHip.rotX = 0.25;
        rHip.rotX = -0.25;
        hip.y = Math.sin(t * 2.5) * 0.02;
        spine.rotY = Math.sin(t * 3) * 0.05;
        break;
      }
    }

    const sp = dt * (blendRef.current < 1 ? 10 : 6);

    if (hipsRef.current) {
      hipsRef.current.position.y = lerp(hipsRef.current.position.y, 0.65 + hip.y, sp);
      hipsRef.current.rotation.x = lerp(hipsRef.current.rotation.x, hip.rotX, sp);
      hipsRef.current.rotation.y = lerp(hipsRef.current.rotation.y, hip.rotY, sp);
      hipsRef.current.rotation.z = lerp(hipsRef.current.rotation.z, hip.rotZ, sp);
    }
    if (spineRef.current) {
      spineRef.current.rotation.x = lerp(spineRef.current.rotation.x, spine.rotX, sp);
      spineRef.current.rotation.y = lerp(spineRef.current.rotation.y, spine.rotY, sp);
      spineRef.current.rotation.z = lerp(spineRef.current.rotation.z, spine.rotZ, sp);
      spineRef.current.scale.set(
        lerp(spineRef.current.scale.x, spine.scX * (agent.isPregnant ? 1.15 : 1), sp),
        lerp(spineRef.current.scale.y, spine.scY, sp),
        lerp(spineRef.current.scale.z, spine.scZ * (agent.isPregnant ? 1.2 : 1), sp)
      );
    }
    if (headRef.current) {
      headRef.current.rotation.x = lerp(headRef.current.rotation.x, head.rotX, sp);
      headRef.current.rotation.y = lerp(headRef.current.rotation.y, head.rotY, sp);
      headRef.current.rotation.z = lerp(headRef.current.rotation.z, head.rotZ, sp);
    }
    if (lEyeRef.current) lEyeRef.current.scale.y = lerp(lEyeRef.current.scale.y, eyeScaleY, dt * 12);
    if (rEyeRef.current) rEyeRef.current.scale.y = lerp(rEyeRef.current.scale.y, eyeScaleY, dt * 12);

    if (lShoulderRef.current) {
      lShoulderRef.current.rotation.x = lerp(lShoulderRef.current.rotation.x, lSh.rotX, sp);
      lShoulderRef.current.rotation.z = lerp(lShoulderRef.current.rotation.z, lSh.rotZ, sp);
    }
    if (rShoulderRef.current) {
      rShoulderRef.current.rotation.x = lerp(rShoulderRef.current.rotation.x, rSh.rotX, sp);
      rShoulderRef.current.rotation.z = lerp(rShoulderRef.current.rotation.z, rSh.rotZ, sp);
    }
    if (lElbowRef.current) lElbowRef.current.rotation.x = lerp(lElbowRef.current.rotation.x, lEl.rotX, sp);
    if (rElbowRef.current) rElbowRef.current.rotation.x = lerp(rElbowRef.current.rotation.x, rEl.rotX, sp);

    if (lHipJointRef.current) lHipJointRef.current.rotation.x = lerp(lHipJointRef.current.rotation.x, lHip.rotX, sp);
    if (rHipJointRef.current) rHipJointRef.current.rotation.x = lerp(rHipJointRef.current.rotation.x, rHip.rotX, sp);
    if (lKneeRef.current) lKneeRef.current.rotation.x = lerp(lKneeRef.current.rotation.x, lKn.rotX, sp);
    if (rKneeRef.current) rKneeRef.current.rotation.x = lerp(rKneeRef.current.rotation.x, rKn.rotX, sp);

    if (selRingRef.current) selRingRef.current.rotation.z = t * 2;
    if (shadowRef.current) {
      const shadowScale = 1 + hip.y * 2;
      shadowRef.current.scale.set(shadowScale, shadowScale, 1);
      shadowRef.current.material.opacity = 0.25 - hip.y * 0.5;
    }

    const ps = particlesRef.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      ps[i].life -= dt;
      ps[i].x += ps[i].vx * dt;
      ps[i].y += ps[i].vy * dt;
      ps[i].z += ps[i].vz * dt;
      ps[i].vy -= dt * 0.5;
      if (ps[i].life <= 0) ps.splice(i, 1);
    }

    if (Math.random() < 0.12) {
      const pid = pidRef.current++;
      if (state === AgentState.CRAFTING) {
        ps.push({ id: pid, x: 0.15, y: 0.8, z: -0.2, vx: (Math.random() - 0.5) * 1.5, vy: 1.0 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.5, maxLife: 0.5, color: '#ff8800', size: 0.04 });
      } else if (state === AgentState.BUILDING) {
        ps.push({ id: pid, x: (Math.random() - 0.5) * 0.5, y: 0.1, z: (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.5, life: 0.8, maxLife: 0.8, color: '#d2b48c', size: 0.06 });
      } else if (state === AgentState.RESEARCHING) {
        const a = Math.random() * Math.PI * 2;
        ps.push({ id: pid, x: Math.cos(a) * 0.4, y: 1.6 + Math.random() * 0.2, z: Math.sin(a) * 0.4, vx: Math.cos(a + 1) * 0.4, vy: 0.2 + Math.random() * 0.3, vz: Math.sin(a + 1) * 0.4, life: 0.8, maxLife: 0.8, color: '#ffff44', size: 0.035 });
      } else if (state === AgentState.SOCIALIZING && Math.random() < 0.4) {
        ps.push({ id: pid, x: (Math.random() - 0.5) * 0.2, y: 1.4, z: 0, vx: (Math.random() - 0.5) * 0.2, vy: 0.8 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.2, life: 1.2, maxLife: 1.2, color: '#ff4488', size: 0.05 });
      } else if (state === AgentState.CELEBRATING) {
        const colors = ['#ff3333', '#33ff33', '#3333ff', '#ffff33', '#ff33ff', '#33ffff'];
        ps.push({ id: pid, x: (Math.random() - 0.5) * 0.4, y: 1.8, z: (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 2.0, vy: 2.0 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2.0, life: 1.5, maxLife: 1.5, color: colors[Math.floor(Math.random() * colors.length)], size: 0.04 });
      }
    }
    if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
    particlesRef.current = ps;
  });

  const showChat = agent.chatBubble && agent.lastChatTime && (Date.now() - agent.lastChatTime < 8000);
  const chatText = showChat ? (agent.chatBubble!.length > 40 ? agent.chatBubble!.substring(0, 37) + '...' : agent.chatBubble!) : '';
  const isSleeping = state === AgentState.SLEEPING;
  const state = agent.state;

  return (
    <group
      ref={rootRef}
      position={[agent.position.x, agent.position.y, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {isSelected && (
        <mesh ref={selRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.55, 0.65, 24]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      <group ref={wholeRef} scale={[lifeScale, lifeScale, lifeScale]}>
        {/* HIPS - root of skeleton, positioned at hip height */}
        <group ref={hipsRef} position={[0, 0.65, 0]}>

          {/* PELVIS mesh */}
          <mesh>
            <boxGeometry args={[0.35, 0.15, 0.2]} />
            <primitive object={cloth} attach="material" />
          </mesh>

          {/* LEFT LEG - pivots at hip joint */}
          <group ref={lHipJointRef} position={[-0.1, -0.08, 0]}>
            {/* upper leg */}
            <mesh position={[0, -0.17, 0]}>
              <capsuleGeometry args={[0.065, 0.2, 4, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>
            {/* knee joint */}
            <group ref={lKneeRef} position={[0, -0.32, 0]}>
              {/* lower leg */}
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.055, 0.18, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              {/* foot */}
              <mesh position={[0, -0.3, -0.04]}>
                <boxGeometry args={[0.1, 0.06, 0.16]} />
                <primitive object={marking} attach="material" />
              </mesh>
            </group>
          </group>

          {/* RIGHT LEG */}
          <group ref={rHipJointRef} position={[0.1, -0.08, 0]}>
            <mesh position={[0, -0.17, 0]}>
              <capsuleGeometry args={[0.065, 0.2, 4, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>
            <group ref={rKneeRef} position={[0, -0.32, 0]}>
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.055, 0.18, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <mesh position={[0, -0.3, -0.04]}>
                <boxGeometry args={[0.1, 0.06, 0.16]} />
                <primitive object={marking} attach="material" />
              </mesh>
            </group>
          </group>

          {/* SPINE / TORSO - pivots at base of spine */}
          <group ref={spineRef} position={[0, 0.08, 0]}>
            {/* torso */}
            <mesh position={[0, 0.2, 0]}>
              <capsuleGeometry args={[0.18, 0.28, 5, 8]} />
              <primitive object={cloth} attach="material" />
            </mesh>
            {/* chest detail */}
            <mesh position={[0, 0.28, -0.12]}>
              <sphereGeometry args={[0.06, 5, 4]} />
              <primitive object={marking} attach="material" />
            </mesh>
            {/* belly for pregnant */}
            {agent.isPregnant && (
              <mesh position={[0, 0.12, -0.14]}>
                <sphereGeometry args={[0.12, 6, 5]} />
                <primitive object={skin} attach="material" />
              </mesh>
            )}

            {/* LEFT SHOULDER - pivots at shoulder joint */}
            <group ref={lShoulderRef} position={[-0.24, 0.35, 0]}>
              {/* upper arm */}
              <mesh position={[0, -0.12, 0]}>
                <capsuleGeometry args={[0.05, 0.15, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              {/* elbow */}
              <group ref={lElbowRef} position={[0, -0.25, 0]}>
                {/* lower arm */}
                <mesh position={[0, -0.1, 0]}>
                  <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
                  <primitive object={skin} attach="material" />
                </mesh>
                {/* hand */}
                <mesh position={[0, -0.22, 0]}>
                  <sphereGeometry args={[0.05, 5, 4]} />
                  <primitive object={skin} attach="material" />
                </mesh>
              </group>
            </group>

            {/* RIGHT SHOULDER */}
            <group ref={rShoulderRef} position={[0.24, 0.35, 0]}>
              <mesh position={[0, -0.12, 0]}>
                <capsuleGeometry args={[0.05, 0.15, 4, 6]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <group ref={rElbowRef} position={[0, -0.25, 0]}>
                <mesh position={[0, -0.1, 0]}>
                  <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
                  <primitive object={skin} attach="material" />
                </mesh>
                <mesh position={[0, -0.22, 0]}>
                  <sphereGeometry args={[0.05, 5, 4]} />
                  <primitive object={skin} attach="material" />
                </mesh>
                {agent.equippedTool && <EquippedTool tool={agent.equippedTool} />}
              </group>
            </group>

            {/* NECK */}
            <mesh position={[0, 0.42, 0]}>
              <cylinderGeometry args={[0.06, 0.07, 0.08, 6]} />
              <primitive object={skin} attach="material" />
            </mesh>

            {/* HEAD - pivots at base of neck */}
            <group ref={headRef} position={[0, 0.52, 0]}>
              {/* skull - slightly oversized for charm */}
              <mesh>
                <sphereGeometry args={[0.2, 8, 7]} />
                <primitive object={skin} attach="material" />
              </mesh>

              {/* ears */}
              <mesh position={[-0.19, 0.04, 0]}>
                <sphereGeometry args={[0.055, 5, 4]} />
                <primitive object={skin} attach="material" />
              </mesh>
              <mesh position={[0.19, 0.04, 0]}>
                <sphereGeometry args={[0.055, 5, 4]} />
                <primitive object={skin} attach="material" />
              </mesh>

              {/* horns/antenna */}
              <mesh position={[-0.1, 0.18, 0]} rotation={[0, 0, -0.3]}>
                <coneGeometry args={[0.04, 0.14, 4]} />
                <primitive object={marking} attach="material" />
              </mesh>
              <mesh position={[0.1, 0.18, 0]} rotation={[0, 0, 0.3]}>
                <coneGeometry args={[0.04, 0.14, 4]} />
                <primitive object={marking} attach="material" />
              </mesh>

              {/* LEFT EYE */}
              <group position={[-0.08, 0.04, -0.16]}>
                <mesh>
                  <sphereGeometry args={[0.055, 8, 6]} />
                  <primitive object={eyeWhite} attach="material" />
                </mesh>
                <mesh ref={lEyeRef} position={[0, 0, -0.03]}>
                  <sphereGeometry args={[0.035, 6, 5]} />
                  <primitive object={eyePupil} attach="material" />
                </mesh>
              </group>

              {/* RIGHT EYE */}
              <group position={[0.08, 0.04, -0.16]}>
                <mesh>
                  <sphereGeometry args={[0.055, 8, 6]} />
                  <primitive object={eyeWhite} attach="material" />
                </mesh>
                <mesh ref={rEyeRef} position={[0, 0, -0.03]}>
                  <sphereGeometry args={[0.035, 6, 5]} />
                  <primitive object={eyePupil} attach="material" />
                </mesh>
              </group>

              {/* nose */}
              <mesh position={[0, -0.02, -0.18]}>
                <sphereGeometry args={[0.03, 4, 3]} />
                <primitive object={skin} attach="material" />
              </mesh>

              {/* mouth */}
              <mesh position={[0, -0.08, -0.16]}>
                <boxGeometry args={[0.06, 0.02, 0.02]} />
                <primitive object={mouthMat} attach="material" />
              </mesh>
            </group>
          </group>

          {/* TAIL */}
          <group position={[0, 0, 0.12]}>
            <mesh position={[0, 0.05, 0.1]} rotation={[0.5, 0, 0]}>
              <coneGeometry args={[0.04, 0.22, 5]} />
              <primitive object={skin} attach="material" />
            </mesh>
            <mesh position={[0, 0.03, 0.24]}>
              <sphereGeometry args={[0.035, 4, 3]} />
              <primitive object={marking} attach="material" />
            </mesh>
          </group>
        </group>

        <ParticleSystem particlesRef={particlesRef} />

        {isSleeping && (
          <>
            <Billboard position={[0.3, 1.5, 0]} follow>
              <Text fontSize={0.18} color="#aaaaff" anchorX="center" anchorY="middle">Z</Text>
            </Billboard>
            <Billboard position={[0.45, 1.7, 0.05]} follow>
              <Text fontSize={0.13} color="#8888dd" anchorX="center" anchorY="middle">z</Text>
            </Billboard>
            <Billboard position={[0.25, 1.85, -0.05]} follow>
              <Text fontSize={0.1} color="#6666bb" anchorX="center" anchorY="middle">z</Text>
            </Billboard>
          </>
        )}
      </group>

      {/* NAME + HEALTH BAR */}
      <Billboard position={[0, 1.9 * lifeScale, 0]} follow>
        <Text
          fontSize={0.13}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {agent.name}
        </Text>
        <mesh position={[0, -0.04, 0]}>
          <planeGeometry args={[0.5, 0.05]} />
          <meshBasicMaterial color="#222" transparent opacity={0.7} />
        </mesh>
        <mesh position={[(healthPct - 1) * 0.235, -0.04, 0.001]}>
          <planeGeometry args={[0.47 * healthPct, 0.035]} />
          <meshBasicMaterial color={healthPct > 0.5 ? '#4ade80' : healthPct > 0.25 ? '#facc15' : '#ef4444'} />
        </mesh>
      </Billboard>

      {/* ACTION LABEL */}
      {agent.currentActionLabel && (
        <Billboard position={[0, 2.15 * lifeScale, 0]} follow>
          <Text
            fontSize={0.08}
            color="#94a3b8"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            {agent.currentActionLabel.length > 30 ? agent.currentActionLabel.substring(0, 28) + '...' : agent.currentActionLabel}
          </Text>
        </Billboard>
      )}

      {/* CHAT BUBBLE */}
      {showChat && (
        <Billboard position={[0, 2.35 * lifeScale, 0]} follow>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[Math.min(chatText.length * 0.055 + 0.15, 2.5), 0.22]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
          </mesh>
          <Text
            fontSize={0.09}
            color="#333333"
            anchorX="center"
            anchorY="middle"
            maxWidth={2.2}
          >
            {chatText}
          </Text>
          <mesh position={[0, -0.13, 0]} rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.06, 0.06]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
};
