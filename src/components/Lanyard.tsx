import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
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
import { makeTextures, FACE_ASPECT, type CardTextures } from '../lib/faces';
import { CARD_FINISH, type Side } from '../config';

// ---- card (world units) ----
// No holder: the printed face is the card, edge to edge, with rounded corners.
const CARD_W = 2.1;
const CARD_H = CARD_W / FACE_ASPECT;
const CARD_D = 0.03;
const CARD_R = 0.14; // corner radius

// ---- lanyard ----
// One wide plain strap straight down from above the screen, ending in a metal clamp over the card.
const TOP_Y = 4.8; // where the strap leaves the top of the screen
const SEG = 1.1; // max length between rope points
const STRAP_W = 0.62;
const STRAP_SEGS = 48; // slices along the strap ribbon
const STRAP_STRETCH = 0.15; // how far dragging can stretch the strap: 0 = not at all, 0.15 = 15% longer
const CLAMP_Y = CARD_H / 2 + 0.34; // clamp centre above card centre
const ANCHOR_Y = CLAMP_Y; // the strap ends inside the clamp, so the clamp hides its end

// ---- feel ----
// Heavier than before: the card swings and settles with weight, the strap stays loose.
const GRAVITY = -40;
const STRAP_DAMP = 2;
const CARD_LIN_DAMP = 0.6;
const CARD_ANG_DAMP = 1.1;
const FLIP_STIFF = 0.28; // how hard the card turns towards the chosen side
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
      <ambientLight intensity={Math.PI * 0.9} />
      <directionalLight position={[3, 5, 6]} intensity={0.5} />
      {/* extra solver iterations keep the rope joints from stretching under a swing */}
      <Physics gravity={[0, GRAVITY, 0]} timeStep={1 / 60} numSolverIterations={8}>
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
    camera.position.z = aspect < 0.62 ? 18.5 : aspect < 0.9 ? 15.5 : 13;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** Rounded rectangle, with UVs stretched over its bounds so a texture covers it edge to edge. */
function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function useCardGeometry() {
  return useMemo(() => {
    const shape = roundedShape(CARD_W, CARD_H, CARD_R);
    const face = new THREE.ShapeGeometry(shape, 12);
    const pos = face.attributes.position;
    const uv = face.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5);
    }
    uv.needsUpdate = true;
    const body = new THREE.ExtrudeGeometry(shape, { depth: CARD_D, bevelEnabled: false, curveSegments: 12 });
    body.translate(0, 0, -CARD_D / 2);
    const slot = new THREE.ShapeGeometry(roundedShape(0.34, 0.07, 0.035), 6);
    return { face, body, slot };
  }, []);
}

/** Surface of the printed faces, picked by CARD_FINISH in config. */
const FINISHES = {
  matte: { roughness: 0.75, metalness: 0, sheen: 0.5, sheenRoughness: 0.6, sheenColor: '#ffffff', envMapIntensity: 0.45 },
  glossy: { roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 },
  holo: {
    roughness: 0.32,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 1,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [180, 720] as [number, number],
    envMapIntensity: 1,
  },
};

/**
 * The strap as a real flat ribbon (not a camera-facing line), so it can twist.
 * Index 0 is the clamp end, the last slice is the top of the screen.
 */
