
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna } from '../types';
import { WORLD_SIZE } from '../constants';
import { HumanoidModel } from './HumanoidModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
}

const Terrain = () => {
  const geometry = useMemo(() => {
    const size = WORLD_SIZE + 50; 
    const segments = 64; // Reduced for perf
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const posAttribute = geo.attributes.position;
    const count = posAttribute.count;
    
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i); 
      const dist = Math.sqrt(x*x + y*y);
      
      let z = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 1.5;
      if (dist > 25) z += Math.pow((dist - 25) * 0.2, 2);
      if (dist < 20) z *= Math.max(0, Math.min(1, (dist - 15) / 5));

      posAttribute.setZ(i, z);

      if (z < 0.5) color.setHex(0x5d4037); 
      else if (z < 3.5) color.setHex(0x4caf50); 
      else color.setHex(0x757575); 
      
      colors[i*3] = color.r;
      colors[i*3+1] = color.g;
      colors[i*3+2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <primitive object={geometry} />
      <meshStandardMaterial vertexColors roughness={0.9} flatShading={true} />
    </mesh>
  );
};

const FloraRenderer: React.FC<{ item: Flora }> = ({ item }) => {
  const { type, scale, position } = item;
  
  if (type.startsWith('TREE')) {
    const isPine = type === 'TREE_PINE';
    return (
      <group position={[position.x, position.y, position.z]} scale={[scale, scale, scale]}>
        {/* Trunk */}
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 2]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
        {/* Leaves */}
        <mesh position={[0, 2.5, 0]} castShadow>
          {isPine ? (
             <coneGeometry args={[1.2, 3, 8]} />
          ) : (
             <dodecahedronGeometry args={[1.2]} />
          )}
          <meshStandardMaterial color={isPine ? "#1e4620" : "#4ade80"} />
        </mesh>
      </group>
    );
  }

  if (type === 'BUSH_BERRY') {
    return (
       <group position={[position.x, position.y, position.z]} scale={[scale, scale, scale]}>
         <mesh position={[0, 0.3, 0]}>
           <sphereGeometry args={[0.5]} />
           <meshStandardMaterial color="#166534" />
         </mesh>
         {/* Berries */}
         <mesh position={[0.3, 0.4, 0.2]}>
            <sphereGeometry args={[0.1]} />
            <meshStandardMaterial color="#ef4444" />
         </mesh>
         <mesh position={[-0.2, 0.5, -0.2]}>
            <sphereGeometry args={[0.1]} />
            <meshStandardMaterial color="#ef4444" />
         </mesh>
       </group>
    );
  }
  
  // Mushroom
  return (
    <group position={[position.x, position.y, position.z]} scale={[scale, scale, scale]}>
       <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 0.4]} />
          <meshStandardMaterial color="#fef3c7" />
       </mesh>
       <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[0.4, 0.3, 8]} />
          <meshStandardMaterial color={type.includes('RED') ? "#dc2626" : "#78350f"} />
       </mesh>
    </group>
  );
};

const FaunaRenderer: React.FC<{ item: Fauna }> = ({ item }) => {
  const { type, position, rotation } = item;
  
  // Simple Box Animals
  const color = type === 'RABBIT' ? '#d1d5db' : type === 'CHICKEN' ? '#fcd34d' : '#4b5563';
  const size = type === 'RABBIT' ? 0.3 : type === 'CHICKEN' ? 0.4 : 0.6;
  
  return (
     <group position={[position.x, position.y + size/2, position.z]} rotation={[0, rotation, 0]}>
        <mesh castShadow>
           <boxGeometry args={[size, size, size*1.5]} />
           <meshStandardMaterial color={color} />
        </mesh>
        {/* Head */}
        <mesh position={[0, size/2, size/2 + 0.1]}>
           <boxGeometry args={[size/1.5, size/1.5, size/1.5]} />
           <meshStandardMaterial color={color} />
        </mesh>
     </group>
  );
};

const ConstructedBuilding: React.FC<{ building: Building }> = ({ building }) => {
  if (building.type === 'HOUSE') {
    return (
       <group position={[building.position.x, building.position.y, building.position.z]}>
         <mesh position={[0, 1, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#94a3b8" />
         </mesh>
         <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[1.5, 1.5, 4]} />
            <meshStandardMaterial color="#475569" />
         </mesh>
       </group>
    );
  }
  return null;
};

const Environment = ({ dayTime, flora, fauna }: { dayTime: number, flora: Flora[], fauna: Fauna[] }) => {
    const sunAngle = ((dayTime - 6) / 24) * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 30;
    const sunY = Math.sin(sunAngle) * 30;
    const isNight = sunY < 0;

    return (
        <>
            <ambientLight intensity={isNight ? 0.1 : 0.6} />
            <directionalLight 
                position={[sunX, Math.abs(sunY), 10]} 
                intensity={isNight ? 0 : 1.2} 
                castShadow 
                shadow-mapSize={[1024, 1024]}
            />
            <hemisphereLight intensity={0.3} groundColor="#000000" skyColor="#87CEEB" />
            
            {!isNight && <Cloud position={[0, 15, 0]} speed={0.1} opacity={0.5} />}
            {isNight && <Stars radius={100} />}
            
            <Terrain />
            
            {flora.map(f => <FloraRenderer key={f.id} item={f} />)}
            {fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        </>
    );
};

const World3D: React.FC<World3DProps> = ({ agents, buildings, flora, fauna, onSelectAgent, selectedAgentId, dayTime }) => {
  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 40 }}>
        <color attach="background" args={[dayTime > 6 && dayTime < 18 ? '#87CEEB' : '#0f172a']} />
        <fog attach="fog" args={[dayTime > 6 && dayTime < 18 ? '#87CEEB' : '#0f172a', 10, 60]} />
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.1} minDistance={5} maxDistance={60} />
        
        <Environment dayTime={dayTime} flora={flora} fauna={fauna} />

        {buildings.map(b => <ConstructedBuilding key={b.id} building={b} />)}

        {agents.map(agent => (
          <HumanoidModel 
            key={agent.id} 
            agent={agent} 
            isSelected={selectedAgentId === agent.id}
            onClick={() => onSelectAgent(agent.id)}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default World3D;
