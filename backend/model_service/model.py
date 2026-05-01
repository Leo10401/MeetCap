"""
Decision Quality Auditor — Core Model Module

Ported from decision_quality_auditor_updated.ipynb
Implements bias lexicons, feature extraction, model training (TF-IDF + MultiOutput RandomForest),
decision block detection, per-snippet auditing, and full transcript / per-speaker analysis.
"""

import os
import re
import pickle
import logging
import numpy as np
import pandas as pd
from collections import Counter
from scipy.sparse import hstack, csr_matrix

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.multioutput import MultiOutputClassifier
from sklearn.ensemble import RandomForestClassifier

logger = logging.getLogger(__name__)

# ─── Lexicons ported from notebook Section 2 ───────────────────────────────────

BIAS_LEXICONS = {
    "anchoring": [
        "initial estimate", "original plan", "first impression", "starting point",
        "baseline", "as we said before", "going back to", "we already decided",
        "previous figure", "sticking with", "our first", "the original",
        "initial assessment", "preliminary number", "anchor",
        "we started at", "the first number", "reference point",
        "default assumption", "prior commitment"
    ],
    "groupthink": [
        "everyone agrees", "we all think", "nobody disagrees", "consensus",
        "we're all on the same page", "unanimous", "no objections",
        "we all feel", "the group thinks", "obviously",
        "clearly everyone", "it's obvious", "goes without saying",
        "no need to debate", "we all know", "team consensus",
        "collective agreement", "shared view", "common understanding",
        "mutual agreement"
    ],
    "missing_objections": [
        "no concerns", "no risks", "nothing could go wrong", "no downsides",
        "foolproof", "risk-free", "no issues", "can't fail",
        "no problems", "everything is fine", "no worries",
        "what could possibly", "perfectly safe", "zero risk",
        "no negative", "without issue", "smooth sailing",
        "no obstacles", "no barriers", "no challenges"
    ],
    "overconfidence": [
        "guaranteed", "definitely", "no doubt", "100 percent",
        "absolutely certain", "can't miss", "sure thing", "no way this fails",
        "certain to succeed", "inevitable", "without question",
        "unquestionably", "beyond doubt", "no possibility of failure",
        "slam dunk", "sure bet", "no chance of failure",
        "certainty", "undoubtedly", "assuredly"
    ],
    "vague_ownership": [
        "someone should", "we need to", "somebody will", "the team will",
        "it should be done", "needs to happen", "to be determined",
        "TBD", "we'll figure it out", "someone needs to",
        "whoever", "some person", "anyone can", "might handle",
        "could take care of", "to be assigned", "pending assignment",
        "someone from the team", "a team member", "unassigned"
    ]
}

POSITIVE_SIGNALS = {
    "clear_ownership": [
        r"\b(I will|I'll|[A-Z][a-z]+ will|[A-Z][a-z]+ owns?)\b",
        r"\b(my responsibility|I'm (taking|handling|owning))\b",
        r"\b(assigned to [A-Z][a-z]+|[A-Z][a-z]+ (is responsible|takes point))\b"
    ],
    "evidence_based": [
        r"\b(data shows?|research indicates?|metrics? (show|suggest)|evidence)\b",
        r"\b(according to|based on (data|research|findings|analysis))\b",
        r"\b(the numbers? (show|indicate|suggest)|statistic(ally|s)?)\b"
    ],
    "alternatives_considered": [
        r"\b(we considered|alternatively|option [A-C]|compared)\b",
        r"\b(trade-?offs?|pros? and cons?|evaluated (multiple|several|different))\b",
        r"\b(weighed (options|alternatives)|other (approaches|options|choices))\b"
    ]
}

BIAS_WEIGHTS = {
    "anchoring": 15,
    "groupthink": 20,
    "missing_objections": 10,
    "overconfidence": 15,
    "vague_ownership": 10
}

