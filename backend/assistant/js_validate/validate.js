// backend/assistant/js_validate/validate.js
//
// Syntax-checks a single JS/JSX/TS/TSX file's source before the builder
// commits it to disk. Reads the source from stdin, the loader
// ("js" | "jsx" | "ts" | "tsx") from argv[2].
//
// This only *parses and transforms* the source (esbuild.transformSync) -
// it never executes it, and it never touches the network or filesystem
// beyond requiring esbuild itself. It does not type-check TS, only
// parses it, which is enough to catch the class of error we care about
// (mismatched braces, invalid JSX expressions, stray tokens, etc).
//
// Exit code 0 + prints "OK"  -> source parses cleanly.
// Exit code 1 + prints JSON  -> source has a syntax error; JSON has
//   {"message": ..., "line": ..., "column": ..., "snippet": ...}.
// Exit code 2 + prints JSON  -> esbuild itself isn't available (not
//   installed yet) or some other setup problem; the caller should treat
//   this as "couldn't validate" rather than "invalid", i.e. fail open.

let esbuild;
try {
  esbuild = require("esbuild");
} catch (err) {
  process.stdout.write(JSON.stringify({ message: `esbuild not installed: ${err.message}` }));
  process.exit(2);
}

const loaderArg = process.argv[2] || "jsx";
const validLoaders = new Set(["js", "jsx", "ts", "tsx"]);
const loader = validLoaders.has(loaderArg) ? loaderArg : "jsx";

let source = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { source += chunk; });
process.stdin.on("end", () => {
  try {
    esbuild.transformSync(source, {
      loader,
      jsx: "automatic",
      // Syntax-only: don't require a tsconfig, don't resolve imports,
      // don't minify - we just want to know if it parses.
      logLevel: "silent",
    });
    process.stdout.write("OK");
    process.exit(0);
  } catch (err) {
    const detail = (err.errors && err.errors[0]) || {};
    const loc = detail.location || {};
    process.stdout.write(JSON.stringify({
      message: detail.text || err.message || "Unknown syntax error",
      line: loc.line,
      column: loc.column,
      snippet: loc.lineText,
    }));
    process.exit(1);
  }
});