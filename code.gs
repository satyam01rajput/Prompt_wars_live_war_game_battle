var SHEET_TEAMS = "Teams";
var MAX_TOKEN_LENGTH = 16;
var SHEET_SUBMISSIONS = "Submissions";
var DRIVE_ROOT_FOLDER = "Prompt Wars Event";
var SHEET_VOTES = "Poll Votes";
var SHEET_SCORES = "Scores";
var SHEET_LEADERBOARD = "Leaderboard";

// Commit / Risk round config
var COMMIT_BASE_POINTS = 20;

// Run these test function whenever adding the appsScript to a new account

function testDriveAccess() {
  var root = DriveApp.getFoldersByName("Prompt Wars Event").next();
  
  // FORCE write permission
  var blob = Utilities.newBlob("test", "text/plain", "test.txt");
  var file = root.createFile(blob);
  
  Logger.log(file.getUrl());
}

function debugAddScore(teamId, round, points) {
  var sheet = getSheet(SHEET_SCORES);

  sheet.appendRow([
    teamId,
    round,
    "manual",
    points,
    "debug"
  ]);

  updateLeaderboard();
}

function processPollResults(round, overrideMode, forceReprocess) {
  var votesSheet = getSheet(SHEET_VOTES);
  var scoresSheet = getSheet(SHEET_SCORES);
  var control = getControl();
  var existing = scoresSheet.getDataRange().getValues();

  if (!forceReprocess) {
    for (var i = 1; i < existing.length; i++) {
      if (existing[i][1] == round && existing[i][2] === "poll") {
        return 0; // already processed
      }
    }
  }

  var data = votesSheet.getDataRange().getValues();

  var finalVotes = {};

  // Get LAST vote per team
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] != round) continue;

    var teamId = data[i][1];
    finalVotes[teamId] = data[i][3]; // overwrite → last wins
  }

  var countA = 0, countB = 0;

  for (var t in finalVotes) {
    if (finalVotes[t] === "A") countA++;
    if (finalVotes[t] === "B") countB++;
  }

  var winning;

  var mode = overrideMode || (control.pollMode === "secret"
    ? control.pollReveal
    : control.pollMode);

  if (countA === countB) {
    winning = "tie";
  } else if (mode === "majority") {
    winning = countA > countB ? "A" : "B";
  } else if (mode === "minority") {
    winning = countA < countB ? "A" : "B";
  }

  var saved = 0;
  for (var teamId in finalVotes) {
    var vote = finalVotes[teamId];

    var points;
    if (winning === "tie") {
      points = 25;
    } else {
      points = (vote === winning) ? 50 : 0;
    }

    scoresSheet.appendRow([
      teamId,
      round,
      "poll",
      points,
      vote
    ]);
    saved++;
  }

  updateLeaderboard();
  return saved;
}

