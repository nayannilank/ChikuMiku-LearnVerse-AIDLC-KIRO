
# 1. OCR Module (Textbook Scanning)

## Purpose

* Extract text from textbook photos
* Kannada
* Hindi
* English
* Maths notation

### Recommended

#### Option 1 (Recommended)

Google Vision OCR

Pros:

* Excellent Kannada support
* Excellent Hindi support
* Excellent English support
* Mathematical symbols

Cons:

* Pay per usage

### Alternative

Open-source OCR

* PaddleOCR

Pros:

* Free

Cons:

* Requires GPU server
* More maintenance

### Recommendation

Start with:

```text
Google Vision OCR
```

Do not build OCR yourself.

---

# 2. Embedding Module

Purpose:

```text
Chapter Storage
Question Answering
Revision
Similarity Search
```

### Recommended

OpenAI Embeddings

Example:

```text
text-embedding-3-small
```

Pros:

* Extremely cheap
* High quality
* Small storage footprint

Store in:

```text
pgvector
```

inside PostgreSQL.

No Pinecone needed.

---

# 3. Question Answering Engine

Requirement:

```text
Ask chapter questions
Generate answers
Generate hints
Explain concepts
```

### Recommended

Use:

```text
GPT-5 Mini
```

(or equivalent low-cost reasoning model)

Reason:

* Very cheap
* Good educational quality
* Fast

Do NOT use premium reasoning models here.

---

# 4. Revision Question Generator

Requirement:

```text
Generate tests
Generate MCQs
Generate short answers
Generate fill-in-the-blanks
```

### Recommended

GPT-5 Mini

Generate once.

Store permanently.

Important:

```text
Generate once
Reuse forever
```

Never regenerate the same chapter repeatedly.

This alone can reduce AI costs by 70%.

---

# 5. Grammar Engine

Requirement:

```text
Sentence correction
Grammar feedback
Grade-specific explanation
```

### Recommended

GPT-5 Mini

Prompt:

```text
Act as a Grade 3 Kannada teacher.
```

No need for larger models.

---

# 6. Pronunciation Engine

This is where most people overspend.

### Audio Playback

Use:

```text
Google Text-to-Speech
```

Generate once.

Store MP3.

Serve from CDN.

Cost nearly zero.

---

### Pronunciation Evaluation

Use:

```text
Whisper
```

Pipeline:

```text
Student Speech

↓

Transcription

↓

Compare With Expected Word

↓

Score
```

No custom speech model required.

---

# 7. Chapter Summarization

Requirement:

```text
Key Points
Important Concepts
Exam Preparation
```

Use:

```text
GPT-5 Mini
```

Generate once after chapter upload.

Store permanently.

---

# 8. Answer Evaluation

Requirement:

```text
Student Answer

↓

Evaluate

↓

Score

↓

Feedback
```

Use:

```text
GPT-5 Mini
```

Prompt:

```text
Grade as a CBSE Grade 4 teacher.
```

---

# 9. Translation Engine

For:

```text
Kannada ↔ English
Hindi ↔ English
```

Use:

```text
GPT-5 Mini
```

Avoid separate translation services initially.

---

# 10. Analytics & Insights

Requirement:

```text
Weak Topics
Strong Topics
Study Recommendations
```

Do NOT use LLM.

Use rules.

Example:

```text
Score < 60

⇒ Weak Topic
```

Almost free.

---

# 11. Content Recommendation Engine

Requirement:

```text
What should I revise next?
```

Do NOT use AI.

Use:

```text
Rule Engine
```

Example:

```text
Low score

+

High recency gap

=

Recommend
```

---

# 12. Subject Module Framework

For each subject create:

```typescript
interface SubjectModule {

  ocrRules

  promptTemplates

  questionTemplates

  answerTemplates

  revisionTemplates

}
```

No AI retraining required.

Adding Science later becomes configuration.

---

# Database Components

| Component       | Technology       |
| --------------- | ---------------- |
| Relational Data | PostgreSQL       |
| Vector Search   | pgvector         |
| Cache           | Redis (optional) |
| Images          | S3               |
| Audio           | S3               |
| CDN             | CloudFront       |

---

# Cost Optimization Rules

### Rule 1

Never send textbook images to LLM.

```text
Image

↓

OCR

↓

Text

↓

LLM
```

---

### Rule 2

Never regenerate content.

Store:

```text
Summary
Questions
Answers
Hints
Pronunciation Assets
```

---

### Rule 3

Use RAG.

Never send:

```text
Entire Chapter
```

Send:

```text
Top 5 Relevant Paragraphs
```

---

### Rule 4

Use AI only where intelligence is required.

Use rules for:

* Progress tracking
* Recommendations
* Analytics
* Dashboard generation
* Weak-area detection

---

# Final Recommended AI Stack

| Capability         | Component                     |
| ------------------ | ----------------------------- |
| OCR                | Google Vision OCR             |
| Embeddings         | OpenAI text-embedding-3-small |
| Question Answering | GPT-5 Mini                    |
| Revision Generator | GPT-5 Mini                    |
| Grammar            | GPT-5 Mini                    |
| Translation        | GPT-5 Mini                    |
| Chapter Summary    | GPT-5 Mini                    |
| Answer Evaluation  | GPT-5 Mini                    |
| Speech Recognition | Whisper                       |
| Text-to-Speech     | Google TTS                    |
| Vector Search      | pgvector                      |
| AI Gateway         | Custom Node.js Service        |

If I were funding this product myself, I would avoid expensive services like Pinecone, Anthropic premium models, custom fine-tuning, custom speech models, and GPU-hosted open-source LLMs until you exceed **50,000–100,000 users**. For your target scale, a serverless RAG architecture with GPT-5 Mini + Vision OCR + Whisper will give the best balance of cost, quality, and simplicity.