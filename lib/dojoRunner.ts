// Where submitted code actually runs.
//
// Three tiers behind one function, because one size genuinely doesn't fit:
//
//   1. THE BROWSER — js and ts run in a Web Worker in the reader's own tab.
//      Free, instant, offline. That path lives in public/dojo/runtime.js and
//      never reaches this file; this file is only what the browser can't do.
//   2. EPHEMERAL SANDBOX — python (and the ts fallback) get a fresh Vercel
//      Sandbox per run from an image that already has the interpreter, with
//      networking denied outright.
//   3. WARM TOOLCHAIN SANDBOX — rust and go have no managed image, and
//      installing a compiler per run would cost 30s–2min every single time.
//      So they share one long-lived named sandbox that installs its toolchain
//      once, and each run gets its own scratch directory inside it.
//
// Plus a fourth, for developing this thing: DOJO_LOCAL_EXEC=1 runs everything
// as a local child process. Never enabled in production.

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { DojoLang, RunOutcome } from "./dojo";
import {
  assemble,
  parseProtocol,
  remapDiagnostics,
  type Assembly,
  type LineRegion,
} from "./dojoHarness";

// A learner grinding on a failing test reruns constantly, so the budget is
// per-phase and tight. Compiling is allowed to take longer than running.
const BUILD_TIMEOUT_MS = 25_000;
const RUN_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_CHARS = 20_000;

// Long-lived sandboxes for the compiled languages. Names are stable so the
// sandbox (and its installed toolchain) is found again on the next request.
const WARM_SANDBOX: Partial<Record<DojoLang, string>> = {
  rust: "dojo-toolchain-rust",
  go: "dojo-toolchain-go",
};

// apt over rustup/tarballs on purpose: no version pinning to rot, and the
// package name is the only thing we have to be right about.
const TOOLCHAIN_INSTALL: Partial<Record<DojoLang, string>> = {
  rust: "sudo apt-get update -y && sudo apt-get install -y rustc",
  go: "sudo apt-get update -y && sudo apt-get install -y golang-go",
};

function imageFor(lang: DojoLang): string {
  // An image with every toolchain baked in (built with `vercel vcr build`)
  // skips the install step entirely — set DOJO_SANDBOX_IMAGE to use one.
  const custom = process.env.DOJO_SANDBOX_IMAGE;
  if (custom) return custom;
  switch (lang) {
    case "python":
      return "vercel/sandbox/python:3.14";
    case "js":
    case "ts":
      return "vercel/sandbox/node:24";
    default:
      return "vercel/sandbox/ubuntu:latest";
  }
}

// ── The entry point ──────────────────────────────────────────────────────

export async function runOnServer(
  lang: DojoLang,
  code: string,
  tests: string,
): Promise<RunOutcome> {
  const started = Date.now();
  const assembly = assemble(lang, code, tests);

  try {
    const raw =
      useLocalExec()
        ? await executeLocally(lang, assembly)
        : await executeInSandbox(lang, assembly);
    return finish(raw, Date.now() - started, assembly.regions);
  } catch (err) {
    // Infrastructure failed — not the learner's fault, and it must never look
    // like a failed test.
    return {
      ok: false,
      green: false,
      passed: 0,
      total: 0,
      tests: [],
      stdout: "",
      stderr: describeError(err),
      ms: Date.now() - started,
      where: "sandbox",
      note: "the runner itself failed — this isn't your code",
    };
  }
}

export function runsInBrowser(lang: DojoLang): boolean {
  return lang === "js" || lang === "ts";
}

// ── Shared shape of an execution ─────────────────────────────────────────

type RawResult = {
  buildFailed: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  note?: string;
};

