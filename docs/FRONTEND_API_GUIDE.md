# 📘 Frontend API Guide – Prompt Wars

## 🔗 Base URL

All requests are made to:

```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Store this in a shared config file:

```javascript
const API_URL = "YOUR_DEPLOYED_URL";
```

---

## 🧠 General Rules

* All responses are JSON
* HTTP status is always `200`
* Always check:

```javascript
if (!res.success) {
  // handle error
}
```

* Errors are returned as:

```json
{
  "success": false,
  "error": "ERROR_CODE"
}
```

---

## 🔐 Authentication

Required for most POST requests:

* `teamId`
* `authToken`

Store both in `localStorage` after registration.

---

# 🟢 1. Register

### POST

```json
{
  "action": "register",
  "teamName": "Team Alpha",
  "member1": "Name",
  "member2": "",
  "member3": "",
  "email": "test@example.com"
}
```

### Response

```json
{
  "success": true,
  "teamId": "T001",
  "authToken": "randomstring"
}
```

---

# 🟡 2. Check Email

### POST

```json
{
  "action": "checkEmail",
  "email": "test@example.com"
}
```

### Response

```json
{
  "success": true,
  "exists": true,
  "teamId": "T001"
}
```

or

```json
{
  "success": true,
  "exists": false
}
```

---

# 🔵 3. Status (Polling)

### GET

```
?action=status
```

### Response

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

📌 Call every 5 seconds

---

# 🟣 4. Round Info

### GET

```
?action=roundinfo&round=1
```

### Image Round

```json
{
  "success": true,
  "roundType": "image",
  "referenceUrl": "...",
  "promptText": "..."
}
```

### Poll Round

```json
{
  "success": true,
  "roundType": "poll",
  "pollQuestion": "...",
  "optionA": "...",
  "optionB": "..."
}
```

---

# 🖼️ 5. Submit Image

### POST

```json
{
  "action": "submitImage",
  "teamId": "T001",
  "authToken": "...",
  "round": 1,
  "imageData": "BASE64",
  "mimeType": "image/jpeg"
}
```

### Notes

* Image must be compressed (~500KB max)
* Remove base64 prefix (`data:image/...`)
* Disable button after submission
* Show loading state

---

# 🗳️ 6. Submit Vote

### POST

```json
{
  "action": "submitVote",
  "teamId": "T001",
  "authToken": "...",
  "round": 2,
  "vote": "A",
  "timestamp": Date.now()
}
```

### Notes

* Vote must be `"A"` or `"B"`
* Cooldown: 5 seconds
* User can change vote (latest counts)

---

# 🔄 Frontend Flow

## On Load

1. Check localStorage for:

   * teamId
   * authToken

2. If not present:

   * call `checkEmail`
   * show register UI

---

## During Event

* Poll `/status` every 5 seconds
* When round changes → call `/roundinfo`

### If image round:

* Show prompt + upload UI

### If poll round:

* Show voting UI

---

# ⚠️ Important Rules

* Always check `success` field
* Never rely on HTTP status
* Do not resend requests rapidly
* Disable actions after submission
* Handle errors using error codes

---

# 🧠 Storage (localStorage)

```javascript
teamId
authToken
submittedRounds
votedRounds
```

---

# 📌 Summary

Frontend responsibilities:

* UI rendering
* API calls
* localStorage handling

Backend handles:

* validation
* scoring
* state control
