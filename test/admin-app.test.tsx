/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";
import { renderToString } from "react-dom/server";

import App from "../src/admin/App";

test("authenticated admin dashboard keeps guild load controls in a plain shadcn layout", () => {
  const html = renderToString(<App initialAuthenticated />);

  assert.match(html, /Load blocklist/i);
  assert.match(html, /Load timed roles/i);
  assert.doesNotMatch(html, /Operations Console/);
  assert.doesNotMatch(html, /rounded-\[2rem\]/);
  assert.doesNotMatch(html, /shadow-\[0_32px_90px/);
  assert.match(html, /mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6/);
  assert.match(html, /rounded-lg border bg-card text-card-foreground shadow-sm/);
  assert.match(html, /flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end/);
});

test("authenticated admin dashboard avoids the old custom editor panel chrome", () => {
  const html = renderToString(<App initialAuthenticated />);

  assert.doesNotMatch(html, /xl:grid-cols-5/);
  assert.doesNotMatch(html, /xl:grid-cols-6/);
  assert.doesNotMatch(html, /auto_auto/);
  assert.doesNotMatch(
    html,
    /rounded-\[1\.75rem\] border border-border\/70 bg-background\/30 p-5 lg:p-6/
  );
  assert.doesNotMatch(
    html,
    /border-t border-border\/70 pt-5 sm:flex-row sm:items-center sm:justify-end/
  );
  assert.match(html, /rounded-lg border bg-muted\/30 p-4 md:p-6/);
});
