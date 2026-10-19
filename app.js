/* MHN Sales — Board logic: columns, cards, drag & drop, totals, persistence */

const STAGES = [
  { id: "prospects", label: "Prospects" },
  { id: "interested", label: "Interested" },
  { id: "committed", label: "Committed" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
];

const FILTER_FIELDS = [
  { key: "owner", label: "Owner" },
  { key: "industry", label: "Industry" },
  { key: "tool", label: "Tool" },
];

const INCOMPLETE_FILTER = "__incomplete__";

const STORAGE_KEY = "mhn-sales-deals";
const DEFAULT_VALUE = 10000;
const MS_DAY = 86400000;
const PIPELINE_ROW_HEIGHT = 56;
const PIPELINE_BAR_HEIGHT = 36;
const PIPELINE_BAR_TOP = (PIPELINE_ROW_HEIGHT - PIPELINE_BAR_HEIGHT) / 2;
const TASKS_PIPELINE_ROW_HEIGHT = Math.round(PIPELINE_ROW_HEIGHT * 0.75); // 42
const TASKS_PIPELINE_BAR_HEIGHT = Math.round(PIPELINE_BAR_HEIGHT * 0.75); // 27
const TASKS_PIPELINE_BAR_TOP = (TASKS_PIPELINE_ROW_HEIGHT - TASKS_PIPELINE_BAR_HEIGHT) / 2;

let deals = [];
let currentUser = null; // { name: string }
let editingId = null;   // deal being edited in the modal (null = creating)
let modalReadOnly = false; // when true the modal shows a deal but blocks edits
let createStage = "prospects"; // stage a new deal is created into
let pendingCommitDeal = null; // deal awaiting implementation days before moving to Committed
let openFilterKey = null;
let activeTab = "board";
let modalNotes = [];
let modalMilestones = {};
let modalTasks = [];
let modalPanel = "details";
let syncingFromRemote = false;
let appStarted = false;
let showCompletedTasks = false;
const taskTypeFilters = new Set();
let newTaskType = "";
let tasksViewMode = "pipeline"; // "list" | "pipeline"
const tasksCalendarState = {
  monthStart: null,
  selectedDate: null,
};
const tasksPipelineState = {
  periodMonths: 1,
};
const TASKS_PIPELINE_LOOKBACK_DAYS = 7;
const TASKS_PIPELINE_LABEL_MAX = 20;
/** Skip month names when only a leftover sliver is on-screen (avoids overlapping the next month). */
const TASKS_PIPELINE_MIN_MONTH_LABEL_DAYS = 10;
/** Keep Today on the left: a short lookback so last month peeks in, future fills the rest. */
const PIPELINE_LOOKBACK_DAYS = 14;
/** Extra months you can pan through past Today / into the future. */
const PIPELINE_SCROLL_PAST_MONTHS = 6;
const PIPELINE_SCROLL_FUTURE_MONTHS = 18;
const PIPELINE_SCROLL_MAX_PAST_MONTHS = 24;
const PIPELINE_SCROLL_MAX_FUTURE_MONTHS = 36;
/** Skip month names/revenue when only a leftover sliver is on-screen. */
const PIPELINE_MIN_MONTH_LABEL_DAYS = 10;
/** Same-company tasks farther apart than this start a new packed cluster. */
const TASKS_PIPELINE_COMPANY_CLUSTER_GAP_DAYS = 7;
const TASKS_PIPELINE_COMPANY_TONES = ["sage", "lavender", "sky", "sand", "peach", "rose"];
/** Space reserved beside a bubble for the day-offset so neighbors don’t crush it. */
const TASKS_PIPELINE_OFFSET_RESERVE_PX = 22;
const TASK_TYPES = [
  { id: "email", label: "Email" },
  { id: "call", label: "Call" },
  { id: "meet", label: "Meet" },
  { id: "ticket", label: "Ticket" },
];
const SVG_NS = "http://www.w3.org/2000/svg";

const pipelineState = {
  periodMonths: 1,
};

const filters = {
  owner: new Set(),
  industry: new Set(),
  tool: new Set(),
};

let searchQuery = "";
let searchRawValue = "";

const boardEl = document.getElementById("board");
const filtersEl = document.getElementById("filters");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const pipelineFiltersEl = document.getElementById("pipelineFilters");
const pipelineClearFiltersBtn = document.getElementById("pipelineClearFiltersBtn");
const pipelinePeriodLength = document.getElementById("pipelinePeriodLength");
const pipelineChartEl = document.getElementById("pipelineChart");
const pipelineScrollEl = document.getElementById("pipelineScroll");
const pipelineAxisEl = document.getElementById("pipelineAxis");
const pipelineRowsEl = document.getElementById("pipelineRows");
const overlay = document.getElementById("modalOverlay");
const form = document.getElementById("dealForm");
const modalTitle = document.getElementById("modalTitle");
const modalTitleMeta = document.getElementById("modalTitleMeta");
const modalTitleCompany = document.getElementById("modalTitleCompany");
const modalTitleTool = document.getElementById("modalTitleTool");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("dismissDealBtn");
const dismissOverlay = document.getElementById("dismissOverlay");
const dismissLead = document.getElementById("dismissLead");
const knowledgeDeleteOverlay = document.getElementById("knowledgeDeleteOverlay");
const knowledgeDeleteLead = document.getElementById("knowledgeDeleteLead");
let knowledgeDeleteId = "";
const historyListEl = document.getElementById("historyList");
const historySearchInput = document.getElementById("historySearchInput");
let historySearchQuery = "";

const pauseOverlay = document.getElementById("pauseOverlay");
const pauseTitle = document.getElementById("pauseTitle");
const pauseLead = document.getElementById("pauseLead");
const pauseConfirmBtn = document.getElementById("pauseConfirmBtn");
let pendingPauseDealId = null;
let pauseConfirmAction = "pause"; // "pause" | "unpause"
let showPausedProspectsOnly = false;
let showTouchedProspectsOnly = false;

const pendingDraftOverlay = document.getElementById("pendingDraftOverlay");
const pendingDraftTitle = document.getElementById("pendingDraftTitle");
const pendingDraftLead = document.getElementById("pendingDraftLead");
const pendingDraftConfirmBtn = document.getElementById("pendingDraftConfirmBtn");
let pendingDraftKind = null; // "note" | "task"

const commitOverlay = document.getElementById("commitOverlay");
const commitForm = document.getElementById("commitForm");
const commitDealName = document.getElementById("commitDealName");
const implementationFields = document.getElementById("implementationFields");
const dealContractFileBtn = document.getElementById("dealContractFileBtn");
const dealContractFileInput = document.getElementById("dealContractFileInput");
const dealToolFileBtn = document.getElementById("dealToolFileBtn");
const dealToolFileInput = document.getElementById("dealToolFileInput");
const commitContractFileBtn = document.getElementById("commitContractFileBtn");
const commitContractFileInput = document.getElementById("commitContractFileInput");

/** Pending local File chosen in the deal/commit modals before upload. */
let modalContractFile = null;
let modalContractFilePath = "";
let modalContractFileName = "";
let modalToolFile = null;
let modalToolFilePath = "";
let modalToolFileName = "";
let commitContractFile = null;
let commitContractFilePath = "";
let commitContractFileName = "";
const activityNotesEl = document.getElementById("activityNotes");
const activityNotesOnlyInput = document.getElementById("activityNotesOnly");
const newNoteInput = document.getElementById("newNoteInput");
const companyDetailsFields = document.getElementById("companyDetailsFields");
const companyBriefFields = document.getElementById("companyBriefFields");
const companyHistoryFields = document.getElementById("companyHistoryFields");
const dealBriefInput = document.getElementById("dealBriefInput");
const dealValueInput = document.getElementById("dealValueInput");
const dealMilestonesEl = document.getElementById("dealMilestones");
const modalPanelDetails = document.getElementById("modalPanelDetails");
const modalPanelDeal = document.getElementById("modalPanelDeal");
const modalPanelActivity = document.getElementById("modalPanelActivity");
const modalPanelTasks = document.getElementById("modalPanelTasks");
const dealTasksListEl = document.getElementById("dealTasksList");
const newTaskNameInput = document.getElementById("newTaskNameInput");
const newTaskDueInput = document.getElementById("newTaskDueInput");
const newTaskTypePickerEl = document.getElementById("newTaskTypePicker");
const taskTypeFilterEl = document.getElementById("taskTypeFilter");
const tasksFiltersEl = document.getElementById("tasksFilters");
const tasksClearFiltersBtn = document.getElementById("tasksClearFiltersBtn");
const tasksListEl = document.getElementById("tasksList");
const tasksCalendarEl = document.getElementById("tasksCalendar");
const tasksListTitle = document.getElementById("tasksListTitle");
const tasksListLead = document.getElementById("tasksListLead");
const tasksShowCompletedBtn = document.getElementById("tasksShowCompletedBtn");
const tasksSearchInput = document.getElementById("tasksSearchInput");
const tasksSearchClearBtn = document.getElementById("tasksSearchClearBtn");
const tasksSearchBubble = document.getElementById("tasksSearchBubble");
const pipelineSearchInput = document.getElementById("pipelineSearchInput");
const pipelineSearchClearBtn = document.getElementById("pipelineSearchClearBtn");
const pipelineSearchBubble = document.getElementById("pipelineSearchBubble");
const dashboardFiltersEl = document.getElementById("dashboardFilters");
const dashboardClearFiltersBtn = document.getElementById("dashboardClearFiltersBtn");
const dashboardBodyEl = document.getElementById("dashboardBody");
const dashboardSearchInput = document.getElementById("dashboardSearchInput");
const dashboardSearchClearBtn = document.getElementById("dashboardSearchClearBtn");
const dashboardSearchBubble = document.getElementById("dashboardSearchBubble");
const searchSuggestionState = new Map();
const tasksListLayout = document.getElementById("tasksListLayout");
const tasksPipelineLayout = document.getElementById("tasksPipelineLayout");
const tasksPipelinePeriod = document.getElementById("tasksPipelinePeriod");
const tasksPipelinePeriodLength = document.getElementById("tasksPipelinePeriodLength");
const tasksPipelineScrollEl = document.getElementById("tasksPipelineScroll");
const tasksPipelineAxisEl = document.getElementById("tasksPipelineAxis");
const tasksPipelineRowsEl = document.getElementById("tasksPipelineRows");
const modalEl = overlay.querySelector(".modal");
const cancelBtn = document.getElementById("cancelBtn");
const activityComposer = modalPanelActivity.querySelector(".activity-composer");
const dealTasksComposer = modalPanelTasks.querySelector(".deal-tasks-composer");
const fieldSuggestionState = new Map();

const fmtEuro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/* ------------------------------ Auth / session ----------------- */

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const signupNameInput = document.getElementById("signupNameInput");
const signupEmailInput = document.getElementById("signupEmailInput");
const signupPasswordInput = document.getElementById("signupPasswordInput");
const signupConfirmInput = document.getElementById("signupConfirmInput");
const loginLead = document.getElementById("loginLead");
const loginAuthError = document.getElementById("loginAuthError");
const signupAuthError = document.getElementById("signupAuthError");
const signupAuthSuccess = document.getElementById("signupAuthSuccess");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const appShell = document.getElementById("appShell");
const userChip = document.getElementById("userChip");
const userChipName = document.getElementById("userChipName");
const logoutBtn = document.getElementById("logoutBtn");
const editNameBtn = document.getElementById("editNameBtn");
const editNameMenuBtn = document.getElementById("editNameMenuBtn");
const nameOverlay = document.getElementById("nameOverlay");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameTitle = document.getElementById("nameTitle");
const nameLead = document.getElementById("nameLead");
const nameCloseBtn = document.getElementById("nameCloseBtn");
const nameCancelBtn = document.getElementById("nameCancelBtn");
const nameSaveBtn = document.getElementById("nameSaveBtn");
const nameAuthError = document.getElementById("nameAuthError");
let namePromptRequired = false;
let nameBusy = false;

let authMode = "login"; // login only — self-signup is disabled
let authBusy = false;

function getCurrentUserName() {
  return currentUser?.name || "";
}

function formatActorStamp(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? ` by ${trimmed}` : "";
}

function stampCurrentUser(fallback = "") {
  return getCurrentUserName().trim() || String(fallback || "").trim();
}

function setAuthMessage({ error = "", success = "" } = {}) {
  loginAuthError.classList.remove("is-info");
  loginAuthError.textContent = error;
  loginAuthError.hidden = !error || authMode !== "login";
  signupAuthError.textContent = error;
  signupAuthError.hidden = !error || authMode !== "signup";
  signupAuthSuccess.textContent = success;
  signupAuthSuccess.hidden = !success;
}

function setAuthBusy(busy) {
  authBusy = busy;
  loginSubmitBtn.disabled = busy;
  loginSubmitBtn.textContent = busy ? "Logging in…" : "Log in";
}

function setAuthMode() {
  authMode = "login";

  loginForm.hidden = false;
  signupForm.hidden = true;

  for (const el of loginForm.elements) el.disabled = false;
  for (const el of signupForm.elements) el.disabled = true;

  loginLead.textContent = "Log in with the email and password provided for your account.";

  setAuthMessage();
  setAuthBusy(false);

  requestAnimationFrame(() => {
    loginEmailInput.focus();
  });
}

function showLoginScreen() {
  document.body.classList.add("is-logged-out");
  appShell.hidden = true;
  loginScreen.hidden = false;
  userChip.hidden = true;
  setAuthBusy(false);
  setAuthMode(authMode);
}

function showAppShell() {
  document.body.classList.remove("is-logged-out");
  loginScreen.hidden = true;
  appShell.hidden = false;
  updateUserChip();
}

function updateUserChip() {
  const name = getCurrentUserName();
  const navUserName = document.getElementById("navUserName");
  if (!name) {
    userChip.hidden = true;
    if (navUserName) {
      navUserName.hidden = true;
      navUserName.textContent = "";
      navUserName.removeAttribute("title");
    }
    return;
  }
  const title = currentUser?.email ? `${name} (${currentUser.email})` : name;
  userChipName.textContent = name;
  userChipName.title = title;
  userChip.hidden = false;
  if (navUserName) {
    navUserName.textContent = name;
    navUserName.title = title;
    navUserName.hidden = false;
  }
}

function applyAuthUser(user) {
  currentUser = user
    ? {
        id: user.id,
        email: user.email || "",
        name: user.name || "",
        needsName: Boolean(user.needsName),
      }
    : null;
  if (currentUser) {
    showAppShell();
  } else {
    namePromptRequired = false;
    if (nameOverlay) nameOverlay.hidden = true;
    showLoginScreen();
  }
}

function setNameMessage(error = "") {
  if (!nameAuthError) return;
  nameAuthError.textContent = error;
  nameAuthError.hidden = !error;
}

function openNameModal({ required = false } = {}) {
  if (!nameOverlay || !nameForm) return;
  namePromptRequired = required;
  setNameMessage();
  nameTitle.textContent = required ? "What’s your name?" : "Edit name";
  nameLead.textContent = required
    ? "This name appears on the board and is used as Owner on deals you create."
    : "This name appears on the board and is used as Owner on deals you create.";
  nameInput.value = currentUser?.needsName ? "" : (currentUser?.name || "");
  nameCloseBtn.hidden = required;
  nameCancelBtn.hidden = required;
  nameOverlay.hidden = false;
  requestAnimationFrame(() => nameInput.focus());
}

function closeNameModal() {
  if (namePromptRequired) return;
  if (nameOverlay) nameOverlay.hidden = true;
  setNameMessage();
  nameBusy = false;
}

function maybePromptProfileName() {
  if (currentUser?.needsName) openNameModal({ required: true });
}

async function handleNameSubmit(e) {
  e.preventDefault();
  if (nameBusy) return;
  const auth = window.MHN_AUTH;
  if (!auth?.updateProfileName) {
    setNameMessage("Could not save your name. Try again.");
    return;
  }

  const nextName = nameInput.value.trim();
  if (!nextName) {
    setNameMessage("Please enter your name.");
    nameInput.focus();
    return;
  }

  nameBusy = true;
  nameSaveBtn.disabled = true;
  nameSaveBtn.textContent = "Saving…";
  setNameMessage();

  try {
    const previousName = currentUser?.name || "";
    const result = await auth.updateProfileName(nextName);
    if (!result.ok) {
      setNameMessage(result.error || "Could not save your name.");
      return;
    }
    applyAuthUser(result.user);
    if (form?.elements?.owner && form.elements.owner.value === previousName) {
      form.elements.owner.value = result.user?.name || nextName;
    }
    namePromptRequired = false;
    nameOverlay.hidden = true;
  } catch (err) {
    console.error(err);
    setNameMessage("Could not save your name. Try again.");
  } finally {
    nameBusy = false;
    nameSaveBtn.disabled = false;
    nameSaveBtn.textContent = "Save name";
  }
}

/** Ask Chromium/Safari (where supported) to save credentials after SPA auth. */
async function offerSavePassword(email, password, name = "") {
  try {
    if (!window.PasswordCredential || !navigator.credentials?.store) return;
    const cred = new PasswordCredential({
      id: String(email || "").trim(),
      password: String(password || ""),
      name: String(name || "").trim() || undefined,
    });
    await navigator.credentials.store(cred);
  } catch (err) {
    // Browser may decline; form autocomplete hints still handle most cases.
    console.debug("Password save offer skipped:", err);
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  if (authBusy) return;

  const auth = window.MHN_AUTH;
  if (!auth?.isConfigured?.()) {
    setAuthMessage({
      error: "Supabase is not configured. Add your project URL and anon key in config.js.",
    });
    return;
  }

  const email = loginEmailInput.value;
  const password = loginPasswordInput.value;
  setAuthMessage();
  setAuthBusy(true);

  try {
    const result = await auth.signIn({ email, password });
    if (!result.ok) {
      setAuthMessage({ error: result.error || "Authentication failed." });
      return;
    }

    await offerSavePassword(email, password, result.user?.name);
    applyAuthUser(result.user);
    await startApp();
    maybePromptProfileName();
  } catch (err) {
    console.error(err);
    setAuthMessage({ error: "Something went wrong. Please try again." });
  } finally {
    setAuthBusy(false);
  }
}

async function handleSignupSubmit(e) {
  e.preventDefault();
}

async function logout() {
  const auth = window.MHN_AUTH;
  setAuthBusy(true);
  try {
    if (auth?.signOut) {
      const result = await auth.signOut();
      if (!result.ok) {
        setAuthMessage({ error: result.error || "Could not log out." });
        showLoginScreen();
        return;
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    applyAuthUser(null);
    loginPasswordInput.value = "";
    signupPasswordInput.value = "";
    signupConfirmInput.value = "";
    loginAuthError.classList.remove("is-info");
    setAuthBusy(false);
    setAuthMessage();
  }
}

/* ------------------------------ Storage ------------------------ */

function loadDeals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function syncErrorDetail(err) {
  const detail =
    err?.message ||
    err?.error_description ||
    err?.details ||
    (typeof err === "string" ? err : "");
  return detail ? `: ${String(detail).slice(0, 160)}` : "";
}

function applySaveResult(result) {
  if (result?.rehydrated && result?.deals && Array.isArray(result.deals)) {
    deals = result.deals;
  } else {
    const updates = [
      ...(Array.isArray(result?.written) ? result.written : []),
      ...(Array.isArray(result?.conflicts) ? result.conflicts : []),
    ];
    if (updates.length) {
      const byId = new Map(updates.filter((d) => d?.id).map((d) => [d.id, d]));
      deals = deals.map((d) => (byId.has(d.id) ? byId.get(d.id) : d));
      for (const deal of byId.values()) {
        if (!deals.some((d) => d.id === deal.id)) deals.push(deal);
      }
    } else if (result?.deals && Array.isArray(result.deals)) {
      deals = result.deals;
    }
  }
  if (result?.writeBlocked) {
    if (result.reason === "not-hydrated") {
      showSyncStatus(
        "Offline — pending sync. Changes are local until cloud reconnects.",
        true,
        true
      );
    }
    // origin-blocked: cloud-readonly banner already explains this
    return;
  }
  if (result?.conflict) {
    const n = Array.isArray(result.conflicts) ? result.conflicts.length : 0;
    const editingConflict =
      editingId &&
      Array.isArray(result.conflicts) &&
      result.conflicts.some((d) => d.id === editingId);
    const label = editingConflict
      ? "This deal changed elsewhere. Your form is kept — save again to apply your edits on the latest version."
      : n === 1
        ? "Conflict — that deal changed elsewhere. Loaded the latest version."
        : `Conflict — ${n || "some"} deals changed elsewhere. Loaded the latest versions.`;
    showSyncStatus(label, true, true);
    render();
    return;
  }
  if (result?.wroteToCloud) {
    // Quiet on routine saves; only celebrate reconnect / pending flush.
    if (result.rehydrated) {
      showSyncStatus("Reconnected — saved to cloud");
    }
  }
}

let saveQueue = Promise.resolve();
const saveQueuedIds = new Set();
let saveInFlight = false;

function queueDealIds(affectedDealIds) {
  if (typeof affectedDealIds === "string" && affectedDealIds) {
    saveQueuedIds.add(affectedDealIds);
  } else if (Array.isArray(affectedDealIds)) {
    for (const id of affectedDealIds) {
      if (id) saveQueuedIds.add(id);
    }
  }
}

async function flushQueuedSaves() {
  const api = window.MHN_DB;
  while (saveQueuedIds.size) {
    const ids = [...saveQueuedIds];
    saveQueuedIds.clear();
    const toWrite = deals.filter((d) => ids.includes(d.id));
    saveInFlight = true;
    try {
      if (api?.upsertDealsAsync) {
        const result = await api.upsertDealsAsync(toWrite, deals);
        applySaveResult(result);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
      }
    } catch (err) {
      console.error(err);
      showSyncStatus(
        `Could not sync to cloud — changes kept locally${syncErrorDetail(err)}`,
        true,
        true
      );
    } finally {
      saveInFlight = false;
    }
  }
  if (pendingRemoteRefresh) {
    pendingRemoteRefresh = false;
    await refreshDealsFromRemote();
  }
}

/**
 * Persist local cache and upsert only the affected deal row(s).
 * Saves are serialized so two rapid edits cannot send the same version.
 * @param {string|string[]|null} affectedDealIds changed deal id(s); omit only for local-only cache write
 */
function saveDeals(affectedDealIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  } catch {
    /* ignore quota / private mode */
  }
  // Ignore our own realtime echo while a write is in flight.
  suppressRemoteRefreshUntil = Date.now() + 400;
  queueDealIds(affectedDealIds);
  saveQueue = saveQueue.then(flushQueuedSaves).catch((err) => {
    console.error(err);
  });
}

function showSyncStatus(message, isError = false, sticky = false) {
  let el = document.getElementById("syncStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "syncStatus";
    el.className = "sync-status";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.toggle("is-info", !isError && sticky);
  el.hidden = false;
  clearTimeout(showSyncStatus._timer);
  if (!sticky) {
    showSyncStatus._timer = setTimeout(() => {
      el.hidden = true;
    }, isError ? 5000 : 2500);
  }
}

function showCloudReadOnlyBanner() {
  if (document.getElementById("cloudReadOnlyBanner")) return;
  const banner = document.createElement("div");
  banner.id = "cloudReadOnlyBanner";
  banner.className = "cloud-readonly-banner";
  banner.innerHTML =
    "<strong>Local / preview mode</strong> — cloud data is read-only here. " +
    "Use the <a href=\"https://macadosis.github.io/MHN_Hub/\" target=\"_blank\" rel=\"noopener\">GitHub Pages app</a> " +
    "to create or edit live deals.";
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.insertAdjacentElement("afterend", banner);
  else document.body.prepend(banner);
}

let lastRenderedSignature = null;
let pendingRemoteRefresh = false;
let suppressRemoteRefreshUntil = 0;
let pendingRemoteRefreshTimer = 0;

function schedulePendingRemoteRefresh() {
  clearTimeout(pendingRemoteRefreshTimer);
  const wait = Math.max(0, suppressRemoteRefreshUntil - Date.now()) + 30;
  pendingRemoteRefreshTimer = setTimeout(() => {
    if (!pendingRemoteRefresh || saveInFlight || saveQueuedIds.size || dragState) return;
    pendingRemoteRefresh = false;
    refreshDealsFromRemote();
  }, wait);
}

function showLoadSyncStatus(api) {
  if (!api?.isRemote) return;
  if (!api.cloudWriteAllowedByOrigin) {
    showSyncStatus("Cloud read-only — local edits won’t upload", false, true);
    return;
  }
  const meta = api.lastLoadMeta || {};
  if (!api.cloudHydrated || meta.source === "local-fallback") {
    showSyncStatus(
      "Cloud unavailable — using local data. Edits won’t upload until reconnect.",
      true,
      true
    );
    return;
  }
  if (meta.source === "local-pending" || api.hasPendingSync || meta.flushError) {
    showSyncStatus(
      "Pending sync — local changes could not be uploaded. Kept locally.",
      true,
      true
    );
    return;
  }
  if (meta.source === "local-pending-conflict") {
    showSyncStatus(
      "Conflict while syncing — some deals were reloaded from the cloud.",
      true,
      true
    );
    return;
  }
  if (meta.source === "local-pending-synced") {
    showSyncStatus("Pending local changes uploaded to Supabase");
    return;
  }
  showSyncStatus("Synced with Supabase");
}

async function refreshDealsFromRemote() {
  const api = window.MHN_DB;
  if (!api?.isRemote || !api.loadDealsAsync) return;
  if (saveInFlight || saveQueuedIds.size) {
    pendingRemoteRefresh = true;
    return;
  }
  if (Date.now() < suppressRemoteRefreshUntil) {
    pendingRemoteRefresh = true;
    schedulePendingRemoteRefresh();
    return;
  }
  // Never rebuild the board mid-drag; queue the update until the drag ends.
  if (dragState) {
    pendingRemoteRefresh = true;
    return;
  }
  try {
    syncingFromRemote = true;
    const incoming = await api.loadDealsAsync();
    const editingOpen = Boolean(editingId && overlay && !overlay.hidden);
    if (editingOpen) {
      const before = deals.find((d) => d.id === editingId);
      const after = incoming.find((d) => d.id === editingId);
      const beforeVer = Number(before?.version) || 0;
      const afterVer = Number(after?.version) || 0;
      if (before && after && afterVer !== beforeVer) {
        showSyncStatus(
          "This deal changed elsewhere. Your form is kept — save to apply your edits on the latest version, or close without saving to take theirs.",
          true,
          true
        );
      } else if (before && !after) {
        showSyncStatus(
          "This deal was removed or changed elsewhere while you were editing.",
          true,
          true
        );
      }
    }
    deals = incoming;
    migrateDeals({ persist: Boolean(api.cloudWriteEnabled) });
    const meta = api.lastLoadMeta || {};
    if (meta.source === "local-pending" || meta.flushError || api.hasPendingSync) {
      showSyncStatus(
        "Pending sync — local changes could not be uploaded. Kept locally.",
        true,
        true
      );
    }
    // Skip the (destructive) re-render when nothing actually changed, so a
    // hovered card isn't torn down and rebuilt by realtime echo events.
    const signature = JSON.stringify(deals);
    if (signature !== lastRenderedSignature) {
      lastRenderedSignature = signature;
      render();
    }
  } catch (err) {
    console.error(err);
  } finally {
    syncingFromRemote = false;
  }
}

const DEAL_CREATION_NOTE_TEXT = "Deal card created";
const TASK_COMPLETED_NOTE_KIND = "task-completed";
const BRIEF_NOTE_KIND = "brief";
const VALUE_NOTE_KIND = "value-propositions";
const MILESTONE_NOTE_KIND = "milestones";
const TOOL_FILE_NOTE_KIND = "tool-file";
const DEAL_MILESTONES = [
  { id: "quoted", label: "Quoted" },
  { id: "contractSigned", label: "Contract signed" },
  { id: "proformaPaid", label: "Proforma paid" },
  { id: "invoicePaid", label: "Invoice paid" },
];
const CARD_PROGRESS_STEPS = 4;
const PROGRESS_STAGES = new Set(["interested", "committed", "paid", "failed"]);
const STAGE_PLACEMENT_NOTE_KIND = "stage";
const PAUSED_NOTE_KIND = "paused";
const UNPAUSED_NOTE_KIND = "unpaused";
const ACTIVITY_NOTES_ONLY_KEY = "mhn-activity-notes-only";
const ACTIVITY_NOTE_FOLD_ROWS = 12;

let activityNotesOnly = false;
const expandedActivityNoteIds = new Set();
try {
  activityNotesOnly = localStorage.getItem(ACTIVITY_NOTES_ONLY_KEY) === "1";
} catch {
  /* preference is optional */
}

function makeDealCreationNote(timestamp, createdBy) {
  const by = String(createdBy || getCurrentUserName() || "").trim();
  return {
    id: crypto.randomUUID(),
    text: DEAL_CREATION_NOTE_TEXT,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: by,
    updatedBy: by,
  };
}

function isDealCreationNote(note) {
  return (note?.text || "").trim() === DEAL_CREATION_NOTE_TEXT;
}

function makeTaskCompletedNote(task, timestamp = Date.now()) {
  const name = (task?.text || "").trim() || "Untitled task";
  const by = stampCurrentUser();
  return {
    id: crypto.randomUUID(),
    kind: TASK_COMPLETED_NOTE_KIND,
    text: `Completed task: ${name}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: by,
    updatedBy: by,
  };
}

function isTaskCompletedNote(note) {
  return note?.kind === TASK_COMPLETED_NOTE_KIND
    || /^\s*Completed task:/i.test(note?.text || "");
}

function appendTaskCompletedNote(notes, task, timestamp = Date.now()) {
  if (!Array.isArray(notes)) return null;
  const note = makeTaskCompletedNote(task, timestamp);
  notes.push(note);
  return note;
}

function stageLabel(stageId) {
  return STAGES.find((stage) => stage.id === stageId)?.label || stageId || "";
}

function makeStagePlacementNote(stageId, timestamp = Date.now(), createdBy = "") {
  const by = String(createdBy || getCurrentUserName() || "").trim();
  return {
    id: crypto.randomUUID(),
    kind: STAGE_PLACEMENT_NOTE_KIND,
    stage: stageId,
    text: `Placed in ${stageLabel(stageId)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: by,
    updatedBy: by,
  };
}

function makePauseActivityNote(paused, timestamp = Date.now(), createdBy = "") {
  const by = String(createdBy || getCurrentUserName() || "").trim();
  return {
    id: crypto.randomUUID(),
    kind: paused ? PAUSED_NOTE_KIND : UNPAUSED_NOTE_KIND,
    text: paused ? "Paused" : "Unpaused",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: by,
    updatedBy: by,
  };
}

function isStagePlacementNote(note) {
  return note?.kind === STAGE_PLACEMENT_NOTE_KIND;
}

function isPauseActivityNote(note) {
  return note?.kind === PAUSED_NOTE_KIND || note?.kind === UNPAUSED_NOTE_KIND;
}

function isBriefNote(note) {
  return note?.kind === BRIEF_NOTE_KIND;
}

function isValueNote(note) {
  return note?.kind === VALUE_NOTE_KIND;
}

function isMilestoneNote(note) {
  return note?.kind === MILESTONE_NOTE_KIND;
}

function isToolFileNote(note) {
  return note?.kind === TOOL_FILE_NOTE_KIND;
}

function toolFileFromNotes(notes) {
  const note = (notes || []).find(isToolFileNote);
  if (!note?.text) return { path: "", fileName: "" };
  try {
    const data = JSON.parse(note.text);
    return {
      path: String(data?.path || ""),
      fileName: String(data?.fileName || ""),
    };
  } catch {
    return { path: "", fileName: "" };
  }
}

function syncToolFileNote(path, fileName) {
  const existing = modalNotes.find(isToolFileNote);
  if (!path && !fileName) {
    if (existing) modalNotes = modalNotes.filter((note) => note !== existing);
    return;
  }
  const text = JSON.stringify({ path: path || "", fileName: fileName || "" });
  if (existing) {
    if (existing.text !== text) {
      existing.text = text;
      existing.updatedAt = Date.now();
      existing.updatedBy = stampCurrentUser(existing.createdBy);
    }
    return;
  }
  modalNotes.push({
    id: crypto.randomUUID(),
    kind: TOOL_FILE_NOTE_KIND,
    text,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
}

function emptyMilestones() {
  return Object.fromEntries(DEAL_MILESTONES.map((milestone) => [milestone.id, false]));
}

function milestonesFromNotes(notes) {
  const flags = emptyMilestones();
  const note = (notes || []).find(isMilestoneNote);
  if (!note?.text) return flags;
  try {
    const data = JSON.parse(note.text);
    for (const milestone of DEAL_MILESTONES) flags[milestone.id] = Boolean(data?.[milestone.id]);
  } catch {
    /* keep every stage off if the stored value is unreadable */
  }
  return flags;
}

function dealShowsProgress(deal) {
  return PROGRESS_STAGES.has(deal?.stage) && !isDealPaused(deal);
}

function dealProgressFilled(deal) {
  const flags = milestonesFromNotes(deal?.notes);
  return DEAL_MILESTONES.filter((milestone) => flags[milestone.id]).length;
}

function isAutomaticActivityNote(note) {
  return (
    isDealCreationNote(note) ||
    isTaskCompletedNote(note) ||
    isStagePlacementNote(note) ||
    isPauseActivityNote(note)
  );
}

function hasMatchingActivityNote(notes, note) {
  return (notes || []).some(
    (existing) =>
      existing.kind === note.kind &&
      existing.createdAt === note.createdAt &&
      (existing.stage || "") === (note.stage || "")
  );
}

function appendActivityNote(deal, note) {
  if (!deal || !note) return null;
  if (!Array.isArray(deal.notes)) deal.notes = [];
  if (hasMatchingActivityNote(deal.notes, note)) return null;
  deal.notes.push(note);
  if (editingId === deal.id) {
    modalNotes.push({ ...note });
    if (modalPanel === "activity") renderActivityNotes();
  }
  return note;
}

function backfillBracketActivity(deal) {
  if (!Array.isArray(deal.notes)) deal.notes = [];
  let changed = false;
  const by = deal.owner || "";
  const ensure = (note) => {
    if (hasMatchingActivityNote(deal.notes, note)) return;
    deal.notes.push(note);
    changed = true;
  };

  const interestedAt = positiveTimestamp(deal.interestedAt);
  if (interestedAt) ensure(makeStagePlacementNote("interested", interestedAt, by));

  const committedEnteredAt = positiveTimestamp(deal.committedEnteredAt);
  if (committedEnteredAt) {
    const placedInPaid =
      deal.stage === "paid" &&
      !deal.implementationDays &&
      !positiveTimestamp(deal.committedAt);
    ensure(
      makeStagePlacementNote(
        placedInPaid ? "paid" : "committed",
        committedEnteredAt,
        by
      )
    );
  }

  const pausedAt = positiveTimestamp(deal.pausedAt);
  if (pausedAt) ensure(makePauseActivityNote(true, pausedAt, by));

  return changed;
}

function migrateDeals({ persist = true } = {}) {
  let changed = false;
  const changedIds = new Set();
  for (const deal of deals) {
    if (
      deal.stage === "committed" &&
      deal.implementationDays &&
      !deal.committedAt
    ) {
      deal.committedAt = startOfDay(new Date(deal.createdAt || Date.now())).getTime();
      changed = true;
      changedIds.add(deal.id);
    } else if (deal.committedAt) {
      const normalized = startOfDay(new Date(deal.committedAt)).getTime();
      if (normalized !== deal.committedAt) {
        deal.committedAt = normalized;
        changed = true;
        changedIds.add(deal.id);
      }
    }

    // Every deal keeps an automatic first note stamped at its creation time.
    const created = deal.createdAt;
    if (created) {
      const notes = deal.notes || [];
      if (!notes.some((note) => note.createdAt === created)) {
        deal.notes = [makeDealCreationNote(created, deal.owner), ...notes];
        changed = true;
        changedIds.add(deal.id);
      }
    }

    if (backfillBracketActivity(deal)) {
      changed = true;
      changedIds.add(deal.id);
    }

    const ownerName = (deal.owner || "").trim();
    if (Array.isArray(deal.notes)) {
      let notesChanged = false;
      for (const note of deal.notes) {
        if (!note.createdBy && ownerName) {
          note.createdBy = ownerName;
          notesChanged = true;
        }
      }
      if (notesChanged) {
        changed = true;
        changedIds.add(deal.id);
      }
    }

    if (!Array.isArray(deal.tasks)) {
      deal.tasks = [];
      changed = true;
      changedIds.add(deal.id);
    } else {
      const cleaned = [];
      let tasksChanged = false;
      for (const raw of deal.tasks) {
        const task = normalizeTask(raw);
        if (!task.text || task.dueAt == null) {
          tasksChanged = true;
          continue;
        }
        if (Number(raw.dueAt) !== task.dueAt) tasksChanged = true;
        if (!task.createdBy && ownerName) {
          task.createdBy = ownerName;
          tasksChanged = true;
        }
        cleaned.push(task);
      }
      if (cleaned.length !== deal.tasks.length) tasksChanged = true;
      if (tasksChanged) {
        deal.tasks = cleaned;
        changed = true;
        changedIds.add(deal.id);
      }
    }
  }

  const boardOrderIds = ensureBoardOrders();
  if (boardOrderIds.length) {
    changed = true;
    for (const id of boardOrderIds) changedIds.add(id);
  }

  // Never push migration fixes from a write-blocked origin (avoids stale local→cloud)
  if (changed && persist && window.MHN_DB?.cloudWriteEnabled) {
    saveDeals([...changedIds]);
  }
}

function compareBoardOrder(a, b) {
  const ao = a.boardOrder;
  const bo = b.boardOrder;
  if (ao != null && bo != null && ao !== bo) return ao - bo;
  if (ao != null && bo == null) return -1;
  if (ao == null && bo != null) return 1;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

function compareColumnOrder(a, b) {
  const ap = isDealPinned(a) ? 0 : 1;
  const bp = isDealPinned(b) ? 0 : 1;
  if (ap !== bp) return ap - bp;
  return compareBoardOrder(a, b);
}

function getStageDeals(stage, { excludeId } = {}) {
  return deals
    .filter(
      (d) =>
        !d.dismissedAt &&
        d.stage === stage &&
        d.id !== excludeId
    )
    .sort(compareColumnOrder);
}

/** Paused deals always live under Prospects. */
function ensurePausedDealsInProspects() {
  const changedIds = [];
  for (const deal of deals) {
    if (!isDealPaused(deal) || deal.stage === "dismissed" || deal.dismissedAt) continue;
    if (deal.stage !== "prospects") {
      deal.stage = "prospects";
      changedIds.push(deal.id);
    }
  }
  return changedIds;
}

/** Assign missing boardOrder values so column order is stable and rearrangeable. */
function ensureBoardOrders() {
  const changedIds = ensurePausedDealsInProspects();
  const byStage = new Map();

  for (const deal of deals) {
    if (deal.dismissedAt) continue;
    const stage = deal.stage || "prospects";
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(deal);
  }

  for (const list of byStage.values()) {
    list.sort(compareBoardOrder);
    list.forEach((deal, index) => {
      if (deal.boardOrder !== index) {
        deal.boardOrder = index;
        changedIds.push(deal.id);
      }
    });
  }

  return changedIds;
}

/** Remember when a deal was moved into Interested or Committed. */
function stampStageEntered(deal, previousStage, now = Date.now()) {
  if (!deal || deal.stage === previousStage) return;
  if (deal.stage === "interested") deal.interestedAt = now;
  if (deal.stage === "committed") deal.committedEnteredAt = now;
  if (deal.stage === "paid" && !deal.committedEnteredAt) deal.committedEnteredAt = now;
}

function nextBoardOrder(stage) {
  const list = getStageDeals(stage);
  if (!list.length) return 0;
  return Math.max(...list.map((d) => d.boardOrder ?? 0)) + 1;
}

/** @returns {string[]} ids of deals whose stage/boardOrder changed */
function reorderDeal(deal, targetStage, insertBeforeId, now = Date.now()) {
  const siblings = getStageDeals(targetStage, { excludeId: deal.id });
  let insertAt = siblings.length;
  if (insertBeforeId) {
    const idx = siblings.findIndex((d) => d.id === insertBeforeId);
    if (idx >= 0) insertAt = idx;
  }
  siblings.splice(insertAt, 0, deal);
  const previousStage = deal.stage;
  deal.stage = targetStage;
  stampStageEntered(deal, previousStage, now);
  siblings.forEach((d, i) => {
    d.boardOrder = i;
  });
  return siblings.map((d) => d.id);
}

/** Log a column move, and an unpause when a paused card leaves Prospects. */
function moveDealToStage(deal, targetStage, insertBeforeId, now = Date.now()) {
  const previousStage = deal.stage;
  const ids = reorderDeal(deal, targetStage, insertBeforeId, now);
  const by = stampCurrentUser(deal.owner);
  if (previousStage !== deal.stage && deal.stage !== "dismissed") {
    appendActivityNote(deal, makeStagePlacementNote(deal.stage, now, by));
  }
  if (isDealPaused(deal) && deal.stage !== "prospects") {
    delete deal.pausedAt;
    appendActivityNote(deal, makePauseActivityNote(false, now, by));
  }
  return ids;
}

function initPipelinePeriod() {
  pipelineViewportStartMs = null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(timestamp) {
  const date = startOfDay(new Date(timestamp));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return startOfDay(new Date(year, month - 1, day)).getTime();
}

function formatShortDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toTitleCase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("-").map(titleCasePart).join("-"))
    .join(" ");
}

function titleCasePart(part) {
  if (!part) return part;
  // \W is ASCII-only, so letters like Ž were treated as punctuation and the
  // following letter (A in Žalgiris) was capitalized as the "first" letter.
  const match = part.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  if (!match) return part;
  const [, lead, core, trail] = match;
  if (!core) return part;

  const letters = core.replace(/[^\p{L}]/gu, "");
  const keepAbbreviation =
    letters.length >= 2 && letters === letters.toUpperCase();
  const chars = [...core];
  const cased = keepAbbreviation
    ? core
    : chars[0].toUpperCase() + chars.slice(1).join("").toLowerCase();
  return `${lead}${cased}${trail}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

if (!tasksCalendarState.monthStart) {
  tasksCalendarState.monthStart = startOfMonth(new Date());
}
let pipelineViewportStartMs = null;
let pipelineSyncingScroll = false;
let tasksViewportStartMs = null;
let tasksPipelineSyncingScroll = false;
let tasksPipelineRange = null;

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function addDays(date, days) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Shift by calendar months while keeping the day-of-month when possible. */
function shiftDateByMonths(date, months) {
  const source = startOfDay(date);
  const targetMonth = source.getMonth() + months;
  const target = new Date(source.getFullYear(), targetMonth, source.getDate());
  // Clamp overflow (e.g. Jan 31 + 1 month) to the last day of the target month.
  if (target.getDate() !== source.getDate()) {
    return startOfDay(new Date(source.getFullYear(), targetMonth + 1, 0));
  }
  return startOfDay(target);
}

function formatMonthDay(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

/** Hide only a leftover lookback sliver on the left; always label months that start in-view. */
function shouldShowMonthAxisLabel(monthStart, visibleStart, visibleDays, periodStart, minDays) {
  const leadingClip = visibleStart <= periodStart && monthStart.getTime() < periodStart;
  return !leadingClip || visibleDays >= minDays;
}

/* ------------------------------ Filters ------------------------ */

function hasActiveFilters() {
  return FILTER_FIELDS.some(({ key }) => filters[key].size > 0) || Boolean(searchQuery);
}

function getFilterOptions(key, counts = getFilterValueCounts(key).counts) {
  return [...new Set(
    getActiveDeals()
      .map((deal) => (deal[key] || "").trim())
      .filter(Boolean)
  )].sort((a, b) => {
    const byCount = (counts.get(b) || 0) - (counts.get(a) || 0);
    if (byCount) return byCount;
    return a.localeCompare(b);
  });
}

function getFilterValueCounts(key) {
  const counts = new Map();
  let incomplete = 0;
  for (const deal of getActiveDeals()) {
    const value = (deal[key] || "").trim();
    if (!value) {
      incomplete += 1;
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return { counts, incomplete };
}

function appendFilterOptionCount(optionLabel, count) {
  const countEl = document.createElement("span");
  countEl.className = "filter-option-count";
  countEl.textContent = `(${count})`;
  optionLabel.appendChild(countEl);
}

function hasIncompleteValues(key) {
  return getActiveDeals().some((deal) => !(deal[key] || "").trim());
}

function getActiveDeals() {
  return deals.filter((deal) => deal.stage !== "dismissed");
}

function isDealPaused(deal) {
  return Boolean(deal?.pausedAt);
}

function isDealPinned(deal) {
  return Boolean(deal?.pinnedAt);
}

const MAX_PINNED_PER_STAGE = 10;

function countPinnedInStage(stage, { excludeId } = {}) {
  return deals.filter(
    (d) =>
      !d.dismissedAt &&
      d.stage === stage &&
      d.id !== excludeId &&
      isDealPinned(d)
  ).length;
}

function canPinDeal(deal) {
  if (!deal || deal.stage === "dismissed" || deal.dismissedAt) return false;
  if (isDealPinned(deal)) return true;
  return countPinnedInStage(deal.stage, { excludeId: deal.id }) < MAX_PINNED_PER_STAGE;
}

function toggleDealPin(deal) {
  if (!deal || deal.stage === "dismissed" || deal.dismissedAt) return;
  if (isDealPinned(deal)) {
    delete deal.pinnedAt;
  } else if (!canPinDeal(deal)) {
    return;
  } else {
    deal.pinnedAt = Date.now();
  }
  closeFilterMenus();
  saveDeals(deal.id);
  render();
}

function nextCardSiblingId(el) {
  let sib = el?.nextElementSibling;
  while (sib) {
    if (sib.classList?.contains("card") && sib.dataset?.id) return sib.dataset.id;
    sib = sib.nextElementSibling;
  }
  return null;
}

function getDismissedDeals() {
  return deals
    .filter((deal) => deal.stage === "dismissed")
    .sort((a, b) => (b.dismissedAt || 0) - (a.dismissedAt || 0));
}

function getFilteredDismissedDeals() {
  const q = historySearchQuery.trim().toLowerCase();
  const dismissed = getDismissedDeals();
  if (!q) return dismissed;
  return dismissed.filter((deal) =>
    (deal.company || "").toLowerCase().includes(q)
  );
}

function getFieldMatches(
  fieldKey,
  query,
  { trackDismissed = false, trackPaused = false, activeOnly = false } = {}
) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const byValue = new Map();
  for (const deal of deals) {
    if (activeOnly && deal.stage === "dismissed") continue;
    const value = (deal[fieldKey] || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    let entry = byValue.get(key);
    if (!entry) {
      entry = {
        name: value,
        hasActive: false,
        hasDismissed: false,
        hasPaused: false,
        hasUnpaused: false,
      };
      byValue.set(key, entry);
    }
    if (deal.stage === "dismissed") {
      entry.hasDismissed = true;
    } else {
      entry.hasActive = true;
      if (isDealPaused(deal)) entry.hasPaused = true;
      else entry.hasUnpaused = true;
    }
  }

  return [...byValue.values()]
    .filter(({ name }) => name.toLowerCase().includes(q))
    .map(({ name, hasActive, hasDismissed, hasPaused, hasUnpaused }) => ({
      name,
      dismissed: trackDismissed && hasDismissed && !hasActive,
      paused: trackPaused && hasPaused && !hasUnpaused,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
}

function appendSuggestionStatusBadge(item, { dismissed = false, paused = false } = {}) {
  if (dismissed) {
    const badge = document.createElement("span");
    badge.className = "combobox-suggestion-dismissed";
    badge.textContent = "(Dismissed)";
    item.appendChild(badge);
    return;
  }
  if (paused) {
    const badge = document.createElement("span");
    badge.className = "combobox-suggestion-paused";
    badge.textContent = "(Paused)";
    item.appendChild(badge);
  }
}

function highlightSuggestionMatch(name, query) {
  const q = query.trim();
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return document.createTextNode(name);

  const fragment = document.createDocumentFragment();
  if (idx > 0) fragment.appendChild(document.createTextNode(name.slice(0, idx)));
  const strong = document.createElement("strong");
  strong.textContent = name.slice(idx, idx + q.length);
  fragment.appendChild(strong);
  if (idx + q.length < name.length) {
    fragment.appendChild(document.createTextNode(name.slice(idx + q.length)));
  }
  return fragment;
}

function closeFieldSuggestions(fieldKey) {
  const state = fieldSuggestionState.get(fieldKey);
  if (!state) return;
  state.listEl.hidden = true;
  state.listEl.innerHTML = "";
  state.activeIndex = -1;
  state.input.setAttribute("aria-expanded", "false");
}

function closeAllFieldSuggestions() {
  for (const fieldKey of fieldSuggestionState.keys()) {
    closeFieldSuggestions(fieldKey);
  }
}

function selectFieldSuggestion(fieldKey, name) {
  const state = fieldSuggestionState.get(fieldKey);
  if (!state) return;
  state.input.value = name;
  closeFieldSuggestions(fieldKey);
  state.input.focus();
  if (fieldKey === "company") {
    applySharedCompanyProfile(name);
    renderCompanyHistory();
  }
}

function highlightFieldSuggestion(fieldKey, index) {
  const state = fieldSuggestionState.get(fieldKey);
  if (!state) return;
  const items = state.listEl.querySelectorAll(".combobox-suggestion");
  items.forEach((el, i) => el.classList.toggle("is-active", i === index));
  if (items[index]) items[index].scrollIntoView({ block: "nearest" });
  state.activeIndex = index;
}

function renderFieldSuggestions(fieldKey) {
  const state = fieldSuggestionState.get(fieldKey);
  if (!state) return;

  const query = state.input.value;
  const matches = getFieldMatches(fieldKey, query, {
    trackDismissed: state.trackDismissed,
    trackPaused: state.trackPaused,
  });
  state.listEl.innerHTML = "";
  state.activeIndex = -1;

  if (!matches.length) {
    closeFieldSuggestions(fieldKey);
    return;
  }

  for (const { name, dismissed, paused } of matches) {
    const item = document.createElement("li");
    item.className = "combobox-suggestion";
    item.role = "option";
    item.dataset.value = name;

    const label = document.createElement("span");
    label.className = "combobox-suggestion-name";
    label.appendChild(highlightSuggestionMatch(name, query));
    item.appendChild(label);
    appendSuggestionStatusBadge(item, { dismissed, paused });

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectFieldSuggestion(fieldKey, name);
    });
    state.listEl.appendChild(item);
  }

  state.listEl.hidden = false;
  state.input.setAttribute("aria-expanded", "true");
}

function setupFieldSuggestions(fieldKey, { trackDismissed = false, trackPaused = false } = {}) {
  const input = form.elements[fieldKey];
  const listEl = document.getElementById(`${fieldKey}Suggestions`);
  if (!input || !listEl) return;

  fieldSuggestionState.set(fieldKey, {
    input,
    listEl,
    activeIndex: -1,
    trackDismissed,
    trackPaused,
  });

  input.addEventListener("input", () => renderFieldSuggestions(fieldKey));
  input.addEventListener("blur", () => {
    setTimeout(() => closeFieldSuggestions(fieldKey), 150);
  });
  input.addEventListener("keydown", (e) => {
    const state = fieldSuggestionState.get(fieldKey);
    const items = state.listEl.querySelectorAll(".combobox-suggestion");
    const isOpen = !state.listEl.hidden && items.length > 0;

    if (e.key === "ArrowDown" && isOpen) {
      e.preventDefault();
      highlightFieldSuggestion(
        fieldKey,
        Math.min(state.activeIndex + 1, items.length - 1)
      );
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      highlightFieldSuggestion(fieldKey, Math.max(state.activeIndex - 1, 0));
    } else if (e.key === "Enter" && isOpen && state.activeIndex >= 0) {
      e.preventDefault();
      selectFieldSuggestion(fieldKey, items[state.activeIndex].dataset.value);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closeFieldSuggestions(fieldKey);
    }
  });
}

setupFieldSuggestions("company", { trackDismissed: true, trackPaused: true });
setupFieldSuggestions("industry");
setupFieldSuggestions("tool");
setupFieldSuggestions("owner");

function matchesFilters(deal) {
  return FILTER_FIELDS.every(({ key }) => {
    const selected = filters[key];
    if (selected.size === 0) return true;
    const value = (deal[key] || "").trim();
    if (!value) return selected.has(INCOMPLETE_FILTER);
    return selected.has(value);
  });
}

function matchesSearch(deal) {
  if (!searchQuery) return true;
  return fieldIncludesQuery(deal.company, searchQuery) || fieldIncludesQuery(deal.contact, searchQuery);
}

function fieldIncludesQuery(value, query) {
  return (value || "").toLowerCase().includes(query);
}

function getDealSearchMatches(query) {
  const byName = new Map();
  for (const match of [
    ...getFieldMatches("company", query, { activeOnly: true, trackPaused: true }),
    ...getFieldMatches("contact", query, { activeOnly: true, trackPaused: true }),
  ]) {
    const key = match.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, match);
      continue;
    }
    existing.paused = existing.paused || match.paused;
  }
  return [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
}

function getFilteredDeals() {
  return getActiveDeals().filter((deal) => matchesFilters(deal) && matchesSearch(deal));
}

function toggleFilterValue(key, value, checked) {
  if (checked) filters[key].add(value);
  else filters[key].delete(value);
  render();
}

function clearFilters() {
  for (const { key } of FILTER_FIELDS) filters[key].clear();
  openFilterKey = null;
  applySearch("", { skipSuggestions: true });
}

function closeFilterMenus() {
  openFilterKey = null;
  document.querySelectorAll(".filter-menu").forEach((menu) => {
    menu.style.boxShadow = "none";
    void menu.offsetWidth;
    menu.hidden = true;
  });
  document.querySelectorAll(".filter-trigger").forEach((trigger) => {
    trigger.classList.remove("is-open");
  });
  document.querySelectorAll(".toolbar-scroll").forEach((row) => {
    row.classList.remove("is-menu-open");
  });
}

function renderFilters(containerEl, clearBtn) {
  containerEl.innerHTML = "";

  for (const { key, label } of FILTER_FIELDS) {
    const { counts: optionCounts, incomplete: incompleteCount } = getFilterValueCounts(key);
    const options = getFilterOptions(key, optionCounts);
    const selectedCount = filters[key].size;

    const dropdown = document.createElement("div");
    dropdown.className = "filter-dropdown";
    dropdown.dataset.filter = key;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "filter-trigger";
    trigger.classList.toggle("has-selection", selectedCount > 0);
    trigger.classList.toggle("is-active", selectedCount > 0);
    trigger.classList.toggle("is-open", openFilterKey === key);

    const triggerLabel = document.createElement("span");
    triggerLabel.className = "filter-trigger-label";
    triggerLabel.textContent = selectedCount > 0 ? `${label} (${selectedCount})` : label;

    const chevron = document.createElement("span");
    chevron.className = "filter-chevron";
    chevron.textContent = "▾";

    trigger.append(triggerLabel, chevron);

    const menu = document.createElement("div");
    menu.className = "filter-menu";
    menu.hidden = openFilterKey !== key;
    const menuBody = document.createElement("div");
    menuBody.className = "filter-menu-body";

    const showIncomplete =
      hasIncompleteValues(key) || filters[key].has(INCOMPLETE_FILTER);

    if (options.length === 0 && !showIncomplete) {
      const empty = document.createElement("div");
      empty.className = "filter-empty";
      empty.textContent = `No ${label.toLowerCase()} values yet`;
      menuBody.appendChild(empty);
    } else {
      if (showIncomplete) {
        const optionLabel = document.createElement("label");
        optionLabel.className = "filter-option filter-option-incomplete";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = filters[key].has(INCOMPLETE_FILTER);

        const text = document.createElement("span");
        text.className = "filter-option-name";
        text.textContent = "Incomplete";

        checkbox.addEventListener("change", () => {
          toggleFilterValue(key, INCOMPLETE_FILTER, checkbox.checked);
        });

        optionLabel.append(checkbox, text);
        appendFilterOptionCount(optionLabel, incompleteCount);
        menuBody.appendChild(optionLabel);
      }

      for (const option of options) {
        const optionLabel = document.createElement("label");
        optionLabel.className = "filter-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = filters[key].has(option);

        const text = document.createElement("span");
        text.className = "filter-option-name";
        text.textContent = option;

        checkbox.addEventListener("change", () => {
          toggleFilterValue(key, option, checkbox.checked);
        });

        optionLabel.append(checkbox, text);
        appendFilterOptionCount(optionLabel, optionCounts.get(option) || 0);
        menuBody.appendChild(optionLabel);
      }
    }

    menu.appendChild(menuBody);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      openFilterKey = openFilterKey === key ? null : key;
      renderFilters(containerEl, clearBtn);
    });

    menu.addEventListener("click", (e) => e.stopPropagation());

    dropdown.append(trigger, menu);
    containerEl.appendChild(dropdown);
  }

  clearBtn.hidden = !hasActiveFilters();
  const scrollRow = containerEl.closest(".toolbar-scroll");
  if (scrollRow) {
    scrollRow.classList.toggle("is-menu-open", openFilterKey !== null);
  }
  scrollClearFiltersIntoView(clearBtn);
}

document.addEventListener("click", closeFilterMenus);
clearFiltersBtn.addEventListener("click", clearFilters);
pipelineClearFiltersBtn.addEventListener("click", clearFilters);
dashboardClearFiltersBtn.addEventListener("click", clearFilters);

function isMousePointer(e) {
  return !e.pointerType || e.pointerType === "mouse";
}

function isOverFilterDropdown(target) {
  return Boolean(target instanceof Element && target.closest(".filter-dropdown"));
}

document.addEventListener("pointermove", (e) => {
  if (!isMousePointer(e)) return;
  if (openFilterKey && !isOverFilterDropdown(e.target)) {
    closeFilterMenus();
  }
});

/* ------------------------------ Search ------------------------- */

const searchBubble = document.getElementById("searchBubble");
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");

const SEARCH_FIELDS = [
  { source: "board", input: searchInput, bubble: searchBubble, clearBtn: searchClearBtn, listId: "searchSuggestions" },
  { source: "pipeline", input: pipelineSearchInput, bubble: pipelineSearchBubble, clearBtn: pipelineSearchClearBtn, listId: "pipelineSearchSuggestions" },
  { source: "tasks", input: tasksSearchInput, bubble: tasksSearchBubble, clearBtn: tasksSearchClearBtn, listId: "tasksSearchSuggestions" },
  { source: "dashboard", input: dashboardSearchInput, bubble: dashboardSearchBubble, clearBtn: dashboardSearchClearBtn, listId: "dashboardSearchSuggestions" },
].filter((field) => field.input);

function applySearch(value, { source, skipSuggestions = false } = {}) {
  searchRawValue = value;
  searchQuery = value.trim().toLowerCase();
  const hasQuery = searchQuery.length > 0;

  for (const field of SEARCH_FIELDS) {
    if (field.source === source) continue;
    if (field.input.value !== searchRawValue) field.input.value = searchRawValue;
    updateSearchClearUi(field.bubble, field.clearBtn, hasQuery);
    if (hasQuery && isMobileViewport() && field.bubble) {
      field.bubble.classList.add("is-expanded", "is-expanded-settled");
    } else if (!hasQuery && field.bubble && document.activeElement !== field.input) {
      field.bubble.classList.remove("is-expanded", "is-expanded-settled");
    }
  }

  const activeField = SEARCH_FIELDS.find((f) => f.source === source);
  if (activeField) {
    updateSearchClearUi(activeField.bubble, activeField.clearBtn, hasQuery);
  }

  if (!skipSuggestions && source) {
    renderSearchSuggestions(source);
  } else if (skipSuggestions) {
    closeAllSearchSuggestions();
  }

  // Debounce board re-render so typing doesn't fight the caret / keyboard on iOS.
  clearTimeout(applySearch._timer);
  applySearch._timer = setTimeout(() => render(), 80);
}

function updateSearchClearUi(bubble, clearBtn, hasQuery) {
  if (!bubble || !clearBtn) return;
  bubble.classList.toggle("has-query", hasQuery);
  // Keep the clear control in layout; only toggle visibility so the bubble never grows.
  clearBtn.hidden = false;
  clearBtn.style.visibility = hasQuery ? "visible" : "hidden";
  clearBtn.setAttribute("aria-hidden", hasQuery ? "false" : "true");
  clearBtn.tabIndex = hasQuery ? 0 : -1;
}

function syncSearchInputsFromState() {
  const hasQuery = searchQuery.length > 0;
  for (const field of SEARCH_FIELDS) {
    if (field.input.value !== searchRawValue) field.input.value = searchRawValue;
    updateSearchClearUi(field.bubble, field.clearBtn, hasQuery);
    if (hasQuery && isMobileViewport() && field.bubble) {
      field.bubble.classList.add("is-expanded", "is-expanded-settled");
    }
  }
}

function setSearchSuggestionsOpen(source, isOpen) {
  const state = searchSuggestionState.get(source);
  if (!state) return;
  const scrollRow = state.input.closest(".toolbar-scroll");
  if (scrollRow) scrollRow.classList.toggle("is-suggestions-open", isOpen);
}

function closeSearchSuggestions(source) {
  const state = searchSuggestionState.get(source);
  if (!state) return;
  state.listEl.hidden = true;
  state.listEl.innerHTML = "";
  state.activeIndex = -1;
  state.input.setAttribute("aria-expanded", "false");
  setSearchSuggestionsOpen(source, false);
}

function closeAllSearchSuggestions() {
  for (const source of searchSuggestionState.keys()) {
    closeSearchSuggestions(source);
  }
}

function highlightSearchSuggestion(source, index) {
  const state = searchSuggestionState.get(source);
  if (!state) return;
  const items = state.listEl.querySelectorAll(".combobox-suggestion");
  items.forEach((el, i) => el.classList.toggle("is-active", i === index));
  if (items[index]) items[index].scrollIntoView({ block: "nearest" });
  state.activeIndex = index;
}

function selectSearchSuggestion(source, name) {
  const state = searchSuggestionState.get(source);
  if (!state) return;
  state.input.value = name;
  closeSearchSuggestions(source);
  applySearch(name, { source, skipSuggestions: true });
  state.input.focus({ preventScroll: true });
}

function renderSearchSuggestions(source) {
  const state = searchSuggestionState.get(source);
  if (!state) return;

  const query = state.input.value;
  const matches = getDealSearchMatches(query);
  state.listEl.innerHTML = "";
  state.activeIndex = -1;

  if (!matches.length) {
    closeSearchSuggestions(source);
    return;
  }

  for (const { name, paused } of matches) {
    const item = document.createElement("li");
    item.className = "combobox-suggestion";
    item.role = "option";
    item.dataset.value = name;

    const label = document.createElement("span");
    label.className = "combobox-suggestion-name";
    label.appendChild(highlightSuggestionMatch(name, query));
    item.appendChild(label);
    appendSuggestionStatusBadge(item, { paused });

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectSearchSuggestion(source, name);
    });
    state.listEl.appendChild(item);
  }

  state.listEl.hidden = false;
  state.input.setAttribute("aria-expanded", "true");
  setSearchSuggestionsOpen(source, true);
}

function setupSearchSuggestions(source) {
  const field = SEARCH_FIELDS.find((f) => f.source === source);
  if (!field) return;
  const listEl = document.getElementById(field.listId);
  if (!listEl) return;

  searchSuggestionState.set(source, {
    input: field.input,
    listEl,
    activeIndex: -1,
  });

  field.input.addEventListener("blur", () => {
    setTimeout(() => closeSearchSuggestions(source), 150);
  });
}

function wireSearchField(source) {
  const field = SEARCH_FIELDS.find((f) => f.source === source);
  if (!field) return;

  setupSearchSuggestions(source);

  field.input.addEventListener("input", () => applySearch(field.input.value, { source }));
  field.input.addEventListener("keydown", (e) => {
    const state = searchSuggestionState.get(source);
    const items = state?.listEl.querySelectorAll(".combobox-suggestion") || [];
    const isOpen = state && !state.listEl.hidden && items.length > 0;

    if (e.key === "ArrowDown" && isOpen) {
      e.preventDefault();
      highlightSearchSuggestion(source, Math.min(state.activeIndex + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      highlightSearchSuggestion(source, Math.max(state.activeIndex - 1, 0));
      return;
    }
    if (e.key === "Enter" && isOpen && state.activeIndex >= 0) {
      e.preventDefault();
      selectSearchSuggestion(source, items[state.activeIndex].dataset.value);
      return;
    }
    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeSearchSuggestions(source);
        return;
      }
      if (field.input.value) {
        e.stopPropagation();
        field.input.value = "";
        applySearch("", { source, skipSuggestions: true });
      }
    }
  });

  if (field.clearBtn) {
    field.clearBtn.addEventListener("click", () => {
      field.input.value = "";
      applySearch("", { source, skipSuggestions: true });
      field.input.focus({ preventScroll: true });
    });
  }

  if (field.bubble) {
    field.input.addEventListener("focus", () => expandSearch(field));
    field.input.addEventListener("blur", () => {
      if (!field.input.value) {
        field.bubble.classList.remove("is-expanded", "is-expanded-settled");
        if (field.clearBtn) field.clearBtn.style.visibility = "hidden";
      }
    });
    field.bubble.addEventListener("pointerdown", (e) => {
      if (isMobileViewport() && !field.bubble.classList.contains("is-expanded")) {
        e.preventDefault();
        expandSearch(field);
      }
    });
  }
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function scrollSearchIntoView(bubble) {
  if (!bubble) return;
  const row = bubble.closest(".toolbar-scroll");
  if (!row) return;
  const rowRect = row.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  const pad = 12;
  if (bubbleRect.right > rowRect.right - pad) {
    row.scrollBy({ left: bubbleRect.right - rowRect.right + pad, behavior: "smooth" });
  } else if (bubbleRect.left < rowRect.left + pad) {
    row.scrollBy({ left: bubbleRect.left - rowRect.left - pad, behavior: "smooth" });
  }
}

/** Keep the clear-filters chip fully visible inside the horizontal toolbar. */
function scrollClearFiltersIntoView(clearBtn) {
  if (!clearBtn || clearBtn.hidden) return;
  const row = clearBtn.closest(".toolbar-scroll");
  if (!row) return;
  requestAnimationFrame(() => {
    const rowRect = row.getBoundingClientRect();
    const btnRect = clearBtn.getBoundingClientRect();
    const pad = 12;
    if (btnRect.right > rowRect.right - pad) {
      row.scrollBy({ left: btnRect.right - rowRect.right + pad, behavior: "smooth" });
    } else if (btnRect.left < rowRect.left + pad) {
      row.scrollBy({ left: btnRect.left - rowRect.left - pad, behavior: "smooth" });
    }
  });
}

function expandSearch(field) {
  if (!field?.bubble) return;
  field.bubble.classList.add("is-expanded");
  if (field.clearBtn) {
    field.clearBtn.hidden = false;
    if (!field.input.value) {
      field.clearBtn.style.visibility = "hidden";
      field.clearBtn.tabIndex = -1;
    }
  }
  if (document.activeElement !== field.input) {
    field.input.focus({ preventScroll: true });
  }
  clearTimeout(expandSearch._settleTimer);
  expandSearch._settleTimer = setTimeout(() => {
    field.bubble.classList.add("is-expanded-settled");
    scrollSearchIntoView(field.bubble);
  }, 220);
}

for (const field of SEARCH_FIELDS) {
  wireSearchField(field.source);
}

/* ------------------------------ Rendering ---------------------- */

function render() {
  lastRenderedSignature = JSON.stringify(deals);
  syncSearchInputsFromState();
  if (activeTab === "board") {
    renderFilters(filtersEl, clearFiltersBtn);
    renderBoard();
  } else if (activeTab === "pipeline") {
    renderFilters(pipelineFiltersEl, pipelineClearFiltersBtn);
    renderPipeline();
  } else if (activeTab === "dashboard") {
    renderFilters(dashboardFiltersEl, dashboardClearFiltersBtn);
    renderDashboard();
  } else if (activeTab === "history") {
    renderHistory();
  } else if (activeTab === "knowledge") {
    renderKnowledge();
  } else if (activeTab === "tasks") {
    renderFilters(tasksFiltersEl, tasksClearFiltersBtn);
    renderTasksView();
  }
}

function renderHistory() {
  historyListEl.innerHTML = "";
  const allDismissed = getDismissedDeals();
  const dismissed = getFilteredDismissedDeals();
  const hasQuery = historySearchQuery.trim().length > 0;

  if (!allDismissed.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No dismissed deals yet.";
    historyListEl.appendChild(empty);
    return;
  }

  if (!dismissed.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = hasQuery
      ? "No dismissed deals match that company name."
      : "No dismissed deals yet.";
    historyListEl.appendChild(empty);
    return;
  }

  for (const deal of dismissed) {
    historyListEl.appendChild(renderHistoryItem(deal));
  }
}

function renderHistoryItem(deal) {
  const item = document.createElement("article");
  item.className = "history-item";
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `View ${deal.company || "deal"} (read only)`);
  item.addEventListener("click", () => openModal({ deal, readOnly: true }));
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal({ deal, readOnly: true });
    }
  });

  const main = document.createElement("div");
  main.className = "history-item-main";

  const company = document.createElement("h3");
  company.className = "history-company";
  company.textContent = deal.company || "Untitled deal";

  const meta = document.createElement("p");
  meta.className = "history-meta";
  meta.textContent = [deal.contact, deal.email || deal.phone, deal.owner]
    .filter(Boolean)
    .join(" · ");

  const tags = document.createElement("div");
  tags.className = "history-tags";
  if (deal.industry) {
    const tag = document.createElement("span");
    tag.className = "tag tag-industry";
    tag.textContent = deal.industry;
    tags.appendChild(tag);
  }
  if (deal.tool) {
    const tag = document.createElement("span");
    tag.className = "tag tag-tool";
    tag.textContent = deal.tool;
    tags.appendChild(tag);
  }

  main.appendChild(company);
  if (meta.textContent) main.appendChild(meta);
  if (tags.childElementCount) main.appendChild(tags);

  const aside = document.createElement("div");
  aside.className = "history-item-aside";

  const date = document.createElement("time");
  date.className = "history-date";
  if (deal.dismissedAt) {
    date.dateTime = new Date(deal.dismissedAt).toISOString();
    date.textContent = `Dismissed ${formatShortDate(deal.dismissedAt)}`;
  } else {
    date.textContent = "Dismissed";
  }

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "btn btn-ghost btn-sm";
  restoreBtn.textContent = "Restore to Prospects";
  restoreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    restoreDealToProspects(deal.id);
  });

  aside.append(date, restoreBtn);
  item.append(main, aside);
  return item;
}

function restoreDealToProspects(dealId) {
  const deal = deals.find((d) => d.id === dealId);
  if (!deal || deal.stage !== "dismissed") return;
  deal.stage = "prospects";
  delete deal.dismissedAt;
  delete deal.pausedAt;
  deal.boardOrder = nextBoardOrder("prospects");
  saveDeals(deal.id);
  render();
}

function openPauseConfirm(deal) {
  if (!deal?.id) return;
  pendingPauseDealId = deal.id;
  pauseConfirmAction = isDealPaused(deal) ? "unpause" : "pause";
  syncPauseConfirmUi(deal);
  pauseOverlay.hidden = false;
}

function syncPauseConfirmUi(deal) {
  const name = deal?.company ? ` “${deal.company}”` : "";
  const pausing = pauseConfirmAction === "pause";
  pauseTitle.textContent = pausing ? "Pause deal" : "Unpause deal";
  pauseLead.textContent = pausing
    ? `Are you sure you want to pause this deal${name}? It will stay in Prospects until you unpause it.`
    : `Are you sure you want to unpause this deal${name}? It will return to the active Prospects list.`;
  pauseConfirmBtn.textContent = pausing ? "Yes, pause" : "Yes, unpause";
}

function closePauseModal() {
  pauseOverlay.hidden = true;
  pendingPauseDealId = null;
  pauseConfirmAction = "pause";
}

function confirmPauseAction() {
  if (!pendingPauseDealId) return;
  const deal = deals.find((d) => d.id === pendingPauseDealId);
  if (!deal) {
    closePauseModal();
    return;
  }

  if (pauseConfirmAction === "pause") {
    pauseDeal(deal);
  } else {
    unpauseDeal(deal);
  }
  closePauseModal();
}

function pauseDeal(deal) {
  if (!deal || deal.stage === "dismissed") return;
  const now = Date.now();
  deal.pausedAt = now;
  if (deal.stage !== "prospects") {
    deal.boardOrder = nextBoardOrder("prospects");
    deal.stage = "prospects";
  }
  appendActivityNote(deal, makePauseActivityNote(true, now, stampCurrentUser(deal.owner)));
  saveDeals(deal.id);
  render();
}

function unpauseDeal(deal) {
  if (!deal || !isDealPaused(deal)) return;
  const now = Date.now();
  delete deal.pausedAt;
  deal.stage = "prospects";
  appendActivityNote(deal, makePauseActivityNote(false, now, stampCurrentUser(deal.owner)));
  const stillPaused = getActiveDeals().some((d) => isDealPaused(d));
  if (!stillPaused) showPausedProspectsOnly = false;
  saveDeals(deal.id);
  render();
}

function togglePausedProspectsView() {
  showPausedProspectsOnly = !showPausedProspectsOnly;
  if (showPausedProspectsOnly) showTouchedProspectsOnly = false;
  render();
}

function toggleTouchedProspectsView() {
  showTouchedProspectsOnly = !showTouchedProspectsOnly;
  if (showTouchedProspectsOnly) showPausedProspectsOnly = false;
  render();
}

function clearProspectsSubsetView() {
  if (!showPausedProspectsOnly && !showTouchedProspectsOnly) return;
  showPausedProspectsOnly = false;
  showTouchedProspectsOnly = false;
  render();
}

function renderBoard() {
  boardEl.innerHTML = "";
  const visibleDeals = getFilteredDeals();
  if (!visibleDeals.some((d) => isDealPaused(d))) {
    showPausedProspectsOnly = false;
  }
  if (!visibleDeals.some((d) => !isDealPaused(d) && isDealTouched(d))) {
    showTouchedProspectsOnly = false;
  }
  for (const stage of STAGES) {
    boardEl.appendChild(renderColumn(stage, visibleDeals));
  }
  // Wait for layout so we only enable vertical scroll when cards actually overflow.
  requestAnimationFrame(() => {
    syncColumnBodyScrolling();
    requestAnimationFrame(syncColumnBodyScrolling);
  });
}

/** Enable overflow scroll on a column body only when its cards don't fit. */
function syncColumnBodyScrolling() {
  boardEl.querySelectorAll(".column-body").forEach((body) => {
    // Clear inline overflow so class-based CSS can take over cleanly.
    body.style.overflowY = "";
    const canScroll = body.scrollHeight > body.clientHeight + 1;
    body.classList.toggle("is-scrollable", canScroll);
    if (!canScroll) body.scrollTop = 0;
  });
}

let pipelineResizeTimer = null;
window.addEventListener("resize", () => {
  if (activeTab === "board") syncColumnBodyScrolling();
  if (activeTab === "pipeline") {
    clearTimeout(pipelineResizeTimer);
    pipelineResizeTimer = setTimeout(() => renderPipeline(), 120);
    return;
  }
  if (activeTab === "tasks" && tasksViewMode === "pipeline") {
    clearTimeout(pipelineResizeTimer);
    pipelineResizeTimer = setTimeout(() => renderTasksView(), 120);
  }
});

/* ------------------------------ Touch overscroll guard (iOS) ---- */

let touchScrollGuard = null;

function columnBodyCanScroll(body, dy) {
  if (!body?.classList.contains("is-scrollable")) return false;
  const atTop = body.scrollTop <= 0;
  const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
  if (dy > 0 && atTop) return false;
  if (dy < 0 && atBottom) return false;
  return true;
}

/** True when this element can still move in the finger's direction. */
function elementCanScroll(el, axis, delta) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const style = getComputedStyle(el);
  if (axis === "x") {
    const overflow = style.overflowX;
    if (overflow !== "auto" && overflow !== "scroll") return false;
    if (el.scrollWidth <= el.clientWidth + 1) return false;
    if (delta > 0 && el.scrollLeft <= 0) return false;
    if (delta < 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) return false;
    return true;
  }
  const overflow = style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  if (delta > 0 && el.scrollTop <= 0) return false;
  if (delta < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false;
  return true;
}

function hasScrollableAxis(start, axis) {
  let el = start;
  while (el && el !== document.body && el !== document.documentElement) {
    if (elementCanScroll(el, axis, 1) || elementCanScroll(el, axis, -1)) return true;
    el = el.parentElement;
  }
  return false;
}

function scrollableAncestor(start, axis, delta) {
  let el = start;
  while (el && el !== document.body && el !== document.documentElement) {
    if (elementCanScroll(el, axis, delta)) return el;
    el = el.parentElement;
  }
  return null;
}

document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 1) {
      touchScrollGuard = null;
      return;
    }
    const t = e.touches[0];
    const el = (e.target instanceof Element ? e.target : null) || document.elementFromPoint(t.clientX, t.clientY);
    touchScrollGuard = {
      x: t.clientX,
      y: t.clientY,
      target: el instanceof Element ? el : null,
    };
  },
  { passive: true, capture: true }
);

document.addEventListener(
  "touchend",
  () => {
    touchScrollGuard = null;
  },
  { passive: true, capture: true }
);

document.addEventListener(
  "touchcancel",
  () => {
    touchScrollGuard = null;
  },
  { passive: true, capture: true }
);

function getPipelineDeals() {
  return getFilteredDeals().filter(
    (deal) =>
      deal.stage === "committed" &&
      deal.committedAt &&
      deal.implementationDays > 0
  );
}

function getPipelineVisibleSpan() {
  const today = startOfDay(new Date());
  return Math.max(
    shiftDateByMonths(today, pipelineState.periodMonths).getTime() -
      addDays(today, -PIPELINE_LOOKBACK_DAYS).getTime(),
    MS_DAY
  );
}

function getPipelinePeriodRange() {
  const today = startOfDay(new Date());
  const minStart = startOfMonth(addMonths(today, -PIPELINE_SCROLL_MAX_PAST_MONTHS)).getTime();
  const maxEnd = addMonths(startOfMonth(today), PIPELINE_SCROLL_MAX_FUTURE_MONTHS).getTime();
  let start = startOfMonth(addMonths(today, -PIPELINE_SCROLL_PAST_MONTHS)).getTime();
  let end = addMonths(startOfMonth(today), PIPELINE_SCROLL_FUTURE_MONTHS).getTime();

  for (const deal of getPipelineDeals()) {
    const dealStart = getImplementationStart(deal);
    const dealEnd = getImplementationEnd(deal);
    if (Number.isFinite(dealStart)) start = Math.min(start, startOfMonth(new Date(dealStart)).getTime());
    if (Number.isFinite(dealEnd)) end = Math.max(end, addMonths(startOfMonth(new Date(dealEnd)), 1).getTime());
  }

  start = Math.max(start, minStart);
  end = Math.min(Math.max(end, start + MS_DAY), maxEnd);
  return {
    start,
    end,
    span: Math.max(end - start, MS_DAY),
  };
}

function getPipelineViewportPx() {
  if (!pipelineChartEl) return 720;
  const styles = getComputedStyle(pipelineChartEl);
  const pad = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  return Math.max(pipelineChartEl.clientWidth - pad, 320);
}

function layoutPipelineTimeline(periodStart, span) {
  if (!pipelineChartEl || !pipelineScrollEl) return;
  const viewportPx = getPipelineViewportPx();
  const contentWidth = Math.max(viewportPx, (span / getPipelineVisibleSpan()) * viewportPx);
  pipelineScrollEl.style.width = `${contentWidth}px`;

  const empty = pipelineRowsEl.querySelector(".pipeline-empty");
  if (empty) empty.style.width = `${viewportPx}px`;

  const today = startOfDay(new Date()).getTime();
  const startMs =
    pipelineViewportStartMs == null
      ? today - PIPELINE_LOOKBACK_DAYS * MS_DAY
      : pipelineViewportStartMs;
  pipelineSyncingScroll = true;
  pipelineChartEl.scrollLeft = Math.max(0, ((startMs - periodStart) / span) * contentWidth);
  requestAnimationFrame(() => {
    pipelineSyncingScroll = false;
  });
}

function rememberPipelineScroll() {
  if (pipelineSyncingScroll || !pipelineChartEl || !pipelineScrollEl) return;
  const contentWidth = pipelineScrollEl.offsetWidth;
  if (!contentWidth) return;
  const { start, span } = getPipelinePeriodRange();
  pipelineViewportStartMs = start + (pipelineChartEl.scrollLeft / contentWidth) * span;
}

function assignPipelineRows(deals) {
  const sorted = [...deals].sort(
    (a, b) => getImplementationStart(a) - getImplementationStart(b)
  );
  const rowEnds = [];

  for (const deal of sorted) {
    const start = getImplementationStart(deal);
    const end = getImplementationEnd(deal);
    let row = 0;
    while (row < rowEnds.length && rowEnds[row] > start) row += 1;
    if (row === rowEnds.length) rowEnds.push(0);
    rowEnds[row] = end;
    deal._pipelineRow = row;
    deal._pipelineStart = start;
    deal._pipelineEnd = end;
  }

  return rowEnds.length;
}

function getImplementationStart(deal) {
  return startOfDay(new Date(deal.committedAt)).getTime();
}

function getImplementationEnd(deal) {
  return getImplementationStart(deal) + deal.implementationDays * MS_DAY;
}

function getDealEndMs(deal) {
  return getImplementationEnd(deal) - MS_DAY;
}

function getMonthRevenue(deals, monthStart, monthEnd) {
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();

  return deals.reduce((sum, deal) => {
    const endMs = getDealEndMs(deal);
    if (endMs >= monthStartMs && endMs < monthEndMs) {
      return sum + (Number(deal.value) || 0);
    }
    return sum;
  }, 0);
}

function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function resolvePipelineTodayOverlaps(monthTicks) {
  const todayTick = pipelineAxisEl.querySelector(".pipeline-tick-today");
  const todayLabel = todayTick?.querySelector(".pipeline-tick-label");
  if (!todayLabel) return;

  const pad = 8;
  const todayRect = todayLabel.getBoundingClientRect();
  const todayLeft = todayRect.left - pad;
  const todayRight = todayRect.right + pad;
  const todayMid = (todayRect.left + todayRect.right) / 2;

  for (const { tick } of monthTicks) {
    const label = tick.querySelector(".pipeline-tick-label");
    const revenue = tick.querySelector(".pipeline-tick-revenue");

    for (const el of [label, revenue]) {
      if (!el) continue;
      el.style.transform = "";
      el.classList.remove("is-shifted-left", "is-shifted-right");
    }

    // Month names stay on the month mark. Only revenue dodges Today.
    pushPipelineAxisTextClear(revenue, todayLeft, todayRight, todayMid);
  }
}

function pushPipelineAxisTextClear(el, todayLeft, todayRight, todayMid) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const overlaps = r.left < todayRight && r.right > todayLeft;
  if (!overlaps) return;

  const elMid = (r.left + r.right) / 2;
  if (elMid <= todayMid) {
    const shift = Math.max(0, r.right - todayLeft);
    if (shift > 0) {
      el.style.transform = `translateX(-${shift}px)`;
      el.classList.add("is-shifted-left");
    }
  } else {
    const shift = Math.max(0, todayRight - r.left);
    if (shift > 0) {
      el.style.transform = `translateX(${shift}px)`;
      el.classList.add("is-shifted-right");
    }
  }
}

function hidePipelineTooltip() {
  const tip = document.getElementById("pipelineTooltip");
  if (tip) {
    tip.hidden = true;
    delete tip.dataset.tipKey;
  }
}

function showPipelineTooltip(bar, deal, barStart, barEnd, event) {
  let tip = document.getElementById("pipelineTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "pipelineTooltip";
    tip.className = "pipeline-tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }

  const tipKey = `${deal.id}:${barStart}:${barEnd}`;
  if (tip.dataset.tipKey !== tipKey) {
    tip.dataset.tipKey = tipKey;
    tip.innerHTML = "";

    const title = document.createElement("div");
    title.className = "pipeline-tooltip-title";
    title.textContent = deal.company || "Untitled deal";
    tip.appendChild(title);

    const rows = [
      deal.tool ? ["Tool", deal.tool] : null,
      deal.contractName ? ["Contract", deal.contractName] : null,
      ["Duration", `${deal.implementationDays} days`],
      [
        "Dates",
        `${formatMonthDay(new Date(barStart))} – ${formatMonthDay(new Date(barEnd - MS_DAY))}`,
      ],
    ].filter(Boolean);

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "pipeline-tooltip-row";

      const labelEl = document.createElement("span");
      labelEl.className = "pipeline-tooltip-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("span");
      valueEl.className = "pipeline-tooltip-value";
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      tip.appendChild(row);
    }
  }

  tip.hidden = false;

  const rect = bar.getBoundingClientRect();
  const tipWidth = tip.offsetWidth || 220;
  const tipHeight = tip.offsetHeight || 96;
  const pointerX = Number.isFinite(event?.clientX) ? event.clientX : rect.left + rect.width / 2;
  const pointerY = Number.isFinite(event?.clientY) ? event.clientY : rect.top;
  let left = pointerX - tipWidth / 2;
  let top = pointerY - tipHeight - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
  if (top < 8) top = pointerY + 16;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function renderPipeline() {
  hidePipelineTooltip();
  const { start: periodStart, end: periodEnd, span } = getPipelinePeriodRange();
  const deals = getPipelineDeals();

  if (pipelinePeriodLength) pipelinePeriodLength.value = String(pipelineState.periodMonths);

  pipelineAxisEl.innerHTML = "";
  const months = getOverlappingMonthStarts(periodStart, periodEnd);
  const monthTicks = [];
  for (const monthStart of months) {
    const monthEnd = addMonths(monthStart, 1);
    const visibleStart = Math.max(monthStart.getTime(), periodStart);
    const visibleEnd = Math.min(monthEnd.getTime(), periodEnd);
    if (visibleEnd <= visibleStart) continue;

    const revenue = getMonthRevenue(deals, monthStart, monthEnd);
    const left = ((visibleStart - periodStart) / span) * 100;
    const width = ((visibleEnd - visibleStart) / span) * 100;
    const visibleDays = (visibleEnd - visibleStart) / MS_DAY;
    const showMonthLabel = shouldShowMonthAxisLabel(
      monthStart,
      visibleStart,
      visibleDays,
      periodStart,
      PIPELINE_MIN_MONTH_LABEL_DAYS
    );

    const tick = document.createElement("div");
    tick.className = "pipeline-tick";
    tick.style.left = `${left}%`;
    tick.style.width = `${width}%`;

    if (showMonthLabel) {
      const label = document.createElement("span");
      label.className = "pipeline-tick-label";
      label.textContent = formatMonthLabel(monthStart);

      const revenueEl = document.createElement("span");
      revenueEl.className = "pipeline-tick-revenue";
      revenueEl.title = `Estimated revenue from deals ending in ${formatMonthYear(monthStart)}`;
      revenueEl.textContent = fmtEuro.format(revenue);

      tick.append(label, revenueEl);
    } else {
      tick.classList.add("is-sliver");
    }

    pipelineAxisEl.appendChild(tick);
    monthTicks.push({ tick, monthStart, monthEnd, left, width });
  }

  const today = startOfDay(new Date()).getTime();
  if (today >= periodStart && today < periodEnd) {
    const todayTick = document.createElement("div");
    todayTick.className = "pipeline-tick pipeline-tick-today";
    todayTick.style.left = `${((today - periodStart) / span) * 100}%`;
    todayTick.innerHTML = `<span class="pipeline-tick-label">Today</span>`;
    pipelineAxisEl.appendChild(todayTick);
    requestAnimationFrame(() => resolvePipelineTodayOverlaps(monthTicks));
  }

  pipelineRowsEl.innerHTML = "";
  const rowCount = Math.max(assignPipelineRows(deals), 1);
  pipelineRowsEl.style.height = `${rowCount * PIPELINE_ROW_HEIGHT}px`;

  for (const monthStart of months) {
    const monthMs = monthStart.getTime();
    if (monthMs <= periodStart || monthMs >= periodEnd) continue;
    const gridLine = document.createElement("div");
    gridLine.className = "pipeline-gridline";
    gridLine.style.left = `${((monthMs - periodStart) / span) * 100}%`;
    pipelineRowsEl.appendChild(gridLine);
  }

  for (let row = 1; row < rowCount; row += 1) {
    const divider = document.createElement("div");
    divider.className = "pipeline-row-divider";
    divider.style.top = `${row * PIPELINE_ROW_HEIGHT}px`;
    pipelineRowsEl.appendChild(divider);
  }

  if (today >= periodStart && today < periodEnd) {
    const todayLine = document.createElement("div");
    todayLine.className = "pipeline-today-line";
    todayLine.style.left = `${((today - periodStart) / span) * 100}%`;
    pipelineRowsEl.appendChild(todayLine);
  }

  if (deals.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pipeline-empty";
    empty.textContent = hasActiveFilters()
      ? "No matching committed deals on the timeline"
      : "No committed deals yet — drag a deal to Committed on the Deals tab";
    pipelineRowsEl.appendChild(empty);
    layoutPipelineTimeline(periodStart, span);
    requestAnimationFrame(() => fitPipelineBarLabels());
    return;
  }

  for (const deal of deals) {
    const barStart = deal._pipelineStart;
    const barEnd = deal._pipelineEnd;

    if (barEnd <= periodStart || barStart >= periodEnd) continue;
    // Carry-over that only touches the first visible day has no tail to show.
    if (barStart < periodStart && barEnd <= periodStart + MS_DAY) continue;

    const visibleStart = Math.max(barStart, periodStart);
    const visibleEnd = Math.min(barEnd, periodEnd);
    if (visibleEnd <= visibleStart) continue;
    const left = ((visibleStart - periodStart) / span) * 100;
    const width = ((visibleEnd - visibleStart) / span) * 100;

    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "pipeline-bar";
    const continuesStart = barStart < periodStart;
    const continuesEnd = barEnd > periodEnd;
    if (continuesStart) bar.classList.add("continues-start");
    if (continuesEnd) bar.classList.add("continues-end");
    bar.style.top = `${deal._pipelineRow * PIPELINE_ROW_HEIGHT + PIPELINE_BAR_TOP}px`;

    // Place bars on the date axis so tails from earlier periods stay visible.
    // Flat continues-* edges are clipped by `.pipeline-rows` overflow.
    if (continuesStart && continuesEnd) {
      bar.style.left = "0";
      bar.style.right = "0";
      bar.style.width = "auto";
    } else if (continuesEnd) {
      bar.style.left = `${left}%`;
      bar.style.right = "0";
      bar.style.width = "auto";
    } else if (continuesStart) {
      bar.style.left = "0";
      bar.style.width = `${left + width}%`;
    } else {
      bar.style.left = `${left}%`;
      bar.style.width = `${width}%`;
    }

    const text = document.createElement("span");
    text.className = "pipeline-bar-text";

    const label = document.createElement("span");
    label.className = "pipeline-bar-label";

    const companyName = document.createElement("span");
    companyName.className = "pipeline-bar-company";
    companyName.textContent = deal.company;
    label.appendChild(companyName);

    if (deal.tool) {
      const tool = document.createElement("span");
      tool.className = "pipeline-bar-tool";
      tool.textContent = deal.tool;
      label.appendChild(tool);
    }

    const duration = document.createElement("span");
    duration.className = "pipeline-bar-duration";
    duration.textContent = `${deal.implementationDays} days`;

    text.append(label, duration);
    bar.append(text);
    bar.addEventListener("mouseenter", (e) => showPipelineTooltip(bar, deal, barStart, barEnd, e));
    bar.addEventListener("mousemove", (e) => showPipelineTooltip(bar, deal, barStart, barEnd, e));
    bar.addEventListener("mouseleave", hidePipelineTooltip);
    bar.addEventListener("focus", () => showPipelineTooltip(bar, deal, barStart, barEnd));
    bar.addEventListener("blur", hidePipelineTooltip);
    bar.addEventListener("click", () => openModal({ deal }));
    pipelineRowsEl.appendChild(bar);
  }

  layoutPipelineTimeline(periodStart, span);
  requestAnimationFrame(() => fitPipelineBarLabels());
}

function fitPipelineBarLabels() {
  pipelineRowsEl.querySelectorAll(".pipeline-bar").forEach((bar) => {
    const duration = bar.querySelector(".pipeline-bar-duration");
    if (!duration) return;
    duration.hidden = false;
    // Keep duration only when the bubble is wide enough to show it with padding.
    const minForDuration = duration.scrollWidth + 36;
    if (bar.clientWidth < minForDuration) duration.hidden = true;
  });
}

function renderColumn(stage, visibleDeals) {
  // Paused deals always belong under Prospects, even if stage drifted.
  const liveDeals = visibleDeals
    .filter((d) => d.stage === stage.id && !isDealPaused(d))
    .sort(compareColumnOrder);
  const touchedDeals =
    stage.id === "prospects" ? liveDeals.filter((d) => isDealTouched(d)) : [];
  const activeDeals =
    stage.id === "prospects" ? liveDeals.filter((d) => !isDealTouched(d)) : liveDeals;
  const pausedDeals =
    stage.id === "prospects"
      ? visibleDeals.filter((d) => isDealPaused(d)).sort(compareColumnOrder)
      : [];
  const pausedView =
    stage.id === "prospects" && showPausedProspectsOnly && pausedDeals.length > 0;
  const touchedView =
    stage.id === "prospects" && showTouchedProspectsOnly && touchedDeals.length > 0;
  const subsetView = pausedView || touchedView;
  const shownDeals = pausedView ? pausedDeals : touchedView ? touchedDeals : activeDeals;
  const activeTotal = activeDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const touchedTotal = touchedDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const pausedTotal = pausedDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const includingPausedTotal = activeTotal + touchedTotal + pausedTotal;
  const total = pausedView ? pausedTotal : touchedView ? touchedTotal : activeTotal;
  const filtersActive = hasActiveFilters();

  const col = document.createElement("section");
  col.className = "column";
  col.dataset.stage = stage.id;

  const header = document.createElement("div");
  header.className = "column-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "column-heading";

  const title = document.createElement("h2");
  title.className = "column-title";
  title.textContent = stage.label;

  const count = document.createElement("span");
  count.className = "column-count";
  count.textContent = activeDeals.length;

  titleGroup.append(title, count);
  header.appendChild(titleGroup);

  const canCreateInStage = stage.id === "prospects" || stage.id === "interested";
  const hasProspectSubsets =
    stage.id === "prospects" && (touchedDeals.length > 0 || pausedDeals.length > 0);

  if (hasProspectSubsets) {
    header.classList.add("has-subsets");
    titleGroup.classList.add("column-view-toggle");
    titleGroup.title = "Show untouched prospects";
    titleGroup.addEventListener("click", clearProspectsSubsetView);
    if (!subsetView) titleGroup.classList.add("is-active");
  }

  if (canCreateInStage) {
    const addBtn = document.createElement("button");
    addBtn.className = "column-add";
    addBtn.title = `Add deal to ${stage.label}`;
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => openModal({ stage: stage.id }));
    header.appendChild(addBtn);
  }

  if (hasProspectSubsets) {
    const subsets = document.createElement("div");
    subsets.className = "column-subsets";

    if (touchedDeals.length > 0) {
      const touchedToggle = document.createElement("button");
      touchedToggle.type = "button";
      touchedToggle.className = "column-touched-toggle";
      if (touchedView) touchedToggle.classList.add("is-active");
      touchedToggle.title = touchedView ? "Show untouched prospects" : "Show touched deals only";
      touchedToggle.setAttribute("aria-pressed", touchedView ? "true" : "false");

      const touchedLabel = document.createElement("span");
      touchedLabel.className = "column-touched-label";
      touchedLabel.textContent = "Touched";

      const touchedCount = document.createElement("span");
      touchedCount.className = "column-count column-touched-count";
      touchedCount.textContent = touchedDeals.length;

      touchedToggle.append(touchedLabel, touchedCount);
      touchedToggle.addEventListener("click", toggleTouchedProspectsView);
      subsets.appendChild(touchedToggle);
    }

    if (pausedDeals.length > 0) {
      const pausedToggle = document.createElement("button");
      pausedToggle.type = "button";
      pausedToggle.className = "column-paused-toggle";
      if (pausedView) pausedToggle.classList.add("is-active");
      pausedToggle.title = pausedView ? "Show untouched prospects" : "Show paused deals only";
      pausedToggle.setAttribute("aria-pressed", pausedView ? "true" : "false");

      const pausedLabel = document.createElement("span");
      pausedLabel.className = "column-paused-label";
      pausedLabel.textContent = "Paused";

      const pausedCount = document.createElement("span");
      pausedCount.className = "column-count column-paused-count";
      pausedCount.textContent = pausedDeals.length;

      pausedToggle.append(pausedLabel, pausedCount);
      pausedToggle.addEventListener("click", togglePausedProspectsView);
      subsets.appendChild(pausedToggle);
    }

    header.appendChild(subsets);
  }

  const body = document.createElement("div");
  body.className = "column-body";

  const stack = document.createElement("div");
  stack.className = "column-stack";

  if (shownDeals.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    if (pausedView) {
      hint.textContent = "No paused deals";
    } else if (touchedView) {
      hint.textContent = "No touched deals";
    } else {
      hint.textContent = (filtersActive || searchQuery) ? "No matching deals" : "Drop deals here";
    }
    stack.appendChild(hint);
  } else {
    for (const deal of shownDeals) {
      stack.appendChild(renderCard(deal));
    }
  }
  body.appendChild(stack);

  const footer = document.createElement("div");
  footer.className = "column-footer";

  const totalLabel = document.createElement("span");
  totalLabel.className = "total-label";
  totalLabel.textContent = "Total";

  const totalRight = document.createElement("div");
  totalRight.className = "total-right";

  if (stage.id === "prospects" && pausedDeals.length > 0 && !pausedView) {
    const including = document.createElement("span");
    including.className = "total-including-paused";
    including.textContent = `(including paused ${fmtEuro.format(includingPausedTotal)})`;
    totalRight.appendChild(including);
  }

  const totalValue = document.createElement("span");
  totalValue.className = "total-value";
  totalValue.textContent = fmtEuro.format(total);
  totalRight.appendChild(totalValue);

  footer.append(totalLabel, totalRight);

  col.append(header, body, footer);
  return col;
}

function renderCard(deal) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = deal.id;
  if (isDealPaused(deal)) card.classList.add("is-paused");
  if (isDealPinned(deal)) card.classList.add("is-pinned");

  if (dealShowsProgress(deal)) {
    card.classList.add("has-progress");
    const filled = dealProgressFilled(deal);
    const flags = milestonesFromNotes(deal.notes);
    const doneLabels = DEAL_MILESTONES.filter((milestone) => flags[milestone.id]).map(
      (milestone) => milestone.label
    );
    const progress = document.createElement("div");
    progress.className = "card-progress";
    progress.setAttribute("role", "img");
    progress.setAttribute(
      "aria-label",
      doneLabels.length
        ? `${filled} of ${CARD_PROGRESS_STEPS} stages complete: ${doneLabels.join(", ")}`
        : `0 of ${CARD_PROGRESS_STEPS} stages complete`
    );
    progress.title = progress.getAttribute("aria-label");
    for (let i = 0; i < CARD_PROGRESS_STEPS; i += 1) {
      const segment = document.createElement("span");
      segment.className = "card-progress-seg";
      if (i < filled) segment.classList.add("is-done");
      progress.appendChild(segment);
    }
    card.appendChild(progress);
  }

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "card-pin-btn";
  pinBtn.setAttribute("aria-pressed", isDealPinned(deal) ? "true" : "false");
  const pinAllowed = canPinDeal(deal);
  pinBtn.setAttribute(
    "aria-label",
    isDealPinned(deal)
      ? "Unpin deal"
      : pinAllowed
        ? "Pin deal"
        : `Maximum ${MAX_PINNED_PER_STAGE} pinned deals in this column`
  );
  if (!isDealPinned(deal) && !pinAllowed) pinBtn.classList.add("is-capped");
  pinBtn.innerHTML = `<svg class="card-pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.86-1.28 3.41-3 3.86V14h5.2v7h1.6v-7H19v-1.14C17.28 12.41 16 10.86 16 9z"/></svg>`;

  const pinTip = document.createElement("span");
  pinTip.className = "card-pin-tip";
  pinTip.textContent = isDealPinned(deal)
    ? "Unpin deal"
    : pinAllowed
      ? "Pin deal"
      : `Maximum ${MAX_PINNED_PER_STAGE} pinned in this column`;
  pinBtn.appendChild(pinTip);

  pinBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  pinBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDealPin(deal);
  });

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "card-pause-btn";
  pauseBtn.setAttribute("aria-label", isDealPaused(deal) ? "Unpause deal" : "Pause deal");
  pauseBtn.innerHTML = isDealPaused(deal)
    ? `<svg class="card-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="10,8 17,12 10,16" fill="currentColor"/></svg>`
    : `<svg class="card-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="8" width="2.2" height="8" rx="0.6" fill="currentColor"/><rect x="13.3" y="8" width="2.2" height="8" rx="0.6" fill="currentColor"/></svg>`;

  const tip = document.createElement("span");
  tip.className = "card-pause-tip";
  tip.textContent = isDealPaused(deal) ? "Unpause deal" : "Pause deal";
  pauseBtn.appendChild(tip);

  pauseBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  pauseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPauseConfirm(deal);
  });

  const company = document.createElement("h3");
  company.className = "card-company";

  const companyName = document.createElement("span");
  companyName.className = "card-company-name";
  companyName.textContent = deal.company;
  company.appendChild(companyName);

  if (deal.tool) {
    const tool = document.createElement("span");
    tool.className = "card-company-tool";
    tool.textContent = deal.tool;
    company.appendChild(tool);
  }

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = [deal.contact, deal.email || deal.phone].filter(Boolean).join(" · ");

  const tags = document.createElement("div");
  tags.className = "card-tags";
  if (deal.industry) {
    const tag = document.createElement("span");
    tag.className = "tag tag-industry";
    tag.textContent = deal.industry;
    tags.appendChild(tag);
  }
  if (deal.contractName) {
    const contract = document.createElement("span");
    contract.className = "tag tag-contract";
    contract.textContent = deal.contractName;
    tags.appendChild(contract);
  }
  if (deal.implementationDays && deal.committedAt && !isDealPaused(deal)) {
    const impl = document.createElement("span");
    impl.className = "tag tag-impl";
    impl.textContent = `${formatShortDate(deal.committedAt)} · ${deal.implementationDays} days`;
    tags.appendChild(impl);
  }

  const row = document.createElement("div");
  row.className = "card-row";

  const value = document.createElement("span");
  value.className = "card-value";
  value.textContent = fmtEuro.format(Number(deal.value) || 0);
  row.appendChild(value);

  if (deal.owner) {
    const owner = document.createElement("span");
    owner.className = "card-owner";
    owner.textContent = deal.owner;
    owner.title = deal.owner;
    row.appendChild(owner);
  }

  card.append(pinBtn, pauseBtn, company);
  if (meta.textContent) card.append(meta);
  if (tags.childElementCount) card.append(tags);
  card.append(row);

  card.addEventListener("click", (e) => {
    if (card.dataset.suppressClick === "1") {
      e.preventDefault();
      e.stopPropagation();
      delete card.dataset.suppressClick;
      return;
    }
    if (e.target.closest(".card-pause-btn, .card-pin-btn")) return;
    openModal({ deal });
  });

  attachCardPointerDrag(card, deal);

  return card;
}

/* ------------------------------ Dashboard ---------------------- */

const DISMISSED_STAGE = { id: "dismissed", label: "Dismissed" };

const DASH_OUTCOME_STAGES = STAGES.filter((stage) => stage.id !== "prospects");

function sumDealValue(list) {
  return list.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
}

function getDismissedDealsMatchingFilters() {
  return getDismissedDeals().filter((deal) => matchesFilters(deal) && matchesSearch(deal));
}

function formatShare(part, total) {
  if (!total) return "0%";
  const pct = (part / total) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function touchedDealsInStages(deals, stageIds) {
  const ids = new Set(stageIds);
  return deals.filter((deal) => ids.has(deal.stage) && isDealTouched(deal));
}

function stageMetric(id, label, deals) {
  return { id, label, count: deals.length, value: sumDealValue(deals) };
}

function getDashboardStats() {
  const active = getFilteredDeals();
  const dismissedDeals = getDismissedDealsMatchingFilters();
  const touchedDeals = [...active, ...dismissedDeals].filter(isDealTouched);
  const untouchedProspects = active.filter((deal) => deal.stage === "prospects" && !isDealTouched(deal));

  return {
    activeCount: active.length,
    totalCount: active.length + dismissedDeals.length,
    touchedCount: touchedDeals.length,
    touchedValue: sumDealValue(touchedDeals),
    outcomeStages: DASH_OUTCOME_STAGES.map(({ id, label }) =>
      stageMetric(id, label, touchedDealsInStages(active, [id]))
    ),
    untouchedProspects: stageMetric("prospects", "Untouched prospects", untouchedProspects),
    dismissed: stageMetric(DISMISSED_STAGE.id, DISMISSED_STAGE.label, dismissedDeals),
  };
}

function dashEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function dashCard(modifier) {
  return dashEl("section", `dash-card ${modifier}`);
}

function dashFigure(count) {
  const figure = dashEl("div", "dash-figure");
  figure.append(
    dashEl("span", "dash-figure-value", String(count)),
    dashEl("span", "dash-figure-unit", count === 1 ? "card" : "cards")
  );
  return figure;
}

function renderDashboard() {
  dashboardBodyEl.innerHTML = "";
  const stats = getDashboardStats();
  const totalCards = stats.activeCount + stats.dismissed.count;

  if (!totalCards) {
    const narrowed = hasActiveFilters() || searchQuery;
    dashboardBodyEl.appendChild(
      dashEl(
        "p",
        "dash-empty",
        narrowed
          ? "No deals match the current filters."
          : "No deals yet — create one on the Deals tab and the numbers will show up here."
      )
    );
    return;
  }

  const stack = dashEl("div", "dashboard-stack");
  const grid = dashEl("div", "dashboard-grid");
  const side = dashEl("div", "dashboard-side");
  side.append(
    renderDashCountCard({
      modifier: "dash-card-untouched",
      stageId: "prospects",
      title: "Untouched prospects",
      metric: stats.untouchedProspects,
      totalCards,
    }),
    renderDashCountCard({
      modifier: "dash-card-dismissed",
      stageId: DISMISSED_STAGE.id,
      title: "Dismissed deals",
      metric: stats.dismissed,
      totalCards,
    })
  );
  grid.append(renderDashActiveCard(stats), side);
  stack.append(renderDashTrendCard(), grid);
  dashboardBodyEl.appendChild(stack);
  layoutDashTrend();
}

function layoutDashTrend() {
  const canvas = dashboardBodyEl.querySelector(".dash-trend-canvas");
  if (!canvas) return;
  canvas.replaceChildren();
  canvas.style.width = "";
  renderDashTrendChart(canvas, getTouchTrend());
}

let trendResizeTimer = null;
window.addEventListener("resize", () => {
  if (activeTab !== "dashboard") return;
  clearTimeout(trendResizeTimer);
  trendResizeTimer = setTimeout(layoutDashTrend, 120);
});

function renderDashActiveCard(stats) {
  const card = dashCard("dash-card-hero");

  const head = dashEl("header", "dash-card-head");
  head.append(
    dashEl("h2", "dash-label", "Touched deals"),
    dashEl("span", "dash-card-note", fmtEuro.format(stats.touchedValue))
  );

  card.append(head, renderDashTouchedFigure(stats), renderDashStageBar(stats));

  const list = dashEl("ul", "dash-stage-list");
  for (const stage of stats.outcomeStages) {
    list.appendChild(renderDashStageRow(stage, stats.touchedCount));
  }
  card.appendChild(list);

  return card;
}

function renderDashTouchedFigure(stats) {
  const figure = dashEl("div", "dash-figure");
  const share = formatShare(stats.touchedCount, stats.totalCount);
  const caption = `${share} of all ${stats.totalCount} deal cards ever created`;
  figure.title = `${stats.touchedCount} touched, ${caption}`;
  figure.append(
    dashEl("span", "dash-figure-value", String(stats.touchedCount)),
    dashEl("span", "dash-figure-unit", `(${caption})`)
  );
  return figure;
}

function renderDashStageBar(stats) {
  const bar = dashEl("div", "dash-bar");
  const total = stats.touchedCount;
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    stats.outcomeStages
      .map((stage) => `${stage.label}: ${stage.count} of ${total} touched`)
      .join(", ")
  );

  for (const stage of stats.outcomeStages) {
    if (!stage.count || !total) continue;
    const segment = dashEl("span", "dash-bar-seg");
    segment.dataset.stage = stage.id;
    segment.style.flex = `0 0 ${(stage.count / total) * 100}%`;
    segment.title = `${stage.label} — ${stage.count} of ${total} touched (${formatShare(stage.count, total)})`;
    bar.appendChild(segment);
  }

  return bar;
}

function renderDashStageRow(stage, total) {
  const item = dashEl("li", "dash-stage");
  item.dataset.stage = stage.id;

  const dot = dashEl("span", "dash-dot");
  const track = dashEl("div", "dash-stage-track");
  const fill = dashEl("span", "dash-stage-fill");
  fill.style.width = total ? `${(stage.count / total) * 100}%` : "0%";
  track.appendChild(fill);

  item.append(
    dot,
    dashEl("span", "dash-stage-label", stage.label),
    track,
    dashEl("span", "dash-stage-count", String(stage.count)),
    dashEl("span", "dash-stage-share", formatShare(stage.count, total)),
    dashEl("span", "dash-stage-value", fmtEuro.format(stage.value))
  );
  return item;
}

function renderDashCountCard({ modifier, stageId, title, metric, totalCards }) {
  const card = dashCard(modifier);
  card.dataset.stage = stageId;

  const head = dashEl("header", "dash-card-head");
  head.append(
    dashEl("h2", "dash-label", title),
    dashEl("span", "dash-card-note", fmtEuro.format(metric.value))
  );

  const track = dashEl("div", "dash-stage-track");
  const fill = dashEl("span", "dash-stage-fill");
  fill.style.width = totalCards ? `${(metric.count / totalCards) * 100}%` : "0%";
  track.appendChild(fill);

  card.append(
    head,
    dashFigure(metric.count),
    track,
    dashEl(
      "p",
      "dash-note",
      `${formatShare(metric.count, totalCards)} of all ${totalCards} deal cards ever created.`
    )
  );
  return card;
}

/* Monthly outreach result.
   Touched: the first completed task, dated by when it was marked done.
   An open task does not count. Later completed tasks do not move the deal.
   Interested / Committed: dated by when the deal was moved into that column.
   Paid deals stay on the Committed line, using the date they were committed. */

const TREND_SERIES = [
  { key: "touched", label: "Touched", color: "var(--accent)" },
  { key: "interested", label: "Interested", color: "var(--stage-interested)" },
  { key: "committed", label: "Committed", color: "var(--stage-committed)" },
];

const trendSeriesOn = {
  touched: true,
  interested: true,
  committed: true,
};

let trendValueMode = "count";

function taskCompletedAt(task) {
  if (!task?.done) return null;
  const text = String(task.text || "").trim();
  if (!text || text === DEAL_CREATION_NOTE_TEXT) return null;
  return positiveTimestamp(task.completedAt);
}

function firstTouchAt(deal) {
  let earliest = null;
  for (const task of deal.tasks || []) {
    const at = taskCompletedAt(task);
    if (at == null) continue;
    if (earliest == null || at < earliest) earliest = at;
  }
  return earliest;
}

function isDealTouched(deal) {
  return firstTouchAt(deal) != null;
}

function monthIndex(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function dateFromMonthIndex(index) {
  return new Date(Math.floor(index / 12), index % 12, 1);
}

function getDashboardDeals() {
  return [...getFilteredDeals(), ...getDismissedDealsMatchingFilters()];
}

function positiveTimestamp(value) {
  const at = Number(value);
  return Number.isFinite(at) && at > 0 ? at : null;
}

function dealInterestedAt(deal) {
  return positiveTimestamp(deal?.interestedAt);
}

function dealCommittedEnteredAt(deal) {
  const entered = positiveTimestamp(deal?.committedEnteredAt);
  if (entered != null) return entered;
  // Older deals only stored the implementation start.
  if (deal?.stage === "committed" || deal?.stage === "paid" || deal?.implementationDays) {
    return positiveTimestamp(deal?.committedAt);
  }
  return null;
}

function emptyTrendBucket(start) {
  return {
    start,
    touched: 0,
    interested: 0,
    committed: 0,
    interestedDays: [],
    committedDays: [],
  };
}

function calendarDaysBetween(startMs, endMs) {
  const start = startOfDay(new Date(startMs)).getTime();
  const end = startOfDay(new Date(endMs)).getTime();
  return Math.round((end - start) / MS_DAY);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Days from the earliest completion that happened before the stage move. */
function daysFromTouch(deal, stageAt) {
  if (stageAt == null) return null;
  let earliest = null;
  for (const task of deal.tasks || []) {
    const at = taskCompletedAt(task);
    if (at == null || at > stageAt) continue;
    if (earliest == null || at < earliest) earliest = at;
  }
  if (earliest == null) return null;
  const days = calendarDaysBetween(earliest, stageAt);
  return days < 0 ? null : days;
}

function trendBucket(buckets, at) {
  const index = monthIndex(startOfMonth(new Date(at)));
  let bucket = buckets.get(index);
  if (!bucket) {
    bucket = emptyTrendBucket(dateFromMonthIndex(index));
    buckets.set(index, bucket);
  }
  return bucket;
}

function getTouchTrend() {
  const buckets = new Map();
  for (const deal of getDashboardDeals()) {
    const touchedAt = firstTouchAt(deal);
    if (touchedAt != null) trendBucket(buckets, touchedAt).touched += 1;

    const interestedAt = dealInterestedAt(deal);
    if (interestedAt != null) {
      const bucket = trendBucket(buckets, interestedAt);
      bucket.interested += 1;
      const days = daysFromTouch(deal, interestedAt);
      if (days != null) bucket.interestedDays.push(days);
    }

    const committedAt = dealCommittedEnteredAt(deal);
    if (committedAt != null) {
      const bucket = trendBucket(buckets, committedAt);
      bucket.committed += 1;
      const days = daysFromTouch(deal, committedAt);
      if (days != null) bucket.committedDays.push(days);
    }
  }

  if (!buckets.size) return [];

  const keys = [...buckets.keys()];
  const first = Math.min(...keys);
  const now = monthIndex(startOfMonth(new Date()));
  const last = Math.max(now, ...keys);
  const months = [];
  for (let index = first; index <= last; index++) {
    months.push(buckets.get(index) || emptyTrendBucket(dateFromMonthIndex(index)));
  }
  return months;
}

function visibleTrendSeries() {
  return TREND_SERIES.filter((series) => {
    if (!trendSeriesOn[series.key]) return false;
    if (trendValueMode !== "count" && series.key === "touched") return false;
    return true;
  });
}

function trendPointValue(month, key) {
  if (trendValueMode === "days") {
    if (key === "touched") return null;
    return median(month[`${key}Days`] || []);
  }
  if (trendValueMode !== "percent" || key === "touched") return month[key];
  if (!month.touched) return null;
  return (month[key] / month.touched) * 100;
}

function formatTrendPoint(value) {
  if (value == null) return "—";
  if (trendValueMode === "days") return `${value}d`;
  if (trendValueMode !== "percent") return String(value);
  if (value > 0 && value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

function trendHasDaySamples(months) {
  return months.some((month) => month.interestedDays.length || month.committedDays.length);
}

function trendAxisScale(maxValue) {
  const peak = Math.max(1, maxValue);
  if (peak <= 4) {
    return { max: peak, ticks: Array.from({ length: peak + 1 }, (_, i) => i) };
  }
  const raw = peak / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const err = raw / mag;
  const step = (err <= 1 ? 1 : err <= 2 ? 2 : err <= 5 ? 5 : 10) * mag;
  const max = Math.ceil(peak / step) * step;
  const ticks = [];
  for (let i = 0; i <= max / step; i++) ticks.push(i * step);
  return { max, ticks };
}

function formatTrendMonth(date, { withYear }) {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  if (!withYear) return month;
  const year = String(date.getFullYear()).slice(-2);
  return `${month} ’${year}`;
}

function renderDashTrendCard() {
  const card = dashCard("dash-card-trend");
  const head = dashEl("header", "dash-card-head");
  const legend = dashEl("div", "dash-legend");
  legend.setAttribute("role", "group");
  legend.setAttribute("aria-label", "Stats to show");
  for (const series of TREND_SERIES) {
    const button = dashEl("button", "dash-series-toggle");
    button.type = "button";
    button.dataset.series = series.key;
    const selected = trendSeriesOn[series.key];
    const muted = trendValueMode !== "count" && series.key === "touched";
    button.classList.toggle("is-active", selected && !muted);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    if (muted) {
      button.disabled = true;
      button.title = trendValueMode === "days"
        ? "Days measures the wait after the first completed task. Switch to Count to plot Touched."
        : "Percent compares Interested and Committed with Touched. Switch to Count to plot Touched.";
    }
    const swatch = dashEl("span", "dash-legend-swatch");
    swatch.dataset.series = series.key;
    button.append(swatch, document.createTextNode(series.label));
    button.addEventListener("click", () => {
      trendSeriesOn[series.key] = !trendSeriesOn[series.key];
      render();
    });
    legend.append(button);
  }

  const mode = dashEl("div", "dash-trend-mode");
  mode.setAttribute("role", "group");
  mode.setAttribute("aria-label", "Count, percent, or days");
  for (const option of [
    { id: "count", label: "Count" },
    { id: "percent", label: "%" },
    { id: "days", label: "Days" },
  ]) {
    const button = dashEl("button", "dash-trend-mode-btn");
    button.type = "button";
    const on = trendValueMode === option.id;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = option.label;
    button.addEventListener("click", () => {
      trendValueMode = option.id;
      render();
    });
    mode.append(button);
  }
  head.append(dashEl("h2", "dash-label", "Touched vs interested vs committed"), mode);
  card.append(head, legend);

  const months = getTouchTrend();
  if (!months.length) {
    card.append(
      dashEl(
        "p",
        "dash-note",
        "Nothing to plot yet. Complete a task to count a deal as touched, or move a deal into Interested or Committed."
      )
    );
    return card;
  }

  if (!visibleTrendSeries().length) {
    card.append(dashEl("p", "dash-note", "Select at least one stat to draw the chart."));
    return card;
  }

  if (trendValueMode === "days" && !trendHasDaySamples(months)) {
    card.append(
      dashEl(
        "p",
        "dash-note",
        "No day counts yet. A deal needs a completed task dated before it was moved into Interested or Committed."
      )
    );
    return card;
  }

  const chart = dashEl("div", "dash-trend");
  chart.append(dashEl("div", "dash-trend-canvas"));
  card.append(chart);

  card.append(
    dashEl(
      "p",
      "dash-note",
      trendValueMode === "percent"
        ? "Percent is Interested or Committed divided by deals touched that month. Interested uses the date the deal was moved into that column. Committed uses the date it was moved into Committed. Paid stays with Committed."
        : trendValueMode === "days"
          ? "Days is the median from the first completed task to the move into that column. A task finished after the move does not count. The month is when the deal was moved. Paid stays with Committed."
          : "Touched is the date the first task was marked done. Open tasks do not count. Interested and Committed use the date the deal was moved into that column. Paid stays with Committed."
    )
  );
  return card;
}

function renderDashTrendChart(canvas, months) {
  const seriesList = visibleTrendSeries();
  const hostW = Math.max(canvas.parentElement?.clientWidth || 0, 280);
  const padL = trendValueMode === "count" ? 34 : 42;
  const padR = 16;
  const padT = 26;
  const padB = 22;
  const svgH = 168;
  const plotH = svgH - padT - padB;
  const minSlot = 72;
  const plotW = Math.max(hostW - padL - padR, months.length * minSlot);
  const svgW = padL + plotW + padR;
  const slot = plotW / months.length;

  let peak = 0;
  for (const month of months) {
    for (const series of seriesList) {
      const value = trendPointValue(month, series.key);
      if (value != null) peak = Math.max(peak, value);
    }
  }
  const scale = trendValueMode === "percent" && peak <= 100
    ? { max: 100, ticks: [0, 25, 50, 75, 100] }
    : trendAxisScale(peak);
  const yFor = (value) => padT + plotH - (value / scale.max) * plotH;
  const xFor = (index) => padL + index * slot + slot / 2;

  const crossesYear = months.some((month) => month.start.getFullYear() !== months[0].start.getFullYear());

  const svg = createSvgEl("svg", {
    width: String(svgW),
    height: String(svgH),
    viewBox: `0 0 ${svgW} ${svgH}`,
    role: "img",
  });
  const summary = months
    .map((month) => {
      const bits = seriesList.map((series) => {
        const value = trendPointValue(month, series.key);
        return `${series.label} ${formatTrendPoint(value)}`;
      });
      return `${formatMonthYear(month.start)}: ${bits.join(", ")}`;
    })
    .join(". ");
  const title = createSvgEl("title");
  title.textContent = summary;
  svg.append(title);

  for (const tick of scale.ticks) {
    const y = yFor(tick);
    svg.append(
      createSvgEl("line", {
        class: "dash-trend-grid",
        x1: String(padL),
        x2: String(svgW - padR),
        y1: String(y),
        y2: String(y),
      })
    );
    const label = createSvgEl("text", {
      class: "dash-trend-tick",
      x: String(padL - 8),
      y: String(y + 3),
      "text-anchor": "end",
    });
    label.textContent = trendValueMode === "percent" ? `${tick}%` : String(tick);
    svg.append(label);
  }

  const hideTip = () => {
    tip.hidden = true;
    svg.querySelectorAll(".dash-trend-hit.is-active").forEach((el) => el.classList.remove("is-active"));
  };

  const showTip = (month, index, hit) => {
    svg.querySelectorAll(".dash-trend-hit.is-active").forEach((el) => el.classList.remove("is-active"));
    hit.classList.add("is-active");
    tip.replaceChildren();
    tip.append(dashEl("div", "dash-trend-tip-title", formatMonthYear(month.start)));
    const rows = trendValueMode === "count" ? seriesList : TREND_SERIES;
    for (const series of rows) {
      if (trendValueMode !== "count" && series.key === "touched") continue;
      if (!trendSeriesOn[series.key]) continue;
      const row = dashEl("div", "dash-trend-tip-row");
      const swatch = dashEl("span", "dash-legend-swatch");
      swatch.dataset.series = series.key;
      let text = `${series.label} ${month[series.key]}`;
      if (trendValueMode === "percent") {
        text += ` (${formatTrendPoint(trendPointValue(month, series.key))})`;
      } else if (trendValueMode === "days") {
        const samples = month[`${series.key}Days`] || [];
        const noun = samples.length === 1 ? "deal" : "deals";
        text = samples.length
          ? `${series.label} ${formatTrendPoint(median(samples))} · ${samples.length} ${noun}`
          : `${series.label} —`;
      }
      row.append(swatch, document.createTextNode(text));
      tip.append(row);
    }
    tip.hidden = false;
    const tipW = tip.offsetWidth;
    const x = Math.max(tipW / 2 + 4, Math.min(xFor(index), svgW - tipW / 2 - 4));
    tip.style.left = `${x}px`;
    tip.style.top = `${padT}px`;
  };

  months.forEach((month, index) => {
    const slotX = padL + index * slot;
    const hit = createSvgEl("rect", {
      class: "dash-trend-hit",
      x: String(slotX),
      y: "0",
      width: String(slot),
      height: String(svgH - padB),
    });
    hit.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      showTip(month, index, hit);
    });
    hit.addEventListener("pointerup", () => showTip(month, index, hit));
    svg.append(hit);

    const label = createSvgEl("text", {
      class: "dash-trend-label",
      x: String(xFor(index)),
      y: String(svgH - 8),
      "text-anchor": "middle",
    });
    const showYear = crossesYear && (index === 0 || month.start.getMonth() === 0);
    label.textContent = formatTrendMonth(month.start, { withYear: showYear });
    svg.append(label);
  });

  const barGap = 3;
  const barW = Math.max(
    6,
    Math.min(16, (slot - 18 - barGap * Math.max(0, seriesList.length - 1)) / seriesList.length)
  );
  const groupW = barW * seriesList.length + barGap * Math.max(0, seriesList.length - 1);

  months.forEach((month, index) => {
    const slotX = padL + index * slot;
    const groupX = slotX + (slot - groupW) / 2;
    seriesList.forEach((series, seriesIndex) => {
      const value = trendPointValue(month, series.key);
      if (value == null) return;
      if (value === 0 && trendValueMode === "count") return;
      const h = value === 0 ? 3 : Math.max(3, (value / scale.max) * plotH);
      const x = groupX + seriesIndex * (barW + barGap);
      const y = padT + plotH - h;
      svg.append(
        createSvgEl("rect", {
          class: "dash-trend-bar",
          "data-series": series.key,
          x: String(x),
          y: String(y),
          width: String(barW),
          height: String(h),
          rx: "2",
        })
      );
      const valueLabel = createSvgEl("text", {
        class: "dash-trend-point-label",
        "data-series": series.key,
        x: String(x + barW / 2),
        y: String(y - 6),
        "text-anchor": "middle",
      });
      valueLabel.textContent = formatTrendPoint(value);
      svg.append(valueLabel);
    });
  });

  canvas.style.width = `${svgW}px`;
  canvas.append(svg);

  const tip = dashEl("div", "dash-trend-tip");
  tip.hidden = true;
  canvas.append(tip);

  svg.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    hideTip();
  });
}

/* ------------------------------ Drag & drop -------------------- */

const DRAG_HOLD_MS = 180;
const DRAG_MOVE_CANCEL_PX = 28;
const DRAG_MOUSE_ACTIVATE_PX = 6;
const DRAG_SCROLL_EDGE = 52;
const DRAG_SCROLL_SPEED = 14;

let dragState = null;

function clearDropIndicators() {
  document
    .querySelectorAll(".card.drop-before, .card.drop-after, .column-body.is-drop-active")
    .forEach((el) => {
      el.classList.remove("drop-before", "drop-after", "is-drop-active");
    });
}

function cleanupDrag() {
  if (!dragState) return;
  if (dragState.timer) clearTimeout(dragState.timer);
  if (dragState.scrollRaf) cancelAnimationFrame(dragState.scrollRaf);
  if (dragState.sourceEl) {
    dragState.sourceEl.classList.remove("is-drag-source", "dragging", "is-drag-pending");
  }
  removeDragGhost();
  clearDropIndicators();
  document.body.classList.remove("is-card-dragging");
  dragState = null;
  // A remote update may have arrived while dragging — apply it now.
  if (pendingRemoteRefresh) {
    pendingRemoteRefresh = false;
    refreshDealsFromRemote();
  }
}

function createDragGhost(card, clientX, clientY) {
  // Defensive: never leave a stray ghost behind from a previous drag.
  document.querySelectorAll(".card-drag-ghost").forEach((el) => el.remove());
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add("card-drag-ghost");
  ghost.classList.remove("is-drag-source", "dragging", "is-drag-pending", "drop-before", "drop-after");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);
  dragState.ghost = ghost;
  dragState.ghostOffsetX = clientX - rect.left;
  dragState.ghostOffsetY = clientY - rect.top;
  moveDragGhost(clientX, clientY);
}

function moveDragGhost(clientX, clientY) {
  const ghost = dragState?.ghost;
  if (!ghost) return;
  const x = clientX - dragState.ghostOffsetX;
  const y = clientY - dragState.ghostOffsetY;
  ghost.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
}

function removeDragGhost() {
  if (dragState?.ghost) {
    dragState.ghost = null;
  }
  document.querySelectorAll(".card-drag-ghost").forEach((el) => el.remove());
}

function getDropTargetAt(clientX, clientY) {
  // Hide the floating ghost so it can't steal hit-testing (Safari can still
  // report pointer-events:none clones under elementsFromPoint in some cases).
  const ghost = dragState?.ghost;
  const prevVisibility = ghost ? ghost.style.visibility : "";
  if (ghost) ghost.style.visibility = "hidden";

  const stack = document.elementsFromPoint(clientX, clientY);
  if (ghost) ghost.style.visibility = prevVisibility;

  let card = null;
  let column = null;
  for (const el of stack) {
    if (el.classList?.contains("card-drag-ghost")) continue;
    if (el.closest?.(".card-drag-ghost")) continue;
    if (
      !card &&
      el.classList?.contains("card") &&
      !el.classList.contains("is-drag-source")
    ) {
      card = el;
    }
    if (!column && el.classList?.contains("column")) {
      column = el;
    }
    if (!column && el.classList?.contains("column-body")) {
      column = el.closest(".column");
    }
    if (card && column) break;
  }
  if (!column) return null;

  const stage = column.dataset.stage;
  if (card) {
    const rect = card.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    return {
      stage,
      insertBeforeId: before ? card.dataset.id : nextCardSiblingId(card),
      indicatorCard: card,
      before,
    };
  }

  return { stage, insertBeforeId: null, indicatorCard: null, before: false };
}

function updateDropIndicators(target) {
  clearDropIndicators();
  if (dragState) dragState.dropTarget = target || null;
  if (!target) return;
  // Highlight the whole placeholder the card is currently hovering over.
  const body = document.querySelector(`.column[data-stage="${target.stage}"] .column-body`);
  if (body) body.classList.add("is-drop-active");
  // Plus a precise insertion line when hovering over an existing card.
  if (target.indicatorCard) {
    target.indicatorCard.classList.add(target.before ? "drop-before" : "drop-after");
  }
}

/**
 * Returns a signed scroll delta that grows smoothly the deeper the pointer sits
 * inside an edge zone (0 in the middle, up to ±DRAG_SCROLL_SPEED at the very edge).
 */
function edgeScrollDelta(pos, min, max) {
  const zone = DRAG_SCROLL_EDGE;
  if (pos < min + zone) {
    const factor = Math.min(1, (min + zone - pos) / zone);
    return -DRAG_SCROLL_SPEED * factor * factor;
  }
  if (pos > max - zone) {
    const factor = Math.min(1, (pos - (max - zone)) / zone);
    return DRAG_SCROLL_SPEED * factor * factor;
  }
  return 0;
}

function autoScrollDuringDrag(clientX, clientY) {
  if (!dragState?.activated) return;

  const boardRect = boardEl.getBoundingClientRect();
  const dx = edgeScrollDelta(clientX, boardRect.left, boardRect.right);
  if (dx) boardEl.scrollLeft += dx;

  // Vertical scroll on whichever column body the pointer is currently over.
  const stack = document.elementsFromPoint(clientX, clientY);
  const body = stack.find((el) => el.classList?.contains("column-body"));
  if (body) {
    const rect = body.getBoundingClientRect();
    const dy = edgeScrollDelta(clientY, rect.top, rect.bottom);
    if (dy) body.scrollTop += dy;
  }

  if (dx || body) {
    moveDragGhost(dragState.lastX, dragState.lastY);
    updateDropIndicators(getDropTargetAt(dragState.lastX, dragState.lastY));
  }

  dragState.scrollRaf = requestAnimationFrame(() => {
    if (!dragState?.activated) return;
    autoScrollDuringDrag(dragState.lastX, dragState.lastY);
  });
}

function activateDrag() {
  if (!dragState || dragState.activated) return;
  dragState.activated = true;
  dragState.sourceEl.classList.remove("is-drag-pending");
  dragState.sourceEl.classList.add("is-drag-source", "dragging");
  document.body.classList.add("is-card-dragging");
  try {
    dragState.sourceEl.setPointerCapture(dragState.pointerId);
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(12);
  } catch {
    /* ignore */
  }
  createDragGhost(dragState.sourceEl, dragState.lastX, dragState.lastY);
  updateDropIndicators(getDropTargetAt(dragState.lastX, dragState.lastY));
  autoScrollDuringDrag(dragState.lastX, dragState.lastY);
}

function commitDragDrop(clientX, clientY) {
  if (!dragState?.activated) return;
  const deal = deals.find((d) => d.id === dragState.dealId);
  if (!deal) return;

  // Prefer the last highlighted target (what the user saw), then re-probe.
  const target = dragState.dropTarget || getDropTargetAt(clientX, clientY);
  if (!target?.stage) return;

  if (
    target.stage === "committed" &&
    deal.stage !== "committed" &&
    !hasImplementationSchedule(deal)
  ) {
    openCommitModal(deal);
    return;
  }

  const ordered = getStageDeals(deal.stage);
  const oldIndex = ordered.findIndex((d) => d.id === deal.id);
  const nextId = ordered[oldIndex + 1]?.id || null;
  if (deal.stage === target.stage && target.insertBeforeId === nextId) return;

  moveDealToStage(deal, target.stage, target.insertBeforeId);
  if (
    isDealPinned(deal) &&
    countPinnedInStage(deal.stage, { excludeId: deal.id }) >= MAX_PINNED_PER_STAGE
  ) {
    delete deal.pinnedAt;
  }
  saveDeals(getStageDeals(target.stage).map((d) => d.id));
  render();
}

function attachCardPointerDrag(card, deal) {
  card.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.isPrimary === false) return;
    if (e.target.closest(".card-pause-btn, .card-pin-btn")) return;
    if (dragState) cleanupDrag();

    dragState = {
      dealId: deal.id,
      pointerId: e.pointerId,
      pointerType: e.pointerType || "mouse",
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      activated: false,
      sourceEl: card,
      timer: null,
      scrollRaf: null,
      dropTarget: null,
      ghost: null,
    };

    const isTouch = dragState.pointerType === "touch" || dragState.pointerType === "pen";
    if (isTouch) {
      card.classList.add("is-drag-pending");
      dragState.timer = setTimeout(activateDrag, DRAG_HOLD_MS);
    }
  });
}

document.addEventListener("pointermove", (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;

  dragState.lastX = e.clientX;
  dragState.lastY = e.clientY;
  const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);

  if (!dragState.activated) {
    if (dragState.pointerType === "mouse") {
      if (dist >= DRAG_MOUSE_ACTIVATE_PX) activateDrag();
    } else if (dist >= DRAG_MOVE_CANCEL_PX) {
      cleanupDrag();
    }
    return;
  }

  e.preventDefault();
  moveDragGhost(e.clientX, e.clientY);
  updateDropIndicators(getDropTargetAt(e.clientX, e.clientY));
}, { passive: false });

