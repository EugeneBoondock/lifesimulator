
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Cloud, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna, Season } from '../types';
import { WORLD_SIZE, getTerrainHeight, SEASON_PROPERTIES } from '../constants';
import { HumanoidModel } from './HumanoidModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
  season: Season;
}

const Terrain = ({ season }: { season: Season }) => {
  const geometry = useMemo(() => {
    const size = WORLD_SIZE + 50; 
    const segments = 128; 
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const posAttribute = geo.attributes.position;
    const colors = new Float32Array(posAttribute.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < posAttribute.count; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i); 
      const z = getTerrainHeight(x, y);
      
      posAttribute.setZ(i, z);
      
      const noise = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.2 + (Math.random() * 0.15);

      // Biome Coloring based on Season
      if (season === 'WINTER') {
           if (z < 0.2 + noise) color.setHex(0xcfd8dc); // Frozen Earth
           else if (z < 4.0) color.setHex(0xffffff); // Snow
           else color.setHex(0x94a3b8); // Rock
      } else {
           if (z < 0.2 + noise) color.setHex(0xe6c288); 
           else if (z < 2.5 + noise) {
                // Grass Gradient (Autumn vs Green)
                const grassBase = season === 'AUTUMN' ? 0xd97706 : 0x567d46;
                const grassDark = season === 'AUTUMN' ? 0xb45309 : 0x3a5a40;
                const t = (z - 0.2) / 2.3;
                color.setHex(grassBase).lerp(new THREE.Color(grassDark), t * 0.5 + Math.random() * 0.1);
           } else if (z < 5.5 + noise) {
                color.setHex(0x5c4033).lerp(new THREE.Color(0x4a4a4a), 0.5);
           } else {
                color.setHex(0x94a3b8).lerp(new THREE.Color(0xffffff), Math.min(1, (z - 5.5) / 4));
           }
      }
      
      colors[i*3] = color.r; colors[i*3+1] = color.g; colors[i*3+2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [season]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <primitive object={geometry} />
      <meshStandardMaterial vertexColors roughness={0.8} flatShading />
    </mesh>
  );
};

const TreeModel: React.FC<{ type: string, scale: number, season: Season }> = ({ type, scale, season }) => {
    const isPine = type === 'TREE_PINE';
    let leavesColor = isPine ? "#1b5e20" : "#4ade80";
    
    if (season === 'AUTUMN' && !isPine) leavesColor = "#d97706"; // Orange oak
    if (season === 'WINTER') leavesColor = "#f1f5f9"; // Snow covered

    if (isPine) {
        return (
            <group scale={[scale, scale, scale]}>
                <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.2, 0.4, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
                <mesh position={[0, 2.5, 0]} castShadow><coneGeometry args={[1.5, 2.5, 7]} /><meshStandardMaterial color={leavesColor} /></mesh>
                <mesh position={[0, 4, 0]} castShadow><coneGeometry args={[1.0, 2, 7]} /><meshStandardMaterial color={leavesColor} /></mesh>
            </group>
        );
    }
    // Oak
    return (
        <group scale={[scale, scale, scale]}>
            <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.3, 0.4, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            <mesh position={[0, 2.8, 0]} castShadow><dodecahedronGeometry args={[1.5]} /><meshStandardMaterial color={leavesColor} /></mesh>
            <mesh position={[0.8, 2.2, 0.5]} castShadow><dodecahedronGeometry args={[1.0]} /><meshStandardMaterial color={leavesColor} /></mesh>
            <mesh position={[-0.8, 2.5, -0.5]} castShadow><dodecahedronGeometry args={[1.1]} /><meshStandardMaterial color={leavesColor} /></mesh>
        </group>
    );
};

const FloraRenderer: React.FC<{ item: Flora, season: Season }> = ({ item, season }) => {
  const { type, scale, position, resourcesLeft, maxResources, isOnFire } = item;
  const ratio = maxResources ? (resourcesLeft || 0) / maxResources : 1;
  // Shrink as resources are depleted, but keep minimum size so it doesn't vanish before deletion
  const s = Math.max(0.2, scale * (0.4 + 0.6 * ratio));

  return (
      <group position={[position.x, position.y, position.z]}>
          {isOnFire && <Sparkles count={10} scale={2} size={3} color="orange" position={[0, 1, 0]} />}
          
          {type === 'RESOURCE_ROCK' ? (
             <mesh position={[0, 0.3, 0]} castShadow scale={[s,s,s]}><dodecahedronGeometry args={[1]} /><meshStandardMaterial color="#57534e" /></mesh>
          ) : type === 'RESOURCE_MUD' ? (
             <mesh position={[0, 0.05, 0]} receiveShadow scale={[s,0.2,s]}><circleGeometry args={[1.5, 7]} /><meshStandardMaterial color="#3e2723" /></mesh>
          ) : type.startsWith('TREE') ? (
             <TreeModel type={type} scale={s} season={season} />
          ) : (
            <group scale={[s,s,s]}>
               <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.05, 0.08, 0.4]} /><meshStandardMaterial color="#fef3c7" /></mesh>
               <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.3]} /><meshStandardMaterial color={type.includes('RED') ? "#ef4444" : "#a855f7"} /></mesh>
            </group>
          )}
      </group>
  );
};

