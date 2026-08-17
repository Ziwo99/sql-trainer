// Persistance locale (localStorage) : progression resolue, brouillons de requetes,
// flags personnels et token GitHub pour la synchronisation.

const SOLVED_KEY = "sqltrainer.solvedIds.v1";
const DRAFTS_KEY = "sqltrainer.drafts.v1";
const FLAGS_KEY = "sqltrainer.flags.v1";
const TOKEN_KEY = "sqltrainer.github_token.v1";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // localStorage indisponible (navigation privee, quota depasse...) : on ignore.
  }
}

export function loadSolvedIds() {
  const raw = safeGet(SOLVED_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

export function saveSolvedIds(solvedIdsSet) {
  safeSet(SOLVED_KEY, JSON.stringify([...solvedIdsSet]));
}

export function resetSolvedIds() {
  try {
    localStorage.removeItem(SOLVED_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function loadDrafts() {
  const raw = safeGet(DRAFTS_KEY);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

export function saveDraft(exerciseId, sqlText) {
  const drafts = loadDrafts();
  drafts[exerciseId] = sqlText;
  safeSet(DRAFTS_KEY, JSON.stringify(drafts));
}

export function resetDrafts() {
  try {
    localStorage.removeItem(DRAFTS_KEY);
  } catch (e) {
    /* ignore */
  }
}

// Flags personnels (facile/moyen/difficile "a refaire") : independants de la
// progression, ne sont jamais effaces par la reinitialisation.
export function loadFlags() {
  const raw = safeGet(FLAGS_KEY);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

export function saveFlags(flags) {
  safeSet(FLAGS_KEY, JSON.stringify(flags));
}

export function loadToken() {
  return safeGet(TOKEN_KEY) || "";
}

export function saveToken(token) {
  safeSet(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    /* ignore */
  }
}
