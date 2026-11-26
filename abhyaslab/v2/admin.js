import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  ref,
  onValue,
  push,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const state = {
  user: null,
  authMode: "signin", // "signin" | "signup"
  repos: {},
  questionsByRepo: {},
  selectedRepoId: null,
  repoSearch: "",
  questionSearch: "",
  pendingConfirmAction: null,
  unsubRepos: null,
  unsubQuestions: null
};

// DOM elements
const authLoading = document.getElementById("auth-loading");
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const adminUserPill = document.getElementById("admin-user-pill");
const signOutBtn = document.getElementById("sign-out-btn");

const tabSignin = document.getElementById("tab-signin");
const tabSignup = document.getElementById("tab-signup");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authNotice = document.getElementById("auth-notice");

const adminStats = document.getElementById("admin-stats");
const dbPermissionBanner = document.getElementById("db-permission-banner");
const adminRepoSearch = document.getElementById("admin-repo-search");
const adminRepoList = document.getElementById("admin-repo-list");
const newRepoBtn = document.getElementById("new-repo-btn");
const emptyCreateRepoBtn = document.getElementById("empty-create-repo-btn");
const exportJsonBtn = document.getElementById("export-json-btn");
const importJsonInput = document.getElementById("import-json-input");

const noRepoSelected = document.getElementById("no-repo-selected");
const repoWorkspace = document.getElementById("repo-workspace");
const selectedRepoName = document.getElementById("selected-repo-name");
const selectedRepoCount = document.getElementById("selected-repo-count");
const selectedRepoDesc = document.getElementById("selected-repo-desc");
const editSelectedRepoBtn = document.getElementById("edit-selected-repo-btn");
const deleteSelectedRepoBtn = document.getElementById("delete-selected-repo-btn");
const openAddQuestionBtn = document.getElementById("open-add-question-btn");

const questionForm = document.getElementById("question-form");
const questionFormTitle = document.getElementById("question-form-title");
const cancelQuestionFormBtn = document.getElementById("cancel-question-form-btn");
const editingQuestionId = document.getElementById("editing-question-id");
const qNumber = document.getElementById("q-number");
const qLanguage = document.getElementById("q-language");
const qText = document.getElementById("q-text");
const qAnswer = document.getElementById("q-answer");
const saveQuestionBtn = document.getElementById("save-question-btn");
const adminQuestionSearch = document.getElementById("admin-question-search");
const adminQuestionList = document.getElementById("admin-question-list");

const repoModal = document.getElementById("repo-modal");
const repoModalTitle = document.getElementById("repo-modal-title");
const closeRepoModalBtn = document.getElementById("close-repo-modal");
const cancelRepoModalBtn = document.getElementById("cancel-repo-modal-btn");
const repoForm = document.getElementById("repo-form");
const editingRepoId = document.getElementById("editing-repo-id");
const repoNameInput = document.getElementById("repo-name-input");
const repoDescInput = document.getElementById("repo-desc-input");
const repoOrderInput = document.getElementById("repo-order-input");

const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalMessage = document.getElementById("confirm-modal-message");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmNoBtn = document.getElementById("confirm-no-btn");
const closeConfirmModalBtn = document.getElementById("close-confirm-modal");

const previewModal = document.getElementById("preview-modal");
const previewModalTitle = document.getElementById("preview-modal-title");
const previewModalSubtitle = document.getElementById("preview-modal-subtitle");
const previewQuestionBox = document.getElementById("preview-question-box");
const previewCodeContent = document.getElementById("preview-code-content");
const previewCopyBtn = document.getElementById("preview-copy-btn");
const previewCloseBtn = document.getElementById("preview-close-btn");
const closePreviewModalBtn = document.getElementById("close-preview-modal");