function useRibbon() {
  return useMemo(() => {
    const n = STRAP_SEGS + 1;
    const pos = new Float32Array(n * 2 * 3);
    const nor = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < STRAP_SEGS; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(idx);

    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const w = new THREE.Vector3();
    const nn = new THREE.Vector3();
    const cardX = new THREE.Vector3();

    const update = (curve: THREE.CatmullRomCurve3, yaw: number, cardQ: THREE.Quaternion) => {
      const len = curve.getLength();
      cardX.set(1, 0, 0).applyQuaternion(cardQ);
      for (let i = 0; i < n; i++) {
        const k = i / STRAP_SEGS; // 0 at the clamp, 1 at the top
        curve.getPointAt(k, p);
        curve.getTangentAt(k, t);
        // twist eases out from the clamp: most of the turn happens in the lower part of the strap
        const share = Math.pow(1 - k, 1.6);
        const a = yaw * share;
        w.set(Math.cos(a), 0, -Math.sin(a));
        // right at the clamp, lock onto the card's own sideways axis (follows its roll too)
        const lock = Math.max(0, 1 - k * 8);
        if (lock > 0) w.lerp(cardX, lock);
        w.addScaledVector(t, -w.dot(t)).normalize();
        nn.crossVectors(w, t).normalize();
        const h = STRAP_W / 2;
        pos.set([p.x - w.x * h, p.y - w.y * h, p.z - w.z * h, p.x + w.x * h, p.y + w.y * h, p.z + w.z * h], i * 6);
        nor.set([nn.x, nn.y, nn.z, nn.x, nn.y, nn.z], i * 6);
        const u = (k * len) / STRAP_W;
        uv.set([u, 0, u, 1], i * 4);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
      geometry.attributes.uv.needsUpdate = true;
      geometry.computeBoundingSphere();
    };

    return { geometry, update };
  }, []);
}

function smooth(ref: Ref, delta: number) {
  const body = ref.current;
  const t = body.translation() as THREE.Vector3;
  if (!body.lerped) body.lerped = new THREE.Vector3().copy(t);
  const d = Math.max(0.1, Math.min(1, body.lerped.distanceTo(t)));
  // clamp so a slow frame can never overshoot and blow the curve up
  body.lerped.lerp(t, Math.min(1, delta * (25 + d * 60)));
  return body.lerped;
}

function Badge({ tex }: { tex: CardTextures }) {
  const top = useRef<Body>(null!);
  const j1 = useRef<Body>(null!);
  const j2 = useRef<Body>(null!);
  const j3 = useRef<Body>(null!);
  const card = useRef<Body>(null!);
  const geo = useCardGeometry();

  useRopeJoint(top, j1, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], SEG]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, ANCHOR_Y, 0]]);

  const [curve] = useState(() => {
    // clamp centre -> just above the clamp -> two free rope points -> top of the screen
    const c = new THREE.CatmullRomCurve3(Array.from({ length: 5 }, () => new THREE.Vector3()));
    c.curveType = 'chordal';
    return c;
  });

  const tmp = useMemo(
    () => ({
      vec: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      up: new THREE.Vector3(),
    }),
    [],
  );

  const [dragged, setDragged] = useState<THREE.Vector3 | false>(false);
  const [hovered, setHovered] = useState(false);

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

  const ribbon = useRibbon();
  const yawU = useRef(0); // card yaw, unwrapped, so the strap can twist past half a turn
  const prevYaw = useRef(0);

  useFrame((state, delta) => {
    const { vec, dir, q, e } = tmp;
    if (!card.current || !j3.current) return;

    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3].forEach((r) => r.current?.wakeUp());
      // keep the card within the strap's reach, so dragging can't stretch the strap
      vec.set(vec.x - dragged.x, vec.y - dragged.y, 0);
      dir.set(vec.x, vec.y + ANCHOR_Y - TOP_Y, 0); // top of strap -> clamp
      const reach = SEG * 3 * (1 + STRAP_STRETCH);
      if (dir.length() > reach) {
        dir.setLength(reach);
        vec.set(dir.x, dir.y + TOP_Y - ANCHOR_Y, 0);
      }
      card.current.setNextKinematicTranslation({ x: vec.x, y: vec.y, z: 0 });
    }

    const r = card.current.rotation();
    q.set(r.x, r.y, r.z, r.w);
    e.setFromQuaternion(q, 'YXZ');
    let dy = e.y - prevYaw.current;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    prevYaw.current = e.y;
    yawU.current += dy;

    // rebuild the strap ribbon: its bottom end follows the card's turn, the top stays put,
    // so a flip shows up as a twist spread along the strap
    // The strap end is taken from the card itself (the clamp centre), not from the last rope body,
    // so it is drawn inside the clamp every frame even when the joint stretches during a hard swing.
    // A second point just above the clamp, along the card's up axis, makes the strap leave it straight.
    const cp = card.current.translation();
    tmp.up.set(0, 1, 0).applyQuaternion(q);
    curve.points[0].set(cp.x, cp.y, cp.z).addScaledVector(tmp.up, ANCHOR_Y);
    curve.points[1].copy(curve.points[0]).addScaledVector(tmp.up, 0.3);
    curve.points[2].copy(smooth(j2, delta));
    curve.points[3].copy(smooth(j1, delta));
    curve.points[4].copy(top.current.translation() as THREE.Vector3);
    ribbon.update(curve, yawU.current, q);

    // turn the card towards the chosen side with a damped spring on its yaw (unwrapped, so a
    // flip back goes the way it came and the strap untwists), and let pitch settle flat
    const err = target.current - yawU.current;
    const ang = card.current.angvel();
    let wy = ang.y * FLIP_DAMP + err * FLIP_STIFF;

    // subtle cue: until the first flip, the card turns a little every now and then
    const now = performance.now();
    if (!flippedOnce.current && !dragged && now - lastActivity.current > 2500 && now - lastPeek.current > 11000) {
      lastPeek.current = now;
      wy += 2.4;
    }
    card.current.setAngvel({ x: ang.x * 0.96 - e.x * 0.08, y: wy, z: ang.z }, true);

    const facing: Side = Math.cos(e.y) >= 0 ? 'dev' : 'frame';
    if (facing !== sideRef.current) {
      sideRef.current = facing;
      window.dispatchEvent(new CustomEvent('lanyard:side', { detail: facing }));
    }
  });

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

  const finish = FINISHES[CARD_FINISH];
  const matte = { roughness: 0.85, metalness: 0, envMapIntensity: 0.25 };
  const metal = { color: '#c9cdd2', metalness: 0.8, roughness: 0.3, envMapIntensity: 1 };

  // Start every body where it would hang at rest, so the page opens calm instead of with a drop.
  const jY = (k: number) => -SEG * k;
  const cardY = jY(3) - ANCHOR_Y;

  return (
    <>
      <group position={[0, TOP_Y, 0]}>
        <RigidBody ref={top} {...strapBody} type="fixed" />
        <RigidBody ref={j1} {...strapBody} position={[0, jY(1), 0]}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody ref={j2} {...strapBody} position={[0, jY(2), 0]}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody ref={j3} {...strapBody} position={[0, jY(3), 0]}>
          <BallCollider args={[0.1]} />
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
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, CARD_D / 2]} density={0.6} />
          <group
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={onDown}
            onPointerUp={onUp}
          >
            {/* card edge */}
            <mesh geometry={geo.body}>
              <meshStandardMaterial color="#e9e7e2" {...matte} />
            </mesh>
            {/* engineer side */}
            <mesh geometry={geo.face} position={[0, 0, CARD_D / 2 + 0.001]}>
              <meshPhysicalMaterial map={tex.dev} {...finish} />
            </mesh>
            {/* photographer side */}
            <mesh geometry={geo.face} position={[0, 0, -CARD_D / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
              <meshPhysicalMaterial map={tex.frame} {...finish} />
            </mesh>
            {/* punched slot, both sides */}
            {[1, -1].map((s) => (
              <mesh
                key={s}
                geometry={geo.slot}
                position={[0, CARD_H / 2 - 0.1, s * (CARD_D / 2 + 0.002)]}
                rotation={[0, s > 0 ? 0 : Math.PI, 0]}
              >
                <meshBasicMaterial color="#1a1b1f" />
              </mesh>
            ))}
            {/* ring through the slot */}
            <mesh position={[0, CARD_H / 2 + 0.04, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.15, 0.022, 12, 32]} />
              <meshStandardMaterial {...metal} />
            </mesh>
            {/* metal clamp the strap is crimped into */}
            <RoundedBox args={[STRAP_W + 0.08, 0.26, 0.09]} radius={0.035} smoothness={3} position={[0, CLAMP_Y, 0]}>
              <meshStandardMaterial {...metal} />
            </RoundedBox>
            <mesh position={[0, CLAMP_Y - 0.17, 0]}>
              <boxGeometry args={[0.08, 0.1, 0.05]} />
              <meshStandardMaterial {...metal} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      <mesh geometry={ribbon.geometry} frustumCulled={false}>
        <meshStandardMaterial map={tex.strap.tex} side={THREE.DoubleSide} roughness={0.9} metalness={0} envMapIntensity={0.3} />
      </mesh>
    </>
  );
}
