import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Environment, SoftShadows, Sky, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna, Season, Weather, WaterPatch, NamedPlace } from '../types';
import { WORLD_SIZE, getTerrainHeight } from '../constants';
import { HumanoidModel } from './HumanoidModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  places?: NamedPlace[];
  water: WaterPatch[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
  season: Season;
  weather: Weather;
}

// --- Stylized Premium Low-Poly Terrain ---
const Terrain = ({ season }: { season: Season }) => {
  const geometry = useMemo(() => {
    const size = WORLD_SIZE + 50;
    const segments = 128; // Keep segments relatively low/mid to retain flat-shaded look
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const posAttribute = geo.attributes.position;
    const colors = new Float32Array(posAttribute.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < posAttribute.count; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i);
      const z = getTerrainHeight(x, y);

      posAttribute.setZ(i, z);

      // Low frequency noise for color variation
      const noise = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.2 + (Math.random() * 0.05);

      // Biome Coloring
      if (season === 'WINTER') {
        if (z < 0.2 + noise) color.setHex(0xbdd1d1); // Frozen edge
        else if (z < 4.0) color.setHex(0xf8fafc); // Snow
        else color.setHex(0x94a3b8); // Rock
      } else {
        if (z < 0.2 + noise) color.setHex(0xe8d0a9); // Sand/Dirt
        else if (z < 2.5 + noise) {
          // Premium vibrant grass
          const grassBase = season === 'AUTUMN' ? 0xd97706 : 0x71b262; // Softer green
          const grassDark = season === 'AUTUMN' ? 0xb45309 : 0x488a38;
          const t = (z - 0.2) / 2.3;
          color.setHex(grassBase).lerp(new THREE.Color(grassDark), t * 0.7 + noise);
        } else if (z < 5.5 + noise) {
          color.setHex(0x5c4033).lerp(new THREE.Color(0x3f3f4e), 0.5); // Warm grey rock
        } else {
          color.setHex(0x8e9aaa).lerp(new THREE.Color(0xf1f5f9), Math.min(1, (z - 5.5) / 4)); // Snowy peaks
        }
      }

      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [season]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} />
      <meshStandardMaterial vertexColors roughness={0.9} flatShading />
    </mesh>
  );
};

// --- Stylized Nature Models ---
const TreeModel: React.FC<{ type: string, scale: number, season: Season }> = ({ type, scale, season }) => {
  const isPine = type === 'TREE_PINE';
  const trunkColor = "#593d2e";
  const evergreen = season === 'WINTER' && isPine;
  const autumn = season === 'AUTUMN' && !isPine;

  // Softer, premium pastel-like colors
  let leavesColor = isPine ? "#2a6642" : "#6fba72";
  if (autumn) leavesColor = "#e88022";
  if (season === 'WINTER' && !isPine) leavesColor = "#e2e8f0";

  if (isPine) {
    return (
      <group scale={[scale, scale, scale]}>
        {/* stylized hexagonal trunk */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.35, 2.0, 6]} />
          <meshStandardMaterial color={trunkColor} roughness={0.8} flatShading />
        </mesh>
        {/* layered cones with low segments (8) for a cool low-poly look */}
        <mesh position={[0, 2.2, 0]} castShadow>
          <coneGeometry args={[1.4, 1.8, 8]} />
          <meshStandardMaterial color={leavesColor} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 3.2, 0]} castShadow>
          <coneGeometry args={[1.1, 1.6, 8]} />
          <meshStandardMaterial color={leavesColor} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 4.2, 0]} castShadow>
          <coneGeometry args={[0.7, 1.3, 8]} />
          <meshStandardMaterial color={evergreen ? "#f1f5f9" : leavesColor} roughness={0.6} flatShading />
        </mesh>
      </group>
    );
  }

  // Stylized Oak - Icosahedron for puffy low-poly leaves
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 2.2, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow rotation={[0.4, 0.2, 0.1]}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial color={leavesColor} roughness={0.7} flatShading />
      </mesh>
      {/* Auxiliary puffy bits */}
      <mesh position={[0.8, 2.2, 0.5]} castShadow rotation={[0, 0.4, 0.3]}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color={season === 'WINTER' ? "#e2e8f0" : autumn ? "#fb923c" : "#56a165"} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[-0.9, 2.5, -0.4]} castShadow>
        <icosahedronGeometry args={[1.3, 1]} />
        <meshStandardMaterial color={leavesColor} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
};