function processCommitResults(round, overrideMode, forceReprocess) {
  var votesSheet = getSheet(SHEET_VOTES);
  var scoresSheet = getSheet(SHEET_SCORES);
  var control = getControl();
  var existing = scoresSheet.getDataRange().getValues();

  if (!forceReprocess) {
    for (var i = 1; i < existing.length; i++) {
      if (existing[i][1] == round && existing[i][2] === "commit") {
        return 0; // already processed
      }
    }
  }

  var data = votesSheet.getDataRange().getValues();
  var finalVotes = {};

  // Step 1: Get last vote per team
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] != round) continue;
    var teamId = data[i][1];
    finalVotes[teamId] = data[i][3]; // overwrite → last wins
  }

  var countA = 0;
  var countB = 0;

  // Step 2: Count A/B votes (ignore NO_COMMIT)
  for (var teamId in finalVotes) {
    var val = finalVotes[teamId];
    if (!val) continue;
    if (val === "NO_COMMIT") continue;

    // Accept either "A|sure" or "A" (defensive)
    var vote = String(val).split("|")[0];
    if (vote === "A") countA++;
    if (vote === "B") countB++;
  }

  // Step 3: Determine winner
  var winning;
  var mode = overrideMode || (control.pollMode === "secret"
    ? control.pollReveal
    : control.pollMode);

  if (countA === countB) {
    winning = "tie";
  } else if (mode === "majority") {
    winning = countA > countB ? "A" : "B";
  } else if (mode === "minority") {
    winning = countA < countB ? "A" : "B";
  } else {
    // Fallback to majority if mode not set (e.g. secret before reveal)
    winning = countA > countB ? "A" : "B";
  }

  // Step 4: Assign points
  var saved = 0;
  for (var teamId in finalVotes) {
    var val = finalVotes[teamId];
    var points = 0;

    if (!val || val === "NO_COMMIT" || winning === "tie") {
      points = 0;
    } else {
      var parts = String(val).split("|");
      var vote = parts[0];
      var confidence = parts[1] || "not_sure";
      var multiplier = (confidence === "sure") ? 2 : 1;

      if (vote === winning) {
        points = COMMIT_BASE_POINTS * multiplier;
      } else {
        points = -COMMIT_BASE_POINTS * multiplier;
      }
    }

    scoresSheet.appendRow([
      teamId,
      round,
      "commit",
      points,
      val
    ]);
    saved++;
  }

  updateLeaderboard();
  return saved;
}

function convertDriveUrl(url) {
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return url;

  var fileId = match[1];
  return "https://drive.google.com/uc?export=download&id=" + fileId;
}

function callGemini(payloadObj) {
  var configSheet = getSheet(SHEET_CONFIG);
  var geminiKey = String(configSheet.getRange(2, 9).getValue() || "").trim();
  if (!geminiKey) throw new Error("MISSING_GEMINI_KEY");
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

  var payload = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payloadObj),
    muteHttpExceptions: true
  };

  for (var attempt = 0; attempt < 2; attempt++) {
    var res = UrlFetchApp.fetch(url, payload);
    var code = res.getResponseCode();
    var text = res.getContentText();

    if (code === 200) return text;

    // Retry on quota / temporary errors
    if (code === 429 || code >= 500) {
      Utilities.sleep(2000);
      continue;
    }

    throw new Error("Gemini error: " + text);
  }

  throw new Error("Gemini failed after retries");
}

function scorePendingSubmissions() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEET_SUBMISSIONS);
    var data = sheet.getDataRange().getValues();
    var scoresSheet = getSheet(SHEET_SCORES);

    var processed = 0;
    var MAX_PER_RUN = 3; // prevent quota burst

    for (var i = 1; i < data.length; i++) {
      if (processed >= MAX_PER_RUN) break;

      var status = data[i][7];
      if (status !== "pending") continue;

      var submissionId = data[i][0];
      var teamId = data[i][1];
      var round = data[i][2];
      var imageUrl = data[i][3];

      var roundInfo = getRoundInfo(round);
      if (!roundInfo || !roundInfo.referenceUrl) {
        sheet.getRange(i + 1, 8).setValue("error");
        sheet.getRange(i + 1, 9).setValue("MISSING_REFERENCE");
        continue;
      }

      var refUrl = roundInfo.referenceUrl;

      try {
        // ✅ Convert Drive URLs
        var cleanImageUrl = convertDriveUrl(imageUrl);
        var cleanRefUrl   = convertDriveUrl(refUrl);

        // ✅ Fetch images
        var imgBlob = UrlFetchApp.fetch(cleanImageUrl).getBlob();
        var refBlob = UrlFetchApp.fetch(cleanRefUrl).getBlob();

        var imgBase64 = Utilities.base64Encode(imgBlob.getBytes());
        var refBase64 = Utilities.base64Encode(refBlob.getBytes());

        // ✅ Rate limit (VERY IMPORTANT)
        Utilities.sleep(1500);

        // ✅ Call Gemini (with retry)
        var raw = callGemini({
          contents: [{
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: imgBase64 } },
              { inlineData: { mimeType: "image/jpeg", data: refBase64 } },
              {
                text: "Compare these two images. Return ONLY JSON: {\"score\": number from 0 to 100}"
              }
            ]
          }]
        });

        var outer = JSON.parse(raw);

        // Extract actual model text
        var text = outer.candidates[0].content.parts[0].text;

        // Clean it (in case of markdown)
        var cleaned = text
          .replace(/```json|```/g, "")
          .replace(/[^\{]*\{/, "{")
          .replace(/\}[^\}]*$/, "}")
          .trim();

        // Parse actual JSON
        var parsed = JSON.parse(cleaned);

        var score = parseInt(parsed.score);

        if (isNaN(score) || score < 0 || score > 100) {
          throw new Error("Invalid score: " + text);
        }

        var points = calculatePoints(score);

        // ✅ Save score
        scoresSheet.appendRow([
          teamId,
          round,
          submissionId,
          points,
          score
        ]);

        // ✅ Update submission
        sheet.getRange(i + 1, 6).setValue(score);
        sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 8).setValue("scored");

        processed++;

      } catch (err) {
        var fallbackScore = Math.floor(Math.random() * 30) + 40; // 40–70 safe
        var points = calculatePoints(fallbackScore);

        scoresSheet.appendRow([
          teamId,
          round,
          submissionId,
          points,
          fallbackScore
        ]);

        sheet.getRange(i + 1, 6).setValue(fallbackScore);
        sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 8).setValue("fallback");
        sheet.getRange(i + 1, 9).setValue(err.toString());
      }
    }

    updateLeaderboard();

  } finally {
    lock.releaseLock();
  }
}

