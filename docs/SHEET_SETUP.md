# Prompt Wars — Google Sheets Setup Guide

## Instructions

Create one Google Spreadsheet named "Prompt Wars".
Create exactly 8 tabs in this exact order.
Tab names are case-sensitive and hardcoded in Apps Script.
Do not rename, reorder, or add extra tabs.

After creating all tabs and headers, share the Sheet with
"Anyone with the link can edit" so Apps Script can write to it.

---

## Tab 1: Teams

Tab name: `Teams`

### Row 1 — Headers (type exactly as shown)

| Cell | Value         |
|------|---------------|
| A1   | Team ID       |
| B1   | Team Name     |
| C1   | Member 1      |
| D1   | Member 2      |
| E1   | Member 3      |
| F1   | Email         |
| G1   | Auth Token    |
| H1   | Registered At |

### Row 2 onwards — Data rows
Leave empty. Apps Script writes here on registration.

### Column notes
- A: Format as plain text. Apps Script writes T001, T002, T003...
- F: Format as plain text. Lowercase email stored here.
- G: Format as plain text. 16-char alphanumeric token.
- H: Format as plain text. Apps Script writes ISO timestamp string.

### No formulas in this tab.
### No data validation needed in this tab.

---

## Tab 2: Rounds

Tab name: `Rounds`

### Row 1 — Headers

| Cell | Value         |
|------|---------------|
| A1   | Round Number  |
| B1   | Round Type    |
| C1   | Reference URL |
| D1   | Prompt Text   |
| E1   | Poll Question |
| F1   | Option A      |
| G1   | Option B      |
| H1   | Notes         |

### Data validation on column B (Round Type)
Select B2:B100.
Data → Data validation → Dropdown.
Values: image, poll
Allow invalid: No (reject input)

### Sample data to enter before event (replace with real values)

| A | B     | C                          | D                                        | E                      | F       | G       | H     |
|---|-------|----------------------------|------------------------------------------|------------------------|---------|---------|-------|
| 1 | image | https://i.imgur.com/xxx.jpg| A futuristic Indian street in 2050       |                        |         |         |       |
| 2 | image | https://i.imgur.com/yyy.jpg| A robot attending a college lecture      |                        |         |         |       |
| 3 | poll  |                            |                                          | Android vs iPhone?     | Android | iPhone  |       |
| 4 | image | https://i.imgur.com/zzz.jpg| An AI version of your college canteen    |                        |         |         |       |
| 5 | image | https://i.imgur.com/aaa.jpg| A meme about placement season in 2030    |                        |         |         |       |
| 6 | poll  |                            |                                          | Assignment or sleep?   | Submit  | Sleep   |       |
| 7 | image | https://i.imgur.com/bbb.jpg| India wins the 2050 Cricket World Cup    |                        |         |         |       |

### Rules
- Fill all rounds before event day.
- For image rounds: C and D must be filled. E, F, G left blank.
- For poll rounds: E, F, G must be filled. C and D left blank.
- Reference URL must be a direct image link (ends in .jpg/.png).
  Test every URL in a browser before event day.
- H (Notes) is for your eyes only. Never shown to participants.

---

## Tab 3: Control

Tab name: `Control`

### Row 1 — Headers

| Cell | Value       |
|------|-------------|
| A1   | Round Number|
| B1   | Round Type  |
| C1   | Status      |
| D1   | Poll Mode   |
| E1   | Poll Reveal |

### Row 2 — Initial values (set before event starts)

| Cell | Value   |
|------|---------|
| A2   | 1       |
| B2   | image   |
| C2   | closed  |
| D2   | majority|
| E2   |         |

### Data validation on C2 (Status)
Select C2 only.
Data → Data validation → Dropdown.
Values: open, closed
Allow invalid: No

### Data validation on D2 (Poll Mode)
Select D2 only.
Data → Data validation → Dropdown.
Values: majority, minority, secret
Allow invalid: No

