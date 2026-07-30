import portfolioData from '../src/data/data.json' with { type: 'json' };

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

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }


  const { question, mode } = req.body;


  if (!question?.trim()) {
    return res.status(400).json({
      error: 'Question is required'
    });
  }


  const isJobMatch =
    mode === 'job_match' ||
    detectJobDescription(question);



  const messages = [
    {
      role: 'system',
      content: isJobMatch
        ? JOB_MATCH_PROMPT
        : SYSTEM_PROMPT
    },

    {
      role: 'user',
      content: isJobMatch
        ? `Here is the job description:\n\n${question}`
        : question
    }
  ];



  try {

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method:'POST',

        headers:{
          'Content-Type':'application/json',

          'Authorization':
            `Bearer ${process.env.GROQ_API_KEY}`
        },


        body: JSON.stringify({

          model:'llama-3.3-70b-versatile',

          messages,

          max_tokens:1200,

          temperature:0.7,


          ...(isJobMatch
            ? {
                response_format:{
                  type:'json_object'
                }
              }
            : {})

        })

      }
    );



    if (!response.ok) {

      const err =
        await response.text();


      console.error(err);


      return res.status(502).json({
        error:`Groq error: ${err}`
      });

    }



    const data =
      await response.json();


    const content =
      data.choices?.[0]?.message?.content ?? "";



    if (isJobMatch) {

      try {

        return res.status(200).json({

          type:'job_match',

          data:JSON.parse(content)

        });

      }

      catch {

        return res.status(200).json({

          type:'chat',

          answer:content

        });

      }

    }



    return res.status(200).json({

      type:'chat',

      answer:content

    });



  }


  catch(err) {

    console.error(err);


    return res.status(500).json({

      error:err.message

    });

  }

}