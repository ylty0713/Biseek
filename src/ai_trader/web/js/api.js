export function backendBase() {
  return location.protocol === "http:" || location.protocol === "https:" ? "" : "http://127.0.0.1:8000";
}

export async function api(path, options = {}) {
  const response = await fetch(`${backendBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchJson(url) {
  if (!url) throw new Error("API URL is empty");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
