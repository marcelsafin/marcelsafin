import * as THREE from "../../node_modules/three/build/three.module.js";
import {
  HERO_LAYOUTS,
  TIMELINE_LAYOUTS,
  equalizedRightTitleWidth,
  wrapWords,
} from "./layout.mjs";
import {
  ASSET_TYPOGRAPHY,
  RASTER_ACCENTS,
  RASTER_THEMES,
} from "./theme.mjs";

const PALETTE = {
  dark: RASTER_THEMES.dark,
  light: RASTER_THEMES.light,
  violet: RASTER_ACCENTS.violet,
  lilac: RASTER_ACCENTS.lilac,
  violetDeep: RASTER_ACCENTS.violetDeep,
  violetInk: RASTER_ACCENTS.violetInk,
};

const MONO =
  '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Bundled OFL font keeps typography identical across macOS and CI renders.
await Promise.all(
  [
    ["Regular", "400"],
    ["SemiBold", "600"],
    ["Bold", "700"],
  ].map(async ([name, weight]) => {
    const face = new FontFace(
      "IBM Plex Mono",
      `url(${new URL(`./fonts/IBMPlexMono-${name}.woff2`, import.meta.url)})`,
      { weight },
    );
    document.fonts.add(await face.load());
  }),
);

function roundedShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function extrudedRoundedBox(width, height, depth, radius, material) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedShape(width, height, radius),
    {
      depth,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: Math.min(radius * 0.18, 0.08),
      bevelThickness: 0.06,
      curveSegments: 16,
    },
  );
  geometry.center();
  return new THREE.Mesh(geometry, material);
}

function material(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.28,
    metalness: options.metalness ?? 0.18,
    clearcoat: options.clearcoat ?? 0.62,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.2,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
}

export function createCompanion(dark) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const root = new THREE.Group();
  root.name = "companion";

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.72, 96, 64),
    material(PALETTE.violetDeep, {
      roughness: 0.2,
      metalness: 0.36,
      clearcoat: 0.9,
    }),
  );
  shell.name = "shell";
  shell.scale.set(1, 0.79, 0.48);
  shell.position.z = -0.24;
  root.add(shell);

  const lowerShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.48, 96, 64),
    material(theme.surface, {
      roughness: 0.24,
      metalness: dark ? 0.45 : 0.18,
      clearcoat: 0.8,
    }),
  );
  lowerShell.name = "faceplate";
  lowerShell.scale.set(1, 0.69, 0.34);
  lowerShell.position.set(0, -0.02, 0.24);
  root.add(lowerShell);

  for (const side of [-1, 1]) {
    const module = extrudedRoundedBox(
      1.12,
      0.88,
      0.34,
      0.26,
      material(side < 0 ? PALETTE.violet : PALETTE.lilac, {
        roughness: 0.18,
        metalness: 0.38,
        clearcoat: 0.95,
      }),
    );
    module.name = side < 0 ? "lens-left" : "lens-right";
    module.position.set(side * 0.66, 0.22, 0.58);
    root.add(module);

    const glass = extrudedRoundedBox(
      0.72,
      0.52,
      0.22,
      0.18,
      material(dark ? "#0f0f0f" : "#fafafa", {
        roughness: 0.08,
        metalness: 0.04,
        clearcoat: 1,
        emissive: side < 0 ? PALETTE.violet : PALETTE.lilac,
        emissiveIntensity: dark ? 0.52 : 0.24,
        opacity: 0.92,
      }),
    );
    glass.name = `${module.name}-glass`;
    glass.position.set(side * 0.66, 0.22, 0.79);
    root.add(glass);

    const glint = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.28, 8, 18),
      material("#fafafa", {
        roughness: 0.06,
        metalness: 0,
        emissive: "#fafafa",
        emissiveIntensity: 0.55,
      }),
    );
    glint.position.set(side * 0.82, 0.33, 0.94);
    glint.rotation.z = 0.72;
    root.add(glint);
  }

  const signal = new THREE.Group();
  signal.name = "signal-aperture";
  for (const [x, height] of [[-0.2, 0.3], [0, 0.42], [0.2, 0.3]]) {
    const bar = extrudedRoundedBox(
      0.1,
      height,
      0.14,
      0.05,
      material(theme.foreground, {
        roughness: 0.22,
        emissive: PALETTE.violet,
        emissiveIntensity: dark ? 0.18 : 0.04,
      }),
    );
    bar.position.set(x, -0.48, 0.72);
    signal.add(bar);
  }
  root.add(signal);

  const sideMaterial = material(PALETTE.violetInk, {
    roughness: 0.24,
    metalness: 0.34,
    clearcoat: 0.8,
  });
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 48, 32),
      sideMaterial,
    );
    ear.name = side < 0 ? "side-left" : "side-right";
    ear.scale.set(0.54, 1, 0.44);
    ear.position.set(side * 1.62, -0.04, -0.02);
    root.add(ear);
  }

  root.rotation.x = -0.03;
  return root;
}

