import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
  type RigidBodyProps,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { makeTextures, FACE_ASPECT, type CardTextures } from '../lib/faces';
import { resolveAvatarMode, type Side } from '../config';

extend({ MeshLineGeometry, MeshLineMaterial });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: any;
      meshLineMaterial: any;
    }
  }
}

// Holder and card dimensions in world units (mirrors the prototype: 232x360 holder, 212x316 card).
const HOLDER_W = 1.6;
const HOLDER_H = 2.48;
const HOLDER_D = 0.045;
const FACE_W = 1.462;
const FACE_H = FACE_W / FACE_ASPECT;
const FACE_Y = -0.0825;
const SLOT_Y = 1.123;

/** Lets the page (links under the card) and the 3D scene talk to each other. */
export const sideEvents = {
  emit(side: Side) {
    window.dispatchEvent(new CustomEvent('lanyard:side', { detail: side }));
  },
};

export default function Lanyard() {
  const [tex, setTex] = useState<CardTextures | null>(null);

  useEffect(() => {
    let alive = true;
    makeTextures(resolveAvatarMode()).then((t) => {
      if (!alive) return;
      setTex(t);
      document.documentElement.classList.add('has-3d');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!tex) return null;

  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 13], fov: 25 }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      aria-hidden="true"
    >
      <Responsive />
      <ambientLight intensity={Math.PI * 0.85} />
      <directionalLight position={[3, 5, 6]} intensity={0.6} />
      <Physics gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band tex={tex} />
      </Physics>
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
          <Lightformer form="circle" intensity={3} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
        </group>
      </Environment>
    </Canvas>
  );
}

/** Pull the camera back on narrow screens so the card always fits. */
function Responsive() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.position.z = aspect < 0.62 ? 16.5 : aspect < 0.9 ? 14.5 : 13;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

type Segment = RapierRigidBody & { lerped?: THREE.Vector3 };