const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSortedRepos() {
  return Object.entries(state.repos || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 9999;
      const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

function getRepoQuestions(repoId) {
  const raw = state.questionsByRepo?.[repoId] || {};
  return Object.entries(raw)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      const numA = Number.isFinite(Number(a.number)) ? Number(a.number) : 99999;
      const numB = Number.isFinite(Number(b.number)) ? Number(b.number) : 99999;
      if (numA !== numB) return numA - numB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

function showDbPermissionHelp(err) {
  const msg = err?.message || "Database error";
  const uid = state.user?.uid || "<your-uid>";
  dbPermissionBanner.style.display = "block";
  dbPermissionBanner.innerHTML = `
    <strong>Firebase Database Notice:</strong> ${escapeHtml(msg)}<br />
    Make sure Firebase Realtime Database is created and its Rules allow authenticated writes (your UID: <code>${escapeHtml(uid)}</code>). See <code>database.rules.json</code> in your project folder.
  `;
}

function clearDbPermissionHelp() {
  dbPermissionBanner.style.display = "none";
  dbPermissionBanner.innerHTML = "";
}

// Auth UI helpers
function setAuthMode(mode) {
  state.authMode = mode;
  authNotice.style.display = "none";
  if (mode === "signin") {
    tabSignin.classList.add("active");
    tabSignup.classList.remove("active");
    authSubmitBtn.textContent = "Sign In to Dashboard";
  } else {
    tabSignup.classList.add("active");
    tabSignin.classList.remove("active");
    authSubmitBtn.textContent = "Create Admin Account";
  }
}

tabSignin.addEventListener("click", () => setAuthMode("signin"));
tabSignup.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authNotice.style.display = "none";
  const email = authEmail.value.trim();
  const password = authPassword.value;

  authSubmitBtn.disabled = true;
  try {
    if (state.authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Signed in successfully!");
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast("Admin account created and signed in!");
    }
  } catch (err) {
    let friendly = err?.message || "Authentication failed.";
    if (err?.code === "auth/operation-not-allowed") {
      friendly = "Email/Password sign-in is disabled in Firebase Console. Enable it in Authentication -> Sign-in method -> Email/Password.";
    } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
      friendly = "Invalid email or password. If you haven't created an admin account yet, switch to 'Create Admin Account'.";
    } else if (err?.code === "auth/email-already-in-use") {
      friendly = "This email is already registered. Switch to 'Sign In' to log in.";
    }
    authNotice.style.display = "block";
    authNotice.textContent = friendly;
  } finally {
    authSubmitBtn.disabled = false;
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Signed out.");
});

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  authLoading.style.display = "none";
  state.user = user;

  if (user) {
    authSection.style.display = "none";
    dashboardSection.style.display = "block";
    adminUserPill.style.display = "inline-flex";
    adminUserPill.textContent = user.email || "Admin";
    signOutBtn.style.display = "inline-flex";
    startDatabaseListeners();
  } else {
    stopDatabaseListeners();
    dashboardSection.style.display = "none";
    adminUserPill.style.display = "none";
    signOutBtn.style.display = "none";
    authSection.style.display = "block";
  }
});

function startDatabaseListeners() {
  stopDatabaseListeners();

  state.unsubRepos = onValue(
    ref(db, "repositories"),
    (snapshot) => {
      clearDbPermissionHelp();
      state.repos = snapshot.val() || {};
      const repos = getSortedRepos();

      if (state.selectedRepoId && !state.repos[state.selectedRepoId]) {
        state.selectedRepoId = repos[0]?.id || null;
      } else if (!state.selectedRepoId && repos.length > 0) {
        state.selectedRepoId = repos[0].id;
      }

      renderStats();
      renderRepoSidebar();
      renderWorkspace();
    },
    (err) => showDbPermissionHelp(err)
  );

  state.unsubQuestions = onValue(
    ref(db, "questions"),
    (snapshot) => {
      clearDbPermissionHelp();
      state.questionsByRepo = snapshot.val() || {};
      renderStats();
      renderRepoSidebar();
      renderWorkspace();
    },
    (err) => showDbPermissionHelp(err)
  );
}

function stopDatabaseListeners() {
  if (typeof state.unsubRepos === "function") {
    state.unsubRepos();
    state.unsubRepos = null;
  }
  if (typeof state.unsubQuestions === "function") {
    state.unsubQuestions();
    state.unsubQuestions = null;
  }
}

function renderStats() {
  const repos = getSortedRepos();
  let totalQuestions = 0;
  for (const r of repos) {
    totalQuestions += getRepoQuestions(r.id).length;
  }
  adminStats.textContent = `${repos.length} ${repos.length === 1 ? "Repository" : "Repositories"} • ${totalQuestions} ${totalQuestions === 1 ? "Key" : "Keys"}`;
}