const FloraRenderer: React.FC<{ item: Flora, season: Season }> = ({ item, season }) => {
  const { type, scale, position, resourcesLeft, maxResources } = item;
  const ratio = maxResources ? (resourcesLeft || 0) / maxResources : 1;
  const s = Math.max(0.2, scale * (0.4 + 0.6 * ratio));
  const cropStage = type === 'FARM_CROP' ? (item.growthStage || 0) : 0;

  return (
    <group position={[position.x, position.y, position.z]}>
      {type === 'RESOURCE_ROCK' ? (
        <group scale={[s, s, s]}>
          <mesh position={[0, 0.4, 0]} castShadow rotation={[0.2, 0.4, 0]}><dodecahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#88929e" roughness={0.8} flatShading /></mesh>
          <mesh position={[0.6, 0.3, -0.3]} castShadow rotation={[-0.1, 0.7, 0]} scale={0.7}><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#aab4be" roughness={0.7} flatShading /></mesh>
        </group>
      ) : type === 'RESOURCE_MUD' ? (
        <group scale={[s, s * 0.3, s]}>
          <mesh position={[0, 0.1, 0]} receiveShadow><cylinderGeometry args={[1.2, 1.2, 0.2, 12]} /><meshStandardMaterial color="#503730" roughness={1} flatShading /></mesh>
          <mesh position={[0.4, 0.2, 0.3]} receiveShadow scale={0.6}><icosahedronGeometry args={[0.8, 1]} /><meshStandardMaterial color="#6a4d42" flatShading /></mesh>
        </group>
      ) : type === 'FARM_CROP' ? (
        <group scale={[s, s, s]}>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[1.2, 0.1, 1.2]} />
            <meshStandardMaterial color="#35241b" roughness={1} flatShading />
          </mesh>
          {cropStage >= 0 && (
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.5, 4]} />
              <meshStandardMaterial color="#5e8b34" flatShading />
            </mesh>
          )}
          {cropStage >= 1 && (
            <mesh position={[0, 0.6, 0]} castShadow scale={0.8}>
              <coneGeometry args={[0.2, 0.5, 4]} />
              <meshStandardMaterial color={cropStage >= 2 ? "#b9eb47" : "#84c734"} flatShading />
            </mesh>
          )}
          {cropStage >= 2 && (
            <mesh position={[0, 0.8, 0]} castShadow>
              <icosahedronGeometry args={[0.2, 0]} />
              <meshStandardMaterial color="#e9ff94" roughness={0.4} flatShading />
            </mesh>
          )}
        </group>
      ) : type.startsWith('TREE') ? (
        <TreeModel type={type} scale={s} season={season} />
      ) : (
        // Mushrooms / Berries (low poly abstract)
        <group scale={[s, s, s]}>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.08, 0.1, 0.4, 6]} /><meshStandardMaterial color="#dbd2ba" flatShading /></mesh>
          <mesh position={[0, 0.45, 0]} castShadow rotation={[0.1, 0, 0.1]}>
            <coneGeometry args={[0.45, 0.35, 6]} />
            <meshStandardMaterial color={type.includes('RED') ? "#ff5c5c" : type.includes('BUSH') ? "#40a35e" : "#b066ff"} flatShading />
          </mesh>
          {type.includes('BUSH') && (
            <mesh position={[0.2, 0.4, 0.2]} castShadow>
              <icosahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color="#2d7e45" flatShading />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
};

// --- Stylized Low-Poly Fauna ---
const FaunaRenderer: React.FC<{ item: Fauna }> = ({ item }) => {
  const { type, position, rotation, isAggressive } = item;
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (group.current && item.state !== 'IDLE') {
      // Bouncy walk animation
      group.current.position.y = position.y + Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.15;
      group.current.rotation.z = Math.sin(clock.elapsedTime * 8) * 0.05;
    } else if (group.current) {
      // Breathing
      const breathe = 1 + Math.sin(clock.elapsedTime * 2) * 0.02;
      group.current.scale.set(1, breathe, 1);
    }
  });

  const s = type === 'BEAR' ? 1.4 : type === 'WOLF' ? 0.9 : type === 'RABBIT' ? 0.4 : 0.4;

  // Custom abstract low-poly shapes for animals
  return (
    <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]} scale={[s, s, s]}>
      {type === 'RABBIT' && (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.4, 0.3, 0.5]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          <mesh position={[0, 0.45, 0.25]} castShadow><boxGeometry args={[0.25, 0.25, 0.25]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          <mesh position={[0.08, 0.6, 0.2]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[0.05, 0.3, 0.05]} /><meshStandardMaterial color="#cbd5e1" flatShading /></mesh>
          <mesh position={[-0.08, 0.6, 0.2]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[0.05, 0.3, 0.05]} /><meshStandardMaterial color="#cbd5e1" flatShading /></mesh>
        </group>
      )}
      {type === 'CHICKEN' && (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.3, 0.3, 0.4]} /><meshStandardMaterial color="#fcd34d" flatShading /></mesh>
          <mesh position={[0, 0.45, 0.2]} castShadow><boxGeometry args={[0.15, 0.2, 0.15]} /><meshStandardMaterial color="#fbbf24" flatShading /></mesh>
          <mesh position={[0, 0.5, 0.3]} castShadow><coneGeometry args={[0.05, 0.1, 4]} rotation={[-Math.PI / 2, 0, 0]} /><meshStandardMaterial color="#fb923c" flatShading /></mesh>
        </group>
      )}
      {type === 'WOLF' && (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[0.35, 0.4, 0.8]} /><meshStandardMaterial color="#64748b" flatShading /></mesh>
          <mesh position={[0, 0.55, 0.4]} castShadow><boxGeometry args={[0.3, 0.3, 0.4]} /><meshStandardMaterial color="#475569" flatShading /></mesh>
          <mesh position={[0, 0.5, 0.6]} castShadow><boxGeometry args={[0.15, 0.15, 0.2]} /><meshStandardMaterial color="#1e293b" flatShading /></mesh>
          <mesh position={[0, 0.5, -0.45]} rotation={[-0.3, 0, 0]} castShadow><coneGeometry args={[0.1, 0.4, 4]} /><meshStandardMaterial color="#64748b" flatShading /></mesh>
        </group>
      )}
      {type === 'BEAR' && (
        <group>
          <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.7, 0.7, 1.2]} /><meshStandardMaterial color="#452a1d" flatShading /></mesh>
          <mesh position={[0, 0.75, 0.6]} castShadow><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#5e3927" flatShading /></mesh>
          <mesh position={[0, 0.65, 0.9]} castShadow><boxGeometry args={[0.3, 0.25, 0.3]} /><meshStandardMaterial color="#2d1c13" flatShading /></mesh>
          {/* Ears */}
          <mesh position={[0.2, 0.95, 0.65]} castShadow><boxGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#2d1c13" flatShading /></mesh>
          <mesh position={[-0.2, 0.95, 0.65]} castShadow><boxGeometry args={[0.15, 0.15, 0.1]} /><meshStandardMaterial color="#2d1c13" flatShading /></mesh>
        </group>
      )}

      {isAggressive && <mesh position={[0, s * 0.9, 0.5]}><boxGeometry args={[0.2, 0.05, 0.05]} /><meshBasicMaterial color="#ff2a2a" /></mesh>}
    </group>
  );
};