function Band({ tex, maxSpeed = 50, minSpeed = 10 }: { tex: CardTextures; maxSpeed?: number; minSpeed?: number }) {
  const band = useRef<any>(null);
  const fixed = useRef<Segment>(null!);
  const j1 = useRef<Segment>(null!);
  const j2 = useRef<Segment>(null!);
  const j3 = useRef<Segment>(null!);
  const card = useRef<RapierRigidBody>(null!);

  const tmp = useMemo(
    () => ({ vec: new THREE.Vector3(), dir: new THREE.Vector3(), ang: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }),
    [],
  );
  const { width, height } = useThree((s) => s.size);
  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    c.curveType = 'chordal';
    return c;
  });

  const [dragged, setDragged] = useState<THREE.Vector3 | false>(false);
  const [hovered, setHovered] = useState(false);
  const [side, setSide] = useState<Side>('dev');

  const target = useRef(0); // yaw the card settles to: 0 = engineer side, PI = photographer side
  const sideRef = useRef<Side>('dev');
  const flippedOnce = useRef(false);
  const lastActivity = useRef(performance.now());
  const lastPeek = useRef(0);
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const segmentProps: RigidBodyProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, HOLDER_H / 2 + 0.06, 0]]);

  const turnTo = (s: Side) => {
    target.current = s === 'frame' ? Math.PI : 0;
    flippedOnce.current = true;
    lastActivity.current = performance.now();
    card.current?.wakeUp();
  };

  // links under the card can turn it
  useEffect(() => {
    const onSet = (e: Event) => turnTo((e as CustomEvent<Side>).detail);
    window.addEventListener('lanyard:set', onSet);
    return () => window.removeEventListener('lanyard:set', onSet);
  }, []);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? 'grabbing' : 'grab';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    const { vec, dir, ang, q, e } = tmp;
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((r) => r.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (!fixed.current || !card.current) return;

    // smooth the two middle joints to kill jitter, then rebuild the strap curve
    [j1, j2].forEach((ref) => {
      const seg = ref.current;
      if (!seg.lerped) seg.lerped = new THREE.Vector3().copy(seg.translation() as THREE.Vector3);
      const d = Math.max(0.1, Math.min(1, seg.lerped.distanceTo(seg.translation() as THREE.Vector3)));
      // clamp: on a slow frame the factor could exceed 1 and blow the curve up
      seg.lerped.lerp(seg.translation() as THREE.Vector3, Math.min(1, delta * (minSpeed + d * (maxSpeed - minSpeed))));
    });
    curve.points[0].copy(j3.current.translation() as THREE.Vector3);
    curve.points[1].copy(j2.current.lerped!);
    curve.points[2].copy(j1.current.lerped!);
    curve.points[3].copy(fixed.current.translation() as THREE.Vector3);
    band.current.geometry.setPoints(curve.getPoints(32));

    // spring the card's yaw towards the chosen side
    const r = card.current.rotation();
    q.set(r.x, r.y, r.z, r.w);
    e.setFromQuaternion(q, 'YXZ');
    let err = target.current - e.y;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    ang.copy(card.current.angvel() as THREE.Vector3);

    // subtle cue: until the first flip, the card turns slightly every so often
    const now = performance.now();
    if (!flippedOnce.current && !dragged && now - lastActivity.current > 2500 && now - lastPeek.current > 11000) {
      lastPeek.current = now;
      ang.y += 3.4;
      card.current.wakeUp();
    }
    card.current.setAngvel({ x: ang.x, y: ang.y + err * 0.2, z: ang.z }, true);

    // which side is facing the viewer
    const facing: Side = Math.cos(e.y) >= 0 ? 'dev' : 'frame';
    if (facing !== sideRef.current) {
      sideRef.current = facing;
      setSide(facing);
      sideEvents.emit(facing);
    }
  });

  const strap = side === 'dev' ? tex.strapDev : tex.strapFrame;

  const onDown = (ev: ThreeEvent<PointerEvent>) => {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    pressAt.current = { x: ev.clientX, y: ev.clientY };
    lastActivity.current = performance.now();
    setDragged(new THREE.Vector3().copy(ev.point).sub(tmp.vec.copy(card.current.translation() as THREE.Vector3)));
  };
  const onUp = (ev: ThreeEvent<PointerEvent>) => {
    (ev.target as Element).releasePointerCapture?.(ev.pointerId);
    setDragged(false);
    const p = pressAt.current;
    pressAt.current = null;
    lastActivity.current = performance.now();
    if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 6) turnTo(sideRef.current === 'dev' ? 'frame' : 'dev');
  };

  const plastic = { roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.35 };

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[HOLDER_W / 2, HOLDER_H / 2, HOLDER_D / 2]} />
          <group
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={onDown}
            onPointerUp={onUp}
          >
            {/* black plastic holder */}
            <RoundedBox args={[HOLDER_W, HOLDER_H, HOLDER_D]} radius={0.1} smoothness={4}>
              <meshPhysicalMaterial color="#16171b" roughness={0.38} metalness={0.15} clearcoat={1} clearcoatRoughness={0.2} envMapIntensity={0.6} />
            </RoundedBox>
            {/* engineer side */}
            <mesh position={[0, FACE_Y, HOLDER_D / 2 + 0.001]}>
              <planeGeometry args={[FACE_W, FACE_H]} />
              <meshPhysicalMaterial map={tex.dev} {...plastic} />
            </mesh>
            {/* photographer side */}
            <mesh position={[0, FACE_Y, -HOLDER_D / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[FACE_W, FACE_H]} />
              <meshPhysicalMaterial map={tex.frame} {...plastic} />
            </mesh>
            {/* slot, both sides */}
            {[1, -1].map((s) => (
              <mesh key={s} position={[0, SLOT_Y, s * (HOLDER_D / 2 + 0.001)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                <planeGeometry args={[0.32, 0.085]} />
                <meshBasicMaterial color="#050506" />
              </mesh>
            ))}
            {/* metal ring through the slot */}
            <mesh position={[0, SLOT_Y + 0.07, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.1, 0.017, 12, 32]} />
              <meshStandardMaterial color="#b9bec3" metalness={1} roughness={0.25} />
            </mesh>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band} frustumCulled={false}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={[width, height]}
          useMap
          map={strap}
          repeat={[-4, 1]}
          lineWidth={0.42}
        />
      </mesh>
    </>
  );
}
