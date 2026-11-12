import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox, SoftShadows } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
  type RigidBodyProps,
} from '@react-three/rapier';
import { makeDevTexture, makeTextures, ownerTime, FACE_ASPECT, PORTRAIT, type CardTextures } from '../lib/faces';
import { seasonOf } from '../lib/scene';
import { CARD_FINISH, type Side } from '../config';
import { play } from '../lib/sfx';

// ---- card (world units) ----
// No holder: the printed face is the card, edge to edge, with rounded corners.
const CARD_W = 2.1;
const CARD_H = CARD_W / FACE_ASPECT;
const CARD_D = 0.03;
const CARD_R = 0.14; // corner radius

// ---- lanyard ----
// One wide plain strap straight down from above the screen, ending in a metal clamp over the card.
const TOP_Y = 4.8; // where the strap leaves the top of the screen
const STRAP_LEN = 3.3; // strap length, top of the screen to the clamp
const ROPE_POINTS = 4; // free points along the strap; the rope refs and joints in Badge match this
const SEG = STRAP_LEN / ROPE_POINTS; // max length between rope points
const STRAP_W = 0.62;
const STRAP_SEGS = 48; // slices along the strap ribbon
const STRAP_STRETCH = 0.15; // how far dragging can stretch the strap: 0 = not at all, 0.15 = 15% longer
const CLAMP_Y = CARD_H / 2 + 0.34; // clamp centre above card centre
const ANCHOR_Y = CLAMP_Y; // the strap ends inside the clamp, so the clamp hides its end

// ---- feel ----
// Gravity does the swinging; the only extra force is a torsion spring that turns the card to the
// chosen side (the strap's twist). It runs once per physics step, so it feels the same at 60 and 120Hz.
const GRAVITY = -40;
const STRAP_DAMP = 2;
const CARD_LIN_DAMP = 0.6;
const CARD_ANG_DAMP = 1.4;
const TURN_STIFF = 16.8; // torsion spring, rad/s² per rad of error
const TURN_DAMP = 6; // 1/s, keeps the turn from overshooting
const THROW_MAX = 18; // cap on release speed, world units/s
const PEEKS = [3500, 12000]; // ms after load: until the first flip, the card turns a little at these times
const DYNAMIC = 0; // RigidBodyType.Dynamic in Rapier

// ---- entrance ----
// A scripted drop, not free physics: the card comes straight down from above the screen, dips a
// little past its resting point, settles back and stops. Only then does physics take over, so the
// first impression is calm and the bounce is saved for when someone plays with it.
const ENTER_FROM = 6; // start this far above the resting position (world units)
const ENTER_MS = 650; // length of the drop
const ENTER_OVERSHOOT = 2; // how far it dips past rest (0 = none, 1.7 = a lot)
const REST_Y = TOP_Y - STRAP_LEN - ANCHOR_Y; // world y of the card centre at rest