document.addEventListener("pointerup", (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const { activated, sourceEl } = dragState;
  const x = Number.isFinite(e.clientX) ? e.clientX : dragState.lastX;
  const y = Number.isFinite(e.clientY) ? e.clientY : dragState.lastY;
  dragState.lastX = x;
  dragState.lastY = y;
  if (activated) commitDragDrop(x, y);
  cleanupDrag();
  if (activated && sourceEl) {
    sourceEl.dataset.suppressClick = "1";
    setTimeout(() => {
      delete sourceEl.dataset.suppressClick;
    }, 0);
  }
});

document.addEventListener("pointercancel", (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  cleanupDrag();
});

/* --------------------------- Commit modal ----------------------- */

function hasImplementationSchedule(deal) {
  return Boolean(deal?.committedAt) && Number(deal?.implementationDays) > 0;
}

function syncAttachedFileButton(btn, {
  fileName = "",
  path = "",
  pendingFile = null,
  emptyLabel = "Upload file",
  emptyTitle = "Upload file",
  openNoun = "file",
} = {}) {
  if (!btn) return;
  const attached = Boolean(pendingFile || path || fileName);
  btn.classList.toggle("is-attached", attached);
  const label = attached
    ? `Open ${openNoun}${fileName ? ` (${fileName})` : ""}`
    : emptyLabel;
  btn.setAttribute("aria-label", label);
  btn.title = attached ? `${label}. Shift-click to replace.` : emptyTitle;
}