function renderRepoSidebar() {
  const repos = getSortedRepos();
  const filter = state.repoSearch.trim().toLowerCase();
  const visible = filter
    ? repos.filter((r) => (r.name || "").toLowerCase().includes(filter))
    : repos;

  if (repos.length === 0) {
    adminRepoList.innerHTML = `
      <div style="text-align: center; padding: 24px 8px; color: var(--text-muted); font-size: 0.88rem;">
        No repositories yet. Click <strong>+ New Repo</strong> to create one.
      </div>
    `;
    return;
  }

  if (visible.length === 0) {
    adminRepoList.innerHTML = `
      <div style="text-align: center; padding: 20px 8px; color: var(--text-muted); font-size: 0.88rem;">
        No repositories match "${escapeHtml(state.repoSearch)}".
      </div>
    `;
    return;
  }

  adminRepoList.innerHTML = "";
  for (const repo of visible) {
    const count = getRepoQuestions(repo.id).length;
    const item = document.createElement("div");
    item.className = `repo-sidebar-item ${repo.id === state.selectedRepoId ? "active" : ""}`;
    item.innerHTML = `
      <div style="min-width: 0;">
        <div style="font-weight: 700; color: var(--blue-950); font-size: 0.93rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(repo.name)}
        </div>
        <div style="font-size: 0.77rem; color: var(--text-muted);">Order #${repo.order || 1}</div>
      </div>
      <span class="repo-count-badge">${count}</span>
    `;
    item.addEventListener("click", () => {
      state.selectedRepoId = repo.id;
      hideQuestionForm();
      renderRepoSidebar();
      renderWorkspace();
    });
    adminRepoList.appendChild(item);
  }
}

function renderWorkspace() {
  const repoId = state.selectedRepoId;
  const repo = repoId ? state.repos?.[repoId] : null;

  if (!repo) {
    noRepoSelected.style.display = "block";
    repoWorkspace.style.display = "none";
    return;
  }

  noRepoSelected.style.display = "none";
  repoWorkspace.style.display = "block";

  const questions = getRepoQuestions(repoId);
  selectedRepoName.textContent = repo.name;
  selectedRepoCount.textContent = `${questions.length} ${questions.length === 1 ? "CODE" : "CODES"}`;
  selectedRepoDesc.textContent = repo.description || "No description provided.";

  const qFilter = state.questionSearch.trim().toLowerCase();
  const visibleQuestions = qFilter
    ? questions.filter(
        (q) =>
          (q.question || "").toLowerCase().includes(qFilter) ||
          (q.answer || "").toLowerCase().includes(qFilter)
      )
    : questions;

  if (questions.length === 0) {
    adminQuestionList.innerHTML = `
      <div class="state-card">
        <h3>No questions in ${escapeHtml(repo.name)}</h3>
        <p>Click <strong>+ Add Question</strong> above to add the first question and answer key.</p>
      </div>
    `;
    return;
  }

  if (visibleQuestions.length === 0) {
    adminQuestionList.innerHTML = `
      <div class="state-card">
        <h3>No matching questions</h3>
        <p>No questions matched "${escapeHtml(state.questionSearch)}".</p>
      </div>
    `;
    return;
  }

  adminQuestionList.innerHTML = "";
  visibleQuestions.forEach((item, idx) => {
    const num = item.number || idx + 1;
    const card = document.createElement("div");
    card.className = "admin-question-card";
    card.innerHTML = `
      <div class="admin-question-head">
        <div>
          <div class="admin-question-title">
            <span style="color: var(--blue-600);">&#9670;</span> ${num}. ${escapeHtml(item.question)}
          </div>
          <div style="margin-top: 4px;">
            <span class="repo-count-badge">${escapeHtml(item.language || "CODE")}</span>
          </div>
        </div>
        <div class="admin-question-actions">
          <button type="button" class="btn btn-outline btn-sm btn-preview">Preview / Copy</button>
          <button type="button" class="btn btn-outline btn-sm btn-edit-q">Edit</button>
          <button type="button" class="btn btn-outline btn-sm btn-del-q">Delete</button>
        </div>
      </div>
      <div class="code-preview-mini">${escapeHtml(item.answer)}</div>
    `;

    card.querySelector(".btn-preview").addEventListener("click", () => openPreviewModal(repo, item, num));
    card.querySelector(".btn-edit-q").addEventListener("click", () => startEditQuestion(item, num));
    card.querySelector(".btn-del-q").addEventListener("click", () => confirmDeleteQuestion(repoId, item, num));
    adminQuestionList.appendChild(card);
  });
}

