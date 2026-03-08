import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { Flora, Fauna, Building, Season } from '../types';

const seasonLeafColor = (season: Season, base: string, autumn: string, winter: string): string => {
  if (season === 'AUTUMN') return autumn;
  if (season === 'WINTER') return winter;
  return base;
};

const TreeOak: React.FC<{ scale: number; season: Season }> = ({ scale, season }) => {
  const leafColor = seasonLeafColor(season, '#6fba72', '#e88022', '#e2e8f0');
  const leafColor2 = seasonLeafColor(season, '#56a165', '#fb923c', '#cbd5e1');
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.4, 2.2, 6]} />
        <meshStandardMaterial color="#593d2e" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow rotation={[0.4, 0.2, 0.1]}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.8, 2.2, 0.5]} castShadow rotation={[0, 0.4, 0.3]}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color={leafColor2} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[-0.9, 2.5, -0.4]} castShadow>
        <icosahedronGeometry args={[1.3, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
};

const TreePine: React.FC<{ scale: number; season: Season }> = ({ scale, season }) => {
  const green = '#2a6642';
  const topColor = season === 'WINTER' ? '#f1f5f9' : green;
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 2.0, 6]} />
        <meshStandardMaterial color="#593d2e" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow>
        <coneGeometry args={[1.4, 1.8, 8]} />
        <meshStandardMaterial color={green} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0, 3.2, 0]} castShadow>
        <coneGeometry args={[1.1, 1.6, 8]} />
        <meshStandardMaterial color={green} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0, 4.2, 0]} castShadow>
        <coneGeometry args={[0.7, 1.3, 8]} />
        <meshStandardMaterial color={topColor} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
};

const TreeBirch: React.FC<{ scale: number; season: Season }> = ({ scale, season }) => {
  const leafColor = seasonLeafColor(season, '#8fc98f', '#f0c040', '#dde6ed');
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 2.6, 6]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.05, 1.0, 0.02]} castShadow>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
        <meshStandardMaterial color="#2a2a2a" flatShading />
      </mesh>
      <mesh position={[-0.03, 1.5, -0.02]} castShadow>
        <boxGeometry args={[0.03, 0.2, 0.03]} />
        <meshStandardMaterial color="#2a2a2a" flatShading />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.5, 2.5, 0.3]} castShadow>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
};

const TreeWillow: React.FC<{ scale: number; season: Season }> = ({ scale, season }) => {
  const leafColor = seasonLeafColor(season, '#5a9e5a', '#c8a030', '#c0ccd8');
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.35, 2.5, 6]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.8, 2.0, 0.4]} castShadow rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.4, 1.8, 6]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[-0.7, 2.0, -0.3]} castShadow rotation={[-0.4, 0, 0.3]}>
        <coneGeometry args={[0.4, 1.8, 6]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.2, 1.8, -0.7]} castShadow rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.35, 1.6, 6]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
};

const BushBerry: React.FC<{ scale: number; season: Season }> = ({ scale, season }) => {
  const leafColor = seasonLeafColor(season, '#40a35e', '#b8860b', '#b0bec5');
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.3, 0.5, 0.2]} castShadow>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#e53935" roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.2, 0.6, -0.1]} castShadow>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#e53935" roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0.1, 0.3, -0.3]} castShadow>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#c62828" roughness={0.5} flatShading />
      </mesh>
    </group>
  );
};

const BushHerb: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.15, 0]} castShadow>
      <icosahedronGeometry args={[0.4, 1]} />
      <meshStandardMaterial color="#66bb6a" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[0.3, 0.1, 0.2]} castShadow>
      <icosahedronGeometry args={[0.25, 1]} />
      <meshStandardMaterial color="#4caf50" roughness={0.8} flatShading />
    </mesh>
  </group>
);

