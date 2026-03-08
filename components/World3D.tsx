import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Environment, SoftShadows, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, Building, Flora, Fauna, Season, Weather, WaterPatch, NamedPlace } from '../types';
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

const WaterSurface: React.FC<{ patch: WaterPatch }> = ({ patch }) => {
  const isLake = patch.kind === 'LAKE';
  const isRiver = patch.kind === 'RIVER';
  const width = isLake ? patch.size : (patch.length ?? patch.size);
  const height = isLake ? patch.size : patch.size;
  const rotation = patch.rotation ?? 0;
  const y = patch.position.y - 0.05;

  return (
    <group position={[patch.position.x, y, patch.position.z]} rotation={[0, rotation, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {isLake ? (
          <circleGeometry args={[patch.size, 20]} />
        ) : (
          <planeGeometry args={[width, height]} />
        )}
        <meshPhysicalMaterial
          color={isLake ? '#3da8c4' : '#4dc4e0'}
          transparent
          opacity={0.8}
          metalness={0.85}
          roughness={0.05}
          envMapIntensity={2.0}
        />
      </mesh>
    </group>
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

const WorldRig = ({ dayTime, weather, season }: { dayTime: number; weather: Weather; season: Season }) => {
  const isDay = dayTime > 6 && dayTime < 18;
  const isSunset = (dayTime >= 17 && dayTime <= 19) || (dayTime >= 5 && dayTime <= 7);
  const sunTheta = Math.PI * ((dayTime - 6) / 12);
  const sunX = Math.cos(sunTheta) * 100;
  const sunY = Math.max(5, Math.sin(sunTheta) * 100);

  const skyInclination = isDay ? 0.49 : 0.53;
  const skyAzimuth = (dayTime / 24) * 0.5;
  const skyTurbidity = weather === 'STORM' ? 20 : weather === 'RAIN' ? 12 : weather === 'CLOUDY' ? 8 : 2;
  const skyRayleigh = isDay ? (isSunset ? 4 : 1) : 0.1;

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[sunX, sunY, 50]}
        inclination={skyInclination}
        azimuth={skyAzimuth}
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
        <hemisphereLight
          color="#ff9966"
          groundColor="#3d1a00"
          intensity={0.3}
        />
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

        <OrbitControls
          maxPolarAngle={Math.PI / 2 - 0.05}
          maxDistance={140}
          minDistance={10}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />

        <WorldRig dayTime={props.dayTime} weather={props.weather} season={props.season} />
        <WeatherEffects weather={props.weather} />

        <Terrain season={props.season} />

        {props.water.map(p => <WaterSurface key={p.id} patch={p} />)}
        {props.flora.map(f => <FloraRenderer key={f.id} item={f} season={props.season} />)}
        {props.fauna.map(f => <FaunaRenderer key={f.id} item={f} />)}
        {props.buildings.map(b => <BuildingRenderer key={b.id} building={b} />)}

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
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.ttf"
                fontWeight={700}
              >
                {p.name.toUpperCase()}
              </Text>
              <mesh position={[0, -0.45, 0]}>
                <coneGeometry args={[0.15, 0.2, 3]} />
                <meshStandardMaterial color="#1e293b" opacity={0.85} transparent flatShading />
              </mesh>
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