// Repository Create / Edit Modal
function openRepoModal(repoId = null) {
  if (repoId && state.repos?.[repoId]) {
    const repo = state.repos[repoId];
    editingRepoId.value = repoId;
    repoModalTitle.textContent = "Edit Repository";
    repoNameInput.value = repo.name || "";
    repoDescInput.value = repo.description || "";
    repoOrderInput.value = repo.order || 1;
  } else {
    editingRepoId.value = "";
    repoModalTitle.textContent = "New Repository";
    repoNameInput.value = "";
    repoDescInput.value = "";
    repoOrderInput.value = getSortedRepos().length + 1;
  }
  repoModal.classList.add("open");
  setTimeout(() => repoNameInput.focus(), 50);
}

function closeRepoModal() {
  repoModal.classList.remove("open");
}

repoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = repoNameInput.value.trim();
  const description = repoDescInput.value.trim();
  const order = Number(repoOrderInput.value) || 1;
  const id = editingRepoId.value;
  if (!name) return;

  try {
    const now = Date.now();
    if (id) {
      await update(ref(db, `repositories/${id}`), {
        name,
        description,
        order,
        updatedAt: now
      });
      showToast("Repository updated!");
    } else {
      const newRef = push(ref(db, "repositories"));
      await set(newRef, {
        name,
        description,
        order,
        createdAt: now,
        updatedAt: now
      });
      state.selectedRepoId = newRef.key;
      showToast("Repository created!");
    }
    closeRepoModal();
  } catch (err) {
    showDbPermissionHelp(err);
    showToast("Failed to save repository.");
  }
});

// Question Form Add / Edit
function openAddQuestionForm() {
  if (!state.selectedRepoId) return;
  const existing = getRepoQuestions(state.selectedRepoId);
  const maxNum = existing.reduce((max, q) => Math.max(max, Number(q.number) || 0), 0);

  editingQuestionId.value = "";
  questionFormTitle.textContent = "Add New Question";
  saveQuestionBtn.textContent = "Save Question & Answer";
  qNumber.value = maxNum + 1;
  qLanguage.value = qLanguage.value || "Python";
  qText.value = "";
  qAnswer.value = "";
  questionForm.style.display = "block";
  qText.focus();
}

function startEditQuestion(item, num) {
  editingQuestionId.value = item.id;
  questionFormTitle.textContent = `Edit Question #${num}`;
  saveQuestionBtn.textContent = "Update Question & Answer";
  qNumber.value = item.number || num;
  qLanguage.value = item.language || "Python";
  qText.value = item.question || "";
  qAnswer.value = item.answer || "";
  questionForm.style.display = "block";
  questionForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  qText.focus();
}

function hideQuestionForm() {
  questionForm.style.display = "none";
  editingQuestionId.value = "";
}

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const repoId = state.selectedRepoId;
  if (!repoId) return;

  const number = Number(qNumber.value) || 1;
  const language = qLanguage.value.trim() || "Code";
  const question = qText.value.trim();
  const answer = qAnswer.value;
  if (!question || !answer.trim()) return;

  saveQuestionBtn.disabled = true;
  try {
    const now = Date.now();
    const qId = editingQuestionId.value;
    if (qId) {
      await update(ref(db, `questions/${repoId}/${qId}`), {
        number,
        language,
        question,
        answer,
        updatedAt: now
      });
      showToast("Question updated!");
    } else {
      const newQRef = push(ref(db, `questions/${repoId}`));
      await set(newQRef, {
        number,
        language,
        question,
        answer,
        createdAt: now,
        updatedAt: now
      });
      showToast("Question & answer added!");
    }
    hideQuestionForm();
  } catch (err) {
    showDbPermissionHelp(err);
    showToast("Failed to save question.");
  } finally {
    saveQuestionBtn.disabled = false;
  }
});

// Support Tab key indentation inside answer code editor
qAnswer.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = qAnswer.selectionStart;
    const end = qAnswer.selectionEnd;
    qAnswer.value = qAnswer.value.substring(0, start) + "    " + qAnswer.value.substring(end);
    qAnswer.selectionStart = qAnswer.selectionEnd = start + 4;
  }
});

// Delete Confirmation Modal
function openConfirmModal(title, message, onConfirm) {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  state.pendingConfirmAction = onConfirm;
  confirmModal.classList.add("open");
}

function closeConfirmModal() {
  confirmModal.classList.remove("open");
  state.pendingConfirmAction = null;
}

