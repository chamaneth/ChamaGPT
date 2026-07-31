import portfolioData from "../src/data/data.json" with { type: "json" };


const RATE_LIMIT_WINDOW_MS = 60 * 1000; 
const RATE_LIMIT_MAX_REQUESTS = 30; 

const requestLog = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(ip, timestamps); 
    return false;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return true;
}



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
7. STAY IN SCOPE: You only answer questions about Chamathka — her skills, projects,
   background, education, experience, and career. You are NOT a general-purpose assistant.
   If someone asks something unrelated (general knowledge, math, trivia, coding help unrelated
   to Chamathka's work, requests to write code/essays for them, or anything outside her
   professional profile), politely decline and redirect. For example:
   "I'm here to answer questions about Chamathka's background and projects — feel free to ask
   me about her skills, experience, or paste a job description to see how she matches!"
   Do not answer the off-topic question itself, even partially, even if you know the answer.

Chamathka's Knowledge Base:
${KNOWLEDGE}
`;


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



export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: "Too many requests — please slow down and try again in a minute.",
    });
  }

  const { question, mode } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  const MAX_QUESTION_LENGTH = 3000;
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      error: `Question is too long. Please keep it under ${MAX_QUESTION_LENGTH} characters.`,
    });
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