### Data validation on E2 (Poll Reveal)
Select E2 only.
Data → Data validation → Dropdown.
Values: majority, minority
Allow invalid: Yes (can be blank)

### Formula in B2 (auto-fills Round Type from Rounds tab)
Type this exactly in B2:
```
=IFERROR(VLOOKUP(A2,Rounds!A:B,2,FALSE),"")
```
This auto-fills Round Type when host changes Round Number.
B2 is read-only during event — do not type in it manually.

### Column notes
- A2: Host changes this to switch rounds. Just type the number.
- B2: Auto-filled by formula. Never type here.
- C2: Host changes between open and closed using dropdown.
- D2: Host sets poll mode before opening a poll round.
- E2: Host sets this only to reveal a secret round result.
  Clear it after each secret round reveal.

---

## Tab 4: Submissions

Tab name: `Submissions`

### Row 1 — Headers

| Cell | Value         |
|------|---------------|
| A1   | Submission ID |
| B1   | Team ID       |
| C1   | Round Number  |
| D1   | Image URL     |
| E1   | Submitted At  |
| F1   | Score         |
| G1   | Scored At     |
| H1   | Status        |

### Row 2 onwards — Data rows
Leave empty. Apps Script writes here on image submission.

### Column notes
- A: S001, S002, S003... auto-generated by Apps Script.
- B: Team ID from Teams tab. e.g. T001.
- C: Round number at time of submission. e.g. 1.
- D: Google Drive public URL of the uploaded image.
- E: ISO timestamp string of submission time.
- F: Integer 0-100. Blank until Gemini scores it.
- G: ISO timestamp of when scoring completed. Blank until scored.
- H: One of: pending, scored, error.

### No formulas. No data validation.
### All values written by Apps Script only.

---

## Tab 5: Poll Votes

Tab name: `Poll Votes`

### Row 1 — Headers

| Cell | Value        |
|------|--------------|
| A1   | Vote ID      |
| B1   | Team ID      |
| C1   | Round Number |
| D1   | Vote         |
| E1   | Timestamp    |
| F1   | Is Final     |

### Row 2 onwards — Data rows
Leave empty. Apps Script writes here on every vote and vote switch.

### Column notes
- A: V001, V002... auto-generated by Apps Script.
- B: Team ID. e.g. T003.
- C: Round number. e.g. 3.
- D: Exactly "A" or "B". Capital letter only.
- E: Unix timestamp in milliseconds. Integer. Used for cooldown check.
- F: Exactly "TRUE" or "FALSE" as string.
  All rows start as FALSE.
  Apps Script sets the last row per team per round to TRUE
  when host closes the round.

### No formulas. No data validation.
### All values written by Apps Script only.

---

## Tab 6: Scores

Tab name: `Scores`

### Row 1 — Headers

| Cell | Value        |
|------|--------------|
| A1   | Team ID      |
| B1   | Round Number |
| C1   | Round Type   |
| D1   | Points       |
| E1   | Detail       |

### Row 2 onwards — Data rows
Leave empty. Apps Script writes here after each round scores.

### Column notes
- A: Team ID. e.g. T002.
- B: Round number. e.g. 2.
- C: "image" or "poll".
- D: Integer points awarded. e.g. 35.
- E: Human-readable detail string.
  For image: "Score: 74%" 
  For poll: "Voted: A | Winning side: A | Mode: majority"

### Manual override rule
Host can directly edit column D during event to fix a wrong score.
The onEdit trigger on this tab automatically rebuilds the Leaderboard
tab whenever any cell in this tab changes.

---

## Tab 7: Leaderboard

Tab name: `Leaderboard`

### Row 1 — Headers

| Cell | Value        |
|------|--------------|
| A1   | Rank         |
| B1   | Team Name    |
| C1   | Total Points |
| D1   | Last Updated |