function finish(raw: RawResult, ms: number, regions: LineRegion[]): RunOutcome {
  const parsed = parseProtocol(raw.stdout);
  const passed = parsed.tests.filter((t) => t.status === "pass").length;
  const total = parsed.tests.length;

  // A compile error, a crash before the first test, or a timeout all mean the
  // program never got to report anything — that's `ok: false`, distinct from
  // "ran fine, tests failed".
  const ok = !raw.buildFailed && !raw.timedOut && total > 0;

  // Compiler and traceback line numbers refer to the assembled file, which the
  // learner never sees; rewrite them into their own coordinates first.
  let stderr = truncate(remapDiagnostics(regions, raw.stderr));
  if (raw.timedOut) {
    stderr = ["timed out — is there an infinite loop?", stderr]
      .filter(Boolean)
      .join("\n\n");
  } else if (total === 0 && !raw.buildFailed && raw.exitCode !== 0 && !stderr) {
    stderr = `the program exited with code ${raw.exitCode} before any test reported`;
  }

  return {
    ok,
    green: total > 0 && passed === total,
    passed,
    total,
    tests: parsed.tests,
    stdout: truncate(parsed.stdout),
    stderr,
    ms,
    where: "sandbox",
    note: raw.note,
  };
}

// ── Tier 2 & 3: Vercel Sandbox ───────────────────────────────────────────

async function executeInSandbox(
  lang: DojoLang,
  assembly: Assembly,
): Promise<RawResult> {
  const { Sandbox } = await import("@vercel/sandbox");
  const warmName = WARM_SANDBOX[lang];
  const dir = `run-${Math.random().toString(36).slice(2, 10)}`;
  let note: string | undefined;

  // Ephemeral: one sandbox, one run, no snapshot, no network. `persistent:
  // false` matters — the default writes a billed snapshot on every stop.
  const sandbox = warmName
    ? await Sandbox.getOrCreate({
        name: warmName,
        image: imageFor(lang),
        persistent: true,
        timeout: 45 * 60_000,
      })
    : await Sandbox.create({
        image: imageFor(lang),
        persistent: false,
        networkPolicy: "deny-all",
        timeout: 2 * 60_000,
        resources: { vcpus: 1 },
      });

  try {
    if (warmName) {
      note = await ensureToolchain(sandbox, lang);
    }

    const cwd = `/vercel/sandbox/${dir}`;
    await sandbox.runCommand({ cmd: "mkdir", args: ["-p", cwd] });
    await sandbox.writeFiles(
      assembly.files.map((f) => ({
        path: `${dir}/${f.path}`,
        content: Buffer.from(f.content, "utf-8"),
      })),
    );

    if (assembly.build) {
      const build = await sandbox.runCommand({
        cmd: assembly.build.command,
        args: assembly.build.args,
        cwd,
        signal: AbortSignal.timeout(BUILD_TIMEOUT_MS),
      });
      if (build.exitCode !== 0) {
        return {
          buildFailed: true,
          exitCode: build.exitCode,
          stdout: await build.stdout(),
          stderr: await build.stderr(),
          timedOut: false,
          note,
        };
      }
    }

    let timedOut = false;
    const run = await sandbox
      .runCommand({
        cmd: assembly.command,
        args: assembly.args,
        cwd,
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      })
      .catch((err: unknown) => {
        if (isAbort(err)) {
          timedOut = true;
          return null;
        }
        throw err;
      });

    return {
      buildFailed: false,
      exitCode: run ? run.exitCode : null,
      stdout: run ? await run.stdout() : "",
      stderr: run ? await run.stderr() : "",
      timedOut,
      note,
    };
  } finally {
    // A warm sandbox is shared, so clean up the scratch directory and leave
    // the toolchain standing. An ephemeral one is thrown away wholesale.
    if (warmName) {
      await sandbox
        .runCommand({ cmd: "rm", args: ["-rf", `/vercel/sandbox/${dir}`] })
        .catch(() => {});
    } else {
      await sandbox.stop().catch(() => {});
    }
  }
}

