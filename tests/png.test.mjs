import assert from "node:assert/strict";
import test from "node:test";

import { PNG } from "pngjs";

import { validatePng } from "../scripts/lib/png.mjs";

function createPng({ width = 2, height = 2, alpha = 255 } = {}) {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 95;
    png.data[index + 1] = 151;
    png.data[index + 2] = 255;
    png.data[index + 3] = alpha;
  }
  return PNG.sync.write(png);
}

test("validatePng accepts exact dimensions and required transparency", () => {
  const result = validatePng(createPng({ alpha: 128 }), {
    width: 2,
    height: 2,
    transparency: "required",
  });

  assert.deepEqual(result, {
    width: 2,
    height: 2,
    hasTransparency: true,
  });
});

test("validatePng rejects opaque companion assets", () => {
  assert.throws(
    () =>
      validatePng(createPng(), {
        width: 2,
        height: 2,
        transparency: "required",
      }),
    /transparent pixel/,
  );
});

test("validatePng rejects transparent composed assets", () => {
  assert.throws(
    () =>
      validatePng(createPng({ alpha: 128 }), {
        width: 2,
        height: 2,
        transparency: "forbidden",
      }),
    /must be opaque/,
  );
});

test("validatePng rejects invalid signatures and dimensions", () => {
  assert.throws(
    () =>
      validatePng(Buffer.from("not png"), {
        width: 2,
        height: 2,
        transparency: "forbidden",
      }),
    /PNG signature/,
  );
  assert.throws(
    () =>
      validatePng(createPng(), {
        width: 3,
        height: 2,
        transparency: "forbidden",
      }),
    /3x2/,
  );
});