BIAS_DESCRIPTIONS = {
    "anchoring": "Over-reliance on initial information or estimates",
    "groupthink": "Suppression of dissent; premature consensus",
    "missing_objections": "No risks, concerns, or failure modes discussed",
    "overconfidence": "Excessive certainty without acknowledging uncertainty",
    "vague_ownership": "No clear person assigned responsibility"
}

BIAS_EMOJIS = {
    "anchoring": "⚓",
    "groupthink": "🐑",
    "missing_objections": "🚨",
    "overconfidence": "🎲",
    "vague_ownership": "👻"
}

DECISION_TRIGGERS = [
    "we decided", "we're going with", "let's go with", "we'll proceed",
    "the decision is", "agreed", "we've agreed", "final call",
    "moving forward with", "we'll do", "let's do", "plan is to",
    "we should", "we will", "going to"
]

BIAS_COLS = ["anchoring", "groupthink", "missing_objections", "overconfidence", "vague_ownership"]


# ─── Auto-labeling ──────────────────────────────────────────────────────────────

def auto_label(text):
    """Label a text chunk for each bias using lexicons. Returns dict of 0/1."""
    text_lower = text.lower()
    labels = {}
    for bias, keywords in BIAS_LEXICONS.items():
        labels[bias] = int(any(kw in text_lower for kw in keywords))
    return labels


# ─── Feature extraction (Section 4 of notebook) ────────────────────────────────

def extract_features(text):
    """Extract 22 hand-crafted NLP features from text. Ported from notebook."""
    text_lower = text.lower()
    words = text_lower.split()
    word_count = len(words) if words else 1

    features = {}

    # Bias lexicon hit counts
    for bias, keywords in BIAS_LEXICONS.items():
        hits = sum(1 for kw in keywords if kw in text_lower)
        features[f'{bias}_hits'] = hits

    # Hedge ratio
    hedge_words = ['might', 'maybe', 'perhaps', 'possibly', 'could', 'uncertain', 'not sure']
    features['hedge_ratio'] = sum(1 for w in words if w in hedge_words) / word_count

    # Certainty ratio
    certainty_words = ['definitely', 'certainly', 'guaranteed', 'absolutely', 'surely', 'obviously', 'clearly']
    features['certainty_ratio'] = sum(1 for w in words if w in certainty_words) / word_count

    # First person ratio
    first_person = ['i', "i'll", "i'm", 'my', 'me', 'mine']
    features['first_person_ratio'] = sum(1 for w in words if w in first_person) / word_count

    # Question marks
    features['question_count'] = text.count('?')

    # Sentence count
    features['sentence_count'] = max(1, len(re.split(r'[.!?]+', text)))

    # Average sentence length
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    features['avg_sentence_len'] = np.mean([len(s.split()) for s in sentences]) if sentences else 0

    # Word count
    features['word_count'] = len(words)

    # Positive signal features
    features['has_clear_owner'] = int(any(
        re.search(p, text) for p in POSITIVE_SIGNALS['clear_ownership']
    ))
    features['evidence_based_hits'] = sum(
        1 for p in POSITIVE_SIGNALS['evidence_based'] if re.search(p, text_lower)
    )
    features['alternatives_mentioned'] = int(any(
        re.search(p, text_lower) for p in POSITIVE_SIGNALS['alternatives_considered']
    ))

    # Decision language density
    decision_words = ['decide', 'decision', 'chose', 'chosen', 'selected', 'agreed', 'approved']
    features['decision_word_density'] = sum(1 for w in words if w in decision_words) / word_count

    # Negation count
    negations = ['not', "don't", "doesn't", "won't", "can't", "shouldn't", 'never', 'no']
    features['negation_count'] = sum(1 for w in words if w in negations)

    # Unique word ratio
    features['unique_word_ratio'] = len(set(words)) / word_count if words else 0

    # Exclamation count
    features['exclamation_count'] = text.count('!')

    return features


# ─── Dataset building (Section 3 of notebook) ──────────────────────────────────

