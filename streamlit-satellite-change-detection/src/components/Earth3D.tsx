import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Sphere, useTexture } from "@react-three/drei";
import { Suspense, useRef, useMemo } from "react";
import * as THREE from "three";

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Load the equirectangular earth texture we generated
  const texture = useTexture("/earth-texture.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.06;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.08;
    if (atmosphereRef.current) atmosphereRef.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* Earth sphere */}
      <Sphere ref={earthRef} args={[2, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          roughness={0.85}
          metalness={0.05}
        />
      </Sphere>

      {/* Cloud layer — slightly larger, semi-transparent */}
      <Sphere ref={cloudsRef} args={[2.02, 64, 64]}>
        <meshStandardMaterial
          transparent
          opacity={0.18}
          color="#a5c9ff"
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </Sphere>

      {/* Atmospheric glow shell */}
      <Sphere ref={atmosphereRef} args={[2.12, 64, 64]}>
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={{
            glowColor: { value: new THREE.Color("#38bdf8") },
            viewVector: { value: new THREE.Vector3(0, 0, 5) },
          }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 glowColor;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              float intensity = pow(0.65 - dot(vNormal, vPositionNormal), 2.5);
              gl_FragColor = vec4(glowColor, 1.0) * intensity;
            }
          `}
        />
      </Sphere>

      {/* Outer glow halo */}
      <Sphere ref={glowRef} args={[2.4, 64, 64]}>
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={{ glowColor: { value: new THREE.Color("#818cf8") } }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 glowColor;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              float intensity = pow(0.55 - dot(vNormal, vPositionNormal), 3.0);
              gl_FragColor = vec4(glowColor, 1.0) * intensity * 0.7;
            }
          `}
        />
      </Sphere>
    </group>
  );
}

function OrbitRings() {
  const rings = useMemo(
    () => [
      { radius: 3.2, color: "#38bdf8", opacity: 0.18, speed: 0.15, tilt: 0.3 },
      { radius: 3.8, color: "#818cf8", opacity: 0.12, speed: -0.1, tilt: -0.5 },
      { radius: 4.4, color: "#f472b6", opacity: 0.08, speed: 0.08, tilt: 0.8 },
    ],
    []
  );
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    refs.current.forEach((g, i) => {
      if (g) g.rotation.y += delta * rings[i].speed;
    });
  });

  return (
    <>
      {rings.map((r, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[r.tilt, 0, 0]}
        >
          <mesh>
            <ringGeometry args={[r.radius - 0.005, r.radius + 0.005, 128]} />
            <meshBasicMaterial
              color={r.color}
              transparent
              opacity={r.opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function SatelliteDots() {
  const dots = useMemo(() => {
    return Array.from({ length: 14 }).map(() => ({
      theta: Math.random() * Math.PI * 2,
      phi: (Math.random() - 0.5) * Math.PI * 0.9,
      radius: 2.6 + Math.random() * 1.4,
      speed: 0.2 + Math.random() * 0.4,
      color: Math.random() > 0.5 ? "#38bdf8" : "#f472b6",
    }));
  }, []);
  const refs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const d = dots[i];
      const a = d.theta + t * d.speed;
      m.position.set(
        Math.cos(a) * Math.cos(d.phi) * d.radius,
        Math.sin(d.phi) * d.radius,
        Math.sin(a) * Math.cos(d.phi) * d.radius
      );
    });
  });

  return (
    <>
      {dots.map((d, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el as unknown as THREE.Mesh;
          }}
        >
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color={d.color} />
        </mesh>
      ))}
    </>
  );
}

export function Earth3DScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 5.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 3, 5]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-6, -2, -3]} intensity={0.4} color="#818cf8" />
        <pointLight position={[0, 3, 0]} intensity={0.3} color="#38bdf8" />

        <Stars
          radius={100}
          depth={50}
          count={4000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />

        <Earth />
        <OrbitRings />
        <SatelliteDots />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.35}
          minPolarAngle={Math.PI / 2.2}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Suspense>
    </Canvas>
  );
}