function calculatePoints(score) {
  var config = getConfigPoints();

  if (score >= 80) return config.high;
  if (score >= 60) return config.mid;
  if (score >= 40) return config.low;
  return config.base;
}

function getConfigPoints() {
  var sheet = getSheet(SHEET_CONFIG);
  // Config B:E = image score thresholds (high/mid/low/base)
  var row = sheet.getRange(2, 2, 1, 4).getValues()[0];

  return {
    high: row[0],
    mid: row[1],
    low: row[2],
    base: row[3]
  };
}

function updateLeaderboard() {
  var teamsSheet = getSheet(SHEET_TEAMS);
  var scoresSheet = getSheet(SHEET_SCORES);
  var leaderboardSheet = getSheet(SHEET_LEADERBOARD);

  var teamsData = teamsSheet.getDataRange().getValues();
  var scoresData = scoresSheet.getDataRange().getValues();

  var teamPoints = {};

  // Initialize teams
  for (var i = 1; i < teamsData.length; i++) {
    var teamId = teamsData[i][0];
    var teamName = teamsData[i][1];

    teamPoints[teamId] = {
      name: teamName,
      points: 0
    };
  }

  // Sum scores
  for (var i = 1; i < scoresData.length; i++) {
    var teamId = scoresData[i][0];
    var points = parseInt(scoresData[i][3]) || 0;

    if (teamPoints[teamId]) {
      teamPoints[teamId].points += points;
    }
  }

  // Convert to array
  var arr = [];
  for (var id in teamPoints) {
    arr.push({
      teamId: id,
      teamName: teamPoints[id].name,
      totalPoints: teamPoints[id].points
    });
  }

  // Sort descending
  arr.sort(function(a, b) {
    return b.totalPoints - a.totalPoints;
  });

  // Clear old leaderboard
  leaderboardSheet.clearContents();
  leaderboardSheet.appendRow(["Rank", "Team Name", "Total Points", "Last Updated"]);

  var now = new Date().toISOString();

  // Write new leaderboard
  for (var i = 0; i < arr.length; i++) {
    leaderboardSheet.appendRow([
      i + 1,
      arr[i].teamName,
      arr[i].totalPoints,
      now
    ]);
  }
}

function isAdmin(password) {
  var sheet = getSheet(SHEET_CONFIG);
  var realPassword = sheet.getRange(2, 1).getValue();
  return password === realPassword;
}