/** Ease-out with a small dip past the end, then back (the classic "back" curve). */
function easeOutBack(t: number, s: number) {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

type Body = RapierRigidBody & { lerped?: THREE.Vector3 };
type Ref = MutableRefObject<Body>;

export default function Lanyard() {
  const [tex, setTex] = useState<CardTextures | null>(null);

  useEffect(() => {
    let alive = true;
    makeTextures().then((t) => {
      if (!alive) return;
      setTex(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  // the visitor picked another time or season (or the hour turned): redraw the engineer side,
  // and re-read whether it is torch time
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const onTime = () => {
      setClock((k) => k + 1);
      makeDevTexture().then((dev) =>
        setTex((prev) => {
          if (!prev) return prev;
          prev.dev.dispose();
          return { ...prev, dev };
        }),
      );
    };
    window.addEventListener('lanyard:time', onTime);
    return () => window.removeEventListener('lanyard:time', onTime);
  }, []);

  if (!tex) return null;
  const night = isTorch();
  const winter = seasonOf(ownerTime().month) === 'winter'; // deep night: flashlight mode (an ordinary dark evening only changes the page colour)

  return (
    <Canvas
      flat
      shadows="percentage"
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 13], fov: FOV }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      aria-hidden="true"
      onCreated={() => requestAnimationFrame(() => document.documentElement.classList.add('has-3d'))}
    >
      <Responsive />
      <Look />
      {/* real soft shadows (random samples, softer the farther from the card), not stepped copies */}
      <SoftShadows size={45} samples={16} focus={0.4} />
      <ambientLight intensity={Math.PI * (night ? NIGHT_AMBIENT : 0.9)} />
      {night ? (
        <Flashlight />
      ) : (
        <directionalLight
          position={[3, 5, 6]}
          intensity={0.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.002}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
          shadow-camera-near={1}
          shadow-camera-far={30}
        />
      )}
      <Wall key={clock} night={night} />
      {/* Physics steps in its own loop and only asks for a new frame while something moves,
          so a card at rest costs nothing. Extra solver iterations keep the rope from stretching. */}
      <Physics gravity={[0, GRAVITY, 0]} timeStep={1 / 60} numSolverIterations={8} updateLoop="independent">
        <Badge tex={tex} night={night} winter={winter} />
      </Physics>
      <Environment resolution={256} environmentIntensity={night ? 0.3 : 1}>
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

const FOV = 25;
const CAM_Z = 13; // closest the camera gets: the card's size on a roomy screen
const LINKS_PX = 96; // room kept free under the card for the links
const CARD_BOTTOM = TOP_Y - STRAP_LEN - ANCHOR_Y - CARD_H / 2; // world y of the card's lower edge at rest

/**
 * Move the camera back just enough that the hanging card fits: its lower edge stays above the links
 * and it keeps some side margin. Works for any window shape, not only a few breakpoints.
 */
function Responsive() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const free = 1 - (2 * LINKS_PX) / size.height; // share of the view height above the links
    const needV = free > 0.2 ? -CARD_BOTTOM / free + 0.15 : Infinity; // half-height so the bottom clears the links
    const needH = (CARD_W * 0.85) / (size.width / size.height); // half-height so the card has side margin
    camera.position.z = Math.max(CAM_Z, Math.min(needV, 40) / t, needH / t);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);
  return null;
}

// ---- light, shadow and shine ----
const WALL_Z = -1.2; // the page is a wall just behind the card; its shadow falls here
const NIGHT_AMBIENT = 0.25; // share of the daytime room light left at night

/** The page sets <html class="torch"> in the small hours, from your clock (see CLOCK in config). */
const isTorch = () => document.documentElement.classList.contains('torch');

/**
 * Where the visitor is "looking from": the pointer on desktop, the phone's tilt on mobile,
 * both as -1..1 across the screen. `x, y` ease towards `tx, ty`; the shine and flashlight read them.
 */
const look = { x: 0, y: 0, tx: 0, ty: 0 };

function Look() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      look.tx = (e.clientX / innerWidth) * 2 - 1;
      look.ty = -((e.clientY / innerHeight) * 2 - 1);
      invalidate();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      look.tx = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
      look.ty = THREE.MathUtils.clamp((50 - e.beta) / 30, -1, 1);
      invalidate();
    };
    // iOS only hands out tilt after asking, and only inside a tap
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    const ask = () => DOE?.requestPermission?.().catch(() => {});
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt);
    window.addEventListener('touchend', ask, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('touchend', ask);
    };
  }, [invalidate]);
  useFrame((state, delta) => {
    const k = Math.min(1, delta * 7);
    look.x += (look.tx - look.x) * k;
    look.y += (look.ty - look.y) * k;
    if (Math.abs(look.tx - look.x) + Math.abs(look.ty - look.y) > 0.002) state.invalidate();
  });
  return null;
}