const FaunaRenderer: React.FC<{ item: Fauna }> = ({ item }) => {
  const { type, position, rotation, isAggressive, isTamed } = item;
  const group = useRef<THREE.Group>(null);
  
  useFrame(({clock}) => {
      if (group.current && item.state !== 'IDLE') {
          group.current.position.y = position.y + Math.sin(clock.elapsedTime * 15) * 0.05; 
      }
  });

  const color = type === 'WOLF' ? '#4b5563' : type === 'BEAR' ? '#1f2937' : type === 'RABBIT' ? '#e5e7eb' : '#fcd34d';
  const s = type === 'BEAR' ? 1.2 : type === 'WOLF' ? 0.8 : 0.4;

  return (
     <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]} scale={[s,s,s]}>
        <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[0.6, 0.5, 0.9]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0, 0.7, 0.5]} castShadow><boxGeometry args={[0.4, 0.4, 0.5]} /><meshStandardMaterial color={color} /></mesh>
        {type === 'RABBIT' && (
            <>
            <mesh position={[0.1, 1.0, 0.4]}><boxGeometry args={[0.1, 0.4, 0.1]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[-0.1, 1.0, 0.4]}><boxGeometry args={[0.1, 0.4, 0.1]} /><meshStandardMaterial color={color} /></mesh>
            </>
        )}
        {isAggressive && <mesh position={[0, 0.75, 0.76]}><boxGeometry args={[0.35, 0.05, 0.1]} /><meshStandardMaterial color="red" /></mesh>}
        {isTamed && <mesh position={[0, 0.8, 0.3]}><torusGeometry args={[0.35, 0.05, 8, 16]} rotation={[Math.PI/2,0,0]} /><meshBasicMaterial color="#3b82f6" /></mesh>}
     </group>
  );
};

const BuildingRenderer: React.FC<{ building: Building }> = ({ building }) => {
  return (
     <group position={[building.position.x, building.position.y, building.position.z]}>
         {building.isOnFire && <Sparkles count={20} scale={4} size={4} color="red" position={[0, 1, 0]} speed={2} />}
         
         {building.type === 'HOUSE' ? (
           <group>
             <mesh position={[0, 1, 0]} castShadow receiveShadow><boxGeometry args={[2.2, 2, 2.2]} /><meshStandardMaterial color={building.isOnFire ? "#1f1f1f" : "#e2e8f0"} /></mesh>
             <mesh position={[0, 2.5, 0]} castShadow><coneGeometry args={[2.0, 1.5, 4]} rotation={[0, Math.PI/4, 0]} /><meshStandardMaterial color="#334155" /></mesh>
             <mesh position={[0, 0.9, 1.11]}><boxGeometry args={[0.8, 1.8, 0.1]} /><meshStandardMaterial color="#475569" /></mesh>
             <mesh position={[0.8, 2.5, 0.5]}><boxGeometry args={[0.4, 1.5, 0.4]} /><meshStandardMaterial color="#64748b" /></mesh>
           </group>
         ) : building.type === 'CAMPFIRE' ? (
           <group>
             <pointLight color="#f97316" intensity={3} distance={8} decay={2} position={[0, 1, 0]} />
             <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.6, 0.6, 0.2]} /><meshStandardMaterial color="#431407" /></mesh>
             <Sparkles count={20} scale={1.5} size={2} speed={0.4} opacity={0.7} color="#fbbf24" position={[0,0.8,0]} />
           </group>
         ) : null}
     </group>
  );
};

const World3D: React.FC<World3DProps> = (props) => {
  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows camera={{ position: [15, 20, 25], fov: 45 }}>
        <color attach="background" args={[props.dayTime > 6 && props.dayTime < 18 ? '#87CEEB' : '#020617']} />
        <fog attach="fog" args={[props.dayTime > 6 && props.dayTime < 18 ? '#87CEEB' : '#020617', 10, 60]} />
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.1} minDistance={5} maxDistance={60} />
        
        <ambientLight intensity={props.dayTime > 6 && props.dayTime < 18 ? 0.6 : 0.1} />
        <directionalLight position={[10, 20, 5]} intensity={props.dayTime > 6 && props.dayTime < 18 ? 1.2 : 0} castShadow shadow-mapSize={[2048, 2048]} />
        <Terrain season={props.season} />
        
        {props.flora.map(f => <FloraRenderer key={f.id} item={f} season={props.season} />)}
        {props.fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        {props.buildings.map(b => <BuildingRenderer key={b.id} building={b} />)}
        {props.agents.map(agent => (
          <HumanoidModel key={agent.id} agent={agent} isSelected={props.selectedAgentId === agent.id} onClick={() => props.onSelectAgent(agent.id)} />
        ))}
      </Canvas>
    </div>
  );
};
export default World3D;