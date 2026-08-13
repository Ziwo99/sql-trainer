// Synchronisation de la progression via l'API Contents de GitHub, pour avoir
// le meme etat sur plusieurs appareils sans backend. L'ecriture necessite un
// token d'acces personnel (PAT) scope sur ce repo (Contents: Read & write),
// colle une fois par appareil et stocke dans le localStorage de ce navigateur.

const OWNER = "Ziwo99";
const REPO = "sql-trainer";
const BRANCH = "main";
const PATH = "data/progress.json";
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function authHeaders(token) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `token ${token}`;
  return headers;
}

export async function fetchRemoteProgress(token) {
  const res = await fetch(`${API_URL}?ref=${BRANCH}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture GitHub impossible (HTTP ${res.status})`);
  const data = await res.json();
  return JSON.parse(fromBase64(data.content));
}

export async function pushProgress(state, token) {
  if (!token) throw new Error("Aucun token GitHub configuré.");

  let sha;
  const getRes = await fetch(`${API_URL}?ref=${BRANCH}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (getRes.ok) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    throw new Error(`Lecture GitHub impossible (HTTP ${getRes.status})`);
  }

  const body = {
    message: `Progression : ${state.solvedIds.length} exercice(s) résolu(s)`,
    content: toBase64(JSON.stringify(state, null, 2)),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(API_URL, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const errBody = await putRes.json().catch(() => ({}));
    throw new Error(errBody.message || `Écriture GitHub impossible (HTTP ${putRes.status})`);
  }

  return putRes.json();
}