/** Deep night: a torch held by the visitor, aimed at the pointer. The card's shadow swings on the wall. */
function Flashlight() {
  const { camera } = useThree();
  const light = useRef<THREE.SpotLight>(null!);
  const tmp = useMemo(
    () => ({ target: new THREE.Object3D(), ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3() }),
    [],
  );
  useFrame(() => {
    tmp.ndc.set(look.x, look.y);
    tmp.ray.setFromCamera(tmp.ndc, camera);
    if (!tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit)) return;
    tmp.target.position.copy(tmp.hit);
    tmp.target.updateMatrixWorld();
    // held a little below and in front of the screen, so the shadow drops down and away from it
    light.current.position.set(tmp.hit.x * 0.3 - 1.6, tmp.hit.y * 0.3 - 2.6, 8);
  });
  return (
    <>
      <primitive object={tmp.target} />
      <spotLight
        ref={light}
        target={tmp.target}
        angle={0.3}
        penumbra={0.85}
        decay={0}
        intensity={Math.PI * 0.7}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
        shadow-camera-near={2}
        shadow-camera-far={30}
      />
    </>
  );
}

/**
 * The page behind the card. By day it is invisible and only catches the card's soft shadow.
 * In the small hours it is a dark wall that the flashlight lights up, painted so the unlit part matches
 * the page colour exactly (the room light scales it by NIGHT_AMBIENT).
 */
function Wall({ night }: { night: boolean }) {
  const color = useMemo(() => {
    if (!night) return null;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0d0f14';
    return new THREE.Color(bg).multiplyScalar(1 / NIGHT_AMBIENT);
  }, [night]);
  // on a dark page (dark mode, or evening where Airu is) the shadow needs more weight to show
  const dark = useMemo(() => matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.classList.contains('night'), []);
  return (
    <mesh position={[0, 0, WALL_Z]} receiveShadow raycast={() => null}>
      <planeGeometry args={[300, 300]} />
      {color ? (
        <meshStandardMaterial color={color} roughness={1} metalness={0} envMapIntensity={0} />
      ) : (
        <shadowMaterial transparent opacity={dark ? 0.32 : 0.13} />
      )}
    </mesh>
  );
}

/**
 * A light streak over a face of the card that slides with the pointer (or phone tilt) and with how
 * the card is turned, like the sheen on a laminated pass. Additive, so it only ever brightens.
 */
