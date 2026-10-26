import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const npm = process.env.npm_execpath;
const children = new Set();
let stopping = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      detached: process.platform !== "win32",
      ...options,
    });
    children.add(child);
    child.once("error", (error) => {
      children.delete(child);
      reject(new Error(`Cannot start ${command}: ${error.message}`));
    });
    child.once("exit", (code) => {
      children.delete(child);
      if (code === 0 || stopping) resolve();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
  }
  process.exitCode = code;
}

async function available(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is in use. Stop the existing local server and retry.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));

try {
  if (!npm)
    throw new Error(
      "Run this script through npm run setup, dev, check or publish.",
    );
  const action = process.argv[2];
  if (action === "setup") {
    await run("dotnet", ["tool", "restore"]);
    await run("dotnet", ["restore", "--locked-mode"]);
    await run(process.execPath, [npm, "ci", "--prefix", "src/web"]);
    console.log("Setup complete. Run npm run dev.");
  } else if (action === "check") {
    await run("dotnet", ["build", "-c", "Release", "--no-restore"]);
    await run("dotnet", ["test", "-c", "Release", "--no-restore"]);
    await run(process.execPath, [npm, "run", "build", "--prefix", "src/web"]);
    await run(process.execPath, [npm, "run", "test", "--prefix", "src/web"]);
  } else if (action === "publish") {
    const args = process.argv.slice(3);
    const noBuild = args.includes("--no-build");
    if (noBuild) args.splice(args.indexOf("--no-build"), 1);
    if (args.length && (args.length !== 2 || args[0] !== "--output"))
      throw new Error(
        "Use npm run publish -- [--no-build] --output artifacts/your-release.",
      );
    const artifacts = resolve("artifacts");
    const output = resolve(args[1] || `artifacts/publish-${Date.now()}`);
    const target = relative(artifacts, output);
    if (!target || target.startsWith("..") || isAbsolute(target))
      throw new Error(
        "Publish output must be a new directory inside artifacts/.",
      );
    if (existsSync(output))
      throw new Error(
        "Publish output already exists. Choose a new release directory.",
      );

    if (!noBuild)
      await run(process.execPath, [npm, "run", "build", "--prefix", "src/web"]);
    else if (!existsSync("src/web/dist/index.html"))
      throw new Error("Build the frontend before publishing with --no-build.");
    await run("dotnet", [
      "publish",
      "src/DynamicConstruction.Api",
      "-c",
      "Release",
      noBuild ? "--no-build" : "--no-restore",
      "-o",
      output,
    ]);
    mkdirSync(join(output, "wwwroot"), { recursive: true });
    cpSync("src/web/dist", join(output, "wwwroot"), { recursive: true });
    console.log(
      `Published frontend and API to ${relative(process.cwd(), output)}.`,
    );
  } else if (action === "dev") {
    if (!existsSync("src/web/node_modules/vite/bin/vite.js")) {
      throw new Error("Dependencies are missing. Run npm run setup first.");
    }
    await available(5080);
    await available(5173);
    const env = {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      Database__Provider: "Sqlite",
      Storage__Provider: "Local",
      ConnectionStrings__Database: "Data Source=App_Data/dynamic.db",
      API_TARGET: "http://127.0.0.1:5080",
    };
    console.log(
      "Starting http://127.0.0.1:5173 (API: 5080). Press Ctrl+C to stop both.",
    );
    await Promise.race([
      run(
        "dotnet",
        [
          "run",
          "--project",
          "src/DynamicConstruction.Api",
          "--no-launch-profile",
          "--urls",
          "http://127.0.0.1:5080",
        ],
        { env },
      ),
      run(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../src/web/node_modules/vite/bin/vite.js",
              import.meta.url,
            ),
          ),
          "--host",
          "127.0.0.1",
          "--port",
          "5173",
          "--strictPort",
        ],
        { cwd: fileURLToPath(new URL("../src/web", import.meta.url)), env },
      ),
    ]);
    stop(0);
  } else throw new Error("Use npm run setup, dev, check or publish.");
} catch (error) {
  console.error(error.message);
  stop(1);
}
