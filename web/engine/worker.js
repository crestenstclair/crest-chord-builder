importScripts("./wasm_exec.js");
let ready;
async function startEngine() {
  const go = new Go();
  const response = await fetch("./chords.wasm");
  if (!response.ok)
    throw new Error(
      "Could not load the voicing engine. Reload or rebuild the site.",
    );
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
    go.importObject,
  );
  go.run(instance).then(
    () => self.postMessage({ engineFailed: true, error: "Voicing engine stopped. Retry the search." }),
    (error) => self.postMessage({ engineFailed: true, error: error.message }),
  );
}
self.onmessage = async ({ data: { id, request } }) => {
  try {
    ready ??= startEngine();
    await ready;
    self.postMessage({
      id,
      ...JSON.parse(self.crestGenerate(JSON.stringify(request))),
    });
  } catch (error) {
    self.postMessage({ id, error: error.message, engineFailed: true });
  }
};