// Install a compiler into the warm sandbox exactly once. Guarded two ways: a
// marker file survives restarts, and an in-process promise keeps two
// simultaneous first-runs from both shelling out to apt.
const installing = new Map<string, Promise<string | undefined>>();

async function ensureToolchain(
  sandbox: SandboxLike,
  lang: DojoLang,
): Promise<string | undefined> {
  const script = TOOLCHAIN_INSTALL[lang];
  if (!script || process.env.DOJO_SANDBOX_IMAGE) return undefined;

  const marker = `/vercel/dojo-ready-${lang}`;
  const ready = await sandbox.runCommand({ cmd: "test", args: ["-f", marker] });
  if (ready.exitCode === 0) return undefined;

  const key = `${lang}`;
  const existing = installing.get(key);
  if (existing) return existing;

  const job = (async () => {
    // Installing needs the network; running the learner's code does not. So
    // the policy is opened for the install and shut again straight after.
    await sandbox.update({ networkPolicy: "allow-all" }).catch(() => {});
    try {
      const install = await sandbox.runCommand({
        cmd: "bash",
        args: ["-lc", `${script} && touch ${marker}`],
        signal: AbortSignal.timeout(5 * 60_000),
      });
      if (install.exitCode !== 0) {
        throw new Error(
          `could not install the ${lang} toolchain:\n${await install.stderr()}`,
        );
      }
    } finally {
      await sandbox.update({ networkPolicy: "deny-all" }).catch(() => {});
      installing.delete(key);
    }
    return `installed the ${lang} toolchain — only this first run pays for it`;
  })();

  installing.set(key, job);
  return job;
}

// The SDK is imported dynamically (it's Node-only and heavy), so the type is
// pulled straight off the module rather than hand-written.
// `create` hands back a Sandbox & AsyncDisposable while `getOrCreate` returns
// the bare class, so the shared helper takes the plain type.
type SandboxLike = import("@vercel/sandbox").Sandbox;

// ── Tier 4: local child processes, for developing the dojo itself ─────────

function useLocalExec(): boolean {
  return (
    process.env.DOJO_LOCAL_EXEC === "1" && process.env.NODE_ENV !== "production"
  );
}

async function executeLocally(
  lang: DojoLang,
  assembly: Assembly,
): Promise<RawResult> {
  const dir = await mkdtemp(join(tmpdir(), "dojo-"));
  try {
    for (const file of assembly.files) {
      const target = join(dir, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf-8");
    }

    if (assembly.build) {
      const build = await spawnLocal(
        assembly.build.command,
        assembly.build.args,
        dir,
        BUILD_TIMEOUT_MS,
      );
      if (build.exitCode !== 0) {
        return { ...build, buildFailed: true };
      }
    }

    // Local Node may be older than the sandbox's, where stripping types is
    // the default; the flag is a no-op on newer versions.
    const command = assembly.command;
    const args =
      lang === "ts" && command === "node"
        ? ["--experimental-strip-types", ...assembly.args]
        : assembly.args;

    const run = await spawnLocal(command, args, dir, RUN_TIMEOUT_MS);
    return { ...run, buildFailed: false, note: "ran locally (dev mode)" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function spawnLocal(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<Omit<RawResult, "buildFailed">> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, NO_COLOR: "1", RUST_BACKTRACE: "0" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

// ── Odds and ends ────────────────────────────────────────────────────────

function isAbort(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n…output truncated`;
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // The most common first-time failure by far, and the message the SDK gives
  // is not actionable on its own.
  if (/oidc|credential|unauthor/i.test(message)) {
    return [
      "the sandbox rejected our credentials.",
      "",
      "on Vercel: enable OIDC for the project (Settings → Security).",
      "locally: run `vercel env pull` (the token lasts 12 hours), or set",
      "DOJO_LOCAL_EXEC=1 to run code as a local child process instead.",
      "",
      message,
    ].join("\n");
  }
  return message;
}
