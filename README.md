# ChamaGPT

Chamathka Nethmini's AI portfolio assistant — built with React + Vite, powered by Groq (Llama 3.3 70B), deployed on Vercel for free.

## Features
- Chat about Chamathka's skills, background, and projects
- Paste a job description → auto-detects and matches her skills/projects
- "Match my skills" button for manual JD analysis
- Visual skill match cards with match score, matched skills, relevant projects, and gaps

## Stack
- **Frontend**: React + Vite
- **API**: Vercel serverless function (`/api/ask.js`)
- **AI**: Groq API (Llama 3.3 70B Versatile) — free tier
- **Deploy**: Vercel (free)

---

## Local development

```bash
npm install
```

Create a `.env.local` file:
```
GROQ_API_KEY=your_groq_api_key_here
```

Get your free Groq API key at https://console.groq.com

Then run:
```bash
npm run dev
```

> Note: For local dev, the `/api/ask.js` serverless function won't run via Vite dev server.  
> Either use `vercel dev` (install Vercel CLI: `npm i -g vercel`) or test on Vercel directly.

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com → New Project → Import your repo
3. Add environment variable: `GROQ_API_KEY` = your key
4. Deploy — done!

---

## Customizing your data

Edit `src/data/data.json` to update your portfolio info.  
The AI reads from this file automatically — no other changes needed.
