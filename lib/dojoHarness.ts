// The test harnesses — one per language, all speaking the same protocol.
//
// A challenge is: the learner's code, plus a test block written by the
// authoring agent. Neither knows how to report results, so we sandwich them
// with a harness that does. Every harness prints one line per test:
//
//   DOJO_TEST\t<pass|fail|error>\t<name>\t<message>
//
// with tabs and newlines inside the name and message escaped as literal \t
// and \n. One parser reads all five languages, and — critically — the same
// protocol comes back from the in-browser Web Worker, so a Python challenge
// and a JavaScript challenge produce identical result objects.
//
// Each harness deliberately looks IDIOMATIC in its own language. Forcing
// JavaScript's expect(x).toBe(y) into Rust would teach the wrong reflexes,
// and the point of the dojo is to rebuild real fluency — so Rust gets
// assert_eq! and panics, Python gets a decorator, Go gets a closure.

import type { DojoLang } from "./dojo";

export const PROTOCOL_PREFIX = "DOJO_TEST";

// ── JavaScript / TypeScript ──────────────────────────────────────────────
// Shared verbatim with the browser Web Worker path, so a TS challenge that
// falls back to the server behaves exactly as it did in the browser.

export const JS_HARNESS = String.raw`
// ── dojo harness ─────────────────────────────────────────────────────────
const __dojo_cases = [];
function test(name, fn) { __dojo_cases.push({ name: String(name), fn }); }
const it = test;

function __dojo_esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
}
function __dojo_show(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "bigint") return v + "n";
  if (v instanceof Map) return "Map(" + JSON.stringify([...v.entries()]) + ")";
  if (v instanceof Set) return "Set(" + JSON.stringify([...v.values()]) + ")";
  if (v instanceof Date) return "Date(" + v.toISOString() + ")";
  if (typeof v === "function") return "[function " + (v.name || "anonymous") + "]";
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}
function __dojo_eq(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) { if (!b.has(k) || !__dojo_eq(v, b.get(k))) return false; }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => __dojo_eq(x, b[i]));
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && __dojo_eq(a[k], b[k]));
}
function __dojo_fail(msg) { const e = new Error(msg); e.__dojo = true; throw e; }

function __dojo_matchers(actual, negated) {
  const ok = (pass, msg) => {
    if (negated ? !pass : pass) return;
    __dojo_fail(negated ? "did NOT expect " + msg : msg);
  };
  return {
    toBe: (want) => ok(Object.is(actual, want),
      "expected " + __dojo_show(want) + " but got " + __dojo_show(actual)),
    toEqual: (want) => ok(__dojo_eq(actual, want),
      "expected " + __dojo_show(want) + " but got " + __dojo_show(actual)),
    toBeCloseTo: (want, digits = 6) => ok(Math.abs(actual - want) < Math.pow(10, -digits) / 2,
      "expected " + __dojo_show(want) + " (±1e-" + digits + ") but got " + __dojo_show(actual)),
    toContain: (want) => ok(
      typeof actual === "string" ? actual.includes(want)
        : !!actual && typeof actual.includes === "function" ? actual.includes(want)
        : Array.from(actual ?? []).some((x) => __dojo_eq(x, want)),
      "expected " + __dojo_show(actual) + " to contain " + __dojo_show(want)),
    toMatch: (re) => ok(new RegExp(re).test(String(actual)),
      "expected " + __dojo_show(actual) + " to match " + String(re)),
    toBeTruthy: () => ok(!!actual, "expected " + __dojo_show(actual) + " to be truthy"),
    toBeFalsy: () => ok(!actual, "expected " + __dojo_show(actual) + " to be falsy"),
    toBeNull: () => ok(actual === null, "expected null but got " + __dojo_show(actual)),
    toBeUndefined: () => ok(actual === undefined, "expected undefined but got " + __dojo_show(actual)),
    toHaveLength: (n) => ok(actual != null && actual.length === n,
      "expected length " + n + " but got " + __dojo_show(actual == null ? actual : actual.length)),
    toThrow: (matcher) => {
      let threw = false, error;
      try { actual(); } catch (e) { threw = true; error = e; }
      if (!threw) return ok(false, "expected the call to throw, but it returned normally");
      if (matcher === undefined) return ok(true, "");
      const msg = error && error.message ? error.message : String(error);
      const hit = matcher instanceof RegExp ? matcher.test(msg) : msg.includes(String(matcher));
      return ok(hit, "expected the thrown message to match " + String(matcher) + " but got " + __dojo_show(msg));
    },
  };
}
function expect(actual) {
  const m = __dojo_matchers(actual, false);
  m.not = __dojo_matchers(actual, true);
  return m;
}
function assert(cond, msg) { if (!cond) __dojo_fail(msg || "assertion failed"); }

async function __dojo_run() {
  for (const c of __dojo_cases) {
    try {
      await c.fn();
      console.log("DOJO_TEST\tpass\t" + __dojo_esc(c.name) + "\t");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      const kind = e && e.__dojo ? "fail" : "error";
      console.log("DOJO_TEST\t" + kind + "\t" + __dojo_esc(c.name) + "\t" + __dojo_esc(msg));
    }
  }
  if (__dojo_cases.length === 0) {
    console.log("DOJO_TEST\terror\tno tests\tthis challenge declared no tests");
  }
}
// ── end harness ──────────────────────────────────────────────────────────
`;

