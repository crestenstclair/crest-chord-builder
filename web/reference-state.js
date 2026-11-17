import { parseProject } from "./project.js";

export const REFERENCE_STATE_FORMAT = "crest-chord-reference";

export function referencePreferences(value = {}, project = null) {
  return {
    theme: value.theme === "light" ? "light" : "dark",
    labels: value.labels === "notes" ? "notes" : "intervals",
    zoom: Number.isFinite(value.zoom) ? Math.max(80, Math.min(150, value.zoom)) : 100,
    start: Number.isInteger(value.start) ? Math.max(0, Math.min(12, value.start)) : 0,
    partId: project?.parts.some((part) => part.id === value.partId) ? value.partId : project?.parts[0].id ?? "",
  };
}

export function parseReferenceSnapshot(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.generation) || snapshot.generation < 1)
    throw new Error("Invalid plug-in state revision.");
  const project = snapshot.projectJSON ? parseProject(snapshot.projectJSON) : null;
  return { generation: snapshot.generation, project, ui: referencePreferences(snapshot.ui, project) };
}

export function referencePayload(project, ui, generation) {
  return { generation, projectJSON: project ? JSON.stringify(parseProject(project)) : "", ui: referencePreferences(ui, project) };
}