function syncContractFileButton(btn, details = {}) {
  syncAttachedFileButton(btn, {
    ...details,
    emptyLabel: "Upload contract file",
    emptyTitle: "Upload contract file (PDF or Word)",
    openNoun: "contract",
  });
}

function syncToolFileButton() {
  syncAttachedFileButton(dealToolFileBtn, {
    fileName: modalToolFileName,
    path: modalToolFilePath,
    pendingFile: modalToolFile,
    emptyLabel: "Upload document",
    emptyTitle: "Upload document (PDF or Word)",
    openNoun: "document",
  });
}

function resetDealToolFileState(deal = null) {
  const stored = toolFileFromNotes(deal?.notes);
  modalToolFile = null;
  modalToolFilePath = stored.path;
  modalToolFileName = stored.fileName;
  if (dealToolFileInput) dealToolFileInput.value = "";
  syncToolFileButton();
}

function resetDealContractFileState(deal = null) {
  modalContractFile = null;
  modalContractFilePath = deal?.contractFilePath || "";
  modalContractFileName = deal?.contractFileName || "";
  if (dealContractFileInput) dealContractFileInput.value = "";
  syncContractFileButton(dealContractFileBtn, {
    fileName: modalContractFileName,
    path: modalContractFilePath,
    pendingFile: modalContractFile,
  });
}

