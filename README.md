# 📚 ChikuMiku LearnVerse

<!-- Logo placeholder -->
<p align="center">
  <img src="docs/ChikuMiku-LearnVerse-Logo.png" alt="ChikuMiku LearnVerse Logo" width="200" />
</p>

<p align="center">
  <strong>Where Curiosity Comes Alive</strong>
</p>

<p align="center">
  An AI-powered learning platform for students from LKG to 12th Grade. Digitize textbooks via OCR, get AI-generated explanations, practice pronunciation, solve grammar exercises, take revision quizzes, and track progress — all within a safe, parent-monitored environment.
</p>

---

## ✨ Key Features

- 📷 **Textbook Digitization** — Scan pages with your camera, OCR extracts the text automatically
- 🧠 **AI Explanations** — Page-by-page summaries, keywords, and concepts powered by GPT-5 Mini
- 🗣️ **Pronunciation Practice** — Listen, speak, and get scored with Google TTS + Whisper
- ✏️ **Grammar Exercises** — Language-specific exercises generated from your content
- ❓ **Chapter Q&A** — Ask any question about your chapter, powered by RAG
- 📝 **Revision Quizzes** — Auto-generated quizzes at Easy, Medium, and Hard levels
- 🔥 **Streak Tracking** — Stay motivated with daily activity streaks
- 👨‍👩‍👧 **Parent Dashboard** — Monitor progress, manage learners, receive alerts
- 📶 **Offline-First** — Works without internet, syncs when you reconnect
- 🎨 **7 Subjects** — Maths, Science, English, Hindi, Kannada, Computers, EVS + custom subjects

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Mobile | React Native / Capacitor |
| Backend | AWS Lambda (Node.js), API Gateway |
| Database | Neon PostgreSQL + pgvector |
| Auth | Amazon Cognito (JWT) |
| AI | GPT-5 Mini, Google Vision OCR, Whisper, Google TTS, OpenAI Embeddings |
| Infrastructure | AWS CDK (8 stacks), ap-south-1 |
| Frontend Hosting | Vercel (Edge CDN) |
| CI/CD | GitHub Actions → CDK deploy, Vercel auto-deploy |
| Testing | Jest, fast-check (property-based testing) |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ChikuMiku-LearnVerse-AIDLC-KIRO

# Install all dependencies
npm install

# Build all packages
npm run build

# Start the web dev server
cd clients/web && npx vite dev
```

> Requires Node.js 22+ and npm 10+

---

## 📸 Screenshots

<!-- Screenshot placeholders -->
| Landing Page | Learner Dashboard | Chapter Creation |
|:---:|:---:|:---:|
| *screenshot* | *screenshot* | *screenshot* |

| Pronunciation Practice | Revision Quiz | Parent Dashboard |
|:---:|:---:|:---:|
| *screenshot* | *screenshot* | *screenshot* |

---

## 📁 Project Structure

```
ChikuMiku-LearnVerse-AIDLC-KIRO/
├── shared/
│   ├── types/              # Shared TypeScript interfaces
│   └── validation/         # Zod validation schemas
├── services/
│   ├── auth/               # Authentication Lambda
│   ├── content/            # Content ingestion Lambda
│   ├── learning/           # Progress & streaks Lambda
│   ├── ai-gateway/         # AI routing Lambda
│   └── export/             # Report generation Lambda
├── clients/
│   ├── web/                # React 19 + Vite web app
│   └── mobile/             # React Native mobile app
├── infra/
│   ├── src/stacks/         # 8 CDK stack definitions
│   └── migrations/         # Neon PostgreSQL schema
├── docs/                   # Documentation
└── .github/workflows/      # CI/CD pipelines
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/USER_GUIDE.md) | End-user guide for parents and learners |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Setup, architecture, deployment for engineers |
| [Design Guide](docs/DESIGN_GUIDE.md) | Design system, data model, AI services, correctness properties |

---

## 📄 License

<!-- License placeholder -->
This project is proprietary. All rights reserved.

---

## 🤝 Contributing

<!-- Contributing placeholder -->
Contributions are welcome! Please read the following before submitting changes:

1. Fork the repository and create a feature branch
2. Follow the existing code style and conventions
3. Write tests for new functionality (including property-based tests)
4. Ensure `npm run build` and `npm test` pass
5. Submit a pull request with a clear description of changes

For questions or discussions, open an issue.

---

<p align="center">
  Made with ❤️ for curious minds everywhere
</p>
