import portfolioData from "../src/data/data.json" with { type: "json" };

// ===============================
// BUILD KNOWLEDGE FROM JSON (full — used for normal chat)
// ===============================

function buildKnowledge(data) {
  function extract(value, title = "") {
    let output = "";

    if (value === null || value === undefined) return output;

    // STRING / NUMBER
    if (typeof value === "string" || typeof value === "number") {
      output += `\n${title}:\n${value}\n\n`;
      return output;
    }

    // ARRAY
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") {
          output += `- ${item}\n`;
        } else {
          output += extract(item);
        }
      });
      return output;
    }

    // OBJECT
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => {
        const cleanKey = key.replaceAll("_", " ").toUpperCase();

        if (typeof val === "string" || typeof val === "number") {
          output += `\n\n${cleanKey}:\n\n${val}\n\n`;
        } else {
          output += `\n\n===== ${cleanKey} =====\n\n`;
          output += extract(val);
        }
      });
    }

    return output;
  }

  return extract(data);
}

const KNOWLEDGE = buildKnowledge(portfolioData);

// ===============================
// BUILD FLAT SKILLS INDEX
// ===============================
// Pulls every string from any "technologies" array anywhere in the JSON,
// deduplicated. Gives the model an authoritative, unambiguous skills list
// to check job requirements against, instead of relying on it to infer
// skills correctly from long prose.

function buildSkillsIndex(data) {
  const skills = new Set();

  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") {
          skills.add(item);
        } else {
          walk(item);
        }
      });
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => {
        if (key.toLowerCase() === "technologies") {
          walk(val);
        } else if (typeof val === "object") {
          walk(val);
        }
      });
    }
  }

  walk(data);
  return Array.from(skills).sort();
}

const SKILLS_INDEX = buildSkillsIndex(portfolioData);

// ===============================
// BUILD LEAN PROFILE (used for job-match — cuts token usage)
// ===============================
// Job matching only needs: identity, skill summaries, and project
// overviews/technologies. It does NOT need every interview_questions /
// technical_questions array, which make up most of KNOWLEDGE's bulk and
// were pushing single requests to ~9,800 tokens (Groq free tier caps at
// 12,000 TPM, so one request could nearly exhaust the whole budget).

function buildLeanProfile(data) {
  let output = "";

  // Identity
  const identity = data?.Personal?.identity;
  if (identity) {
    output += `IDENTITY:\nName: ${identity.name}\nRole: ${identity.role}\nLocation: ${identity.location}\nStatus: ${identity.current_status}\n\n`;
  }

  // Career profile
  if (data?.Career_Profile?.professional_summary) {
    output += `PROFESSIONAL SUMMARY:\n${data.Career_Profile.professional_summary}\n\n`;
  }

  // Skills — summary + technologies only, skip the "questions" arrays
  if (data?.Skills) {
    output += `===== SKILLS =====\n\n`;
    Object.entries(data.Skills).forEach(([category, val]) => {
      const cleanCategory = category.replaceAll("_", " ").toUpperCase();
      output += `${cleanCategory}:\n`;
      if (val.summary) output += `${val.summary}\n`;
      if (val.technologies) output += `Technologies: ${val.technologies.join(", ")}\n`;
      output += `\n`;
    });
  }

  // Projects (both Projects and Projects_Additional) — overview + tech only
  ["Projects", "Projects_Additional"].forEach((group) => {
    if (!data[group]) return;
    output += `===== ${group.replaceAll("_", " ").toUpperCase()} =====\n\n`;
    Object.entries(data[group]).forEach(([name, project]) => {
      output += `${name.replaceAll("_", " ")}:\n`;
      if (project.overview) output += `${project.overview}\n`;
      const tech = Array.isArray(project.technologies)
        ? project.technologies
        : project.technologies
        ? Object.values(project.technologies).flat()
        : null;
      if (tech) output += `Technologies: ${tech.join(", ")}\n`;
      output += `\n`;
    });
  });

  // Achievements
  if (data?.Achievements) {
    output += `===== ACHIEVEMENTS =====\n\n`;
    data.Achievements.forEach((a) => {
      output += `- ${a.title}: ${a.description}\n`;
    });
    output += `\n`;
  }

  return output;
}

const LEAN_PROFILE = buildLeanProfile(portfolioData);

// ===============================
// NORMAL CHAT PROMPT
// ===============================

const SYSTEM_PROMPT = `
You are ChamaGPT, the AI portfolio assistant representing Chamathka Nethmini.

Your purpose is to answer questions from recruiters, visitors, and interviewers about Chamathka's professional profile.

Personality:
- Professional
- Friendly
- Natural
- Interview-ready

Rules:
1. Always answer in first person as if Chamathka is speaking.
   Example: "I have experience building..." NOT "Chamathka has experience building..."
2. Use real project examples whenever possible.
3. Explain technical concepts clearly.
4. Do not exaggerate experience.
5. If something is not available in the knowledge base, say:
   "I have not specifically worked on that yet, but I am continuously learning and improving in that area."
6. For interview questions, answer using: Situation, Technical explanation, Challenge, Learning.

Chamathka's Knowledge Base:
${KNOWLEDGE}
`;

