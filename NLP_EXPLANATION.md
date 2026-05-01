# MeetCap — NLP Technical Explanation

## Task Definition

**Multi-label text classification** — given a meeting utterance, simultaneously predict the presence/absence of 5 cognitive bias classes. This is a **Binary Relevance** approach where each label is predicted independently, allowing co-occurrence (e.g., text can be both "groupthink" AND "overconfidence").

---

## Corpus Construction

**480 samples** generated via **template-based data augmentation** (80 per class: 5 bias types + 1 healthy). Labels are assigned using **distant supervision** through lexicon matching — no manual annotation needed.

```
auto_label("Everyone agrees, no concerns") → {groupthink: 1, missing_objections: 1, ...}
```

This is a **silver-standard** labeling approach — fast but bounded by lexicon coverage.

---

## Feature Representation (Hybrid — 522 dimensions)

### A) Distributional Features: TF-IDF (500 dims)

```
TfidfVectorizer(max_features=500, ngram_range=(1,3), stop_words="english")
```

- **Bag-of-n-grams** representation with TF-IDF weighting
- Trigrams capture multi-word bias phrases ("no doubt about", "everyone agrees this")
- IDF downweights common terms, surfaces discriminative vocabulary

### B) Pragmatic & Discourse Features (22 dims)

| NLP Concept | Feature | What It Captures |
|------------|---------|-----------------|
| **Lexicon-based sentiment** | `{bias}_hits` × 5 | Keyword matches against 5 curated bias dictionaries (20 keywords each) |
| **Epistemic modality** | `hedge_ratio` | Uncertainty markers: "might", "maybe", "perhaps" ÷ word count |
| **Deontic modality** | `certainty_ratio` | Certainty markers: "definitely", "guaranteed" ÷ word count |
| **Discourse deixis** | `first_person_ratio` | Pronoun density ("I", "my") — signals ownership |
| **Speech act detection** | `question_count` | Interrogatives signal critical evaluation |
| **Argumentation mining** | `evidence_based_hits` | Evidence citations: "data shows", "research indicates" |
| **Deliberation structure** | `alternatives_mentioned` | "we considered", "option A vs B" — healthy deliberation |
| **Named entity + regex** | `has_clear_owner` | Detects "X will own", "I'll handle" patterns |
| **Type-Token Ratio** | `unique_word_ratio` | Lexical diversity measure |
| **Negation detection** | `negation_count` | "not", "don't", "never" — contrarian signals |
| **Surface statistics** | `word_count`, `sentence_count`, `avg_sentence_len` | Text complexity features |

### C) Feature Fusion

**Early fusion** via sparse matrix concatenation:

```python
X = hstack([X_tfidf(500), X_handcrafted(22)])  # → 522-dim vector per sample
```

Combines distributional semantics with expert-designed pragmatic features.

---

## Model

**MultiOutputClassifier(RandomForestClassifier)** — 5 independent binary RF classifiers (one per bias), each with:
- 200 estimators (bagged decision trees)
- Max depth 15 (regularization for small corpus)
- Balanced class weights (inverse frequency weighting)

Each classifier outputs `P(bias=1|text)` — a probability between 0 and 1.

**Why RandomForest over deep learning?**
- Small corpus (480 samples) — deep models would overfit
- Hand-crafted features are highly informative — RF leverages them directly
- Interpretable: feature importance is extractable per tree
- Fast inference (~1ms per prediction) — enables real-time auditing

---

## Inference Flow

```
"Everyone agrees, this plan is foolproof, no doubt"
          │
          ├──→ TF-IDF transform ──→ [500-dim sparse vector]
          │
          └──→ extract_features() ──→ [22-dim dense vector]
                                              │
                                    ┌─── concatenate ───┐
                                    │   522-dim vector   │
                                    └────────┬───────────┘
                                             │
                              MultiOutputClassifier.predict_proba()
                                             │
                           ┌────────┬────────┼────────┬────────┐
                          RF₁     RF₂      RF₃      RF₄      RF₅
                           │       │        │        │        │
                         P=0.12  P=0.87   P=0.78   P=0.82   P=0.03
                      anchoring groupthink missing  overconf  vague
                                  ↓         ↓        ↓
                            DETECTED    DETECTED  DETECTED
                           (> 0.45)    (> 0.45)  (> 0.45)
```

**Decision threshold**: P > 0.45 → bias present (tuned for recall over precision — better to flag a potential bias than miss one).

---

## Post-Processing: Scoring Function

The classification output is transformed into a **decision health score** (0–100):

```
Score = 100 − Σ(weight_i × P(bias_i)) + bonus

Where:
  weight = {anchoring: 15, groupthink: 20, missing_obj: 10, overconf: 15, vague: 10}
  bonus  = +5 (clear owner) + 5 (evidence cited) + 5 (alternatives mentioned)
```

Groupthink has the **highest weight (20)** because it's the most damaging bias for group decisions — it suppresses all other critical thinking.

---

## Key NLP Techniques Used

| Technique | Where | Purpose |
|-----------|-------|---------|
| **TF-IDF** | Feature extraction | Convert text to numerical representation preserving term importance |
| **N-gram analysis** | TF-IDF (1-3 grams) | Capture multi-word bias phrases as features |
| **Lexicon-based classification** | Bias dictionaries | Domain-specific keyword matching for bias signals |
| **Regex pattern matching** | Positive signals | Detect ownership, evidence, and deliberation patterns |
| **Modality analysis** | Hedge/certainty ratios | Measure epistemic stance of the speaker |
| **Multi-label classification** | Binary Relevance | Allow multiple bias labels per utterance |
| **Ensemble learning** | RandomForest | Robust classification via bagged decision trees |
| **Distant supervision** | Auto-labeling | Generate training labels without manual annotation |
| **Text segmentation** | Decision block detection | Identify decision moments via trigger phrase matching |

---

## Limitations

1. **Lexicon dependency** — biases expressed without matching keywords may be missed (low recall on novel phrasings)
2. **No contextual embeddings** — TF-IDF loses word order and context (could improve with BERT/sentence transformers)
3. **Small training corpus** — 480 samples limits generalization; more diverse real-world meeting data would improve robustness
4. **Speaker-independent** — doesn't model speaker interaction patterns (e.g., one person silencing another)
5. **English only** — lexicons and TF-IDF vocabulary are English-specific