// --- Clean Abstract Buildings ---
const BuildingRenderer: React.FC<{ building: Building }> = ({ building }) => {
  return (
    <group position={[building.position.x, building.position.y, building.position.z]}>
      {building.type === 'HOUSE' ? (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 1.8, 2.0]} />
            <meshStandardMaterial color="#e0e6ed" roughness={0.5} flatShading />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 2.3, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[2.0, 1.2, 4]} />
            <meshStandardMaterial color="#364152" flatShading />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.6, 1.01]}>
            <boxGeometry args={[0.6, 1.2, 0.1]} />
            <meshStandardMaterial color="#8b5a2b" flatShading />
          </mesh>
          {/* Window */}
          <mesh position={[0.6, 1.1, 1.02]}>
            <boxGeometry args={[0.4, 0.4, 0.05]} />
            <meshStandardMaterial color="#60a5fa" roughness={0.1} metalness={0.8} />
          </mesh>
        </group>
      ) : building.type === 'CAMPFIRE' ? (
        <group>
          <pointLight color="#ff8e36" intensity={4} distance={10} decay={2} position={[0, 1, 0]} castShadow />
          {/* Logs */}
          <mesh position={[0, 0.1, 0]} rotation={[0, 0.4, 0]} castShadow><boxGeometry args={[1.2, 0.15, 0.15]} /><meshStandardMaterial color="#3e2723" flatShading /></mesh>
          <mesh position={[0, 0.1, 0]} rotation={[0, -0.4, 0]} castShadow><boxGeometry args={[1.2, 0.15, 0.15]} /><meshStandardMaterial color="#3e2723" flatShading /></mesh>
          {/* Fire Crystal (Abstract Flame) */}
          <Float speed={5} rotationIntensity={2} floatIntensity={0.5}>
            <mesh position={[0, 0.6, 0]}>
              <octahedronGeometry args={[0.4, 0]} />
              <meshBasicMaterial color="#ffaa00" />
            </mesh>
          </Float>
        </group>
      ) : building.type === 'CRATE' ? (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color="#a06c42" flatShading />
          </mesh>
          {/* Straps */}
          <mesh position={[0, 0.4, 0]} scale={[1.05, 1.05, 1.05]}><boxGeometry args={[0.82, 0.1, 0.82]} /><meshStandardMaterial color="#4a311d" flatShading /></mesh>
        </group>
      ) : null}
    </group>
  );
};