function makeShine() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uPos: { value: 0 }, uStrength: { value: 0 }, uFlip: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uPos, uStrength, uFlip;
      varying vec2 vUv;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        vec2 p = vUv - 0.5;
        p.x *= uFlip;
        float d = dot(p, normalize(vec2(1.0, 1.5))) - uPos;
        float core = exp(-d * d / 0.0025);
        float halo = exp(-d * d / 0.03);
        vec3 tint = mix(vec3(1.0), hue(fract(d * 3.0 + 0.55)), 0.55);
        gl_FragColor = vec4((vec3(core) * 0.8 + tint * halo * 0.45) * uStrength, 1.0);
      }`,
  });
}

// ---- winter: snow falling in the sprite's window ----
const SNOW_FPS = 15; // pixel snow does not need more, and it keeps the GPU calm
const SNOW_FLAKES = 34;

/**
 * Snow falling over the Tokyo street in the engineer side's window. A small transparent canvas laid
 * on the card face, redrawn a few times a second only while it is winter where Airu is, the
 * engineer side faces the viewer and the tab is visible.
 */
function Snow() {
  const invalidate = useThree((s) => s.invalidate);
  const K = 4; // texture pixels per card pixel
  const inset = 2; // stay inside the window's border
  const { x, y, w, h, px: FW, py: FH } = PORTRAIT;
  const tw = w - inset * 2, th = h - inset * 2;

  const { canvas, tex, flakes } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = tw * K;
    canvas.height = th * K;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const flakes = Array.from({ length: SNOW_FLAKES }, () => ({
      x: Math.random() * tw,
      y: Math.random() * th,
      speed: 5 + Math.random() * 8, // card pixels per second
      size: Math.random() < 0.3 ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.65 + Math.random() * 0.35,
    }));
    return { canvas, tex, flakes };
  }, [tw, th]);

  useEffect(() => {
    const g = canvas.getContext('2d')!;
    let facing = true;
    let last = performance.now();
    const onSide = (e: Event) => (facing = (e as CustomEvent<Side>).detail === 'dev');
    window.addEventListener('lanyard:side', onSide);
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden || !facing) return;
      g.clearRect(0, 0, canvas.width, canvas.height);
      for (const f of flakes) {
        f.y += f.speed * dt;
        f.phase += dt * 1.6;
        if (f.y > th) {
          f.y = -2;
          f.x = Math.random() * tw;
        }
        const fx = Math.round(f.x + Math.sin(f.phase) * 1.3);
        g.fillStyle = `rgba(255,255,255,${f.alpha})`;
        g.fillRect(fx * K, Math.round(f.y) * K, f.size * K, f.size * K);
      }
      tex.needsUpdate = true;
      invalidate();
    }, 1000 / SNOW_FPS);
    return () => {
      clearInterval(id);
      window.removeEventListener('lanyard:side', onSide);
      tex.dispose();
    };
  }, [canvas, tex, flakes, tw, th, invalidate]);

  // card pixels -> the card's local space (the face spans CARD_W x CARD_H, centred)
  const cx = ((x + inset + tw / 2) / FW - 0.5) * CARD_W;
  const cy = (0.5 - (y + inset + th / 2) / FH) * CARD_H;
  return (
    <mesh position={[cx, cy, CARD_D / 2 + 0.0013]} raycast={() => null}>
      <planeGeometry args={[(tw / FW) * CARD_W, (th / FH) * CARD_H]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
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

function Badge({ tex, night, winter }: { tex: CardTextures; night: boolean; winter: boolean }) {
  const top = useRef<Body>(null!);
  const rope = [useRef<Body>(null!), useRef<Body>(null!), useRef<Body>(null!), useRef<Body>(null!)];
  const card = useRef<Body>(null!);
  const geo = useCardGeometry();
  const { camera, gl } = useThree();

  // top -> rope points -> card (the last rope point sits in the clamp)
  useRopeJoint(top, rope[0], [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(rope[0], rope[1], [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(rope[1], rope[2], [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(rope[2], rope[3], [[0, 0, 0], [0, 0, 0], SEG]);
  useSphericalJoint(rope[3], card, [[0, 0, 0], [0, ANCHOR_Y, 0]]);

  const [curve] = useState(() => {
    // clamp centre -> just above the clamp -> rope points (bottom to top) -> top of the screen
    const c = new THREE.CatmullRomCurve3(Array.from({ length: ROPE_POINTS + 2 }, () => new THREE.Vector3()));
    c.curveType = 'chordal';
    return c;
  });

  const tmp = useMemo(
    () => ({
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      up: new THREE.Vector3(),
      anchor: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      hit: new THREE.Vector3(),
    }),
    [],
  );

  const [dragging, setDragging] = useState(false);
  const [entering, setEntering] = useState(true);
  const enter = useRef({ on: true, start: -1 });
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef(false); // the same flag, set at once by the handlers, read by the physics step

  const drag = useRef({
    offset: new THREE.Vector3(), // grab point relative to the card centre
    pointer: new THREE.Vector3(), // pointer on the card's plane, world space
    samples: [] as { t: number; x: number; y: number }[], // recent card targets, for the throw
    pressX: 0,
    pressY: 0,
    moved: false,
  });
  const throwVel = useRef<{ x: number; y: number } | null>(null);
  const peek = useRef(false);

  const target = useRef(0); // yaw the card settles to: 0 = engineer side, PI = photographer side
  const yawU = useRef(0); // card yaw, unwrapped, so the strap can twist past half a turn
  const prevYaw = useRef(0);
  const sideRef = useRef<Side>('dev');
  const flippedOnce = useRef(false);

  const strapBody: RigidBodyProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: STRAP_DAMP, linearDamping: STRAP_DAMP };

  const wake = () => [card, ...rope].forEach((r) => r.current?.wakeUp());

  const turnTo = (s: Side) => {
    const t = s === 'frame' ? Math.PI : 0;
    if (t !== target.current) play('flip');
    target.current = t;
    flippedOnce.current = true;
    wake();
  };

  // the links under the card can turn it
  useEffect(() => {
    const onSet = (e: Event) => turnTo((e as CustomEvent<Side>).detail);
    window.addEventListener('lanyard:set', onSet);
    return () => window.removeEventListener('lanyard:set', onSet);
  }, []);

  // until the first flip, a couple of gentle turns hint that the card has a back
  useEffect(() => {
    const timers = PEEKS.map((ms) =>
      setTimeout(() => {
        if (flippedOnce.current || dragRef.current) return;
        peek.current = true;
        wake();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!hovered && !dragging) return;
    document.body.style.cursor = dragging ? 'grabbing' : 'grab';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered, dragging]);

  // pointer -> point on the plane the card hangs in
  const toPlane = (clientX: number, clientY: number, out: THREE.Vector3) => {
    const r = gl.domElement.getBoundingClientRect();
    tmp.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    tmp.ray.setFromCamera(tmp.ndc, camera);
    return tmp.ray.ray.intersectPlane(tmp.plane, out);
  };

  // Press on the card starts a drag; the page-wide listeners go on right away (not in an effect),
  // so even a very quick click still sees its own pointerup.
  const onDown = (ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
    const d = drag.current;
    const c = card.current.translation();
    d.offset.set(ev.point.x - c.x, ev.point.y - c.y, 0);
    d.pointer.set(ev.point.x, ev.point.y, 0);
    d.pressX = ev.clientX;
    d.pressY = ev.clientY;
    d.moved = false;
    d.samples.length = 0;

    const onMove = (e: PointerEvent) => {
      toPlane(e.clientX, e.clientY, d.pointer);
      if (Math.hypot(e.clientX - d.pressX, e.clientY - d.pressY) > 6) d.moved = true;
    };
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // throw: card speed over the last ~90ms of the drag
      const now = performance.now();
      const recent = d.samples.filter((s) => now - s.t < 90);
      if (d.moved && recent.length > 1) {
        const a = recent[0], b = recent[recent.length - 1];
        const dt = Math.max((b.t - a.t) / 1000, 1 / 120);
        const v = new THREE.Vector2((b.x - a.x) / dt, (b.y - a.y) / dt);
        if (v.length() > THROW_MAX) v.setLength(THROW_MAX);
        throwVel.current = { x: v.x, y: v.y };
        if (v.length() > 4) play('whoosh', v.length() / THROW_MAX);
      }
      d.samples.length = 0;
      dragRef.current = false;
      setDragging(false);
      // a press that barely moved is a tap: turn the card over
      if (!d.moved && e.type === 'pointerup') turnTo(sideRef.current === 'dev' ? 'frame' : 'dev');
      else wake();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    dragRef.current = true;
    setDragging(true);
    play('grab');
    wake();
  };

  // ---- runs once per physics step (fixed 1/60s), before the world moves ----
  useBeforePhysicsStep((world) => {
    const c = card.current;
    if (!c) return;
    const dt = world.timestep;
    const { q, e, up, anchor } = tmp;

    const r = c.rotation();
    q.set(r.x, r.y, r.z, r.w);
    e.setFromQuaternion(q, 'YXZ');
    let dy = e.y - prevYaw.current;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    prevYaw.current = e.y;
    yawU.current += dy;

    if (enter.current.on) {
      if (dragRef.current) {
        // grabbed mid-drop: hand over to the drag right away
        enter.current.on = false;
        setEntering(false);
      } else {
        const now = performance.now();
        if (enter.current.start < 0) enter.current.start = now;
        const t = Math.min(1, (now - enter.current.start) / ENTER_MS);
        const y = REST_Y + ENTER_FROM * (1 - easeOutBack(t, ENTER_OVERSHOOT));
        c.setNextKinematicTranslation({ x: 0, y, z: 0 });
        if (t >= 1) {
          enter.current.on = false;
          setEntering(false); // back to a dynamic body, at rest, with no speed to carry
        }
        return;
      }
    }

    if (dragRef.current) {
      // the card follows the pointer, held back softly past the strap's length (rubber band)
      const d = drag.current;
      up.set(0, ANCHOR_Y, 0).applyQuaternion(q);
      // anchor = where the clamp would be, measured from the top of the strap
      anchor.set(d.pointer.x - d.offset.x + up.x, d.pointer.y - d.offset.y + up.y - TOP_Y, 0);
      const dist = anchor.length();
      const give = STRAP_LEN * STRAP_STRETCH;
      if (dist > STRAP_LEN) {
        anchor.setLength(give > 0 ? STRAP_LEN + give * (1 - Math.exp(-(dist - STRAP_LEN) / give)) : STRAP_LEN);
      }
      const x = anchor.x - up.x;
      const y = anchor.y + TOP_Y - up.y;
      c.setNextKinematicTranslation({ x, y, z: 0 });
      d.samples.push({ t: performance.now(), x, y });
      if (d.samples.length > 12) d.samples.shift();
      return;
    }
    if (c.bodyType() !== DYNAMIC) return; // just released: the body switches back next render

    if (throwVel.current) {
      c.setLinvel({ x: throwVel.current.x, y: throwVel.current.y, z: 0 }, true);
      throwVel.current = null;
    }

    // torsion spring towards the chosen side; skipped once settled, so the card can fall asleep
    const ang = c.angvel();
    const err = target.current - yawU.current;
    let wy = ang.y;
    if (peek.current) {
      peek.current = false;
      wy += 2.4;
    }
    if (Math.abs(err) > 0.003 || Math.abs(wy) > 0.01) {
      wy += (TURN_STIFF * err - TURN_DAMP * wy) * dt;
      c.setAngvel({ x: ang.x, y: wy, z: ang.z }, true);
    }

    const facing: Side = Math.cos(e.y) >= 0 ? 'dev' : 'frame';
    if (facing !== sideRef.current) {
      sideRef.current = facing;
      window.dispatchEvent(new CustomEvent('lanyard:side', { detail: facing }));
    }
  });

  const ribbon = useRibbon();
  const shine = useMemo(() => {
    const front = makeShine();
    const back = makeShine();
    back.uniforms.uFlip.value = -1;
    return { front, back, e: new THREE.Euler() };
  }, []);

  // ---- runs per rendered frame: draw the strap from where the bodies are ----
  useFrame((_, delta) => {
    const c = card.current;
    if (!c) return;
    const r = c.rotation();
    tmp.q.set(r.x, r.y, r.z, r.w);
    // The strap end is taken from the card itself (the clamp centre), not from the last rope body,
    // so it is drawn inside the clamp every frame even when the joint stretches during a hard swing.
    // A second point just above the clamp, along the card's up axis, makes the strap leave it straight.
    const cp = c.translation();
    tmp.up.set(0, 1, 0).applyQuaternion(tmp.q);
    curve.points[0].set(cp.x, cp.y, cp.z).addScaledVector(tmp.up, ANCHOR_Y);
    curve.points[1].copy(curve.points[0]).addScaledVector(tmp.up, 0.3);
    for (let i = 0; i < ROPE_POINTS - 1; i++) curve.points[2 + i].copy(smooth(rope[ROPE_POINTS - 2 - i], delta));
    curve.points[ROPE_POINTS + 1].copy(top.current.translation() as THREE.Vector3);
    curve.updateArcLengths(); // three caches arc lengths; stale ones skew the strap texture and twist
    ribbon.update(curve, yawU.current, tmp.q);

    // the sheen slides with the visitor's pointer and with how the card is turned and tilted
    shine.e.setFromQuaternion(tmp.q, 'YXZ');
    const turn = Math.sin(shine.e.y) * 0.55 + shine.e.z * 0.5;
    const base = look.x * 0.32 - look.y * 0.22;
    const strength = night ? 0.12 : 0.24;
    shine.front.uniforms.uPos.value = base + turn;
    shine.back.uniforms.uPos.value = base - turn;
    shine.front.uniforms.uStrength.value = shine.back.uniforms.uStrength.value = strength;
  });

  // at night the laminate scatters the torch a little, so its glare never hides the print
  const finish = night ? { ...FINISHES[CARD_FINISH], clearcoatRoughness: 0.4 } : FINISHES[CARD_FINISH];
  const matte = { roughness: 0.85, metalness: 0, envMapIntensity: 0.25 };
  const metal = { color: '#c9cdd2', metalness: 0.8, roughness: 0.3, envMapIntensity: 1 };

  // Entrance start (positions are relative to the top of the strap): the card waits ENTER_FROM above
  // its resting place, the rope points hang slack between the top of the strap and the clamp.
  const cardStart: [number, number, number] = [0, REST_Y + ENTER_FROM - TOP_Y, 0];
  const clampStartY = cardStart[1] + ANCHOR_Y;
  const ropeStart = (i: number): [number, number, number] => [0, (clampStartY * (i + 1)) / (ROPE_POINTS + 1), 0];

  return (
    <>
      <group position={[0, TOP_Y, 0]}>
        <RigidBody ref={top} {...strapBody} type="fixed" />
        {rope.map((ref, i) => (
          <RigidBody key={i} ref={ref} {...strapBody} position={ropeStart(i)}>
            <BallCollider args={[0.1]} />
          </RigidBody>
        ))}

        <RigidBody
          ref={card}
          type={dragging || entering ? 'kinematicPosition' : 'dynamic'}
          canSleep
          colliders={false}
          linearDamping={CARD_LIN_DAMP}
          angularDamping={CARD_ANG_DAMP}
          position={cardStart}
        >
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, CARD_D / 2]} density={0.6} />
          <group
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerDown={onDown}
          >
            {/* card edge */}
            <mesh geometry={geo.body} castShadow>
              <meshStandardMaterial color="#e9e7e2" {...matte} />
            </mesh>
            {/* engineer side */}
            <mesh geometry={geo.face} position={[0, 0, CARD_D / 2 + 0.001]}>
              <meshPhysicalMaterial map={tex.dev} {...finish} />
            </mesh>
            {winter && <Snow />}
            <mesh geometry={geo.face} position={[0, 0, CARD_D / 2 + 0.0015]} material={shine.front} />
            {/* photographer side */}
            <mesh geometry={geo.face} position={[0, 0, -CARD_D / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
              <meshPhysicalMaterial map={tex.frame} {...finish} />
            </mesh>
            <mesh geometry={geo.face} position={[0, 0, -CARD_D / 2 - 0.0015]} rotation={[0, Math.PI, 0]} material={shine.back} />
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
            <mesh position={[0, CARD_H / 2 + 0.04, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
              <torusGeometry args={[0.15, 0.022, 12, 32]} />
              <meshStandardMaterial {...metal} />
            </mesh>
            {/* metal clamp the strap is crimped into */}
            <RoundedBox args={[STRAP_W + 0.08, 0.26, 0.09]} radius={0.035} smoothness={3} position={[0, CLAMP_Y, 0]} castShadow>
              <meshStandardMaterial {...metal} />
            </RoundedBox>
            <mesh position={[0, CLAMP_Y - 0.17, 0]}>
              <boxGeometry args={[0.08, 0.1, 0.05]} />
              <meshStandardMaterial {...metal} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      <mesh geometry={ribbon.geometry} frustumCulled={false} castShadow>
        <meshStandardMaterial map={tex.strap.tex} side={THREE.DoubleSide} roughness={0.9} metalness={0} envMapIntensity={0.3} />
      </mesh>
    </>
  );
}