const TallGrass: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.3, 0]} castShadow rotation={[0.1, 0, 0.05]}>
      <cylinderGeometry args={[0.02, 0.03, 0.6, 4]} />
      <meshStandardMaterial color="#7cb342" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[0.08, 0.25, 0.05]} castShadow rotation={[-0.05, 0, -0.1]}>
      <cylinderGeometry args={[0.02, 0.03, 0.5, 4]} />
      <meshStandardMaterial color="#8bc34a" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[-0.06, 0.28, -0.04]} castShadow rotation={[0.08, 0, 0.12]}>
      <cylinderGeometry args={[0.02, 0.03, 0.55, 4]} />
      <meshStandardMaterial color="#689f38" roughness={0.8} flatShading />
    </mesh>
  </group>
);

const MushroomModel: React.FC<{ type: string; scale: number }> = ({ type, scale }) => {
  const capColor = type === 'MUSHROOM_RED' ? '#ff5c5c' : type === 'MUSHROOM_GLOW' ? '#7c4dff' : '#a1887f';
  const isGlow = type === 'MUSHROOM_GLOW';
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.4, 6]} />
        <meshStandardMaterial color="#dbd2ba" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow rotation={[0.1, 0, 0.1]}>
        <coneGeometry args={[0.35, 0.25, 8]} />
        <meshStandardMaterial
          color={capColor}
          roughness={isGlow ? 0.3 : 0.7}
          emissive={isGlow ? '#7c4dff' : '#000000'}
          emissiveIntensity={isGlow ? 0.8 : 0}
          flatShading
        />
      </mesh>
      {isGlow && <pointLight color="#7c4dff" intensity={1} distance={4} decay={2} position={[0, 0.5, 0]} />}
      {type === 'MUSHROOM_RED' && (
        <>
          <mesh position={[0.1, 0.48, 0.05]} castShadow>
            <sphereGeometry args={[0.04, 4, 4]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
          <mesh position={[-0.08, 0.46, -0.08]} castShadow>
            <sphereGeometry args={[0.03, 4, 4]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </>
      )}
    </group>
  );
};

const ResourceRock: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.4, 0]} castShadow rotation={[0.2, 0.4, 0]}>
      <dodecahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color="#88929e" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[0.6, 0.3, -0.3]} castShadow rotation={[-0.1, 0.7, 0]} scale={0.7}>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#aab4be" roughness={0.7} flatShading />
    </mesh>
  </group>
);

const ResourceFlint: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.2, 0]} castShadow rotation={[0.3, 0.5, 0.2]}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#37474f" roughness={0.6} flatShading />
    </mesh>
    <mesh position={[0.3, 0.15, 0.2]} castShadow rotation={[0.1, 0.8, 0.4]}>
      <dodecahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color="#263238" roughness={0.5} flatShading />
    </mesh>
  </group>
);

const ResourceClay: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.08, 0]} receiveShadow>
      <cylinderGeometry args={[0.8, 0.9, 0.15, 10]} />
      <meshStandardMaterial color="#a0725a" roughness={1} flatShading />
    </mesh>
    <mesh position={[0.3, 0.12, 0.2]} receiveShadow>
      <cylinderGeometry args={[0.4, 0.5, 0.1, 8]} />
      <meshStandardMaterial color="#8d6147" roughness={1} flatShading />
    </mesh>
  </group>
);

const ResourceOre: React.FC<{ scale: number; tint: string }> = ({ scale, tint }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.4, 0]} castShadow rotation={[0.2, 0.3, 0.1]}>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#78909c" roughness={0.7} flatShading />
    </mesh>
    <mesh position={[0.3, 0.35, 0.2]} castShadow rotation={[0.5, 0.2, 0]}>
      <dodecahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color={tint} roughness={0.5} metalness={0.3} flatShading />
    </mesh>
    <mesh position={[-0.2, 0.5, -0.15]} castShadow>
      <dodecahedronGeometry args={[0.25, 0]} />
      <meshStandardMaterial color={tint} roughness={0.4} metalness={0.4} flatShading />
    </mesh>
  </group>
);

