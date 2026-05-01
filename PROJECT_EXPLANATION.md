# MeetCap — Real-Time Meeting Intelligence Platform

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [How It Works](#how-it-works)
  - [1. Real-Time Caption Capture](#1-real-time-caption-capture)
  - [2. AI-Powered Meeting Summarization](#2-ai-powered-meeting-summarization)
  - [3. Cognitive Bias Detection (NLP Model)](#3-cognitive-bias-detection-nlp-model)
- [The NLP Pipeline — Deep Dive](#the-nlp-pipeline--deep-dive)
  - [Step 1: Data Collection from Meeting](#step-1-data-collection-from-meeting)
  - [Step 2: Per-Speaker Text Aggregation](#step-2-per-speaker-text-aggregation)
  - [Step 3: Feature Engineering (22 Features)](#step-3-feature-engineering-22-features)
  - [Step 4: TF-IDF Vectorization](#step-4-tf-idf-vectorization)
  - [Step 5: Model Prediction (MultiOutput RandomForest)](#step-5-model-prediction-multioutput-randomforest)
  - [Step 6: Decision Health Scoring](#step-6-decision-health-scoring)
  - [Step 7: Recommendation Generation](#step-7-recommendation-generation)
- [Technology Stack](#technology-stack)
- [How to Run](#how-to-run)

---

## Overview

**MeetCap** is a Chrome extension that enhances Google Meet by capturing live captions, generating AI summaries, and performing **real-time cognitive bias detection** using a trained NLP model. It helps teams make better decisions by identifying harmful decision-making patterns like groupthink, overconfidence, and vague ownership — as they happen.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Live Caption Capture** | Records everything said during a Google Meet call in real-time with speaker identification |
| **AI Summarization** | Generates concise meeting summaries with key points, decisions, and action items using Google's Gemini AI |
| **Real-Time Bias Alerts** | Detects cognitive biases in each new caption as it's spoken, showing live warnings in the sidebar |
| **Per-Speaker Audit** | When recording stops, automatically generates a bias breakdown for each participant |
| **Decision Block Analysis** | Identifies decision moments in the transcript and audits each one individually |
| **User Accounts** | Login/signup system to save meetings, summaries, and audit reports to a personal account |
| **Export** | Download captions as a text file |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│               Google Meet (Browser)                 │
│  ┌───────────────────────────────────────────────┐  │
│  │         Chrome Extension (content.js)         │  │
│  │                                               │  │
│  │  • MutationObserver watches DOM for captions  │  │
│  │  • Sidebar UI (record/export/summarize/audit) │  │
│  │  • Real-time bias alerts during recording     │  │
│  │  • Per-speaker report on recording stop       │  │
│  └──────────────────┬────────────────────────────┘  │
└─────────────────────┼───────────────────────────────┘
                      │ HTTP Requests
        ┌─────────────▼──────────────┐
        │   Node.js Backend (:5000)  │
        │                            │
        │  • POST /api/summarize     │──── Gemini AI API
        │  • POST /api/auth/*        │──── MongoDB Atlas
        │  • POST /api/meetings      │──── MongoDB Atlas
        │  • POST /api/audit-*       │──┐
        └────────────────────────────┘  │
                                        │ HTTP Proxy
        ┌───────────────────────────────▼┐
        │   Python Model Service (:8000) │
        │                                │
        │  • Trained sklearn model       │
        │  • TF-IDF + RandomForest       │
        │  • 5-bias classification       │
        │  • Decision health scoring     │
        └────────────────────────────────┘
```

---

## How It Works

### 1. Real-Time Caption Capture

When a user joins a Google Meet call and clicks **"Start Recording Captions"**, the extension:

1. Creates a `MutationObserver` that watches the Google Meet DOM for caption container elements
2. When captions appear on screen, the observer detects changes and extracts:
   - **Speaker name** — from the caption header element
   - **Caption text** — the actual spoken words
   - **Timestamp** — when the caption was captured
3. Consecutive captions from the same speaker are intelligently merged using text similarity detection, preventing duplicate entries
4. Each caption entry is displayed in the sidebar with the speaker's name highlighted and a timestamp

```javascript
// Simplified flow inside processCaptions()
{
  speaker: "Alice",
  text: "I think we should go with option A",
  timestamp: "2026-05-01T15:30:00.000Z",
  id: "caption-1714567800000-42"
}
```

### 2. AI-Powered Meeting Summarization

When the user clicks **"Summarize with AI"** or stops recording:

1. All captured `captionData` is sent to the Node.js backend (`POST /api/summarize`)
2. The backend formats the conversation by grouping consecutive captions from the same speaker:
   ```
   Alice: I think we should go with option A
   Bob: I agree, but what about the timeline?
   Alice: We can finish in two weeks. No concerns at all.
   ```
3. This formatted text is sent to **Google's Gemini AI** with a prompt to extract key points, decisions, and action items
4. The summary is returned and displayed in the sidebar
5. If the user is logged in, the meeting (captions + summary) is automatically saved to their MongoDB account

### 3. Cognitive Bias Detection (NLP Model)

This is the core innovation — a trained **scikit-learn MultiOutput RandomForest** model that detects 5 types of cognitive biases in meeting conversations:

| Bias | Emoji | What It Detects |
|------|-------|-----------------|
| **Anchoring** | ⚓ | Over-reliance on initial estimates, first impressions, or baseline numbers |
| **Groupthink** | 🐑 | Suppression of dissent, premature consensus, "everyone agrees" patterns |
| **Missing Objections** | 🚨 | Absence of risk discussion, "nothing could go wrong" mentality |
| **Overconfidence** | 🎲 | Excessive certainty, "guaranteed success", no acknowledgment of uncertainty |
| **Vague Ownership** | 👻 | No specific person assigned responsibility, "someone should handle it" |

The detection operates in three modes:

- **Real-Time (During Recording)**: Each new caption is individually analyzed. If biases are detected, a live alert appears in the sidebar within 2 seconds
- **On-Demand (Button Click)**: The full transcript is scanned for "decision moments" (triggered by phrases like "we decided", "let's go with"). Each decision block is audited separately
- **Auto Per-Speaker (On Stop)**: When recording stops, all captions are grouped by speaker. Each speaker's combined text is analyzed, producing a score card for every participant

---

## The NLP Pipeline — Deep Dive

### Step 1: Data Collection from Meeting

During recording, every caption is stored with its speaker and timestamp:

```json
[
  { "speaker": "Alice", "text": "Our initial estimate was 6 weeks and we're sticking with that baseline", "timestamp": "10:30 AM" },
  { "speaker": "Bob",   "text": "I'll own the backend migration. The data shows GCP is faster.", "timestamp": "10:31 AM" },
  { "speaker": "Alice", "text": "Everyone agrees, no concerns. This plan is foolproof.", "timestamp": "10:32 AM" },
  { "speaker": "Charlie", "text": "Someone should handle the client communication. TBD.", "timestamp": "10:33 AM" }
]
```

### Step 2: Per-Speaker Text Aggregation

For the per-speaker audit, all captions from the same speaker are concatenated:

| Speaker | Combined Text |
|---------|--------------|
| **Alice** | "Our initial estimate was 6 weeks and we're sticking with that baseline. Everyone agrees, no concerns. This plan is foolproof." |
| **Bob** | "I'll own the backend migration. The data shows GCP is faster." |
| **Charlie** | "Someone should handle the client communication. TBD." |

### Step 3: Feature Engineering (22 Features)

For each speaker's text, the model extracts **22 hand-crafted NLP features**:

#### Bias Lexicon Hit Counts (5 features)
The model counts how many keywords from each bias category appear in the text:

```python
BIAS_LEXICONS = {
    "anchoring": ["initial estimate", "original plan", "starting point", "sticking with", ...],
    "groupthink": ["everyone agrees", "no need to debate", "unanimous", "consensus", ...],
    "missing_objections": ["no concerns", "foolproof", "risk-free", "nothing could go wrong", ...],
    "overconfidence": ["guaranteed", "no doubt", "100 percent", "can't fail", ...],
    "vague_ownership": ["someone should", "TBD", "we'll figure it out", "to be determined", ...]
}
```

**For Alice's text:**
- `anchoring_hits = 2` ("initial estimate", "sticking with")
- `groupthink_hits = 1` ("everyone agrees")
- `missing_objections_hits = 2` ("no concerns", "foolproof")
- `overconfidence_hits = 0`
- `vague_ownership_hits = 0`

#### Linguistic Ratio Features (4 features)

| Feature | Formula | Purpose |
|---------|---------|---------|
| `hedge_ratio` | Count of "might", "maybe", "perhaps", "possibly" ÷ total words | Measures uncertainty language |
| `certainty_ratio` | Count of "definitely", "guaranteed", "obviously" ÷ total words | Measures overconfident language |
| `first_person_ratio` | Count of "I", "I'll", "my", "me" ÷ total words | Measures ownership language |
| `decision_word_density` | Count of "decide", "agreed", "approved" ÷ total words | Measures decision-making language |

#### Structural Features (5 features)

| Feature | What It Measures |
|---------|-----------------|
| `question_count` | Number of "?" in text — more questions = more critical thinking |
| `sentence_count` | Total sentences |
| `avg_sentence_len` | Average words per sentence |
| `word_count` | Total words |
| `unique_word_ratio` | Unique words ÷ total words — vocabulary diversity |

#### Positive Signal Features (3 features)

These detect **healthy** decision-making patterns using regex:

```python
POSITIVE_SIGNALS = {
    "clear_ownership": [r"\b(I will|I'll|[A-Z][a-z]+ will|[A-Z][a-z]+ owns?)\b", ...],
    "evidence_based": [r"\b(data shows?|research indicates?|metrics? suggest)\b", ...],
    "alternatives_considered": [r"\b(we considered|alternatively|option [A-C]|pros? and cons?)\b", ...]
}
```

| Feature | Description |
|---------|-------------|
| `has_clear_owner` | 1 if text contains patterns like "I will", "Sarah owns" |
| `evidence_based_hits` | Count of data/research references |
| `alternatives_mentioned` | 1 if text mentions weighing options |

#### Other Features (5 features)

| Feature | Purpose |
|---------|---------|
| `negation_count` | Count of "not", "don't", "never" — contrarian signals |
| `exclamation_count` | Count of "!" — emotional intensity |

**Example output for Alice:**
```python
{
    "anchoring_hits": 2, "groupthink_hits": 1, "missing_objections_hits": 2,
    "overconfidence_hits": 0, "vague_ownership_hits": 0,
    "hedge_ratio": 0.0, "certainty_ratio": 0.0,
    "first_person_ratio": 0.0, "question_count": 0,
    "sentence_count": 3, "avg_sentence_len": 8.3, "word_count": 25,
    "has_clear_owner": 0, "evidence_based_hits": 0, "alternatives_mentioned": 0,
    "decision_word_density": 0.0, "negation_count": 1,
    "unique_word_ratio": 0.84, "exclamation_count": 0
}
```

### Step 4: TF-IDF Vectorization

In addition to the hand-crafted features, the text is transformed using **TF-IDF (Term Frequency–Inverse Document Frequency)**:

- **Max features**: 500
- **N-gram range**: 1 to 3 (unigrams, bigrams, trigrams)
- **Stop words**: English stop words removed

This converts the raw text into a 500-dimensional numerical vector that captures word and phrase importance. For example, the trigram "sticking with that" would have a high TF-IDF weight because it's distinctive to anchoring language.

```
"initial estimate sticking baseline everyone agrees no concerns foolproof"
    ↓ TF-IDF Transform
[0.0, 0.0, 0.31, 0.0, ..., 0.42, 0.0, ..., 0.18]  (500 values)
```

### Step 5: Model Prediction (MultiOutput RandomForest)

The 22 hand-crafted features and 500 TF-IDF features are **concatenated** into a single feature vector of **522 dimensions**:

```
[TF-IDF: 500 features] + [Hand-crafted: 22 features] = [522 features]
```

This combined vector is fed into the trained **MultiOutput RandomForest Classifier**:

- **Algorithm**: `MultiOutputClassifier(RandomForestClassifier)`
- **Estimators**: 200 decision trees
- **Max depth**: 15
- **Class weight**: Balanced (handles imbalanced bias categories)
- **Output**: 5 independent probability scores, one for each bias type

```python
# Model output for Alice's text:
bias_probabilities = {
    "anchoring":          0.82,   # 82% probability ← DETECTED (> 45% threshold)
    "groupthink":         0.76,   # 76% probability ← DETECTED
    "missing_objections": 0.88,   # 88% probability ← DETECTED
    "overconfidence":     0.05,   # 5% probability  — not detected
    "vague_ownership":    0.03    # 3% probability  — not detected
}
```

**Detection threshold**: Any bias with probability **> 0.45** (45%) is flagged as detected.

### Step 6: Decision Health Scoring

The health score starts at **100** and is adjusted based on detected biases and positive signals:

#### Penalty Calculation

Each detected bias applies a penalty based on its **weight × probability**:

| Bias | Weight | Purpose of Weight |
|------|--------|------------------|
| Anchoring | 15 | Moderate — affects estimation accuracy |
| **Groupthink** | **20** | **Highest** — most dangerous for team decisions |
| Missing Objections | 10 | Lower — but compounds with other biases |
| Overconfidence | 15 | Moderate — leads to inadequate risk planning |
| Vague Ownership | 10 | Lower — but causes execution failures |

```
Penalty calculation for Alice:
  anchoring:          0.82 × 15 = 12.3
  groupthink:         0.76 × 20 = 15.2
  missing_objections: 0.88 × 10 =  8.8
  ─────────────────────────────────────
  Total penalty:                  36.3
```

#### Bonus Calculation

Positive signals add a bonus (up to +15):

| Signal | Bonus | Detected for Alice? |
|--------|-------|-------------------|
| Clear ownership ("I will", "X owns") | +5 | ❌ No |
| Evidence-based ("data shows", "research indicates") | +5 | ❌ No |
| Alternatives considered ("we considered", "option A/B") | +5 | ❌ No |

```
Final Score for Alice:
  100 - 36.3 + 0 = 63.7 / 100
```

#### Score Color Coding

| Score Range | Grade | Meaning |
|-------------|-------|---------|
| **≥ 75** | 🟢 Green | Healthy decision-making |
| **50–74** | 🟡 Yellow | Some biases detected, room for improvement |
| **< 50** | 🔴 Red | Significant bias issues, needs attention |

### Step 7: Recommendation Generation

Based on which biases were detected, the system generates **specific, actionable recommendations**:

| Detected Bias | Recommendation |
|--------------|----------------|
| ⚓ Anchoring | "Re-evaluate from scratch — ignore the initial estimate." |
| 🐑 Groupthink | "Assign a devil's advocate to surface dissenting views." |
| 🚨 Missing Objections | "Ask: 'What could go wrong?' before finalizing." |
| 🎲 Overconfidence | "Add a pre-mortem: assume this fails — why did it?" |
| 👻 Vague Ownership | "Name a specific owner with a deadline before closing." |

### Final Per-Speaker Report

The complete output displayed in the sidebar:

```
┌──────────────────────────────────────────┐
│  Per-Speaker Decision Quality            │
├──────────────────────────────────────────┤
│                                          │
│  Alice                        🟡 63.7    │
│  2 caption(s)                            │
│  ⚓ anchoring  🐑 groupthink             │
│  🚨 missing objections                   │
│  → Re-evaluate from scratch              │
│  → Assign a devil's advocate             │
│  → Ask: 'What could go wrong?'           │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Charlie                      🔴 42.0    │
│  1 caption(s)                            │
│  👻 vague ownership                      │
│  → Name a specific owner with deadline   │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Bob                          🟢 95.0    │
│  1 caption(s)                            │
│  ✅ No biases detected                   │
│                                          │
└──────────────────────────────────────────┘
```

> Speakers are sorted by score (worst first) so the most problematic decision-makers appear at the top.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Chrome Extension** | JavaScript, MutationObserver API | Real-time caption capture from Google Meet DOM |
| **Node.js Backend** | Express.js 5, Axios | REST API server, request proxying, Gemini integration |
| **Python Model Service** | FastAPI, Uvicorn | Serves the trained NLP model via HTTP endpoints |
| **NLP Model** | scikit-learn (MultiOutput RandomForest + TF-IDF) | Cognitive bias classification |
| **AI Summarization** | Google Gemini API | Meeting summary generation |
| **Database** | MongoDB Atlas | User accounts, meeting storage |
| **Authentication** | JWT (JSON Web Tokens) | Secure user sessions |

---

## How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Chrome

### 1. Start the Python Model Service (Port 8000)
```bash
cd backend/model_service
pip install -r requirements.txt
python app.py
```
> First startup trains the model (~2 seconds). Subsequent startups load from cache instantly.

### 2. Start the Node.js Backend (Port 5000)
```bash
cd backend
npm install
npm start
```

### 3. Load the Chrome Extension
1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select the `capmeet/` folder
4. Join a Google Meet call — the MeetCap sidebar will appear

### 4. Use It
1. Click **"Start Recording Captions"** → captions appear in real-time
2. Watch for **🔴 Live Bias Alerts** during the conversation
3. Click **"🧠 Audit Decision Quality"** anytime for a decision-block analysis
4. Click **"Stop Recording"** → AI summary + per-speaker bias audit generated automatically
