// Chargement de SQLite dans le navigateur (sql.js / WebAssembly) et execution
// des requetes. La base est "fixe" : construite une fois au demarrage depuis
// data/schema.sql + data/seed.sql, puis gardee en memoire pour toute la session.

const SQLJS_CDN = "https://cdn.jsdelivr.net/npm/sql.js@latest/dist/";

let sqlModulePromise = null;

function loadSqlJs() {
  if (!sqlModulePromise) {
    sqlModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SQLJS_CDN + "sql-wasm.js";
      script.onload = () => {
        // initSqlJs est expose globalement par le script ci-dessus.
        window
          .initSqlJs({ locateFile: (file) => SQLJS_CDN + file })
          .then(resolve, reject);
      };
      script.onerror = () => reject(new Error("Impossible de charger sql.js depuis le CDN."));
      document.head.appendChild(script);
    });
  }
  return sqlModulePromise;
}

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Impossible de charger ${path} (HTTP ${res.status})`);
  }
  return res.text();
}

export async function initDatabase() {
  const [SQL, schemaSql, seedSql] = await Promise.all([
    loadSqlJs(),
    fetchText("data/schema.sql"),
    fetchText("data/seed.sql"),
  ]);
  const db = new SQL.Database();
  db.run(schemaSql);
  db.run(seedSql);
  return db;
}

/**
 * Execute une requete (deja validee en amont) et retourne {columns, rows}.
 * Fonctionne meme pour un resultat a zero ligne (contrairement a db.exec()).
 */
export function runQuery(db, sql) {
  const stmt = db.prepare(sql);
  try {
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.get());
    }
    return { columns, rows };
  } finally {
    stmt.free();
  }
}
