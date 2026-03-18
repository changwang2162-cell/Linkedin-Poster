# LinkedIn Poster

An AI-powered web application that transforms software projects into professional LinkedIn posts. Upload a ZIP file or import a GitHub repository, and LinkedIn Poster will analyze your project with Claude AI, generate a polished post, and publish it directly to your LinkedIn profile.

## Features

- **Project Upload** — Drag-and-drop ZIP files (up to 50MB) or paste a GitHub repository URL
- **AI Analysis** — Claude AI extracts project name, description, languages, frameworks, key features, and project type with confidence scoring
- **Post Generation** — Automatically creates a professional LinkedIn post (up to 3000 characters) with relevant hashtags
- **Iterative Refinement** — Provide feedback and regenerate until the post matches your voice
- **One-Click Publishing** — Publish directly to LinkedIn via OAuth 2.0 integration
- **Secure Token Storage** — LinkedIn tokens encrypted at rest with AES-256-GCM

## Workflow

```
Upload  →  Analyze  →  Review  →  Publish  →  Complete
```

1. **Upload** — Upload a ZIP or import from GitHub. The app validates files and detects project structure.
2. **Analyze** — AI reads your code, README, and config files to understand what you built. If confidence is low, it asks for additional context.
3. **Review** — A LinkedIn post is generated from the analysis. Edit feedback and regenerate as needed.
4. **Publish** — Connect your LinkedIn account and publish with one click.
5. **Complete** — View your published post on LinkedIn.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Next.js 16, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Database | SQLite via Prisma ORM |
| Auth | LinkedIn OAuth 2.0 |
| Language | TypeScript 5 |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or later)
- A [LinkedIn Developer App](https://www.linkedin.com/developers/) with OAuth 2.0 configured
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone <repository-url>
cd linkedin-poster
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=your-anthropic-api-key
LINKEDIN_CLIENT_ID=your-linkedin-app-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-app-client-secret
ENCRYPTION_SECRET=your-64-char-hex-string
DATABASE_URL=file:./dev.db
```

Generate an encryption secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Run

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm run start
```

**Windows quick-start:**

Double-click `start.bat` — it installs dependencies, sets up the database, builds, and launches the app.

The app runs at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Main workflow UI
│   └── api/                     # API routes
│       ├── upload/              # ZIP upload & GitHub import
│       ├── analyze/             # AI project analysis
│       ├── summary/             # Post generation & regeneration
│       ├── publish/             # LinkedIn publishing
│       └── auth/                # OAuth flow & session management
├── components/
│   ├── upload-step.tsx          # File upload UI
│   ├── analyze-step.tsx         # Analysis results display
│   ├── review-step.tsx          # Post preview & feedback
│   ├── publish-step.tsx         # Publish confirmation
│   ├── step-indicator.tsx       # Progress bar
│   └── workflow-reducer.ts      # State management
├── services/
│   ├── upload.ts                # File validation & processing
│   ├── analyzer.ts              # Context assembly & LLM analysis
│   ├── summary.ts               # Post generation
│   ├── oauth.ts                 # LinkedIn OAuth & token management
│   └── publisher.ts             # LinkedIn API integration
└── lib/
    ├── types.ts                 # Shared TypeScript types
    ├── result.ts                # Result<T, E> error handling
    ├── encryption.ts            # AES-256-GCM encryption
    └── prisma.ts                # Prisma client singleton
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

## Security

- LinkedIn OAuth tokens are encrypted with AES-256-GCM before database storage
- CSRF protection via state parameter in OAuth flow
- HTTP-only cookies for session management
- ZIP uploads are validated for integrity and checked for path traversal
- Automatic token refresh before expiry

## License

This project is private.