function resetCommitContractFileState(deal = null) {
  commitContractFile = null;
  commitContractFilePath = deal?.contractFilePath || "";
  commitContractFileName = deal?.contractFileName || "";
  if (commitContractFileInput) commitContractFileInput.value = "";
  syncContractFileButton(commitContractFileBtn, {
    fileName: commitContractFileName,
    path: commitContractFilePath,
    pendingFile: commitContractFile,
  });
}

async function openContractPreview({ pendingFile = null, path = "", fileName = "", noun = "contract" } = {}) {
  if (pendingFile) {
    const url = URL.createObjectURL(pendingFile);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke after the browser has a chance to load the blob tab.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  if (!path) return;
  const api = window.MHN_DB;
  const title = noun.charAt(0).toUpperCase() + noun.slice(1);
  if (!api?.getContractFilePreviewUrl) {
    showSyncStatus(`${title} preview unavailable offline`, true, true);
    return;
  }
  try {
    const url = await api.getContractFilePreviewUrl(path);
    if (!url) throw new Error("No preview URL");
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    console.error(err);
    showSyncStatus(
      `Could not open ${noun}${fileName ? ` “${fileName}”` : ""}${syncErrorDetail(err)}`,
      true,
      true
    );
  }
}

async function ensureContractFileUploaded(dealId, { pendingFile, path, fileName, label = "Contract" }) {
  if (!pendingFile) {
    return { path: path || "", fileName: fileName || "" };
  }
  const api = window.MHN_DB;
  if (!api?.uploadContractFile) {
    throw new Error(`${label} upload unavailable`);
  }
  if (!api.cloudWriteEnabled) {
    throw new Error(`${label} upload needs the deployed app while signed in`);
  }
  const previousPath = path || "";
  const uploaded = await api.uploadContractFile(dealId, pendingFile);
  if (previousPath && previousPath !== uploaded.path && api.removeContractFile) {
    api.removeContractFile(previousPath).catch(() => {});
  }
  return { path: uploaded.path, fileName: uploaded.fileName };
}

function openCommitModal(deal) {
  pendingCommitDeal = deal;
  commitDealName.textContent = deal.company;
  commitForm.reset();
  commitForm.elements.startDate.value = deal.committedAt
    ? toDateInputValue(deal.committedAt)
    : toDateInputValue(Date.now());
  if (deal.implementationDays) {
    commitForm.elements.days.value = deal.implementationDays;
  }
  commitForm.elements.contractName.value = deal.contractName || "";
  resetCommitContractFileState(deal);
  commitOverlay.hidden = false;
  commitForm.elements.startDate.focus();
}

function closeCommitModal() {
  commitOverlay.hidden = true;
  pendingCommitDeal = null;
  resetCommitContractFileState(null);
}

commitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingCommitDeal) return;

  const startDate = parseDateInput(commitForm.elements.startDate.value);
  const days = Number(commitForm.elements.days.value);
  if (!startDate || !days || days < 1) return;

  const submitBtn = commitForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const uploaded = await ensureContractFileUploaded(pendingCommitDeal.id, {
      pendingFile: commitContractFile,
      path: commitContractFilePath,
      fileName: commitContractFileName,
    });
    pendingCommitDeal.committedAt = startDate;
    pendingCommitDeal.implementationDays = days;
    pendingCommitDeal.contractName = toTitleCase(commitForm.elements.contractName.value);
    pendingCommitDeal.contractFilePath = uploaded.path;
    pendingCommitDeal.contractFileName = uploaded.fileName;
    moveDealToStage(pendingCommitDeal, "committed", null);
    saveDeals(getStageDeals("committed").map((d) => d.id));
    render();
    closeCommitModal();
  } catch (err) {
    console.error(err);
    showSyncStatus(`Could not save contract file${syncErrorDetail(err)}`, true, true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

function acceptContractFile(file, mode) {
  const api = window.MHN_DB;
  if (api?.isAllowedContractFile && !api.isAllowedContractFile(file)) {
    showSyncStatus("Choose a PDF or Word file under 20 MB", true, true);
    return;
  }
  if (mode === "commit") {
    commitContractFile = file;
    commitContractFileName = file.name;
    syncContractFileButton(commitContractFileBtn, {
      fileName: commitContractFileName,
      path: commitContractFilePath,
      pendingFile: commitContractFile,
    });
    return;
  }
  if (mode === "tool") {
    modalToolFile = file;
    modalToolFileName = file.name;
    syncToolFileButton();
    return;
  }
  modalContractFile = file;
  modalContractFileName = file.name;
  syncContractFileButton(dealContractFileBtn, {
    fileName: modalContractFileName,
    path: modalContractFilePath,
    pendingFile: modalContractFile,
  });
}

dealContractFileBtn?.addEventListener("click", (e) => {
  const hasFile = Boolean(modalContractFile || modalContractFilePath);
  if (hasFile && (modalReadOnly || !e.shiftKey)) {
    openContractPreview({
      pendingFile: modalContractFile,
      path: modalContractFilePath,
      fileName: modalContractFileName,
    });
    return;
  }
  if (modalReadOnly) return;
  dealContractFileInput?.click();
});

commitContractFileBtn?.addEventListener("click", (e) => {
  const hasFile = Boolean(commitContractFile || commitContractFilePath);
  if (hasFile && !e.shiftKey) {
    openContractPreview({
      pendingFile: commitContractFile,
      path: commitContractFilePath,
      fileName: commitContractFileName,
    });
    return;
  }
  commitContractFileInput?.click();
});

dealContractFileInput?.addEventListener("change", () => {
  const file = dealContractFileInput.files?.[0];
  if (file) acceptContractFile(file, "deal");
  dealContractFileInput.value = "";
});

dealToolFileBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const hasFile = Boolean(modalToolFile || modalToolFilePath);
  if (hasFile && (modalReadOnly || !e.shiftKey)) {
    openContractPreview({
      pendingFile: modalToolFile,
      path: modalToolFilePath,
      fileName: modalToolFileName,
      noun: "document",
    });
    return;
  }
  if (modalReadOnly) return;
  dealToolFileInput?.click();
});

dealToolFileInput?.addEventListener("change", () => {
  const file = dealToolFileInput.files?.[0];
  if (file) acceptContractFile(file, "tool");
  dealToolFileInput.value = "";
});

commitContractFileInput?.addEventListener("change", () => {
  const file = commitContractFileInput.files?.[0];
  if (file) acceptContractFile(file, "commit");
  commitContractFileInput.value = "";
});

document.getElementById("commitCloseBtn").addEventListener("click", closeCommitModal);
document.getElementById("commitCancelBtn").addEventListener("click", closeCommitModal);
commitOverlay.addEventListener("click", (e) => {
  if (e.target === commitOverlay) closeCommitModal();
});

function formatNoteTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTaskDueDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isTaskOverdue(task, now = Date.now()) {
  if (!task || task.done || task.dueAt == null) return false;
  return task.dueAt < startOfDay(new Date(now)).getTime();
}

function normalizeTaskType(value) {
  const id = String(value || "").trim().toLowerCase();
  return TASK_TYPES.some((entry) => entry.id === id) ? id : "";
}

function taskTypeLabel(type) {
  const id = normalizeTaskType(type);
  return TASK_TYPES.find((entry) => entry.id === id)?.label || "";
}

function taskTypeSortIndex(type) {
  const id = normalizeTaskType(type);
  const index = TASK_TYPES.findIndex((entry) => entry.id === id);
  return index === -1 ? TASK_TYPES.length : index;
}

function createSvgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function createTaskTypeIcon(type) {
  const svg = createSvgEl("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
  });
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };
  const id = normalizeTaskType(type);
  if (id === "call") {
    svg.appendChild(
      createSvgEl("path", {
        ...stroke,
        transform: "translate(0 1.7)",
        d: "M8.1 4.6c.4-.8 1.4-1.1 2.2-.7l1.2.6c.6.3.9 1.1.6 1.8l-.4 1c-.2.4 0 .8.3 1.1l1.9 1.9c.3.3.7.5 1.1.3l1-.4c.7-.3 1.5 0 1.8.6l.6 1.2c.4.8.1 1.8-.7 2.2-1.4.7-4.1.3-7.3-2.9S7.4 6 8.1 4.6z",
      })
    );
  } else if (id === "meet") {
    svg.appendChild(createSvgEl("circle", { ...stroke, cx: "9", cy: "8", r: "3.1" }));
    svg.appendChild(
      createSvgEl("path", { ...stroke, d: "M4.2 19c.7-2.6 2.6-4 4.8-4s4.1 1.4 4.8 4" })
    );
    svg.appendChild(createSvgEl("circle", { ...stroke, cx: "16.6", cy: "8.4", r: "2.4" }));
    svg.appendChild(
      createSvgEl("path", { ...stroke, d: "M20.6 19c-.5-1.9-1.8-3-3.5-3.4" })
    );
  } else if (id === "ticket") {
    svg.appendChild(
      createSvgEl("path", {
        ...stroke,
        d: "M4 8.2h16v2.2c-1.3 0-2.2.8-2.2 2.1s.9 2.1 2.2 2.1v2.2H4v-2.2c1.3 0 2.2-.8 2.2-2.1S5.3 10.4 4 10.4V8.2z",
      })
    );
    svg.appendChild(createSvgEl("path", { ...stroke, d: "M9.5 8.2v7.6" }));
  } else if (id === "email") {
    svg.appendChild(
      createSvgEl("rect", {
        ...stroke,
        x: "3.6",
        y: "5.6",
        width: "16.8",
        height: "12.8",
        rx: "1.8",
      })
    );
    svg.appendChild(
      createSvgEl("path", { ...stroke, d: "M4.2 7.4l7.8 6.1 7.8-6.1" })
    );
  }
  return svg;
}

