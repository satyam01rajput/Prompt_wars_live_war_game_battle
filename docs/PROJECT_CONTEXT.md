# 📍 Project Context – Prompt Wars

## 🧠 Overview

Prompt Wars is an event-based web application with:

* Image submission rounds (AI scored)
* Poll rounds (majority / minority / secret)
* Real-time leaderboard

Backend is built using:

* Google Apps Script
* Google Sheets
* Google Drive

Frontend is a separate static web app.

---

## ✅ Completed (Backend)

The following APIs are fully implemented and tested:

### Core APIs

* `register`
* `checkEmail`
* `status`
* `roundinfo`

### Submission APIs

* `submitImage` (with Drive upload + validation)
* `submitVote` (with cooldown + vote switching)

### Admin APIs

* `setControl` (round + status + mode)
* `revealPoll` (secret poll reveal)

---

## 🔧 Implemented Features

* Authentication via `teamId` + `authToken`
* Round validation (open/closed, correct round)
* LockService for concurrency
* Image upload to Google Drive
* Vote tracking with history (append-only model)
* Cooldown enforcement (5 seconds)
* Control panel logic via Google Sheets

---

## 🚧 Pending (Backend)

### Scoring System

#### 1. Image Scoring (Gemini)

* Fetch pending submissions
* Compare with reference image
* Generate score (0–100)
* Convert to points
* Write to `Scores` sheet

#### 2. Poll Scoring

* Process final votes
* Determine winner:

  * majority / minority / secret
* Assign points
* Write to `Scores`

---

### Leaderboard

* Aggregate scores
* Sort teams by total points
* Write to `Leaderboard` sheet
* Create API endpoint to fetch leaderboard

---

## 🌐 Pending (Frontend)

Frontend is NOT built yet.

To be handled by another developer:

* Registration page
* Participant page (round view)
* Admin panel
* Leaderboard display

---

## 🧩 Architecture Summary

### Backend

* Apps Script Web App (single endpoint)
* Google Sheets as database
* Google Drive for image storage

### Frontend

* Static HTML/CSS/JS
* Uses API for all operations

---

## ⚠️ Important Constraints

* API always returns HTTP 200
* Must check `success` field
* authToken is not recoverable
* Users must stay on same device/browser
* Image size limited (~500KB)

---

## 🎯 Current Status

Backend core is complete.

Next step:
➡️ Implement scoring engine (Gemini + Poll scoring + Leaderboard)

---

## 📌 Purpose of this File

This document provides:

* Current project status
* Completed vs pending work
* System overview

Use this when:

* Switching developers
* Starting a new ChatGPT session
* Onboarding someone quickly
