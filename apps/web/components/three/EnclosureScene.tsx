"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import { useReducedMotion } from "motion/react";
import { DeviceIllustration } from "@/components/strip/device-illustration";

export interface EnclosureSceneProps {
  /** CSS height of the canvas; width fills the container. Default 420. */
  height?: number;
  className?: string;
}

const SIGNAL = "#5fd4e6";

function Enclosure({ spin }: { spin: boolean }) {
  const group = useRef<Group>(null);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    if (spin) g.rotation.y += delta * 0.18;
    // gentle breathing tilt
    g.rotation.x = -0.12 + Math.sin(state.clock.elapsedTime * 0.4) * 0.02;
  });
  return (
    <group ref={group} rotation={[-0.12, 0.6, 0]} position={[0, -0.2, 0]}>
      {/* lower body */}
      <RoundedBox args={[2.6, 1.5, 1.1]} radius={0.04} smoothness={4} position={[0, -0.35, 0]}>
        <meshStandardMaterial color="#0e0f12" roughness={0.75} metalness={0.15} />
      </RoundedBox>
      {/* upper cap with screen */}
      <RoundedBox args={[2.9, 0.9, 1.25]} radius={0.04} smoothness={4} position={[0, 0.85, 0]}>
        <meshStandardMaterial color="#121316" roughness={0.7} metalness={0.2} />
      </RoundedBox>
      {/* screen plane */}
      <mesh position={[0, 0.85, 0.63]}>
        <planeGeometry args={[2.3, 0.64]} />
        <meshStandardMaterial color="#061013" emissive={SIGNAL} emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      {/* strip slot LED line */}
      <mesh position={[-0.6, -1.09, 0.56]}>
        <planeGeometry args={[0.9, 0.02]} />
        <meshStandardMaterial color={SIGNAL} emissive={SIGNAL} emissiveIntensity={2} />
      </mesh>
      {/* strip, half inserted */}
      <mesh position={[-1.35, -1.08, 0.64]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[1.2, 0.12]} />
        <meshStandardMaterial color="#ecebe4" roughness={0.9} />
      </mesh>
      {/* pads on the exposed part of the strip */}
      {["#e9e27a", "#c8b84a", "#e7c9a8"].map((c, i) => (
        <mesh key={c} position={[-0.95 + i * 0.13, -1.08, 0.645]} rotation={[-0.08, 0, 0]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshStandardMaterial color={c} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** React Three Fiber scene of the enclosure. Idle rotation is skipped under reduced motion. */
export function EnclosureScene({ height = 420, className }: EnclosureSceneProps) {
  const reduced = useReducedMotion();
  return (
    <div className={className} style={{ height, width: "100%" }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 5.2], fov: 32 }} gl={{ antialias: true, alpha: true }} frameloop={reduced ? "demand" : "always"}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#9fe6f2" />
        <pointLight position={[-1, -1.5, 2]} intensity={1.2} color={SIGNAL} distance={4} />
        <Enclosure spin={!reduced} />
      </Canvas>
    </div>
  );
}

/** SSR-safe placeholder shown while the scene loads (and under reduced motion by the lazy wrapper). */
export function EnclosureFallback({ height = 420 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height, width: "100%" }}>
      <DeviceIllustration width={Math.min(520, height * 1.25)} />
    </div>
  );
}

export default EnclosureScene;
