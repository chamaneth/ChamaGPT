import portfolioData from "../src/data/data.json" with { type: "json" };



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
   even if the detailed profile text below describes it as an area still being deepened.
   Growing experience is still experience, not a gap.
3. Only put something in "gaps" if it does NOT appear anywhere in the skills list
   or the detailed profile below.
4. Do not infer gaps from cautious or humble language in the profile text
   (e.g. "still improving", "learning environments") — that describes tone, not absence of skill.

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

Chamathka's Detailed Profile:
${KNOWLEDGE}
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
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 1800,
          ...(isJobMatch && { response_format: { type: "json_object" } }),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Groq Error:", errorText);
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