/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";

test("admin styles define a dark default palette", () => {
  const cssPath = path.join(process.cwd(), "src/admin/styles.css");
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /--background:\s*222\.2 84% 4\.9%/);
  assert.match(css, /--foreground:\s*210 40% 98%/);
  assert.match(css, /--card:\s*222\.2 84% 4\.9%/);
  assert.match(css, /--card-foreground:\s*210 40% 98%/);
  assert.match(css, /--input:\s*217\.2 32\.6% 17\.5%/);
});
