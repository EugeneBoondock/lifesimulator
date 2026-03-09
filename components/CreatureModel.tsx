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
const _axis = new THREE.Vector3(0, 1, 0);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function EquippedTool({ tool }: { tool: string }) {
  if (tool === 'stone_axe' || tool === 'copper_axe' || tool === 'iron_axe') {
    return (
      <group>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.25, 5]} />
          <meshStandardMaterial color="#8B4513" flatShading />
        </mesh>
        <mesh position={[0.04, 0.22, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.06, 0.02]} />
          <meshStandardMaterial color="#888" flatShading />
        </mesh>
      </group>
    );
  }
  if (tool === 'stone_spear' || tool === 'copper_spear' || tool === 'iron_spear') {
    return (
      <group>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.35, 5]} />
          <meshStandardMaterial color="#8B4513" flatShading />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <coneGeometry args={[0.03, 0.08, 4]} />
          <meshStandardMaterial color="#999" flatShading />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 0.1, 0]}>
      <cylinderGeometry args={[0.015, 0.015, 0.2, 5]} />
      <meshStandardMaterial color="#8B4513" flatShading />
    </mesh>
  );
}

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const MAX_PARTICLES = 30;

function ParticleSystemImperative({ particlesRef }: { particlesRef: React.MutableRefObject<Particle[]> }) {
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
        const p = ps[i];
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        mesh.scale.setScalar(p.size);
        mat.opacity = p.life / p.maxLife;
        mat.color.set(p.color);
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
          <meshBasicMaterial ref={el => { matRefs.current[i] = el as any; }} transparent />
        </mesh>
      ))}
    </>
  );
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

