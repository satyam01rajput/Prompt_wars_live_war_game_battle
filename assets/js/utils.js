// ============================================================
// Prompt Wars — Shared Utilities
// ============================================================

// ── Error Messages ──────────────────────────────────────────
var ERROR_MESSAGES = {
  "AUTH_FAILED":          "Session error. Please re-register.",
  "ROUND_CLOSED":         "This round is now closed.",
  "ALREADY_SUBMITTED":    "You have already submitted for this round.",
  "WRONG_ROUND":          "Round mismatch. Please refresh the page.",
  "IMAGE_TOO_LARGE":      "Image is too large. Please try a smaller image.",
  "DRIVE_SAVE_FAILED":    "Upload failed. Please try again.",
  "LOCK_TIMEOUT":         "Server busy. Please try again in a moment.",
  "MISSING_FIELDS":       "Please fill in all required fields.",
  "EMAIL_ALREADY_EXISTS": "This email is already registered. Use the device you registered on.",
  "REGISTRATION_FULL":    "Registrations are closed.",
  "ROUND_NOT_FOUND":      "Round data not found. Contact the organiser.",
  "UNAUTHORIZED":         "Incorrect password.",
  "COOLDOWN_ACTIVE":      "Please wait before switching your vote.",
  "ROUND_NOT_CLOSED":     "Close the round before revealing results.",
  "SHEETS_READ_FAILED":   "Connection error. Please refresh the page.",
  "INVALID_STATUS":       "Invalid status value.",
  "INVALID_POLL_MODE":    "Invalid poll mode value.",
  "INVALID_MODE":         "Invalid reveal mode.",
  "INVALID_ACTION":       "This action is not available on the server.",
  "INVALID_JSON":         "Bad request format sent to server.",
  "INVALID_ROUND_TYPE":   "This action is not allowed for the current round type.",
  "INVALID_VOTE":         "Invalid vote option. Please choose A or B.",
  "NOT_SECRET_MODE":      "Reveal is only available in secret poll mode."
};

// ── API Call ─────────────────────────────────────────────────
async function callAPI(body) {
  try {
    // Keep this as a "simple request" to avoid OPTIONS preflight on Apps Script.
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      mode: "cors"
    });
    return await parseJsonResponse(res);
  } catch (e) {
    return { success: false, error: "SHEETS_READ_FAILED" };
  }
}

async function callAPIGet(params) {
  try {
    const url = API_URL + "?" + new URLSearchParams(params).toString();
    const res = await fetch(url, { redirect: "follow", mode: "cors" });
    return await parseJsonResponse(res);
  } catch (e) {
    return { success: false, error: "SHEETS_READ_FAILED" };
  }
}

async function callLeaderboard(password) {
  // Primary contract: GET leaderboard.
  var res = await callAPIGet({ action: "leaderboard", password: password });
  // Compatibility fallback for deployments that route leaderboard via POST.
  if (!res.success && res.error === "INVALID_ACTION") {
    res = await callAPI({ action: "leaderboard", password: password });
  }
  return res;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { success: false, error: "SHEETS_READ_FAILED", detail: "NON_JSON_RESPONSE" };
  }
}

// ── Auth Helpers ─────────────────────────────────────────────
function getAuth() {
  return {
    teamId: localStorage.getItem("pw_teamId"),
    authToken: localStorage.getItem("pw_authToken")
  };
}

function isRegistered() {
  return !!localStorage.getItem("pw_teamId") &&
    !!localStorage.getItem("pw_authToken");
}

function getTeamName() {
  return localStorage.getItem("pw_teamName") || "Your Team";
}

// ── Submission Helpers ───────────────────────────────────────
function hasSubmittedRound(round) {
  var submitted = JSON.parse(localStorage.getItem("pw_submittedRounds") || "[]");
  return submitted.indexOf(round) !== -1;
}

function markRoundSubmitted(round) {
  var submitted = JSON.parse(localStorage.getItem("pw_submittedRounds") || "[]");
  if (submitted.indexOf(round) === -1) submitted.push(round);
  localStorage.setItem("pw_submittedRounds", JSON.stringify(submitted));
}

// ── Vote Helpers ─────────────────────────────────────────────
function getVoteForRound(round) {
  var voted = JSON.parse(localStorage.getItem("pw_votedRounds") || "{}");
  return voted[String(round)] || null;
}

function setVoteForRound(round, vote) {
  var voted = JSON.parse(localStorage.getItem("pw_votedRounds") || "{}");
  voted[String(round)] = vote;
  localStorage.setItem("pw_votedRounds", JSON.stringify(voted));
}

// ── Image Compression ────────────────────────────────────────
function compressImage(file, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      var max = 800;
      var w = img.width, h = img.height;
      if (w > h && w > max) { h = h * max / w; w = max; }
      else if (h > max) { w = w * max / h; h = max; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Toast Notification ───────────────────────────────────────
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  toast.innerHTML = "<span class=\"toast-icon\">" + (icons[type] || "ℹ") + "</span><span class=\"toast-msg\">" + message + "</span>";
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

function createToastContainer() {
  const c = document.createElement("div");
  c.id = "toast-container";
  document.body.appendChild(c);
  return c;
}

function getErrorMessage(code) {
  return ERROR_MESSAGES[code] || "An unexpected error occurred.";
}
