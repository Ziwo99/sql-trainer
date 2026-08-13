import { initDatabase, runQuery } from "./db.js";
import { validateQuery } from "./queryGuard.js";
import { compareResults } from "./grading.js";
import { loadSolvedIds, saveSolvedIds, resetSolvedIds, loadDrafts, saveDraft } from "./storage.js";

const DIFFICULTY_CLASS = { Facile: "easy", Moyen: "medium", Difficile: "hard" };

const TABLE_ORDER = ["customers", "employees", "categories", "products", "orders", "order_items"];
const TABLE_INFO = {
  customers: "Clients de la boutique.",
  employees: "Employés qui traitent les commandes.",
  categories: "Catégories de produits.",
  products: "Catalogue des produits.",
  orders: "Commandes passées par les clients.",
  order_items: "Lignes de détail de chaque commande (produits, quantités, prix).",
};

const el = (id) => document.getElementById(id);

let db;
let exercisesData;
let exercisesById = new Map();
let exercisesByCategory = new Map();
let solvedIds = loadSolvedIds();
let drafts = loadDrafts();
let currentExerciseId = null;

async function main() {
  try {
    const [dbInstance, exercisesJson] = await Promise.all([
      initDatabase(),
      fetchJson("data/exercises.json"),
    ]);
    db = dbInstance;
    exercisesData = exercisesJson;

    indexExercises();
    renderSidebar();
    renderTablesTab();
    wireGlobalEvents();
    selectExercise(exercisesData.exercises[0].id);

    el("loading").classList.add("hidden");
  } catch (err) {
    showFatalError(err);
  }
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Impossible de charger ${path} (HTTP ${res.status})`);
  return res.json();
}

function showFatalError(err) {
  const overlay = el("loading");
  overlay.textContent = "";
  const box = document.createElement("div");
  box.className = "loading-box error-box";
  const title = document.createElement("p");
  title.textContent = "Impossible de charger l'application.";
  const detail = document.createElement("p");
  detail.className = "error-detail";
  detail.textContent = (err && err.message) || String(err);
  box.append(title, detail);
  overlay.appendChild(box);
}

function indexExercises() {
  exercisesById = new Map(exercisesData.exercises.map((e) => [e.id, e]));
  exercisesByCategory = new Map(exercisesData.categories.map((c) => [c, []]));
  for (const ex of exercisesData.exercises) {
    if (!exercisesByCategory.has(ex.category)) exercisesByCategory.set(ex.category, []);
    exercisesByCategory.get(ex.category).push(ex);
  }
}

// ---------------------------------------------------------------- Sidebar

function renderSidebar() {
  const nav = el("category-nav");
  nav.textContent = "";

  for (const cat of exercisesData.categories) {
    const exs = exercisesByCategory.get(cat) || [];

    const details = document.createElement("details");
    details.className = "category-group";
    details.dataset.category = cat;

    const summary = document.createElement("summary");
    const nameSpan = document.createElement("span");
    nameSpan.className = "category-name";
    nameSpan.textContent = cat;
    const countSpan = document.createElement("span");
    countSpan.className = "category-count";
    countSpan.dataset.role = "count";
    summary.append(nameSpan, countSpan);
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "exercise-list";
    for (const ex of exs) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "exercise-item";
      btn.dataset.exerciseId = ex.id;

      const check = document.createElement("span");
      check.className = "check-icon";
      check.dataset.role = "check";
      check.setAttribute("aria-hidden", "true");

      const dot = document.createElement("span");
      dot.className = `difficulty-dot difficulty-${DIFFICULTY_CLASS[ex.difficulty] || ""}`;
      dot.title = ex.difficulty;

      const label = document.createElement("span");
      label.className = "exercise-item-title";
      label.textContent = ex.title;

      btn.append(check, dot, label);
      btn.addEventListener("click", () => selectExercise(ex.id));
      li.appendChild(btn);
      list.appendChild(li);
    }
    details.appendChild(list);
    nav.appendChild(details);
  }

  updateSidebarState();
}

function updateSidebarState() {
  const total = exercisesData.exercises.length;
  const solved = exercisesData.exercises.filter((e) => solvedIds.has(e.id)).length;
  el("progress-fill").style.width = total ? `${(solved / total) * 100}%` : "0%";
  el("progress-label").textContent = `${solved} / ${total} exercices résolus`;

  document.querySelectorAll(".category-group").forEach((details) => {
    const cat = details.dataset.category;
    const exs = exercisesByCategory.get(cat) || [];
    const solvedInCat = exs.filter((e) => solvedIds.has(e.id)).length;
    details.querySelector('[data-role="count"]').textContent = `${solvedInCat}/${exs.length}`;
  });

  document.querySelectorAll(".exercise-item").forEach((btn) => {
    const id = btn.dataset.exerciseId;
    const isSolved = solvedIds.has(id);
    btn.classList.toggle("solved", isSolved);
    btn.classList.toggle("active", id === currentExerciseId);
    btn.querySelector('[data-role="check"]').textContent = isSolved ? "✓" : "";
  });
}

// ---------------------------------------------------------------- Exercise panel

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPrompt(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
}

function selectExercise(id) {
  const ex = exercisesById.get(id);
  if (!ex) return;
  currentExerciseId = id;

  document.querySelectorAll(".category-group").forEach((details) => {
    if (details.dataset.category === ex.category) details.open = true;
  });

  el("exercise-title").textContent = ex.title;
  el("badge-category").textContent = ex.category;
  el("badge-difficulty").textContent = ex.difficulty;
  el("badge-difficulty").className = `badge badge-difficulty difficulty-${DIFFICULTY_CLASS[ex.difficulty] || ""}`;
  el("exercise-prompt").innerHTML = renderPrompt(ex.prompt);
  el("exercise-hint").textContent = ex.hint || "Pas d'indice pour cet exercice.";
  el("exercise-solution").textContent = ex.solution;

  const draft = drafts[id];
  el("sql-input").value = draft !== undefined ? draft : "";

  el("feedback").hidden = true;
  el("result-wrapper").hidden = true;
  el("hint-details").open = false;
  el("solution-details").open = false;

  updateSidebarState();
}

function handleRun() {
  const ex = exercisesById.get(currentExerciseId);
  if (!ex) return;
  const sqlText = el("sql-input").value;
  const feedback = el("feedback");
  const resultWrapper = el("result-wrapper");

  try {
    const validated = validateQuery(sqlText);
    const userResult = runQuery(db, validated);
    renderResultTable(el("result-table"), userResult);
    resultWrapper.hidden = false;

    const expectedResult = runQuery(db, ex.solution);
    const { ok, message } = compareResults(userResult, expectedResult, ex.orderMatters);

    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = `feedback ${ok ? "feedback-success" : "feedback-error"}`;

    if (ok && !solvedIds.has(ex.id)) {
      solvedIds.add(ex.id);
      saveSolvedIds(solvedIds);
      updateSidebarState();
    }
  } catch (err) {
    resultWrapper.hidden = true;
    feedback.hidden = false;
    feedback.textContent = `Erreur SQL : ${err.message}`;
    feedback.className = "feedback feedback-error";
  }
}

function renderResultTable(container, result) {
  container.textContent = "";
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of result.columns) {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  if (result.rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = Math.max(result.columns.length, 1);
    td.className = "empty-cell";
    td.textContent = "Aucune ligne retournée.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (const row of result.rows) {
      const tr = document.createElement("tr");
      for (const cell of row) {
        const td = document.createElement("td");
        if (cell === null || cell === undefined) {
          td.textContent = "NULL";
          td.className = "null-cell";
        } else {
          td.textContent = String(cell);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// ---------------------------------------------------------------- Tables tab

function renderTablesTab() {
  const tabsContainer = el("table-tabs");
  const contentContainer = el("table-content");
  tabsContainer.textContent = "";

  function renderContent(tableName) {
    contentContainer.textContent = "";

    const desc = document.createElement("p");
    desc.className = "table-desc";
    desc.textContent = TABLE_INFO[tableName] || "";
    contentContainer.appendChild(desc);

    const schemaResult = runQuery(db, `PRAGMA table_info(${tableName});`);
    const nameIdx = schemaResult.columns.indexOf("name");
    const typeIdx = schemaResult.columns.indexOf("type");
    const notnullIdx = schemaResult.columns.indexOf("notnull");
    const pkIdx = schemaResult.columns.indexOf("pk");

    const schemaTable = document.createElement("table");
    schemaTable.className = "schema-table";
    const schemaThead = document.createElement("thead");
    const schemaHeadRow = document.createElement("tr");
    ["colonne", "type", "not null", "clé primaire"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      schemaHeadRow.appendChild(th);
    });
    schemaThead.appendChild(schemaHeadRow);
    schemaTable.appendChild(schemaThead);

    const schemaTbody = document.createElement("tbody");
    for (const row of schemaResult.rows) {
      const tr = document.createElement("tr");
      [row[nameIdx], row[typeIdx], row[notnullIdx] ? "oui" : "non", row[pkIdx] ? "oui" : "non"].forEach((v) => {
        const td = document.createElement("td");
        td.textContent = String(v);
        tr.appendChild(td);
      });
      schemaTbody.appendChild(tr);
    }
    schemaTable.appendChild(schemaTbody);
    contentContainer.appendChild(schemaTable);

    const dataResult = runQuery(db, `SELECT * FROM ${tableName};`);
    const countLabel = document.createElement("p");
    countLabel.className = "row-count";
    countLabel.textContent = `${dataResult.rows.length} lignes`;
    contentContainer.appendChild(countLabel);

    const dataWrapper = document.createElement("div");
    dataWrapper.className = "table-scroll";
    contentContainer.appendChild(dataWrapper);
    renderResultTable(dataWrapper, dataResult);
  }

  TABLE_ORDER.forEach((tableName, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "table-tab-btn" + (idx === 0 ? " active" : "");
    btn.textContent = tableName;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".table-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderContent(tableName);
    });
    tabsContainer.appendChild(btn);
  });

  renderContent(TABLE_ORDER[0]);
}

// ---------------------------------------------------------------- Global wiring

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function wireGlobalEvents() {
  el("run-btn").addEventListener("click", handleRun);

  el("sql-input").addEventListener("input", () => {
    if (!currentExerciseId) return;
    const value = el("sql-input").value;
    drafts[currentExerciseId] = value;
    saveDraft(currentExerciseId, value);
  });

  el("sql-input").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  });

  el("reset-btn").addEventListener("click", () => {
    if (!confirm("Réinitialiser toute ta progression ?")) return;
    solvedIds = new Set();
    resetSolvedIds();
    updateSidebarState();
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

main();
