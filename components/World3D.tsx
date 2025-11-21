
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Cloud, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna, Season, Weather, WaterPatch } from '../types';
import { WORLD_SIZE, getTerrainHeight, SEASON_PROPERTIES } from '../constants';
import { HumanoidModel } from './HumanoidModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  water: WaterPatch[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
  season: Season;
  weather: Weather;
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
      <meshStandardMaterial vertexColors roughness={0.8} />
    </mesh>
  );
};

const TreeModel: React.FC<{ type: string, scale: number, season: Season }> = ({ type, scale, season }) => {
    const isPine = type === 'TREE_PINE';
    const trunkColor = "#4e342e";
    const evergreen = season === 'WINTER' && isPine;
    const autumn = season === 'AUTUMN' && !isPine;
    let leavesColor = isPine ? "#1b5e20" : "#4ade80";
    if (autumn) leavesColor = "#d97706";
    if (season === 'WINTER' && !isPine) leavesColor = "#f1f5f9";

    if (isPine) {
        return (
            <group scale={[scale, scale, scale]}>
                <mesh position={[0, 0.9, 0]} castShadow>
                  <cylinderGeometry args={[0.28, 0.45, 2.2, 12]} />
                  <meshStandardMaterial color={trunkColor} roughness={0.8} />
                </mesh>
                <mesh position={[0, 2.4, 0]} castShadow>
                  <coneGeometry args={[1.5, 2.2, 14]} />
                  <meshStandardMaterial color={leavesColor} roughness={0.5} />
                </mesh>
                <mesh position={[0, 3.7, 0]} castShadow>
                  <coneGeometry args={[1.1, 1.8, 14]} />
                  <meshStandardMaterial color={leavesColor} roughness={0.45} />
                </mesh>
                <mesh position={[0, 4.6, 0]} castShadow>
                  <coneGeometry args={[0.7, 1.2, 12]} />
                  <meshStandardMaterial color={evergreen ? "#e2e8f0" : leavesColor} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.2, 0.3, 1.2]}>
                  <cylinderGeometry args={[0.4, 0.6, 0.4, 8]} />
                  <meshStandardMaterial color="#3b2c23" />
                </mesh>
            </group>
        );
    }
    // Oak
    return (
        <group scale={[scale, scale, scale]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.45, 2.4, 10]} />
              <meshStandardMaterial color={trunkColor} roughness={0.9} />
            </mesh>
            <mesh position={[0.2, 1.8, 0]} rotation={[0.1, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 1.2, 8]} />
              <meshStandardMaterial color={trunkColor} />
            </mesh>
            <mesh position={[0, 2.8, 0]} castShadow>
              <sphereGeometry args={[1.45, 18, 14]} />
              <meshStandardMaterial color={leavesColor} roughness={0.6} />
            </mesh>
            <mesh position={[0.9, 2.3, 0.5]} rotation={[0.05, 0.2, 0]} castShadow>
              <sphereGeometry args={[1.05, 18, 14]} />
              <meshStandardMaterial color={season === 'WINTER' ? "#e2e8f0" : autumn ? "#f97316" : "#74c69d"} />
            </mesh>
            <mesh position={[-0.9, 2.55, -0.5]} castShadow>
              <sphereGeometry args={[1.1, 18, 14]} />
              <meshStandardMaterial color={leavesColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, 1.15, 0]} scale={[1.2, 0.3, 1.2]}>
              <cylinderGeometry args={[0.45, 0.8, 0.4, 8]} />
              <meshStandardMaterial color="#3b2c23" />
            </mesh>
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
             <group scale={[s, s, s]}>
               <mesh position={[0, 0.3, 0]} castShadow><dodecahedronGeometry args={[1]} /><meshStandardMaterial color="#57534e" roughness={0.9} /></mesh>
               <mesh position={[0.5, 0.55, -0.2]} castShadow scale={0.6}><dodecahedronGeometry args={[1]} /><meshStandardMaterial color="#6b7280" roughness={0.85} /></mesh>
               <mesh position={[-0.4, 0.2, 0.3]} castShadow scale={0.4}><octahedronGeometry args={[1]} /><meshStandardMaterial color="#4b5563" roughness={0.9} /></mesh>
             </group>
          ) : type === 'RESOURCE_MUD' ? (
             <group scale={[s, s * 0.4, s]}>
               <mesh position={[0, 0.05, 0]} receiveShadow><circleGeometry args={[1.5, 28]} /><meshStandardMaterial color="#3e2723" roughness={1} /></mesh>
               <mesh position={[0.5, 0.06, 0.4]} receiveShadow scale={0.35}><sphereGeometry args={[0.8, 12, 8]} /><meshStandardMaterial color="#5d4037" /></mesh>
               <mesh position={[-0.4, 0.06, -0.3]} receiveShadow scale={0.3}><sphereGeometry args={[0.7, 12, 8]} /><meshStandardMaterial color="#4b2f28" /></mesh>
             </group>
          ) : type.startsWith('TREE') ? (
             <TreeModel type={type} scale={s} season={season} />
          ) : (
            <group scale={[s,s,s]}>
               <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.06, 0.09, 0.5, 14]} /><meshStandardMaterial color="#fef3c7" /></mesh>
               <mesh position={[0, 0.55, 0]} castShadow>
                 <sphereGeometry args={[0.35, 18, 14]} />
                 <meshStandardMaterial color={type.includes('RED') ? "#ef4444" : "#a855f7"} />
               </mesh>
               <mesh position={[0, 0.8, 0]} scale={0.3}>
                 <sphereGeometry args={[0.4, 14, 12]} />
                 <meshStandardMaterial color={type.includes('RED') ? "#fca5a5" : "#d8b4fe"} />
               </mesh>
               <mesh position={[0.2, 0.35, 0.15]} rotation={[0, Math.PI / 6, 0]}><cylinderGeometry args={[0.02, 0.04, 0.2, 10]} /><meshStandardMaterial color="#fef08a" /></mesh>
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
  const accent = type === 'BEAR' ? '#374151' : type === 'WOLF' ? '#9ca3af' : '#f59e0b';

  return (
     <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]} scale={[s,s,s]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.7, 0.5, 1.0]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.65, 0.55]} castShadow>
          <boxGeometry args={[0.45, 0.38, 0.5]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0.5, -0.35]} castShadow>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0, 0.3, 0.55]} castShadow scale={type === 'RABBIT' ? [0.4, 0.3, 0.5] : [0.45, 0.35, 0.55]}>
          <boxGeometry args={[0.45, 0.35, 0.55]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Legs */}
        <mesh position={[0.22, 0.1, 0.25]} castShadow><boxGeometry args={[0.12, 0.2, 0.12]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[-0.22, 0.1, 0.25]} castShadow><boxGeometry args={[0.12, 0.2, 0.12]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0.22, 0.1, -0.25]} castShadow><boxGeometry args={[0.12, 0.2, 0.12]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[-0.22, 0.1, -0.25]} castShadow><boxGeometry args={[0.12, 0.2, 0.12]} /><meshStandardMaterial color={color} /></mesh>

        {/* Head features */}
        <mesh position={[0, 0.85, 0.8]} castShadow>
          <boxGeometry args={[0.4, 0.35, 0.35]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0.75, 1.0]} castShadow scale={[0.4, 0.25, 0.35]}>
          <boxGeometry args={[0.45, 0.3, 0.35]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0.12, 0.9, 1.02]} scale={0.08}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="black" /></mesh>
        <mesh position={[-0.12, 0.9, 1.02]} scale={0.08}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="black" /></mesh>

        {/* Ears / tail */}
        {type === 'RABBIT' ? (
          <>
            <mesh position={[0.12, 1.1, 0.75]} castShadow><boxGeometry args={[0.12, 0.45, 0.06]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[-0.12, 1.1, 0.75]} castShadow><boxGeometry args={[0.12, 0.45, 0.06]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[0, 0.6, -0.65]} scale={0.18}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={accent} /></mesh>
          </>
        ) : (
          <>
            <mesh position={[0.15, 1.0, 0.75]} rotation={[0.1, 0.1, 0]} castShadow><coneGeometry args={[0.12, 0.25, 6]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[-0.15, 1.0, 0.75]} rotation={[0.1, -0.1, 0]} castShadow><coneGeometry args={[0.12, 0.25, 6]} /><meshStandardMaterial color={color} /></mesh>
            <mesh position={[0, 0.5, -0.65]} rotation={[0.2, 0, 0]} castShadow>
              <coneGeometry args={[0.12, 0.5, 8]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </>
        )}

        {isAggressive && <mesh position={[0, 0.95, 0.76]}><boxGeometry args={[0.35, 0.05, 0.1]} /><meshStandardMaterial color="red" /></mesh>}
        {isTamed && (
          <mesh position={[0, 0.8, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.05, 8, 16]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        )}
     </group>
  );
};

