import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentState } from '../types';

interface HumanoidModelProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export const HumanoidModel: React.FC<HumanoidModelProps> = ({ agent, isSelected, onClick }) => {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);

  // Palette interpretation
  const skinColor = new THREE.Color(agent.color).lerp(new THREE.Color("#ffe5b4"), 0.5).getStyle(); // Softer skin
  const clothingColor = agent.clothesColor || agent.color;
  const hairColor = agent.hairColor || "#e2e8f0";

  // Animation state
  const timeOffset = useMemo(() => Math.random() * 100, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime * 8 + timeOffset; // Animation speed baseline

    // Smooth movement interpolation toward target
    if (agent.targetPosition) {
      group.current.position.lerp(new THREE.Vector3(agent.targetPosition.x, agent.position.y, agent.targetPosition.z), 0.1);
    } else {
      group.current.position.lerp(new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z), 0.1);
    }

    // Smooth angle interpolation
    const currentRot = new THREE.Euler().setFromQuaternion(group.current.quaternion);
    const targetRot = new THREE.Euler(0, agent.rotation, 0);
    const q1 = new THREE.Quaternion().setFromEuler(currentRot);
    const q2 = new THREE.Quaternion().setFromEuler(targetRot);
    q1.slerp(q2, 0.1);
    group.current.quaternion.copy(q1);

    // Dynamic animations based on state
    const isMoving = agent.state === AgentState.MOVING || agent.state === AgentState.FLEEING;
    const isWorking = agent.state === AgentState.WORKING || agent.state === AgentState.FIGHTING;
    const isSleeping = agent.state === AgentState.SLEEPING;

    if (isSleeping) {
      // Lay down
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -Math.PI / 2, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, agent.position.y + 0.2, 0.1);
      if (head.current) head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, -0.2, 0.1);
      // Reset limbs
      if (leftArm.current) leftArm.current.rotation.x = 0;
      if (rightArm.current) rightArm.current.rotation.x = 0;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
    } else {
      // Stand up
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, agent.position.y, 0.2);

      // Breathing
      if (body.current) {
        body.current.scale.y = 1 + Math.sin(t * 0.2) * 0.05;
        body.current.scale.z = 1 + Math.sin(t * 0.2) * 0.05;
      }

      if (isMoving) {
        // Run cycle
        const stride = agent.state === AgentState.FLEEING ? 0.8 : 0.6;
        const spd = agent.state === AgentState.FLEEING ? 1.5 : 1;

        if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(t * spd) * stride;
        if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(t * spd + Math.PI) * stride;

        if (leftArm.current) leftArm.current.rotation.x = Math.sin(t * spd + Math.PI) * stride * 0.8;
        if (rightArm.current) rightArm.current.rotation.x = Math.sin(t * spd) * stride * 0.8;

        // Bobbing
        group.current.position.y = agent.position.y + Math.abs(Math.sin(t * spd)) * 0.1;

        if (head.current) head.current.rotation.y = Math.sin(t * 0.5) * 0.1; // Look around slightly
      } else if (isWorking) {
        // Chopping / attacking cycle
        const workT = clock.elapsedTime * 12 + timeOffset;
        if (rightArm.current) rightArm.current.rotation.x = -Math.abs(Math.sin(workT)) * 1.5;
        if (leftArm.current) leftArm.current.rotation.x = -Math.abs(Math.sin(workT)) * 1.5;

        // Reset legs
        if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
        if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);

        // Body thrust
        if (body.current) body.current.rotation.x = Math.sin(workT) * 0.2;
        if (head.current) head.current.rotation.x = Math.sin(workT) * 0.2;
      } else {
        // Idle
        if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
        if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);

        // Slight arm sway
        if (leftArm.current) leftArm.current.rotation.x = Math.sin(t * 0.2) * 0.1;
        if (rightArm.current) rightArm.current.rotation.x = Math.sin(t * 0.2 + Math.PI) * 0.1;

        // Look around
        if (head.current) {
          head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, (Math.sin(t * 0.1) > 0.8 ? Math.sin(t * 0.1) * 0.5 : 0), 0.05);
          head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, 0, 0.1);
        }
        if (body.current) body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, 0, 0.1);
      }
    }
  });

  const hasTool = agent.equippedTool || (agent.inventory['WOOD'] && agent.inventory['WOOD'] > 0);
  const showBubble = agent.chatBubble && Date.now() - (agent.lastChatTime || 0) < 5000;

  return (
    <group
      ref={group}
      position={[agent.position.x, agent.position.y, agent.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      scale={[0.9, 0.9, 0.9]}
    >
      <group position={[0, 0.8, 0]}>
        {/* Head */}
        <mesh ref={head} position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} flatShading />
          {/* Eyes */}
          <mesh position={[0.08, 0.05, 0.155]}><boxGeometry args={[0.04, 0.04, 0.02]} /><meshStandardMaterial color="#1e293b" flatShading /></mesh>
          <mesh position={[-0.08, 0.05, 0.155]}><boxGeometry args={[0.04, 0.04, 0.02]} /><meshStandardMaterial color="#1e293b" flatShading /></mesh>
          {/* Hair */}
          <mesh position={[0, 0.18, 0]}><coneGeometry args={[0.22, 0.2, 4]} rotation={[0, Math.PI / 4, 0]} /><meshStandardMaterial color={hairColor} flatShading /></mesh>
        </mesh>

        {/* Torso */}
        <mesh ref={body} position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.4, 0.45, 0.25]} />
          <meshStandardMaterial color={clothingColor} roughness={0.8} flatShading />
          {/* Belt / Details */}
          <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.42, 0.05, 0.27]} /><meshStandardMaterial color="#334155" flatShading /></mesh>
        </mesh>

        {/* Arms */}
        {/* Left Arm (anchor top) */}
        <group position={[-0.28, 0.5, 0]} ref={leftArm}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.12, 0.4, 0.12]} />
            <meshStandardMaterial color={skinColor} flatShading />
          </mesh>
        </group>
        {/* Right Arm */}
        <group position={[0.28, 0.5, 0]} ref={rightArm}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.12, 0.4, 0.12]} />
            <meshStandardMaterial color={skinColor} flatShading />
          </mesh>
          {/* Tool inside right hand */}
          {hasTool && (
            <mesh position={[0, -0.4, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.6]} />
              <meshStandardMaterial color="#5c4033" />
            </mesh>
          )}
        </group>

        {/* Legs */}
        <group position={[-0.12, 0.1, 0]} ref={leftLeg}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.15, 0.4, 0.15]} />
            <meshStandardMaterial color="#1e293b" flatShading />
          </mesh>
        </group>
        <group position={[0.12, 0.1, 0]} ref={rightLeg}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.15, 0.4, 0.15]} />
            <meshStandardMaterial color="#1e293b" flatShading />
          </mesh>
        </group>
      </group>

      {/* Selection Ring */}
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Ground Contact Shadow */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={1.5} blur={1.5} far={1.2} color="#000000" />

      {/* Floating Name & Status tags */}
      <Billboard position={[0, 2.5, 0]} follow>
        <group>
          <Text position={[0, 0, 0]} fontSize={0.25} color="#cbd5e1" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000000" font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.ttf" fontWeight={800}>
            {agent.name}
          </Text>
          {/* Health Bar (Minimalist) */}
          <mesh position={[0, -0.1, 0]}>
            <planeGeometry args={[0.6, 0.04]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
          <mesh position={[-0.3 + (0.6 * (agent.needs.health / 100)) / 2, -0.1, 0.001]}>
            <planeGeometry args={[0.6 * (agent.needs.health / 100), 0.04]} />
            <meshBasicMaterial color={agent.needs.health > 50 ? "#4ade80" : "#fb7185"} />
          </mesh>
        </group>
      </Billboard>

      {/* High-Quality Floating Chat Bubble */}
      {showBubble && agent.chatBubble && (
        <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
          <Billboard position={[0, 3.2, 0]} follow>
            <group>
              <mesh>
                {/* The text defines the bounds, let's use a standard box instead */}
                <boxGeometry args={[2.5, 0.6, 0.01]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
              </mesh>
              <mesh position={[-1.0, -0.35, 0]} rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.2, 0.2, 0.01]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
              </mesh>
              <Text position={[0, 0, 0.02]} maxWidth={2.3} fontSize={0.16} color="#0f172a" anchorX="center" anchorY="middle" font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.ttf" fontWeight={600} textAlign="center">
                {agent.chatBubble}
              </Text>
            </group>
          </Billboard>
        </Float>
      )}
    </group>
  );
};