function createRenderer(width, height, alpha) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setClearColor(0x000000, alpha ? 0 : 1);
  return { canvas, renderer };
}

function addStudioLights(scene, dark) {
  const key = new THREE.DirectionalLight(0xffffff, dark ? 4.2 : 3.1);
  key.position.set(-3.2, 4.6, 5.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa78bfa, 3.2);
  fill.position.set(4.4, 1.2, 3.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x7c3aed, 2.8);
  rim.position.set(-4, -2.4, -1.6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(
    dark ? 0x8b5cf6 : 0xffffff,
    dark ? 0x050505 : 0xd4d4d4,
    dark ? 1.4 : 2.2,
  ));
}

function renderCompanion(dark) {
  const { canvas, renderer } = createRenderer(1600, 1600, true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.08, 6.6);
  camera.lookAt(0, -0.02, 0);

  addStudioLights(scene, dark);

  scene.add(createCompanion(dark));
  renderer.render(scene, camera);
  const result = canvas.toDataURL("image/png");
  renderer.dispose();
  return result;
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext("2d") };
}

function fitLetterSpacing(context, text, targetWidth) {
  let low = -8;
  let high = 16;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const spacing = (low + high) / 2;
    context.letterSpacing = `${spacing}px`;
    if (context.measureText(text).width < targetWidth) {
      low = spacing;
    } else {
      high = spacing;
    }
  }
  context.letterSpacing = `${(low + high) / 2}px`;
}

function drawBase(context, width, height, dark) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  context.fillStyle = theme.background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.strokeRect(24, 24, width - 48, height - 48);

  context.save();
  context.globalAlpha = 0.55;
  context.lineWidth = 1;
  context.beginPath();
  for (const x of [44, width - 44]) {
    context.moveTo(x, 24);
    context.lineTo(x, height - 24);
  }
  context.stroke();
  context.restore();
}

function drawCornerTicks(context, box, color) {
  const tick = 18;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  for (const [cornerX, cornerY, directionX, directionY] of [
    [box.x, box.y, 1, 1],
    [box.x + box.width, box.y, -1, 1],
    [box.x, box.y + box.height, 1, -1],
    [box.x + box.width, box.y + box.height, -1, -1],
  ]) {
    context.moveTo(cornerX + directionX * tick, cornerY);
    context.lineTo(cornerX, cornerY);
    context.lineTo(cornerX, cornerY + directionY * tick);
  }
  context.stroke();
  context.restore();
}

function drawMicroLabel(context, { x, y, number, label, size, dark, tracking }) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  context.save();
  context.textAlign = "left";
  context.font = `700 ${size}px ${MONO}`;
  context.letterSpacing = tracking ?? "2px";
  context.fillStyle = theme.accent;
  context.fillText(number, x, y);
  const numberWidth = context.measureText(`${number} `).width;
  context.fillStyle = theme.muted;
  context.fillText(label, x + numberWidth, y);
  context.restore();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode companion render"));
    image.src = dataUrl;
  });
}

