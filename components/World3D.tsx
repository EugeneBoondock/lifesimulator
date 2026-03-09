import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Environment, SoftShadows, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna, Season, Weather, WaterPatch, NamedPlace, Settlement, ActiveEvent, Era, CameraMode } from '../types';
import { WORLD_SIZE, getTerrainHeight, getBiome } from '../constants';
import { FloraRenderer, FaunaRenderer, BuildingRenderer } from './Environment';
import { CreatureModel } from './CreatureModel';

interface World3DProps {
  agents: Agent[];
  buildings: Building[];
  flora: Flora[];
  fauna: Fauna[];
  places: NamedPlace[];
  water: WaterPatch[];
  settlements: Settlement[];
  activeEvents: ActiveEvent[];
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
  dayTime: number;
  season: Season;
  weather: Weather;
  currentEra: Era;
  cameraMode: CameraMode;
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

      const biome = getBiome(x, y, z);
      const noise = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.15 + Math.random() * 0.03;

      if (season === 'WINTER') {
        if (biome === 'WETLAND') color.setHex(0xbdd1d1);
        else if (biome === 'MOUNTAIN') color.setHex(0xc8d6e5);
        else if (biome === 'HIGHLAND') color.setHex(0xdfe6e9);
        else color.setHex(0xf0f4f8);
        color.r += noise * 0.05;
        color.g += noise * 0.05;
        color.b += noise * 0.05;
      } else if (season === 'AUTUMN') {
        if (biome === 'WETLAND') color.setHex(0xc9a96e);
        else if (biome === 'MOUNTAIN') color.setHex(0x7f8c8d);
        else if (biome === 'HIGHLAND') color.setHex(0x9e8c6c);
        else if (biome === 'DENSE_FOREST') color.setHex(0xb8860b);
        else if (biome === 'FOREST') color.setHex(0xd4922a);
        else if (biome === 'SAVANNA') color.setHex(0xc9a042);
        else color.setHex(0xd4a030);
        color.r += noise * 0.08;
        color.g += noise * 0.06;
      } else {
        if (biome === 'WETLAND') {
          color.setHex(0x8db596);
          color.r += noise * 0.05;
        } else if (biome === 'MOUNTAIN') {
          color.set('#7f8c8d').lerp(new THREE.Color('#c0c8d0'), Math.min(1, (z - 6) / 4));
        } else if (biome === 'HIGHLAND') {
          color.setHex(0x6b8e5a);
          color.g += noise * 0.06;
        } else if (biome === 'DENSE_FOREST') {
          color.setHex(season === 'SUMMER' ? 0x2d6a30 : 0x3a7d3e);
          color.g += noise * 0.08;
        } else if (biome === 'FOREST') {
          color.setHex(season === 'SUMMER' ? 0x4a8c3f : 0x56924a);
          color.g += noise * 0.07;
        } else if (biome === 'SAVANNA') {
          color.setHex(season === 'SUMMER' ? 0xb8a040 : 0xa09848);
          color.r += noise * 0.05;
        } else {
          color.setHex(season === 'SUMMER' ? 0x6fba62 : 0x71b262);
          color.g += noise * 0.06;
        }
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
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

const AnimatedWater: React.FC<{ patch: WaterPatch }> = ({ patch }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isLake = patch.kind === 'LAKE';
  const width = isLake ? patch.size : (patch.length ?? patch.size);
  const height = isLake ? patch.size : patch.size;
  const rotation = patch.rotation ?? 0;
  const y = patch.position.y - 0.05;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = y + Math.sin(clock.elapsedTime * 0.5 + patch.position.x) * 0.03;
    }
  });

  return (
    <group position={[patch.position.x, y, patch.position.z]} rotation={[0, rotation, 0]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {isLake ? (
          <circleGeometry args={[patch.size, 20]} />
        ) : (
          <planeGeometry args={[width, height]} />
        )}
        <meshPhysicalMaterial
          color={isLake ? '#3da8c4' : '#4dc4e0'}
          transparent
          opacity={0.75}
          metalness={0.85}
          roughness={0.05}
          envMapIntensity={2.0}
        />
      </mesh>
    </group>
  );
};

