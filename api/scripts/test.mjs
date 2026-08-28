import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { connect } from "node:net";

const directory = await mkdtemp(resolve(tmpdir(), "emojizzle-azurite-"));
const executable = resolve(import.meta.dirname, "../../node_modules/.bin/azurite-table");
const azurite = spawn(executable, ["--silent", "--location", directory], { stdio: "inherit" });
const azuriteExit = new Promise((resolveExit) => azurite.once("exit", resolveExit));
const waitForTable = () => new Promise((resolveReady, reject) => {
  let attempts = 0;
  const probe = () => {
    const socket = connect(10002, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolveReady(); });
    socket.once("error", () => { socket.destroy(); if (++attempts > 50) reject(new Error("Azurite did not start")); else setTimeout(probe, 100); });
  };
  probe();
});

try {
  await waitForTable();
  const tests = spawn(process.execPath, ["--experimental-strip-types", "--test", "tests/*.test.mjs"], { cwd: resolve(import.meta.dirname, ".."), shell: true, stdio: "inherit", env: { ...process.env, TABLE_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true" } });
  const code = await new Promise((resolveExit) => tests.once("exit", resolveExit));
  if (code !== 0) process.exitCode = typeof code === "number" ? code : 1;
} finally {
  azurite.kill("SIGTERM");
  await azuriteExit;
  await rm(directory, { recursive: true, force: true });
}