// ── Python ───────────────────────────────────────────────────────────────
// A decorator for registration, snake_case matchers, and plain `assert` still
// works — because in Python it should.

const PY_HARNESS = String.raw`
# ── dojo harness ─────────────────────────────────────────────────────────
_dojo_cases = []

def test(name):
    def _register(fn):
        _dojo_cases.append((str(name), fn))
        return fn
    return _register

def _dojo_esc(s):
    return str(s).replace("\\", "\\\\").replace("\t", "\\t").replace("\r\n", "\\n").replace("\n", "\\n")

class _DojoFailure(AssertionError):
    pass

class _Expect:
    def __init__(self, actual, negated=False):
        self._actual = actual
        self._negated = negated

    @property
    def not_(self):
        return _Expect(self._actual, not self._negated)

    def _ok(self, passed, message):
        satisfied = (not passed) if self._negated else passed
        if satisfied:
            return
        raise _DojoFailure(("did NOT expect " + message) if self._negated else message)

    def to_be(self, want):
        self._ok(self._actual is want or self._actual == want,
                 "expected {!r} but got {!r}".format(want, self._actual))

    def to_equal(self, want):
        self._ok(self._actual == want,
                 "expected {!r} but got {!r}".format(want, self._actual))

    def to_be_close_to(self, want, digits=6):
        self._ok(abs(self._actual - want) < (10 ** -digits) / 2,
                 "expected {!r} (+/-1e-{}) but got {!r}".format(want, digits, self._actual))

    def to_contain(self, want):
        self._ok(want in self._actual,
                 "expected {!r} to contain {!r}".format(self._actual, want))

    def to_have_length(self, n):
        self._ok(len(self._actual) == n,
                 "expected length {} but got {}".format(n, len(self._actual)))

    def to_be_truthy(self):
        self._ok(bool(self._actual), "expected {!r} to be truthy".format(self._actual))

    def to_be_none(self):
        self._ok(self._actual is None, "expected None but got {!r}".format(self._actual))

    def to_raise(self, exc=Exception, match=None):
        try:
            self._actual()
        except exc as err:
            if match is not None and match not in str(err):
                self._ok(False, "expected the error message to contain {!r} but got {!r}".format(match, str(err)))
                return
            self._ok(True, "")
            return
        self._ok(False, "expected the call to raise {} but it returned normally".format(getattr(exc, "__name__", exc)))

def expect(actual):
    return _Expect(actual)

def _dojo_run():
    for name, fn in _dojo_cases:
        try:
            fn()
            print("DOJO_TEST\tpass\t" + _dojo_esc(name) + "\t", flush=True)
        except _DojoFailure as err:
            print("DOJO_TEST\tfail\t" + _dojo_esc(name) + "\t" + _dojo_esc(err), flush=True)
        except AssertionError as err:
            detail = str(err) or "assertion failed"
            print("DOJO_TEST\tfail\t" + _dojo_esc(name) + "\t" + _dojo_esc(detail), flush=True)
        except Exception as err:
            detail = "{}: {}".format(type(err).__name__, err)
            print("DOJO_TEST\terror\t" + _dojo_esc(name) + "\t" + _dojo_esc(detail), flush=True)
    if not _dojo_cases:
        print("DOJO_TEST\terror\tno tests\tthis challenge declared no tests", flush=True)
# ── end harness ──────────────────────────────────────────────────────────
`;