def _generate_structured_fallback():
    """Generate a structured fallback dataset when real datasets fail to load."""
    templates = {
        "anchoring": [
            "Our initial estimate was {n} weeks and we're sticking with that baseline.",
            "Going back to our original plan, we're not changing the {n}-week timeline.",
            "The starting point was ${n}k — let's anchor on that.",
            "As we said before, the first impression was {n} days.",
            "We already decided on the preliminary number of {n}.",
        ],
        "groupthink": [
            "Everyone agrees this is the right approach. No need to debate.",
            "We're all on the same page — unanimous consensus.",
            "Obviously, the group thinks this is the best option.",
            "It goes without saying — collective agreement.",
            "Clearly everyone shares this common understanding.",
        ],
        "missing_objections": [
            "No concerns here — this plan is foolproof and risk-free.",
            "Nothing could go wrong, it's perfectly safe.",
            "No downsides — everything is fine, smooth sailing.",
            "Zero risk — no obstacles or barriers.",
            "What could possibly go wrong? No issues at all.",
        ],
        "overconfidence": [
            "This is guaranteed to succeed — no doubt about it.",
            "100 percent certain — can't miss, it's a sure thing.",
            "No way this fails — absolutely certain it will work.",
            "Inevitable success — beyond doubt, undoubtedly.",
            "This is a slam dunk — no chance of failure.",
        ],
        "vague_ownership": [
            "Someone should handle this. The team will figure it out.",
            "It needs to happen — TBD who takes it.",
            "Somebody will take care of it. Pending assignment.",
            "We need to do this. To be determined.",
            "Whoever is available — anyone can handle it.",
        ],
        "healthy": [
            "I'll own the backend migration. We considered Azure and GCP — the data shows GCP is faster. One concern: migration risk. We'll run a 2-week pilot. James handles client comms by Thursday.",
            "Sarah takes point on the API redesign. We evaluated three approaches and picked the one with best latency metrics. The risk is backward compatibility — Tom will run regression tests by Wednesday.",
            "I'm responsible for the data pipeline. According to our benchmarks, the new system processes 3x faster. We weighed the pros and cons of two vendors. Alex reviews the security audit by Friday.",
            "Mike owns the deployment schedule. Based on the data, a phased rollout reduces risk by 40%. We considered big-bang vs. incremental — incremental wins. Lisa handles stakeholder comms by Monday.",
            "I will handle the frontend refactor. Research indicates React outperforms our current stack by 2x. Alternatively, we could use Vue — but team expertise favors React. Anna does the code review by Thursday.",
        ]
    }

    rows = []
    import random
    random.seed(42)

    for bias_type, bias_templates in templates.items():
        for _ in range(80):
            tpl = random.choice(bias_templates)
            n = random.randint(2, 52)
            text = tpl.format(n=n)
            labels = {b: 0 for b in BIAS_COLS}
            if bias_type != "healthy":
                labels[bias_type] = 1
            row = {"text": text, **labels}
            rows.append(row)

    return pd.DataFrame(rows)


def build_dataset():
    """Build the training dataset from structured examples. No external downloads needed."""
    logger.info("Generating training dataset...")
    all_rows = []

    # --- Structured fallback dataset (expanded) ---
    fallback_df = _generate_structured_fallback()
    all_rows.extend(fallback_df.to_dict("records"))
    logger.info(f"Generated {len(fallback_df)} training examples")

    df = pd.DataFrame(all_rows)
    logger.info(f"Total dataset: {len(df)} samples")
    return df


# ─── Model training (Section 5 of notebook) ────────────────────────────────────

