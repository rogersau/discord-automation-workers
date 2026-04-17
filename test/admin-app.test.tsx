/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";
import { renderToString } from "react-dom/server";

import App from "../src/admin/App";

test("authenticated admin dashboard renders explicit load controls for guild-scoped sections", () => {
  const html = renderToString(<App initialAuthenticated />);

  assert.match(html, /Load blocklist/i);
  assert.match(html, /Load timed roles/i);
});
