// Monaco's worker entry point.
//
// Monaco's AMD build loads its language workers by URL, and each worker has to
// bootstrap the AMD loader for itself before it can pull in the module it
// actually needs (the TypeScript service, the JSON service, …). `workerMain.js`
// is that self-contained bootstrap; `baseUrl` is how it finds its siblings.
//
// This is a real file rather than the `data:`/`blob:` URL the Monaco docs use
// for cross-origin setups: Chrome refuses to construct a Worker from a `data:`
// URL, and we serve Monaco from our own origin anyway, so the simplest thing
// that can possibly work is a static script.
// `baseUrl` is the directory CONTAINING `vs/`, not `vs/` itself — module ids
// already start with "vs/", so pointing it at /dojo/vs makes the loader look
// for /dojo/vs/vs/... and throw a bare "Not Found" from inside the worker.
self.MonacoEnvironment = { baseUrl: "/dojo/" };
self.importScripts("/dojo/vs/base/worker/workerMain.js");
