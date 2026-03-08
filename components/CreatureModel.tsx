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

  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.skinTone, flatShading: true }), [agent.skinTone]);
  const markingMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.markings, flatShading: true }), [agent.markings]);
  const clothingMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.color, flatShading: true }), [agent.color]);
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a2e', flatShading: true }), []);
  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f0f0f0', flatShading: true }), []);

  const healthPercent = agent.needs.health / 100;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const time = performance.now() * 0.001;

    _targetPos.set(agent.position.x, agent.position.y, agent.position.z);
    groupRef.current.position.lerp(_targetPos, dt * 5);

    _targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), agent.rotation);
    _currentQuat.copy(groupRef.current.quaternion);
    _currentQuat.slerp(_targetQuat, dt * 5);
    groupRef.current.quaternion.copy(_currentQuat);

    const state = agent.state;
    const isSleeping = state === AgentState.SLEEPING;
    const isMoving = state === AgentState.MOVING;
    const isFleeing = state === AgentState.FLEEING;
    const isWorking = state === AgentState.GATHERING || state === AgentState.CRAFTING || state === AgentState.BUILDING;
    const isFighting = state === AgentState.FIGHTING || state === AgentState.HUNTING;
    const isSocializing = state === AgentState.SOCIALIZING;
    const isEating = state === AgentState.EATING || state === AgentState.DRINKING;
    const isExploring = state === AgentState.EXPLORING;
    const isResearching = state === AgentState.RESEARCHING || state === AgentState.THINKING || state === AgentState.TEACHING;

    if (bodyRef.current) {
      if (isSleeping) {
        bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, Math.PI / 2.5, dt * 3);
        bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.1, dt * 3);
      } else {
        bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, 0, dt * 5);
        bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, dt * 5);

        if (isMoving || isFleeing) {
          const speed = isFleeing ? 12 : 8;
          const bounce = isFleeing ? 0.06 : 0.03;
          bodyRef.current.position.y = Math.abs(Math.sin(time * speed)) * bounce;
        }

        const breathe = 1 + Math.sin(time * 2) * 0.02;
        bodyRef.current.scale.set(breathe, breathe, breathe);
      }
    }

    if (headRef.current) {
      if (isSleeping) {
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.3, dt * 3);
      } else if (isSocializing) {
        headRef.current.rotation.x = Math.sin(time * 3) * 0.15;
        headRef.current.rotation.y = Math.sin(time * 1.5) * 0.1;
      } else if (isEating) {
        headRef.current.rotation.x = Math.sin(time * 4) * 0.25 + 0.15;
      } else if (isExploring) {
        headRef.current.rotation.y = Math.sin(time * 2) * 0.4;
        headRef.current.rotation.x = -0.1;
      } else if (isResearching) {
        headRef.current.rotation.z = Math.sin(time * 1.5) * 0.15;
        headRef.current.rotation.x = -0.05;
      } else if (isMoving || isFleeing) {
        headRef.current.rotation.x = Math.sin(time * (isFleeing ? 12 : 8)) * 0.05;
        headRef.current.rotation.y = 0;
      } else {
        headRef.current.rotation.y = Math.sin(time * 0.8) * 0.1;
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, dt * 3);
      }
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      const eyeScale = isSleeping ? 0.1 : 1;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, eyeScale, dt * 8);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, eyeScale, dt * 8);
    }

    if (leftLegRef.current && rightLegRef.current) {
      if (isMoving || isFleeing) {
        const speed = isFleeing ? 14 : 8;
        const swing = isFleeing ? 0.6 : 0.4;
        leftLegRef.current.rotation.x = Math.sin(time * speed) * swing;
        rightLegRef.current.rotation.x = Math.sin(time * speed + Math.PI) * swing;
      } else {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, dt * 5);
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, dt * 5);
      }
    }

    if (leftArmRef.current && rightArmRef.current) {
      if (isWorking) {
        const chop = Math.sin(time * 6) * 0.8;
        leftArmRef.current.rotation.x = chop - 0.3;
        rightArmRef.current.rotation.x = chop - 0.3;
      } else if (isFighting) {
        rightArmRef.current.rotation.x = Math.sin(time * 8) * 0.9 - 0.5;
        leftArmRef.current.rotation.x = Math.sin(time * 8 + 0.5) * 0.4 - 0.2;
      } else if (isMoving || isFleeing) {
        const speed = isFleeing ? 14 : 8;
        const swing = isFleeing ? 0.4 : 0.25;
        leftArmRef.current.rotation.x = Math.sin(time * speed + Math.PI) * swing;
        rightArmRef.current.rotation.x = Math.sin(time * speed) * swing;
      } else if (isResearching) {
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.2, dt * 3);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.3, dt * 3);
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, dt * 3);
      } else if (isSocializing) {
        leftArmRef.current.rotation.x = Math.sin(time * 2) * 0.15;
        rightArmRef.current.rotation.x = Math.sin(time * 2 + 1) * 0.15;
      } else {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, dt * 5);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, dt * 5);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0, dt * 5);
      }
    }

    if (tailRef.current) {
      const tailSpeed = isFleeing ? 6 : isMoving ? 4 : 1.5;
      const tailSwing = isFleeing ? 0.6 : isMoving ? 0.4 : 0.25;
      tailRef.current.rotation.y = Math.sin(time * tailSpeed) * tailSwing;
      tailRef.current.rotation.x = Math.sin(time * tailSpeed * 0.5) * 0.1;
    }

    if (selectionRingRef.current) {
      selectionRingRef.current.rotation.z = time * 1.5;
    }
  });

  const showChat = agent.chatBubble && agent.lastChatTime && (Date.now() - agent.lastChatTime < 8000);
  const chatText = showChat ? (agent.chatBubble!.length > 40 ? agent.chatBubble!.substring(0, 37) + '...' : agent.chatBubble!) : '';

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

      <Billboard position={[0, 1.15, 0]} follow lockX={false} lockY={false} lockZ={false}>
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
        <Billboard position={[0, 1.4, 0]} follow lockX={false} lockY={false} lockZ={false}>
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