const FarmCrop: React.FC<{ scale: number; growthStage: number }> = ({ scale, growthStage }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[1.2, 0.1, 1.2]} />
      <meshStandardMaterial color="#35241b" roughness={1} flatShading />
    </mesh>
    {growthStage >= 0 && (
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 4]} />
        <meshStandardMaterial color="#5e8b34" flatShading />
      </mesh>
    )}
    {growthStage >= 1 && (
      <mesh position={[0, 0.6, 0]} castShadow scale={0.8}>
        <coneGeometry args={[0.2, 0.5, 4]} />
        <meshStandardMaterial color={growthStage >= 2 ? '#b9eb47' : '#84c734'} flatShading />
      </mesh>
    )}
    {growthStage >= 2 && (
      <mesh position={[0, 0.8, 0]} castShadow>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#e9ff94" roughness={0.4} flatShading />
      </mesh>
    )}
  </group>
);

const Cactus: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    <mesh position={[0, 0.6, 0]} castShadow>
      <cylinderGeometry args={[0.15, 0.2, 1.2, 6]} />
      <meshStandardMaterial color="#2e7d32" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[0.2, 0.7, 0]} castShadow rotation={[0, 0, 0.8]}>
      <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
      <meshStandardMaterial color="#388e3c" roughness={0.8} flatShading />
    </mesh>
    <mesh position={[-0.15, 0.9, 0]} castShadow rotation={[0, 0, -0.6]}>
      <cylinderGeometry args={[0.07, 0.09, 0.4, 6]} />
      <meshStandardMaterial color="#388e3c" roughness={0.8} flatShading />
    </mesh>
  </group>
);

const Reed: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={[scale, scale, scale]}>
    {[0, 0.08, -0.06].map((xOff, i) => (
      <mesh key={i} position={[xOff, 0.5 + i * 0.05, i * 0.03]} castShadow rotation={[(i - 1) * 0.05, 0, (i - 1) * 0.03]}>
        <cylinderGeometry args={[0.02, 0.025, 1.0 + i * 0.1, 4]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.9} flatShading />
      </mesh>
    ))}
  </group>
);

const FlowerField: React.FC<{ scale: number }> = ({ scale }) => {
  const colors = ['#e91e63', '#ff9800', '#ffeb3b', '#9c27b0', '#2196f3'];
  return (
    <group scale={[scale, scale, scale]}>
      {colors.map((c, i) => (
        <mesh key={i} position={[Math.sin(i * 1.3) * 0.4, 0.12, Math.cos(i * 1.3) * 0.4]} castShadow>
          <sphereGeometry args={[0.08, 5, 5]} />
          <meshStandardMaterial color={c} roughness={0.6} flatShading />
        </mesh>
      ))}
      {[0, 1, 2].map(i => (
        <mesh key={`stem${i}`} position={[Math.sin(i * 2.1) * 0.3, 0.06, Math.cos(i * 2.1) * 0.3]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 3]} />
          <meshStandardMaterial color="#558b2f" flatShading />
        </mesh>
      ))}
    </group>
  );
};

