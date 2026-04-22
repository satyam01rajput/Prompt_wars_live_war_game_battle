# Prompt Wars — API Contract

## Overview

One Apps Script Web App URL handles all requests.
GET requests for reads. POST requests for writes.
All POST bodies are JSON. All responses are JSON.
CORS is open — Apps Script handles this automatically.

The base URL looks like:
`https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

Store this URL in a single constant in a `config.js` file
that all frontend pages import. Never hardcode it inline.

```javascript
// config.js
var API_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";
```

---

## General Rules

### Authentication
Every write endpoint except `register` and `checkEmail` requires:
- `teamId` — string, e.g. "T001"
- `authToken` — string, 16-char alphanumeric

If either is missing or does not match the Teams tab, the response is:
```json
{ "success": false, "error": "AUTH_FAILED" }
```
HTTP status is always 200. Errors are in the response body, not HTTP codes.
Apps Script always returns 200. Check `success` field, not HTTP status.

### Admin endpoints
Require `adminPassword` matching Config tab A2.
If wrong or missing:
```json
{ "success": false, "error": "UNAUTHORIZED" }
```

### Round status enforcement
All write endpoints check Control tab status before processing.
If status = "closed":
```json
{ "success": false, "error": "ROUND_CLOSED" }
```
This check happens after auth check, before any other logic.

### Error codes
All error values are uppercase strings with underscores.
Frontend switches on these strings to show user-friendly messages.
Full list at bottom of this document.

---

## GET Endpoints

### GET ?action=status

Returns current round state. Called every 5 seconds by participant page.
Cached in Apps Script CacheService with 3 second TTL.

**Request:**
```
GET {API_URL}?action=status
No parameters required.
```

**Response:**
```json
{
  "success": true,
  "roundNumber": 1,
  "roundType": "image",
  "status": "open",
  "pollMode": "majority",
  "eventName": "Prompt Wars"
}
```

**Field notes:**
- `roundNumber`: integer, current round from Control A2
- `roundType`: "image" or "poll"
- `status`: "open" or "closed"
- `pollMode`: "majority", "minority", or "secret"
  Only relevant when roundType = "poll"
- `eventName`: string from Config J2, shown in page header

**Never returns error** — if Sheets read fails, returns:
```json
{ "success": false, "error": "SHEETS_READ_FAILED" }
```

---

### GET ?action=roundinfo&round=N

Returns full data for a specific round from the Rounds tab.
Called when participant page detects a round change.

**Request:**
```
GET {API_URL}?action=roundinfo&round=2
```
`round` is an integer as a string in the query param.

**Response for image round:**
```json
{
  "success": true,
  "roundNumber": 2,
  "roundType": "image",
  "referenceUrl": "https://i.imgur.com/example.jpg",
  "promptText": "A robot attending a college lecture"
}
```

**Response for poll round:**
```json
{
  "success": true,
  "roundNumber": 3,
  "roundType": "poll",
  "pollQuestion": "Android vs iPhone?",
  "optionA": "Android",
  "optionB": "iPhone"
}
```

**Error response (round number not found in Rounds tab):**
```json
{ "success": false, "error": "ROUND_NOT_FOUND" }
```

---

### GET ?action=pollresults&round=N

Returns live vote counts for a poll round.
Called every 3 seconds by participant page during poll rounds.
Public endpoint — no auth required.

**Request:**
```
GET {API_URL}?action=pollresults&round=3
```

**Response:**
```json
{
  "success": true,
  "round": 3,
  "countA": 14,
  "countB": 7,
  "total": 21
}
```

**Field notes:**
- Counts include all votes for that round regardless of Is Final flag.
  Live counts show real-time vote state, not just final votes.
- `total` is countA + countB.
- Returns zero counts if no votes yet, never returns error for empty.

```json
{ "success": true, "round": 3, "countA": 0, "countB": 0, "total": 0 }
```

---

### GET ?action=leaderboard&password=XXXX

Returns full leaderboard. Password protected.
Only called by leaderboard.html and admin.html.

**Request:**
```
GET {API_URL}?action=leaderboard&password=YourPasswordHere
```

**Response:**
```json
{
  "success": true,
  "lastUpdated": "2025-04-15T10:32:00.000Z",
  "leaderboard": [
    { "rank": 1, "teamName": "Team Alpha", "totalPoints": 185 },
    { "rank": 2, "teamName": "Team Beta",  "totalPoints": 150 },
    { "rank": 3, "teamName": "Team Gamma", "totalPoints": 120 }
  ]
}
```

**Error (wrong password):**
```json
{ "success": false, "error": "UNAUTHORIZED" }
```

---

## POST Endpoints

All POST requests use this fetch pattern on the frontend:

```javascript
async function callAPI(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await res.json();
}
```

---

### POST register

Registers a new team. No auth required.

**Request body:**
```json
{
  "action": "register",
  "teamName": "Team Alpha",
  "member1": "Rahul Sharma",
  "member2": "Priya Patel",
  "member3": "",
  "email": "rahul@example.com"
}
```

**Field rules:**
- `teamName`: required, non-empty string
- `member1`: required, non-empty string
- `member2`: optional, can be empty string
- `member3`: optional, can be empty string
- `email`: required, stored lowercase, must be unique

**Success response:**
```json
{
  "success": true,
  "teamId": "T003",
  "authToken": "aB3kR7mNqX2pLwY9"
}
```

**Error responses:**
```json
{ "success": false, "error": "MISSING_FIELDS" }
{ "success": false, "error": "EMAIL_ALREADY_EXISTS" }
{ "success": false, "error": "REGISTRATION_FULL" }
{ "success": false, "error": "LOCK_TIMEOUT" }
```

**Frontend must:**
- Store teamId, authToken, email in localStorage immediately on success
- Never show authToken to the user
- Show REGISTRATION_FULL as "Registrations are closed"
- Show EMAIL_ALREADY_EXISTS as "This email is already registered.
  Use the same device you registered on."

---

### POST checkEmail

Checks if an email is registered. Used on registration page load
to detect returning users on same device without full re-registration.

**Request body:**
```json
{
  "action": "checkEmail",
  "email": "rahul@example.com"
}
```

**Success response (email found):**
```json
{
  "success": true,
  "exists": true,
  "teamId": "T003"
}
```

**Success response (email not found):**
```json
{
  "success": true,
  "exists": false
}
```

**IMPORTANT:** This endpoint never returns authToken.
If a user exists but has no localStorage (different device),
they cannot submit. Frontend shows:
"You're registered! Please use the device you originally registered on."

---

### POST submitImage

Submits a compressed base64 image for the current round.

**Request body:**
```json
{
  "action": "submitImage",
  "teamId": "T003",
  "authToken": "aB3kR7mNqX2pLwY9",
  "round": 2,
  "imageData": "base64stringhere...",
  "mimeType": "image/jpeg"
}
```

**Field rules:**
- `imageData`: base64 encoded image, no data URL prefix.
  Must be stripped: send only the part after "base64,"
- `mimeType`: "image/jpeg" or "image/png"
- `round`: integer, must match current round in Control tab
- Max image size after base64 decode: 500KB. Apps Script rejects larger.

**Success response:**
```json
{
  "success": true,
  "submissionId": "S007"
}
```

**Error responses:**
```json
{ "success": false, "error": "AUTH_FAILED" }
{ "success": false, "error": "ROUND_CLOSED" }
{ "success": false, "error": "ALREADY_SUBMITTED" }
{ "success": false, "error": "WRONG_ROUND" }
{ "success": false, "error": "IMAGE_TOO_LARGE" }
{ "success": false, "error": "DRIVE_SAVE_FAILED" }
{ "success": false, "error": "LOCK_TIMEOUT" }
```

**Field notes:**
- ALREADY_SUBMITTED: team already has a row in Submissions for this round
- WRONG_ROUND: `round` in body does not match Control tab current round
- DRIVE_SAVE_FAILED: DriveApp write failed, student should retry

**Frontend must:**
- Compress image before sending (see compression function in README)
- Disable submit button immediately on click
- Show loading state during upload (can take 3-8 seconds on mobile)
- On success: store round number in localStorage submittedRounds array
- On ALREADY_SUBMITTED: treat as success, show confirmation
- On DRIVE_SAVE_FAILED: re-enable button, show "Upload failed, please try again"
- On ROUND_CLOSED: show "Round is closed, submission not accepted"

---

### POST submitVote

Submits or switches a vote for the current poll round.
Can be called multiple times per round (vote switching).
Server enforces 5 second cooldown between calls.

**Request body:**
```json
{
  "action": "submitVote",
  "teamId": "T003",
  "authToken": "aB3kR7mNqX2pLwY9",
  "round": 3,
  "vote": "A",
  "timestamp": 1744700400000
}
```

**Field rules:**
- `vote`: exactly "A" or "B", capital letter
- `timestamp`: client-side Unix timestamp in milliseconds (Date.now())
- `round`: integer, must match current round in Control tab

**Success response:**
```json
{
  "success": true,
  "recorded": "A"
}
```

**Error responses:**
```json
{ "success": false, "error": "AUTH_FAILED" }
{ "success": false, "error": "ROUND_CLOSED" }
{ "success": false, "error": "WRONG_ROUND" }
{ "success": false, "error": "COOLDOWN_ACTIVE", "remainingMs": 3200 }
{ "success": false, "error": "LOCK_TIMEOUT" }
```

**Field notes:**
- COOLDOWN_ACTIVE: includes remainingMs so frontend can show accurate countdown
- Every call appends a new row to Poll Votes tab (full history kept)
- Is Final column is always FALSE when written here.
  Apps Script sets TRUE in batch when host closes round.

**Frontend must:**
- Enforce 5 second cooldown UI (countdown on button)
- On COOLDOWN_ACTIVE: use remainingMs to set accurate countdown
- Store current vote per round in localStorage votedRounds object
- On page refresh: restore vote button state from localStorage

---

### POST setControl

Admin endpoint. Changes round number, status, or poll mode in Control tab.

**Request body:**
```json
{
  "action": "setControl",
  "adminPassword": "YourPasswordHere",
  "round": 3,
  "status": "open",
  "pollMode": "majority"
}
```

**Field rules:**
- All three of round, status, pollMode are optional.
  Send only the fields you want to change.
- `round`: integer
- `status`: "open" or "closed"
- `pollMode`: "majority", "minority", or "secret"

**When status changes to "closed" for a poll round:**
Apps Script automatically runs finalisePollVotes() which sets
Is Final = TRUE on the last vote row for each team in that round.
This happens synchronously before the response is returned.

**When status changes to "closed" for an image round:**
No automatic action. Gemini scoring runs on its own 60-second trigger.

**Success response:**
```json
{
  "success": true,
  "round": 3,
  "status": "open",
  "pollMode": "majority"
}
```

**Error responses:**
```json
{ "success": false, "error": "UNAUTHORIZED" }
{ "success": false, "error": "INVALID_STATUS" }
{ "success": false, "error": "INVALID_POLL_MODE" }
```

---

### POST revealPoll

Admin endpoint. Sets Poll Reveal value and immediately runs poll scoring.
Only used for secret rounds after voting closes.

**Request body:**
```json
{
  "action": "revealPoll",
  "adminPassword": "YourPasswordHere",
  "round": 3,
  "mode": "majority"
}
```

**Field rules:**
- `mode`: "majority" or "minority" — the actual winning mode being revealed
- Round must be closed before calling this. If status = open, rejected.

**Success response:**
```json
{
  "success": true,
  "round": 3,
  "mode": "majority",
  "scoresSaved": 18
}
```

**Field notes:**
- `scoresSaved`: number of team score rows written
- After this call, Leaderboard tab is rebuilt automatically

**Error responses:**
```json
{ "success": false, "error": "UNAUTHORIZED" }
{ "success": false, "error": "ROUND_NOT_CLOSED" }
{ "success": false, "error": "INVALID_MODE" }
```

---

### POST rescoreRound

Admin endpoint. Resets all error-status submissions in a round to pending
so the Gemini trigger picks them up again on next run.

**Request body:**
```json
{
  "action": "rescoreRound",
  "adminPassword": "YourPasswordHere",
  "round": 2
}
```

**Success response:**
```json
{
  "success": true,
  "requeued": 3
}
```

**Field notes:**
- `requeued`: number of submissions reset to pending
- If requeued = 0, no error submissions existed for that round
- Gemini trigger runs within 60 seconds after this

**Error responses:**
```json
{ "success": false, "error": "UNAUTHORIZED" }
```

---

## Gemini Scoring (Internal — not called by frontend)

This is a time-based Apps Script trigger. Not an API endpoint.
Documented here so AI working on Apps Script knows the full picture.

**Trigger:** Time-based, every 60 seconds.

**What it does:**
1. Acquires LockService script lock (waits up to 10 seconds).
2. Reads all rows from Submissions where column H = "pending".
3. For each pending row:

   a. Gets reference URL from Rounds tab using the round number.

   b. Calls Gemini Vision API:
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_KEY
   
   Body:
   {
     "contents": [{
       "parts": [
         { "inlineData": { "mimeType": "image/jpeg", "data": "base64_of_submitted_image" } },
         { "inlineData": { "mimeType": "image/jpeg", "data": "base64_of_reference_image" } },
         { "text": "Compare these two images. Return ONLY a raw JSON object with one key called score containing an integer from 0 to 100 representing how closely the first image matches the second image visually and thematically. No markdown, no explanation, no other text. Example output: {\"score\": 72}" }
       ]
     }]
   }
   ```

   c. Parse response safely:
   ```javascript
   try {
     var raw = geminiResponse.getContentText()
                             .trim()
                             .replace(/```json|```/g, '')
                             .trim();
     var parsed = JSON.parse(raw);
     var score = parseInt(parsed.score);
     if (isNaN(score) || score < 0 || score > 100) throw new Error('invalid');
   } catch(e) {
     // retry once after 2000ms
     Utilities.sleep(2000);
     // if retry also fails:
     score = 5;
     status = "error";
   }
   ```

   d. Convert score to points using Config tab values:
   ```javascript
   var points;
   if (score >= 80) points = configPtsHigh;
   else if (score >= 60) points = configPtsMid;
   else if (score >= 40) points = configPtsLow;
   else points = configPtsBase;
   ```

   e. Write to Scores tab (one row per team per round).
   f. Update Submission row: set Score, Scored At, Status = "scored".