function createTaskTypeMark(type) {
  const id = normalizeTaskType(type);
  if (!id) return null;
  const mark = document.createElement("span");
  mark.className = "task-type-mark";
  mark.dataset.taskType = id;
  mark.title = taskTypeLabel(id);
  mark.setAttribute("aria-hidden", "true");
  mark.append(createTaskTypeIcon(id));
  return mark;
}

function createTaskTypePicker({ selected = "", disabled = false, onChange } = {}) {
  const picker = document.createElement("div");
  picker.className = "task-type-picker";
  picker.setAttribute("role", "radiogroup");
  picker.setAttribute("aria-label", "Task type");

  const selectType = (id) => {
    picker.querySelectorAll(".task-type-btn").forEach((btn) => {
      const on = btn.dataset.taskType === id;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    onChange?.(id);
  };

  for (const { id, label } of TASK_TYPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-type-btn";
    btn.dataset.taskType = id;
    btn.disabled = disabled;
    btn.setAttribute("aria-pressed", selected === id ? "true" : "false");
    if (selected === id) btn.classList.add("is-selected");

    const caption = document.createElement("span");
    caption.className = "task-type-btn-label";
    caption.textContent = label;

    const glyph = document.createElement("span");
    glyph.className = "task-type-glyph";
    glyph.append(createTaskTypeIcon(id));

    btn.append(caption, glyph);
    btn.addEventListener("click", () => {
      if (disabled) return;
      selectType(id);
    });
    picker.append(btn);
  }
  return picker;
}

function mountComposerTaskTypePicker() {
  if (!newTaskTypePickerEl) return;
  newTaskTypePickerEl.innerHTML = "";
  newTaskTypePickerEl.append(
    createTaskTypePicker({
      selected: newTaskType,
      disabled: modalReadOnly,
      onChange: (id) => {
        newTaskType = id;
      },
    })
  );
}

function renderTaskTypeFilter() {
  if (!taskTypeFilterEl) return;
  taskTypeFilterEl.innerHTML = "";
  for (const { id, label } of TASK_TYPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-type-filter-btn";
    btn.dataset.taskType = id;
    const pressed = taskTypeFilters.has(id);
    btn.classList.toggle("is-active", pressed);
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.setAttribute("aria-label", `Show ${label.toLowerCase()} tasks`);
    btn.title = label;
    const glyph = document.createElement("span");
    glyph.className = "task-type-glyph";
    glyph.append(createTaskTypeIcon(id));
    btn.append(glyph);
    btn.addEventListener("click", () => {
      if (taskTypeFilters.has(id)) taskTypeFilters.delete(id);
      else taskTypeFilters.add(id);
      if (activeTab === "tasks") renderTasksView();
      else renderTaskTypeFilter();
    });
    taskTypeFilterEl.append(btn);
  }
}

function normalizeTask(task) {
  const dueRaw = task?.dueAt;
  const dueAt =
    dueRaw == null || dueRaw === ""
      ? null
      : Number(dueRaw);
  return {
    id: task.id || crypto.randomUUID(),
    text: (task.text || "").trim(),
    dueAt: Number.isFinite(dueAt) ? dueAt : null,
    type: normalizeTaskType(task.type),
    done: Boolean(task.done),
    completedAt: task.completedAt ?? null,
    createdAt: Number(task.createdAt) || Date.now(),
    updatedAt: task.updatedAt == null ? null : Number(task.updatedAt),
    createdBy: String(task.createdBy || "").trim(),
    updatedBy: String(task.updatedBy || "").trim(),
  };
}

function serializeModalTasks() {
  return modalTasks
    .map((task) => normalizeTask(task))
    .filter((task) => task.text && task.dueAt != null);
}

function updateModalTitleTool() {
  const company = form.elements.company.value.trim();
  const tool = form.elements.tool.value.trim();
  modalTitleCompany.hidden = !company;
  modalTitleCompany.textContent = company;
  modalTitleTool.hidden = !tool;
  modalTitleTool.textContent = tool;
  modalTitleMeta.hidden = !company && !tool;
}

function companyHistoryStageLabel(deal) {
  if (deal?.stage === "dismissed" || deal?.dismissedAt) return "Dismissed";
  if (isDealPaused(deal)) return "Paused";
  return STAGES.find((stage) => stage.id === deal?.stage)?.label || "Prospects";
}

function renderCompanyHistoryItem(deal) {
  const current = deal.id === editingId;
  const item = document.createElement("button");
  item.type = "button";
  item.className = "company-history-item";
  if (current) item.classList.add("is-current");

  const title = document.createElement("p");
  title.className = "company-history-title";
  const stage = document.createElement("span");
  stage.textContent = companyHistoryStageLabel(deal);
  title.append(stage);
  if (current) {
    const badge = document.createElement("span");
    badge.className = "company-history-current";
    badge.textContent = "This deal";
    title.append(badge);
  }

  const detail = document.createElement("p");
  detail.className = "company-history-detail";
  detail.textContent = [
    deal.tool || "No tool",
    deal.owner,
    fmtEuro.format(Number(deal.value) || 0),
    deal.createdAt ? formatShortDate(deal.createdAt) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  item.append(title, detail);
  if (!current) {
    item.addEventListener("click", () => {
      const fresh = deals.find((entry) => entry.id === deal.id) || deal;
      const readOnly = fresh.stage === "dismissed" || Boolean(fresh.dismissedAt);
      openModal({ deal: fresh, readOnly });
      setCompanyDetailTab("history");
    });
  }
  return item;
}

function renderCompanyHistory() {
  if (!companyHistoryFields) return;
  companyHistoryFields.innerHTML = "";
  const key = normalizeCompanyKey(form.elements.company.value);
  if (!key) {
    const empty = document.createElement("p");
    empty.className = "company-history-empty";
    empty.textContent = "Enter a company name to see its deals.";
    companyHistoryFields.append(empty);
    return;
  }

  const matches = deals
    .filter((deal) => normalizeCompanyKey(deal.company) === key)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "company-history-empty";
    empty.textContent = "No deals for this company yet.";
    companyHistoryFields.append(empty);
    return;
  }

  for (const deal of matches) {
    companyHistoryFields.append(renderCompanyHistoryItem(deal));
  }
}

function setCompanyDetailTab(tab) {
  const next = tab === "brief" || tab === "history" ? tab : "details";
  companyDetailsFields.hidden = next !== "details";
  companyBriefFields.hidden = next !== "brief";
  companyHistoryFields.hidden = next !== "history";
  document.querySelectorAll(".detail-tab").forEach((button) => {
    const active = button.dataset.detailTab === next;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (next === "history") renderCompanyHistory();
}

function briefNoteText(notes) {
  return (notes || []).find(isBriefNote)?.text || "";
}

function valueNoteText(notes) {
  return (notes || []).find(isValueNote)?.text || "";
}

function renderDealMilestones() {
  if (!dealMilestonesEl) return;
  for (const button of dealMilestonesEl.querySelectorAll(".deal-milestone")) {
    const on = Boolean(modalMilestones[button.dataset.milestone]);
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.disabled = modalReadOnly;
  }
}

function syncMilestonesNote() {
  const flags = emptyMilestones();
  for (const milestone of DEAL_MILESTONES) flags[milestone.id] = Boolean(modalMilestones[milestone.id]);
  const any = DEAL_MILESTONES.some((milestone) => flags[milestone.id]);
  const existing = modalNotes.find(isMilestoneNote);
  if (!any) {
    if (existing) modalNotes = modalNotes.filter((note) => note !== existing);
    return;
  }
  const text = JSON.stringify(flags);
  if (existing) {
    if (existing.text !== text) {
      existing.text = text;
      existing.updatedAt = Date.now();
      existing.updatedBy = stampCurrentUser(existing.createdBy);
    }
    return;
  }
  modalNotes.push({
    id: crypto.randomUUID(),
    kind: MILESTONE_NOTE_KIND,
    text,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
}

function syncKindNote(kind, text) {
  const trimmed = String(text || "").trim();
  const existing = modalNotes.find((note) => note?.kind === kind);
  if (!trimmed) {
    if (existing) modalNotes = modalNotes.filter((note) => note !== existing);
    return;
  }
  if (existing) {
    if (existing.text !== trimmed) {
      existing.text = trimmed;
      existing.updatedAt = Date.now();
      existing.updatedBy = stampCurrentUser(existing.createdBy);
    }
    return;
  }
  modalNotes.push({
    id: crypto.randomUUID(),
    kind,
    text: trimmed,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
}

function syncBriefNote() {
  syncKindNote(BRIEF_NOTE_KIND, dealBriefInput.value);
}

function syncValueNote() {
  syncKindNote(VALUE_NOTE_KIND, dealValueInput.value);
}

function setModalPanel(panel) {
  modalPanel = panel;

  modalPanelDetails.hidden = panel !== "details";
  modalPanelDeal.hidden = panel !== "deal";
  modalPanelActivity.hidden = panel !== "activity";
  modalPanelTasks.hidden = panel !== "tasks";

  document.querySelectorAll(".modal-tab").forEach((tab) => {
    const active = tab.dataset.modalTab === panel;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  // Content rendered while a panel was hidden reports scrollHeight 0.
  // Re-render now that the panel is visible so text is measured correctly.
  if (panel === "activity") {
    renderActivityNotes();
  } else if (panel === "tasks") {
    renderDealTasks();
  }
}

function noteWasEdited(note) {
  return Boolean(note.updatedAt && note.updatedAt > note.createdAt);
}

function taskWasEdited(task) {
  return Boolean(task.updatedAt && task.updatedAt > task.createdAt);
}

function updateActivityNoteTime(note, timeEl) {
  timeEl.dateTime = new Date(note.createdAt).toISOString();
  let text = formatNoteTimestamp(note.createdAt) + formatActorStamp(note.createdBy);
  if (noteWasEdited(note)) {
    text += ` · edited ${formatNoteTimestamp(note.updatedAt)}${formatActorStamp(note.updatedBy || note.createdBy)}`;
  }
  timeEl.textContent = text;
}

function updateDealTaskMeta(task, metaEl) {
  const dueLabel = task.dueAt != null ? formatTaskDueDate(task.dueAt) : "No date";
  let text = dueLabel + formatActorStamp(task.createdBy);
  if (task.done) text += " · completed";
  else if (isTaskOverdue(task)) text += " · overdue";
  if (taskWasEdited(task)) {
    text += ` · edited ${formatNoteTimestamp(task.updatedAt)}${formatActorStamp(task.updatedBy || task.createdBy)}`;
  }
  metaEl.textContent = text;
}

function resizeActivityNote(textarea) {
  textarea.style.width = "100%";
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 0)}px`;
}

function activityNoteLineHeight(el) {
  const style = getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize) || 14;
  const parsed = parseFloat(style.lineHeight);
  if (style.lineHeight.endsWith("px") && Number.isFinite(parsed)) return parsed;
  if (Number.isFinite(parsed)) return parsed * fontSize;
  return fontSize * 1.45;
}

function syncActivityNoteExpand(button, expanded) {
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
  const label = button.querySelector(".activity-note-expand-label");
  if (label) label.textContent = expanded ? "Show less" : "Show more";
}

function createActivityNoteExpand(noteId, card) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "activity-note-expand";
  const icon = createSvgEl("svg", {
    class: "activity-note-expand-icon",
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
  });
  icon.appendChild(
    createSvgEl("path", {
      d: "M4 6.5 8 10.5 12 6.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  const label = document.createElement("span");
  label.className = "activity-note-expand-label";
  button.append(icon, label);
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", () => {
    const expanded = !card.classList.contains("is-expanded");
    card.classList.toggle("is-expanded", expanded);
    if (expanded) expandedActivityNoteIds.add(noteId);
    else expandedActivityNoteIds.delete(noteId);
    syncActivityNoteExpand(button, expanded);
    const field = card.querySelector(".note-textarea");
    if (field) resizeActivityNote(field);
  });
  syncActivityNoteExpand(button, card.classList.contains("is-expanded"));
  return button;
}

function fitActivityNote(card, body) {
  const noteId = card.dataset.noteId || "";
  if (body.scrollHeight <= 0) return;

  const style = getComputedStyle(body);
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const limit = activityNoteLineHeight(body) * ACTIVITY_NOTE_FOLD_ROWS + borderTop;
  const overflows = body.scrollHeight > limit + 4;

  const foldBody = body.parentElement?.classList.contains("activity-note-fold-body")
    ? body.parentElement
    : null;
  const fold = foldBody?.parentElement?.classList.contains("activity-note-fold")
    ? foldBody.parentElement
    : null;

  if (!overflows) {
    expandedActivityNoteIds.delete(noteId);
    card.classList.remove("is-clamped", "is-expanded");
    card.style.removeProperty("--activity-note-clamp");
    if (fold) fold.replaceWith(body);
    return;
  }

  let foldEl = fold;
  if (!foldEl) {
    foldEl = document.createElement("div");
    foldEl.className = "activity-note-fold";
    const nextBody = document.createElement("div");
    nextBody.className = "activity-note-fold-body";
    nextBody.id = `activity-note-body-${noteId}`;
    body.replaceWith(foldEl);
    foldEl.appendChild(nextBody);
    nextBody.appendChild(body);
    const button = createActivityNoteExpand(noteId, card);
    button.setAttribute("aria-controls", nextBody.id);
    foldEl.appendChild(button);
  }

  card.classList.add("is-clamped");
  card.style.setProperty("--activity-note-clamp", `${limit}px`);
  const expanded = expandedActivityNoteIds.has(noteId);
  card.classList.toggle("is-expanded", expanded);
  const button = foldEl.querySelector(".activity-note-expand");
  if (button) syncActivityNoteExpand(button, expanded);
}

function renderActivityNotes() {
  activityNotesEl.innerHTML = "";

  const activityEntries = modalNotes.filter(
    (note) =>
      !isBriefNote(note) &&
      !isValueNote(note) &&
      !isMilestoneNote(note) &&
      !isToolFileNote(note)
  );
  const sorted = [...activityEntries].sort((a, b) => {
    const aBirth = isDealCreationNote(a) ? 1 : 0;
    const bBirth = isDealCreationNote(b) ? 1 : 0;
    if (aBirth !== bBirth) return aBirth - bBirth;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const visible = activityNotesOnly
    ? sorted.filter((note) => !isAutomaticActivityNote(note))
    : sorted;

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "activity-empty";
    empty.textContent = activityEntries.length
      ? "Automatic activity is hidden."
      : "No notes yet. Add the first one below.";
    activityNotesEl.appendChild(empty);
    return;
  }

  for (const note of visible) {
    const card = document.createElement("article");
    card.className = "activity-note";
    card.dataset.noteId = note.id;

    const time = document.createElement("time");
    time.className = "activity-note-time";
    updateActivityNoteTime(note, time);

    const isSystem = isAutomaticActivityNote(note);
    if (isSystem) {
      card.classList.add("is-system");
      const body = document.createElement("p");
      body.className = "activity-note-text";
      body.textContent = note.text;
      card.append(time, body);
      activityNotesEl.appendChild(card);
      fitActivityNote(card, body);
      continue;
    }

    const textarea = document.createElement("textarea");
    textarea.className = "note-textarea";
    textarea.rows = 1;
    textarea.value = note.text;
    textarea.readOnly = modalReadOnly;
    textarea.setAttribute("aria-label", "Note text");

    const initialText = note.text;

    textarea.addEventListener("input", () => {
      note.text = textarea.value;
      if (textarea.value !== initialText) {
        note.updatedAt = Date.now();
        note.updatedBy = stampCurrentUser(note.createdBy);
      }
      updateActivityNoteTime(note, time);
      resizeActivityNote(textarea);
    });
    textarea.addEventListener("focus", () => {
      card.classList.add("is-editing");
      textarea.style.width = "100%";
      resizeActivityNote(textarea);
    });
    textarea.addEventListener("blur", () => {
      card.classList.remove("is-editing");
      if (textarea.value !== initialText && !noteWasEdited(note)) {
        note.updatedAt = Date.now();
        note.updatedBy = stampCurrentUser(note.createdBy);
        updateActivityNoteTime(note, time);
      }
      requestAnimationFrame(() => {
        resizeActivityNote(textarea);
        fitActivityNote(card, textarea);
      });
    });

    card.append(time, textarea);
    activityNotesEl.appendChild(card);
    resizeActivityNote(textarea);
    fitActivityNote(card, textarea);
  }
}

function addActivityNote() {
  const text = newNoteInput.value.trim();
  if (!text) {
    newNoteInput.focus();
    return;
  }

  modalNotes.push({
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
  newNoteInput.value = "";
  renderActivityNotes();
}

function renderDealTasks() {
  dealTasksListEl.innerHTML = "";

  const visible = [...modalTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueAt || 0) - (b.dueAt || 0);
  });

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "deal-tasks-empty";
    empty.textContent = "No tasks yet. Add the first one below.";
    dealTasksListEl.appendChild(empty);
    return;
  }

  for (const task of visible) {
    const card = document.createElement("article");
    card.className = "deal-task";
    card.dataset.taskId = task.id;
    if (task.done) card.classList.add("is-done");
    if (isTaskOverdue(task)) card.classList.add("is-overdue");

    const top = document.createElement("div");
    top.className = "deal-task-top";

    const completeBtn = document.createElement("button");
    completeBtn.type = "button";
    completeBtn.className = "task-complete-btn";
    completeBtn.setAttribute("aria-pressed", task.done ? "true" : "false");
    completeBtn.setAttribute("aria-label", task.done ? "Mark task incomplete" : "Complete task");
    completeBtn.disabled = modalReadOnly;
    completeBtn.addEventListener("click", () => {
      const completing = !task.done;
      task.done = !task.done;
      task.completedAt = task.done ? Date.now() : null;
      task.updatedAt = Date.now();
      task.updatedBy = stampCurrentUser(task.createdBy);
      if (completing) appendTaskCompletedNote(modalNotes, task, task.completedAt);
      renderDealTasks();
    });

    const fields = document.createElement("div");
    fields.className = "deal-task-fields";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "task-name-input deal-task-name";
    nameInput.value = task.text || "";
    nameInput.defaultValue = task.text || "";
    nameInput.readOnly = modalReadOnly;
    nameInput.setAttribute("aria-label", "Task name");
    // Keep task editors out of deal-form constraint validation / reset ownership quirks.
    nameInput.setAttribute("form", "mhn-task-composer-unbound");
    const initialText = task.text || "";

    const dueRow = document.createElement("div");
    dueRow.className = "deal-task-due-row";

    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.className = "deal-task-due";
    dueInput.value = task.dueAt != null ? toDateInputValue(task.dueAt) : "";
    dueInput.defaultValue = dueInput.value;
    dueInput.readOnly = modalReadOnly;
    dueInput.disabled = modalReadOnly;
    dueInput.setAttribute("aria-label", "Task due date");
    dueInput.setAttribute("form", "mhn-task-composer-unbound");
    const initialDue = dueInput.value;

    const typePicker = createTaskTypePicker({
      selected: task.type,
      disabled: modalReadOnly,
      onChange: (id) => {
        task.type = id;
        task.updatedAt = Date.now();
        task.updatedBy = stampCurrentUser(task.createdBy);
        const existingMark = card.querySelector(".task-type-mark");
        if (existingMark) existingMark.remove();
        const nextMark = createTaskTypeMark(id);
        if (nextMark) card.append(nextMark);
      },
    });

    dueRow.append(dueInput, typePicker);

    const meta = document.createElement("p");
    meta.className = "deal-task-meta";
    updateDealTaskMeta(task, meta);

    nameInput.addEventListener("input", () => {
      task.text = nameInput.value;
      if (nameInput.value !== initialText) {
        task.updatedAt = Date.now();
        task.updatedBy = stampCurrentUser(task.createdBy);
      }
      updateDealTaskMeta(task, meta);
    });
    nameInput.addEventListener("blur", () => {
      if (nameInput.value !== initialText && !taskWasEdited(task)) {
        task.updatedAt = Date.now();
        task.updatedBy = stampCurrentUser(task.createdBy);
        updateDealTaskMeta(task, meta);
      }
    });

    dueInput.addEventListener("change", () => {
      const nextDue = parseDateInput(dueInput.value);
      if (nextDue == null) {
        dueInput.value = initialDue;
        dueInput.blur();
        return;
      }
      task.dueAt = nextDue;
      if (dueInput.value !== initialDue) {
        task.updatedAt = Date.now();
        task.updatedBy = stampCurrentUser(task.createdBy);
      }
      card.classList.toggle("is-overdue", isTaskOverdue(task));
      updateDealTaskMeta(task, meta);
      // Close the native date picker immediately after a choice.
      dueInput.blur();
    });

    fields.append(nameInput, dueRow, meta);
    top.append(completeBtn, fields);
    card.append(top);
    const typeMark = createTaskTypeMark(task.type);
    if (typeMark) card.append(typeMark);
    dealTasksListEl.appendChild(card);
  }
}

function addDealTask() {
  if (modalReadOnly) return;
  const text = newTaskNameInput.value.trim();
  const dueAt = parseDateInput(newTaskDueInput.value);
  const type = normalizeTaskType(newTaskType);
  if (!text) {
    newTaskNameInput.focus();
    return;
  }
  if (dueAt == null) {
    newTaskDueInput.focus();
    return;
  }
  if (!type) {
    newTaskTypePickerEl?.querySelector(".task-type-btn")?.focus();
    return;
  }

  modalTasks.push({
    id: crypto.randomUUID(),
    text,
    dueAt,
    type,
    done: false,
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
  newTaskNameInput.value = "";
  newTaskDueInput.value = "";
  newTaskType = "";
  mountComposerTaskTypePicker();
  renderDealTasks();
  newTaskNameInput.focus();
}

/* ------------------------------ Tasks view ---------------------- */

function getAllTaskEntries({ includeCompleted = showCompletedTasks } = {}) {
  const entries = [];
  for (const deal of getFilteredDeals()) {
    for (const task of deal.tasks || []) {
      if (!task?.text || task.dueAt == null) continue;
      if (!includeCompleted && task.done) continue;
      const normalized = normalizeTask(task);
      if (taskTypeFilters.size && !taskTypeFilters.has(normalized.type)) continue;
      entries.push({ deal, task: normalized });
    }
  }
  entries.sort((a, b) => {
    if (a.task.done !== b.task.done) return a.task.done ? 1 : -1;
    if (taskTypeFilters.size) {
      const typeCmp = taskTypeSortIndex(a.task.type) - taskTypeSortIndex(b.task.type);
      if (typeCmp) return typeCmp;
    }
    if (a.task.dueAt !== b.task.dueAt) return a.task.dueAt - b.task.dueAt;
    return (a.task.createdAt || 0) - (b.task.createdAt || 0);
  });
  return entries;
}

function getTasksForSelectedDate(entries) {
  if (tasksCalendarState.selectedDate == null) return entries;
  return entries.filter((entry) => entry.task.dueAt === tasksCalendarState.selectedDate);
}

function setDealTaskDone(dealId, taskId, done) {
  const deal = deals.find((d) => d.id === dealId);
  if (!deal) return;
  if (!Array.isArray(deal.tasks)) deal.tasks = [];
  const task = deal.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.done = done;
  task.completedAt = done ? Date.now() : null;
  task.updatedAt = Date.now();
  task.updatedBy = stampCurrentUser(task.createdBy);
  if (done) {
    if (!Array.isArray(deal.notes)) deal.notes = [];
    const note = appendTaskCompletedNote(deal.notes, task, task.completedAt);
    if (editingId === dealId && note) modalNotes.push({ ...note });
  }
  saveDeals(dealId);
  render();
}

function renderTasksCalendar(entries) {
  tasksCalendarEl.innerHTML = "";

  const monthStart = tasksCalendarState.monthStart || startOfMonth(new Date());
  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  const header = document.createElement("div");
  header.className = "tasks-cal-header";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "period-nav";
  prevBtn.setAttribute("aria-label", "Previous month");
  prevBtn.textContent = "‹";
  prevBtn.addEventListener("click", () => {
    tasksCalendarState.monthStart = addMonths(monthStart, -1);
    renderTasksView();
  });

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "period-nav";
  nextBtn.setAttribute("aria-label", "Next month");
  nextBtn.textContent = "›";
  nextBtn.addEventListener("click", () => {
    tasksCalendarState.monthStart = addMonths(monthStart, 1);
    renderTasksView();
  });

  const title = document.createElement("span");
  title.className = "tasks-cal-month";
  title.textContent = monthLabel;

  header.append(prevBtn, title, nextBtn);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-ghost btn-sm tasks-cal-clear";
  clearBtn.textContent = "All dates";
  clearBtn.hidden = tasksCalendarState.selectedDate == null;
  clearBtn.addEventListener("click", () => {
    tasksCalendarState.selectedDate = null;
    renderTasksView();
  });

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "tasks-cal-weekdays";
  for (const label of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
    const cell = document.createElement("span");
    cell.textContent = label;
    weekdayRow.appendChild(cell);
  }

  const grid = document.createElement("div");
  grid.className = "tasks-cal-grid";

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = new Date(year, month, 1);
  // Monday-first offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStart = startOfDay(new Date()).getTime();

  const dueCounts = new Map();
  for (const { task } of entries) {
    if (task.dueAt == null) continue;
    dueCounts.set(task.dueAt, (dueCounts.get(task.dueAt) || 0) + 1);
  }

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("span");
    empty.className = "tasks-cal-day is-empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateTs = startOfDay(new Date(year, month, day)).getTime();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tasks-cal-day";
    btn.textContent = String(day);
    if (dateTs === todayStart) btn.classList.add("is-today");
    if (tasksCalendarState.selectedDate === dateTs) btn.classList.add("is-selected");
    if (dueCounts.has(dateTs)) {
      btn.classList.add("has-tasks");
      btn.title = `${dueCounts.get(dateTs)} task${dueCounts.get(dateTs) === 1 ? "" : "s"}`;
    }
    btn.addEventListener("click", () => {
      tasksCalendarState.selectedDate =
        tasksCalendarState.selectedDate === dateTs ? null : dateTs;
      renderTasksView();
    });
    grid.appendChild(btn);
  }

  tasksCalendarEl.append(header, clearBtn, weekdayRow, grid);
}

function renderTasksView() {
  const allEntries = getAllTaskEntries();

  tasksShowCompletedBtn.setAttribute("aria-pressed", showCompletedTasks ? "true" : "false");
  tasksShowCompletedBtn.textContent = showCompletedTasks ? "Hide completed" : "Show completed";
  tasksShowCompletedBtn.classList.toggle("is-active", showCompletedTasks);
  renderTaskTypeFilter();

  document.querySelectorAll(".tasks-view-btn").forEach((btn) => {
    const active = btn.dataset.tasksView === tasksViewMode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  const isPipeline = tasksViewMode === "pipeline";
  if (tasksListLayout) tasksListLayout.hidden = isPipeline;
  if (tasksPipelineLayout) tasksPipelineLayout.hidden = !isPipeline;
  if (tasksPipelinePeriod) tasksPipelinePeriod.hidden = !isPipeline;

  if (isPipeline) {
    renderTasksPipeline(allEntries);
    return;
  }

  const entries = getTasksForSelectedDate(allEntries);

  if (tasksCalendarState.selectedDate != null) {
    tasksListTitle.textContent = formatTaskDueDate(tasksCalendarState.selectedDate);
    tasksListLead.textContent = showCompletedTasks
      ? "Tasks due on this day, including completed."
      : "Open tasks due on this day.";
  } else {
    tasksListTitle.textContent = "Tasks";
    tasksListLead.textContent = showCompletedTasks
      ? "All tasks sorted by due date."
      : "Open tasks sorted by due date.";
  }

  renderTasksCalendar(allEntries);

  tasksListEl.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "tasks-empty";
    const filtersActive = hasActiveFilters() || searchQuery || taskTypeFilters.size;
    if (tasksCalendarState.selectedDate != null) {
      empty.textContent = "No tasks on this date.";
    } else if (taskTypeFilters.size) {
      empty.textContent = "No tasks match the selected types.";
    } else if (filtersActive) {
      empty.textContent = "No tasks match the current filters.";
    } else {
      empty.textContent = showCompletedTasks
        ? "No tasks yet. Add tasks from a deal’s Tasks tab."
        : "No open tasks. Add tasks from a deal’s Tasks tab.";
    }
    tasksListEl.appendChild(empty);
    return;
  }

  for (const { deal, task } of entries) {
    tasksListEl.appendChild(renderTaskCard(deal, task));
  }
}

function getTasksPipelineVisibleSpan() {
  const today = startOfDay(new Date());
  return Math.max(
    shiftDateByMonths(today, tasksPipelineState.periodMonths).getTime() -
      addDays(today, -TASKS_PIPELINE_LOOKBACK_DAYS).getTime(),
    MS_DAY
  );
}

function getTasksPipelinePeriodRange(entries) {
  const today = startOfDay(new Date());
  const minStart = startOfMonth(addMonths(today, -PIPELINE_SCROLL_MAX_PAST_MONTHS)).getTime();
  const maxEnd = addMonths(startOfMonth(today), PIPELINE_SCROLL_MAX_FUTURE_MONTHS).getTime();
  let start = startOfMonth(addMonths(today, -PIPELINE_SCROLL_PAST_MONTHS)).getTime();
  let end = addMonths(startOfMonth(today), PIPELINE_SCROLL_FUTURE_MONTHS).getTime();

  for (const { task } of entries || []) {
    const due = task.dueAt;
    if (!Number.isFinite(due)) continue;
    start = Math.min(start, startOfMonth(new Date(due)).getTime());
    end = Math.max(end, addMonths(startOfMonth(new Date(due)), 1).getTime());
  }

  start = Math.max(start, minStart);
  end = Math.min(Math.max(end, start + MS_DAY), maxEnd);
  return {
    start,
    end,
    span: Math.max(end - start, MS_DAY),
  };
}

function getTasksPipelineViewportPx() {
  if (!tasksPipelineLayout) return 720;
  const styles = getComputedStyle(tasksPipelineLayout);
  const pad = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  return Math.max(tasksPipelineLayout.clientWidth - pad, 320);
}

function layoutTasksPipelineTimeline(periodStart, span, contentWidth, viewportPx) {
  if (!tasksPipelineLayout || !tasksPipelineScrollEl) return;
  const width = contentWidth || tasksPipelineScrollEl.offsetWidth;
  if (width) tasksPipelineScrollEl.style.width = `${width}px`;

  const empty = tasksPipelineRowsEl.querySelector(".tasks-pipeline-empty");
  if (empty) empty.style.width = `${viewportPx || getTasksPipelineViewportPx()}px`;

  const today = startOfDay(new Date()).getTime();
  const startMs =
    tasksViewportStartMs == null
      ? today - TASKS_PIPELINE_LOOKBACK_DAYS * MS_DAY
      : tasksViewportStartMs;
  const usedWidth = tasksPipelineScrollEl.offsetWidth || width;
  if (!usedWidth || !span) return;
  tasksPipelineSyncingScroll = true;
  tasksPipelineLayout.scrollLeft = Math.max(0, ((startMs - periodStart) / span) * usedWidth);
  requestAnimationFrame(() => {
    tasksPipelineSyncingScroll = false;
  });
}

function rememberTasksPipelineScroll() {
  if (tasksPipelineSyncingScroll || !tasksPipelineLayout || !tasksPipelineScrollEl) return;
  const contentWidth = tasksPipelineScrollEl.offsetWidth;
  if (!contentWidth || !tasksPipelineRange) return;
  const { start, span } = tasksPipelineRange;
  tasksViewportStartMs = start + (tasksPipelineLayout.scrollLeft / contentWidth) * span;
}

function getOverlappingMonthStarts(rangeStartMs, rangeEndMs) {
  const months = [];
  let cursor = startOfMonth(new Date(rangeStartMs));
  while (cursor.getTime() < rangeEndMs) {
    months.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / MS_DAY + 1) / 7);
}

function startOfISOWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day; // Monday-start
  return addDays(d, offset);
}

function forEachVisibleWeekend(periodStart, periodEnd, fn) {
  let cursor = startOfDay(new Date(periodStart));
  const day = cursor.getDay();
  if (day === 0) cursor = addDays(cursor, -1);
  else if (day !== 6) cursor = addDays(cursor, 6 - day);

  while (cursor.getTime() < periodEnd) {
    const sat = cursor.getTime();
    const sun = addDays(cursor, 1).getTime();
    const mon = addDays(cursor, 2).getTime();
    if (mon > periodStart && sat < periodEnd) {
      fn({
        sat,
        sun,
        mon,
        continuesStart: sat < periodStart,
        continuesEnd: mon > periodEnd,
      });
    }
    cursor = addDays(cursor, 7);
  }
}

function appendTasksPipelineWeekends(container, periodStart, periodEnd, span, extraClass) {
  if (!container || tasksPipelineState.periodMonths >= 12) return;
  // Day numbers sit on the day-start tick. Wrap Sat+Sun labels, not Sat→Mon.
  const tickPad = 0.42 * MS_DAY;
  forEachVisibleWeekend(periodStart, periodEnd, (weekend) => {
    const bandStart = weekend.sat - tickPad;
    const bandEnd = weekend.sun + tickPad;
    const continuesStart = weekend.continuesStart;
    const continuesEnd = weekend.continuesEnd;
    const visibleStart = continuesStart ? periodStart : Math.max(bandStart, periodStart);
    const visibleEnd = continuesEnd ? periodEnd : Math.min(bandEnd, periodEnd);
    if (visibleEnd <= visibleStart) return;

    const el = document.createElement("div");
    el.className = extraClass
      ? `tasks-pipeline-weekend ${extraClass}`
      : "tasks-pipeline-weekend";
    el.setAttribute("aria-hidden", "true");
    if (continuesStart) el.classList.add("continues-start");
    if (continuesEnd) el.classList.add("continues-end");

    const left = ((visibleStart - periodStart) / span) * 100;
    const width = ((visibleEnd - visibleStart) / span) * 100;
    if (continuesStart && continuesEnd) {
      el.style.left = "0";
      el.style.right = "0";
      el.style.width = "auto";
    } else if (continuesEnd) {
      el.style.left = `${left}%`;
      el.style.right = "0";
      el.style.width = "auto";
    } else if (continuesStart) {
      el.style.left = "0";
      el.style.width = `${left + width}%`;
    } else {
      el.style.left = `${left}%`;
      el.style.width = `${width}%`;
    }
    container.appendChild(el);
  });
}

function renderTasksPipelineScale(periodStart, periodEnd, span) {
  const scale = document.createElement("div");
  scale.className = "tasks-pipeline-axis-scale";
  scale.setAttribute("aria-hidden", "true");
  appendTasksPipelineWeekends(scale, periodStart, periodEnd, span);

  if (tasksPipelineState.periodMonths <= 1) {
    // Day markers for the one-month view.
    let cursor = startOfDay(new Date(periodStart));
    while (cursor.getTime() < periodEnd) {
      const ts = cursor.getTime();
      const left = ((ts - periodStart) / span) * 100;
      const tick = document.createElement("span");
      tick.className = "tasks-pipeline-scale-tick tasks-pipeline-scale-day";
      tick.style.left = `${left}%`;
      tick.textContent = String(cursor.getDate());
      scale.appendChild(tick);
      cursor = addDays(cursor, 1);
    }
  } else if (tasksPipelineState.periodMonths < 12) {
    // Week markers for 3- and 6-month views (ISO week numbers).
    const seen = new Set();
    let cursor = startOfISOWeek(new Date(periodStart));
    while (cursor.getTime() < periodEnd) {
      const weekStart = cursor.getTime();
      const weekNo = getISOWeekNumber(cursor);
      const key = `${cursor.getFullYear()}-W${weekNo}`;
      if (!seen.has(key)) {
        seen.add(key);
        const leftMs = Math.max(weekStart, periodStart);
        const left = ((leftMs - periodStart) / span) * 100;
        const tick = document.createElement("span");
        tick.className = "tasks-pipeline-scale-tick tasks-pipeline-scale-week";
        tick.style.left = `${left}%`;
        tick.textContent = `week ${weekNo}`;
        scale.appendChild(tick);
      }
      cursor = addDays(cursor, 7);
    }
  } else {
    return null;
  }

  return scale;
}

function truncateTaskPipelineLabel(text) {
  const value = (text || "").trim();
  if (value.length <= TASKS_PIPELINE_LABEL_MAX) return value;
  return `${value.slice(0, TASKS_PIPELINE_LABEL_MAX)}...`;
}

/** Days from due date to today: +2 overdue, 0 today, -3 upcoming. */
function getTaskDayOffset(dueAt) {
  const today = startOfDay(new Date()).getTime();
  const due = startOfDay(new Date(dueAt)).getTime();
  return Math.round((today - due) / MS_DAY);
}

function formatTaskDayOffset(dueAt) {
  const days = getTaskDayOffset(dueAt);
  if (days === 0) return "";
  if (days > 0) return `+${days}`;
  return String(days);
}

function taskDayOffsetSide(dueAt) {
  const days = getTaskDayOffset(dueAt);
  if (days === 0) return null;
  return days > 0 ? "after" : "before";
}

function taskPipelineOffsetReserveMs(dueAt, span, rowWidthPx) {
  if (!taskDayOffsetSide(dueAt)) return 0;
  return (TASKS_PIPELINE_OFFSET_RESERVE_PX / Math.max(rowWidthPx, 1)) * span;
}

function taskPipelineCompanyKey(entry) {
  return (entry?.deal?.company || "").trim().toLowerCase();
}

function taskPipelineCompanyLabel(deal) {
  const name = (deal?.company || "").trim();
  return `(${name || "Untitled deal"})`;
}

function hashTaskPipelineCompanyKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Pastel tones for companies that have 2+ tasks on the current timeline. */
function assignVisibleCompanyTones(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = taskPipelineCompanyKey(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const grouped = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key]) => key)
    .sort();

  const used = new Set();
  const tones = new Map();
  const paletteSize = TASKS_PIPELINE_COMPANY_TONES.length;
  for (const company of grouped) {
    let index = hashTaskPipelineCompanyKey(company) % paletteSize;
    let hops = 0;
    while (used.has(index) && hops < paletteSize) {
      index = (index + 1) % paletteSize;
      hops += 1;
    }
    used.add(index);
    tones.set(company, TASKS_PIPELINE_COMPANY_TONES[index]);
  }
  return tones;
}

/** Estimate how far a fit-content task bar extends in timeline ms. */
function estimateTaskBarWidthMs(entry, span, rowWidthPx) {
  const labelLen = Math.max(
    1,
    truncateTaskPipelineLabel(entry.task.text).length,
    taskPipelineCompanyLabel(entry.deal).length
  );
  // Rough match to CSS: chars + bar padding, against the visible rows width.
  // Day-offset sits outside the bubble and does not affect bar width.
  const approxPx = labelLen * 8.5 + 44;
  const widthMs = (approxPx / Math.max(rowWidthPx, 1)) * span;
  const gapMs = (8 / Math.max(rowWidthPx, 1)) * span; // small breathing room
  return Math.max(MS_DAY, widthMs) + gapMs;
}

function measureTaskPipelineEntryInterval(entry, span, rowWidthPx) {
  const due = entry.task.dueAt;
  const barEnd = due + estimateTaskBarWidthMs(entry, span, rowWidthPx);
  const reserve = taskPipelineOffsetReserveMs(due, span, rowWidthPx);
  const side = taskDayOffsetSide(due);
  return {
    start: side === "before" ? due - reserve : due,
    end: side === "after" ? barEnd + reserve : barEnd,
  };
}

function measureTaskPipelineItemInterval(item, rowWidthPx) {
  const leftPct = parseFloat(item.style.left) || 0;
  const leftPx = (leftPct / 100) * rowWidthPx;
  const widthPx = Math.max(item.offsetWidth, 1);
  let start = leftPx;
  let end = leftPx + widthPx + 8;
  const offset = item.querySelector(".tasks-pipeline-day-offset");
  if (offset) {
    const pad = Math.max(offset.offsetWidth, TASKS_PIPELINE_OFFSET_RESERVE_PX) + 8;
    if (offset.classList.contains("is-overdue")) end += pad;
    else start -= pad;
  }
  return { start, end };
}

function packIntervalsFirstFit(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const rowEnds = [];
  for (const item of sorted) {
    let row = 0;
    while (row < rowEnds.length && rowEnds[row] > item.start) row += 1;
    if (row === rowEnds.length) rowEnds.push(0);
    rowEnds[row] = item.end;
    item.relRow = row;
  }
  return rowEnds.length;
}

function lowestClusterBaseRow(members, placed) {
  let base = 0;
  while (
    members.some((member) => {
      const row = base + member.relRow;
      return placed.some(
        (entry) => entry.row === row && entry.start < member.end && member.start < entry.end
      );
    })
  ) {
    base += 1;
  }
  return base;
}

function clusterTaskPipelineByCompany(items, getDueAt, getCompany) {
  const gapMs = TASKS_PIPELINE_COMPANY_CLUSTER_GAP_DAYS * MS_DAY;
  const byCompany = new Map();
  for (const item of items) {
    const company = getCompany(item);
    if (!byCompany.has(company)) byCompany.set(company, []);
    byCompany.get(company).push(item);
  }

  const clusters = [];
  for (const [company, group] of byCompany) {
    const sorted = [...group].sort((a, b) => getDueAt(a) - getDueAt(b));
    let current = [];
    for (const item of sorted) {
      if (current.length) {
        const prevDue = getDueAt(current[current.length - 1]);
        if (getDueAt(item) - prevDue > gapMs) {
          clusters.push({ company, items: current });
          current = [];
        }
      }
      current.push(item);
    }
    if (current.length) clusters.push({ company, items: current });
  }

  clusters.sort((a, b) => {
    const aStart = Math.min(...a.items.map(getDueAt));
    const bStart = Math.min(...b.items.map(getDueAt));
    if (aStart !== bStart) return aStart - bStart;
    return a.company.localeCompare(b.company);
  });
  return clusters;
}

function applyTaskPipelineClusterPacking(clusters, measure) {
  const placed = [];
  let maxRow = -1;

  for (const cluster of clusters) {
    const members = cluster.items.map((item) => {
      const { start, end } = measure(item);
      return { item, start, end };
    });
    packIntervalsFirstFit(members);
    const base = lowestClusterBaseRow(members, placed);
    for (const member of members) {
      const row = base + member.relRow;
      placed.push({ row, start: member.start, end: member.end });
      if (row > maxRow) maxRow = row;
      member.row = row;
    }
    cluster.members = members;
  }

  return maxRow + 1;
}

/**
 * Pack tasks into rows by company cluster. Nearby same-company tasks stay stacked
 * together; a gap longer than a week starts a new cluster so empty rows collapse.
 */
function assignTaskPipelineRows(entries, span, rowWidthPx = 720) {
  const clusters = clusterTaskPipelineByCompany(
    entries,
    (entry) => entry.task.dueAt,
    taskPipelineCompanyKey
  );
  applyTaskPipelineClusterPacking(clusters, (entry) =>
    measureTaskPipelineEntryInterval(entry, span, rowWidthPx)
  );

  for (const cluster of clusters) {
    for (const member of cluster.members) {
      member.item._pipelineRow = member.row;
      member.item._pipelineStart = member.item.task.dueAt;
      member.item._pipelineEnd = member.end;
    }
  }

  return clusters.reduce(
    (max, cluster) =>
      Math.max(max, ...cluster.members.map((member) => member.row + 1)),
    0
  );
}

/** After items are in the DOM, re-pack from measured widths so nothing overlaps. */
function relayoutTaskPipelineBars() {
  const items = [...tasksPipelineRowsEl.querySelectorAll(".tasks-pipeline-item")];
  if (!items.length) return;

  const rowWidthPx = Math.max(tasksPipelineRowsEl.clientWidth || 720, 1);
  const clusters = clusterTaskPipelineByCompany(
    items,
    (item) => Number(item.dataset.dueAt) || 0,
    (item) => item.dataset.company || ""
  );
  const rowCount = applyTaskPipelineClusterPacking(clusters, (item) =>
    measureTaskPipelineItemInterval(item, rowWidthPx)
  );

  for (const cluster of clusters) {
    for (const member of cluster.members) {
      member.item.style.top = `${member.row * TASKS_PIPELINE_ROW_HEIGHT + TASKS_PIPELINE_BAR_TOP}px`;
      member.item.dataset.pipelineRow = String(member.row);
    }
  }

  const finalRows = Math.max(rowCount, 2);
  tasksPipelineRowsEl.style.height = `${finalRows * TASKS_PIPELINE_ROW_HEIGHT}px`;

  tasksPipelineRowsEl.querySelectorAll(".tasks-pipeline-row-divider").forEach((el) => el.remove());
  for (let row = 1; row < finalRows; row += 1) {
    const divider = document.createElement("div");
    divider.className = "tasks-pipeline-row-divider";
    divider.style.top = `${row * TASKS_PIPELINE_ROW_HEIGHT}px`;
    tasksPipelineRowsEl.appendChild(divider);
  }
}

function getMonthTaskCount(entries, monthStart, monthEnd) {
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();
  return entries.reduce((count, { task }) => {
    if (task.dueAt >= monthStartMs && task.dueAt < monthEndMs) return count + 1;
    return count;
  }, 0);
}

function setTasksViewMode(mode) {
  if (mode !== "list" && mode !== "pipeline") return;
  hideTasksPipelineTooltip();
  tasksViewMode = mode;
  if (mode === "pipeline") {
    // Opening pipeline always recenters on today so the lookback + forward span is clear.
    tasksViewportStartMs = null;
  }
  if (activeTab === "tasks") renderTasksView();
}

function hideTasksPipelineTooltip() {
  const tip = document.getElementById("tasksPipelineTooltip");
  if (tip) tip.hidden = true;
}

function showTasksPipelineTooltip(bar, deal, task) {
  let tip = document.getElementById("tasksPipelineTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "tasksPipelineTooltip";
    tip.className = "tasks-pipeline-tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }

  const owner = (deal.owner || "").trim() || "Unassigned";
  const company = (deal.company || "").trim() || "Untitled deal";
  tip.innerHTML = "";

  const title = document.createElement("div");
  title.className = "tasks-pipeline-tooltip-title";
  title.textContent = task.text;

  const dealRow = document.createElement("div");
  dealRow.className = "tasks-pipeline-tooltip-row";
  dealRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Deal</span>`;
  const dealVal = document.createElement("span");
  dealVal.textContent = company;
  dealRow.appendChild(dealVal);

  const toolRow = document.createElement("div");
  toolRow.className = "tasks-pipeline-tooltip-row";
  toolRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Tool</span>`;
  const toolVal = document.createElement("span");
  toolVal.textContent = (deal.tool || "").trim() || "—";
  toolRow.appendChild(toolVal);

  const ownerRow = document.createElement("div");
  ownerRow.className = "tasks-pipeline-tooltip-row";
  ownerRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Owner</span>`;
  const ownerVal = document.createElement("span");
  ownerVal.textContent = owner;
  ownerRow.appendChild(ownerVal);

  const dueRow = document.createElement("div");
  dueRow.className = "tasks-pipeline-tooltip-row";
  dueRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Due</span>`;
  const dueVal = document.createElement("span");
  dueVal.textContent = formatTaskDueDate(task.dueAt);
  dueRow.appendChild(dueVal);

  tip.append(title, dealRow, toolRow, ownerRow, dueRow);
  const typeLabel = taskTypeLabel(task.type);
  if (typeLabel) {
    const typeRow = document.createElement("div");
    typeRow.className = "tasks-pipeline-tooltip-row";
    typeRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Type</span>`;
    const typeVal = document.createElement("span");
    typeVal.textContent = typeLabel;
    typeRow.appendChild(typeVal);
    tip.append(typeRow);
  }

  const contactRow = document.createElement("div");
  contactRow.className = "tasks-pipeline-tooltip-row";
  contactRow.innerHTML = `<span class="tasks-pipeline-tooltip-label">Contact</span>`;
  const contactVal = document.createElement("span");
  contactVal.textContent = (deal.contact || "").trim() || "—";
  contactRow.appendChild(contactVal);
  tip.append(contactRow);
  tip.hidden = false;

  const rect = bar.getBoundingClientRect();
  const tipWidth = tip.offsetWidth || 220;
  const tipHeight = tip.offsetHeight || 96;
  const gap = 10;
  let left = rect.right + gap;
  if (left + tipWidth > window.innerWidth - 8) {
    left = rect.left - tipWidth - gap;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
  let top = rect.top + rect.height / 2 - tipHeight / 2;
  top = Math.max(8, Math.min(top, window.innerHeight - tipHeight - 8));
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function renderTasksPipeline(entries) {
  hideTasksPipelineTooltip();

  const { start: periodStart, end: periodEnd, span } = getTasksPipelinePeriodRange(entries);
  tasksPipelineRange = { start: periodStart, end: periodEnd, span };

  if (tasksPipelinePeriodLength) {
    tasksPipelinePeriodLength.value = String(tasksPipelineState.periodMonths);
  }

  const viewportPx = getTasksPipelineViewportPx();
  const contentWidth = Math.max(viewportPx, (span / getTasksPipelineVisibleSpan()) * viewportPx);
  if (tasksPipelineScrollEl) tasksPipelineScrollEl.style.width = `${contentWidth}px`;

  const visibleEntries = entries.filter((entry) => {
    const due = entry.task.dueAt;
    return Number.isFinite(due) && due >= periodStart && due < periodEnd;
  });

  const months = getOverlappingMonthStarts(periodStart, periodEnd);

  tasksPipelineAxisEl.innerHTML = "";
  tasksPipelineAxisEl.classList.toggle(
    "is-day-scale",
    tasksPipelineState.periodMonths <= 1
  );
  tasksPipelineAxisEl.classList.toggle(
    "is-week-scale",
    tasksPipelineState.periodMonths > 1 && tasksPipelineState.periodMonths < 12
  );

  const monthsRow = document.createElement("div");
  monthsRow.className = "tasks-pipeline-axis-months";

  for (const monthStart of months) {
    const monthEnd = addMonths(monthStart, 1);
    const visibleStart = Math.max(monthStart.getTime(), periodStart);
    const visibleEnd = Math.min(monthEnd.getTime(), periodEnd);
    if (visibleEnd <= visibleStart) continue;

    const count = getMonthTaskCount(entries, monthStart, monthEnd);
    const left = ((visibleStart - periodStart) / span) * 100;
    const width = ((visibleEnd - visibleStart) / span) * 100;
    const visibleDays = (visibleEnd - visibleStart) / MS_DAY;
    const showMonthLabel = shouldShowMonthAxisLabel(
      monthStart,
      visibleStart,
      visibleDays,
      periodStart,
      TASKS_PIPELINE_MIN_MONTH_LABEL_DAYS
    );

    const tick = document.createElement("div");
    tick.className = "tasks-pipeline-tick";
    tick.style.left = `${left}%`;
    tick.style.width = `${width}%`;

    if (showMonthLabel) {
      const label = document.createElement("span");
      label.className = "tasks-pipeline-tick-label";
      label.textContent = formatMonthLabel(monthStart);

      const countEl = document.createElement("span");
      countEl.className = "tasks-pipeline-tick-count";
      countEl.title = `${count} task${count === 1 ? "" : "s"} due in ${formatMonthYear(monthStart)}`;
      countEl.textContent = count === 0 ? "—" : `${count} task${count === 1 ? "" : "s"}`;

      tick.append(label, countEl);
    }

    monthsRow.appendChild(tick);
  }

  const today = startOfDay(new Date()).getTime();
  const todayInPeriod = today >= periodStart && today < periodEnd;
  if (todayInPeriod) {
    const todayPct = ((today - periodStart) / span) * 100;
    const todayTick = document.createElement("div");
    todayTick.className = "tasks-pipeline-tick tasks-pipeline-tick-today";
    todayTick.style.left = `${todayPct}%`;
    todayTick.innerHTML = `<span class="tasks-pipeline-tick-label">Today</span>`;
    monthsRow.appendChild(todayTick);
  }

  const scale = renderTasksPipelineScale(periodStart, periodEnd, span);
  if (scale) tasksPipelineAxisEl.append(monthsRow, scale);
  else tasksPipelineAxisEl.append(monthsRow);

  tasksPipelineRowsEl.innerHTML = "";
  appendTasksPipelineWeekends(
    tasksPipelineRowsEl,
    periodStart,
    periodEnd,
    span,
    "is-grid"
  );
  const rowCount = Math.max(
    assignTaskPipelineRows(visibleEntries, span, contentWidth),
    1
  );
  tasksPipelineRowsEl.style.height = `${Math.max(rowCount, 2) * TASKS_PIPELINE_ROW_HEIGHT}px`;

  for (const monthStart of months) {
    const monthMs = monthStart.getTime();
    if (monthMs <= periodStart || monthMs >= periodEnd) continue;
    const gridLine = document.createElement("div");
    gridLine.className = "tasks-pipeline-gridline";
    gridLine.style.left = `${((monthMs - periodStart) / span) * 100}%`;
    tasksPipelineRowsEl.appendChild(gridLine);
  }

  for (let row = 1; row < Math.max(rowCount, 2); row += 1) {
    const divider = document.createElement("div");
    divider.className = "tasks-pipeline-row-divider";
    divider.style.top = `${row * TASKS_PIPELINE_ROW_HEIGHT}px`;
    tasksPipelineRowsEl.appendChild(divider);
  }

  if (todayInPeriod) {
    const todayPct = ((today - periodStart) / span) * 100;
    const todayLine = document.createElement("div");
    todayLine.className = "tasks-pipeline-today-line";
    todayLine.style.left = `${todayPct}%`;
    // Line only — the axis already shows the Today label.
    tasksPipelineRowsEl.appendChild(todayLine);
  }

  if (!visibleEntries.length) {
    const empty = document.createElement("div");
    empty.className = "tasks-pipeline-empty";
    const filtersActive = hasActiveFilters() || searchQuery || taskTypeFilters.size;
    empty.textContent = taskTypeFilters.size
      ? "No matching tasks of the selected types on the timeline"
      : filtersActive
      ? "No matching tasks on the timeline"
      : showCompletedTasks
        ? "No tasks on the timeline — add tasks from a deal’s Tasks tab"
        : "No open tasks on the timeline";
    tasksPipelineRowsEl.appendChild(empty);
    layoutTasksPipelineTimeline(periodStart, span, contentWidth, viewportPx);
    return;
  }

  const companyTones = assignVisibleCompanyTones(visibleEntries);

  for (const entry of visibleEntries) {
    const { deal, task } = entry;
    const left = ((entry._pipelineStart - periodStart) / span) * 100;

    const item = document.createElement("div");
    item.className = "tasks-pipeline-item";
    item.dataset.company = taskPipelineCompanyKey(entry);
    item.dataset.dueAt = String(task.dueAt);
    item.style.left = `${left}%`;
    item.style.top = `${entry._pipelineRow * TASKS_PIPELINE_ROW_HEIGHT + TASKS_PIPELINE_BAR_TOP}px`;

    const dayOffsetDays = getTaskDayOffset(task.dueAt);
    const dayOffsetLabel = formatTaskDayOffset(task.dueAt);
    if (dayOffsetLabel) {
      const dayOffset = document.createElement("span");
      dayOffset.className = "tasks-pipeline-day-offset";
      if (dayOffsetDays > 0) dayOffset.classList.add("is-overdue");
      dayOffset.textContent = dayOffsetLabel;
      item.append(dayOffset);
    }

    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "tasks-pipeline-bar";
    if (task.done) bar.classList.add("is-done");
    if (isTaskOverdue(task)) bar.classList.add("is-overdue");
    const companyTone = companyTones.get(taskPipelineCompanyKey(entry));
    if (companyTone) bar.dataset.companyTone = companyTone;
    bar.setAttribute(
      "aria-label",
      `${task.text}, ${deal.company || "Untitled deal"}, ${taskTypeLabel(task.type) || "task"}, due ${formatTaskDueDate(task.dueAt)}`
    );

    const text = document.createElement("span");
    text.className = "tasks-pipeline-bar-text";

    const label = document.createElement("span");
    label.className = "tasks-pipeline-bar-label";
    label.textContent = truncateTaskPipelineLabel(task.text);

    const company = document.createElement("span");
    company.className = "tasks-pipeline-bar-company";
    company.textContent = taskPipelineCompanyLabel(deal);

    text.append(label, company);
    bar.append(text);
    const typeMark = createTaskTypeMark(task.type);
    if (typeMark) bar.append(typeMark);
    bar.addEventListener("mouseenter", () => showTasksPipelineTooltip(bar, deal, task));
    bar.addEventListener("mousemove", () => showTasksPipelineTooltip(bar, deal, task));
    bar.addEventListener("mouseleave", hideTasksPipelineTooltip);
    bar.addEventListener("focus", () => showTasksPipelineTooltip(bar, deal, task));
    bar.addEventListener("blur", hideTasksPipelineTooltip);
    bar.addEventListener("click", () => {
      hideTasksPipelineTooltip();
      openModal({ deal, initialPanel: "tasks", focusTaskId: task.id });
    });

    item.append(bar);
    tasksPipelineRowsEl.appendChild(item);
  }

  layoutTasksPipelineTimeline(periodStart, span, contentWidth, viewportPx);
  // Measure real bubble widths and push colliding tasks onto lower rows.
  requestAnimationFrame(() => relayoutTaskPipelineBars());
}

function renderTaskCard(deal, task) {
  const card = document.createElement("article");
  card.className = "task-card";
  if (task.done) card.classList.add("is-done");
  if (isTaskOverdue(task)) card.classList.add("is-overdue");

  const main = document.createElement("div");
  main.className = "task-card-main";

  const completeBtn = document.createElement("button");
  completeBtn.type = "button";
  completeBtn.className = "task-complete-btn";
  completeBtn.setAttribute("aria-pressed", task.done ? "true" : "false");
  completeBtn.setAttribute("aria-label", task.done ? "Mark task incomplete" : "Complete task");
  completeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setDealTaskDone(deal.id, task.id, !task.done);
  });

  const body = document.createElement("div");
  body.className = "task-card-body";

  const name = document.createElement("h3");
  name.className = "task-card-name";
  name.textContent = task.text;

  const company = document.createElement("p");
  company.className = "task-card-company";
  company.textContent = deal.company || "Untitled deal";

  const meta = document.createElement("p");
  meta.className = "task-card-meta";
  const bits = [formatTaskDueDate(task.dueAt)];
  const typeLabel = taskTypeLabel(task.type);
  if (typeLabel) bits.push(typeLabel);
  if (task.createdBy) bits.push(`by ${task.createdBy}`);
  if (deal.owner && deal.owner !== task.createdBy) bits.push(deal.owner);
  if (task.done) bits.push("Completed");
  else if (isTaskOverdue(task)) bits.push("Overdue");
  if (taskWasEdited(task)) {
    bits.push(`edited ${formatNoteTimestamp(task.updatedAt)}${formatActorStamp(task.updatedBy || task.createdBy)}`);
  }
  meta.textContent = bits.join(" · ");

  body.append(name, company, meta);
  main.append(completeBtn, body);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "btn btn-ghost btn-sm";
  openBtn.textContent = "Edit";
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal({ deal, initialPanel: "tasks", focusTaskId: task.id });
  });

  card.append(main, openBtn);
  const typeMark = createTaskTypeMark(task.type);
  if (typeMark) card.append(typeMark);
  card.addEventListener("click", () =>
    openModal({ deal, initialPanel: "tasks", focusTaskId: task.id })
  );
  card.tabIndex = 0;
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal({ deal, initialPanel: "tasks", focusTaskId: task.id });
    }
  });

  return card;
}

/* ------------------------------ Modal --------------------------- */

function openModal({
  deal = null,
  stage = "prospects",
  readOnly = false,
  initialPanel = "details",
  focusTaskId = null,
} = {}) {
  editingId = deal ? deal.id : null;
  modalReadOnly = readOnly && Boolean(deal);
  expandedActivityNoteIds.clear();
  createStage = stage;
  modalNotes = deal
    ? (deal.notes || []).map((note) => ({ ...note }))
    : [];
  modalMilestones = milestonesFromNotes(modalNotes);
  modalTasks = deal
    ? (deal.tasks || []).map((task) => normalizeTask(task))
    : [];

  // Reset first so later-rendered task inputs are not wiped back to empty defaults.
  form.reset();
  form.elements.value.value = deal ? deal.value : DEFAULT_VALUE;

  if (deal) {
    form.elements.company.value = deal.company || "";
    form.elements.contact.value = deal.contact || "";
    form.elements.phone.value = deal.phone || "";
    form.elements.email.value = deal.email || "";
    form.elements.industry.value = deal.industry || "";
    form.elements.tool.value = deal.tool || "";
    form.elements.owner.value = deal.owner || "";
    dealBriefInput.value = briefNoteText(deal.notes);
    dealValueInput.value = valueNoteText(deal.notes);
    applySharedCompanyProfile(deal.company);

    const showImplementation =
      deal.stage === "committed" || deal.stage === "paid" || deal.stage === "failed";
    implementationFields.hidden = !showImplementation;
    form.elements.implementationStart.required = deal.stage === "committed";
    form.elements.implementationDuration.required = deal.stage === "committed";

    if (showImplementation) {
      form.elements.implementationStart.value = deal.committedAt
        ? toDateInputValue(deal.committedAt)
        : "";
      form.elements.implementationDuration.value = deal.implementationDays || "";
      form.elements.contractName.value = deal.contractName || "";
      resetDealContractFileState(deal);
    } else {
      form.elements.implementationStart.value = "";
      form.elements.implementationDuration.value = "";
      form.elements.contractName.value = "";
      resetDealContractFileState(null);
    }
  } else {
    implementationFields.hidden = true;
    form.elements.implementationStart.required = false;
    form.elements.implementationDuration.required = false;
    form.elements.implementationStart.value = "";
    form.elements.implementationDuration.value = "";
    form.elements.contractName.value = "";
    resetDealContractFileState(null);
    form.elements.owner.value = getCurrentUserName();
    dealBriefInput.value = "";
    dealValueInput.value = "";
  }
  resetDealToolFileState(deal);
  setCompanyDetailTab("details");

  newNoteInput.value = "";
  newTaskNameInput.value = "";
  newTaskDueInput.value = "";
  newTaskType = "";
  mountComposerTaskTypePicker();
  setModalPanel(initialPanel);
  renderActivityNotes();
  renderDealTasks();

  modalTitle.textContent = modalReadOnly
    ? "View deal"
    : deal
      ? "Edit deal"
      : "New deal";
  updateModalTitleTool();
  saveBtn.textContent = deal ? "Save changes" : "Create deal";
  deleteBtn.hidden = !deal;

  applyModalReadOnly(modalReadOnly);

  overlay.hidden = false;

  if (focusTaskId) {
    const taskCard = dealTasksListEl.querySelector(`[data-task-id="${focusTaskId}"]`);
    const taskNameInput = taskCard?.querySelector(".deal-task-name");
    if (taskNameInput && !modalReadOnly) {
      taskCard.scrollIntoView({ block: "nearest" });
      taskNameInput.focus();
      taskNameInput.select?.();
    }
  } else if (!modalReadOnly && initialPanel === "details") {
    form.elements.company.focus();
  } else if (!modalReadOnly && initialPanel === "tasks" && !modalTasks.length) {
    newTaskNameInput.focus();
  }
}

function applyModalReadOnly(isReadOnly) {
  modalEl.classList.toggle("is-readonly", isReadOnly);

  for (const el of form.elements) {
    if (el.tagName === "BUTTON") continue;
    if (el.type === "checkbox" || el.type === "radio") {
      el.disabled = isReadOnly;
    } else {
      el.readOnly = isReadOnly;
    }
  }

  saveBtn.hidden = isReadOnly;
  deleteBtn.hidden = isReadOnly || !editingId;
  activityComposer.hidden = isReadOnly;
  dealTasksComposer.hidden = isReadOnly;
  newTaskNameInput.readOnly = isReadOnly;
  newTaskDueInput.disabled = isReadOnly;
  if (dealContractFileBtn) {
    // Keep preview available in read-only; only block choosing a new file.
    dealContractFileBtn.disabled = false;
  }
  if (dealToolFileBtn) dealToolFileBtn.disabled = false;
  mountComposerTaskTypePicker();
  renderDealMilestones();
  cancelBtn.textContent = isReadOnly ? "Close" : "Cancel";
}

function closeModal() {
  closeAllFieldSuggestions();
  closePendingDraftModal();
  overlay.hidden = true;
  editingId = null;
  modalReadOnly = false;
  applyModalReadOnly(false);
  modalNotes = [];
  modalMilestones = emptyMilestones();
  modalTasks = [];
  resetDealContractFileState(null);
  resetDealToolFileState(null);
  newNoteInput.value = "";
  newTaskNameInput.value = "";
  newTaskDueInput.value = "";
  newTaskType = "";
  mountComposerTaskTypePicker();
  setModalPanel("details");
}

function openDismissModal() {
  if (!editingId) return;
  const deal = deals.find((d) => d.id === editingId);
  const name = deal?.company ? ` “${deal.company}”` : "";
  dismissLead.textContent = `Are you sure you want to dismiss this deal${name}?`;
  dismissOverlay.hidden = false;
}

function closeDismissModal() {
  dismissOverlay.hidden = true;
}

function dismissDeal() {
  if (!editingId) return;
  const deal = deals.find((d) => d.id === editingId);
  if (!deal) return;
  deal.stage = "dismissed";
  deal.dismissedAt = Date.now();
  delete deal.pausedAt;
  delete deal.pinnedAt;
  saveDeals(deal.id);
  render();
  closeDismissModal();
  closeModal();
}

historySearchInput.addEventListener("input", () => {
  historySearchQuery = historySearchInput.value;
  if (activeTab === "history") renderHistory();
});

function permanentlyDeleteDeal() {
  if (!editingId) return;
  const id = editingId;
  deals = deals.filter((d) => d.id !== id);

  const api = window.MHN_DB;
  const finishUi = () => {
    render();
    closeDismissModal();
    closeModal();
  };

  // Local cache + single-row cloud delete (never a full-table rewrite).
  if (api?.deleteDealAsync) {
    api
      .deleteDealAsync(id, deals)
      .then((result) => {
        if (result?.writeBlocked && result.reason === "not-hydrated") {
          showSyncStatus(
            "Offline — deal removed locally; cloud delete pending reconnect.",
            true,
            true
          );
        }
      })
      .catch((err) => {
        console.error(err);
        showSyncStatus(
          `Could not delete deal from cloud${syncErrorDetail(err)}`,
          true,
          true
        );
      });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  }

  finishUi();
}

function hasPendingNoteDraft() {
  return Boolean(newNoteInput?.value.trim());
}

function hasPendingTaskDraft() {
  return Boolean(newTaskNameInput?.value.trim());
}

function closePendingDraftModal() {
  if (!pendingDraftOverlay) return;
  pendingDraftOverlay.hidden = true;
  pendingDraftKind = null;
}

function openPendingDraftModal(kind) {
  pendingDraftKind = kind;
  if (kind === "task") {
    pendingDraftTitle.textContent = "Unadded task";
    pendingDraftLead.textContent =
      "You wrote a task name that hasn’t been added yet. Add it before saving this deal?";
    pendingDraftConfirmBtn.textContent = "Yes, add task";
  } else {
    pendingDraftTitle.textContent = "Unadded note";
    pendingDraftLead.textContent =
      "You wrote a note that hasn’t been added yet. Add it before saving this deal?";
    pendingDraftConfirmBtn.textContent = "Yes, add note";
  }
  pendingDraftOverlay.hidden = false;
}

async function confirmPendingDraft() {
  if (pendingDraftKind === "note") {
    addActivityNote();
    if (hasPendingNoteDraft()) return;
    closePendingDraftModal();
    if (hasPendingTaskDraft()) {
      openPendingDraftModal("task");
      return;
    }
    await saveDealFromForm();
    return;
  }

  if (pendingDraftKind === "task") {
    if (newTaskDueInput && parseDateInput(newTaskDueInput.value) == null) {
      newTaskDueInput.value = toDateInputValue(Date.now());
    }
    if (!normalizeTaskType(newTaskType)) {
      newTaskType = "call";
      mountComposerTaskTypePicker();
    }
    addDealTask();
    if (hasPendingTaskDraft()) {
      closePendingDraftModal();
      setModalPanel("tasks");
      if (parseDateInput(newTaskDueInput?.value) == null) newTaskDueInput?.focus();
      else newTaskNameInput?.focus();
      return;
    }
    closePendingDraftModal();
    await saveDealFromForm();
  }
}

function dealsSharingCompany(name) {
  const key = normalizeCompanyKey(name);
  if (!key) return [];
  return deals.filter((deal) => normalizeCompanyKey(deal.company) === key);
}

function latestFilledCompanyField(related, read) {
  let best = "";
  let bestTime = -1;
  for (const deal of related) {
    const value = String(read(deal) || "").trim();
    if (!value) continue;
    const time = Number(deal.createdAt) || 0;
    if (time >= bestTime) {
      best = value;
      bestTime = time;
    }
  }
  return best;
}

function latestKindNoteText(related, kind) {
  let best = "";
  let bestTime = -1;
  for (const deal of related) {
    const note = (deal.notes || []).find((item) => item?.kind === kind);
    const text = String(note?.text || "").trim();
    if (!text) continue;
    const time = Number(note.updatedAt || note.createdAt || 0);
    if (time >= bestTime) {
      best = text;
      bestTime = time;
    }
  }
  return best;
}

function sharedCompanyProfile(name) {
  const related = dealsSharingCompany(name);
  if (!related.length) return null;
  return {
    company: latestFilledCompanyField(related, (deal) => deal.company),
    contact: latestFilledCompanyField(related, (deal) => deal.contact),
    phone: latestFilledCompanyField(related, (deal) => deal.phone),
    email: latestFilledCompanyField(related, (deal) => deal.email),
    industry: latestFilledCompanyField(related, (deal) => deal.industry),
    brief: latestKindNoteText(related, BRIEF_NOTE_KIND),
    value: latestKindNoteText(related, VALUE_NOTE_KIND),
  };
}

function applySharedCompanyProfile(name) {
  const profile = sharedCompanyProfile(name);
  if (!profile) return;
  if (profile.company) form.elements.company.value = profile.company;
  form.elements.contact.value = profile.contact;
  form.elements.phone.value = profile.phone;
  form.elements.email.value = profile.email;
  form.elements.industry.value = profile.industry;
  dealBriefInput.value = profile.brief;
  dealValueInput.value = profile.value;
  updateModalTitleTool();
}

function setDealKindNote(deal, kind, text) {
  if (!Array.isArray(deal.notes)) deal.notes = [];
  const trimmed = String(text || "").trim();
  const existing = deal.notes.find((note) => note?.kind === kind);
  if (!trimmed) {
    if (!existing) return false;
    deal.notes = deal.notes.filter((note) => note !== existing);
    return true;
  }
  if (existing) {
    if (existing.text === trimmed) return false;
    existing.text = trimmed;
    existing.updatedAt = Date.now();
    existing.updatedBy = stampCurrentUser(existing.createdBy);
    return true;
  }
  deal.notes.push({
    id: crypto.randomUUID(),
    kind,
    text: trimmed,
    createdAt: Date.now(),
    updatedAt: null,
    createdBy: stampCurrentUser(),
    updatedBy: "",
  });
  return true;
}

function writeSharedCompanyProfile(profile) {
  const key = normalizeCompanyKey(profile.company);
  if (!key) return [];
  const changed = [];
  for (const deal of deals) {
    if (normalizeCompanyKey(deal.company) !== key) continue;
    let dirty = false;
    if ((deal.company || "") !== profile.company) {
      deal.company = profile.company;
      dirty = true;
    }
    if ((deal.contact || "") !== profile.contact) {
      deal.contact = profile.contact;
      dirty = true;
    }
    if ((deal.phone || "") !== profile.phone) {
      deal.phone = profile.phone;
      dirty = true;
    }
    if ((deal.email || "") !== profile.email) {
      deal.email = profile.email;
      dirty = true;
    }
    if ((deal.industry || "") !== profile.industry) {
      deal.industry = profile.industry;
      dirty = true;
    }
    if (setDealKindNote(deal, BRIEF_NOTE_KIND, profile.brief)) dirty = true;
    if (setDealKindNote(deal, VALUE_NOTE_KIND, profile.value)) dirty = true;
    if (dirty) changed.push(deal.id);
  }
  return changed;
}

async function saveDealFromForm() {
  if (editingId) {
    const existing = deals.find((d) => d.id === editingId);
    if (existing?.stage === "committed") {
      const startDate = parseDateInput(form.elements.implementationStart.value);
      const days = Number(form.elements.implementationDuration.value);
      if (!startDate || !days || days < 1) {
        setModalPanel("deal");
        const missing = !startDate
          ? form.elements.implementationStart
          : form.elements.implementationDuration;
        missing.reportValidity();
        missing.focus();
        return;
      }
    }
  }

  const fileDealId = editingId || crypto.randomUUID();
  try {
    const uploaded = await ensureContractFileUploaded(fileDealId, {
      pendingFile: modalToolFile,
      path: modalToolFilePath,
      fileName: modalToolFileName,
      label: "Document",
    });
    modalToolFile = null;
    modalToolFilePath = uploaded.path;
    modalToolFileName = uploaded.fileName;
    syncToolFileNote(uploaded.path, uploaded.fileName);
    syncToolFileButton();
  } catch (err) {
    console.error(err);
    showSyncStatus(`Could not save document${syncErrorDetail(err)}`, true, true);
    return;
  }

  syncBriefNote();
  syncValueNote();
  syncMilestonesNote();
  const data = {
    company: toTitleCase(form.elements.company.value),
    contact: toTitleCase(form.elements.contact.value),
    phone: form.elements.phone.value.trim(),
    email: form.elements.email.value.trim(),
    industry: toTitleCase(form.elements.industry.value),
    tool: toTitleCase(form.elements.tool.value),
    value: Number(form.elements.value.value) || 0,
    owner: toTitleCase(form.elements.owner.value),
    notes: modalNotes
      .map((note) => ({
        id: note.id,
        text: note.text.trim(),
        createdAt: note.createdAt,
        updatedAt: noteWasEdited(note) ? note.updatedAt : note.createdAt,
        createdBy: String(note.createdBy || "").trim(),
        updatedBy: noteWasEdited(note)
          ? String(note.updatedBy || stampCurrentUser(note.createdBy)).trim()
          : String(note.createdBy || "").trim(),
        ...(note.kind ? { kind: note.kind } : {}),
        ...(note.stage ? { stage: note.stage } : {}),
      }))
      .filter((note) => note.text),
    tasks: serializeModalTasks().map((task) => ({
      ...task,
      updatedAt: taskWasEdited(task) ? task.updatedAt : task.createdAt,
      updatedBy: taskWasEdited(task)
        ? String(task.updatedBy || stampCurrentUser(task.createdBy)).trim()
        : String(task.createdBy || "").trim(),
    })),
  };

  let savedDealId = null;
  if (editingId) {
    const deal = deals.find((d) => d.id === editingId);
    Object.assign(deal, data);

    if (deal.stage === "committed" || deal.stage === "paid" || deal.stage === "failed") {
      const startDate = parseDateInput(form.elements.implementationStart.value);
      const days = Number(form.elements.implementationDuration.value);
      const scheduleRequired = deal.stage === "committed";
      if (scheduleRequired && (!startDate || !days || days < 1)) {
        setModalPanel("deal");
        const missing = !startDate
          ? form.elements.implementationStart
          : form.elements.implementationDuration;
        missing.reportValidity();
        missing.focus();
        return;
      }
      if (startDate && days >= 1) {
        deal.committedAt = startDate;
        deal.implementationDays = days;
      }
      deal.contractName = toTitleCase(form.elements.contractName.value);
      try {
        const uploaded = await ensureContractFileUploaded(deal.id, {
          pendingFile: modalContractFile,
          path: modalContractFilePath,
          fileName: modalContractFileName,
        });
        deal.contractFilePath = uploaded.path;
        deal.contractFileName = uploaded.fileName;
      } catch (err) {
        console.error(err);
        showSyncStatus(`Could not save contract file${syncErrorDetail(err)}`, true, true);
        return;
      }
    }
    savedDealId = deal.id;
  } else {
    const createdAt = Date.now();
    const newDeal = {
      id: fileDealId,
      stage: createStage,
      createdAt,
      ...data,
      boardOrder: nextBoardOrder(createStage),
      notes: [
        makeDealCreationNote(createdAt),
        ...(createStage !== "prospects"
          ? [makeStagePlacementNote(createStage, createdAt, data.owner)]
          : []),
        ...(data.notes || []),
      ],
      tasks: data.tasks || [],
    };
    if (createStage === "interested") newDeal.interestedAt = createdAt;
    if (createStage === "committed" || createStage === "paid") newDeal.committedEnteredAt = createdAt;
    deals.push(newDeal);
    savedDealId = newDeal.id;
  }

  const profile = {
    company: data.company,
    contact: data.contact,
    phone: data.phone,
    email: data.email,
    industry: data.industry,
    brief: briefNoteText(data.notes),
    value: valueNoteText(data.notes),
  };
  if (!editingId) {
    const existing = sharedCompanyProfile(profile.company);
    if (existing) {
      if (!profile.contact) profile.contact = existing.contact;
      if (!profile.phone) profile.phone = existing.phone;
      if (!profile.email) profile.email = existing.email;
      if (!profile.industry) profile.industry = existing.industry;
      if (!profile.brief) profile.brief = existing.brief;
      if (!profile.value) profile.value = existing.value;
      if (existing.company) profile.company = existing.company;
    }
  }
  const mirrored = writeSharedCompanyProfile(profile);
  saveDeals([savedDealId, ...mirrored]);

  render();
  closeModal();
}

function revealInvalidDealField() {
  const company = form.elements.company;
  const email = form.elements.email;
  const value = form.elements.value;
  const owner = form.elements.owner;

  if (!company.value.trim() || !company.checkValidity()) {
    setModalPanel("details");
    setCompanyDetailTab("details");
    company.reportValidity();
    company.focus();
    return true;
  }
  if (email.value && !email.checkValidity()) {
    setModalPanel("details");
    setCompanyDetailTab("details");
    email.reportValidity();
    email.focus();
    return true;
  }
  if (!value.checkValidity()) {
    setModalPanel("deal");
    value.reportValidity();
    value.focus();
    return true;
  }
  if (!owner.value.trim()) {
    setModalPanel("deal");
    owner.reportValidity();
    owner.focus();
    return true;
  }
  return false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (modalReadOnly) return;
  if (revealInvalidDealField()) return;
  if (hasPendingNoteDraft()) {
    openPendingDraftModal("note");
    return;
  }
  if (hasPendingTaskDraft()) {
    openPendingDraftModal("task");
    return;
  }
  saveBtn.disabled = true;
  try {
    await saveDealFromForm();
  } finally {
    saveBtn.disabled = false;
  }
});

form.elements.tool.addEventListener("input", updateModalTitleTool);
form.elements.company.addEventListener("input", () => {
  updateModalTitleTool();
  if (!companyHistoryFields.hidden) renderCompanyHistory();
});

document.querySelectorAll(".modal-tab").forEach((tab) => {
  tab.addEventListener("click", () => setModalPanel(tab.dataset.modalTab));
});
dealMilestonesEl?.querySelectorAll(".deal-milestone").forEach((button) => {
  button.addEventListener("click", () => {
    if (modalReadOnly) return;
    const id = button.dataset.milestone;
    if (!DEAL_MILESTONES.some((milestone) => milestone.id === id)) return;
    modalMilestones[id] = !modalMilestones[id];
    renderDealMilestones();
  });
});

document.querySelectorAll(".detail-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setCompanyDetailTab(tab.dataset.detailTab);
    if (tab.dataset.detailTab === "brief" && !modalReadOnly) dealBriefInput.focus();
  });
});
if (activityNotesOnlyInput) {
  activityNotesOnlyInput.checked = activityNotesOnly;
  activityNotesOnlyInput.addEventListener("change", () => {
    activityNotesOnly = activityNotesOnlyInput.checked;
    try {
      localStorage.setItem(ACTIVITY_NOTES_ONLY_KEY, activityNotesOnly ? "1" : "0");
    } catch {
      /* preference is optional */
    }
    renderActivityNotes();
  });
}