function validateAuth(teamId, authToken) {
  var sheet = getSheet(SHEET_TEAMS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === teamId && data[i][6] === authToken) {
      return true;
    }
  }
  return false;
}

function getRoundFolder(round) {
  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER);
  if (!folders.hasNext()) {
    throw new Error("ROOT_FOLDER_NOT_FOUND");
  }
  var root = folders.next();
  var folderName = "Round " + round;

  var folders = root.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();

  return null;
}

function generateToken(length) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var token = "";
  for (var i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function findTeamByEmail(email) {
  var sheet = getSheet(SHEET_TEAMS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][5] && data[i][5].toLowerCase() === email.toLowerCase()) {
      return data[i];
    }
  }
  return null;
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === "status") {
    try {
      var control = getControl();
      var config  = getConfig();

      return jsonResponse({
        success: true,
        roundNumber: control.roundNumber,
        roundType: control.roundType,
        status: control.status,
        pollMode: control.pollMode,
        eventName: config.eventName
      });

    } catch (err) {
      return jsonResponse({
        success: false,
        error: "SHEETS_READ_FAILED"
      });
    }
  }

  if (action === "roundinfo") {
    var round = parseInt(e.parameter.round);

    if (!round) {
      return jsonResponse({ success: false, error: "ROUND_NOT_FOUND" });
    }

    var info = getRoundInfo(round);

    if (!info) {
      return jsonResponse({ success: false, error: "ROUND_NOT_FOUND" });
    }

    if (info.roundType === "image") {
      return jsonResponse({
        success: true,
        roundNumber: info.roundNumber,
        roundType: "image",
        referenceUrl: info.referenceUrl,
        promptText: info.promptText
      });
    }

    if (info.roundType === "poll" || info.roundType === "commit") {
      return jsonResponse({
        success: true,
        roundNumber: info.roundNumber,
        roundType: info.roundType,
        pollQuestion: info.pollQuestion,
        optionA: info.optionA,
        optionB: info.optionB
      });
    }

    return jsonResponse({ success: false, error: "INVALID_ROUND_TYPE" });
  }

  if (action === "leaderboard") {
    var password = e.parameter.password;

    if (!isAdmin(password)) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" });
    }

    var sheet = getSheet(SHEET_LEADERBOARD);
    var data = sheet.getDataRange().getValues();

    var result = [];

    for (var i = 1; i < data.length; i++) {
      result.push({
        rank: data[i][0],
        teamName: data[i][1],
        totalPoints: data[i][2]
      });
    }

    return jsonResponse({
      success: true,
      lastUpdated: data.length > 1 ? data[1][3] : null,
      leaderboard: result
    });
  }

  if (action === "pollresults") {
    var round = parseInt(e.parameter.round, 10);
    if (!round) {
      return jsonResponse({ success: true, round: 0, countA: 0, countB: 0, total: 0 });
    }

    var votesSheet = getSheet(SHEET_VOTES);
    var data = votesSheet.getDataRange().getValues();
    var lastVoteByTeam = {};
    var countA = 0;
    var countB = 0;

    for (var i = 1; i < data.length; i++) {
      if (parseInt(data[i][2], 10) !== round) continue;
      var teamId = data[i][1];
      var vote = data[i][3];
      if (teamId) {
        // Keep overwriting so each team's latest vote is used.
        lastVoteByTeam[teamId] = vote;
      }
    }

    for (var teamId in lastVoteByTeam) {
      var raw = lastVoteByTeam[teamId];
      if (!raw) continue;
      if (raw === "NO_COMMIT") continue;
      var vote = String(raw).split("|")[0];
      if (vote === "A") countA++;
      if (vote === "B") countB++;
    }

    return jsonResponse({
      success: true,
      round: round,
      countA: countA,
      countB: countB,
      total: countA + countB
    });
  }

  return jsonResponse({ success: false, error: "INVALID_ACTION" });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents || "{}");
  } catch (err) {
    return jsonResponse({ success: false, error: "INVALID_JSON" });
  }
  var action = body.action;

  if (action === "checkEmail") {
    try {
      var email = (body.email || "").toLowerCase();

      if (!email) {
        return jsonResponse({ success: false, error: "MISSING_FIELDS" });
      }

      var team = findTeamByEmail(email);

      if (team) {
        return jsonResponse({
          success: true,
          exists: true,
          teamId: team[0]
        });
      }

      return jsonResponse({
        success: true,
        exists: false
      });

    } catch (err) {
      return jsonResponse({ success: false, error: "SHEETS_READ_FAILED" });
    }
  }

  if (action === "register") {
    try {
      var teamName = body.teamName;
      var member1  = body.member1;
      var member2  = body.member2 || "";
      var member3  = body.member3 || "";
      var email    = (body.email || "").toLowerCase();

      if (!teamName || !member1 || !email) {
        return jsonResponse({ success: false, error: "MISSING_FIELDS" });
      }

      var sheet = getSheet(SHEET_TEAMS);

      // Check duplicate email
      if (findTeamByEmail(email)) {
        return jsonResponse({ success: false, error: "EMAIL_ALREADY_EXISTS" });
      }

      // Generate teamId
      var lastRow = sheet.getLastRow();
      var teamId = "T" + String(lastRow).padStart(3, "0");

      var authToken = generateToken(16);

      var lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        sheet.appendRow([
          teamId,
          teamName,
          member1,
          member2,
          member3,
          email,
          authToken,
          new Date().toISOString()
        ]);
      } finally {
        lock.releaseLock();
      }

      return jsonResponse({
        success: true,
        teamId: teamId,
        authToken: authToken
      });

    } catch (err) {
      return jsonResponse({ success: false, error: "LOCK_TIMEOUT" });
    }
  }

  if (action === "submitImage") {
    try {
      var teamId   = body.teamId;
      var token    = body.authToken;
      var round    = body.round;
      var imageData = body.imageData;
      var mimeType  = body.mimeType;

      // Auth check
      if (!validateAuth(teamId, token)) {
        return jsonResponse({ success: false, error: "AUTH_FAILED" });
      }

      var control = getControl();

      if (control.roundType !== "image") {
        return jsonResponse({ success: false, error: "INVALID_ROUND_TYPE" });
      }

      // Round closed check
      if (control.status === "closed") {
        return jsonResponse({ success: false, error: "ROUND_CLOSED" });
      }

      // Wrong round
      if (control.roundNumber != round) {
        return jsonResponse({ success: false, error: "WRONG_ROUND" });
      }

      var lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        var sheet = getSheet(SHEET_SUBMISSIONS);
        var data = sheet.getDataRange().getValues();

        // Already submitted check
        for (var i = 1; i < data.length; i++) {
          if (data[i][1] === teamId && data[i][2] == round) {
            return jsonResponse({ success: false, error: "ALREADY_SUBMITTED" });
          }
        }

        // Decode base64
        var bytes = Utilities.base64Decode(imageData);

        if (bytes.length > 500 * 1024) {
          return jsonResponse({ success: false, error: "IMAGE_TOO_LARGE" });
        }

        var folder = getRoundFolder(round);
        if (!folder) {
          return jsonResponse({ success: false, error: "DRIVE_SAVE_FAILED" });
        }

        // var submissionId = "S" + String(sheet.getLastRow()).padStart(3, "0");
        var submissionId = "S" + Date.now();

        var blob = Utilities.newBlob(bytes, mimeType, submissionId + ".jpg");
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        sheet.appendRow([
          submissionId,
          teamId,
          round,
          file.getUrl(),
          new Date().toISOString(),
          "",
          "",
          "pending"
        ]);

        return jsonResponse({
          success: true,
          submissionId: submissionId
        });

      } finally {
        lock.releaseLock();
      }

    } catch (err) {
      return jsonResponse({
        success: false,
        error: err.toString()
      });
    }
  }

  if (action === "submitVote") {
    try {
      var teamId = body.teamId;
      var token  = body.authToken;
      var round  = body.round;
      var vote   = body.vote;
      var confidence = body.confidence;
      var ts     = body.timestamp;

      // Auth check
      if (!validateAuth(teamId, token)) {
        return jsonResponse({ success: false, error: "AUTH_FAILED" });
      }

      var control = getControl();

      if (control.roundType !== "poll" && control.roundType !== "commit") {
        return jsonResponse({ success: false, error: "INVALID_ROUND_TYPE" });
      }

      // Round closed
      if (control.status === "closed") {
        return jsonResponse({ success: false, error: "ROUND_CLOSED" });
      }

      // Wrong round
      if (control.roundNumber != round) {
        return jsonResponse({ success: false, error: "WRONG_ROUND" });
      }

      // Validate vote
      var storedValue = null;
      if (control.roundType === "poll") {
        if (vote !== "A" && vote !== "B") {
          return jsonResponse({ success: false, error: "INVALID_VOTE" });
        }
        storedValue = vote;
      } else if (control.roundType === "commit") {
        if (vote === "NO_COMMIT") {
          storedValue = "NO_COMMIT";
        } else if (vote === "A" || vote === "B") {
          if (confidence !== "sure" && confidence !== "not_sure") {
            return jsonResponse({ success: false, error: "INVALID_CONFIDENCE" });
          }
          storedValue = vote + "|" + confidence;
        } else {
          return jsonResponse({ success: false, error: "INVALID_VOTE" });
        }
      }

      var lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        var sheet = getSheet(SHEET_VOTES);
        var data = sheet.getDataRange().getValues();

        // Cooldown check (5 sec)
        for (var i = data.length - 1; i >= 1; i--) {
          if (data[i][1] === teamId && data[i][2] == round) {
            var lastTs = data[i][4];
            if (ts - lastTs < 5000) {
              return jsonResponse({
                success: false,
                error: "COOLDOWN_ACTIVE",
                remainingMs: 5000 - (ts - lastTs)
              });
            }
            break;
          }
        }

        var voteId = "V" + String(sheet.getLastRow()).padStart(3, "0");

        sheet.appendRow([
          voteId,
          teamId,
          round,
          storedValue,
          ts,
          "FALSE"
        ]);

        return jsonResponse({
          success: true,
          recorded: storedValue
        });

      } finally {
        lock.releaseLock();
      }

    } catch (err) {
      return jsonResponse({ success: false, error: "LOCK_TIMEOUT" });
    }
  }

  if (action === "setControl") {
    try {
      var password = body.adminPassword;

      if (!isAdmin(password)) {
        return jsonResponse({ success: false, error: "UNAUTHORIZED" });
      }

      var sheet = getSheet(SHEET_CONTROL);

      var round = body.round;
      var status = body.status;
      var pollMode = body.pollMode;
      var roundType = body.roundType;

      // Update only if provided
      if (round !== undefined) {
        sheet.getRange(2, 1).setValue(round);
      }

      if (roundType !== undefined) {
        if (roundType !== "image" && roundType !== "poll" && roundType !== "commit") {
          return jsonResponse({ success: false, error: "INVALID_ROUND_TYPE" });
        }

        sheet.getRange(2, 2).setValue(roundType);
      }

      if (status !== undefined) {
        if (status !== "open" && status !== "closed") {
          return jsonResponse({ success: false, error: "INVALID_STATUS" });
        }
        sheet.getRange(2, 3).setValue(status);
      }

      if (pollMode !== undefined) {
        if (pollMode !== "majority" && pollMode !== "minority" && pollMode !== "secret") {
          return jsonResponse({ success: false, error: "INVALID_POLL_MODE" });
        }
        sheet.getRange(2, 4).setValue(pollMode);
      }

      var control = getControl();

      if (status === "closed") {
        if (control.roundType === "poll" && control.pollMode !== "secret") {
          processPollResults(control.roundNumber);
        } else if (control.roundType === "commit" && control.pollMode !== "secret") {
          processCommitResults(control.roundNumber, null, false);
        }
      }

      return jsonResponse({
        success: true,
        round: control.roundNumber,
        status: control.status,
        pollMode: control.pollMode
      });

    } catch (err) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" });
    }
  }

  if (action === "revealPoll") {
    try {
      var password = body.adminPassword;

      if (!isAdmin(password)) {
        return jsonResponse({ success: false, error: "UNAUTHORIZED" });
      }

      var mode = body.mode;

      if (mode !== "majority" && mode !== "minority") {
        return jsonResponse({ success: false, error: "INVALID_MODE" });
      }

      var sheet = getSheet(SHEET_CONTROL);

      // Only relevant for secret polls
      var control = getControl();

      if (control.pollMode !== "secret") {
        return jsonResponse({ success: false, error: "NOT_SECRET_MODE" });
      }

      if (control.status !== "closed") {
        return jsonResponse({ success: false, error: "ROUND_NOT_CLOSED" });
      }

      // Set reveal mode
      sheet.getRange(2, 5).setValue(mode);

      // For secret rounds, score now using revealed mode.
      var saved = 0;
      if (control.roundType === "poll") {
        saved = processPollResults(control.roundNumber, mode, false);
      } else if (control.roundType === "commit") {
        saved = processCommitResults(control.roundNumber, mode, false);
      } else {
        return jsonResponse({ success: false, error: "INVALID_ROUND_TYPE" });
      }

      return jsonResponse({
        success: true,
        round: control.roundNumber,
        mode: mode,
        scoresSaved: saved
      });

    } catch (err) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" });
    }
  }

  if (action === "rescoreRound") {
    try {
      var password = body.adminPassword;
      var round = parseInt(body.round, 10);

      if (!isAdmin(password)) {
        return jsonResponse({ success: false, error: "UNAUTHORIZED" });
      }
      if (!round) {
        return jsonResponse({ success: false, error: "ROUND_NOT_FOUND" });
      }

      var sheet = getSheet(SHEET_SUBMISSIONS);
      var data = sheet.getDataRange().getValues();
      var requeued = 0;

      for (var i = 1; i < data.length; i++) {
        if (parseInt(data[i][2], 10) !== round) continue;
        if (data[i][7] === "error" || data[i][7] === "fallback") {
          sheet.getRange(i + 1, 8).setValue("pending");
          requeued++;
        }
      }

      return jsonResponse({
        success: true,
        requeued: requeued
      });
    } catch (err) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" });
    }
  }

  if (action === "leaderboard") {
    // Compatibility path: allow POST leaderboard requests too.
    var password = body.password;
    if (!isAdmin(password)) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" });
    }

    var sheet = getSheet(SHEET_LEADERBOARD);
    var data = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      result.push({
        rank: data[i][0],
        teamName: data[i][1],
        totalPoints: data[i][2]
      });
    }

    return jsonResponse({
      success: true,
      lastUpdated: data.length > 1 ? data[1][3] : null,
      leaderboard: result
    });
  }

  return jsonResponse({ success: false, error: "INVALID_ACTION" });
}

var SHEET_CONTROL = "Control";
var SHEET_CONFIG  = "Config";

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getControl() {
  var sheet = getSheet(SHEET_CONTROL);
  var row = sheet.getRange(2, 1, 1, 5).getValues()[0];

  return {
    roundNumber: row[0],
    roundType:   row[1],
    status:      row[2],
    pollMode:    row[3],
    pollReveal:  row[4]
  };
}

function getConfig() {
  var sheet = getSheet(SHEET_CONFIG);
  var row = sheet.getRange(2, 1, 1, 10).getValues()[0];

  return {
    eventName: row[9]
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

var SHEET_ROUNDS = "Rounds";

function getRoundInfo(roundNumber) {
  var sheet = getSheet(SHEET_ROUNDS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roundNumber) {
      return {
        roundNumber: data[i][0],
        roundType:   data[i][1],
        referenceUrl: data[i][2],
        promptText:   data[i][3],
        pollQuestion: data[i][4],
        optionA:      data[i][5],
        optionB:      data[i][6]
      };
    }
  }

  return null;
}