# 🎯 Prompt Wars – Backend System

## 🧠 Overview

Prompt Wars is a real-time event backend built using:

* Google Apps Script (API layer)
* Google Sheets (database)
* Google Drive (image storage)
* Gemini API (AI scoring)

It supports:

* Team registration
* Image-based rounds (AI scored)
* Poll-based rounds
* Real-time leaderboard
* Admin-controlled game flow

---

## 🏗️ Architecture

### Backend

* Google Apps Script Web App
* Single endpoint handling all requests

### Database (Google Sheets)

* Teams
* Submissions
* Poll Votes
* Scores
* Leaderboard
* Control
* Config
* Rounds

### Storage

* Google Drive (per-round folders)

### AI

* Gemini (`gemini-2.5-flash`)

---

## 🔗 API Endpoint

```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

---

## 🧠 API Rules

* `GET` → Read operations
* `POST` → Write operations
* Always returns:

```json
{
  "success": true/false,
  ...
}
```

* HTTP status is always `200`
* Errors are inside JSON (`error` field)

---

## 🔐 Authentication

### Teams

* `teamId`
* `authToken`

Used for:

* image submission
* vote submission

---

### Admin

* Password stored in:

```
Config → A2
```

Used for:

* setControl
* revealPoll
* leaderboard access

---

## 📡 API Endpoints

---

### 🟢 Registration

#### POST `checkEmail`

```json
{
  "action": "checkEmail",
  "email": "test@example.com"
}
```

#### POST `register`

```json
{
  "action": "register",
  "teamName": "...",
  "member1": "...",
  "member2": "",
  "member3": "",
  "email": "..."
}
```

Response:

```json
{
  "success": true,
  "teamId": "T001",
  "authToken": "..."
}
```

---

### 🔵 Status

#### GET `?action=status`

Returns:

```json
{
  "roundNumber": 1,
  "roundType": "image",
  "status": "open",
  "pollMode": "majority"
}
```

---

### 🟣 Round Info

#### GET `?action=roundinfo&round=1`

#### Image Round

```json
{
  "roundType": "image",
  "referenceUrl": "...",
  "promptText": "..."
}
```

#### Poll Round

```json
{
  "roundType": "poll",
  "pollQuestion": "...",
  "optionA": "...",
  "optionB": "..."
}
```

---

### 🖼️ Submit Image

#### POST

```json
{
  "action": "submitImage",
  "teamId": "...",
  "authToken": "...",
  "round": 1,
  "imageData": "BASE64",
  "mimeType": "image/jpeg"
}
```

Validation:

* auth check
* round type = image
* round open
* no duplicate submission
* max size ~500KB

---

### 🧠 Image Scoring

Handled automatically by:

```
scorePendingSubmissions()
```

Runs every 1 minute.

Flow:

1. Fetch pending submissions
2. Convert Drive URL → raw file
3. Send to Gemini
4. Parse score (0–100)
5. Convert to points
6. Store in Scores sheet
7. Update leaderboard

Fallback:

* random score (40–70) if Gemini fails

---

### 🗳️ Submit Vote

#### POST

```json
{
  "action": "submitVote",
  "teamId": "...",
  "authToken": "...",
  "round": 2,
  "vote": "A",
  "timestamp": Date.now()
}
```

Rules:

* vote must be A or B
* cooldown: 5 seconds
* last vote counts

---

### 📊 Poll Scoring

Triggered when:

```
setControl → status = closed AND roundType = poll
```

Handled by:

```
processPollResults(round)
```

Logic:

* last vote per team used
* modes:

  * majority
  * minority
  * secret (revealed later)
* tie → equal points

---

### 🧠 Leaderboard

#### GET

```
?action=leaderboard&password=...
```

Returns:

```json
{
  "leaderboard": [
    {
      "rank": 1,
      "teamName": "...",
      "totalPoints": 100
    }
  ]
}
```

---

### ⚙️ Admin Control

#### POST `setControl`

```json
{
  "action": "setControl",
  "adminPassword": "...",
  "round": 1,
  "roundType": "image",
  "status": "open",
  "pollMode": "majority"
}
```

---

### 🔓 Reveal Poll

#### POST `revealPoll`

```json
{
  "action": "revealPoll",
  "adminPassword": "...",
  "mode": "majority"
}
```

---

## 🧾 Sheet Structure

### Teams

| teamId | teamName | member1 | member2 | member3 | email | authToken |

---

### Submissions

| submissionId | teamId | round | imageUrl | timestamp | score | scoredAt | status |

---

### Poll Votes

| voteId | teamId | round | vote | timestamp |

---

### Scores

| teamId | round | source | points | rawScore |

---

### Leaderboard

| rank | teamName | totalPoints | lastUpdated |

---

### Control

| roundNumber | roundType | status | pollMode | pollReveal |

---

### Config

| adminPassword | ... | scoring config |

---

### Rounds

| roundNumber | type | referenceUrl | prompt | pollQuestion | optionA | optionB |

---

## ⚠️ Important Notes

* API always returns HTTP 200
* Must check `success` field
* Users must stay on same device/browser
* authToken is not recoverable
* Image size limit ~500KB
* Gemini may rate-limit (handled internally)

---

## 🔁 Background Tasks

### Image Scoring Trigger

* Runs every 1 minute
* Processes max 3 submissions per run

---

## 🎮 Event Flow

1. Teams register
2. Admin opens round
3. Users submit or vote
4. System processes:

   * images → AI scoring
   * polls → result scoring
5. Leaderboard updates
6. Next round begins

---

## 🎯 Status

Backend is complete and ready for frontend integration.
