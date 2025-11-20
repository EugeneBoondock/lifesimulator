import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentState } from '../types';

interface HumanoidModelProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export const HumanoidModel: React.FC<HumanoidModelProps> = ({ agent, isSelected, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // ANIMATIONS
    if (agent.state === AgentState.MOVING) {
      const speed = 10;
      if (leftLeg.current && rightLeg.current) {
        leftLeg.current.rotation.x = Math.sin(t * speed) * 0.5;
        rightLeg.current.rotation.x = Math.sin(t * speed + Math.PI) * 0.5;
      }
      if (leftArm.current && rightArm.current) {
        leftArm.current.rotation.x = Math.sin(t * speed + Math.PI) * 0.5;
        rightArm.current.rotation.x = Math.sin(t * speed) * 0.5;
      }
    } else if (agent.state === AgentState.WORKING) {
      // Hammering / Building animation
      if (rightArm.current) {
        rightArm.current.rotation.x = Math.abs(Math.sin(t * 15)) - 1.5; // Chop/Hammer motion
        rightArm.current.rotation.z = -0.2;
      }
      if (leftArm.current) {
         leftArm.current.rotation.x = -0.5; // Hold steady
      }
      if (body.current) {
        body.current.rotation.y = Math.sin(t * 10) * 0.1; // Exertion
      }
    } else if (agent.state === AgentState.SOCIALIZING) {
      // Bobbing head/body slightly
      if (body.current) {
         body.current.rotation.z = Math.sin(t * 3) * 0.05;
      }
      if (leftArm.current && rightArm.current) {
         leftArm.current.rotation.z = 0.1;
         rightArm.current.rotation.z = -0.1;
         // Gesturing
         rightArm.current.rotation.x = Math.sin(t * 5) * 0.3 - 0.5;
      }
    } else if (agent.state === AgentState.SLEEPING) {
       // Breathing while lying down
       if (body.current) {
         body.current.scale.setScalar(1 + Math.sin(t * 2) * 0.02);
       }
    } else {
      // IDLE
      if (leftLeg.current && rightLeg.current) {
        leftLeg.current.rotation.x = 0;
        rightLeg.current.rotation.x = 0;
      }
      if (leftArm.current && rightArm.current) {
        leftArm.current.rotation.x = Math.sin(t) * 0.05;
        rightArm.current.rotation.x = Math.cos(t) * 0.05;
      }
    }
  });

  const skinColor = "#f5d0b0"; 
  const shirtColor = agent.color;
  const pantsColor = "#1e293b";

  // Determine rotation: If sleeping, rotate -90deg on X, otherwise use agent's Y rotation
  const rotation: [number, number, number] = agent.state === AgentState.SLEEPING 
    ? [-Math.PI / 2, agent.rotation, 0] 
    : [0, agent.rotation, 0];

  // Height adjustment for sleeping
  const position: [number, number, number] = [
    agent.position.x, 
    agent.state === AgentState.SLEEPING ? 0.2 : agent.position.y, 
    agent.position.z
  ];

  return (
    <group 
      ref={groupRef} 
      position={position} 
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.6, 0.8, 32]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      )}

      <group position={[0, agent.state === AgentState.SLEEPING ? 0 : 0.75, 0]}>
        {/* HEAD */}
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        {/* EYES */}
        <mesh position={[0.08, 0.68, 0.11]}>
           <boxGeometry args={[0.05, 0.02, 0.05]} />
           <meshStandardMaterial color="#000" />
        </mesh>
        <mesh position={[-0.08, 0.68, 0.11]}>
           <boxGeometry args={[0.05, 0.02, 0.05]} />
           <meshStandardMaterial color="#000" />
        </mesh>

        {/* BODY */}
        <mesh ref={body} position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.35, 0.45, 0.2]} />
          <meshStandardMaterial color={shirtColor} />
        </mesh>

        {/* ARMS */}
        <group position={[0.22, 0.45, 0]} ref={leftArm}>
          <mesh position={[0, -0.2, 0]}>
             <boxGeometry args={[0.1, 0.45, 0.1]} />
             <meshStandardMaterial color={skinColor} />
          </mesh>
        </group>
        <group position={[-0.22, 0.45, 0]} ref={rightArm}>
           <mesh position={[0, -0.2, 0]}>
             <boxGeometry args={[0.1, 0.45, 0.1]} />
             <meshStandardMaterial color={skinColor} />
           </mesh>
           {/* TOOL (only when working) */}
           {agent.state === AgentState.WORKING && (
             <group position={[0, -0.4, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.6]} />
                  <meshStandardMaterial color="#854d0e" />
                </mesh>
                <mesh position={[0, 0.5, 0]}>
                  <boxGeometry args={[0.1, 0.2, 0.1]} />
                  <meshStandardMaterial color="#94a3b8" />
                </mesh>
             </group>
           )}
        </group>

        {/* LEGS */}
        <group position={[0.1, 0.1, 0]} ref={leftLeg}>
           <mesh position={[0, -0.35, 0]}>
             <boxGeometry args={[0.12, 0.45, 0.12]} />
             <meshStandardMaterial color={pantsColor} />
           </mesh>
        </group>
         <group position={[-0.1, 0.1, 0]} ref={rightLeg}>
           <mesh position={[0, -0.35, 0]}>
             <boxGeometry args={[0.12, 0.45, 0.12]} />
             <meshStandardMaterial color={pantsColor} />
           </mesh>
        </group>
      </group>

      {/* NAMETAG */}
      <Text
        position={[0, 1.9, 0]}
        rotation={[0, -agent.rotation, 0]} 
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {agent.name}
      </Text>
      
      {/* CHAT BUBBLE */}
      {agent.chatBubble && (
        <group position={[0, 2.3, 0]} rotation={[0, -agent.rotation, 0]}>
           <Text
            fontSize={0.15}
            color="#1e293b"
            maxWidth={2}
            textAlign="center"
            anchorY="bottom"
          >
            {agent.chatBubble}
          </Text>
          <mesh position={[0, 0.2, -0.01]}>
             <planeGeometry args={[2.2, 0.8]} /> 
             <meshBasicMaterial color="white" transparent opacity={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
};