function drawMirroredSignals(context, width, dark, mobile) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const fadeOut = dark ? "rgba(192,132,252,0)" : "rgba(124,58,237,0)";
  const inset = mobile ? 54 : 54;
  const reach = mobile ? 180 : 150;
  const startY = mobile ? 300 : 286;
  const stepY = mobile ? 54 : 38;

  context.save();
  context.fillStyle = theme.border;
  context.lineWidth = mobile ? 3 : 2;
  for (let index = 0; index < 3; index += 1) {
    const y = startY + index * stepY;
    const offset = index * (mobile ? 18 : 12);
    const endLeft = inset + reach + offset;
    const endRight = width - inset - reach - offset;

    const signalGradient = context.createLinearGradient(inset, y, endLeft, y);
    signalGradient.addColorStop(0, theme.border);
    signalGradient.addColorStop(1, fadeOut);
    context.strokeStyle = signalGradient;
    context.beginPath();
    context.moveTo(inset, y);
    context.lineTo(endLeft, y);
    context.stroke();

    const mirroredGradient = context.createLinearGradient(width - inset, y, endRight, y);
    mirroredGradient.addColorStop(0, theme.border);
    mirroredGradient.addColorStop(1, fadeOut);
    context.strokeStyle = mirroredGradient;
    context.beginPath();
    context.moveTo(width - inset, y);
    context.lineTo(endRight, y);
    context.stroke();

    const tick = mobile ? 9 : 7;
    for (const x of [inset, width - inset]) {
      context.fillRect(x - tick / 2, y - tick / 2, tick, tick);
    }
  }
  context.restore();
}

function drawAccentEdge(context, card, dark) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  context.save();
  context.strokeStyle = theme.accent;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(card.x, card.y + 1);
  context.lineTo(card.x + 180, card.y + 1);
  context.stroke();
  context.restore();
}

function drawTimelineSpine(context, width, dark) {
  const solid = dark ? "rgba(192,132,252,.4)" : "rgba(124,58,237,.35)";
  const clear = dark ? "rgba(192,132,252,0)" : "rgba(124,58,237,0)";
  const gradient = context.createLinearGradient(width / 2, 112, width / 2, 732);
  gradient.addColorStop(0, clear);
  gradient.addColorStop(0.3, solid);
  gradient.addColorStop(0.7, solid);
  gradient.addColorStop(1, clear);
  context.save();
  context.strokeStyle = gradient;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width / 2, 116);
  context.lineTo(width / 2, 728);
  context.stroke();
  context.restore();
}

function drawHeroBackdrop(context, dark, mobile) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1120 : 760;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const layout = mobile ? HERO_LAYOUTS.mobile : HERO_LAYOUTS.desktop;
  drawBase(context, width, height, dark);

  drawMicroLabel(context, {
    x: mobile ? 56 : 58,
    y: mobile ? 72 : 62,
    number: "01 /",
    label: "BUILT WITH GITHUB COPILOT",
    size: mobile
      ? ASSET_TYPOGRAPHY.hero.mobile.attribution
      : ASSET_TYPOGRAPHY.hero.desktop.attribution,
    dark,
    tracking: mobile ? "3px" : "2px",
  });

  context.fillStyle = theme.foreground;
  if (mobile) {
    context.font = `700 82px ${MONO}`;
    context.letterSpacing = "-3px";
    context.textAlign = "center";
    context.fillText("MARSEL SAFIN", width / 2, 182);
  } else {
    context.font = `700 80px ${MONO}`;
    context.letterSpacing = "-2px";
    context.textAlign = "left";
    context.fillText("MARSEL", layout.leftTitle.x, 170);
    const rightAnchor = layout.rightTitle.x + layout.rightTitle.width;
    const rightWidth = equalizedRightTitleWidth({
      leftX: layout.leftTitle.x,
      leftWidth: context.measureText("MARSEL").width,
      companion: layout.companion,
      rightAnchor,
    });
    context.textAlign = "right";
    fitLetterSpacing(context, "SAFIN", rightWidth);
    context.fillText(
      "SAFIN",
      rightAnchor,
      170,
    );
  }

  drawMirroredSignals(context, width, dark, mobile);

  const cell = layout.blurField;
  context.fillStyle = theme.surface;
  context.fillRect(cell.x, cell.y, cell.width, cell.height);
  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.strokeRect(cell.x, cell.y, cell.width, cell.height);
  drawCornerTicks(context, cell, theme.accent);
}