### Row 2 onwards — Data rows
Leave empty. Apps Script fully rewrites this tab after every score update.
Do not put any formulas or manual data here. It gets cleared and rewritten.

---

## Tab 8: Config

Tab name: `Config`

### Row 1 — Headers

| Cell | Value              |
|------|--------------------|
| A1   | Admin Password     |
| B1   | Points Image High  |
| C1   | Points Image Mid   |
| D1   | Points Image Low   |
| E1   | Points Image Base  |
| F1   | Points Poll Win    |
| G1   | Points Poll Secret |
| H1   | Max Teams          |
| I1   | Gemini API Key     |
| J1   | Event Name         |

### Row 2 — Values (fill before event)

| Cell | Value              | Notes                                      |
|------|--------------------|--------------------------------------------|
| A2   | YourPasswordHere   | Pick something simple. Used in admin panel.|
| B2   | 50                 | Points for 80-100% similarity              |
| C2   | 35                 | Points for 60-79% similarity               |
| D2   | 20                 | Points for 40-59% similarity               |
| E2   | 5                  | Points for below 40% or Gemini error       |
| F2   | 30                 | Points for majority or minority poll win   |
| G2   | 40                 | Points for secret round win                |
| H2   | 50                 | Hard cap on total team registrations       |
| I2   | AIzaSy...          | Your Gemini API key from Google AI Studio  |
| J2   | Prompt Wars        | Shown in website header                    |

### How to get a Gemini API key
1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click "Get API Key" → "Create API key"
4. Copy the key and paste into I2
5. Free tier is sufficient for this event

### Config is read by Apps Script using these exact cell references:
- A2 → Admin Password
- B2 → Points for score 80-100
- C2 → Points for score 60-79
- D2 → Points for score 40-59
- E2 → Points for score below 40 or error
- F2 → Points for poll win (majority/minority)
- G2 → Points for secret round win
- H2 → Max teams
- I2 → Gemini API key
- J2 → Event name

Do not move these values to different cells.
Do not add rows above row 2.

---

## Google Drive Folder Setup

Create a folder in your Google Drive named exactly:
`Prompt Wars Event`

Inside it, create subfolders named exactly:
`Round 1`
`Round 2`
`Round 3`
`Round 4`
`Round 5`
`Round 6`
`Round 7`

Set sharing on the parent folder `Prompt Wars Event` to:
"Anyone with the link can view"

Apps Script will write files into these folders using DriveApp.
The folder names are hardcoded in Apps Script. Do not rename them.

To get the folder ID (needed in Apps Script):
- Open the folder in Drive
- Copy the ID from the URL: drive.google.com/drive/folders/THIS_PART
- This ID goes into the Apps Script config constant

---

## Apps Script Cell Reference Constants

When writing Apps Script, use these exact references.
These are hardcoded constants, not magic numbers.