confirmYesBtn.addEventListener("click", async () => {
  const fn = state.pendingConfirmAction;
  closeConfirmModal();
  if (typeof fn === "function") {
    await fn();
  }
});

function confirmDeleteSelectedRepo() {
  const repoId = state.selectedRepoId;
  const repo = state.repos?.[repoId];
  if (!repoId || !repo) return;

  const qCount = getRepoQuestions(repoId).length;
  openConfirmModal(
    "Delete Repository",
    `Delete "${repo.name}" and all ${qCount} ${qCount === 1 ? "question" : "questions"} inside it? This cannot be undone.`,
    async () => {
      try {
        await remove(ref(db, `repositories/${repoId}`));
        await remove(ref(db, `questions/${repoId}`));
        showToast("Repository deleted.");
      } catch (err) {
        showDbPermissionHelp(err);
        showToast("Failed to delete repository.");
      }
    }
  );
}

function confirmDeleteQuestion(repoId, item, num) {
  openConfirmModal(
    "Delete Question",
    `Delete Question #${num}: "${item.question}"?`,
    async () => {
      try {
        await remove(ref(db, `questions/${repoId}/${item.id}`));
        showToast("Question deleted.");
      } catch (err) {
        showDbPermissionHelp(err);
        showToast("Failed to delete question.");
      }
    }
  );
}

// Preview Modal
function openPreviewModal(repo, item, num) {
  previewModalTitle.textContent = `Question ${num}`;
  previewModalSubtitle.textContent = repo.name;
  previewQuestionBox.textContent = `${num}. ${item.question}`;
  previewCodeContent.textContent = item.answer || "";
  previewCopyBtn.textContent = "COPY";
  previewCopyBtn.classList.remove("copied");
  previewModal.classList.add("open");
}

previewCopyBtn.addEventListener("click", async () => {
  const text = previewCodeContent.textContent || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    previewCopyBtn.textContent = "✓ COPIED";
    previewCopyBtn.classList.add("copied");
    showToast("Answer copied!");
  } catch {
    showToast("Copy failed.");
  }
});

// Export / Import JSON Backup
exportJsonBtn.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    repositories: state.repos,
    questions: state.questionsByRepo
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `abhyas-lab-keys-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported as JSON!");
});

importJsonInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !data.repositories) {
      showToast("Invalid backup JSON format.");
      return;
    }

    openConfirmModal(
      "Import JSON Backup",
      "This will merge imported repositories and questions into Firebase Realtime Database. Continue?",
      async () => {
        const updates = {};
        for (const [rId, repo] of Object.entries(data.repositories || {})) {
          updates[`repositories/${rId}`] = repo;
        }
        for (const [rId, qMap] of Object.entries(data.questions || {})) {
          for (const [qId, qObj] of Object.entries(qMap || {})) {
            updates[`questions/${rId}/${qId}`] = qObj;
          }
        }
        await update(ref(db), updates);
        showToast("JSON imported successfully!");
      }
    );
  } catch {
    showToast("Could not parse JSON file.");
  }
});

// Listeners
adminRepoSearch.addEventListener("input", (e) => {
  state.repoSearch = e.target.value;
  renderRepoSidebar();
});

adminQuestionSearch.addEventListener("input", (e) => {
  state.questionSearch = e.target.value;
  renderWorkspace();
});

newRepoBtn.addEventListener("click", () => openRepoModal());
emptyCreateRepoBtn.addEventListener("click", () => openRepoModal());
editSelectedRepoBtn.addEventListener("click", () => openRepoModal(state.selectedRepoId));
deleteSelectedRepoBtn.addEventListener("click", confirmDeleteSelectedRepo);
openAddQuestionBtn.addEventListener("click", openAddQuestionForm);
cancelQuestionFormBtn.addEventListener("click", hideQuestionForm);

closeRepoModalBtn.addEventListener("click", closeRepoModal);
cancelRepoModalBtn.addEventListener("click", closeRepoModal);
closeConfirmModalBtn.addEventListener("click", closeConfirmModal);
confirmNoBtn.addEventListener("click", closeConfirmModal);

const closePreview = () => previewModal.classList.remove("open");
closePreviewModalBtn.addEventListener("click", closePreview);
previewCloseBtn.addEventListener("click", closePreview);

[repoModal, confirmModal, previewModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRepoModal();
    closeConfirmModal();
    closePreview();
  }
});
