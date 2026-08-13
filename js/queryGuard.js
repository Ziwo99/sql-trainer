// Validation des requetes utilisateur : lecture seule uniquement (SELECT / WITH),
// une seule instruction a la fois. Miroir cote client d'une regle simple, pas une
// vraie frontiere de securite (tout tourne dans le navigateur de l'utilisateur,
// sur ses propres donnees) : ca evite surtout les erreurs de manipulation
// accidentelles (DROP/DELETE) qui casseraient la base en memoire pour le reste
// de la session.

const FORBIDDEN_KEYWORDS = [
  "insert", "update", "delete", "drop", "alter", "create", "replace",
  "attach", "detach", "pragma", "vacuum", "reindex", "truncate", "begin", "commit",
];

export class UnsafeQueryError extends Error {}

function stripComments(sql) {
  return sql
    .replace(/--.*?(\n|$)/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

export function validateQuery(sql) {
  const cleaned = stripComments(sql).trim();
  if (!cleaned) {
    throw new UnsafeQueryError("La requête est vide.");
  }

  const body = cleaned.endsWith(";") ? cleaned.slice(0, -1) : cleaned;
  if (body.includes(";")) {
    throw new UnsafeQueryError("Une seule requête à la fois (pas de ';' au milieu).");
  }

  const lowered = body.toLowerCase();
  if (!(lowered.startsWith("select") || lowered.startsWith("with"))) {
    throw new UnsafeQueryError("Seules les requêtes SELECT (ou WITH ... SELECT) sont autorisées.");
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(lowered)) {
      throw new UnsafeQueryError(`Le mot-clé '${kw.toUpperCase()}' n'est pas autorisé dans cet exercice.`);
    }
  }

  return body;
}