const SettlementBoundary: React.FC<{ settlement: Settlement }> = ({ settlement }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.04;
    }
  });

  const y = getTerrainHeight(settlement.position.x, settlement.position.z) + 0.15;

  return (
    <group position={[settlement.position.x, y, settlement.position.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[settlement.radius - 0.5, settlement.radius, 48]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[settlement.radius, 48]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.03} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 4, 0]} follow>
        <group>
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[Math.max(3, settlement.name.length * 0.28), 0.7, 0.05]} />
            <meshStandardMaterial color="#1e3a5f" opacity={0.9} transparent flatShading />
          </mesh>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.3}
            color="#93c5fd"
            anchorX="center"
            anchorY="middle"
          >
            🏘️ {settlement.name.toUpperCase()}
          </Text>
        </group>
      </Billboard>
    </group>
  );
};

const EventVisuals: React.FC<{ events: ActiveEvent[] }> = ({ events }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(clock.elapsedTime * 3) * 1;
    }
  });

  return (
    <>
      {events.map(event => {
        if (!event.affectedArea) return null;
        const pos = event.affectedArea;
        const y = getTerrainHeight(pos.x, pos.z) + 0.5;

        switch (event.type) {
          case 'WILDFIRE':
            return (
              <group key={event.id} position={[pos.x, y, pos.z]}>
                <pointLight ref={lightRef} color="#ff4500" intensity={3} distance={30} />
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[20, 32]} />
                  <meshBasicMaterial color="#ff4500" transparent opacity={0.06} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          case 'METEOR':
            return (
              <group key={event.id} position={[pos.x, y + 2, pos.z]}>
                <pointLight color="#ffd700" intensity={4} distance={20} />
                <mesh>
                  <octahedronGeometry args={[0.8, 0]} />
                  <meshStandardMaterial color="#ffd700" emissive="#ff8c00" emissiveIntensity={2} flatShading />
                </mesh>
              </group>
            );
          case 'EARTHQUAKE':
            return (
              <group key={event.id} position={[pos.x, y, pos.z]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[15, 30, 32]} />
                  <meshBasicMaterial color="#8b4513" transparent opacity={0.08} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          case 'DISEASE_OUTBREAK':
            return (
              <group key={event.id} position={[pos.x, y + 1, pos.z]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[25, 32]} />
                  <meshBasicMaterial color="#00ff00" transparent opacity={0.04} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          default:
            return null;
        }
      })}
    </>
  );
};

const SeasonalParticles: React.FC<{ season: Season }> = ({ season }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const geo = useMemo(() => {
    if (season !== 'AUTUMN' && season !== 'SPRING') return null;
    const count = 300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = 2 + Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [season]);

  useFrame(() => {
    if (pointsRef.current && geo) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - (season === 'AUTUMN' ? 0.03 : 0.01);
        let x = pos.getX(i) + Math.sin(y * 0.3 + i) * 0.02;
        if (y < 0) { y = 10 + Math.random() * 8; x = (Math.random() - 0.5) * 100; }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
  });

  if (!geo) return null;
  const color = season === 'AUTUMN' ? '#d4922a' : '#ffee88';
  return (
    <points ref={pointsRef}>
      <primitive object={geo} attach="geometry" />
      <pointsMaterial color={color} size={season === 'AUTUMN' ? 0.25 : 0.15} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

const WeatherEffects: React.FC<{ weather: Weather }> = ({ weather }) => {
  const rainRef = useRef<THREE.Points>(null);
  const snowRef = useRef<THREE.Points>(null);

  const rainGeo = useMemo(() => {
    if (weather !== 'RAIN' && weather !== 'STORM') return null;
    const count = weather === 'STORM' ? 3000 : 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [weather]);

  const snowGeo = useMemo(() => {
    if (weather !== 'SNOW') return null;
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [weather]);

  useFrame(() => {
    if (rainRef.current && rainGeo) {
      const pos = rainGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - (weather === 'STORM' ? 1.2 : 0.8);
        if (y < 0) y = 35 + Math.random() * 5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (snowRef.current && snowGeo) {
      const pos = snowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 0.08;
        let x = pos.getX(i) + Math.sin(pos.getY(i) * 0.5 + i) * 0.02;
        if (y < 0) { y = 35 + Math.random() * 5; x = (Math.random() - 0.5) * 120; }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <>
      {rainGeo && (
        <points ref={rainRef}>
          <primitive object={rainGeo} attach="geometry" />
          <pointsMaterial color="#aaccee" size={0.15} transparent opacity={0.6} sizeAttenuation />
        </points>
      )}
      {snowGeo && (
        <points ref={snowRef}>
          <primitive object={snowGeo} attach="geometry" />
          <pointsMaterial color="#ffffff" size={0.3} transparent opacity={0.8} sizeAttenuation />
        </points>
      )}
    </>
  );
};

const FollowCamera: React.FC<{ agents: Agent[]; selectedAgentId: string | null; mode: CameraMode }> = ({ agents, selectedAgentId, mode }) => {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3());
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    if (mode === 'FREE') return;

    let targetAgent: Agent | undefined;

    if (mode === 'FOLLOW' && selectedAgentId) {
      targetAgent = agents.find(a => a.id === selectedAgentId);
    } else if (mode === 'CINEMATIC') {
      const interesting = agents.find(a =>
        ['FIGHTING', 'HUNTING', 'CELEBRATING', 'COURTING', 'MATING', 'TEACHING', 'BUILDING'].includes(a.state)
      ) || agents[0];
      targetAgent = interesting;
    }

    if (targetAgent) {
      targetPos.current.set(targetAgent.position.x, targetAgent.position.y + 8, targetAgent.position.z + 12);
      currentPos.current.lerp(targetPos.current, 0.03);
      camera.position.copy(currentPos.current);
      camera.lookAt(targetAgent.position.x, targetAgent.position.y + 1, targetAgent.position.z);
    }
  });

  return null;
};

const WorldRig = ({ dayTime, weather, season }: { dayTime: number; weather: Weather; season: Season }) => {
  const isDay = dayTime > 6 && dayTime < 18;
  const isSunset = (dayTime >= 17 && dayTime <= 19) || (dayTime >= 5 && dayTime <= 7);
  const sunTheta = Math.PI * ((dayTime - 6) / 12);
  const sunX = Math.cos(sunTheta) * 100;
  const sunY = Math.max(5, Math.sin(sunTheta) * 100);

  const skyTurbidity = weather === 'STORM' ? 20 : weather === 'RAIN' ? 12 : weather === 'CLOUDY' ? 8 : 2;
  const skyRayleigh = isDay ? (isSunset ? 4 : 1) : 0.1;

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[sunX, sunY, 50]}
        inclination={isDay ? 0.49 : 0.53}
        azimuth={(dayTime / 24) * 0.5}
        turbidity={skyTurbidity}
        rayleigh={skyRayleigh}
        mieCoefficient={isSunset ? 0.01 : 0.005}
        mieDirectionalG={isSunset ? 0.95 : 0.8}
      />

      <Environment preset={isDay ? 'city' : 'night'} background={false} environmentIntensity={isDay ? 0.6 : 0.15} />
      <SoftShadows size={25} samples={16} focus={0.5} />

      <ambientLight
        intensity={isDay ? (weather === 'STORM' ? 0.2 : weather === 'RAIN' ? 0.3 : 0.4) : 0.1}
        color={isSunset ? '#ffce99' : isDay ? '#ffffff' : '#6680b0'}
      />

      <directionalLight
        position={[sunX, sunY, 50]}
        intensity={isDay ? (weather === 'STORM' ? 0.8 : weather === 'RAIN' ? 1.5 : 2.5) : 0.3}
        color={isDay ? (isSunset ? '#ffaa50' : '#fff8e7') : '#8ca8ff'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />

      {isSunset && (
        <hemisphereLight color="#ff9966" groundColor="#3d1a00" intensity={0.3} />
      )}

      {!isDay && (
        <pointLight color="#c0d0ff" intensity={0.2} position={[-sunX * 0.5, 60, -30]} />
      )}
    </>
  );
};

const getBgColor = (dayTime: number, weather: Weather): string => {
  if (weather === 'STORM') return '#2d3748';
  if (weather === 'RAIN' || weather === 'CLOUDY') return '#5a6a7a';
  if (weather === 'SNOW') return '#cbd5e1';
  if (weather === 'FOG') return '#a0aab4';
  const isDay = dayTime > 6 && dayTime < 18;
  const isSunset = (dayTime >= 17 && dayTime <= 19) || (dayTime >= 5 && dayTime <= 7);
  if (isSunset) return '#e8a060';
  return isDay ? '#87ceeb' : '#0a1628';
};

const getFogColor = (dayTime: number, weather: Weather): string => {
  if (weather === 'STORM') return '#2d3748';
  if (weather === 'RAIN') return '#5a6a7a';
  if (weather === 'FOG') return '#b0bab8';
  if (weather === 'SNOW') return '#d0dae0';
  const isDay = dayTime > 6 && dayTime < 18;
  return isDay ? '#a8d8ea' : '#0a1628';
};

const getFogRange = (weather: Weather): [number, number] => {
  if (weather === 'FOG') return [10, 60];
  if (weather === 'STORM') return [20, 70];
  if (weather === 'RAIN') return [30, 100];
  if (weather === 'SNOW') return [30, 90];
  return [40, 160];
};

const World3D: React.FC<World3DProps> = (props) => {
  const bgColor = getBgColor(props.dayTime, props.weather);
  const fogColor = getFogColor(props.dayTime, props.weather);
  const [fogNear, fogFar] = getFogRange(props.weather);

  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing bg-slate-900">
      <Canvas
        shadows
        camera={{ position: [0, 45, 60], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

        {props.cameraMode === 'FREE' && (
          <OrbitControls
            maxPolarAngle={Math.PI / 2 - 0.05}
            maxDistance={140}
            minDistance={10}
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
          />
        )}

        <FollowCamera agents={props.agents} selectedAgentId={props.selectedAgentId} mode={props.cameraMode} />
        <WorldRig dayTime={props.dayTime} weather={props.weather} season={props.season} />
        <WeatherEffects weather={props.weather} />
        <SeasonalParticles season={props.season} />

        <Terrain season={props.season} />

        {props.water.map(p => <AnimatedWater key={p.id} patch={p} />)}
        {props.flora.map(f => <FloraRenderer key={f.id} item={f} season={props.season} />)}
        {props.fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        {props.buildings.map(b => <BuildingRenderer key={b.id} building={b} />)}
        {props.settlements.map(s => <SettlementBoundary key={s.id} settlement={s} />)}

        <EventVisuals events={props.activeEvents} />

        {(props.places ?? []).map(p => (
          <Billboard key={p.id} position={[p.position.x, p.position.y + 3, p.position.z]} follow>
            <group>
              <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[4, 0.8, 0.05]} />
                <meshStandardMaterial color="#1e293b" opacity={0.85} transparent flatShading />
              </mesh>
              <Text
                position={[0, 0, 0.06]}
                fontSize={0.35}
                color="#e2e8f0"
                anchorX="center"
                anchorY="middle"
              >
                {p.name.toUpperCase()}
              </Text>
            </group>
          </Billboard>
        ))}

        {props.agents.map(agent => (
          <CreatureModel
            key={agent.id}
            agent={agent}
            isSelected={props.selectedAgentId === agent.id}
            onClick={() => props.onSelectAgent(agent.id)}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default World3D;