function drawHeroCard(context, dark, mobile) {
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const layout = mobile ? HERO_LAYOUTS.mobile : HERO_LAYOUTS.desktop;
  const card = layout.originCard;
  context.fillStyle = theme.surface;
  context.fillRect(card.x, card.y, card.width, card.height);
  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.strokeRect(card.x, card.y, card.width, card.height);
  drawAccentEdge(context, card, dark);

  context.textAlign = "left";
  context.fillStyle = theme.accent;
  context.font = `700 ${
    mobile
      ? ASSET_TYPOGRAPHY.hero.mobile.railLabel
      : ASSET_TYPOGRAPHY.hero.desktop.railLabel
  }px ${MONO}`;
  context.letterSpacing = "2px";
  context.fillText(
    "AI-FIRST DEVELOPMENT",
    card.x + 34,
    card.y + (mobile ? 52 : 36),
  );
  context.fillStyle = theme.foreground;
  context.font = `600 ${mobile ? 34 : 24}px ${MONO}`;
  context.letterSpacing = "0px";
  context.fillText(
    "Systems · Agents · Graphs · Curiosity",
    card.x + 34,
    card.y + (mobile ? 112 : 72),
  );
}

async function renderHero(dark, mobile, companionDataUrl) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1120 : 760;
  const layout = mobile ? HERO_LAYOUTS.mobile : HERO_LAYOUTS.desktop;
  const { canvas, context } = makeCanvas(width, height);
  drawHeroBackdrop(context, dark, mobile);

  const companion = await loadImage(companionDataUrl);
  context.drawImage(
    companion,
    layout.companion.x,
    layout.companion.y,
    layout.companion.width,
    layout.companion.height,
  );

  drawHeroCard(context, dark, mobile);
  return canvas.toDataURL("image/png");
}

function createCompanionAnimationScene(dark) {
  const { canvas, renderer } = createRenderer(1600, 1600, true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.08, 6.6);
  camera.lookAt(0, -0.02, 0);

  addStudioLights(scene, dark);

  const companion = createCompanion(dark);
  scene.add(companion);
  const apertureBars = companion.getObjectByName("signal-aperture").children;
  const glints = [];
  companion.traverse((node) => {
    if (node.name.endsWith("-glass") || node.geometry?.type === "CapsuleGeometry") {
      glints.push(node);
    }
  });

  return { canvas, renderer, scene, camera, companion, apertureBars, glints };
}

