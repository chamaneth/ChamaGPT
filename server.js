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
    const chunks = [];

    function extract(obj, path = "General") {
        if (!obj) return;

        if (Array.isArray(obj)) {
            obj.forEach(item => {

                if (item.question && item.answer) {
                    chunks.push(
                        `[${path}]
Q: ${item.question}
A: ${item.answer}`
                    );
                }

                extract(item, path);
            });
        }

        else if (typeof obj === "object") {

            Object.entries(obj).forEach(([key, value]) => {

                extract(
                    value,
                    path === "General"
                        ? key
                        : `${path} > ${key}`
                );

            });

        }
    }

    extract(data);

    return chunks.join("\n\n");
}


const KNOWLEDGE = buildKnowledge(portfolioData);


console.log(
    `Loaded knowledge: ${KNOWLEDGE.length} characters`
);



const SYSTEM_PROMPT = `
You are ChamaGPT, the AI portfolio assistant of Chamathka Nethmini.

Your role:
- Represent Chamathka professionally.
- Answer recruiters, interviewers, and visitors.
- Speak naturally in first person as Chamathka.
- Give detailed but clear answers.
- Use real project examples.
- Never invent experience.

If a question is not covered in the knowledge base, say:
"I'd be happy to discuss more details about that during a conversation."

Knowledge Base:

${KNOWLEDGE}
`;



const JOB_MATCH_PROMPT = `
You are ChamaGPT, an AI recruiter assistant representing Chamathka Nethmini.

Analyze the given job description and compare it with Chamathka's skills,
projects, and experience.

Knowledge Base:

${KNOWLEDGE}


Return ONLY valid JSON:

{
  "summary": "",
  "matchScore": 0,
  "matchedSkills": [],
  "matchedProjects": [],
  "gaps": [],
  "verdict": ""
}
`;



function detectJobDescription(text) {

    const keywords = [
        "responsibilities",
        "requirements",
        "qualifications",
        "experience",
        "candidate",
        "position",
        "role",
        "job description",
        "skills",
        "must have",
        "nice to have",
        "apply"
    ];


    const lower = text.toLowerCase();

    const matches = keywords.filter(word =>
        lower.includes(word)
    );


    return matches.length >= 3;
}




const app = express();

app.use(cors());
app.use(express.json());



app.post('/api/ask', async (req, res) => {

    const { question, mode } = req.body ?? {};


    if (!question?.trim()) {
        return res.status(400).json({
            error: "Question is required"
        });
    }



    if (!process.env.GROQ_API_KEY) {

        return res.status(500).json({
            error: "GROQ_API_KEY missing"
        });

    }



    const isJobMatch =
        mode === "job_match" ||
        detectJobDescription(question);



    const messages = [

        {
            role: "system",
            content: isJobMatch
                ? JOB_MATCH_PROMPT
                : SYSTEM_PROMPT
        },


        {
            role: "user",
            content: isJobMatch
                ? `Job Description:\n${question}`
                : question
        }

    ];



    try {


        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Authorization":
                        `Bearer ${process.env.GROQ_API_KEY}`

                },


                body: JSON.stringify({

                    model: "llama-3.3-70b-versatile",

                    messages,

                    temperature: 0.7,

                    max_tokens: 1200,


                    ...(isJobMatch
                        ? {
                            response_format: {
                                type: "json_object"
                            }
                        }
                        : {})

                })

            }
        );



        if (!response.ok) {

            const error =
                await response.text();


            console.error(
                "Groq Error:",
                error
            );


            return res.status(502).json({
                error
            });

        }



        const result =
            await response.json();


        const answer =
            result.choices?.[0]?.message?.content || "";



        if (isJobMatch) {

            try {

                return res.json({

                    type: "job_match",

                    data: JSON.parse(answer)

                });

            }

            catch {

                return res.json({

                    type: "chat",

                    answer

                });

            }

        }



        return res.json({

            type: "chat",

            answer

        });



    }


    catch (error) {

        console.error(
            "Server Error:",
            error
        );


        return res.status(500).json({

            error: error.message

        });

    }


});




const PORT =
    process.env.PORT || 3001;


app.listen(PORT, () => {

    console.log(
        `ChamaGPT backend running on http://localhost:${PORT}`
    );

});