const FireEffect: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => (
  <group>
    <pointLight color="#ff8e36" intensity={4 * intensity} distance={10} decay={2} position={[0, 1, 0]} castShadow />
    <Float speed={5} rotationIntensity={2} floatIntensity={0.5}>
      <mesh position={[0, 0.6, 0]}>
        <octahedronGeometry args={[0.4 * intensity, 0]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
    </Float>
    <Float speed={7} rotationIntensity={3} floatIntensity={0.3}>
      <mesh position={[0.1, 0.4, 0.1]}>
        <octahedronGeometry args={[0.2 * intensity, 0]} />
        <meshBasicMaterial color="#ff6600" />
      </mesh>
    </Float>
  </group>
);

export const FloraRenderer: React.FC<{ item: Flora; season: Season }> = ({ item, season }) => {
  const { type, scale, position, resourcesLeft, maxResources } = item;
  const ratio = maxResources ? (resourcesLeft || 0) / maxResources : 1;
  const s = Math.max(0.2, scale * (0.4 + 0.6 * ratio));

  return (
    <group position={[position.x, position.y, position.z]}>
      {type === 'TREE_OAK' && <TreeOak scale={s} season={season} />}
      {type === 'TREE_PINE' && <TreePine scale={s} season={season} />}
      {type === 'TREE_BIRCH' && <TreeBirch scale={s} season={season} />}
      {type === 'TREE_WILLOW' && <TreeWillow scale={s} season={season} />}
      {type === 'BUSH_BERRY' && <BushBerry scale={s} season={season} />}
      {type === 'BUSH_HERB' && <BushHerb scale={s} />}
      {type === 'TALL_GRASS' && <TallGrass scale={s} />}
      {type === 'MUSHROOM_RED' && <MushroomModel type="MUSHROOM_RED" scale={s} />}
      {type === 'MUSHROOM_BROWN' && <MushroomModel type="MUSHROOM_BROWN" scale={s} />}
      {type === 'MUSHROOM_GLOW' && <MushroomModel type="MUSHROOM_GLOW" scale={s} />}
      {type === 'RESOURCE_ROCK' && <ResourceRock scale={s} />}
      {type === 'RESOURCE_FLINT' && <ResourceFlint scale={s} />}
      {type === 'RESOURCE_CLAY' && <ResourceClay scale={s} />}
      {type === 'RESOURCE_COPPER_ORE' && <ResourceOre scale={s} tint="#26a69a" />}
      {type === 'RESOURCE_TIN_ORE' && <ResourceOre scale={s} tint="#b0bec5" />}
      {type === 'RESOURCE_IRON_ORE' && <ResourceOre scale={s} tint="#bf360c" />}
      {type === 'FARM_CROP' && <FarmCrop scale={s} growthStage={item.growthStage || 0} />}
      {type === 'CACTUS' && <Cactus scale={s} />}
      {type === 'REED' && <Reed scale={s} />}
      {type === 'FLOWER_FIELD' && <FlowerField scale={s} />}
      {item.isOnFire && <FireEffect intensity={0.6} />}
    </group>
  );
};

export const FaunaRenderer: React.FC<{ item: Fauna }> = ({ item }) => {
  const { type, position, rotation, isAggressive } = item;
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;

    if (item.state === 'MOVING' || item.state === 'FLEEING' || item.state === 'HUNTING') {
      group.current.position.y = position.y + Math.abs(Math.sin(t * 12)) * 0.15;
      group.current.rotation.z = Math.sin(t * 8) * 0.05;
    } else if (item.state === 'SLEEPING') {
      group.current.position.y = position.y;
      group.current.rotation.z = Math.PI / 2 * 0.3;
    } else {
      group.current.position.y = position.y;
      group.current.rotation.z = 0;
      const breathe = 1 + Math.sin(t * 2) * 0.02;
      group.current.scale.set(1, breathe, 1);
    }
  });

  return (
    <group ref={group} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
      {type === 'RABBIT' && (
        <group scale={[0.4, 0.4, 0.4]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.4, 0.3, 0.5]} />
            <meshStandardMaterial color="#f5f0e8" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0.45, 0.25]} castShadow>
            <boxGeometry args={[0.25, 0.25, 0.25]} />
            <meshStandardMaterial color="#f5f0e8" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0.06, 0.62, 0.22]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.05, 0.25, 0.05]} />
            <meshStandardMaterial color="#e8d8c8" flatShading />
          </mesh>
          <mesh position={[-0.06, 0.62, 0.22]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.05, 0.25, 0.05]} />
            <meshStandardMaterial color="#e8d8c8" flatShading />
          </mesh>
          <mesh position={[0, 0.15, -0.25]} castShadow>
            <sphereGeometry args={[0.08, 4, 4]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      )}

      {type === 'DEER' && (
        <group scale={[0.7, 0.7, 0.7]}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.35, 0.4, 0.9]} />
            <meshStandardMaterial color="#a0845e" roughness={0.7} flatShading />
          </mesh>
          <mesh position={[0, 0.8, 0.45]} castShadow>
            <boxGeometry args={[0.25, 0.3, 0.3]} />
            <meshStandardMaterial color="#b8956a" roughness={0.7} flatShading />
          </mesh>
          {[-0.12, 0.12].map((xOff, i) => (
            <React.Fragment key={i}>
              <mesh position={[xOff, 0.25, 0.3]} castShadow>
                <boxGeometry args={[0.08, 0.5, 0.08]} />
                <meshStandardMaterial color="#8b7355" flatShading />
              </mesh>
              <mesh position={[xOff, 0.25, -0.3]} castShadow>
                <boxGeometry args={[0.08, 0.5, 0.08]} />
                <meshStandardMaterial color="#8b7355" flatShading />
              </mesh>
            </React.Fragment>
          ))}
          <mesh position={[0.1, 1.05, 0.5]} castShadow rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.015, 0.02, 0.4, 4]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
          <mesh position={[-0.1, 1.05, 0.5]} castShadow rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.015, 0.02, 0.4, 4]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
          <mesh position={[0.18, 1.2, 0.5]} castShadow rotation={[0, 0, 0.8]}>
            <cylinderGeometry args={[0.01, 0.015, 0.2, 3]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
          <mesh position={[-0.18, 1.2, 0.5]} castShadow rotation={[0, 0, -0.8]}>
            <cylinderGeometry args={[0.01, 0.015, 0.2, 3]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
        </group>
      )}

      {type === 'BOAR' && (
        <group scale={[0.6, 0.6, 0.6]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.5, 0.45, 0.7]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.5, 0.35]} castShadow>
            <boxGeometry args={[0.35, 0.35, 0.3]} />
            <meshStandardMaterial color="#4e342e" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.45, 0.52]} castShadow>
            <boxGeometry args={[0.2, 0.15, 0.1]} />
            <meshStandardMaterial color="#3e2723" flatShading />
          </mesh>
          <mesh position={[0.1, 0.42, 0.55]} castShadow rotation={[0.3, 0, 0.2]}>
            <coneGeometry args={[0.03, 0.12, 4]} />
            <meshStandardMaterial color="#efebe9" flatShading />
          </mesh>
          <mesh position={[-0.1, 0.42, 0.55]} castShadow rotation={[0.3, 0, -0.2]}>
            <coneGeometry args={[0.03, 0.12, 4]} />
            <meshStandardMaterial color="#efebe9" flatShading />
          </mesh>
          {[-0.15, 0.15].map((xOff, i) => (
            <React.Fragment key={i}>
              <mesh position={[xOff, 0.15, 0.2]} castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial color="#3e2723" flatShading />
              </mesh>
              <mesh position={[xOff, 0.15, -0.2]} castShadow>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial color="#3e2723" flatShading />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      )}

      {type === 'WOLF' && (
        <group scale={[0.65, 0.65, 0.65]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.35, 0.38, 0.8]} />
            <meshStandardMaterial color="#607d8b" roughness={0.7} flatShading />
          </mesh>
          <mesh position={[0, 0.58, 0.4]} castShadow>
            <boxGeometry args={[0.28, 0.28, 0.35]} />
            <meshStandardMaterial color="#546e7a" roughness={0.7} flatShading />
          </mesh>
          <mesh position={[0, 0.55, 0.6]} castShadow>
            <boxGeometry args={[0.15, 0.12, 0.15]} />
            <meshStandardMaterial color="#37474f" flatShading />
          </mesh>
          <mesh position={[0, 0.4, -0.45]} rotation={[-0.3, 0, 0]} castShadow>
            <coneGeometry args={[0.06, 0.35, 4]} />
            <meshStandardMaterial color="#607d8b" flatShading />
          </mesh>
          <mesh position={[0.1, 0.72, 0.42]} castShadow>
            <coneGeometry args={[0.05, 0.12, 3]} />
            <meshStandardMaterial color="#546e7a" flatShading />
          </mesh>
          <mesh position={[-0.1, 0.72, 0.42]} castShadow>
            <coneGeometry args={[0.05, 0.12, 3]} />
            <meshStandardMaterial color="#546e7a" flatShading />
          </mesh>
          {[-0.12, 0.12].map((xOff, i) => (
            <React.Fragment key={i}>
              <mesh position={[xOff, 0.2, 0.25]} castShadow>
                <boxGeometry args={[0.07, 0.4, 0.07]} />
                <meshStandardMaterial color="#455a64" flatShading />
              </mesh>
              <mesh position={[xOff, 0.2, -0.25]} castShadow>
                <boxGeometry args={[0.07, 0.4, 0.07]} />
                <meshStandardMaterial color="#455a64" flatShading />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      )}

      {type === 'BEAR' && (
        <group scale={[1.0, 1.0, 1.0]}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.7, 0.7, 1.2]} />
            <meshStandardMaterial color="#452a1d" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.75, 0.6]} castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#5e3927" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.65, 0.9]} castShadow>
            <boxGeometry args={[0.3, 0.25, 0.3]} />
            <meshStandardMaterial color="#3e2723" flatShading />
          </mesh>
          <mesh position={[0.2, 0.95, 0.65]} castShadow>
            <boxGeometry args={[0.15, 0.15, 0.1]} />
            <meshStandardMaterial color="#3e2723" flatShading />
          </mesh>
          <mesh position={[-0.2, 0.95, 0.65]} castShadow>
            <boxGeometry args={[0.15, 0.15, 0.1]} />
            <meshStandardMaterial color="#3e2723" flatShading />
          </mesh>
          {[-0.22, 0.22].map((xOff, i) => (
            <React.Fragment key={i}>
              <mesh position={[xOff, 0.25, 0.35]} castShadow>
                <boxGeometry args={[0.15, 0.5, 0.15]} />
                <meshStandardMaterial color="#3e2723" flatShading />
              </mesh>
              <mesh position={[xOff, 0.25, -0.35]} castShadow>
                <boxGeometry args={[0.15, 0.5, 0.15]} />
                <meshStandardMaterial color="#3e2723" flatShading />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      )}

      {type === 'BIRD' && (
        <group scale={[0.3, 0.3, 0.3]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.2, 0.18, 0.3]} />
            <meshStandardMaterial color="#78909c" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, 1.55, 0.18]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#90a4ae" flatShading />
          </mesh>
          <mesh position={[0, 1.53, 0.25]} castShadow>
            <coneGeometry args={[0.03, 0.08, 3]} />
            <meshStandardMaterial color="#ff8f00" flatShading />
          </mesh>
          <mesh position={[0.2, 1.52, 0]} castShadow rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.3, 0.02, 0.15]} />
            <meshStandardMaterial color="#607d8b" flatShading />
          </mesh>
          <mesh position={[-0.2, 1.52, 0]} castShadow rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.3, 0.02, 0.15]} />
            <meshStandardMaterial color="#607d8b" flatShading />
          </mesh>
        </group>
      )}

      {type === 'FISH' && (
        <group scale={[0.35, 0.35, 0.35]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.25, 6, 4]} />
            <meshStandardMaterial color="#4fc3f7" roughness={0.4} metalness={0.3} flatShading />
          </mesh>
          <mesh position={[0, 0.1, -0.25]} castShadow>
            <coneGeometry args={[0.15, 0.2, 4]} />
            <meshStandardMaterial color="#29b6f6" flatShading />
          </mesh>
        </group>
      )}

      {isAggressive && (
        <mesh position={[0, type === 'BEAR' ? 1.2 : 0.8, 0.3]}>
          <boxGeometry args={[0.15, 0.04, 0.04]} />
          <meshBasicMaterial color="#ff2a2a" />
        </mesh>
      )}
    </group>
  );
};