// ── Rust ─────────────────────────────────────────────────────────────────
// catch_unwind turns a failed assert_eq! into a reportable result instead of
// a dead process. The panic hook is silenced so the only thing on stdout is
// the protocol — a real panic message still arrives via the payload.

const RUST_HARNESS = String.raw`
// ── dojo harness ─────────────────────────────────────────────────────────
#[allow(dead_code)]
fn dojo_esc(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\t', "\\t").replace("\r\n", "\\n").replace('\n', "\\n")
}

#[allow(dead_code)]
fn dojo_case<F: FnOnce() + std::panic::UnwindSafe>(name: &str, f: F) {
    let result = std::panic::catch_unwind(f);
    match result {
        Ok(()) => println!("DOJO_TEST\tpass\t{}\t", dojo_esc(name)),
        Err(payload) => {
            let msg = if let Some(s) = payload.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = payload.downcast_ref::<String>() {
                s.clone()
            } else {
                "panicked".to_string()
            };
            println!("DOJO_TEST\tfail\t{}\t{}", dojo_esc(name), dojo_esc(&msg));
        }
    }
}

fn main() {
    // Failed assertions are the expected outcome here, not a crash — so the
    // default panic printer is muted and dojo_case does the reporting.
    std::panic::set_hook(Box::new(|_| {}));
    dojo_tests();
    let _ = std::panic::take_hook();
}
// ── end harness ──────────────────────────────────────────────────────────
`;

// ── Go ───────────────────────────────────────────────────────────────────
// Go's import block must sit directly under the package clause, so Go is the
// one language assembled as several files in a package rather than one
// concatenated file.

const GO_HARNESS = String.raw`package main

// ── dojo harness ─────────────────────────────────────────────────────────

import (
	"fmt"
	"strings"
)

func dojoEsc(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\t", "\\t")
	s = strings.ReplaceAll(s, "\r\n", "\\n")
	return strings.ReplaceAll(s, "\n", "\\n")
}

// dojoCase runs one test, turning a panic (which is what a failed assertion
// is here) into a reportable line rather than a dead process.
func dojoCase(name string, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("DOJO_TEST\tfail\t%s\t%s\n", dojoEsc(name), dojoEsc(fmt.Sprint(r)))
		}
	}()
	fn()
	fmt.Printf("DOJO_TEST\tpass\t%s\t\n", dojoEsc(name))
}

// assertEqual is deliberately reflect.DeepEqual-free for scalars and strings;
// use it for the common case and reach for your own comparison when a test
// needs more.
func assertEqual[T comparable](got T, want T) {
	if got != want {
		panic(fmt.Sprintf("expected %v but got %v", want, got))
	}
}

func assertTrue(cond bool, msg string) {
	if !cond {
		panic(msg)
	}
}

func main() {
	dojoTests()
}
// ── end harness ──────────────────────────────────────────────────────────
`;

// ── Assembly ─────────────────────────────────────────────────────────────