document.getElementById("addNoteBtn").addEventListener("click", addActivityNote);
document.getElementById("addTaskBtn").addEventListener("click", addDealTask);
newTaskNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addDealTask();
  }
});
if (newTaskDueInput) {
  newTaskDueInput.addEventListener("change", () => {
    // Dismiss the native date picker as soon as a date is chosen.
    newTaskDueInput.blur();
  });
}
if (tasksShowCompletedBtn) {
  tasksShowCompletedBtn.addEventListener("click", () => {
    showCompletedTasks = !showCompletedTasks;
    if (activeTab === "tasks") renderTasksView();
  });
}
mountComposerTaskTypePicker();
renderTaskTypeFilter();
if (tasksClearFiltersBtn) {
  tasksClearFiltersBtn.addEventListener("click", clearFilters);
}

document.querySelectorAll(".tasks-view-btn").forEach((btn) => {
  btn.addEventListener("click", () => setTasksViewMode(btn.dataset.tasksView));
});

if (tasksPipelinePeriodLength) {
  tasksPipelinePeriodLength.addEventListener("change", () => {
    tasksPipelineState.periodMonths = Number(tasksPipelinePeriodLength.value) || 1;
    tasksViewportStartMs = null;
    if (activeTab === "tasks") renderTasksView();
  });
}
if (tasksPipelineLayout) {
  tasksPipelineLayout.addEventListener(
    "scroll",
    () => {
      hideTasksPipelineTooltip();
      rememberTasksPipelineScroll();
    },
    { passive: true }
  );
  tasksPipelineLayout.addEventListener(
    "wheel",
    (e) => {
      hideTasksPipelineTooltip();
      const canScrollX = tasksPipelineLayout.scrollWidth > tasksPipelineLayout.clientWidth + 1;
      const canScrollY = tasksPipelineLayout.scrollHeight > tasksPipelineLayout.clientHeight + 1;
      if (!canScrollX) return;
      // Bars sit in an overflow:hidden row, which swallows a sideways wheel.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        tasksPipelineLayout.scrollLeft += e.deltaX;
        return;
      }
      if (canScrollY && !e.shiftKey) return;
      e.preventDefault();
      tasksPipelineLayout.scrollLeft += e.deltaY;
    },
    { passive: false }
  );
}