4. After all pending rows processed, call updateLeaderboard() once.
5. Release lock.

**Note on fetching reference image for Gemini:**
Apps Script cannot directly pass a URL to Gemini as an image.
It must fetch the image bytes and encode to base64:
```javascript
var refBlob = UrlFetchApp.fetch(referenceUrl).getBlob();
var refBase64 = Utilities.base64Encode(refBlob.getBytes());
```
Same for the submitted image — fetch it from Drive URL.

---

## Poll Scoring (Internal — runs on round close)

Called automatically when setControl changes status to "closed"
for a poll round, and also when revealPoll is called.

**What it does:**
1. Reads all Poll Votes rows where Round = current round AND Is Final = TRUE.
2. Counts total votes for A and total votes for B.
3. Determines winning side:
   - If Poll Mode = "majority": side with more votes wins
   - If Poll Mode = "minority": side with fewer votes wins
   - If Poll Mode = "secret": use Poll Reveal value from Control tab
4. Gets points value from Config tab (F2 for majority/minority, G2 for secret).
5. For each team that voted for the winning side:
   - Write row to Scores tab with their points.
6. For each team that voted for the losing side:
   - Write row to Scores tab with 0 points and detail "voted losing side".
7. For registered teams that did not vote:
   - Write row to Scores tab with 0 points and detail "did not vote".