export type SourceFile = { path: string; content: string };

// Which lines of the ASSEMBLED file came from where. Without this, a compile
// error points at line 36 of a file the learner has never seen — their editor
// says line 1 — and the error becomes useless. See remapDiagnostics.
export type LineRegion = {
  file: string;
  label: "your code" | "the tests" | "the harness";
  from: number; // 1-based line in the assembled file
  to: number;
};

export type Assembly = {
  files: SourceFile[];
  // argv for the run step, executed in the working directory
  command: string;
  args: string[];
  // optional compile/setup step run first; a non-zero exit is reported to the
  // learner as a compile error rather than a test failure
  build?: { command: string; args: string[] };
  regions: LineRegion[];
};

type Block = { text: string; label?: LineRegion["label"] };

// Assemble one file out of labelled blocks, recording where each landed.
function build(file: string, blocks: Block[]): { source: SourceFile; regions: LineRegion[] } {
  const lines: string[] = [];
  const regions: LineRegion[] = [];

  for (const block of blocks) {
    const blockLines = block.text.split("\n");
    // A block written as a template literal ends in a newline; that trailing
    // empty string is an artifact, not a line.
    if (blockLines.length > 0 && blockLines[blockLines.length - 1] === "") {
      blockLines.pop();
    }
    if (block.label && blockLines.length > 0) {
      regions.push({
        file,
        label: block.label,
        from: lines.length + 1,
        to: lines.length + blockLines.length,
      });
    }
    lines.push(...blockLines);
  }

  return { source: { path: file, content: lines.join("\n") + "\n" }, regions };
}

// Put the learner's code, the tests, and the harness together into something
// runnable. Order matters: the harness comes FIRST in the scripting languages
// so test blocks can call expect() at import time, and the entry point comes
// last so everything it needs is already defined.
export function assemble(
  lang: DojoLang,
  code: string,
  tests: string,
): Assembly {
  switch (lang) {
    // js and ts are the same assembly — Node strips the types natively, so the
    // file runs as authored. The trade-off is that only erasable syntax works:
    // no enums, no namespaces, no parameter properties.
    case "js":
    case "ts": {
      const ext = lang === "ts" ? "ts" : "js";
      const { source, regions } = build(`main.${ext}`, [
        { text: JS_HARNESS, label: "the harness" },
        { text: "// ── your code ──\n" },
        { text: code, label: "your code" },
        { text: "// ── tests ──\n" },
        { text: tests, label: "the tests" },
        { text: "__dojo_run();\n" },
      ]);
      return { files: [source], regions, command: "node", args: [source.path] };
    }

    case "python": {
      const { source, regions } = build("main.py", [
        { text: PY_HARNESS, label: "the harness" },
        { text: "# ── your code ──\n" },
        { text: code, label: "your code" },
        { text: "# ── tests ──\n" },
        { text: tests, label: "the tests" },
        { text: "\n_dojo_run()\n" },
      ]);
      return { files: [source], regions, command: "python3", args: ["main.py"] };
    }

    case "rust": {
      // `use` may appear anywhere at module level, so one file is fine — and
      // one file means one rustc invocation, which keeps the cycle short.
      const { source, regions } = build("main.rs", [
        { text: RUST_HARNESS, label: "the harness" },
        { text: "// ── your code ──\n" },
        { text: code, label: "your code" },
        { text: "// ── tests ──\nfn dojo_tests() {\n" },
        { text: indent(tests), label: "the tests" },
        { text: "}\n" },
      ]);
      return {
        files: [source],
        regions,
        build: { command: "rustc", args: ["-A", "warnings", "main.rs", "-o", "main"] },
        command: "./main",
        args: [],
      };
    }

    case "go": {
      // Go's import block must sit directly under the package clause, so this
      // is the one language assembled as a package of files.
      const solution = build("solution.go", [
        { text: /^\s*package\s+\w+/.test(code) ? "" : "package main\n\n" },
        { text: code, label: "your code" },
      ]);
      const testFile = build("tests.go", [
        { text: `${goTestHeader(tests)}\nfunc dojoTests() {\n` },
        { text: indent(stripGoHeader(tests)), label: "the tests" },
        { text: "}\n" },
      ]);
      return {
        files: [
          { path: "go.mod", content: "module dojo\n\ngo 1.24\n" },
          { path: "harness.go", content: GO_HARNESS },
          solution.source,
          testFile.source,
        ],
        regions: [...solution.regions, ...testFile.regions],
        command: "go",
        args: ["run", "."],
      };
    }
  }
}