deleteBtn.addEventListener("click", openDismissModal);

document.getElementById("dismissConfirmBtn").addEventListener("click", dismissDeal);
document.getElementById("dismissCancelBtn").addEventListener("click", closeDismissModal);
document.getElementById("dismissCloseBtn").addEventListener("click", closeDismissModal);
document.getElementById("deleteForeverBtn").addEventListener("click", permanentlyDeleteDeal);
dismissOverlay.addEventListener("click", (e) => {
  if (e.target === dismissOverlay) closeDismissModal();
});

pauseConfirmBtn.addEventListener("click", confirmPauseAction);
document.getElementById("pauseCancelBtn").addEventListener("click", closePauseModal);
document.getElementById("pauseCloseBtn").addEventListener("click", closePauseModal);
pauseOverlay.addEventListener("click", (e) => {
  if (e.target === pauseOverlay) closePauseModal();
});

document.getElementById("pendingDraftConfirmBtn").addEventListener("click", confirmPendingDraft);
document.getElementById("pendingDraftCancelBtn").addEventListener("click", closePendingDraftModal);
document.getElementById("pendingDraftCloseBtn").addEventListener("click", closePendingDraftModal);
pendingDraftOverlay.addEventListener("click", (e) => {
  if (e.target === pendingDraftOverlay) closePendingDraftModal();
});

document.getElementById("newDealBtn").addEventListener("click", () => openModal());
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!knowledgeDeleteOverlay.hidden) closeKnowledgeDeleteModal();
  else if (!pendingDraftOverlay.hidden) closePendingDraftModal();
  else if (!pauseOverlay.hidden) closePauseModal();
  else if (!dismissOverlay.hidden) closeDismissModal();
  else if (!commitOverlay.hidden) closeCommitModal();
  else if (!overlay.hidden) closeModal();
  else if (!importOverlay.hidden) closeImportModal();
});

/* -------------------- Import prospects (Excel / CSV) ------------------- */

const SHEETJS_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const IMPORT_MAX_ROWS = 300;
const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMPORT_CHUNK_SIZE = 25;

const IMPORT_COLUMNS = [
  {
    key: "company",
    label: "Company name",
    aliases: ["company", "account", "organisation", "organization", "business", "firm", "prospect", "ettevote", "nimi"],
  },
  {
    key: "contact",
    label: "Contact name",
    aliases: ["contact", "contact person", "person", "kontakt", "kontaktisik"],
  },
  {
    key: "phone",
    label: "Phone",
    aliases: ["phone number", "telephone", "tel", "mobile", "telefon"],
  },
  {
    key: "email",
    label: "Email",
    aliases: ["e mail", "email address", "mail", "e post"],
  },
  {
    key: "industry",
    label: "Industry",
    aliases: ["sector", "vertical", "valdkond", "tegevusala"],
  },
  {
    key: "tool",
    label: "Tool",
    aliases: ["product", "service", "toode", "teenus"],
  },
  {
    key: "owner",
    label: "Owner",
    aliases: ["deal owner", "sales owner", "sales rep", "responsible", "assignee", "omanik", "vastutaja"],
  },
  {
    key: "brief",
    label: "Brief",
    aliases: ["note", "notes", "description", "comment", "comments", "summary", "background", "kirjeldus", "markus"],
  },
  {
    key: "value",
    label: "Sales value",
    aliases: ["value", "deal value", "amount", "revenue", "vaartus", "summa"],
  },
];

/** Legal-form words ignored when deciding whether two company names are the same. */
const COMPANY_SUFFIX_WORDS = new Set([
  "ou", "as", "uab", "sia", "ab", "oy", "oyj", "aps", "asa", "ehf",
  "ltd", "limited", "llc", "llp", "lp", "inc", "incorporated", "corp", "corporation",
  "company", "co", "plc",
  "gmbh", "mbh", "ag", "kg", "kgaa", "ug", "se", "gbr", "ohg",
  "bv", "nv", "cv", "vof", "sa", "sas", "sarl", "srl", "spa", "sl", "slu",
  "kft", "zoo", "sp", "doo", "ead", "ood", "eood", "tov",
]);

const importOverlay = document.getElementById("importOverlay");
const importLocalWarning = document.getElementById("importLocalWarning");
const importDropZone = document.getElementById("importDropZone");
const importFileInput = document.getElementById("importFileInput");
const importFileError = document.getElementById("importFileError");
const importFileNameEl = document.getElementById("importFileName");
const importSummaryEl = document.getElementById("importSummary");
const importPreviewBody = document.getElementById("importPreviewBody");
const importSelectAll = document.getElementById("importSelectAll");
const importConfirmBtn = document.getElementById("importConfirmBtn");
const importProgressEl = document.getElementById("importProgress");
const importProgressBar = document.getElementById("importProgressBar");
const importProgressLabel = document.getElementById("importProgressLabel");
const importResultEl = document.getElementById("importResult");
const importUndoBtn = document.getElementById("importUndoBtn");
const importSteps = {
  file: document.getElementById("importStepFile"),
  preview: document.getElementById("importStepPreview"),
  result: document.getElementById("importStepResult"),
};

let importRows = [];
let importTruncated = false;
let importBusy = false;
let lastImport = null; // { ids: string[], count: number }
let sheetJsPromise = null;

function normalizeHeaderKey(raw) {
  return String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const IMPORT_HEADER_LOOKUP = new Map();
for (const column of IMPORT_COLUMNS) {
  IMPORT_HEADER_LOOKUP.set(normalizeHeaderKey(column.label), column.key);
  for (const alias of column.aliases) {
    IMPORT_HEADER_LOOKUP.set(normalizeHeaderKey(alias), column.key);
  }
}

/** "Acme Holding OÜ" and "acme holding" collapse to the same key. */
function normalizeCompanyKey(name) {
  const words = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIX_WORDS.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ");
}

/** Reuse the spelling already on the board so the Owner filter doesn't fragment. */
function resolveImportOwner(raw) {
  const value = String(raw || "").trim();
  if (!value) return getCurrentUserName();
  const target = value.toLowerCase();
  for (const deal of deals) {
    const existing = (deal.owner || "").trim();
    if (existing && existing.toLowerCase() === target) return existing;
  }
  return value;
}

function parseImportValue(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  let cleaned = text.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Rightmost separator is the decimal point; the other one groups thousands.
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    cleaned = cleaned.split(grouping).join("").replace(decimal, ".");
  } else if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals === 3 ? cleaned.split(",").join("") : cleaned.replace(",", ".");
  }

  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function countDigits(value) {
  return (String(value).match(/\d/g) || []).length;
}

function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SHEETJS_SRC;
      script.async = true;
      script.onload = () =>
        window.XLSX ? resolve(window.XLSX) : reject(new Error("Spreadsheet reader did not load"));
      script.onerror = () => reject(new Error("Spreadsheet reader could not be downloaded"));
      document.head.appendChild(script);
    }).catch((err) => {
      sheetJsPromise = null;
      throw err;
    });
  }
  return sheetJsPromise;
}

function detectCsvDelimiter(line) {
  const counts = [",", ";", "\t"].map((sep) => {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === sep && !quoted) count++;
    }
    return { sep, count };
  });
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count ? counts[0].sep : ",";
}

function parseCsvText(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const firstBreak = clean.search(/\r?\n/);
  const delimiter = detectCsvDelimiter(firstBreak < 0 ? clean : clean.slice(0, firstBreak));

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (clean[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

async function readSheetRows(file) {
  const isCsv = /\.csv$/i.test(file.name || "") || file.type === "text/csv";
  let XLSX = null;
  try {
    XLSX = await loadSheetJs();
  } catch (err) {
    console.warn("SheetJS unavailable:", err);
    if (!isCsv) {
      throw new Error(
        "Could not load the spreadsheet reader. Check your connection, or save the file as .csv and try again."
      );
    }
  }

  if (!XLSX) return parseCsvText(await file.text());

  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = book.SheetNames?.[0];
  const sheet = sheetName ? book.Sheets[sheetName] : null;
  if (!sheet) throw new Error("That file has no sheets to read.");
  // raw:false keeps phone numbers, leading zeros and dates as the text you see in Excel.
  // blankrows:true keeps row numbers aligned with the spreadsheet.
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: "", raw: false });
}

function importCellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return toDateInputValue(value.getTime());
  return String(value).replace(/\s+/g, " ").trim();
}

function buildImportRows(rawRows) {
  const table = (rawRows || []).map((row) => (Array.isArray(row) ? row.map(importCellText) : []));
  const headerIndex = table.findIndex((row) => row.some((cell) => cell));
  if (headerIndex < 0) throw new Error("That file looks empty.");

  const mapping = new Map();
  const mapped = new Set();
  table[headerIndex].forEach((cell, index) => {
    const key = IMPORT_HEADER_LOOKUP.get(normalizeHeaderKey(cell));
    if (key && !mapped.has(key)) {
      mapping.set(index, key);
      mapped.add(key);
    }
  });

  if (!mapped.has("company")) {
    throw new Error(
      "No “Company name” column in the first row. Rename that column, or download the template."
    );
  }

  const rows = [];
  let truncated = false;
  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = table[i];
    if (!cells.some((cell) => cell)) continue;
    if (rows.length >= IMPORT_MAX_ROWS) {
      truncated = true;
      break;
    }
    const values = {};
    for (const [index, key] of mapping) values[key] = cells[index] || "";
    rows.push({
      rowNumber: i + 1,
      values,
      value: parseImportValue(values.value),
      errors: [],
      warnings: [],
      duplicate: null,
      status: "new",
      include: true,
    });
  }

  return { rows, truncated };
}

function classifyImportRows(rows) {
  const existing = new Map();
  for (const deal of deals) {
    const key = normalizeCompanyKey(deal.company);
    if (!key) continue;
    const entry = existing.get(key) || { active: null, dismissed: null };
    if (deal.stage === "dismissed") entry.dismissed = entry.dismissed || deal;
    else entry.active = entry.active || deal;
    existing.set(key, entry);
  }

  const seenInFile = new Map();
  for (const row of rows) {
    row.errors = [];
    row.warnings = [];
    row.duplicate = null;

    if (!row.values.company) row.errors.push("Missing company name");
    if (row.values.email && !looksLikeEmail(row.values.email)) {
      row.warnings.push("Email looks invalid");
    }
    if (row.values.phone && countDigits(row.values.phone) < 6) {
      row.warnings.push("Phone looks incomplete");
    }
    if (row.values.value && row.value == null) {
      row.warnings.push("Unreadable value — using €10,000");
    }

    const key = normalizeCompanyKey(row.values.company);
    if (key) {
      const earlierRow = seenInFile.get(key);
      if (earlierRow) {
        row.duplicate = { kind: "file", row: earlierRow };
      } else {
        const entry = existing.get(key);
        if (entry?.active) row.duplicate = { kind: "board", deal: entry.active };
        else if (entry?.dismissed) row.duplicate = { kind: "history", deal: entry.dismissed };
        seenInFile.set(key, row.rowNumber);
      }
    }

    row.status = row.errors.length ? "error" : row.duplicate ? "duplicate" : "new";
    row.include = row.status === "new";
  }
  return rows;
}

function importStatusLabel(row) {
  if (row.status === "error") return "Error";
  if (row.status === "duplicate") return "Duplicate";
  return row.warnings.length ? "Check" : "New";
}

function importStatusDetail(row) {
  if (row.errors.length) return row.errors.join(" · ");
  const parts = [];
  if (row.duplicate?.kind === "file") {
    parts.push(`Same company as row ${row.duplicate.row}`);
  } else if (row.duplicate?.kind === "board") {
    const deal = row.duplicate.deal;
    const stage = STAGES.find((s) => s.id === deal.stage)?.label || deal.stage;
    parts.push(deal.owner ? `Already on the board — ${stage} · ${deal.owner}` : `Already on the board — ${stage}`);
  } else if (row.duplicate?.kind === "history") {
    parts.push("Dismissed earlier — see History");
  }
  parts.push(...row.warnings);
  return parts.join(" · ");
}

function setImportStep(step) {
  for (const [name, el] of Object.entries(importSteps)) {
    if (el) el.hidden = name !== step;
  }
}

function showImportError(message) {
  importFileError.textContent = message || "";
  importFileError.hidden = !message;
}

function importSelectableRows() {
  return importRows.filter((row) => row.status !== "error");
}

function renderImportSummary() {
  const counts = { new: 0, duplicate: 0, error: 0 };
  for (const row of importRows) counts[row.status]++;

  importSummaryEl.innerHTML = "";
  const chips = [
    { cls: "is-new", label: `${counts.new} new`, show: true },
    { cls: "is-duplicate", label: `${counts.duplicate} duplicate${counts.duplicate === 1 ? "" : "s"}`, show: counts.duplicate > 0 },
    { cls: "is-error", label: `${counts.error} error${counts.error === 1 ? "" : "s"}`, show: counts.error > 0 },
  ];
  for (const chip of chips) {
    if (!chip.show) continue;
    const el = document.createElement("span");
    el.className = `import-chip ${chip.cls}`;
    el.textContent = chip.label;
    importSummaryEl.appendChild(el);
  }

  const hints = [];
  if (counts.duplicate) hints.push("Duplicates are unticked — tick one to import it anyway.");
  if (counts.error) hints.push("Rows without a company name cannot be imported.");
  if (importTruncated) hints.push(`Only the first ${IMPORT_MAX_ROWS} rows were read.`);
  if (hints.length) {
    const hint = document.createElement("span");
    hint.className = "import-summary-hint";
    hint.textContent = hints.join(" ");
    importSummaryEl.appendChild(hint);
  }
}

function updateImportConfirmState() {
  const selected = importRows.filter((row) => row.include && row.status !== "error");
  importConfirmBtn.textContent = selected.length
    ? `Import ${selected.length} prospect${selected.length === 1 ? "" : "s"}`
    : "Import";
  importConfirmBtn.disabled = importBusy || !selected.length;

  const selectable = importSelectableRows();
  const checked = selectable.filter((row) => row.include).length;
  importSelectAll.disabled = importBusy || !selectable.length;
  importSelectAll.checked = Boolean(selectable.length) && checked === selectable.length;
  importSelectAll.indeterminate = checked > 0 && checked < selectable.length;
}

function renderImportPreview() {
  importPreviewBody.innerHTML = "";

  for (const row of importRows) {
    const tr = document.createElement("tr");
    tr.className = `import-row is-${row.status}`;

    const checkCell = document.createElement("td");
    checkCell.className = "import-col-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = row.include && row.status !== "error";
    checkbox.disabled = row.status === "error";
    checkbox.setAttribute("aria-label", `Import row ${row.rowNumber}`);
    checkbox.addEventListener("change", () => {
      row.include = checkbox.checked;
      tr.classList.toggle("is-excluded", !checkbox.checked);
      updateImportConfirmState();
    });
    checkCell.appendChild(checkbox);
    tr.classList.toggle("is-excluded", !checkbox.checked);

    const rowCell = document.createElement("td");
    rowCell.className = "import-col-row";
    rowCell.textContent = row.rowNumber;

    const companyCell = document.createElement("td");
    const companyName = document.createElement("span");
    companyName.className = "import-company";
    companyName.textContent = row.values.company || "—";
    companyCell.appendChild(companyName);
    const meta = [row.values.email, row.values.phone, row.values.industry, row.values.tool]
      .filter(Boolean)
      .join(" · ");
    if (meta) {
      const metaEl = document.createElement("span");
      metaEl.className = "import-cell-meta";
      metaEl.textContent = meta;
      companyCell.appendChild(metaEl);
    }

    const contactCell = document.createElement("td");
    contactCell.textContent = row.values.contact || "—";

    const ownerCell = document.createElement("td");
    ownerCell.textContent = resolveImportOwner(row.values.owner) || "—";

    const briefCell = document.createElement("td");
    briefCell.className = "import-col-brief";
    if (row.values.brief) {
      briefCell.textContent = row.values.brief;
      briefCell.title = row.values.brief;
    } else {
      briefCell.textContent = "—";
    }

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `import-badge is-${row.status}`;
    badge.textContent = importStatusLabel(row);
    statusCell.appendChild(badge);
    const detail = importStatusDetail(row);
    if (detail) {
      const detailEl = document.createElement("span");
      detailEl.className = "import-cell-meta";
      detailEl.textContent = detail;
      statusCell.appendChild(detailEl);
    }

    tr.append(checkCell, rowCell, companyCell, contactCell, ownerCell, briefCell, statusCell);
    importPreviewBody.appendChild(tr);
  }

  renderImportSummary();
  updateImportConfirmState();
}

function setImportProgress(done, total) {
  importProgressEl.hidden = false;
  const percent = total ? Math.round((done / total) * 100) : 0;
  importProgressBar.style.width = `${percent}%`;
  importProgressLabel.textContent = `Uploaded ${done} of ${total}`;
}