8. Call updateLeaderboard().

---

## Frontend Error Message Map

Frontend switches on these error codes to show plain English messages.

```javascript
var ERROR_MESSAGES = {
  "AUTH_FAILED":          "Session error. Please re-register.",
  "ROUND_CLOSED":         "This round is now closed.",
  "ALREADY_SUBMITTED":    "You have already submitted for this round.",
  "WRONG_ROUND":          "Round mismatch. Refresh the page.",
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
  "SHEETS_READ_FAILED":   "Connection error. Refresh the page.",
  "INVALID_STATUS":       "Invalid status value.",
  "INVALID_POLL_MODE":    "Invalid poll mode value.",
  "INVALID_MODE":         "Invalid reveal mode."
};
```

---

## Polling Intervals (Frontend)

| Page             | Endpoint     | Interval  | Why                              |
|------------------|--------------|-----------|----------------------------------|
| participant.html | status       | 5 seconds | Detect round open/close changes  |
| participant.html | pollresults  | 3 seconds | Live bar chart during poll rounds|
| admin.html       | status       | 5 seconds | Show current state to host       |
| leaderboard.html | leaderboard  | 10 seconds| Projector display refresh        |

Stop polling pollresults when status = "closed".
Stop polling status when page is hidden (Page Visibility API).

