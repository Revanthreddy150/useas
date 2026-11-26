import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const state = {
  repos: {},
  questionsByRepo: {},
  questionSearchQuery: "",
  activeRepoId: null,
  activeQuestionId: null,
  loadedRepos: false,
  loadedQuestions: false,
  dbError: null
};

// DOM references
const repoGrid = document.getElementById("repo-grid");

const questionsModal = document.getElementById("questions-modal");
const questionsModalTitle = document.getElementById("questions-modal-title");
const questionsModalSubtitle = document.getElementById("questions-modal-subtitle");
const questionSearchInput = document.getElementById("question-search-input");
const questionList = document.getElementById("question-list");
const closeQuestionsModalBtn = document.getElementById("close-questions-modal");

const answerModal = document.getElementById("answer-modal");
const answerModalTitle = document.getElementById("answer-modal-title");
const answerModalRepo = document.getElementById("answer-modal-repo");
const answerQuestionText = document.getElementById("answer-question-text");
const answerLanguageLabel = document.getElementById("answer-language-label");
const answerCodeContent = document.getElementById("answer-code-content");
const copyAnswerBtn = document.getElementById("copy-answer-btn");
const backToQuestionsBtn = document.getElementById("back-to-questions-btn");
const closeAnswerModalBtn = document.getElementById("close-answer-modal");

const toastEl = document.getElementById("toast");
let toastTimer = null;
let copyResetTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2400);
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

function renderRepositories() {
  if (state.dbError) {
    repoGrid.innerHTML = `
      <div class="state-card">
        <h3>Unable to load repositories</h3>
        <p>${escapeHtml(state.dbError)}</p>
        <a href="./admin.html" class="btn btn-primary btn-sm">Open Admin Portal</a>
      </div>
    `;
    return;
  }

  if (!state.loadedRepos || !state.loadedQuestions) {
    return;
  }

  const repos = getSortedRepos();

  if (repos.length === 0) {
    repoGrid.innerHTML = `
      <div class="state-card">
        <h3>No repositories yet</h3>
        <p>Repositories and questions added from the Admin Portal will appear here automatically.</p>
        <a href="./admin.html" class="btn btn-primary btn-sm">Open Admin Portal</a>
      </div>
    `;
    return;
  }

  repoGrid.innerHTML = "";
  for (const repo of repos) {
    const count = getRepoQuestions(repo.id).length;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "repo-card";
    card.setAttribute("data-repo-id", repo.id);

    card.innerHTML = `
      <span class="repo-count-badge">${count} ${count === 1 ? "CODE" : "CODES"}</span>
      <div class="repo-title">${escapeHtml(repo.name)} (${count})</div>
      <div class="repo-action">VIEW REPOSITORY</div>
    `;

    card.addEventListener("click", () => openQuestionsModal(repo.id));
    repoGrid.appendChild(card);
  }
}

function openQuestionsModal(repoId) {
  const repo = state.repos?.[repoId];
  if (!repo) return;

  state.activeRepoId = repoId;
  state.questionSearchQuery = "";
  questionSearchInput.value = "";

  renderQuestionsList();
  questionsModal.classList.add("open");
  answerModal.classList.remove("open");

  if (window.location.hash !== `#repo=${repoId}`) {
    history.replaceState(null, "", `#repo=${repoId}`);
  }
}

function renderQuestionsList() {
  const repoId = state.activeRepoId;
  const repo = state.repos?.[repoId];
  if (!repo) return;

  const allQuestions = getRepoQuestions(repoId);
  questionsModalTitle.textContent = `${repo.name} (${allQuestions.length})`;
  questionsModalSubtitle.textContent = repo.description || "Click any question below to view and copy its answer.";

  const qFilter = state.questionSearchQuery.trim().toLowerCase();
  const visibleQuestions = qFilter
    ? allQuestions.filter((q) => (q.question || "").toLowerCase().includes(qFilter))
    : allQuestions;

  if (allQuestions.length === 0) {
    questionList.innerHTML = `
      <li class="state-card" style="margin: 16px 0;">
        <h3>No questions added yet</h3>
        <p>The admin hasn't added any questions to this repository yet.</p>
      </li>
    `;
    return;
  }

  if (visibleQuestions.length === 0) {
    questionList.innerHTML = `
      <li class="state-card" style="margin: 16px 0;">
        <h3>No matching questions</h3>
        <p>Try a different keyword inside ${escapeHtml(repo.name)}.</p>
      </li>
    `;
    return;
  }

  questionList.innerHTML = "";
  visibleQuestions.forEach((item, index) => {
    const displayNum = item.number || index + 1;
    const li = document.createElement("li");
    li.className = "question-item";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "question-btn";
    btn.innerHTML = `
      <span class="question-diamond">&#9670;</span>
      <span>${displayNum}. ${escapeHtml(item.question)}</span>
    `;
    btn.addEventListener("click", () => openAnswerModal(repoId, item.id, displayNum));
    li.appendChild(btn);
    questionList.appendChild(li);
  });
}