// ===============================
// JOB MATCH PROMPT (uses the lean profile, not full KNOWLEDGE)
// ===============================

const JOB_MATCH_PROMPT = `
You are an AI recruiter assistant analyzing Chamathka Nethmini's profile against a job description.

COMPLETE VERIFIED SKILLS LIST (Chamathka has hands-on experience with every item below,
even if some are still developing/growing skills):

${SKILLS_INDEX.join(", ")}

MATCHING RULES (follow strictly):
1. Before listing anything under "gaps", check if it appears in the skills list above
   (exact match or close synonym, e.g. "CI/CD pipelines" matches "CI/CD",
   "Generative AI" matches "Generative AI" / "LLMs" / "LangChain").
2. If a skill appears in the list above, it MUST go into "matchedSkills", never "gaps" —
   even if the profile text below describes it as an area still being deepened.
   Growing experience is still experience, not a gap.
3. Only put something in "gaps" if it does NOT appear anywhere in the skills list
   or the profile below.
4. Do not infer gaps from cautious or humble language in the profile text
   (e.g. "still improving", "learning environments") — that describes tone, not absence of skill.
5. Chamathka is a student — every skill she has comes from personal projects, academic
   coursework, and self-directed learning, NOT professional/company work experience.
   Reflect this honestly instead of hiding it:
   - When describing matched skills or projects, note that they were built and demonstrated
     through personal/academic projects (e.g. "demonstrated through her personal project X"),
     since that is the truthful source of the experience.
   - Do not claim or imply professional work experience she does not have.
   - Stay calibrated: avoid inflating the match into a "perfect candidate" summary. If the role
     values professional/team work experience, production-scale systems, or years of experience
     she does not have, it is honest to note that her experience is project-based rather than
     professional — this is a real, minor consideration for an internship match, not a
     disqualifying gap. Mention it as context, not as a blocking weakness.
   - The goal is an honest, credible assessment a recruiter would trust — not maximum flattery.

Analyze:
- Technical skills
- Projects
- Experience
- Technologies
- Missing requirements (only genuine, verified gaps — see rules above)

Return ONLY valid JSON.

Format:
{
  "summary": "",
  "matchScore": 0,
  "verdict": "",
  "matchedSkills": [""],
  "matchedProjects": [
    { "name": "", "relevance": "" }
  ],
  "gaps": [""],
  "recommendation": ""
}

Chamathka's Profile:
${LEAN_PROFILE}
`;

// ===============================
// DETECT JOB POSTING
// ===============================

function detectJobDescription(text) {
  const keywords = [
    "responsibilities",
    "requirements",
    "qualifications",
    "job description",
    "candidate",
    "experience",
    "role",
    "position",
    "skills",
    "apply",
    "benefits",
    "salary",
    "intern",
  ];

  const lower = text.toLowerCase();
  const matches = keywords.filter((word) => lower.includes(word));

  return matches.length >= 3;
}

// ===============================
// GROQ CALL WITH RETRY/BACKOFF ON RATE LIMIT
// ===============================
// Groq's free tier is capped at 12,000 tokens/minute (TPM). When a burst
// of requests (or one large one) hits that cap, Groq returns 429 with a
// "try again in Xs" message. Instead of failing immediately, wait the
// suggested time (or a safe default) and retry once or twice.

async function callGroq(payload, retries = 2) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 429 && retries > 0) {
    const errorBody = await response.json().catch(() => null);
    console.log("Groq rate limit hit, retrying:", errorBody?.error?.message);

    const retryAfterMatch = errorBody?.error?.message?.match(/try again in ([\d.]+)s/);
    const waitMs = retryAfterMatch ? parseFloat(retryAfterMatch[1]) * 1000 : 2000;

    await new Promise((resolve) => setTimeout(resolve, waitMs + 250)); // small buffer
    return callGroq(payload, retries - 1);
  }

  return response;
}

// ===============================
// VERCEL API FUNCTION
// ===============================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, mode } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY" });
  }

  const isJobMatch = mode === "job_match" || detectJobDescription(question);

  const messages = [
    {
      role: "system",
      content: isJobMatch ? JOB_MATCH_PROMPT : SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: isJobMatch
        ? `Analyze this job description:\n\n${question}`
        : question,
    },
  ];

  try {
    const response = await callGroq({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: isJobMatch ? 1000 : 1800,
      ...(isJobMatch && { response_format: { type: "json_object" } }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Groq Error:", errorText);

      if (response.status === 429) {
        return res.status(429).json({
          error: "I'm getting a lot of questions right now — please try again in a few seconds.",
        });
      }

      return res.status(502).json({ error: "Upstream AI service error" });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";

    if (isJobMatch) {
      try {
        return res.status(200).json({
          type: "job_match",
          data: JSON.parse(answer),
        });
      } catch {
        return res.status(200).json({ type: "chat", answer });
      }
    }

    return res.status(200).json({ type: "chat", answer });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}