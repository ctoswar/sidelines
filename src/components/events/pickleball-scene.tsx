"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { scrollBus } from "@/lib/scroll-bus";

// A tiny Three.js diorama for the events hero: two paddles rally a holey
// pickleball over the net, forever. Palette is lifted straight from the
// events-desk theme in globals.css so the canvas reads as part of the page
// rather than a floating game widget. Decorative only — aria-hidden, no
// pointer events, pauses off-screen, and freezes to a single frame when the
// visitor prefers reduced motion.

const INK = 0x17231f;
const ORANGE = 0xef653d;
const ACID = 0xc8ef70;
const CHALK = 0xfdfcf6;

const PERIOD = 2.7; // one full rally exchange, in seconds
const SEGMENTS = [
  // right paddle strikes at t=0, left at t=1.35, and back again
  { from: 0, to: 0.8, curve: new THREE.QuadraticBezierCurve3(v(5.5, 1.2, 0.3), v(0.3, 4.3, 0.5), v(-3.2, 0.56, 0.55)) },
  { from: 0.8, to: 1.35, curve: new THREE.QuadraticBezierCurve3(v(-3.2, 0.56, 0.55), v(-4.6, 1.0, 0.3), v(-5.5, 1.2, -0.3)) },
  { from: 1.35, to: 2.15, curve: new THREE.QuadraticBezierCurve3(v(-5.5, 1.2, -0.3), v(-0.3, 4.3, -0.5), v(3.2, 0.56, -0.55)) },
  { from: 2.15, to: 2.7, curve: new THREE.QuadraticBezierCurve3(v(3.2, 0.56, -0.55), v(4.6, 1.0, -0.3), v(5.5, 1.2, 0.3)) },
] as const;
const BOUNCE_TIMES = [0.8, 2.15];
// Paddle contact moments (right at t=0, left at t=1.35) and how long the
// camera "hit punch" takes to settle afterwards.
const STRIKE_TIMES = [0, 1.35];
const PUNCH_DECAY = 0.34;

function v(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z);
}

function easeInCubic(u: number) {
  return u * u * u;
}

function easeOutCubic(u: number) {
  return 1 - Math.pow(1 - u, 3);
}

