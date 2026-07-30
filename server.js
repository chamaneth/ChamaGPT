import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portfolioData = JSON.parse(
  readFileSync(join(__dirname, 'src/data/data.json'), 'utf-8')
);

function buildKnowledge(data) {
  return Object.entries(data)
    .map(([category, items]) => {
      const qa = items.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n');
      return `[${category}]\n${qa}`;
    })
    .join('\n\n');
}

const KNOWLEDGE = buildKnowledge(portfolioData);

const SYSTEM_PROMPT = `You are ChamaGPT, the AI portfolio assistant of Chamathka Nethmini.
Answer questions about her in a warm, professional, and friendly tone.
Always answer in first person as if you are Chamathka speaking.
Only answer based on the information below. If something is not covered, say you'd love to share more in person.

Here is everything you know about Chamathka:
${KNOWLEDGE}`;

const JOB_MATCH_PROMPT = `You are ChamaGPT, the AI portfolio assistant of Chamathka Nethmini.
A recruiter has shared a job description. Analyze it and match Chamathka's skills and projects to the role.

Here is everything you know about Chamathka:
${KNOWLEDGE}

Respond in this EXACT JSON format (no markdown, no extra text):
{
  "summary": "2-3 sentence overview of how well Chamathka fits this role",
  "matchScore": <number 0-100>,
  "matchedSkills": ["skill1", "skill2", ...],
  "matchedProjects": [
    { "name": "project name", "relevance": "one sentence why it's relevant" }
  ],
  "gaps": ["gap1", "gap2"],
  "verdict": "Strong Match | Good Match | Partial Match | Not a Match"
}`;

function detectJobDescription(text) {
  const jdKeywords = [
    'responsibilities', 'requirements', 'qualifications', 'we are looking for',
    'job description', 'role', 'position', 'candidate', 'experience required',
    'must have', 'nice to have', 'what you will do', 'about the role',
    'years of experience', 'bachelor', 'degree', 'salary', 'benefits',
    'full-time', 'part-time', 'remote', 'hybrid', 'apply'
  ];
  const lower = text.toLowerCase();
  const hits = jdKeywords.filter(k => lower.includes(k));
  return hits.length >= 3;
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ask', async (req, res) => {
  const { question, mode } = req.body ?? {};

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
  }

  const isJobMatch = mode === 'job_match' || detectJobDescription(question);

  const messages = [
    {
      role: 'system',
      content: isJobMatch ? JOB_MATCH_PROMPT : SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: isJobMatch
        ? `Here is the job description:\n\n${question}`
        : question
    }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 800,
        temperature: 0.7,
        ...(isJobMatch ? { response_format: { type: 'json_object' } } : {})
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: `Groq error: ${err}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    if (isJobMatch) {
      try {
        const parsed = JSON.parse(content);
        return res.status(200).json({ type: 'job_match', data: parsed });
      } catch {
        return res.status(200).json({ type: 'chat', answer: content });
      }
    }

    return res.status(200).json({ type: 'chat', answer: content });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ChamaGPT backend running on http://localhost:${PORT}`);
});