// Loop-perfect web3d motion: 1 bob, 2 glint, and 3 aperture cycles per loop.
function renderHeroAnimation({ dark, frames }) {
  const width = 1200;
  const height = 760;
  const layout = HERO_LAYOUTS.desktop;

  const backdrop = makeCanvas(width, height);
  drawHeroBackdrop(backdrop.context, dark, false);
  const cardOverlay = makeCanvas(width, height);
  drawHeroCard(cardOverlay.context, dark, false);

  const stage = createCompanionAnimationScene(dark);
  const { canvas: frameCanvas, context } = makeCanvas(width, height);
  const output = [];

  for (let index = 0; index < frames; index += 1) {
    const phase = (Math.PI * 2 * index) / frames;
    stage.companion.position.y = Math.sin(phase) * 0.12;
    stage.apertureBars.forEach((bar, barIndex) => {
      bar.scale.y = 1 + Math.sin(phase * 3 + barIndex * 0.9) * 0.22;
    });
    stage.glints.forEach((glint, glintIndex) => {
      if (glint.material?.emissiveIntensity !== undefined) {
        glint.material.emissiveIntensity =
          0.4 + Math.sin(phase * 2 + glintIndex * 1.3) * 0.18;
      }
    });
    stage.renderer.render(stage.scene, stage.camera);

    context.clearRect(0, 0, width, height);
    context.drawImage(backdrop.canvas, 0, 0);
    context.drawImage(
      stage.canvas,
      layout.companion.x,
      layout.companion.y,
      layout.companion.width,
      layout.companion.height,
    );
    context.drawImage(cardOverlay.canvas, 0, 0);
    output.push(frameCanvas.toDataURL("image/png"));
  }

  stage.renderer.dispose();
  return output;
}

function renderTimeline(dark, mobile, story) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1160 : 820;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const mobileLayout = TIMELINE_LAYOUTS.mobile;
  const { canvas, context } = makeCanvas(width, height);
  drawBase(context, width, height, dark);

  context.fillStyle = theme.foreground;
  context.font = `700 ${mobile ? 44 : 30}px ${MONO}`;
  context.textAlign = "left";
  context.fillText(
    "Origin story",
    mobile ? mobileLayout.title.x : 64,
    mobile ? mobileLayout.title.baseline : 68,
  );
  context.fillStyle = theme.muted;
  context.font = `700 ${
    mobile
      ? ASSET_TYPOGRAPHY.timeline.mobile.eyebrow
      : ASSET_TYPOGRAPHY.timeline.desktop.eyebrow
  }px ${MONO}`;
  context.textAlign = "right";
  context.fillText(
    "FOUR SIGNALS / ONE DIRECTION",
    mobile ? mobileLayout.eyebrow.x + mobileLayout.eyebrow.width : width - 64,
    mobile ? mobileLayout.eyebrow.baseline : 66,
  );

  const years = ["2023", "2024", "2025", "NOW"];
  const labels = [
    "01 / CURIOSITY",
    "02 / SOFTWARE",
    "03 / AI SYSTEMS",
    "04 / FOUNDATIONS",
  ];
  const panels = mobile
    ? Array.from({ length: 4 }, (_, index) => ({
        ...mobileLayout.firstPanel,
        y: mobileLayout.firstPanel.y + index * mobileLayout.panelStep,
      }))
    : [
        { x: 64, y: 112, width: 520, height: 294 },
        { x: 616, y: 112, width: 520, height: 294 },
        { x: 64, y: 438, width: 520, height: 294 },
        { x: 616, y: 438, width: 520, height: 294 },
      ];

  if (!mobile) {
    drawTimelineSpine(context, width, dark);
  }

  panels.forEach((panel, index) => {
    context.fillStyle = theme.surface;
    context.fillRect(panel.x, panel.y, panel.width, panel.height);
    context.strokeStyle = theme.border;
    context.lineWidth = 2;
    context.strokeRect(panel.x, panel.y, panel.width, panel.height);

    context.fillStyle = theme.accent;
    context.fillRect(panel.x + 30, panel.y + 30, 14, 14);

    context.textAlign = "left";
    context.fillStyle = theme.muted;
    context.font = `700 ${
      mobile
        ? ASSET_TYPOGRAPHY.timeline.mobile.label
        : ASSET_TYPOGRAPHY.timeline.desktop.label
    }px ${MONO}`;
    context.fillText(labels[index], panel.x + 66, panel.y + 47);
    context.fillStyle = theme.foreground;
    context.font = `700 ${mobile ? 54 : 42}px ${MONO}`;
    context.fillText(years[index], panel.x + 34, panel.y + (mobile ? 112 : 116));

    context.font = `600 ${
      mobile
        ? ASSET_TYPOGRAPHY.timeline.mobile.title
        : ASSET_TYPOGRAPHY.timeline.desktop.title
    }px ${MONO}`;
    const titleX = panel.x + (mobile ? 210 : 176);
    const titleY = panel.y + (mobile ? 105 : 108);
    const lines = wrapWords(
      story[index].heading,
      (text) => context.measureText(text).width,
      panel.width - (mobile ? 240 : 210),
    );
    lines.forEach((line, lineIndex) => {
      context.fillText(line, titleX, titleY + lineIndex * (mobile ? 44 : 38));
    });
  });

  return canvas.toDataURL("image/png");
}

