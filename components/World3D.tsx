import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building } from '../types';
import { WORLD_SIZE } from '../constants';
import { HumanoidModel } from './HumanoidModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
}

const Terrain = () => {
  const geometry = useMemo(() => {
    // Increase size for distant horizon and resolution for detail
    const size = WORLD_SIZE + 50; 
    const segments = 128;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const posAttribute = geo.attributes.position;
    const count = posAttribute.count;
    
    // Add color attribute for biomes
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i); // Z in world space (before rotation)
      
      const dist = Math.sqrt(x*x + y*y);
      
      // --- Complex Noise Composition ---
      
      // 1. Base rolling hills (Low Frequency)
      let z = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 1.5;
      
      // 2. Secondary detail (Medium Frequency)
      z += Math.sin(x * 0.3 + 1.5) * Math.cos(y * 0.2 + 0.5) * 0.5;
      
      // 3. Roughness (High Frequency)
      z += Math.sin(x * 0.8) * Math.cos(y * 0.9) * 0.1;

      // 4. Distant Mountains (Amplitude boost based on distance)
      if (dist > 20) {
          z += Math.pow((dist - 20) * 0.2, 2) * Math.max(0, Math.sin(x * 0.2) + Math.cos(y * 0.2));
      }

      // 5. Gameplay Area Flattening
      // Ensure the center (radius ~15) is flat for agents at y=0
      if (dist < 18) {
         // Smoothstep transition from 12 to 18
         const flattenFactor = Math.max(0, Math.min(1, (dist - 12) / 6));
         z *= flattenFactor; 
      }

      // Apply height
      posAttribute.setZ(i, z);

      // --- Biome Coloring ---
      // Color based on height (z) and some randomness
      
      if (z < 0.5) {
         // Dirt / Lowlands
         color.setHex(0x5d4037); // Dark Brown
         // Mix with some variation
         if (Math.random() > 0.5) color.offsetHSL(0, 0, 0.05);
      } else if (z < 3.5) {
         // Grasslands
         color.setHex(0x4caf50); // Green
         // Gradient to darker green at lower altitudes
         color.lerp(new THREE.Color(0x2e7d32), Math.max(0, 1 - z/3));
      } else if (z < 6.0) {
         // Rock / Mountain base
         color.setHex(0x757575); // Grey
         color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      } else {
         // Snow Caps
         color.setHex(0xffffff);
      }
      
      // Apply colors
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
      <meshStandardMaterial 
        vertexColors
        roughness={0.9} 
        metalness={0.1}
        flatShading={true} // Keep low-poly aesthetic
      />
    </mesh>
  );
};

const ConstructedBuilding: React.FC<{ building: Building }> = ({ building }) => {
  // Randomize appearance slightly based on ID for variety
  const height = building.type === 'WALL' ? 1 : 0.5;
  const color = building.type === 'WALL' ? '#94a3b8' : building.type === 'PLANT' ? '#22c55e' : '#854d0e';
  
  return (
    <group position={[building.position.x, building.position.y, building.position.z]}>
      <mesh position={[0, height/2, 0]} castShadow receiveShadow>
        {building.type === 'PLANT' ? (
           <dodecahedronGeometry args={[0.4]} />
        ) : (
           <boxGeometry args={[1 * building.scale, height * building.scale, 1 * building.scale]} />
        )}
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
};

const Environment = ({ dayTime }: { dayTime: number }) => {
    const sunAngle = ((dayTime - 6) / 24) * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 30;
    const sunY = Math.sin(sunAngle) * 30;
    const isNight = sunY < 0;

    return (
        <>
            <ambientLight intensity={isNight ? 0.1 : 0.5} />
            <directionalLight 
                position={[sunX, Math.abs(sunY), 10]} 
                intensity={isNight ? 0 : 1.2} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
            />
            <hemisphereLight intensity={0.3} groundColor="#000000" skyColor="#87CEEB" />
            
            {!isNight && (
              <>
                 <Cloud position={[-10, 15, -10]} speed={0.1} opacity={0.5} />
                 <Cloud position={[10, 12, 5]} speed={0.1} opacity={0.3} />
              </>
            )}
            {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
            
            <Terrain />
            
            {/* Decorative World Objects - Moved closer to center to stay on the flat area */}
            <group position={[-8, 0, -8]}>
               <mesh position={[0, 2.5, 0]} castShadow>
                 <coneGeometry args={[1.5, 5, 8]} />
                 <meshStandardMaterial color="#1e293b" />
               </mesh>
            </group>
            <group position={[8, 0, 8]}>
               <mesh position={[0, 2.5, 0]} castShadow>
                 <coneGeometry args={[1.5, 5, 8]} />
                 <meshStandardMaterial color="#1e293b" />
               </mesh>
            </group>
        </>
    );
};

const World3D: React.FC<World3DProps> = ({ agents, buildings, onSelectAgent, selectedAgentId, dayTime }) => {
  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 40 }}>
        <color attach="background" args={[dayTime > 6 && dayTime < 18 ? '#87CEEB' : '#0f172a']} />
        <fog attach="fog" args={[dayTime > 6 && dayTime < 18 ? '#87CEEB' : '#0f172a', 10, 60]} />
        
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.1} minDistance={5} maxDistance={50} />
        
        <Environment dayTime={dayTime} />

        {/* Render Buildings */}
        {buildings.map(b => (
          <ConstructedBuilding key={b.id} building={b} />
        ))}

        {/* Render Agents */}
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