const BuildPreview: React.FC<{ position: { x: number; z: number }; type: 'HOUSE' | 'CAMPFIRE' }> = ({ position, type }) => {
  const y = getTerrainHeight(position.x, position.z) + 0.02;
  const isHouse = type === 'HOUSE';
  return (
    <group position={[position.x, y, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[isHouse ? 2.2 : 1.2, isHouse ? 2.2 : 1.2]} />
        <meshBasicMaterial color={isHouse ? "#60a5fa" : "#fb923c"} transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

// Premium stylized water
const WaterSurface: React.FC<{ patch: WaterPatch }> = ({ patch }) => {
  const isPuddle = patch.kind === 'PUDDLE';
  const width = isPuddle ? patch.size * 1.5 : patch.length ?? patch.size;
  const height = isPuddle ? patch.size * 1.5 : patch.size;
  const rotation = isPuddle ? 0 : patch.rotation ?? 0;

  const cx = patch.position.x;
  const cz = patch.position.z;
  const y = getTerrainHeight(cx, cz) - 0.05; // Slightly sink

  return (
    <group position={[cx, y, cz]} rotation={[0, rotation, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {isPuddle ? <circleGeometry args={[patch.size * 0.8, 16]} /> : <planeGeometry args={[width, height]} />}
        <meshPhysicalMaterial
          color={isPuddle ? '#bce4eb' : '#4dc4e0'}
          transparent opacity={0.8}
          metalness={0.9}
          roughness={0.05} // Very shiny for reflections
          envMapIntensity={2.0}
        />
      </mesh>
    </group>
  );
};

// --- Next-Gen Lighting & World Rig ---
const WorldRig = ({ dayTime, weather }: { dayTime: number, weather: Weather }) => {
  const isDay = dayTime > 6 && dayTime < 18;
  const isSunset = (dayTime >= 17 && dayTime <= 19) || (dayTime >= 5 && dayTime <= 7);

  // Sun position logic
  const sunTheta = Math.PI * ((dayTime - 6) / 24); // 0 at dawn, Pi at dusk
  const sunX = Math.cos(sunTheta) * 100;
  const sunY = Math.max(10, Math.sin(sunTheta) * 100);

  const shadowBias = -0.0005;

  return (
    <>
      {/* IBL Environment matching the mood */}
      <Environment preset={isDay ? "city" : "night"} background={false} environmentIntensity={isDay ? 0.7 : 0.2} />

      <SoftShadows size={25} samples={16} focus={0.5} />

      {/* Global Light */}
      <ambientLight intensity={isDay ? 0.4 : 0.15} color={isSunset ? "#ffce99" : "#ffffff"} />

      {/* Primary Sun/Moon */}
      <directionalLight
        position={[sunX, sunY, 50]}
        intensity={isDay ? 2.5 : 0.4}
        color={isDay ? (isSunset ? "#ffaa50" : "#ffffff") : "#8ca8ff"}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={shadowBias}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />

      {weather === 'STORM' && <ambientLight intensity={0.2} color="#4a5568" />}
    </>
  );
};

const World3D: React.FC<World3DProps> = (props) => {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing bg-slate-900">
      <Canvas
        shadows
        camera={{ position: [0, 45, 60], fov: 40 }}
        dpr={[1, 2]} // Crisp rendering
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[
          props.weather === 'STORM' ? '#334155' :
            props.weather === 'RAIN' || props.weather === 'CLOUDY' ? '#64748b' :
              props.weather === 'SNOW' ? '#cbd5e1' :
                props.dayTime > 6 && props.dayTime < 18 ? '#a2dcf0' : '#0f172a'
        ]} />

        {/* Deep stylized fog */}
        <fog attach="fog" args={[
          props.weather === 'STORM' ? '#334155' : props.weather === 'RAIN' ? '#64748b' :
            props.dayTime > 6 && props.dayTime < 18 ? '#a2dcf0' : '#0f172a',
          30, props.weather === 'STORM' ? 70 : 150
        ]} />

        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.05} maxDistance={140} minDistance={10} enableDamping dampingFactor={0.05} />

        <WorldRig dayTime={props.dayTime} weather={props.weather} />

        <Terrain season={props.season} />
        {props.water.map(p => <WaterSurface key={p.id} patch={p} />)}

        {props.flora.map(f => <FloraRenderer key={f.id} item={f} season={props.season} />)}
        {props.fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        {props.buildings.map(b => <BuildingRenderer key={b.id} building={b} />)}

        {/* Name Tags for Places */}
        {(props.places ?? []).map(p => (
          <Billboard key={p.id} position={[p.position.x, p.position.y + 2, p.position.z]} follow>
            <group>
              <mesh position={[0, 0, 0]}><boxGeometry args={[4, 0.8, 0.05]} /><meshStandardMaterial color="#1e293b" opacity={0.8} transparent flatShading /></mesh>
              <Text position={[0, 0, 0.06]} fontSize={0.35} color="#e2e8f0" anchorX="center" anchorY="middle" font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.ttf" fontWeight={700}>
                {p.name.toUpperCase()}
              </Text>
            </group>
          </Billboard>
        ))}

        {props.agents.map(agent => (
          <HumanoidModel key={agent.id} agent={agent} isSelected={props.selectedAgentId === agent.id} onClick={() => props.onSelectAgent(agent.id)} />
        ))}

      </Canvas>
    </div>
  );
};
export default World3D;
