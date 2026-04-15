/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";

import { createTimedRoleScheduler } from "../src/runtime/node-scheduler";

test("timed role scheduler removes expired roles and deletes successful rows", async () => {
  const removed: Array<{ guildId: string; userId: string; roleId: string }> = [];
  const deleted: Array<{ guildId: string; userId: string; roleId: string }> = [];

  const scheduler = createTimedRoleScheduler({
    now: () => 1_700_000_000_000,
    store: {
      async listExpiredTimedRoles() {
        return [{
          guildId: "guild-1",
          userId: "user-1",
          roleId: "role-1",
          durationInput: "1h",
          expiresAtMs: 1_699_999_999_000,
        }];
      },
      async deleteTimedRole(body: any) {
        deleted.push(body);
      },
    } as any,
    removeGuildMemberRole: async (guildId: string, userId: string, roleId: string) => {
      removed.push({ guildId, userId, roleId });
    },
    setTimer(_callback: any, _delayMs: number) {
      return { stop() {} };
    },
  });

  await scheduler.start();

  assert.deepEqual(removed, [{ guildId: "guild-1", userId: "user-1", roleId: "role-1" }]);
  assert.deepEqual(deleted, [{ guildId: "guild-1", userId: "user-1", roleId: "role-1" }]);
});

test("timed role scheduler installs recurring timer and processes roles periodically", async () => {
  const removed: Array<{ guildId: string; userId: string; roleId: string }> = [];
  let timerCallback: (() => void | Promise<void>) | undefined;
  let timerDelayMs: number | undefined;

  const scheduler = createTimedRoleScheduler({
    now: () => 1_700_000_000_000,
    store: {
      async listExpiredTimedRoles() {
        return [{
          guildId: "guild-1",
          userId: "user-1",
          roleId: "role-1",
          durationInput: "1h",
          expiresAtMs: 1_699_999_999_000,
        }];
      },
      async deleteTimedRole() {},
    } as any,
    removeGuildMemberRole: async (guildId: string, userId: string, roleId: string) => {
      removed.push({ guildId, userId, roleId });
    },
    setTimer(callback: any, delayMs: number) {
      timerCallback = callback;
      timerDelayMs = delayMs;
      return { stop() {} };
    },
  });

  await scheduler.start();

  assert.ok(timerCallback, "should install timer");
  assert.equal(timerDelayMs, 1000, "timer should fire every 1000ms");
  assert.equal(removed.length, 1, "should process roles on start");

  await timerCallback?.();
  assert.equal(removed.length, 2, "should process roles when timer fires");

  await timerCallback?.();
  assert.equal(removed.length, 3, "should continue processing on each timer tick");
});

test("timed role scheduler stop cancels the timer", async () => {
  let stopped = false;

  const scheduler = createTimedRoleScheduler({
    now: () => 1_700_000_000_000,
    store: {
      async listExpiredTimedRoles() {
        return [];
      },
      async deleteTimedRole() {},
    } as any,
    removeGuildMemberRole: async () => {},
    setTimer(_callback: any, _delayMs: number) {
      return { 
        stop() {
          stopped = true;
        }
      };
    },
  });

  await scheduler.start();
  scheduler.stop();

  assert.equal(stopped, true, "should call stop on the timer");
});
