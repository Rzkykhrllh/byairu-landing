import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
import type { Side } from '../config';

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

// ---- dimensions (world units) ----
const HOLDER_W = 1.6;
const HOLDER_H = 2.48;
const HOLDER_D = 0.04;
const FACE_W = 1.462;
const FACE_H = FACE_W / FACE_ASPECT;
const FACE_Y = -0.0825;
const SLOT_Y = 1.123;

// ---- lanyard shape ----
// Two straps come down from the neck (left and right) and meet at a metal clip above the card.
const TOP_Y = 4.6; // where the straps leave the top of the screen
const NECK = 0.55; // half the gap between the two straps at the top
const SEG = 1.08; // max length between rope points
const STRAP_W = 0.3;
const CLIP_DROP = 0.18; // clip centre to card anchor

// ---- feel ----
// A light plastic badge: low gravity scale, little damping on the card, a bit more on the strap.
const GRAVITY = -22;
const STRAP_DAMP = 2.2;
const CARD_LIN_DAMP = 0.9;
const CARD_ANG_DAMP = 1.4;
const FLIP_STIFF = 0.32; // how hard the card turns towards the chosen side
const FLIP_DAMP = 0.9; // keeps the turn from overshooting

type Body = RapierRigidBody & { lerped?: THREE.Vector3 };
type Ref = MutableRefObject<Body>;

