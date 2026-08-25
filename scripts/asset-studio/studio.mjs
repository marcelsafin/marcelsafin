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
  blue: RASTER_ACCENTS.blue,
  blueViolet: RASTER_ACCENTS.blueViolet,
  violet: RASTER_ACCENTS.violet,
  pink: RASTER_ACCENTS.pink,
};

const DISPLAY = "Arial, Helvetica, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

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
    material(PALETTE.violet, {
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
      material(side < 0 ? PALETTE.blue : PALETTE.blueViolet, {
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
      material(dark ? "#111827" : "#f4f7fb", {
        roughness: 0.08,
        metalness: 0.04,
        clearcoat: 1,
        emissive: side < 0 ? PALETTE.blue : PALETTE.blueViolet,
        emissiveIntensity: dark ? 0.52 : 0.24,
        opacity: 0.92,
      }),
    );
    glass.name = `${module.name}-glass`;
    glass.position.set(side * 0.66, 0.22, 0.79);
    root.add(glass);

    const glint = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.28, 8, 18),
      material("#f1f5f9", {
        roughness: 0.06,
        metalness: 0,
        emissive: "#f1f5f9",
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
        emissive: PALETTE.blue,
        emissiveIntensity: dark ? 0.18 : 0.04,
      }),
    );
    bar.position.set(x, -0.48, 0.72);
    signal.add(bar);
  }
  root.add(signal);

  const sideMaterial = material(PALETTE.pink, {
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

function renderCompanion(dark) {
  const { canvas, renderer } = createRenderer(1600, 1600, true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.08, 6.6);
  camera.lookAt(0, -0.02, 0);

  const key = new THREE.DirectionalLight(0xffffff, dark ? 4.2 : 3.1);
  key.position.set(-3.2, 4.6, 5.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5f97ff, 3.2);
  fill.position.set(4.4, 1.2, 3.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xd466ab, 2.8);
  rim.position.set(-4, -2.4, -1.6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(
    dark ? 0x8b64f6 : 0xffffff,
    dark ? 0x0d1015 : 0xcbd5e1,
    dark ? 1.4 : 2.2,
  ));

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

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
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

  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, dark ? "rgba(95,151,255,.18)" : "rgba(95,151,255,.13)");
  wash.addColorStop(0.5, dark ? "rgba(139,100,246,.16)" : "rgba(139,100,246,.1)");
  wash.addColorStop(1, dark ? "rgba(212,102,171,.12)" : "rgba(212,102,171,.08)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  roundedRect(context, 24, 24, width - 48, height - 48, 34);
  context.stroke();
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
  const inset = mobile ? 54 : 54;
  const reach = mobile ? 180 : 150;
  const startY = mobile ? 300 : 286;
  const stepY = mobile ? 54 : 38;

  context.save();
  context.fillStyle = theme.muted;
  context.lineWidth = mobile ? 3 : 2;
  for (let index = 0; index < 3; index += 1) {
    const y = startY + index * stepY;
    const offset = index * (mobile ? 18 : 12);
    const endLeft = inset + reach + offset;
    const endRight = width - inset - reach - offset;

    const signalGradient = context.createLinearGradient(inset, y, endLeft, y);
    signalGradient.addColorStop(0, theme.muted);
    signalGradient.addColorStop(1, "rgba(95,151,255,0)");
    context.strokeStyle = signalGradient;
    context.beginPath();
    context.moveTo(inset, y);
    context.lineTo(endLeft, y);
    context.stroke();

    const mirroredGradient = context.createLinearGradient(width - inset, y, endRight, y);
    mirroredGradient.addColorStop(0, theme.muted);
    mirroredGradient.addColorStop(1, "rgba(139,100,246,0)");
    context.strokeStyle = mirroredGradient;
    context.beginPath();
    context.moveTo(width - inset, y);
    context.lineTo(endRight, y);
    context.stroke();

    for (const x of [inset, width - inset]) {
      context.beginPath();
      context.arc(x, y, mobile ? 5 : 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawAccentEdge(context, card, dark) {
  const gradient = context.createLinearGradient(
    card.x,
    card.y,
    card.x + card.width,
    card.y,
  );
  gradient.addColorStop(0, "rgba(95,151,255,0)");
  gradient.addColorStop(0.22, dark ? "rgba(95,151,255,.55)" : "rgba(95,151,255,.5)");
  gradient.addColorStop(0.5, dark ? "rgba(139,100,246,.6)" : "rgba(139,100,246,.55)");
  gradient.addColorStop(0.78, dark ? "rgba(212,102,171,.55)" : "rgba(212,102,171,.5)");
  gradient.addColorStop(1, "rgba(212,102,171,0)");
  context.save();
  context.strokeStyle = gradient;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(card.x + card.radius, card.y + 1);
  context.lineTo(card.x + card.width - card.radius, card.y + 1);
  context.stroke();
  context.restore();
}

function drawTimelineSpine(context, width, dark) {
  const gradient = context.createLinearGradient(width / 2, 112, width / 2, 732);
  gradient.addColorStop(0, "rgba(95,151,255,0)");
  gradient.addColorStop(0.3, dark ? "rgba(95,151,255,.28)" : "rgba(95,151,255,.22)");
  gradient.addColorStop(0.7, dark ? "rgba(212,102,171,.28)" : "rgba(212,102,171,.22)");
  gradient.addColorStop(1, "rgba(212,102,171,0)");
  context.save();
  context.strokeStyle = gradient;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width / 2, 116);
  context.lineTo(width / 2, 728);
  context.stroke();
  context.restore();
}

async function renderHero(dark, mobile, companionDataUrl) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1120 : 760;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const layout = mobile ? HERO_LAYOUTS.mobile : HERO_LAYOUTS.desktop;
  const { canvas, context } = makeCanvas(width, height);
  drawBase(context, width, height, dark);

  context.fillStyle = theme.foreground;
  context.font = `700 ${
    mobile
      ? ASSET_TYPOGRAPHY.hero.mobile.attribution
      : ASSET_TYPOGRAPHY.hero.desktop.attribution
  }px ${MONO}`;
  context.letterSpacing = mobile ? "3px" : "2px";
  context.fillText("BUILT WITH GITHUB COPILOT", mobile ? 56 : 58, mobile ? 72 : 62);

  if (mobile) {
    context.font = `800 86px ${DISPLAY}`;
    context.letterSpacing = "-4px";
    context.textAlign = "center";
    context.fillText("MARSEL SAFIN", width / 2, 182);
  } else {
    context.font = `800 84px ${DISPLAY}`;
    context.letterSpacing = "-5px";
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

  const snapshot = document.createElement("canvas");
  snapshot.width = width;
  snapshot.height = height;
  snapshot.getContext("2d").drawImage(canvas, 0, 0);
  context.save();
  context.filter = `blur(${mobile ? 28 : 22}px)`;
  context.globalAlpha = dark ? 0.96 : 0.86;
  if (mobile) {
    context.drawImage(
      snapshot,
      layout.blurField.x,
      layout.blurField.y,
      layout.blurField.width,
      layout.blurField.height,
      layout.blurField.x,
      layout.blurField.y,
      layout.blurField.width,
      layout.blurField.height,
    );
  } else {
    context.drawImage(
      snapshot,
      layout.blurField.x,
      layout.blurField.y,
      layout.blurField.width,
      layout.blurField.height,
      layout.blurField.x,
      layout.blurField.y,
      layout.blurField.width,
      layout.blurField.height,
    );
  }
  context.restore();

  const halo = context.createRadialGradient(
    width / 2,
    mobile ? 505 : 350,
    30,
    width / 2,
    mobile ? 505 : 350,
    mobile ? 330 : 250,
  );
  halo.addColorStop(0, dark ? "rgba(95,151,255,.28)" : "rgba(95,151,255,.2)");
  halo.addColorStop(0.58, dark ? "rgba(139,100,246,.14)" : "rgba(139,100,246,.1)");
  halo.addColorStop(1, "rgba(139,100,246,0)");
  context.fillStyle = halo;
  context.fillRect(0, mobile ? 160 : 84, width, mobile ? 700 : 540);

  const companion = await loadImage(companionDataUrl);
  context.drawImage(
    companion,
    layout.companion.x,
    layout.companion.y,
    layout.companion.width,
    layout.companion.height,
  );

  const card = {
    ...layout.originCard,
    radius: mobile ? 34 : 30,
  };
  context.fillStyle = dark ? "rgba(17,24,39,.92)" : "rgba(241,245,249,.94)";
  roundedRect(context, card.x, card.y, card.width, card.height, card.radius);
  context.fill();
  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.stroke();
  drawAccentEdge(context, card, dark);

  context.textAlign = "left";
  context.fillStyle = theme.muted;
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
  context.font = `700 ${mobile ? 34 : 24}px ${DISPLAY}`;
  context.letterSpacing = "0px";
  context.fillText(
    "Systems · Agents · Graphs · Curiosity",
    card.x + 34,
    card.y + (mobile ? 112 : 72),
  );

  return canvas.toDataURL("image/png");
}

function renderTimeline(dark, mobile, story) {
  const width = mobile ? 900 : 1200;
  const height = mobile ? 1160 : 820;
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const mobileLayout = TIMELINE_LAYOUTS.mobile;
  const { canvas, context } = makeCanvas(width, height);
  drawBase(context, width, height, dark);

  context.fillStyle = theme.foreground;
  context.font = `800 ${mobile ? 44 : 30}px ${DISPLAY}`;
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
  const colors = [PALETTE.blue, PALETTE.blueViolet, PALETTE.violet, PALETTE.pink];
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
    context.fillStyle = dark ? "rgba(17,24,39,.9)" : "rgba(241,245,249,.94)";
    roundedRect(context, panel.x, panel.y, panel.width, panel.height, 28);
    context.fill();
    context.strokeStyle = theme.border;
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = colors[index];
    context.beginPath();
    context.arc(panel.x + 38, panel.y + 40, 10, 0, Math.PI * 2);
    context.fill();

    context.textAlign = "left";
    context.fillStyle = theme.muted;
    context.font = `700 ${
      mobile
        ? ASSET_TYPOGRAPHY.timeline.mobile.label
        : ASSET_TYPOGRAPHY.timeline.desktop.label
    }px ${MONO}`;
    context.fillText(labels[index], panel.x + 66, panel.y + 47);
    context.fillStyle = theme.foreground;
    context.font = `800 ${mobile ? 54 : 42}px ${DISPLAY}`;
    context.fillText(years[index], panel.x + 34, panel.y + (mobile ? 112 : 116));

    context.font = `700 ${
      mobile
        ? ASSET_TYPOGRAPHY.timeline.mobile.title
        : ASSET_TYPOGRAPHY.timeline.desktop.title
    }px ${DISPLAY}`;
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

async function renderAll(profile) {
  const lightCompanion = renderCompanion(false);
  const darkCompanion = renderCompanion(true);
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
  };
}

window.assetStudio = { renderAll };