const BANNERS = Object.freeze({
  origin: Object.freeze({ number: "01", label: "ORIGIN", heading: "The path." }),
  stack: Object.freeze({ number: "02", label: "STACK", heading: "Tools I work with." }),
  proof: Object.freeze({ number: "03", label: "PROOF", heading: "Proof of work." }),
  current: Object.freeze({ number: "04", label: "CURRENT", heading: "Questions I chase." }),
  contact: Object.freeze({ number: "05", label: "CONTACT", heading: "Reach me." }),
});

const STACK_GROUPS = Object.freeze([
  ["FRONTEND", ["React", "Next.js", "TypeScript", "Tailwind"]],
  ["BACKEND", ["Python", "FastAPI", "C# / .NET", "Node.js"]],
  ["DEVOPS & CI/CD", ["Docker", "Azure DevOps", "GitHub Actions", "Linux"]],
  ["TESTING & TOOLS", ["Playwright", "PostgreSQL", "Git", "Figma"]],
]);

// Transparent banner so the section header sits directly on GitHub's page.
function renderBanner(dark, { number, label, heading }) {
  const width = 1200;
  const height = 180;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const { canvas, context } = makeCanvas(width, height);

  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 1);
  context.lineTo(width, 1);
  context.stroke();
  context.strokeStyle = theme.accent;
  context.beginPath();
  context.moveTo(0, 1);
  context.lineTo(120, 1);
  context.stroke();

  drawMicroLabel(context, {
    x: 2,
    y: 66,
    number,
    label: `/ ${label}`,
    size: 16,
    dark,
    tracking: "4px",
  });

  context.fillStyle = theme.foreground;
  context.font = `700 54px ${MONO}`;
  context.letterSpacing = "-1px";
  context.textAlign = "left";
  context.fillText(heading, 2, 142);

  return canvas.toDataURL("image/png");
}

function renderStack(dark, mobile) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1600 : 900;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const { canvas, context } = makeCanvas(width, height);
  drawBase(context, width, height, dark);

  const margin = mobile ? 54 : 64;
  const gap = 16;
  const columns = mobile ? 2 : 4;
  const cellWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  const cellHeight = mobile ? 140 : 124;
  const labelSize = mobile ? 28 : 15;
  const nameSize = mobile ? 26 : 17;
  const groupStep = mobile ? 372 : 200;
  let y = mobile ? 96 : 92;

  for (const [category, tools] of STACK_GROUPS) {
    context.textAlign = "left";
    context.fillStyle = theme.accent;
    context.font = `700 ${labelSize}px ${MONO}`;
    context.letterSpacing = "3px";
    context.fillText(category, margin, y);

    tools.forEach((tool, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + column * (cellWidth + gap);
      const top = y + 24 + row * (cellHeight + gap);

      context.fillStyle = theme.surface;
      context.fillRect(x, top, cellWidth, cellHeight);
      context.strokeStyle = theme.border;
      context.lineWidth = 2;
      context.strokeRect(x, top, cellWidth, cellHeight);

      context.fillStyle = theme.foreground;
      context.font = `600 ${nameSize}px ${MONO}`;
      context.letterSpacing = "2px";
      context.textAlign = "center";
      context.fillText(
        tool.toUpperCase(),
        x + cellWidth / 2,
        top + cellHeight / 2 + nameSize * 0.36,
      );
    });

    y += groupStep;
  }

  return canvas.toDataURL("image/png");
}