export const BuildingRenderer: React.FC<{ building: Building }> = ({ building }) => {
  const rot = building.rotation || 0;
  const progress = building.buildProgress;
  const opacity = progress < 1 ? 0.5 + progress * 0.5 : 1;

  return (
    <group position={[building.position.x, building.position.y, building.position.z]} rotation={[0, rot, 0]}>
      {building.type === 'CAMPFIRE' && (
        <group>
          <mesh position={[0, 0.1, 0]} rotation={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.2, 0.15, 0.15]} />
            <meshStandardMaterial color="#3e2723" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[1.2, 0.15, 0.15]} />
            <meshStandardMaterial color="#3e2723" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[0.6, 0.7, 0.1, 8]} />
            <meshStandardMaterial color="#4e342e" roughness={1} flatShading />
          </mesh>
          <FireEffect />
        </group>
      )}

      {building.type === 'LEAN_TO' && (
        <group>
          <mesh position={[-0.8, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1.2, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0.8, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1.2, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.9, -0.3]} rotation={[0.5, 0, 0]} castShadow>
            <boxGeometry args={[2.0, 0.05, 1.8]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'HUT' && (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[1.2, 1.4, 1.4, 8]} />
            <meshStandardMaterial color="#a1887f" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow>
            <coneGeometry args={[1.5, 1.2, 8]} />
            <meshStandardMaterial color="#6d4c41" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.5, 1.2]}>
            <boxGeometry args={[0.5, 0.8, 0.1]} />
            <meshStandardMaterial color="#3e2723" flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'STONE_HOUSE' && (
        <group>
          <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 2.0, 2.2]} />
            <meshStandardMaterial color="#b0bec5" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[2.0, 1.2, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.7} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.6, 1.11]}>
            <boxGeometry args={[0.5, 1.0, 0.1]} />
            <meshStandardMaterial color="#4e342e" flatShading />
          </mesh>
          <mesh position={[0.65, 1.3, 1.12]}>
            <boxGeometry args={[0.35, 0.35, 0.05]} />
            <meshStandardMaterial color="#64b5f6" roughness={0.1} metalness={0.6} flatShading />
          </mesh>
        </group>
      )}

      {building.type === 'STORAGE_PIT' && (
        <group>
          <mesh position={[0, -0.3, 0]} receiveShadow>
            <cylinderGeometry args={[1.0, 0.8, 0.8, 8]} />
            <meshStandardMaterial color="#5d4037" roughness={1} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[1.1, 1.1, 0.1, 8]} />
            <meshStandardMaterial color="#795548" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'DRYING_RACK' && (
        <group>
          <mesh position={[-0.6, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.4, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0.6, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.4, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1.4, 4]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 1.4, 4]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          {[-0.3, 0, 0.3].map((x, i) => (
            <mesh key={i} position={[x, 0.9, 0.05]} castShadow>
              <boxGeometry args={[0.15, 0.3, 0.04]} />
              <meshStandardMaterial color="#8b4513" roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      )}

      {building.type === 'WORKSHOP' && (
        <group>
          {[[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]].map(([x, _, z], i) => (
            <mesh key={i} position={[x, 0.8, z]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, 1.6, 4]} />
              <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
            </mesh>
          ))}
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[2.2, 0.08, 2.2]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.5, 0.7, 0.8]} />
            <meshStandardMaterial color="#795548" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'FARM_PLOT' && (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[2.5, 0.06, 2.5]} />
            <meshStandardMaterial color="#3e2723" roughness={1} flatShading opacity={opacity} transparent />
          </mesh>
          {[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => (
            <mesh key={i} position={[0, 0.08, z]} receiveShadow>
              <boxGeometry args={[2.3, 0.06, 0.15]} />
              <meshStandardMaterial color="#4e342e" roughness={1} flatShading />
            </mesh>
          ))}
          <mesh position={[-1.25, 0.15, 0]} castShadow>
            <boxGeometry args={[0.06, 0.3, 2.5]} />
            <meshStandardMaterial color="#5d4037" flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[1.25, 0.15, 0]} castShadow>
            <boxGeometry args={[0.06, 0.3, 2.5]} />
            <meshStandardMaterial color="#5d4037" flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'WELL' && (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.7, 0.8, 0.8, 8]} />
            <meshStandardMaterial color="#90a4ae" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.3, 8]} />
            <meshPhysicalMaterial color="#4dd0e1" roughness={0.05} metalness={0.8} transparent opacity={0.7} />
          </mesh>
          <mesh position={[-0.5, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.2, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0.5, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.2, 4]} />
            <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <boxGeometry args={[1.2, 0.06, 0.1]} />
            <meshStandardMaterial color="#6d4c41" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.type === 'WALL' && (
        <group>
          <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 1.2, 0.4]} />
            <meshStandardMaterial color="#90a4ae" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[2.05, 0.08, 0.45]} />
            <meshStandardMaterial color="#78909c" roughness={0.7} flatShading />
          </mesh>
        </group>
      )}

      {building.type === 'SMELTER' && (
        <group>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshStandardMaterial color="#78909c" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.5, 0.5, 6]} />
            <meshStandardMaterial color="#607d8b" roughness={0.7} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 0.4, 0.61]}>
            <boxGeometry args={[0.4, 0.4, 0.05]} />
            <meshStandardMaterial color="#1a1a1a" flatShading />
          </mesh>
          <pointLight color="#ff6d00" intensity={2} distance={5} decay={2} position={[0, 0.5, 0.6]} />
          <mesh position={[0, 0.4, 0.58]}>
            <boxGeometry args={[0.3, 0.3, 0.02]} />
            <meshBasicMaterial color="#ff6d00" />
          </mesh>
        </group>
      )}

      {building.type === 'TOTEM' && (
        <group>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 3.0, 6]} />
            <meshStandardMaterial color="#6d4c41" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 2.5, 0.08]} castShadow>
            <boxGeometry args={[0.3, 0.3, 0.1]} />
            <meshStandardMaterial color="#4e342e" flatShading />
          </mesh>
          <mesh position={[0, 2.0, 0.08]} castShadow>
            <boxGeometry args={[0.25, 0.2, 0.08]} />
            <meshStandardMaterial color="#3e2723" flatShading />
          </mesh>
          <mesh position={[0, 1.5, 0.08]} castShadow>
            <boxGeometry args={[0.35, 0.25, 0.08]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
          <mesh position={[0, 3.05, 0]} castShadow>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#ff8f00" roughness={0.5} flatShading />
          </mesh>
        </group>
      )}

      {building.type === 'GRANARY' && (
        <group>
          {[[-0.7, 0, -0.7], [0.7, 0, -0.7], [-0.7, 0, 0.7], [0.7, 0, 0.7]].map(([x, _, z], i) => (
            <mesh key={i} position={[x, 0.4, z]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 0.8, 4]} />
              <meshStandardMaterial color="#5d4037" roughness={0.9} flatShading opacity={opacity} transparent />
            </mesh>
          ))}
          <mesh position={[0, 1.0, 0]} castShadow>
            <boxGeometry args={[1.8, 1.0, 1.8]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.8} flatShading opacity={opacity} transparent />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.5, 0.8, 4]} />
            <meshStandardMaterial color="#6d4c41" roughness={0.7} flatShading opacity={opacity} transparent />
          </mesh>
        </group>
      )}

      {building.isOnFire && <FireEffect intensity={1.2} />}
    </group>
  );
};