function setImportBusy(busy) {
  importBusy = busy;
  for (const id of ["importBackBtn", "importPreviewCancelBtn", "importCloseBtn", "importDoneBtn"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = busy;
  }
  importUndoBtn.disabled = busy;
  importDropZone.classList.toggle("is-busy", busy);
  updateImportConfirmState();
}

async function runImport() {
  if (importBusy) return;
  const rows = importRows.filter((row) => row.include && row.status !== "error");
  if (!rows.length) return;

  setImportBusy(true);
  importConfirmBtn.textContent = "Importing…";

  const baseOrder = nextBoardOrder("prospects");
  const created = rows.map((row, index) => {
    const createdAt = Date.now();
    const notes = [makeDealCreationNote(createdAt)];
    if (row.values.brief) {
      // +1ms so migrateDeals doesn't mistake the brief for the creation note.
      notes.push({
        id: crypto.randomUUID(),
        text: row.values.brief,
        createdAt: createdAt + 1,
        updatedAt: createdAt + 1,
        createdBy: stampCurrentUser(row.values.owner),
        updatedBy: stampCurrentUser(row.values.owner),
      });
    }
    return {
      id: crypto.randomUUID(),
      company: row.values.company,
      contact: row.values.contact || "",
      phone: row.values.phone || "",
      email: row.values.email || "",
      industry: row.values.industry || "",
      tool: row.values.tool || "",
      value: row.value != null ? row.value : DEFAULT_VALUE,
      owner: resolveImportOwner(row.values.owner),
      stage: "prospects",
      createdAt,
      boardOrder: baseOrder + index,
      notes,
      tasks: [],
    };
  });

  deals.push(...created);
  render();

  const ids = created.map((deal) => deal.id);
  const api = window.MHN_DB;
  let uploaded = 0;
  let syncError = null;

  if (api?.upsertDealsAsync) {
    setImportProgress(0, created.length);
    for (let i = 0; i < created.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = created.slice(i, i + IMPORT_CHUNK_SIZE);
      // Cloud rows are written one by one; keep realtime echoes from rebuilding mid-upload.
      suppressRemoteRefreshUntil = Date.now() + 5000;
      try {
        applySaveResult(await api.upsertDealsAsync(chunk, deals));
      } catch (err) {
        console.error(err);
        syncError = err;
        break;
      }
      uploaded += chunk.length;
      setImportProgress(uploaded, created.length);
    }
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  }

  suppressRemoteRefreshUntil = Date.now() + 1500;
  lastImport = { ids, count: created.length };
  setImportBusy(false);
  importProgressEl.hidden = true;
  render();

  const skipped = importRows.length - created.length;
  showImportResult({ created: created.length, skipped, syncError, uploaded });
}

function showImportResult({ created, skipped, syncError, uploaded }) {
  importResultEl.innerHTML = "";

  const headline = document.createElement("p");
  headline.className = "import-result-headline";
  headline.textContent = `${created} prospect${created === 1 ? "" : "s"} added to Prospects.`;
  importResultEl.appendChild(headline);

  const lines = [];
  if (skipped > 0) {
    lines.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped (duplicates or errors).`);
  }
  const api = window.MHN_DB;
  if (syncError) {
    lines.push(
      `${created - uploaded} card${created - uploaded === 1 ? "" : "s"} could not be uploaded — ` +
        "they are saved locally and will sync when the cloud reconnects."
    );
  } else if (api?.isRemote && api.cloudWriteAllowedByOrigin === false) {
    lines.push("Local / preview mode — the cards were not uploaded to the cloud.");
  } else if (api?.isRemote) {
    lines.push("All cards synced to the cloud.");
  }

  for (const text of lines) {
    const p = document.createElement("p");
    p.className = "import-result-line";
    p.textContent = text;
    importResultEl.appendChild(p);
  }

  importUndoBtn.hidden = !lastImport;
  importUndoBtn.textContent = "Undo this import";
  setImportStep("result");
}

async function undoLastImport() {
  if (!lastImport || importBusy) return;
  const { ids, count } = lastImport;

  setImportBusy(true);
  importUndoBtn.textContent = "Undoing…";

  const removing = new Set(ids);
  deals = deals.filter((deal) => !removing.has(deal.id));
  render();

  const api = window.MHN_DB;
  let failed = 0;
  if (api?.deleteDealAsync) {
    for (const id of ids) {
      suppressRemoteRefreshUntil = Date.now() + 5000;
      try {
        await api.deleteDealAsync(id, deals);
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  }

  suppressRemoteRefreshUntil = Date.now() + 1500;
  lastImport = null;
  setImportBusy(false);
  render();
  closeImportModal({ force: true });
  showSyncStatus(
    failed
      ? `Import undone locally — ${failed} card${failed === 1 ? "" : "s"} still pending removal in the cloud.`
      : `Import undone — ${count} card${count === 1 ? "" : "s"} removed.`,
    Boolean(failed),
    Boolean(failed)
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadImportTemplate() {
  const headers = IMPORT_COLUMNS.map((column) => column.label);
  const example = [
    "Acme GmbH",
    "Jane Doe",
    "+49 170 000 0000",
    "jane@acme.com",
    "Manufacturing",
    "Obsidian",
    getCurrentUserName(),
    "Met at the trade fair — wants a demo after summer.",
    String(DEFAULT_VALUE),
  ];

  try {
    const XLSX = await loadSheetJs();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, example]), "Prospects");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
    downloadBlob(
      "mhn-prospects-template.xlsx",
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
    return;
  } catch (err) {
    console.warn("Falling back to a CSV template:", err);
  }

  const csv = [headers, example].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadBlob(
    "mhn-prospects-template.csv",
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  );
}

async function handleImportFile(file) {
  if (!file || importBusy) return;
  showImportError("");

  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name || "")) {
    showImportError("Unsupported file type. Use .xlsx, .xls or .csv.");
    return;
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    showImportError("That file is over 5 MB. Split it into smaller batches.");
    return;
  }

  importDropZone.classList.add("is-busy");
  try {
    const { rows, truncated } = buildImportRows(await readSheetRows(file));
    if (!rows.length) {
      showImportError("No data rows found under the header row.");
      return;
    }
    importRows = classifyImportRows(rows);
    importTruncated = truncated;
    importFileNameEl.textContent = file.name;
    renderImportPreview();
    setImportStep("preview");
  } catch (err) {
    console.error(err);
    showImportError(err?.message || "Could not read that file.");
  } finally {
    importDropZone.classList.remove("is-busy");
    importFileInput.value = "";
  }
}

function resetImportState() {
  importRows = [];
  importTruncated = false;
  lastImport = null;
  importFileInput.value = "";
  importPreviewBody.innerHTML = "";
  importProgressEl.hidden = true;
  importProgressBar.style.width = "0%";
  showImportError("");
  setImportBusy(false);
}

function openImportModal() {
  resetImportState();
  const api = window.MHN_DB;
  importLocalWarning.hidden = !(api?.isRemote && api.cloudWriteAllowedByOrigin === false);
  setImportStep("file");
  importOverlay.hidden = false;
  importDropZone.focus();
}

function closeImportModal({ force = false } = {}) {
  if (importBusy && !force) return;
  importOverlay.hidden = true;
  resetImportState();
  setImportStep("file");
}

document.getElementById("importDealsBtn").addEventListener("click", openImportModal);
document.getElementById("importCloseBtn").addEventListener("click", () => closeImportModal());
document.getElementById("importCancelBtn").addEventListener("click", () => closeImportModal());
document.getElementById("importPreviewCancelBtn").addEventListener("click", () => closeImportModal());
document.getElementById("importDoneBtn").addEventListener("click", () => closeImportModal());
document.getElementById("importTemplateBtn").addEventListener("click", downloadImportTemplate);
document.getElementById("importBackBtn").addEventListener("click", () => {
  if (importBusy) return;
  resetImportState();
  setImportStep("file");
});
importConfirmBtn.addEventListener("click", runImport);
importUndoBtn.addEventListener("click", undoLastImport);

importOverlay.addEventListener("click", (e) => {
  if (e.target === importOverlay) closeImportModal();
});

importSelectAll.addEventListener("change", () => {
  const checked = importSelectAll.checked;
  for (const row of importSelectableRows()) row.include = checked;
  renderImportPreview();
});

importDropZone.addEventListener("click", () => importFileInput.click());
importDropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    importFileInput.click();
  }
});
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files?.[0];
  if (file) handleImportFile(file);
});

for (const type of ["dragenter", "dragover"]) {
  importDropZone.addEventListener(type, (e) => {
    e.preventDefault();
    importDropZone.classList.add("is-dragover");
  });
}
for (const type of ["dragleave", "dragend"]) {
  importDropZone.addEventListener(type, () => importDropZone.classList.remove("is-dragover"));
}
importDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  importDropZone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleImportFile(file);
});

/* ---------------------------- Knowledge ------------------------- */

const KNOWLEDGE_COLUMNS = [
  { key: "web", label: "Web", placeholder: "website" },
  { key: "founded", label: "Founded", placeholder: "year" },
  { key: "size", label: "Size", placeholder: "headcount" },
  { key: "valuation", label: "Valuation", placeholder: "valuation" },
  { key: "origin", label: "Origin", placeholder: "city or country" },
  { key: "market", label: "Market", placeholder: "market" },
  { key: "owners", label: "Owners", placeholder: "owners" },
];

const knowledgeBody = document.getElementById("knowledgeBody");
const knowledgeSearchInput = document.getElementById("knowledgeSearchInput");
const knowledgeSearchBubble = document.getElementById("knowledgeSearchBubble");
const knowledgeSearchClearBtn = document.getElementById("knowledgeSearchClearBtn");
const knowledgeAddBtn = document.getElementById("knowledgeAddBtn");

let knowledgeEntries = [];
let knowledgeSearchQuery = "";
const knowledgeExpanded = new Set();
const knowledgeDirty = new Set();
let knowledgeRenderKey = "";
let knowledgeSaveTimer = 0;
let knowledgeSaveInFlight = false;
let knowledgeRefreshQueued = false;
let knowledgeSaveChain = Promise.resolve();
let knowledgeWebEditingId = "";
let knowledgeWebFocus = false;
let knowledgeOwnerEditor = null;
let knowledgeOwnerFocus = false;

function knowledgeLinkUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const host = url.hostname;
  if (!host || host.includes("%") || (!host.includes(".") && host !== "localhost")) return "";
  return url.href;
}

function knowledgeOwnerList(value) {
  const parse = window.MHN_DB?.parseKnowledgeOwners;
  const list = typeof parse === "function" ? parse(value) : [];
  return list.map((owner) => ({ name: owner.name, url: owner.url }));
}

function knowledgeOwnerSearchText(value) {
  return knowledgeOwnerList(value)
    .map((owner) => `${owner.name} ${owner.url}`)
    .join("\n");
}

function knowledgeIcon(path, className) {
  const svg = createSvgEl("svg", {
    class: className,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
  });
  svg.appendChild(
    createSvgEl("path", {
      d: path,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

function knowledgeViewKey() {
  return JSON.stringify({
    q: knowledgeSearchQuery,
    open: [...knowledgeExpanded].sort(),
    webEdit: knowledgeWebEditingId,
    ownerEdit: knowledgeOwnerEditor,
    rows: knowledgeEntries.map((row) => [
      row.id,
      row.web,
      row.founded,
      row.size,
      row.valuation,
      row.origin,
      row.market,
      row.owners,
      row.notes,
    ]),
  });
}

function knowledgeSearchWords(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function knowledgeRowMatches(row, query) {
  const words = knowledgeSearchWords(query);
  if (!words.length) return true;
  const haystack = [
    row.web,
    row.founded,
    row.size,
    row.valuation,
    row.origin,
    row.market,
    knowledgeOwnerSearchText(row.owners),
    row.notes,
  ]
    .join("\n")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function enqueueKnowledgeWork(work) {
  knowledgeSaveChain = knowledgeSaveChain.then(work).catch((err) => {
    console.error(err);
  });
}

function scheduleKnowledgeSave(id) {
  if (id) knowledgeDirty.add(id);
  clearTimeout(knowledgeSaveTimer);
  knowledgeSaveTimer = setTimeout(() => {
    knowledgeSaveTimer = 0;
    enqueueKnowledgeWork(flushKnowledgeSave);
  }, 400);
}

async function flushKnowledgeSave() {
  const api = window.MHN_DB;
  const ids = [...knowledgeDirty];
  knowledgeDirty.clear();
  const rows = ids
    .map((id) => knowledgeEntries.find((row) => row.id === id))
    .filter(Boolean);
  knowledgeSaveInFlight = true;
  try {
    if (api?.saveKnowledgeAsync) await api.saveKnowledgeAsync(rows, knowledgeEntries);
    else api?.saveKnowledgeLocal?.(knowledgeEntries);
  } finally {
    knowledgeSaveInFlight = false;
    if (knowledgeRefreshQueued && !knowledgeDirty.size && !knowledgeSaveTimer) {
      knowledgeRefreshQueued = false;
      refreshKnowledgeFromRemote();
    }
  }
}

function persistKnowledgeNow() {
  clearTimeout(knowledgeSaveTimer);
  knowledgeSaveTimer = 0;
  window.MHN_DB?.saveKnowledgeLocal?.(knowledgeEntries);
  const rows = [...knowledgeDirty]
    .map((id) => knowledgeEntries.find((row) => row.id === id))
    .filter(Boolean);
  knowledgeDirty.clear();
  if (rows.length) window.MHN_DB?.saveKnowledgeAsync?.(rows, knowledgeEntries);
}

async function refreshKnowledgeFromRemote() {
  const api = window.MHN_DB;
  if (!api?.fetchKnowledgeAsync) return;
  if (knowledgeDirty.size || knowledgeSaveTimer || knowledgeSaveInFlight) {
    knowledgeRefreshQueued = true;
    return;
  }
  if (
    document.activeElement?.closest?.(".knowledge-table") ||
    document.activeElement?.closest?.(".knowledge-owner-form") ||
    knowledgeOwnerEditor
  ) {
    knowledgeRefreshQueued = true;
    return;
  }
  try {
    const remote = await api.fetchKnowledgeAsync();
    if (!Array.isArray(remote)) return;
    if (knowledgeDirty.size || knowledgeSaveInFlight || knowledgeSaveTimer) {
      knowledgeRefreshQueued = true;
      return;
    }
    knowledgeEntries = remote;
    knowledgeRenderKey = "";
    if (activeTab === "knowledge") renderKnowledge();
  } catch (err) {
    console.warn("Knowledge refresh failed:", err);
  }
}

function setKnowledgeSearch(value) {
  knowledgeSearchQuery = value;
  const hasQuery = value.trim().length > 0;
  updateSearchClearUi(knowledgeSearchBubble, knowledgeSearchClearBtn, hasQuery);
  if (!hasQuery) knowledgeSearchBubble?.classList.remove("has-query");
  knowledgeRenderKey = "";
  if (activeTab === "knowledge") renderKnowledge();
}

function addKnowledgeEntry() {
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    web: "",
    founded: "",
    size: "",
    valuation: "",
    origin: "",
    market: "",
    owners: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  knowledgeEntries.push(entry);
  if (knowledgeSearchInput && knowledgeSearchQuery) {
    knowledgeSearchInput.value = "";
    knowledgeSearchQuery = "";
    updateSearchClearUi(knowledgeSearchBubble, knowledgeSearchClearBtn, false);
    knowledgeSearchBubble?.classList.remove("has-query");
  }
  window.MHN_DB?.saveKnowledgeLocal?.(knowledgeEntries);
  scheduleKnowledgeSave(entry.id);
  knowledgeRenderKey = "";
  renderKnowledge();
  const input = knowledgeBody?.querySelector(
    `[data-knowledge-id="${entry.id}"][data-knowledge-field="web"]`
  );
  input?.focus();
}

function openKnowledgeDeleteModal(id) {
  const entry = knowledgeEntries.find((row) => row.id === id);
  if (!entry || !knowledgeDeleteOverlay) return;
  knowledgeDeleteId = id;
  const label = String(entry.web || "").trim();
  knowledgeDeleteLead.textContent = label
    ? `Are you sure you want to delete this entry “${label}”?`
    : "Are you sure you want to delete this entry?";
  knowledgeDeleteOverlay.hidden = false;
}

function closeKnowledgeDeleteModal() {
  knowledgeDeleteId = "";
  if (knowledgeDeleteOverlay) knowledgeDeleteOverlay.hidden = true;
}

function confirmKnowledgeDelete() {
  const id = knowledgeDeleteId;
  if (!id) return;
  closeKnowledgeDeleteModal();
  deleteKnowledgeEntry(id);
}

function deleteKnowledgeEntry(id) {
  const entry = knowledgeEntries.find((row) => row.id === id);
  if (!entry) return;
  knowledgeEntries = knowledgeEntries.filter((row) => row.id !== id);
  knowledgeExpanded.delete(id);
  knowledgeDirty.delete(id);
  knowledgeRenderKey = "";
  enqueueKnowledgeWork(async () => {
    const api = window.MHN_DB;
    knowledgeSaveInFlight = true;
    try {
      if (api?.deleteKnowledgeAsync) await api.deleteKnowledgeAsync(id, knowledgeEntries);
      else api?.saveKnowledgeLocal?.(knowledgeEntries);
    } finally {
      knowledgeSaveInFlight = false;
    }
  });
  renderKnowledge();
}

function fitKnowledgeNotes(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const border = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + border}px`;
}

function touchKnowledgeEntry(entry) {
  entry.updatedAt = new Date().toISOString();
  window.MHN_DB?.saveKnowledgeLocal?.(knowledgeEntries);
  scheduleKnowledgeSave(entry.id);
}

function renderKnowledgeWebCell(td, row) {
  const value = String(row.web || "");
  const editing = knowledgeWebEditingId === row.id || !value.trim();
  if (editing) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "knowledge-cell-input";
    input.value = value;
    input.placeholder = "website";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Web");
    input.dataset.knowledgeId = row.id;
    input.dataset.knowledgeField = "web";
    td.appendChild(input);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "knowledge-web";
  const href = knowledgeLinkUrl(value);
  const label = href ? document.createElement("a") : document.createElement("span");
  label.className = href ? "knowledge-web-link" : "knowledge-web-text";
  label.textContent = value.trim();
  if (href) {
    label.href = href;
    label.target = "_blank";
    label.rel = "noopener noreferrer";
    label.title = href;
  }
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "knowledge-inline-btn";
  editBtn.dataset.knowledgeAction = "web-edit";
  editBtn.dataset.knowledgeId = row.id;
  editBtn.setAttribute("aria-label", "Edit website");
  editBtn.appendChild(knowledgeIcon("M11.2 2.6a1.5 1.5 0 0 1 2.1 2.1L5.7 12.3 2.6 13.4l1.1-3.1 7.5-7.7z", "knowledge-inline-icon"));
  wrap.append(label, editBtn);
  td.appendChild(wrap);
}

function renderKnowledgeOwnersCell(td, row) {
  const people = knowledgeOwnerList(row.owners);
  const wrap = document.createElement("div");
  wrap.className = "knowledge-owners";
  const names = document.createElement("div");
  names.className = "knowledge-owner-names";
  people.forEach((owner) => {
    const chip = document.createElement("span");
    chip.className = "knowledge-owner";
    const href = knowledgeLinkUrl(owner.url);
    const name = href ? document.createElement("a") : document.createElement("span");
    name.className = href ? "knowledge-owner-link" : "knowledge-owner-name";
    name.textContent = owner.name;
    name.title = href || owner.name;
    if (href) {
      name.href = href;
      name.target = "_blank";
      name.rel = "noopener noreferrer";
    }
    chip.appendChild(name);
    names.appendChild(chip);
  });
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "knowledge-inline-btn knowledge-owners-edit";
  editBtn.dataset.knowledgeAction = "owner-edit";
  editBtn.dataset.knowledgeId = row.id;
  editBtn.setAttribute("aria-label", "Edit owners");
  editBtn.appendChild(knowledgeIcon("M11.2 2.6a1.5 1.5 0 0 1 2.1 2.1L5.7 12.3 2.6 13.4l1.1-3.1 7.5-7.7z", "knowledge-inline-icon"));
  wrap.append(names, editBtn);
  td.appendChild(wrap);
}

function closeKnowledgeOwnerEditor() {
  knowledgeOwnerEditor = null;
  document.querySelector(".knowledge-owner-form")?.remove();
  knowledgeRenderKey = "";
  renderKnowledge();
}

function appendKnowledgeOwnerDraft(list, person) {
  const row = document.createElement("div");
  row.className = "knowledge-owner-form-person";
  const nameRow = document.createElement("div");
  nameRow.className = "knowledge-owner-form-name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "knowledge-owner-input";
  nameInput.placeholder = "Name";
  nameInput.setAttribute("aria-label", "Owner name");
  nameInput.dataset.ownerInput = "name";
  nameInput.value = person?.name || "";
  nameInput.autocomplete = "off";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "knowledge-inline-btn knowledge-owner-remove";
  removeBtn.setAttribute("aria-label", person?.name ? `Remove ${person.name}` : "Remove owner");
  removeBtn.appendChild(knowledgeIcon("M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5", "knowledge-inline-icon"));
  removeBtn.addEventListener("click", () => {
    row.remove();
    placeKnowledgeOwnerPopup();
  });
  nameRow.append(nameInput, removeBtn);
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "knowledge-owner-input";
  urlInput.placeholder = "LinkedIn or X URL";
  urlInput.setAttribute("aria-label", "Owner profile URL");
  urlInput.dataset.ownerInput = "url";
  urlInput.value = person?.url || "";
  urlInput.autocomplete = "off";
  row.append(nameRow, urlInput);
  list.appendChild(row);
  return nameInput;
}

function mountKnowledgeOwnerPopup() {
  document.querySelector(".knowledge-owner-form")?.remove();
  const rowId = knowledgeOwnerEditor;
  if (!rowId) return;
  const entry = knowledgeEntries.find((row) => row.id === rowId);
  if (!entry) {
    knowledgeOwnerEditor = null;
    return;
  }
  const people = knowledgeOwnerList(entry.owners);
  const form = document.createElement("form");
  form.className = "knowledge-owner-form";
  form.dataset.knowledgeId = entry.id;
  const list = document.createElement("div");
  list.className = "knowledge-owner-form-list";
  const drafts = people.length ? people : [{}];
  drafts.forEach((person) => appendKnowledgeOwnerDraft(list, person));
  const error = document.createElement("p");
  error.className = "knowledge-owner-error";
  error.hidden = true;
  const actions = document.createElement("div");
  actions.className = "knowledge-owner-form-actions";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost btn-sm";
  addBtn.textContent = "Add owner";
  addBtn.addEventListener("click", () => {
    const nameInput = appendKnowledgeOwnerDraft(list, {});
    placeKnowledgeOwnerPopup();
    nameInput.focus();
  });
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn btn-primary btn-sm";
  saveBtn.textContent = "Save";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-ghost btn-sm";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => closeKnowledgeOwnerEditor());
  actions.append(addBtn, saveBtn, cancelBtn);
  form.append(list, error, actions);
  form.addEventListener("input", () => {
    error.hidden = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveKnowledgeOwnerForm(form);
  });
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeKnowledgeOwnerEditor();
  });
  document.body.appendChild(form);
  placeKnowledgeOwnerPopup();
}

function placeKnowledgeOwnerPopup() {
  const form = document.querySelector(".knowledge-owner-form");
  const editor = knowledgeOwnerEditor;
  if (!form || !editor || !knowledgeBody) return;
  const anchor = knowledgeBody.querySelector(
    `[data-knowledge-action="owner-edit"][data-knowledge-id="${CSS.escape(editor)}"]`
  );
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const width = form.offsetWidth || 240;
  const height = form.offsetHeight || 148;
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;
  form.style.top = `${Math.round(top)}px`;
  form.style.left = `${Math.round(left)}px`;
}

function saveKnowledgeOwnerForm(form) {
  const id = form.dataset.knowledgeId;
  const entry = knowledgeEntries.find((row) => row.id === id);
  const error = form.querySelector(".knowledge-owner-error");
  if (!entry) return;
  const people = [];
  const rows = [...form.querySelectorAll(".knowledge-owner-form-person")];
  for (const row of rows) {
    const name = row.querySelector("[data-owner-input='name']")?.value.trim() || "";
    const urlRaw = row.querySelector("[data-owner-input='url']")?.value.trim() || "";
    if (!name && !urlRaw) continue;
    if (!name) {
      error.hidden = false;
      error.textContent = "Enter a name.";
      row.querySelector("[data-owner-input='name']")?.focus();
      return;
    }
    const url = urlRaw ? knowledgeLinkUrl(urlRaw) : "";
    if (urlRaw && !url) {
      error.hidden = false;
      error.textContent = "Use an https link, such as a LinkedIn or X profile.";
      row.querySelector("[data-owner-input='url']")?.focus();
      return;
    }
    people.push({ name, url });
  }
  entry.owners = people;
  touchKnowledgeEntry(entry);
  knowledgeOwnerEditor = null;
  knowledgeRenderKey = "";
  renderKnowledge();
}

function renderKnowledge() {
  if (!knowledgeBody) return;
  const key = knowledgeViewKey();
  if (key === knowledgeRenderKey && knowledgeBody.childElementCount) return;

  const active = document.activeElement;
  const focusId = active?.dataset?.knowledgeId || "";
  const focusField = active?.dataset?.knowledgeField || "";
  const selStart = typeof active?.selectionStart === "number" ? active.selectionStart : null;
  const selEnd = typeof active?.selectionEnd === "number" ? active.selectionEnd : null;
  const previousWrap = knowledgeBody.querySelector(".knowledge-table-wrap");
  const scrollTop = previousWrap?.scrollTop || 0;
  const scrollLeft = previousWrap?.scrollLeft || 0;

  knowledgeBody.replaceChildren();

  const visible = knowledgeEntries.filter((row) => knowledgeRowMatches(row, knowledgeSearchQuery));
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "knowledge-empty";
    empty.textContent = knowledgeEntries.length
      ? "No entries match that search."
      : "No entries yet. Add one to start.";
    knowledgeBody.appendChild(empty);
    knowledgeRenderKey = key;
    document.querySelector(".knowledge-owner-form")?.remove();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "knowledge-table-wrap";
  const table = document.createElement("table");
  table.className = "knowledge-table";
  table.setAttribute("aria-label", "Knowledge");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const expandHead = document.createElement("th");
  expandHead.scope = "col";
  expandHead.className = "knowledge-col-expand";
  const expandHeadLabel = document.createElement("span");
  expandHeadLabel.className = "visually-hidden";
  expandHeadLabel.textContent = "Notes";
  expandHead.appendChild(expandHeadLabel);
  headRow.appendChild(expandHead);
  for (const column of KNOWLEDGE_COLUMNS) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = `knowledge-col knowledge-col-${column.key}`;
    th.textContent = column.label;
    headRow.appendChild(th);
  }
  const deleteHead = document.createElement("th");
  deleteHead.scope = "col";
  deleteHead.className = "knowledge-col-delete";
  const deleteHeadLabel = document.createElement("span");
  deleteHeadLabel.className = "visually-hidden";
  deleteHeadLabel.textContent = "Delete";
  deleteHead.appendChild(deleteHeadLabel);
  headRow.appendChild(deleteHead);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of visible) {
    const open = knowledgeExpanded.has(row.id);
    const dataRow = document.createElement("tr");
    dataRow.className = open ? "is-open" : "";
    dataRow.dataset.knowledgeId = row.id;

    const expandCell = document.createElement("td");
    expandCell.className = "knowledge-col-expand";
    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "knowledge-expand";
    expandBtn.dataset.knowledgeAction = "expand";
    expandBtn.dataset.knowledgeId = row.id;
    expandBtn.setAttribute("aria-expanded", open ? "true" : "false");
    expandBtn.setAttribute("aria-label", open ? "Hide notes" : "Show notes");
    const icon = createSvgEl("svg", {
      class: "knowledge-expand-icon",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
    });
    icon.appendChild(
      createSvgEl("path", {
        d: "M4 6.5 8 10.5 12 6.5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.6",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );
    expandBtn.appendChild(icon);
    expandCell.appendChild(expandBtn);
    dataRow.appendChild(expandCell);

    for (const column of KNOWLEDGE_COLUMNS) {
      const td = document.createElement("td");
      td.className = `knowledge-col knowledge-col-${column.key}`;
      if (column.key === "web") renderKnowledgeWebCell(td, row);
      else if (column.key === "owners") renderKnowledgeOwnersCell(td, row);
      else {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "knowledge-cell-input";
        input.value = row[column.key] || "";
        input.placeholder = column.placeholder;
        input.autocomplete = "off";
        input.setAttribute("aria-label", column.label);
        input.dataset.knowledgeId = row.id;
        input.dataset.knowledgeField = column.key;
        td.appendChild(input);
      }
      dataRow.appendChild(td);
    }

    const deleteCell = document.createElement("td");
    deleteCell.className = "knowledge-col-delete";
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "knowledge-delete";
    deleteBtn.dataset.knowledgeAction = "delete";
    deleteBtn.dataset.knowledgeId = row.id;
    deleteBtn.setAttribute("aria-label", "Delete entry");
    const trash = createSvgEl("svg", {
      class: "knowledge-delete-icon",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
    });
    const trashStroke = {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    };
    trash.append(
      createSvgEl("path", { ...trashStroke, d: "M3.2 4.4h9.6" }),
      createSvgEl("path", { ...trashStroke, d: "M6.4 4.4V3.3a.7.7 0 0 1 .7-.7h1.8a.7.7 0 0 1 .7.7v1.1" }),
      createSvgEl("path", { ...trashStroke, d: "M4.4 4.4l.55 8.1a.9.9 0 0 0 .9.8h4.3a.9.9 0 0 0 .9-.8l.55-8.1" }),
      createSvgEl("path", { ...trashStroke, d: "M6.7 7v3.4M9.3 7v3.4" })
    );
    deleteBtn.appendChild(trash);
    deleteCell.appendChild(deleteBtn);
    dataRow.appendChild(deleteCell);
    tbody.appendChild(dataRow);

    if (open) {
      const notesRow = document.createElement("tr");
      notesRow.className = "knowledge-notes-row";
      const notesCell = document.createElement("td");
      notesCell.colSpan = KNOWLEDGE_COLUMNS.length + 2;
      const notes = document.createElement("textarea");
      notes.className = "knowledge-notes";
      notes.rows = 1;
      notes.placeholder = "Notes";
      notes.value = row.notes || "";
      notes.setAttribute("aria-label", "Notes");
      notes.dataset.knowledgeId = row.id;
      notes.dataset.knowledgeField = "notes";
      notesCell.appendChild(notes);
      notesRow.appendChild(notesCell);
      tbody.appendChild(notesRow);
    }
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  knowledgeBody.appendChild(wrap);
  knowledgeRenderKey = key;
  wrap.scrollTop = scrollTop;
  wrap.scrollLeft = scrollLeft;
  wrap.querySelectorAll(".knowledge-notes").forEach(fitKnowledgeNotes);

  if (focusId && focusField) {
    const next = knowledgeBody.querySelector(
      `[data-knowledge-id="${focusId}"][data-knowledge-field="${focusField}"]`
    );
    if (next) {
      next.focus({ preventScroll: true });
      if (selStart != null && typeof next.setSelectionRange === "function") {
        try {
          next.setSelectionRange(selStart, selEnd);
        } catch {
          /* ignore inputs that reject a selection */
        }
      }
    }
  }
  if (knowledgeWebFocus) {
    knowledgeWebFocus = false;
    const webInput = knowledgeBody.querySelector(
      `[data-knowledge-id="${CSS.escape(knowledgeWebEditingId)}"][data-knowledge-field="web"]`
    );
    webInput?.focus();
    webInput?.select();
  }
  mountKnowledgeOwnerPopup();
  if (knowledgeOwnerFocus) {
    knowledgeOwnerFocus = false;
    document.querySelector(".knowledge-owner-form [data-owner-input='name']")?.focus();
  }
}

function wireKnowledgeSearch() {
  if (!knowledgeSearchInput) return;
  knowledgeSearchInput.addEventListener("input", () => setKnowledgeSearch(knowledgeSearchInput.value));
  knowledgeSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && knowledgeSearchInput.value) {
      event.preventDefault();
      event.stopPropagation();
      knowledgeSearchInput.value = "";
      setKnowledgeSearch("");
    }
  });
  knowledgeSearchInput.addEventListener("focus", () => {
    expandSearch({
      bubble: knowledgeSearchBubble,
      input: knowledgeSearchInput,
      clearBtn: knowledgeSearchClearBtn,
    });
  });
  knowledgeSearchInput.addEventListener("blur", () => {
    if (!knowledgeSearchInput.value) {
      knowledgeSearchBubble?.classList.remove("is-expanded", "is-expanded-settled");
    }
  });
  knowledgeSearchClearBtn?.addEventListener("click", () => {
    knowledgeSearchInput.value = "";
    setKnowledgeSearch("");
    knowledgeSearchInput.focus({ preventScroll: true });
  });
  knowledgeSearchBubble?.addEventListener("pointerdown", (event) => {
    if (isMobileViewport() && !knowledgeSearchBubble.classList.contains("is-expanded")) {
      event.preventDefault();
      expandSearch({
        bubble: knowledgeSearchBubble,
        input: knowledgeSearchInput,
        clearBtn: knowledgeSearchClearBtn,
      });
    }
  });
  updateSearchClearUi(knowledgeSearchBubble, knowledgeSearchClearBtn, false);
}

if (knowledgeBody) {
  knowledgeBody.addEventListener("input", (event) => {
    const field = event.target?.dataset?.knowledgeField;
    const id = event.target?.dataset?.knowledgeId;
    if (!field || !id || field === "owners") return;
    const entry = knowledgeEntries.find((row) => row.id === id);
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, field)) return;
    entry[field] = event.target.value;
    entry.updatedAt = new Date().toISOString();
    if (field === "notes") fitKnowledgeNotes(event.target);
    knowledgeRenderKey = knowledgeViewKey();
    window.MHN_DB?.saveKnowledgeLocal?.(knowledgeEntries);
    scheduleKnowledgeSave(id);
  });

  knowledgeBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-knowledge-action]");
    if (!button || !knowledgeBody.contains(button)) return;
    const id = button.dataset.knowledgeId;
    if (!id) return;
    if (button.dataset.knowledgeAction === "expand") {
      const opening = !knowledgeExpanded.has(id);
      knowledgeExpanded.clear();
      if (opening) knowledgeExpanded.add(id);
      knowledgeRenderKey = "";
      renderKnowledge();
      if (opening) {
        const notes = knowledgeBody.querySelector(
          `[data-knowledge-id="${id}"][data-knowledge-field="notes"]`
        );
        notes?.focus();
      }
    } else if (button.dataset.knowledgeAction === "delete") {
      openKnowledgeDeleteModal(id);
    } else if (button.dataset.knowledgeAction === "web-edit") {
      knowledgeWebEditingId = id;
      knowledgeWebFocus = true;
      knowledgeRenderKey = "";
      renderKnowledge();
    } else if (button.dataset.knowledgeAction === "owner-edit") {
      knowledgeOwnerEditor = id;
      knowledgeOwnerFocus = true;
      knowledgeRenderKey = "";
      renderKnowledge();
    }
  });

  knowledgeBody.addEventListener("focusout", (event) => {
    if (event.target?.dataset?.knowledgeField !== "web") return;
    const id = event.target.dataset.knowledgeId;
    if (knowledgeWebEditingId === id) knowledgeWebEditingId = "";
    const entry = knowledgeEntries.find((row) => row.id === id);
    if (!String(entry?.web || "").trim()) return;
    knowledgeRenderKey = "";
    setTimeout(() => {
      if (knowledgeWebEditingId === id) return;
      renderKnowledge();
    }, 0);
  });

  knowledgeBody.addEventListener("focusout", () => {
    if (!knowledgeRefreshQueued) return;
    requestAnimationFrame(() => {
      if (document.activeElement?.closest?.(".knowledge-table")) return;
      if (document.activeElement?.closest?.(".knowledge-owner-form")) return;
      if (!knowledgeRefreshQueued || knowledgeDirty.size || knowledgeSaveTimer || knowledgeSaveInFlight) return;
      knowledgeRefreshQueued = false;
      refreshKnowledgeFromRemote();
    });
  });

  knowledgeBody.addEventListener("scroll", () => {
    if (knowledgeOwnerEditor) placeKnowledgeOwnerPopup();
  }, { passive: true });
}

document.addEventListener("pointerdown", (event) => {
  if (!knowledgeOwnerEditor) return;
  if (event.target.closest?.(".knowledge-owner-form, .knowledge-owners-edit")) return;
  knowledgeOwnerEditor = null;
  knowledgeRenderKey = "";
  setTimeout(() => renderKnowledge(), 0);
});

knowledgeAddBtn?.addEventListener("click", addKnowledgeEntry);
document.getElementById("knowledgeDeleteConfirmBtn")?.addEventListener("click", confirmKnowledgeDelete);
document.getElementById("knowledgeDeleteCancelBtn")?.addEventListener("click", closeKnowledgeDeleteModal);
document.getElementById("knowledgeDeleteCloseBtn")?.addEventListener("click", closeKnowledgeDeleteModal);
knowledgeDeleteOverlay?.addEventListener("click", (event) => {
  if (event.target === knowledgeDeleteOverlay) closeKnowledgeDeleteModal();
});
wireKnowledgeSearch();
window.addEventListener("pagehide", persistKnowledgeNow);

/* ------------------------------ Tabs ---------------------------- */

const navShell = document.getElementById("navShell");
const navBurgerBtn = document.getElementById("navBurgerBtn");

function closeNavMenu() {
  if (!navShell) return;
  navShell.classList.remove("is-open");
  if (navBurgerBtn) {
    navBurgerBtn.setAttribute("aria-expanded", "false");
    navBurgerBtn.setAttribute("aria-label", "Open navigation menu");
  }
}

function toggleNavMenu() {
  if (!navShell || !navBurgerBtn) return;
  const willOpen = !navShell.classList.contains("is-open");
  navShell.classList.toggle("is-open", willOpen);
  navBurgerBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  navBurgerBtn.setAttribute("aria-label", willOpen ? "Close navigation menu" : "Open navigation menu");
}

if (navBurgerBtn) {
  navBurgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNavMenu();
  });
}

document.addEventListener("click", (e) => {
  if (!navShell || !navShell.classList.contains("is-open")) return;
  if (!navShell.contains(e.target)) closeNavMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navShell?.classList.contains("is-open")) closeNavMenu();
  if (e.key === "Escape") closeActionsMenu();
});

const topbarActions = document.getElementById("topbarActions");
const topbarActionsPanel = document.getElementById("topbarActionsPanel");
const actionsBurgerBtn = document.getElementById("actionsBurgerBtn");

function closeActionsMenu() {
  if (!topbarActions || !actionsBurgerBtn) return;
  topbarActions.classList.remove("is-open");
  actionsBurgerBtn.setAttribute("aria-expanded", "false");
  actionsBurgerBtn.setAttribute("aria-label", "Open menu");
}

function toggleActionsMenu() {
  if (!topbarActions || !actionsBurgerBtn) return;
  const willOpen = !topbarActions.classList.contains("is-open");
  topbarActions.classList.toggle("is-open", willOpen);
  actionsBurgerBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  actionsBurgerBtn.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
}

if (actionsBurgerBtn) {
  actionsBurgerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeNavMenu();
    toggleActionsMenu();
  });
}

topbarActionsPanel?.addEventListener("click", (e) => {
  if (e.target.closest("button")) closeActionsMenu();
});

document.addEventListener("click", (e) => {
  if (!topbarActions?.classList.contains("is-open")) return;
  if (!topbarActions.contains(e.target)) closeActionsMenu();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    hideTasksPipelineTooltip();
    hidePipelineTooltip();
    closeAllSearchSuggestions();
    activeTab = tab.dataset.tab;
    if (activeTab === "pipeline") {
      // Opening Production always recenters on today so the lookback + future span is clear.
      pipelineViewportStartMs = null;
    }
    if (activeTab === "tasks" && tasksViewMode === "pipeline") {
      tasksViewportStartMs = null;
    }
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.hidden = v.id !== `view-${activeTab}`;
    });
    closeNavMenu();
    closeActionsMenu();
    render();
  });
});

/* Prevent pinch-zoom, card-drag scroll theft, and iOS rubber-band bounce */
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    if (dragState && dragState.activated) {
      e.preventDefault();
      return;
    }
    if (!touchScrollGuard || e.touches.length !== 1) return;

    const target = touchScrollGuard.target;
    if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

    const t = e.touches[0];
    const dx = t.clientX - touchScrollGuard.x;
    const dy = t.clientY - touchScrollGuard.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Let a real pan start. Blocking the first pixels cancels the gesture on iOS,
    // which made swipes that began on a deal or task feel stuck.
    if (absX < 8 && absY < 8) {
      if (!hasScrollableAxis(target, "x") && !hasScrollableAxis(target, "y")) e.preventDefault();
      return;
    }

    const axis = absX > absY ? "x" : "y";
    const delta = axis === "x" ? dx : dy;
    if (scrollableAncestor(target, axis, delta)) return;

    // Nothing under the finger can take this pan — block the page rubber-band.
    e.preventDefault();
  },
  { passive: false, capture: true }
);

// Desktop trackpad / wheel: never bounce empty columns or the board vertically.
// A sideways swipe that starts on a deal is swallowed by the column (overflow
// hidden), so the board has to take that delta itself.
if (boardEl) {
  boardEl.addEventListener(
    "wheel",
    (e) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (e.shiftKey || absX > absY) {
        const delta = absX > absY ? e.deltaX : e.deltaY;
        if (!delta || boardEl.scrollWidth <= boardEl.clientWidth + 1) return;
        e.preventDefault();
        boardEl.scrollLeft += delta;
        return;
      }
      const body = e.target.closest?.(".column-body");
      if (columnBodyCanScroll(body, -e.deltaY)) return;
      e.preventDefault();
    },
    { passive: false }
  );
}

if (pipelineChartEl) {
  pipelineChartEl.addEventListener(
    "scroll",
    () => {
      hidePipelineTooltip();
      rememberPipelineScroll();
    },
    { passive: true }
  );
  pipelineChartEl.addEventListener(
    "wheel",
    (e) => {
      hidePipelineTooltip();
      const canScrollX = pipelineChartEl.scrollWidth > pipelineChartEl.clientWidth + 1;
      const canScrollY = pipelineChartEl.scrollHeight > pipelineChartEl.clientHeight + 1;
      if (!canScrollX) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        pipelineChartEl.scrollLeft += e.deltaX;
        return;
      }
      if (canScrollY && !e.shiftKey) return;
      e.preventDefault();
      pipelineChartEl.scrollLeft += e.deltaY;
    },
    { passive: false }
  );
}
if (pipelinePeriodLength) {
  pipelinePeriodLength.addEventListener("change", () => {
    pipelineState.periodMonths = Number(pipelinePeriodLength.value) || 1;
    pipelineViewportStartMs = null;
    render();
  });
}

async function bootstrap() {
  const auth = window.MHN_AUTH;

  if (!auth?.isConfigured?.()) {
    showLoginScreen();
    setAuthMessage({
      error: "Supabase is not configured. Add your project URL and anon key in config.js.",
    });
    return;
  }

  try {
    const user = await auth.getCurrentAuthUser();
    if (!user) {
      showLoginScreen();
      return;
    }
    applyAuthUser(user);
    await startApp();
    maybePromptProfileName();
  } catch (err) {
    console.error(err);
    showLoginScreen();
    setAuthMessage({ error: "Could not restore your session. Please log in again." });
  }

  auth.onAuthStateChange((user) => {
    if (!user) {
      applyAuthUser(null);
      return;
    }
    // Keep chip/name in sync if metadata changes; don't restart the app mid-session.
    if (currentUser?.id === user.id) {
      currentUser = {
        id: user.id,
        email: user.email || "",
        name: user.name || "",
        needsName: Boolean(user.needsName),
      };
      updateUserChip();
    }
  });
}

async function startApp() {
  if (appStarted) {
    render();
    return;
  }
  appStarted = true;

  const api = window.MHN_DB;

  // Banner based on origin, even before hydration
  if (api?.isRemote && api.cloudWriteAllowedByOrigin === false) {
    showCloudReadOnlyBanner();
  }

  if (api?.loadDealsAsync) {
    try {
      deals = await api.loadDealsAsync();
      showLoadSyncStatus(api);
    } catch (err) {
      console.error(err);
      deals = loadDeals();
      showSyncStatus(
        "Cloud sync unavailable — using local data. Edits won’t upload until reconnect.",
        true,
        true
      );
    }
  } else {
    deals = loadDeals();
  }

  if (api?.loadKnowledgeAsync) {
    try {
      const loaded = await api.loadKnowledgeAsync();
      // Keep rows created in the moment before cloud load finished.
      if (!knowledgeEntries.length) {
        knowledgeEntries = loaded;
      } else {
        const seen = new Set(knowledgeEntries.map((row) => row.id));
        knowledgeEntries = [...loaded.filter((row) => !seen.has(row.id)), ...knowledgeEntries];
      }
    } catch (err) {
      console.error(err);
      if (!knowledgeEntries.length) knowledgeEntries = api.loadKnowledgeLocal?.() || [];
    }
  }

  // Persist migrate fixes only when origin allows writes AND cloud is hydrated
  migrateDeals({ persist: Boolean(api?.cloudWriteEnabled) });
  initPipelinePeriod();
  render();

  if (api?.subscribeToDealChanges) {
    api.subscribeToDealChanges(() => {
      if (syncingFromRemote) return;
      refreshDealsFromRemote();
    });
  }

  if (api?.subscribeToKnowledgeChanges) {
    api.subscribeToKnowledgeChanges(() => {
      refreshKnowledgeFromRemote();
    });
  }
}

loginForm.addEventListener("submit", handleLoginSubmit);
signupForm.addEventListener("submit", handleSignupSubmit);
nameForm?.addEventListener("submit", handleNameSubmit);
nameCloseBtn?.addEventListener("click", closeNameModal);
nameCancelBtn?.addEventListener("click", closeNameModal);
nameOverlay?.addEventListener("click", (e) => {
  if (e.target === nameOverlay) closeNameModal();
});
editNameBtn?.addEventListener("click", () => openNameModal({ required: false }));
editNameMenuBtn?.addEventListener("click", () => {
  closeNavMenu();
  openNameModal({ required: false });
});
logoutBtn.addEventListener("click", () => {
  logout();
});
document.getElementById("logoutMenuBtn")?.addEventListener("click", () => {
  closeNavMenu();
  logout();
});

Object.assign(window.MHN_AUTH, {
  getCurrentUserName,
  getCurrentUser: () => (currentUser ? { ...currentUser } : null),
});

bootstrap();