```javascript
// Sheet names
var SHEET_TEAMS       = "Teams";
var SHEET_ROUNDS      = "Rounds";
var SHEET_CONTROL     = "Control";
var SHEET_SUBMISSIONS = "Submissions";
var SHEET_POLL_VOTES  = "Poll Votes";
var SHEET_SCORES      = "Scores";
var SHEET_LEADERBOARD = "Leaderboard";
var SHEET_CONFIG      = "Config";

// Config tab cell references (row 2)
var CONFIG_ROW = 2;
var COL_CONFIG_PASSWORD     = 1;  // A
var COL_CONFIG_PTS_HIGH     = 2;  // B
var COL_CONFIG_PTS_MID      = 3;  // C
var COL_CONFIG_PTS_LOW      = 4;  // D
var COL_CONFIG_PTS_BASE     = 5;  // E
var COL_CONFIG_PTS_POLL     = 6;  // F
var COL_CONFIG_PTS_SECRET   = 7;  // G
var COL_CONFIG_MAX_TEAMS    = 8;  // H
var COL_CONFIG_GEMINI_KEY   = 9;  // I
var COL_CONFIG_EVENT_NAME   = 10; // J

// Control tab cell references (row 2)
var CONTROL_ROW = 2;
var COL_CTRL_ROUND_NUMBER = 1;  // A
var COL_CTRL_ROUND_TYPE   = 2;  // B
var COL_CTRL_STATUS       = 3;  // C
var COL_CTRL_POLL_MODE    = 4;  // D
var COL_CTRL_POLL_REVEAL  = 5;  // E

// Teams tab columns
var COL_TEAMS_TEAM_ID    = 1;  // A
var COL_TEAMS_TEAM_NAME  = 2;  // B
var COL_TEAMS_MEMBER1    = 3;  // C
var COL_TEAMS_MEMBER2    = 4;  // D
var COL_TEAMS_MEMBER3    = 5;  // E
var COL_TEAMS_EMAIL      = 6;  // F
var COL_TEAMS_AUTH_TOKEN = 7;  // G
var COL_TEAMS_REG_AT     = 8;  // H

// Rounds tab columns
var COL_ROUNDS_NUMBER    = 1;  // A
var COL_ROUNDS_TYPE      = 2;  // B
var COL_ROUNDS_REF_URL   = 3;  // C
var COL_ROUNDS_PROMPT    = 4;  // D
var COL_ROUNDS_POLL_Q    = 5;  // E
var COL_ROUNDS_OPTION_A  = 6;  // F
var COL_ROUNDS_OPTION_B  = 7;  // G
var COL_ROUNDS_NOTES     = 8;  // H

// Submissions tab columns
var COL_SUB_ID        = 1;  // A
var COL_SUB_TEAM_ID   = 2;  // B
var COL_SUB_ROUND     = 3;  // C
var COL_SUB_IMAGE_URL = 4;  // D
var COL_SUB_SUBM_AT   = 5;  // E
var COL_SUB_SCORE     = 6;  // F
var COL_SUB_SCORED_AT = 7;  // G
var COL_SUB_STATUS    = 8;  // H

// Poll Votes tab columns
var COL_VOTE_ID        = 1;  // A
var COL_VOTE_TEAM_ID   = 2;  // B
var COL_VOTE_ROUND     = 3;  // C
var COL_VOTE_VOTE      = 4;  // D
var COL_VOTE_TIMESTAMP = 5;  // E
var COL_VOTE_IS_FINAL  = 6;  // F

// Scores tab columns
var COL_SCORE_TEAM_ID    = 1;  // A
var COL_SCORE_ROUND      = 2;  // B
var COL_SCORE_TYPE       = 3;  // C
var COL_SCORE_POINTS     = 4;  // D
var COL_SCORE_DETAIL     = 5;  // E

// Leaderboard tab columns
var COL_LB_RANK         = 1;  // A
var COL_LB_TEAM_NAME    = 2;  // B
var COL_LB_TOTAL_POINTS = 3;  // C
var COL_LB_UPDATED_AT   = 4;  // D

// Drive folder name constant
var DRIVE_ROOT_FOLDER = "Prompt Wars Event";
```

---

## Verification Checklist

Run through this after setup, before writing any code.

- [ ] Spreadsheet named "Prompt Wars"
- [ ] 8 tabs exist with exact names as listed above
- [ ] All headers in row 1 of every tab match exactly
- [ ] Control tab B2 has the VLOOKUP formula
- [ ] Control tab C2 has dropdown: open, closed
- [ ] Control tab D2 has dropdown: majority, minority, secret
- [ ] Rounds tab B column has dropdown: image, poll
- [ ] Config tab row 2 fully filled including Gemini key
- [ ] Control tab A2 = 1, C2 = closed
- [ ] Drive folder "Prompt Wars Event" exists with Round 1-7 subfolders
- [ ] Drive folder shared as "Anyone with link can view"
- [ ] Reference URLs in Rounds tab tested in browser (images load)
- [ ] Spreadsheet shared as "Anyone with link can edit"