const BuildingRenderer: React.FC<{ building: Building }> = ({ building }) => {
  return (
     <group position={[building.position.x, building.position.y, building.position.z]}>
         {building.isOnFire && <Sparkles count={20} scale={4} size={4} color="red" position={[0, 1, 0]} speed={2} />}
         
         {building.type === 'HOUSE' ? (
           <group>
             <mesh position={[0, 1, 0]} castShadow receiveShadow>
               <boxGeometry args={[2.2, 2, 2.2]} />
               <meshStandardMaterial color={building.isOnFire ? "#1f1f1f" : "#e2e8f0"} />
             </mesh>
             <mesh position={[0, 2.6, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
               <coneGeometry args={[2.3, 1.6, 4]} />
               <meshStandardMaterial color="#334155" />
             </mesh>
             <mesh position={[0, 2.9, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
               <coneGeometry args={[2.0, 0.5, 4]} />
               <meshStandardMaterial color="#475569" />
             </mesh>
             <mesh position={[0.9, 2.6, -0.2]} castShadow>
               <boxGeometry args={[0.35, 0.9, 0.35]} />
               <meshStandardMaterial color="#cbd5e1" />
             </mesh>
             <mesh position={[0, 0.35, 1.2]}><boxGeometry args={[1.4, 0.15, 0.6]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
             <mesh position={[0, 0.9, 1.11]}><boxGeometry args={[0.8, 1.8, 0.1]} /><meshStandardMaterial color="#475569" /></mesh>
             <mesh position={[0.8, 2.5, 0.5]}><boxGeometry args={[0.4, 1.5, 0.4]} /><meshStandardMaterial color="#64748b" /></mesh>
             <mesh position={[-0.9, 1.2, 1.1]}><boxGeometry args={[0.4, 0.4, 0.05]} /><meshStandardMaterial color="#bfdbfe" /></mesh>
             <mesh position={[0.9, 1.2, 1.1]}><boxGeometry args={[0.4, 0.4, 0.05]} /><meshStandardMaterial color="#bfdbfe" /></mesh>
             <mesh position={[0, 0.1, 0]} scale={[1.4, 0.2, 1.4]} receiveShadow>
               <boxGeometry args={[2.2, 0.2, 2.2]} />
               <meshStandardMaterial color="#334155" />
             </mesh>
             <mesh position={[0.15, 0.9, 1.15]} scale={[0.12, 0.6, 0.12]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#eab308" /></mesh>
             <Cloud position={[0.9, 3.4, -0.35]} speed={0.25} opacity={0.35} segments={6} scale={0.6} />
           </group>
         ) : building.type === 'CAMPFIRE' ? (
           <group>
             <pointLight color="#f97316" intensity={3} distance={8} decay={2} position={[0, 1, 0]} />
             <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.65, 0.65, 0.25, 24]} /><meshStandardMaterial color="#431407" /></mesh>
             <mesh position={[0.4, 0.2, 0]} rotation={[Math.PI / 2, 0.8, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 1.2, 10]} /><meshStandardMaterial color="#8d5524" /></mesh>
             <mesh position={[-0.4, 0.25, -0.1]} rotation={[Math.PI / 2, -0.6, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 1.2, 10]} /><meshStandardMaterial color="#9c6644" /></mesh>
             <mesh position={[0, 0.18, 0.35]} rotation={[Math.PI / 2, 0.1, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 1.0, 10]} /><meshStandardMaterial color="#854d0e" /></mesh>
             <mesh position={[0, 0.5, 0]} castShadow scale={0.4}><sphereGeometry args={[0.8, 16, 12]} /><meshStandardMaterial color="#b45309" emissive="#fb923c" emissiveIntensity={0.5} /></mesh>
             <Sparkles count={25} scale={1.6} size={2.3} speed={0.4} opacity={0.8} color="#fbbf24" position={[0,0.9,0]} />
           </group>
         ) : null}
     </group>
  );
};

const WaterSurface: React.FC<{ patch: WaterPatch }> = ({ patch }) => {
  const width = patch.length ?? patch.size;
  const height = patch.size;
  const rotation = patch.rotation ?? 0;
  const color = patch.kind === 'PUDDLE' ? '#a5f3fc' : '#38bdf8';
  const opacity = patch.kind === 'PUDDLE' ? 0.55 : 0.65;

  return (
    <mesh
      position={[patch.position.x, patch.position.y, patch.position.z]}
      rotation={[-Math.PI / 2, rotation, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} metalness={0.6} roughness={0.1} />
    </mesh>
  );
};

// Weather particle effects
const WeatherEffects = ({ weather }: { weather: Weather }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const count = weather === 'STORM' ? 5000 : weather === 'RAIN' ? 3000 : weather === 'SNOW' ? 1500 : 0;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (WORLD_SIZE + 20);
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * (WORLD_SIZE + 20);
    }
    return pos;
  }, [count]);

  useFrame(() => {
    if (!particlesRef.current || count === 0) return;
    const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const speed = weather === 'SNOW' ? 0.03 : weather === 'STORM' ? 0.5 : 0.25;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speed;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 40;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={weather === 'SNOW' ? 0.2 : 0.08} color={weather === 'SNOW' ? '#ffffff' : '#a0c4ff'} transparent opacity={0.7} />
    </points>
  );
};

const World3D: React.FC<World3DProps> = (props) => {
  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows camera={{ position: [25, 40, 45], fov: 45 }}>
        <color attach="background" args={[
          props.weather === 'STORM' ? '#4a5568' :
          props.weather === 'RAIN' || props.weather === 'CLOUDY' ? '#94a3b8' :
          props.weather === 'SNOW' ? '#e2e8f0' :
          props.dayTime > 6 && props.dayTime < 18 ? '#87CEEB' : '#020617'
        ]} />
        <fog attach="fog" args={[
          props.weather === 'RAIN' || props.weather === 'STORM' ? '#64748b' :
          props.dayTime > 6 && props.dayTime < 18 ? '#87CEEB' : '#020617', 20, props.weather === 'STORM' ? 50 : 140
        ]} />
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.1} minDistance={5} maxDistance={150} />
        
        <ambientLight intensity={props.dayTime > 6 && props.dayTime < 18 ? 0.6 : 0.1} />
        <directionalLight 
          position={[50, 80, 25]} 
          intensity={props.dayTime > 6 && props.dayTime < 18 ? 1.2 : 0} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <Terrain season={props.season} />
        {props.water.map(p => <WaterSurface key={p.id} patch={p} />)}

        {props.flora.map(f => <FloraRenderer key={f.id} item={f} season={props.season} />)}
        {props.fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        {props.buildings.map(b => <BuildingRenderer key={b.id} building={b} />)}
        {props.agents.map(agent => (
          <HumanoidModel key={agent.id} agent={agent} isSelected={props.selectedAgentId === agent.id} onClick={() => props.onSelectAgent(agent.id)} />
        ))}
        <WeatherEffects weather={props.weather} />
      </Canvas>
    </div>
  );
};
export default World3D;