const indent = (s: string) => s.replace(/^/gm, "\t").replace(/^\t$/gm, "");

// ── Making compiler errors point at the right line ───────────────────────
// rustc says "main.rs:36". The learner's editor says line 1. Left alone, every
// compile error in the dojo would send them hunting through a file they can't
// see — so file:line references are rewritten into the coordinates they
// actually have in front of them.

export function remapDiagnostics(regions: LineRegion[], text: string): string {
  if (!text) return text;

  const locate = (file: string, line: number): string | null => {
    const region = regions.find(
      (r) => r.file === file && line >= r.from && line <= r.to,
    );
    if (!region) return null;
    return `${region.label} line ${line - region.from + 1}`;
  };

  return (
    text
      // rustc / go / node: main.rs:36:35, ./solution.go:5:10
      .replace(
        /(?:\.\/)?([\w.-]+\.(?:rs|go|py|js|ts)):(\d+)(?::(\d+))?/g,
        (whole, file: string, line: string, column?: string) => {
          const at = locate(file, Number(line));
          if (!at) return whole;
          return column ? `${at}, column ${column}` : at;
        },
      )
      // python tracebacks: File "main.py", line 42
      .replace(
        /File "(?:\.\/)?([\w.-]+\.py)", line (\d+)/g,
        (whole, file: string, line: string) => {
          const at = locate(file, Number(line));
          return at ? `in ${at}` : whole;
        },
      )
  );
}

// A Go test block may open with its own import block (for fmt, strings, …).
// Lift it above the generated dojoTests() wrapper, where Go requires it.
function goTestHeader(tests: string): string {
  const match = tests.match(/^\s*import\s*\(([\s\S]*?)\)/m);
  if (match) return `package main\n\nimport (${match[1]})\n`;
  const single = tests.match(/^\s*import\s+("[^"]+")/m);
  if (single) return `package main\n\nimport ${single[1]}\n`;
  return "package main\n";
}

function stripGoHeader(tests: string): string {
  return tests
    .replace(/^\s*package\s+\w+\s*$/m, "")
    .replace(/^\s*import\s*\([\s\S]*?\)/m, "")
    .replace(/^\s*import\s+"[^"]+"\s*$/m, "");
}

// ── Parsing results back out ─────────────────────────────────────────────

export type ParsedOutput = {
  tests: Array<{ name: string; status: "pass" | "fail" | "error"; message?: string }>;
  // Everything the program printed that ISN'T protocol — the learner's own
  // console.log/print output, which is a first-class debugging tool and must
  // survive to the results panel.
  stdout: string;
};

export function parseProtocol(raw: string): ParsedOutput {
  const tests: ParsedOutput["tests"] = [];
  const noise: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith(PROTOCOL_PREFIX + "\t")) {
      noise.push(line);
      continue;
    }
    const [, status, name, ...rest] = line.split("\t");
    const message = unescapeField(rest.join("\t"));
    tests.push({
      name: unescapeField(name ?? "").trim() || "unnamed test",
      status: status === "pass" ? "pass" : status === "fail" ? "fail" : "error",
      message: message || undefined,
    });
  }

  return { tests, stdout: noise.join("\n").replace(/\n+$/, "") };
}

function unescapeField(field: string): string {
  return field
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}
