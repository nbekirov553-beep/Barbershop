// Сборка API на Vercel (npm run vercel-build, выполняется до трассировки функции).
// Workspace-пакеты экспортируют исходники .ts, а Node в функции Vercel запускает только .js:
// на сборочной машине компилируем пакеты рядом с исходниками и переключаем их exports на .js.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = (command) => execSync(command, { cwd: root, stdio: "inherit" });

run("npm run generate -w @barbershop/db");

// Локальный `vercel build` не должен менять рабочую копию: правка exports только на сборочной машине Vercel.
if (!process.env.VERCEL || !process.env.CI) {
  console.log("vercel-build: не CI Vercel — пакеты не компилируются, exports не меняются");
  process.exit(0);
}

for (const name of ["shared", "db", "notifications"]) {
  const dir = `packages/${name}`;
  run(`npx tsc -p ${dir} --noEmit false --declaration false`);

  const file = `${root}${dir}/package.json`;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.exports = Object.fromEntries(
    Object.entries(pkg.exports).map(([key, target]) => [key, target.replace(/\.ts$/, ".js")]),
  );
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`vercel-build: @barbershop/${name} → .js`);
}
