const KEY = "crest-chord-builder.preferences";

export function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      theme: value.theme === "light" ? "light" : "dark",
      labels: value.labels === "notes" ? "notes" : "intervals",
    };
  } catch {
    return { theme: "dark", labels: "intervals" };
  }
}

export function savePreferences({ theme, labels }) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme, labels }));
  } catch {
    /* Project export remains available when storage is disabled. */
  }
}
