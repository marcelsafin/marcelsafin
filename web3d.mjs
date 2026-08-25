import * as THREE from "./node_modules/three/build/three.module.js";
import { createCompanion } from "./scripts/asset-studio/studio.mjs";

const canvas = document.getElementById("scene");
const rootEl = document.documentElement;
const toggle = document.getElementById("theme-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0.08, 6.6);
camera.lookAt(0, -0.02, 0);

const key = new THREE.DirectionalLight(0xffffff, 4.2);
key.position.set(-3.2, 4.6, 5.2);
const fill = new THREE.DirectionalLight(0x5f97ff, 3.2);
fill.position.set(4.4, 1.2, 3.6);
const rim = new THREE.DirectionalLight(0xd466ab, 2.8);
rim.position.set(-4, -2.4, -1.6);
const hemi = new THREE.HemisphereLight(0x8b64f6, 0x0d1015, 1.4);
scene.add(key, fill, rim, hemi);

let companion = null;
let apertureBars = [];
let glints = [];

function mountCompanion(dark) {
  const prevRotation = companion ? { x: companion.rotation.x, y: companion.rotation.y } : null;
  if (companion) {
    scene.remove(companion);
  }
  companion = createCompanion(dark);
  companion.scale.setScalar(0.42);
  companion.position.y = -0.1;
  if (prevRotation) {
    companion.rotation.set(prevRotation.x, prevRotation.y, 0);
  }
  scene.add(companion);
  apertureBars = companion.getObjectByName("signal-aperture").children;
  glints = [];
  companion.traverse((node) => {
    if (node.name.endsWith("-glass") || node.geometry?.type === "CapsuleGeometry") {
      glints.push(node);
    }
  });

  key.intensity = dark ? 4.2 : 3.1;
  hemi.color.set(dark ? 0x8b64f6 : 0xffffff);
  hemi.groundColor.set(dark ? 0x0d1015 : 0xcbd5e1);
  hemi.intensity = dark ? 1.4 : 2.2;
}

// Scroll-reveal for content sections (respects reduced-motion via CSS)
const revealTargets = [];
document.querySelectorAll(".content > section").forEach((section) => {
  const items = section.querySelectorAll(".story-item");
  if (items.length) {
    items.forEach((item, i) => {
      item.classList.add("reveal");
      item.style.setProperty("--reveal-delay", `${i * 90}ms`);
      revealTargets.push(item);
    });
  } else {
    section.classList.add("reveal");
    revealTargets.push(section);
  }
});
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
revealTargets.forEach((el) => revealObserver.observe(el));

const pointer = { x: 0, y: 0 };
window.addEventListener("pointermove", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
});

window.addEventListener("scroll", () => {
  const fade = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.85));
  canvas.style.opacity = fade.toFixed(3);
}, { passive: true });

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function applyTheme(theme) {
  const dark = theme === "dark";
  rootEl.dataset.theme = theme;
  mountCompanion(dark);
}

toggle.addEventListener("click", () => {
  const next = rootEl.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("web3d-theme", next);
  applyTheme(next);
});

applyTheme(localStorage.getItem("web3d-theme") ?? "dark");

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  if (companion && !reducedMotion) {
    companion.position.x += (pointer.x * 0.3 - companion.position.x) * 0.05;
    companion.position.y = -0.1 + Math.sin(t * 0.9) * 0.05 - pointer.y * 0.18;
    companion.rotation.y += ((pointer.x * 0.45) - companion.rotation.y) * 0.06;
    companion.rotation.x += ((pointer.y * 0.3 - 0.03) - companion.rotation.x) * 0.06;

    apertureBars.forEach((bar, index) => {
      const pulse = 1 + Math.sin(t * 2.6 + index * 0.9) * 0.22;
      bar.scale.y = pulse;
    });

    glints.forEach((glint, index) => {
      if (glint.material?.emissiveIntensity !== undefined) {
        glint.material.emissiveIntensity = 0.4 + Math.sin(t * 1.8 + index * 1.3) * 0.18;
      }
    });
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
