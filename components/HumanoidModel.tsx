import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentState } from '../types';

interface HumanoidModelProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export const HumanoidModel: React.FC<HumanoidModelProps> = ({ agent, isSelected, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const accent = "#0ea5e9";

  // Carrying Logic
  const hasWood = (agent.inventory['WOOD'] || 0) > 0;
  const hasStone = (agent.inventory['STONE'] || 0) > 0;
  const hasMud = (agent.inventory['MUD'] || 0) > 0;
  const isCarrying = hasWood || hasStone || hasMud;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (agent.state === AgentState.MOVING) {
        if (leftLeg.current && rightLeg.current) {
            leftLeg.current.rotation.x = Math.sin(t * 10) * 0.6;
            rightLeg.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.6;
        }
        // If not carrying, swing arms
        if (!isCarrying && leftArm.current && rightArm.current) {
            leftArm.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.5;
            rightArm.current.rotation.x = Math.sin(t * 10) * 0.5;
        }
    } else if (agent.state === AgentState.WORKING) {
        if (rightArm.current) {
            rightArm.current.rotation.x = Math.sin(t * 15) * 0.8 - 1.0; 
        }
    }

    // Carrying Override (Hold arms out)
    if (isCarrying && rightArm.current && leftArm.current) {
        rightArm.current.rotation.x = -1.0; 
        leftArm.current.rotation.x = -1.0;
        rightArm.current.rotation.z = -0.2;
        leftArm.current.rotation.z = 0.2;
    }
  });

  const position: [number, number, number] = [agent.position.x, agent.state === AgentState.SLEEPING ? 0.2 : agent.position.y - 0.275, agent.position.z];
  const rotation: [number, number, number] = agent.state === AgentState.SLEEPING ? [-Math.PI / 2, agent.rotation, 0] : [0, agent.rotation, 0];

  return (
    <group ref={groupRef} position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {isSelected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.05,0]}><ringGeometry args={[0.6,0.8,32]} /><meshBasicMaterial color="#facc15" /></mesh>}
      
      <group position={[0, 0.75, 0]}> 
        {/* Body Parts */}
        <mesh position={[0, 0.65, 0]} castShadow><boxGeometry args={[0.25, 0.25, 0.25]} /><meshStandardMaterial color="#f5d0b0" /></mesh>
        <mesh position={[0.08, 0.68, 0.11]}><boxGeometry args={[0.05, 0.02, 0.05]} /><meshStandardMaterial color="black" /></mesh>
        <mesh position={[-0.08, 0.68, 0.11]}><boxGeometry args={[0.05, 0.02, 0.05]} /><meshStandardMaterial color="black" /></mesh>
        <mesh position={[0, 0.83, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.08, 0.08, 0.05, 10]} /><meshStandardMaterial color="#2f2f2f" /></mesh>
        <mesh position={[0, 0.3, 0]} ref={body} castShadow>
          <boxGeometry args={[0.35, 0.45, 0.2]} />
          <meshStandardMaterial color={agent.color} />
        </mesh>
        <mesh position={[0, 0.15, -0.05]} scale={[0.4, 0.1, 0.5]}><boxGeometry args={[0.5, 0.2, 0.3]} /><meshStandardMaterial color={accent} /></mesh>
        <mesh position={[0, 0.35, -0.12]} scale={[0.8, 0.1, 0.1]}><boxGeometry args={[0.5, 0.2, 0.3]} /><meshStandardMaterial color="#1e1b4b" /></mesh>
        <mesh position={[0, 0.15, -0.15]} scale={[0.4, 0.4, 0.2]}><dodecahedronGeometry args={[0.4]} /><meshStandardMaterial color="#475569" roughness={0.9} /></mesh>
        
        <group position={[0.22, 0.45, 0]} ref={leftArm}>
            <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.1, 0.45, 0.1]} /><meshStandardMaterial color="#f5d0b0" /></mesh>
            <mesh position={[0, -0.45, 0]} scale={[0.16, 0.1, 0.16]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color={agent.color} /></mesh>
        </group>
        <group position={[-0.22, 0.45, 0]} ref={rightArm}>
            <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.1, 0.45, 0.1]} /><meshStandardMaterial color="#f5d0b0" /></mesh>
            <mesh position={[0, -0.45, 0]} scale={[0.16, 0.1, 0.16]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color={agent.color} /></mesh>
        </group>
        <group position={[0.1, 0.1, 0]} ref={leftLeg}>
          <mesh position={[0, -0.35, 0]}><boxGeometry args={[0.12, 0.45, 0.12]} /><meshStandardMaterial color="#1e293b" /></mesh>
          <mesh position={[0, -0.6, 0.05]} scale={[0.16, 0.08, 0.2]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#0f172a" /></mesh>
        </group>
        <group position={[-0.1, 0.1, 0]} ref={rightLeg}>
          <mesh position={[0, -0.35, 0]}><boxGeometry args={[0.12, 0.45, 0.12]} /><meshStandardMaterial color="#1e293b" /></mesh>
          <mesh position={[0, -0.6, 0.05]} scale={[0.16, 0.08, 0.2]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#0f172a" /></mesh>
        </group>

        {/* CARRYING ITEM VISUAL */}
        {isCarrying && (
            <group position={[0, 0.3, 0.5]}>
                {hasWood && <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.1, 0.1, 0.8, 12]} /><meshStandardMaterial color="#5d4037" /></mesh>}
                {hasStone && !hasWood && <mesh><dodecahedronGeometry args={[0.25, 1]} /><meshStandardMaterial color="#78716c" /></mesh>}
                {hasMud && !hasWood && !hasStone && <mesh><sphereGeometry args={[0.25, 16, 12]} /><meshStandardMaterial color="#3e2723" /></mesh>}
            </group>
        )}
      </group>

      <Billboard position={[0, 1.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text fontSize={0.25} color="white" outlineWidth={0.02} outlineColor="black">{agent.name}</Text>
      </Billboard>
      
      {agent.chatBubble && (
        <Billboard position={[0, 2.5, 0]} follow>
          {(() => {
            const bubbleText = agent.chatBubble;
            const lines = Math.max(1, Math.ceil(bubbleText.length / 28));
            const bubbleWidth = 3.1;
            const bubbleHeight = 0.55 + lines * 0.32;
            const bubblePaddingY = 0.25;
            const planeY = bubblePaddingY + bubbleHeight / 2;
            const tipY = bubblePaddingY - 0.08;

            return (
              <group>
                <mesh position={[0, planeY, -0.01]}>
                  <planeGeometry args={[bubbleWidth, bubbleHeight]} />
                  <meshBasicMaterial color="white" opacity={0.95} transparent />
                </mesh>
                <mesh position={[0, tipY, -0.01]} rotation={[0, 0, Math.PI]} scale={[0.3, 0.3, 0.3]}>
                  <coneGeometry args={[1, 1, 3]} />
                  <meshBasicMaterial color="white" />
                </mesh>
                <Text
                  position={[0, planeY, 0.02]}
                  fontSize={0.18}
                  lineHeight={1.2}
                  color="black"
                  maxWidth={bubbleWidth - 0.5}
                  anchorX="center"
                  anchorY="middle"
                  textAlign="center"
                  overflowWrap="break-word"
                >
                  {bubbleText}
                </Text>
              </group>
            );
          })()}
        </Billboard>
      )}
    </group>
  );
};
