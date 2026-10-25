#!/usr/bin/env node
/* Verify an extracted release without changing the original checkout.
 * npm ci must have been run in the extracted folder first. The child server
 * exists only for this test and is always stopped, including assertion failures. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const forbidden = new Set([
  "accounts.json",
  "shop-users.json",
  ".netrc",
  ".git-credentials",
]);

async function availablePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function main() {
  const directory = path.resolve(process.argv[2] || process.cwd());
  const manifestPath = path.join(directory, "CHECKSUMS.json");
  assert(
    fs.existsSync(manifestPath),
    "Run this in an extracted release containing CHECKSUMS.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const names = Object.keys(manifest);
  assert(
    names.length > 100,
    "Expected the complete project, not an isolated patch",
  );
  for (const name of names) {
    const pieces = name.split("/");
    assert(
      !path.isAbsolute(name) && !pieces.includes(".."),
      "Unsafe manifest path",
    );
    assert(
      !pieces.some((p) =>
        [".git", "node_modules", "godot"].includes(p.toLowerCase()),
      ),
    );
    assert(!forbidden.has(pieces.at(-1)));
    assert(!pieces.at(-1).startsWith(".env"));
    const target = path.join(directory, name);
    assert(!fs.lstatSync(target).isSymbolicLink(), "No symlink payloads");
    assert.equal(
      hash(fs.readFileSync(target)),
      manifest[name],
      "Checksum mismatch: " + name,
    );
  }
  const html = fs.readFileSync(
    path.join(directory, "public/index.html"),
    "utf8",
  );
  const runtime = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((m) => m[1].split("?")[0].split("#")[0])
    .filter((s) => /^(assets|styles|vendor|fonts|exports)\//.test(s));
  for (const name of runtime)
    assert(manifest["public/" + name], "HTML dependency omitted: " + name);
  for (const name of [
    "fz-buildings",
    "fz-cranes",
    "fz-cinema-film",
    "fz-residence-tasks",
  ])
    assert(
      runtime.includes("assets/" + name + ".js"),
      "New module is not connected: " + name,
    );

  const port = await availablePort();
  let child;
  try {
    child = spawn(process.execPath, ["server.js"], {
      cwd: directory,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      let log = "";
      const timer = setTimeout(
        () => reject(Error("Server startup timeout")),
        15000,
      );
      const fail = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      child.once("error", fail);
      child.once("exit", (code) =>
        fail(Error("Server exited during startup: " + code)),
      );
      child.stdout.on("data", (data) => {
        log += data;
        if (log.includes("Сервер запущен")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const base = "http://127.0.0.1:" + port;
    const health = await fetch(base + "/api/health");
    assert(health.ok);
    assert.equal((await health.json()).ok, true);
    const checks = [
      ...new Set([
        "index.html",
        ...runtime,
        "exports/player_super.glb",
        "audio/metro/arrival.mp3",
        "audio/city/welcome.mp3",
      ]),
    ];
    for (const asset of checks) {
      const response = await fetch(base + "/" + asset);
      assert(response.ok, "HTTP failure: " + asset);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        hash(bytes),
        manifest["public/" + asset],
        "HTTP payload differs: " + asset,
      );
    }
    console.log(
      JSON.stringify(
        {
          manifestFiles: names.length,
          httpAssets: checks.length,
          checksums: "PASS",
          secretsExcluded: "PASS",
          freshServer: "PASS",
          htmlDependencies: "PASS",
        },
        null,
        2,
      ),
    );
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