function renderOpenSource(dark, openSource) {
  const width = 1200;
  const height = 360;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const { canvas, context } = makeCanvas(width, height);
  drawBase(context, width, height, dark);

  drawMicroLabel(context, {
    x: 64,
    y: 76,
    number: "OPEN SOURCE",
    label: "/ PUBLIC PROOF",
    size: 15,
    dark,
    tracking: "3px",
  });

  const margin = 64;
  const gap = 16;
  const cardWidth = (width - margin * 2 - gap * 3) / 4;
  const cardY = 104;
  const cardHeight = 192;

  openSource.forEach((entry, index) => {
    const x = margin + index * (cardWidth + gap);
    context.fillStyle = theme.surface;
    context.fillRect(x, cardY, cardWidth, cardHeight);
    context.strokeStyle = theme.border;
    context.lineWidth = 2;
    context.strokeRect(x, cardY, cardWidth, cardHeight);

    const countMatch = /^(\d+) merged PRs?$/u.exec(entry.signal);
    const count = countMatch ? countMatch[1] : entry.signal;
    const slash = entry.label.indexOf("/");
    const owner = entry.label.slice(0, slash + 1);
    const name = entry.label.slice(slash + 1);

    context.textAlign = "left";
    context.fillStyle = theme.accent;
    context.font = `700 52px ${MONO}`;
    context.letterSpacing = "0px";
    context.fillText(count, x + 24, cardY + 82);

    context.fillStyle = theme.muted;
    context.font = `700 12px ${MONO}`;
    context.letterSpacing = "3px";
    context.fillText(count === "1" ? "MERGED PR" : "MERGED PRS", x + 24, cardY + 112);

    context.font = `400 14px ${MONO}`;
    context.letterSpacing = "0px";
    context.fillText(owner, x + 24, cardY + 152);

    context.fillStyle = theme.foreground;
    context.font = `600 18px ${MONO}`;
    context.fillText(name, x + 24, cardY + 176);
  });

  return canvas.toDataURL("image/png");
}

async function renderAll(profile) {
  const lightCompanion = renderCompanion(false);
  const darkCompanion = renderCompanion(true);
  const banners = {};
  for (const [key, banner] of Object.entries(BANNERS)) {
    banners[`banner-${key}-light.png`] = renderBanner(false, banner);
    banners[`banner-${key}-dark.png`] = renderBanner(true, banner);
  }
  return {
    "companion-light.png": lightCompanion,
    "companion-dark.png": darkCompanion,
    "hero-light.png": await renderHero(false, false, lightCompanion),
    "hero-dark.png": await renderHero(true, false, darkCompanion),
    "hero-mobile-light.png": await renderHero(false, true, lightCompanion),
    "hero-mobile-dark.png": await renderHero(true, true, darkCompanion),
    "timeline-light.png": renderTimeline(false, false, profile.story),
    "timeline-dark.png": renderTimeline(true, false, profile.story),
    "timeline-mobile-light.png": renderTimeline(false, true, profile.story),
    "timeline-mobile-dark.png": renderTimeline(true, true, profile.story),
    "stack-light.png": renderStack(false, false),
    "stack-dark.png": renderStack(true, false),
    "stack-mobile-light.png": renderStack(false, true),
    "stack-mobile-dark.png": renderStack(true, true),
    "opensource-light.png": renderOpenSource(false, profile.openSource),
    "opensource-dark.png": renderOpenSource(true, profile.openSource),
    ...banners,
  };
}

window.assetStudio = { renderAll, renderHeroAnimation };