export default function Lanyard() {
  const [tex, setTex] = useState<CardTextures | null>(null);

  useEffect(() => {
    let alive = true;
    makeTextures().then((t) => {
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
      <Physics gravity={[0, GRAVITY, 0]} timeStep={1 / 60}>
        <Badge tex={tex} />
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

/** One strap: fixed top -> two free points -> clip, drawn as a textured ribbon. */
function useStrap(top: Ref, a: Ref, b: Ref, clip: Ref) {
  useRopeJoint(top, a, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(a, b, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(b, clip, [[0, 0, 0], [0, 0, 0], SEG]);
  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    c.curveType = 'chordal';
    return c;
  });
  return curve;
}

function smooth(ref: Ref, delta: number) {
  const body = ref.current;
  const t = body.translation() as THREE.Vector3;
  if (!body.lerped) body.lerped = new THREE.Vector3().copy(t);
  const d = Math.max(0.1, Math.min(1, body.lerped.distanceTo(t)));
  // clamp so a slow frame can never overshoot and blow the curve up
  body.lerped.lerp(t, Math.min(1, delta * (12 + d * 38)));
  return body.lerped;
}

function Badge({ tex }: { tex: CardTextures }) {
  const bandL = useRef<any>(null);
  const bandR = useRef<any>(null);
  const topL = useRef<Body>(null!);
  const topR = useRef<Body>(null!);
  const l1 = useRef<Body>(null!);
  const l2 = useRef<Body>(null!);
  const r1 = useRef<Body>(null!);
  const r2 = useRef<Body>(null!);
  const clip = useRef<Body>(null!);
  const card = useRef<Body>(null!);

  const curveL = useStrap(topL, l1, l2, clip);
  const curveR = useStrap(topR, r1, r2, clip);
  useSphericalJoint(clip, card, [[0, -CLIP_DROP / 2, 0], [0, HOLDER_H / 2 + CLIP_DROP / 2, 0]]);

  const tmp = useMemo(
    () => ({ vec: new THREE.Vector3(), dir: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }),
    [],
  );
  const { width, height } = useThree((s) => s.size);

  const [dragged, setDragged] = useState<THREE.Vector3 | false>(false);
  const [hovered, setHovered] = useState(false);
  const [side, setSide] = useState<Side>('dev');

  const target = useRef(0); // yaw the card settles to: 0 = engineer side, PI = photographer side
  const sideRef = useRef<Side>('dev');
  const flippedOnce = useRef(false);
  const lastActivity = useRef(performance.now());
  const lastPeek = useRef(0);
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const strapBody: RigidBodyProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: STRAP_DAMP, linearDamping: STRAP_DAMP };

  const turnTo = (s: Side) => {
    target.current = s === 'frame' ? Math.PI : 0;
    flippedOnce.current = true;
    lastActivity.current = performance.now();
    card.current?.wakeUp();
  };

  // the links under the card can turn it
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
    const { vec, dir, q, e } = tmp;
    if (!card.current || !clip.current) return;

    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, clip, l1, l2, r1, r2].forEach((r) => r.current?.wakeUp());
      card.current.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: 0 });
    }

    // rebuild both strap ribbons
    const c = clip.current.translation() as THREE.Vector3;
    curveL.points[0].copy(topL.current.translation() as THREE.Vector3);
    curveL.points[1].copy(smooth(l1, delta));
    curveL.points[2].copy(smooth(l2, delta));
    curveL.points[3].copy(c);
    curveR.points[0].copy(topR.current.translation() as THREE.Vector3);
    curveR.points[1].copy(smooth(r1, delta));
    curveR.points[2].copy(smooth(r2, delta));
    curveR.points[3].copy(c);
    bandL.current.geometry.setPoints(curveL.getPoints(32));
    bandR.current.geometry.setPoints(curveR.getPoints(32));

    // turn the card towards the chosen side with a damped spring on its yaw,
    // and let pitch / roll settle so the card hangs flat towards the viewer
    const r = card.current.rotation();
    q.set(r.x, r.y, r.z, r.w);
    e.setFromQuaternion(q, 'YXZ');
    let err = target.current - e.y;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const ang = card.current.angvel();
    let wy = ang.y * FLIP_DAMP + err * FLIP_STIFF;

    // subtle cue: until the first flip, the card turns a little every now and then
    const now = performance.now();
    if (!flippedOnce.current && !dragged && now - lastActivity.current > 2500 && now - lastPeek.current > 11000) {
      lastPeek.current = now;
      wy += 2.4;
    }
    card.current.setAngvel({ x: ang.x * 0.96 - e.x * 0.08, y: wy, z: ang.z * 0.96 }, true);

    const facing: Side = Math.cos(e.y) >= 0 ? 'dev' : 'frame';
    if (facing !== sideRef.current) {
      sideRef.current = facing;
      setSide(facing);
      window.dispatchEvent(new CustomEvent('lanyard:side', { detail: facing }));
    }
  });

  const strap = side === 'dev' ? tex.strapDev : tex.strapFrame;
  // repeat the woven label along the strap without stretching it
  const strapRepeat = useMemo(() => [-(SEG * 3) / (STRAP_W * strap.aspect), 1], [strap]);

  const onDown = (ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
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
  const metal = { color: '#d3d7db', metalness: 0.55, roughness: 0.32 };

  // Start every body where it would hang at rest, so the page opens calm instead of with a drop.
  const clipY = -SEG * 2.85;
  const cardY = clipY - CLIP_DROP - HOLDER_H / 2;
  const strapX = (k: number) => NECK * (1 - k / 3);
  const strapY = (k: number) => (clipY * k) / 3;

  return (
    <>
      <group position={[0, TOP_Y, 0]}>
        <RigidBody ref={topL} {...strapBody} type="fixed" position={[-NECK, 0, 0]} />
        <RigidBody ref={topR} {...strapBody} type="fixed" position={[NECK, 0, 0]} />
        <RigidBody ref={l1} {...strapBody} position={[-strapX(1), strapY(1), 0]}>
          <BallCollider args={[0.08]} density={4} />
        </RigidBody>
        <RigidBody ref={l2} {...strapBody} position={[-strapX(2), strapY(2), 0]}>
          <BallCollider args={[0.08]} density={4} />
        </RigidBody>
        <RigidBody ref={r1} {...strapBody} position={[strapX(1), strapY(1), 0]}>
          <BallCollider args={[0.08]} density={4} />
        </RigidBody>
        <RigidBody ref={r2} {...strapBody} position={[strapX(2), strapY(2), 0]}>
          <BallCollider args={[0.08]} density={4} />
        </RigidBody>

        {/* metal clip where the two straps meet */}
        <RigidBody ref={clip} {...strapBody} position={[0, clipY, 0]}>
          <BallCollider args={[0.08]} density={4} />
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.05]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          <mesh position={[0, -0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.055, 0.014, 10, 24]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        </RigidBody>

        <RigidBody
          ref={card}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
          canSleep
          colliders={false}
          linearDamping={CARD_LIN_DAMP}
          angularDamping={CARD_ANG_DAMP}
          position={[0, cardY, 0]}
        >
          <CuboidCollider args={[HOLDER_W / 2, HOLDER_H / 2, HOLDER_D / 2]} density={0.35} />
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
            {/* split ring through the slot, up to the clip */}
            <mesh position={[0, SLOT_Y + 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.09, 0.014, 10, 28]} />
              <meshStandardMaterial {...metal} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      {[bandL, bandR].map((ref, i) => (
        <mesh key={i} ref={ref} renderOrder={-1} frustumCulled={false}>
          <meshLineGeometry />
          <meshLineMaterial
            color="white"
            depthTest
            resolution={[width, height]}
            useMap
            map={strap.tex}
            repeat={strapRepeat}
            lineWidth={STRAP_W}
          />
        </mesh>
      ))}
    </>
  );
}