---

## localStorage Schema

All keys are prefixed with "pw_" to avoid conflicts.

```javascript
// Set at registration. Never changes.
localStorage.setItem("pw_teamId",    "T003");
localStorage.setItem("pw_authToken", "aB3kR7mNqX2pLwY9");
localStorage.setItem("pw_email",     "rahul@example.com");
localStorage.setItem("pw_teamName",  "Team Alpha");

// Updated after each image submission.
// Value is JSON array of round numbers.
localStorage.setItem("pw_submittedRounds", JSON.stringify([1, 2]));

// Updated after each vote.
// Value is JSON object: { "3": "A", "6": "B" }
localStorage.setItem("pw_votedRounds", JSON.stringify({ "3": "A" }));

// Updated after each round result is shown.
// Value is JSON object with last result details.
localStorage.setItem("pw_lastResult", JSON.stringify({
  round: 2,
  type: "image",
  score: 74,
  points: 35
}));
```

**Helper functions to include in a shared utils.js:**

```javascript
function getAuth() {
  return {
    teamId:    localStorage.getItem("pw_teamId"),
    authToken: localStorage.getItem("pw_authToken")
  };
}

function isRegistered() {
  return !!localStorage.getItem("pw_teamId") &&
         !!localStorage.getItem("pw_authToken");
}

function hasSubmittedRound(round) {
  var submitted = JSON.parse(localStorage.getItem("pw_submittedRounds") || "[]");
  return submitted.indexOf(round) !== -1;
}

function markRoundSubmitted(round) {
  var submitted = JSON.parse(localStorage.getItem("pw_submittedRounds") || "[]");
  if (submitted.indexOf(round) === -1) submitted.push(round);
  localStorage.setItem("pw_submittedRounds", JSON.stringify(submitted));
}

function getVoteForRound(round) {
  var voted = JSON.parse(localStorage.getItem("pw_votedRounds") || "{}");
  return voted[String(round)] || null;
}

function setVoteForRound(round, vote) {
  var voted = JSON.parse(localStorage.getItem("pw_votedRounds") || "{}");
  voted[String(round)] = vote;
  localStorage.setItem("pw_votedRounds", JSON.stringify(voted));
}
```

---

## File Structure

```
project/
  config.js          — API_URL constant only
  utils.js           — localStorage helpers, callAPI function, error map
  index.html         — Registration page
  participant.html   — Round view
  admin.html         — Admin control panel
  leaderboard.html   — Projector leaderboard
  style.css          — Shared styles
```

Every HTML page imports in this order:
```html
<script src="config.js"></script>
<script src="utils.js"></script>
```
