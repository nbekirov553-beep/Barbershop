/**
 * Сборка API для Vercel через Build Output API: один ESM-бандл с workspace-пакетами
 * и wasm-движком Prisma, все запросы идут в одну функцию.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const output = ".vercel/output";
const functionDir = `${output}/functions/index.func`;

await rm(output, { recursive: true, force: true });
await mkdir(functionDir, { recursive: true });

await build({
  entryPoints: ["src/vercel.ts"],
  outfile: `${functionDir}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // pg пытается подключить нативный драйвер только по явному запросу.
  external: ["pg-native"],
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __pathDirname } from "node:path";',
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
  logLevel: "info",
});

await writeFile(
  `${functionDir}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 30 }, null, 2),
);
await writeFile(`${output}/config.json`, JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }, null, 2));
