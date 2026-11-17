// JUCE's documented native-function protocol. No browser storage or network is used.
export class ReferenceBridge {
  constructor(juce) {
    if (!juce?.initialisationData?.crestReference?.[0] || !juce.backend)
      throw new Error("Open this viewer inside Crest Chord Reference, not in a browser tab.");
    this.backend = juce.backend;
    this.pending = new Map();
    this.sequence = 0;
    this.onRestore = () => {};
    this.backend.addEventListener("__juce__complete", ({ promiseId, result }) => {
      const pending = this.pending.get(promiseId);
      if (!pending) return;
      this.pending.delete(promiseId);
      clearTimeout(pending.timeout);
      pending.resolve(result);
    });
    this.backend.addEventListener("crestReferenceRestore", (snapshot) => this.onRestore(snapshot));
  }

  call(name, ...params) {
    const resultId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(resultId);
        reject(new Error("The plug-in did not acknowledge the change. Keep the JSON and retry before closing."));
      }, 10000);
      this.pending.set(resultId, { resolve, reject, timeout });
      try {
        this.backend.emitEvent("__juce__invoke", { name, params, resultId });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(resultId);
        reject(error);
      }
    });
  }

  read() { return this.call("crestReferenceGetState"); }
  write(payload) { return this.call("crestReferenceSetState", JSON.stringify(payload)); }
}