class DecisionQualityAuditor:
    """Encapsulates the full Decision Quality Auditor pipeline."""

    MODEL_FILE = os.path.join(os.path.dirname(__file__), "decision_quality_model.pkl")

    def __init__(self):
        self.model = None
        self.tfidf = None
        self.feature_cols = None
        self.trained = False

    def load_or_train(self):
        """Load model from cache or train from scratch."""
        if os.path.exists(self.MODEL_FILE):
            logger.info(f"Loading cached model from {self.MODEL_FILE}")
            try:
                with open(self.MODEL_FILE, "rb") as f:
                    bundle = pickle.load(f)
                self.model = bundle["model"]
                self.tfidf = bundle["tfidf"]
                self.feature_cols = bundle["feature_cols"]
                self.trained = True
                logger.info("Model loaded successfully")
                return
            except Exception as e:
                logger.warning(f"Failed to load cached model: {e}. Retraining...")

        self._train()

    def _train(self):
        """Train the model from scratch using the notebook's pipeline."""
        logger.info("Building dataset...")
        df = build_dataset()

        # Ensure bias columns exist
        for col in BIAS_COLS:
            if col not in df.columns:
                df[col] = 0

        # Extract features
        logger.info("Extracting features...")
        feature_records = df["text"].apply(extract_features).tolist()
        feature_df = pd.DataFrame(feature_records)
        self.feature_cols = list(feature_df.columns)

        # TF-IDF
        logger.info("Building TF-IDF matrix...")
        self.tfidf = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 3),
            stop_words="english"
        )
        X_tfidf = self.tfidf.fit_transform(df["text"])

        # Combine TF-IDF + hand-crafted features
        X_manual = csr_matrix(feature_df.values)
        X_combined = hstack([X_tfidf, X_manual])
        y = df[BIAS_COLS].values

        # Train MultiOutput RandomForest
        logger.info("Training MultiOutput RandomForest...")
        base_clf = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        )
        self.model = MultiOutputClassifier(base_clf)
        self.model.fit(X_combined, y)
        self.trained = True
        logger.info("Model trained successfully!")

        # Cache model
        try:
            bundle = {
                "model": self.model,
                "tfidf": self.tfidf,
                "feature_cols": self.feature_cols,
            }
            with open(self.MODEL_FILE, "wb") as f:
                pickle.dump(bundle, f)
            logger.info(f"Model cached to {self.MODEL_FILE}")
        except Exception as e:
            logger.warning(f"Failed to cache model: {e}")

    def audit_decision(self, text):
        """Audit a single text snippet for cognitive biases. Returns score + biases + recs."""
        if not self.trained:
            raise RuntimeError("Model not trained yet. Call load_or_train() first.")

        # Extract features
        feats = extract_features(text)
        feat_values = [feats.get(col, 0) for col in self.feature_cols]
        feat_vec = csr_matrix([feat_values])

        # TF-IDF
        tfidf_vec = self.tfidf.transform([text])

        # Combine
        X_input = hstack([tfidf_vec, feat_vec])

        # Predict biases
        proba_list = self.model.predict_proba(X_input)
        bias_probas = {}
        for i, col in enumerate(BIAS_COLS):
            classes = self.model.estimators_[i].classes_
            proba = proba_list[i][0]
            if 1 in classes:
                idx = list(classes).index(1)
                bias_probas[col] = float(proba[idx])
            else:
                bias_probas[col] = 0.0

        # Calculate decision health score
        penalty = 0
        detected_biases = []
        for bias, weight in BIAS_WEIGHTS.items():
            prob = bias_probas[bias]
            if prob > 0.45:  # Threshold
                detected_biases.append(bias)
                penalty += weight * prob

        # Bonus for positive signals
        bonus = 0
        if feats.get('has_clear_owner'):
            bonus += 5
        if feats.get('alternatives_mentioned'):
            bonus += 5
        if feats.get('evidence_based_hits', 0) > 0:
            bonus += 5

        score = max(0, min(100, 100 - penalty + bonus))

        # Generate recommendations
        recommendations = []
        if 'missing_objections' in detected_biases:
            recommendations.append("Ask: 'What could go wrong?' before finalizing.")
        if 'groupthink' in detected_biases:
            recommendations.append("Assign a devil's advocate to surface dissenting views.")
        if 'vague_ownership' in detected_biases:
            recommendations.append("Name a specific owner with a deadline before closing.")
        if 'overconfidence' in detected_biases:
            recommendations.append("Add a pre-mortem: assume this fails — why did it?")
        if 'anchoring' in detected_biases:
            recommendations.append("Re-evaluate from scratch — ignore the initial estimate.")

        return {
            "score": round(score, 1),
            "detected_biases": detected_biases,
            "bias_probabilities": {k: round(v, 3) for k, v in bias_probas.items()},
            "recommendations": recommendations
        }

    def find_decision_blocks(self, transcript_entries, window=5):
        """
        Identify decision-making windows in a transcript.
        Input: list of {speaker, text, timestamp} dicts
        Returns: list of decision block dicts
        """
        decision_blocks = []
        texts = [e["text"] for e in transcript_entries]

        for i, text in enumerate(texts):
            if any(trigger in text.lower() for trigger in DECISION_TRIGGERS):
                start = max(0, i - 2)
                end = min(len(texts), i + window)
                block_text = " ".join(texts[start:end])
                block_time = transcript_entries[i].get("timestamp", "")
                decision_blocks.append({
                    "trigger_text": text,
                    "block_text": block_text,
                    "timestamp": block_time,
                    "speaker": transcript_entries[i].get("speaker", "Unknown")
                })

        return decision_blocks

    def audit_full_transcript(self, transcript_entries):
        """
        Full transcript audit — returns meeting-level report.
        Input: list of {speaker, text, timestamp} dicts
        """
        blocks = self.find_decision_blocks(transcript_entries)

        if not blocks:
            return {
                "message": "No decision moments detected in transcript.",
                "decisions": [],
                "meeting_score": 100,
                "total_decisions": 0,
                "most_common_bias": None
            }

        audited = []
        for block in blocks:
            result = self.audit_decision(block["block_text"])
            audited.append({
                "timestamp": block["timestamp"],
                "speaker": block["speaker"],
                "trigger": block["trigger_text"][:80],
                **result
            })

        avg_score = float(np.mean([a["score"] for a in audited]))
        all_biases = [b for a in audited for b in a["detected_biases"]]

        bias_frequency = Counter(all_biases)

        return {
            "meeting_score": round(avg_score, 1),
            "total_decisions": len(audited),
            "most_common_bias": (
                {"name": bias_frequency.most_common(1)[0][0],
                 "count": bias_frequency.most_common(1)[0][1]}
                if bias_frequency else None
            ),
            "decisions": audited
        }

    def audit_per_speaker(self, transcript_entries):
        """
        Per-speaker audit — groups captions by speaker, audits each speaker's combined text.
        Returns a list of per-speaker audit results.
        """
        # Group captions by speaker
        speaker_texts = {}
        speaker_caption_count = {}
        for entry in transcript_entries:
            speaker = entry.get("speaker", "Unknown")
            text = entry.get("text", "")
            if speaker not in speaker_texts:
                speaker_texts[speaker] = []
                speaker_caption_count[speaker] = 0
            speaker_texts[speaker].append(text)
            speaker_caption_count[speaker] += 1

        speaker_audits = []
        for speaker, texts in speaker_texts.items():
            combined_text = " ".join(texts)
            if len(combined_text.split()) < 5:
                # Skip very short text
                speaker_audits.append({
                    "speaker": speaker,
                    "caption_count": speaker_caption_count[speaker],
                    "score": 100,
                    "detected_biases": [],
                    "bias_probabilities": {b: 0.0 for b in BIAS_COLS},
                    "recommendations": [],
                    "message": "Insufficient text for analysis"
                })
                continue

            result = self.audit_decision(combined_text)
            speaker_audits.append({
                "speaker": speaker,
                "caption_count": speaker_caption_count[speaker],
                **result
            })

        # Sort by score ascending (worst first)
        speaker_audits.sort(key=lambda x: x["score"])

        return speaker_audits