function openAnswerModal(repoId, questionId, displayNum) {
  const repo = state.repos?.[repoId];
  const questionObj = state.questionsByRepo?.[repoId]?.[questionId];
  if (!repo || !questionObj) return;

  state.activeRepoId = repoId;
  state.activeQuestionId = questionId;

  const num = questionObj.number || displayNum || 1;
  answerModalTitle.textContent = `Question ${num}`;
  answerModalRepo.textContent = repo.name;
  answerQuestionText.textContent = `${num}. ${questionObj.question || ""}`;
  answerLanguageLabel.textContent = (questionObj.language || "SOLUTION CODE").toUpperCase();
  answerCodeContent.textContent = questionObj.answer || "";

  copyAnswerBtn.textContent = "COPY";
  copyAnswerBtn.classList.remove("copied");

  questionsModal.classList.remove("open");
  answerModal.classList.add("open");
}

function closeAllModals() {
  questionsModal.classList.remove("open");
  answerModal.classList.remove("open");
  state.activeQuestionId = null;
  if (window.location.hash.startsWith("#repo=")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

async function copyCurrentAnswer() {
  const text = answerCodeContent.textContent || "";
  if (!text) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    }

    copyAnswerBtn.textContent = "✓ COPIED TO CLIPBOARD";
    copyAnswerBtn.classList.add("copied");
    showToast("Answer copied to clipboard!");

    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyAnswerBtn.textContent = "COPY";
      copyAnswerBtn.classList.remove("copied");
    }, 2000);
  } catch {
    showToast("Could not copy automatically. Please select and copy manually.");
  }
}

// Event Listeners
questionSearchInput.addEventListener("input", (e) => {
  state.questionSearchQuery = e.target.value;
  renderQuestionsList();
});

closeQuestionsModalBtn.addEventListener("click", closeAllModals);
closeAnswerModalBtn.addEventListener("click", closeAllModals);

backToQuestionsBtn.addEventListener("click", () => {
  answerModal.classList.remove("open");
  if (state.activeRepoId && state.repos?.[state.activeRepoId]) {
    renderQuestionsList();
    questionsModal.classList.add("open");
  }
});

copyAnswerBtn.addEventListener("click", copyCurrentAnswer);

questionsModal.addEventListener("click", (e) => {
  if (e.target === questionsModal) closeAllModals();
});

answerModal.addEventListener("click", (e) => {
  if (e.target === answerModal) closeAllModals();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (answerModal.classList.contains("open")) {
      backToQuestionsBtn.click();
    } else if (questionsModal.classList.contains("open")) {
      closeAllModals();
    }
  }
});

// Real-time Firebase Realtime Database listeners
onValue(
  ref(db, "repositories"),
  (snapshot) => {
    state.repos = snapshot.val() || {};
    state.loadedRepos = true;
    state.dbError = null;
    renderRepositories();

    if (questionsModal.classList.contains("open") && state.activeRepoId) {
      if (state.repos[state.activeRepoId]) {
        renderQuestionsList();
      } else {
        closeAllModals();
      }
    }

    if (window.location.hash.startsWith("#repo=") && !questionsModal.classList.contains("open") && !answerModal.classList.contains("open")) {
      const hashRepoId = window.location.hash.replace("#repo=", "");
      if (state.repos[hashRepoId]) {
        openQuestionsModal(hashRepoId);
      }
    }
  },
  (error) => {
    state.dbError = error?.message || "Failed to connect to Firebase Realtime Database.";
    renderRepositories();
  }
);

onValue(
  ref(db, "questions"),
  (snapshot) => {
    state.questionsByRepo = snapshot.val() || {};
    state.loadedQuestions = true;
    state.dbError = null;
    renderRepositories();

    if (questionsModal.classList.contains("open") && state.activeRepoId) {
      renderQuestionsList();
    }
    if (answerModal.classList.contains("open") && state.activeRepoId && state.activeQuestionId) {
      const q = state.questionsByRepo?.[state.activeRepoId]?.[state.activeQuestionId];
      if (q) {
        answerQuestionText.textContent = `${q.number || 1}. ${q.question || ""}`;
        answerCodeContent.textContent = q.answer || "";
      }
    }
  },
  (error) => {
    state.dbError = error?.message || "Failed to load questions from Firebase.";
    renderRepositories();
  }
);