export const CreatureModel: React.FC<CreatureModelProps> = ({ agent, isSelected, onClick }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);
  const tailRef = useRef<THREE.Group>(null!);
  const leftEyeRef = useRef<THREE.Mesh>(null!);
  const rightEyeRef = useRef<THREE.Mesh>(null!);
  const selectionRingRef = useRef<THREE.Mesh>(null!);
  const wholeBodyRef = useRef<THREE.Group>(null!);

  const prevStateRef = useRef<AgentState>(agent.state);
  const blendRef = useRef(1);
  const particlesRef = useRef<Particle[]>([]);
  const particleIdRef = useRef(0);
  const fidgetTimerRef = useRef(Math.random() * 5);


  const isElder = agent.lifeStage === 'ELDER';
  const desatAmount = isElder ? 0.35 : 0;

  const skinMat = useMemo(() => {
    const col = isElder ? desaturateColor(agent.skinTone, desatAmount) : agent.skinTone;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true });
  }, [agent.skinTone, isElder]);

  const markingMat = useMemo(() => {
    const col = isElder ? desaturateColor(agent.markings, desatAmount) : agent.markings;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true });
  }, [agent.markings, isElder]);

  const clothingMat = useMemo(() => {
    const col = isElder ? desaturateColor(agent.color, desatAmount) : agent.color;
    return new THREE.MeshStandardMaterial({ color: col, flatShading: true });
  }, [agent.color, isElder]);

  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a2e', flatShading: true }), []);
  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f0f0f0', flatShading: true }), []);

  const lifeScale = agent.lifeStage === 'CHILD' ? 0.7 : agent.lifeStage === 'ELDER' ? 0.9 : 1.0;

  const healthPercent = agent.needs.health / 100;

  const bellyScale = agent.isPregnant ? 1.25 : 1.0;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const time = performance.now() * 0.001;
    const state = agent.state;

    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      blendRef.current = 0;
    }
    blendRef.current = Math.min(1, blendRef.current + dt / 0.3);
    const blend = blendRef.current;

    _targetPos.set(agent.position.x, agent.position.y, agent.position.z);
    groupRef.current.position.lerp(_targetPos, dt * 5);

    _targetQuat.setFromAxisAngle(_axis, agent.rotation);
    _currentQuat.copy(groupRef.current.quaternion);
    _currentQuat.slerp(_targetQuat, dt * 5);
    groupRef.current.quaternion.copy(_currentQuat);

    if (wholeBodyRef.current) {
      const s = lifeScale;
      wholeBodyRef.current.scale.set(
        lerp(wholeBodyRef.current.scale.x, s, dt * 5),
        lerp(wholeBodyRef.current.scale.y, s, dt * 5),
        lerp(wholeBodyRef.current.scale.z, s, dt * 5)
      );
    }

    fidgetTimerRef.current -= dt;

    const bodyTarget = { y: 0, rotZ: 0, rotX: 0, rotY: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
    const headTarget = { rotX: 0, rotY: 0, rotZ: 0 };
    const lArmTarget = { rotX: 0, rotZ: 0 };
    const rArmTarget = { rotX: 0, rotZ: 0 };
    const lLegTarget = { rotX: 0, posX: -0.08 };
    const rLegTarget = { rotX: 0, posX: 0.08 };
    let eyeScale = 1;

    switch (state) {
      case AgentState.IDLE: {
        const breathe = Math.sin(time * 2) * 0.02;
        bodyTarget.scaleX = 1 + breathe;
        bodyTarget.scaleY = 1 + breathe * 0.5;
        bodyTarget.scaleZ = 1 + breathe;
        headTarget.rotY = Math.sin(time * 0.7) * 0.15;
        bodyTarget.y = Math.sin(time * 1.2) * 0.005;
        if (fidgetTimerRef.current <= 0) {
          fidgetTimerRef.current = 3 + Math.random() * 4;
        }
        const fidgetPhase = Math.max(0, 1 - fidgetTimerRef.current * 0.5);
        rArmTarget.rotX = Math.sin(time * 3) * 0.1 * fidgetPhase;
        lArmTarget.rotX = Math.sin(time * 0.5) * 0.05;
        break;
      }
      case AgentState.MOVING: {
        const speed = 8;
        const swing = 0.4;
        const armSwing = 0.25;
        bodyTarget.y = Math.abs(Math.sin(time * speed)) * 0.03;
        headTarget.rotX = Math.sin(time * speed) * 0.05;
        lLegTarget.rotX = Math.sin(time * speed) * swing;
        rLegTarget.rotX = Math.sin(time * speed + Math.PI) * swing;
        lArmTarget.rotX = Math.sin(time * speed + Math.PI) * armSwing;
        rArmTarget.rotX = Math.sin(time * speed) * armSwing;
        break;
      }
      case AgentState.GATHERING: {
        const cycle = Math.sin(time * 3);
        bodyTarget.rotX = lerp(0, 0.4, (cycle + 1) * 0.5);
        bodyTarget.y = -0.05 * (cycle + 1) * 0.5;
        lArmTarget.rotX = -0.8 + cycle * 0.4;
        rArmTarget.rotX = -0.8 + cycle * 0.4;
        headTarget.rotX = 0.2;
        lLegTarget.rotX = 0.1;
        rLegTarget.rotX = 0.1;
        break;
      }
      case AgentState.CRAFTING: {
        bodyTarget.y = -0.12;
        lLegTarget.rotX = -1.2;
        rLegTarget.rotX = -1.2;
        headTarget.rotX = 0.3;
        const hammer = Math.sin(time * 6);
        rArmTarget.rotX = -0.5 + hammer * 0.6;
        lArmTarget.rotX = -0.3;
        break;
      }
      case AgentState.BUILDING: {
        const reach = Math.sin(time * 4);
        lArmTarget.rotX = -2.0 + reach * 0.3;
        rArmTarget.rotX = -2.0 + reach * 0.3;
        headTarget.rotX = -0.2;
        const step = Math.sin(time * 2) * 0.05;
        lLegTarget.posX = -0.08 + step;
        rLegTarget.posX = 0.08 + step;
        bodyTarget.y = Math.sin(time * 4) * 0.02;
        break;
      }
      case AgentState.EATING: {
        bodyTarget.y = -0.08;
        lLegTarget.rotX = -0.8;
        rLegTarget.rotX = -0.8;
        rArmTarget.rotX = -1.5 + Math.sin(time * 4) * 0.3;
        lArmTarget.rotX = -0.3;
        headTarget.rotX = Math.sin(time * 5) * 0.1 + 0.1;
        break;
      }
      case AgentState.DRINKING: {
        bodyTarget.y = -0.15;
        bodyTarget.rotX = 0.3;
        lLegTarget.rotX = -1.0;
        rLegTarget.rotX = -1.0;
        headTarget.rotX = 0.4 + Math.sin(time * 2) * 0.15;
        lArmTarget.rotX = -0.2;
        rArmTarget.rotX = -0.2;
        break;
      }
      case AgentState.SLEEPING: {
        bodyTarget.rotZ = Math.PI / 2.5;
        bodyTarget.y = 0.1;
        headTarget.rotX = 0.3;
        eyeScale = 0.1;
        const sleepBreathe = Math.sin(time * 1.5) * 0.03;
        bodyTarget.scaleX = 1 + sleepBreathe;
        bodyTarget.scaleY = 1 + sleepBreathe * 0.5;
        bodyTarget.scaleZ = 1 + sleepBreathe;
        break;
      }
      case AgentState.FIGHTING: {
        lLegTarget.posX = -0.14;
        rLegTarget.posX = 0.14;
        lLegTarget.rotX = 0.15;
        rLegTarget.rotX = -0.15;
        const punch = Math.sin(time * 8);
        rArmTarget.rotX = -0.8 + punch * 0.7;
        lArmTarget.rotX = -0.5 + Math.sin(time * 8 + 0.5) * 0.4;
        bodyTarget.rotY = Math.sin(time * 6) * 0.1;
        headTarget.rotX = -0.1;
        bodyTarget.y = Math.sin(time * 3) * 0.02;
        break;
      }
      case AgentState.HUNTING: {
        bodyTarget.y = -0.1;
        bodyTarget.rotX = 0.25;
        lLegTarget.rotX = 0.3;
        rLegTarget.rotX = 0.3;
        headTarget.rotX = -0.15;
        const lunge = Math.sin(time * 2);
        rArmTarget.rotX = -0.6 + (lunge > 0.7 ? lunge * -1.2 : 0);
        lArmTarget.rotX = -0.3;
        break;
      }
      case AgentState.RESEARCHING: {
        bodyTarget.y = -0.1;
        lLegTarget.rotX = -0.8;
        rLegTarget.rotX = -0.8;
        rArmTarget.rotX = -1.2;
        rArmTarget.rotZ = 0.3;
        lArmTarget.rotX = -0.6 + Math.sin(time * 2) * 0.3;
        headTarget.rotZ = Math.sin(time * 1.5) * 0.15;
        headTarget.rotX = -0.05;
        break;
      }
      case AgentState.TEACHING: {
        rArmTarget.rotX = -2.2 + Math.sin(time * 2) * 0.3;
        lArmTarget.rotX = -0.2;
        headTarget.rotX = Math.sin(time * 3) * 0.1;
        headTarget.rotY = Math.sin(time * 1.5) * 0.1;
        bodyTarget.y = Math.sin(time * 2) * 0.01;
        break;
      }
      case AgentState.SOCIALIZING: {
        lArmTarget.rotX = Math.sin(time * 3) * 0.5 - 0.3;
        rArmTarget.rotX = Math.sin(time * 3 + 1) * 0.5 - 0.3;
        headTarget.rotY = Math.sin(time * 2) * 0.25;
        headTarget.rotX = Math.sin(time * 4) * 0.1;
        const laughBounce = Math.max(0, Math.sin(time * 5)) * 0.03;
        bodyTarget.y = laughBounce;
        break;
      }
      case AgentState.FLEEING: {
        const speed = 14;
        const swing = 0.6;
        const armSwing = 0.5;
        bodyTarget.rotX = 0.2;
        bodyTarget.y = Math.abs(Math.sin(time * speed)) * 0.06;
        headTarget.rotX = Math.sin(time * speed) * 0.08;
        lLegTarget.rotX = Math.sin(time * speed) * swing;
        rLegTarget.rotX = Math.sin(time * speed + Math.PI) * swing;
        lArmTarget.rotX = Math.sin(time * speed + Math.PI) * armSwing;
        rArmTarget.rotX = Math.sin(time * speed) * armSwing;
        break;
      }
      case AgentState.EXPLORING: {
        const speed = 6;
        bodyTarget.y = Math.abs(Math.sin(time * speed)) * 0.02;
        lLegTarget.rotX = Math.sin(time * speed) * 0.3;
        rLegTarget.rotX = Math.sin(time * speed + Math.PI) * 0.3;
        lArmTarget.rotX = Math.sin(time * speed + Math.PI) * 0.2;
        rArmTarget.rotX = -1.5;
        rArmTarget.rotZ = 0.3;
        headTarget.rotY = Math.sin(time * 1.5) * 0.5;
        headTarget.rotX = -0.1;
        break;
      }
      case AgentState.THINKING: {
        lArmTarget.rotX = -0.5;
        lArmTarget.rotZ = -0.5;
        rArmTarget.rotX = -0.5;
        rArmTarget.rotZ = 0.5;
        bodyTarget.y = Math.sin(time * 1.0) * 0.008;
        headTarget.rotX = -0.05;
        headTarget.rotZ = Math.sin(time * 1.2) * 0.08;
        break;
      }
      case AgentState.COURTING: {
        const bounce = Math.abs(Math.sin(time * 6)) * 0.08;
        bodyTarget.y = bounce;
        lArmTarget.rotX = -1.2 + Math.sin(time * 3) * 0.2;
        rArmTarget.rotX = -1.2 + Math.sin(time * 3) * 0.2;
        headTarget.rotY = Math.sin(time * 4) * 0.15;
        break;
      }
      case AgentState.MATING: {
        bodyTarget.y = Math.sin(time * 2) * 0.02;
        bodyTarget.rotZ = Math.sin(time * 1.5) * 0.08;
        headTarget.rotX = Math.sin(time * 2) * 0.05;
        lArmTarget.rotX = -0.3;
        rArmTarget.rotX = -0.3;
        break;
      }
      case AgentState.PLAYING: {
        const jump = Math.max(0, Math.sin(time * 5)) * 0.12;
        bodyTarget.y = jump;
        bodyTarget.rotZ = Math.sin(time * 3) * 0.2;
        lArmTarget.rotX = Math.sin(time * 6) * 0.8;
        rArmTarget.rotX = Math.sin(time * 6 + Math.PI) * 0.8;
        lLegTarget.rotX = Math.sin(time * 6) * 0.5;
        rLegTarget.rotX = Math.sin(time * 6 + Math.PI) * 0.5;
        headTarget.rotY = Math.sin(time * 4) * 0.2;
        break;
      }
      case AgentState.MOURNING: {
        headTarget.rotX = 0.4;
        bodyTarget.rotZ = Math.sin(time * 0.8) * 0.06;
        bodyTarget.y = -0.03;
        lArmTarget.rotX = -0.3;
        lArmTarget.rotZ = -0.3;
        rArmTarget.rotX = -0.3;
        rArmTarget.rotZ = 0.3;
        break;
      }
      case AgentState.CELEBRATING: {
        const jump = Math.max(0, Math.sin(time * 6)) * 0.15;
        bodyTarget.y = jump;
        bodyTarget.rotZ = Math.sin(time * 4) * 0.15;
        lArmTarget.rotX = -2.5 + Math.sin(time * 5) * 0.3;
        rArmTarget.rotX = -2.5 + Math.sin(time * 5) * 0.3;
        headTarget.rotX = -0.2;
        lLegTarget.rotX = Math.sin(time * 6) * 0.3;
        rLegTarget.rotX = Math.sin(time * 6 + Math.PI) * 0.3;
        break;
      }
      case AgentState.DEFENDING: {
        lLegTarget.posX = -0.15;
        rLegTarget.posX = 0.15;
        lArmTarget.rotX = -1.0;
        lArmTarget.rotZ = -0.8;
        rArmTarget.rotX = -1.0;
        rArmTarget.rotZ = 0.8;
        bodyTarget.rotX = 0.15;
        headTarget.rotX = -0.1;
        bodyTarget.y = Math.sin(time * 2) * 0.015;
        break;
      }
    }

    const lerpSpeed = blend < 1 ? 8 : 5;
    const ls = dt * lerpSpeed;

    if (bodyRef.current) {
      bodyRef.current.position.y = lerp(bodyRef.current.position.y, bodyTarget.y, ls);
      bodyRef.current.rotation.z = lerp(bodyRef.current.rotation.z, bodyTarget.rotZ, ls);
      bodyRef.current.rotation.x = lerp(bodyRef.current.rotation.x, bodyTarget.rotX, ls);
      bodyRef.current.rotation.y = lerp(bodyRef.current.rotation.y, bodyTarget.rotY, ls);
      bodyRef.current.scale.set(
        lerp(bodyRef.current.scale.x, bodyTarget.scaleX * bellyScale, ls),
        lerp(bodyRef.current.scale.y, bodyTarget.scaleY, ls),
        lerp(bodyRef.current.scale.z, bodyTarget.scaleZ * bellyScale, ls)
      );
    }

    if (headRef.current) {
      headRef.current.rotation.x = lerp(headRef.current.rotation.x, headTarget.rotX, ls);
      headRef.current.rotation.y = lerp(headRef.current.rotation.y, headTarget.rotY, ls);
      headRef.current.rotation.z = lerp(headRef.current.rotation.z, headTarget.rotZ, ls);
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = lerp(leftEyeRef.current.scale.y, eyeScale, dt * 8);
      rightEyeRef.current.scale.y = lerp(rightEyeRef.current.scale.y, eyeScale, dt * 8);
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = lerp(leftArmRef.current.rotation.x, lArmTarget.rotX, ls);
      leftArmRef.current.rotation.z = lerp(leftArmRef.current.rotation.z, lArmTarget.rotZ, ls);
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = lerp(rightArmRef.current.rotation.x, rArmTarget.rotX, ls);
      rightArmRef.current.rotation.z = lerp(rightArmRef.current.rotation.z, rArmTarget.rotZ, ls);
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = lerp(leftLegRef.current.rotation.x, lLegTarget.rotX, ls);
      leftLegRef.current.position.x = lerp(leftLegRef.current.position.x, lLegTarget.posX, ls);
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = lerp(rightLegRef.current.rotation.x, rLegTarget.rotX, ls);
      rightLegRef.current.position.x = lerp(rightLegRef.current.position.x, rLegTarget.posX, ls);
    }

    if (tailRef.current) {
      const tailSpeed = state === AgentState.FLEEING ? 6 : state === AgentState.MOVING ? 4 : state === AgentState.PLAYING ? 8 : state === AgentState.CELEBRATING ? 7 : 1.5;
      const tailSwing = state === AgentState.FLEEING ? 0.6 : state === AgentState.MOVING ? 0.4 : state === AgentState.PLAYING ? 0.7 : 0.25;
      tailRef.current.rotation.y = Math.sin(time * tailSpeed) * tailSwing;
      tailRef.current.rotation.x = Math.sin(time * tailSpeed * 0.5) * 0.1;
    }

    if (selectionRingRef.current) {
      selectionRingRef.current.rotation.z = time * 1.5;
    }

    const ps = particlesRef.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      ps[i].life -= dt;
      ps[i].x += ps[i].vx * dt;
      ps[i].y += ps[i].vy * dt;
      ps[i].z += ps[i].vz * dt;
      if (ps[i].life <= 0) ps.splice(i, 1);
    }

    const spawnRate = 0.15;
    const canSpawn = Math.random() < spawnRate;

    if (canSpawn) {
      const pid = particleIdRef.current++;
      if (state === AgentState.CRAFTING) {
        ps.push({
          id: pid, x: (Math.random() - 0.5) * 0.1, y: 0.35, z: -0.15,
          vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.8 + 0.3, vz: (Math.random() - 0.5) * 0.5,
          life: 0.5, maxLife: 0.5, color: '#ff8800', size: 0.015
        });
      } else if (state === AgentState.BUILDING) {
        ps.push({
          id: pid, x: (Math.random() - 0.5) * 0.3, y: 0.05, z: (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 0.2, vy: Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.2,
          life: 0.8, maxLife: 0.8, color: '#d2b48c', size: 0.025
        });
      } else if (state === AgentState.RESEARCHING) {
        const angle = Math.random() * Math.PI * 2;
        const r = 0.2;
        ps.push({
          id: pid, x: Math.cos(angle) * r, y: 0.8 + Math.random() * 0.1, z: Math.sin(angle) * r,
          vx: Math.cos(angle + 1) * 0.2, vy: Math.random() * 0.2, vz: Math.sin(angle + 1) * 0.2,
          life: 0.7, maxLife: 0.7, color: '#ffff44', size: 0.012
        });
      } else if (state === AgentState.SOCIALIZING && Math.random() < 0.3) {
        ps.push({
          id: pid, x: (Math.random() - 0.5) * 0.1, y: 0.7, z: 0,
          vx: (Math.random() - 0.5) * 0.1, vy: 0.4 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.1,
          life: 1.0, maxLife: 1.0, color: '#ff4488', size: 0.02
        });
      } else if (state === AgentState.CELEBRATING) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        ps.push({
          id: pid, x: (Math.random() - 0.5) * 0.2, y: 0.9, z: (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 1.0, vy: 1.5 + Math.random() * 1.0, vz: (Math.random() - 0.5) * 1.0,
          life: 1.2, maxLife: 1.2, color: colors[Math.floor(Math.random() * colors.length)], size: 0.018
        });
      }
    }

    if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);

    particlesRef.current = ps;
  });

  const showChat = agent.chatBubble && agent.lastChatTime && (Date.now() - agent.lastChatTime < 8000);
  const chatText = showChat ? (agent.chatBubble!.length > 40 ? agent.chatBubble!.substring(0, 37) + '...' : agent.chatBubble!) : '';

  const isSleeping = agent.state === AgentState.SLEEPING;

  return (
    <group
      ref={groupRef}
      position={[agent.position.x, 0, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {isSelected && (
        <mesh ref={selectionRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.45, 0.52, 24]} />
          <meshBasicMaterial color="#ffdd44" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      <group ref={wholeBodyRef} scale={[lifeScale, lifeScale, lifeScale]}>
        <group ref={bodyRef}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.28, 0.3, 0.22]} />
            <primitive object={skinMat} attach="material" />
          </mesh>

          <mesh position={[0, 0.47, -0.105]}>
            <boxGeometry args={[0.22, 0.2, 0.025]} />
            <primitive object={clothingMat} attach="material" />
          </mesh>
          <mesh position={[0, 0.47, 0.105]}>
            <boxGeometry args={[0.22, 0.2, 0.025]} />
            <primitive object={clothingMat} attach="material" />
          </mesh>
          <mesh position={[-0.135, 0.47, 0]}>
            <boxGeometry args={[0.025, 0.2, 0.2]} />
            <primitive object={clothingMat} attach="material" />
          </mesh>
          <mesh position={[0.135, 0.47, 0]}>
            <boxGeometry args={[0.025, 0.2, 0.2]} />
            <primitive object={clothingMat} attach="material" />
          </mesh>

          <mesh position={[0, 0.48, -0.12]}>
            <sphereGeometry args={[0.04, 6, 4]} />
            <primitive object={markingMat} attach="material" />
          </mesh>

          {agent.isPregnant && (
            <mesh position={[0, 0.42, -0.12]}>
              <sphereGeometry args={[0.08, 6, 5]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
          )}

          <group ref={headRef} position={[0, 0.75, 0]}>
            <mesh>
              <icosahedronGeometry args={[0.2, 1]} />
              <primitive object={skinMat} attach="material" />
            </mesh>

            <mesh ref={leftEyeRef} position={[-0.08, 0.03, -0.16]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <primitive object={eyeWhiteMat} attach="material" />
            </mesh>
            <mesh position={[-0.08, 0.03, -0.19]}>
              <sphereGeometry args={[0.03, 6, 5]} />
              <primitive object={eyeMat} attach="material" />
            </mesh>

            <mesh ref={rightEyeRef} position={[0.08, 0.03, -0.16]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <primitive object={eyeWhiteMat} attach="material" />
            </mesh>
            <mesh position={[0.08, 0.03, -0.19]}>
              <sphereGeometry args={[0.03, 6, 5]} />
              <primitive object={eyeMat} attach="material" />
            </mesh>

            <mesh position={[-0.17, 0.12, 0]} rotation={[0, 0, -0.4]}>
              <coneGeometry args={[0.05, 0.12, 4]} />
              <primitive object={markingMat} attach="material" />
            </mesh>
            <mesh position={[0.17, 0.12, 0]} rotation={[0, 0, 0.4]}>
              <coneGeometry args={[0.05, 0.12, 4]} />
              <primitive object={markingMat} attach="material" />
            </mesh>

            <mesh position={[0, -0.06, -0.18]}>
              <sphereGeometry args={[0.02, 4, 3]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
          </group>

          <group ref={leftArmRef} position={[-0.2, 0.52, 0]}>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.04, 0.035, 0.2, 5]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.22, 0]}>
              <sphereGeometry args={[0.035, 5, 4]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
          </group>

          <group ref={rightArmRef} position={[0.2, 0.52, 0]}>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.04, 0.035, 0.2, 5]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.22, 0]}>
              <sphereGeometry args={[0.035, 5, 4]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            {agent.equippedTool && (
              <group position={[0, -0.22, 0]}>
                <EquippedTool tool={agent.equippedTool} />
              </group>
            )}
          </group>

          <group ref={leftLegRef} position={[-0.08, 0.28, 0]}>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.045, 0.04, 0.2, 5]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.2, -0.02]}>
              <boxGeometry args={[0.07, 0.04, 0.1]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
          </group>

          <group ref={rightLegRef} position={[0.08, 0.28, 0]}>
            <mesh position={[0, -0.1, 0]}>
              <cylinderGeometry args={[0.045, 0.04, 0.2, 5]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.2, -0.02]}>
              <boxGeometry args={[0.07, 0.04, 0.1]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
          </group>

          <group ref={tailRef} position={[0, 0.38, 0.14]}>
            <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2.5, 0, 0]}>
              <coneGeometry args={[0.03, 0.18, 4]} />
              <primitive object={skinMat} attach="material" />
            </mesh>
            <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2.5, 0, 0]}>
              <sphereGeometry args={[0.025, 4, 3]} />
              <primitive object={markingMat} attach="material" />
            </mesh>
          </group>
        </group>

        <ParticleSystemImperative particlesRef={particlesRef} />

        {isSleeping && (
          <>
            <Billboard position={[0.2, 0.9, 0]} follow lockX={false} lockY={false} lockZ={false}>
              <Text fontSize={0.12} color="#aaaaff" anchorX="center" anchorY="middle">
                Z
              </Text>
            </Billboard>
            <Billboard position={[0.3, 1.05, 0.05]} follow lockX={false} lockY={false} lockZ={false}>
              <Text fontSize={0.09} color="#8888dd" anchorX="center" anchorY="middle">
                z
              </Text>
            </Billboard>
            <Billboard position={[0.15, 1.15, -0.05]} follow lockX={false} lockY={false} lockZ={false}>
              <Text fontSize={0.07} color="#6666bb" anchorX="center" anchorY="middle">
                z
              </Text>
            </Billboard>
          </>
        )}
      </group>

      <Billboard position={[0, 1.15 * lifeScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.09}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {agent.name}
        </Text>
        <mesh position={[0, -0.03, 0]}>
          <planeGeometry args={[0.4, 0.035]} />
          <meshBasicMaterial color="#333" transparent opacity={0.7} />
        </mesh>
        <mesh position={[(healthPercent - 1) * 0.19, -0.03, 0.001]}>
          <planeGeometry args={[0.38 * healthPercent, 0.025]} />
          <meshBasicMaterial color={healthPercent > 0.5 ? '#4ade80' : healthPercent > 0.25 ? '#facc15' : '#ef4444'} />
        </mesh>
      </Billboard>

      {showChat && (
        <Billboard position={[0, 1.4 * lifeScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[Math.min(chatText.length * 0.045 + 0.1, 2), 0.16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <Text
            fontSize={0.07}
            color="#333333"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.8}
          >
            {chatText}
          </Text>
        </Billboard>
      )}
    </group>
  );
};