/** Dotted skin for the ball — dark holes on the desk orange, reused as a bump map. */
function makeBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ef653d";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "rgba(23, 35, 31, 0.88)";
  const rows = 7;
  const cols = 13;
  for (let r = 0; r < rows; r += 1) {
    const offset = r % 2 ? 0.5 : 0;
    for (let c = 0; c < cols; c += 1) {
      const u = ((c + offset) / cols) * canvas.width;
      const y = ((r + 0.5) / rows) * canvas.height;
      g.beginPath();
      g.arc(u, y, 8.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Transparent grid used for the net mesh. */
function makeNetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.strokeStyle = "rgba(23, 35, 31, 0.7)";
  g.lineWidth = 3;
  for (let x = 0; x <= 128; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 64);
    g.stroke();
  }
  for (let y = 0; y <= 64; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  return texture;
}

function roundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** The scorebug's rally counter — polls the scene's strike channel. */
function RallyBadge() {
  // Seeded mid-rally so the frozen diorama matches a "mid-rally" bug; it
  // counts exchanges of the hero animation, not live matches on the site.
  const [count, setCount] = useState(41);
  useEffect(() => {
    let seen = scrollBus.rallyCount;
    const id = window.setInterval(() => {
      if (scrollBus.rallyCount !== seen) {
        seen = scrollBus.rallyCount;
        setCount(seen);
      }
    }, 240);
    return () => window.clearInterval(id);
  }, []);
  // 41 doubles as the reduced-motion value: the racy part never runs, so the
  // frozen diorama matches a "mid-rally" bug.
  return <span className="rally-chip-count">{count}</span>;
}

export function PickleballScene() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const disposables: Array<{ dispose(): void }> = [];
    const track = <T extends { dispose(): void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Soft cast shadows ground every object on the court — the single biggest
    // jump from "flat diagram" to "lit diorama".
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    wrapper.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // A 3/4 broadcast angle from an elevated near corner, tuned for the tall
    // right-panel framing: court anchored low, sky fading into the paper.
    const camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 80);
    const CAMERA_BASE = new THREE.Vector3(6.2, 5.2, 15.8);
    const LOOK_AT = new THREE.Vector3(0.2, 1.0, -0.1);
    camera.position.copy(CAMERA_BASE);
    camera.lookAt(LOOK_AT);

    scene.add(new THREE.HemisphereLight(0xfffdf4, 0x9c9686, 1.0));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
    sun.position.set(6, 14, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 44;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffd9b0, 0.7);
    rim.position.set(-9, 5, -7);
    scene.add(rim);

    // ── Court ────────────────────────────────────────────────────────────
    const chalkMat = track(new THREE.MeshStandardMaterial({ color: CHALK, roughness: 0.9 }));
    // Soft blob shadow instead of an apron slab — keeps the "sticker on paper" look.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sg = shadowCanvas.getContext("2d")!;
    const fade = sg.createRadialGradient(128, 128, 20, 128, 128, 128);
    fade.addColorStop(0, "rgba(23, 35, 31, 0.34)");
    fade.addColorStop(0.7, "rgba(23, 35, 31, 0.16)");
    fade.addColorStop(1, "rgba(23, 35, 31, 0)");
    sg.fillStyle = fade;
    sg.fillRect(0, 0, 256, 256);
    const courtShadow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(20.5, 11.5)),
      track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(shadowCanvas)), transparent: true, depthWrite: false })),
    );
    courtShadow.rotation.x = -Math.PI / 2;
    courtShadow.position.y = 0.01;
    scene.add(courtShadow);

    const slab = new THREE.Mesh(track(new THREE.BoxGeometry(15.6, 0.12, 8)), track(new THREE.MeshStandardMaterial({ color: ACID, roughness: 0.95 })));
    slab.position.y = 0.08;
    slab.receiveShadow = true;
    scene.add(slab);

    // Darker non-volley "kitchen" zones either side of the net — real courts
    // paint them a different colour, and it gives the flat slab some depth.
    const kitchenMat = track(new THREE.MeshStandardMaterial({ color: 0x9fce4d, roughness: 0.95 }));
    for (const x of [-1.25, 1.25]) {
      const kitchen = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 0.13, 8)), kitchenMat);
      kitchen.position.set(x, 0.075, 0);
      kitchen.receiveShadow = true;
      scene.add(kitchen);
    }

    const courtLine = (width: number, depth: number, x: number, z: number) => {
      const line = new THREE.Mesh(track(new THREE.BoxGeometry(width, 0.015, depth)), chalkMat);
      line.position.set(x, 0.15, z);
      line.receiveShadow = true;
      scene.add(line);
    };
    courtLine(15.6, 0.1, 0, 3.95);
    courtLine(15.6, 0.1, 0, -3.95);
    courtLine(0.1, 8, 7.75, 0);
    courtLine(0.1, 8, -7.75, 0);
    courtLine(0.1, 8, 2.5, 0); // kitchen lines
    courtLine(0.1, 8, -2.5, 0);
    courtLine(5.25, 0.1, 5.125, 0); // service centre lines
    courtLine(5.25, 0.1, -5.125, 0);

    // ── Net ──────────────────────────────────────────────────────────────
    const inkMat = track(new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 }));
    const postGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 2.0, 16));
    for (const z of [-4.15, 4.15]) {
      const post = new THREE.Mesh(postGeo, inkMat);
      post.position.set(0, 1.0, z);
      post.castShadow = true;
      scene.add(post);
    }
    const netMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(8.3, 1.75)),
      track(new THREE.MeshBasicMaterial({ map: track(makeNetTexture()), transparent: true, side: THREE.DoubleSide, opacity: 0.95 })),
    );
    netMesh.rotation.y = Math.PI / 2;
    netMesh.position.set(0, 0.88, 0);
    scene.add(netMesh);
    const netBand = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.16, 8.5)), track(new THREE.MeshStandardMaterial({ color: CHALK, roughness: 0.6 })));
    netBand.position.set(0, 1.78, 0);
    netBand.castShadow = true;
    scene.add(netBand);

    // ── Paddles ──────────────────────────────────────────────────────────
    const buildPaddle = (side: 1 | -1) => {
      const swing = new THREE.Group(); // pivot at the grip — swings like a pendulum
      const face = new THREE.Group();
      // Turn each blade partway toward the viewer, not flat across the net —
      // a full -90° yaw presents the camera with the thin edge (a "stick").
      face.rotation.y = side * -0.92;
      swing.add(face);
      const blade = new THREE.Mesh(
        track(new THREE.ExtrudeGeometry(roundedRectShape(1.4, 1.85, 0.6), { depth: 0.11, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 14 })),
        [track(new THREE.MeshStandardMaterial({ color: INK, roughness: 0.72 })), track(new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.55 }))],
      );
      blade.geometry.translate(0, 0, -0.055);
      blade.position.y = 1.95;
      blade.castShadow = true;
      const handle = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.9, 0.16)), inkMat);
      handle.position.y = 0.98;
      handle.castShadow = true;
      const grip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 12)), track(new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.7 })));
      grip.position.y = 0.58;
      grip.castShadow = true;
      face.add(blade, handle, grip);
      swing.position.set(side * 6.9, 0, 0);
      scene.add(swing);
      return swing;
    };
    const paddleRight = buildPaddle(1);
    const paddleLeft = buildPaddle(-1);

    // ── Ball ─────────────────────────────────────────────────────────────
    const ballTexture = track(makeBallTexture());
    const ball = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.55, 48, 32)),
      track(new THREE.MeshStandardMaterial({ map: ballTexture, bumpMap: ballTexture, bumpScale: 0.7, roughness: 0.5 })),
    );
    ball.castShadow = true;
    scene.add(ball);

    const shadow = new THREE.Mesh(
      track(new THREE.CircleGeometry(0.6, 32)),
      track(new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.28, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // Motion trail: a fading string of ghosts behind the ball sells the flight
    // even in a still frame.
    const TRAIL = 10;
    const trailGeo = track(new THREE.SphereGeometry(0.55, 12, 10));
    const trail: THREE.Mesh[] = [];
    for (let i = 0; i < TRAIL; i += 1) {
      const ghost = new THREE.Mesh(
        trailGeo,
        track(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0, depthWrite: false })),
      );
      scene.add(ghost);
      trail.push(ghost);
    }
    const trailPositions: THREE.Vector3[] = Array.from({ length: TRAIL }, (_, i) => {
      // Seed the trail spread behind the ball's reduced-motion rest point (t=1.0)
      // so a frozen frame still shows a proper streak.
      const seed = 1.0 - i * 0.045;
      const seg = SEGMENTS.find((s) => seed >= s.from && seed < s.to) ?? SEGMENTS[0];
      return seg.curve.getPoint(THREE.MathUtils.clamp((seed - seg.from) / (seg.to - seg.from), 0, 1));
    });

    // ── Telegraphed play (dashed arcs + court markers) ───────────────────
    const dashedArc = (curve: THREE.QuadraticBezierCurve3) => {
      const line = new THREE.Line(
        track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48))),
        track(new THREE.LineDashedMaterial({ color: INK, transparent: true, opacity: 0.28, dashSize: 0.26, gapSize: 0.2 })),
      );
      line.computeLineDistances();
      scene.add(line);
    };
    dashedArc(SEGMENTS[0].curve);
    dashedArc(SEGMENTS[2].curve);
    const markerMat = track(new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.3, depthWrite: false }));
    const markerGeo = track(new THREE.RingGeometry(0.17, 0.22, 32));
    for (const [x, z] of [[5.5, -0.3], [-5.5, 0.3], [3.2, 0.55], [-3.2, -0.55]] as const) {
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.16, z);
      scene.add(marker);
    }

    // ── Bounce puffs ─────────────────────────────────────────────────────
    const puffs = [
      { mesh: null as THREE.Mesh | null, x: -3.2, z: 0.55, at: BOUNCE_TIMES[0] },
      { mesh: null as THREE.Mesh | null, x: 3.2, z: -0.55, at: BOUNCE_TIMES[1] },
    ];
    const puffGeo = track(new THREE.RingGeometry(0.26, 0.32, 40));
    for (const puff of puffs) {
      const mesh = new THREE.Mesh(puffGeo, track(new THREE.MeshBasicMaterial({ color: CHALK, transparent: true, opacity: 0, depthWrite: false })));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(puff.x, 0.17, puff.z);
      scene.add(mesh);
      puff.mesh = mesh;
    }

    // ── Hit flashes (paddle contact) ─────────────────────────────────────
    // A quick orange wavefront ring at each contact point, so the strike
    // triggers a visible energy burst as the ball leaves the paddle.
    const hitGeo = track(new THREE.RingGeometry(0.3, 0.38, 40));
    const hitFlashes = [
      { at: STRIKE_TIMES[0], x: 5.5, y: 1.2, z: 0.3 },
      { at: STRIKE_TIMES[1], x: -5.5, y: 1.2, z: -0.3 },
    ].map((hit) => {
      const mesh = new THREE.Mesh(
        hitGeo,
        track(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0, depthWrite: false })),
      );
      mesh.position.set(hit.x, hit.y, hit.z);
      scene.add(mesh);
      return { at: hit.at, mesh };
    });

    // ── Rally animation ──────────────────────────────────────────────────
    const paddleAngle = (t: number, side: 1 | -1) => {
      // Contact happens at the end of each swing; recover, then idle-bob.
      const contact = side === 1 ? 0 : 1.35; // right paddle strikes as the loop wraps
      const swingStart = (contact === 0 ? PERIOD : contact) - 0.5;
      const idle = side === 1 ? -0.08 : 0.08;
      const bob = Math.sin(t * 2 + side) * 0.035;
      const through = side === 1 ? 0.85 : -0.85;
      if (t >= swingStart) {
        const u = (t - swingStart) / 0.5;
        const back = side === 1 ? -0.7 : 0.7;
        return back + (through - back) * easeInCubic(u);
      }
      if (t >= contact && t <= contact + 0.5) {
        const u = (t - contact) / 0.5;
        return through + (idle - through) * easeOutCubic(u);
      }
      return idle + bob;
    };

    const ballPoint = new THREE.Vector3();
    const updateRally = (t: number, dt: number, punch: number) => {
      const seg = SEGMENTS.find((s) => t >= s.from && t < s.to) ?? SEGMENTS[SEGMENTS.length - 1];
      const u = THREE.MathUtils.clamp((t - seg.from) / (seg.to - seg.from), 0, 1);
      seg.curve.getPoint(u, ballPoint);
      ball.position.copy(ballPoint);

      // Squash on the bounce frames, round everywhere else.
      ball.scale.set(1, 1, 1);
      for (const bt of BOUNCE_TIMES) {
        const since = Math.abs(t - bt);
        if (since < 0.07) {
          const k = 1 - since / 0.07;
          ball.scale.set(1 + 0.22 * k, 1 - 0.3 * k, 1 + 0.22 * k);
        }
      }
      // Spin spikes on every strike and settles with the punch — the hole
      // pattern whips around the instant the ball leaves a paddle, then eases.
      const spin = 1 + punch * 2.4;
      ball.rotation.x += 0.7 * dt * spin;
      ball.rotation.z += (t < 1.35 ? 4.4 : -4.4) * dt * spin;

      shadow.position.set(ballPoint.x, 0.16, ballPoint.z);
      const air = THREE.MathUtils.clamp(1 - (ballPoint.y - 0.7) / 3.0, 0, 1);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.22 * air;
      const shadowScale = 0.7 + (1 - air) * 0.6;
      shadow.scale.set(shadowScale, shadowScale, 1);

      // Shift the motion trail back one slot and park ghosts along it. Skipped
      // on the frozen reduced-motion frame so the seeded streak survives.
      if (dt > 0) {
        for (let i = TRAIL - 1; i > 0; i -= 1) trailPositions[i].copy(trailPositions[i - 1]);
        trailPositions[0].copy(ballPoint);
      }
      for (let i = 0; i < TRAIL; i += 1) {
        trail[i].position.copy(trailPositions[i]);
        const fade = 1 - i / TRAIL;
        (trail[i].material as THREE.MeshBasicMaterial).opacity = 0.26 * fade * fade;
        trail[i].scale.setScalar(0.35 + 0.65 * fade);
      }

      for (const puff of puffs) {
        const material = puff.mesh!.material as THREE.MeshBasicMaterial;
        const age = (t - puff.at + PERIOD) % PERIOD;
        if (age < 0.38) {
          const k = age / 0.38;
          puff.mesh!.scale.setScalar(0.4 + k * 2.4);
          material.opacity = 0.5 * (1 - k);
        } else {
          material.opacity = 0;
        }
      }

      for (const flash of hitFlashes) {
        const material = flash.mesh.material as THREE.MeshBasicMaterial;
        const age = (t - flash.at + PERIOD) % PERIOD;
        if (age < 0.26) {
          const k = age / 0.26;
          flash.mesh.scale.setScalar(0.5 + k * 2.6);
          material.opacity = 0.6 * (1 - k);
        } else {
          material.opacity = 0;
        }
      }

      paddleRight.rotation.z = paddleAngle(t, 1);
      paddleLeft.rotation.z = paddleAngle(t, -1);
    };

    // ── Parallax + lifecycle ─────────────────────────────────────────────
    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = Math.min(48, 40 + Math.max(0, 1.45 - camera.aspect) * 24);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    resize();

    let inView = true;
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { rootMargin: "80px" },
    );
    intersectionObserver.observe(wrapper);

    // Smoothed camera base, kept separate from the final camera position so
    // the contact punch can be applied directly without feeding back into
    // the smoothing loop.
    const camSmooth = CAMERA_BASE.clone();

    const renderFrame = (t: number, dt: number) => {
      // Nearest paddle strike inside the decay window; the punch curve snaps
      // in hard and tails off quadratically.
      let punch = 0;
      let punchSide = 1;
      for (const s of STRIKE_TIMES) {
        const age = (t - s + PERIOD) % PERIOD;
        if (age < PUNCH_DECAY) {
          const k = Math.pow(1 - age / PUNCH_DECAY, 2);
          if (k > punch) {
            punch = k;
            punchSide = s === 0 ? 1 : -1;
          }
        }
      }
      updateRally(t, dt, punch);
      // Scroll feedback from Lenis/ScrollTrigger: the diorama turns away and
      // recedes as the hero leaves, and the canvas fades into the paper.
      const progress = scrollBus.heroProgress;
      scene.rotation.y = progress * 0.28;
      scene.position.y = progress * 1.1;
      camSmooth.x += (CAMERA_BASE.x + pointerX * 0.8 - camSmooth.x) * 0.05;
      camSmooth.y += (CAMERA_BASE.y - pointerY * 0.4 - camSmooth.y) * 0.05;
      camSmooth.z += (CAMERA_BASE.z + progress * 2.4 - camSmooth.z) * 0.08;
      // Hit punch: a quick shift toward the striker and dolly-in, applied
      // straight on top of the smoothed base so it reads as a snap, not a drift.
      camera.position.copy(camSmooth);
      camera.position.x += punchSide * punch * 0.35;
      camera.position.z -= punch * 0.5;
      camera.lookAt(LOOK_AT.x + punchSide * punch * 0.4, LOOK_AT.y + punch * 0.12, LOOK_AT.z);
      renderer.domElement.style.opacity = String(THREE.MathUtils.clamp(1 - progress * 1.15, 0, 1));
      renderer.render(scene, camera);
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let elapsed = 0.9; // start mid-rally so the first paint already has a ball in flight
    if (reducedMotion) {
      renderFrame(1.0, 0);
    } else {
      const clock = new THREE.Clock();
      const tick = () => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!inView || document.hidden) return;
        // Rally tempo follows scroll velocity (Lenis), decaying back to match pace.
        const boost = 1 + Math.min(Math.abs(scrollBus.velocity) / 16, 2.4);
        scrollBus.velocity *= 0.92;
        const next = (elapsed + dt * boost) % PERIOD;
        // A strike is any crossing of a half-period boundary (t=0 / t=1.35):
        // it feeds both the scorebug counter and, in dev, a console beacon so
        // screenshot tooling can time a capture to the hit flash.
        const struck = Math.floor(next / (PERIOD / 2)) !== Math.floor(elapsed / (PERIOD / 2));
        if (struck) {
          scrollBus.rallyCount += 1;
          if (process.env.NODE_ENV === "development") console.log("[scene] strike");
        }
        elapsed = next;
        renderFrame(elapsed, dt);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="events-hero-scene" aria-hidden="true">
      <div className="rally-chip">
        <span className="rally-chip-dot" />
        Rally
        <RallyBadge />
      </div>
    </div>
  );
}
