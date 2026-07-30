export default function JobMatchCard({ data }) {
  const verdictColor = {
    'Strong Match': '#0f6e56',
    'Good Match': '#185fa5',
    'Partial Match': '#ba7517',
    'Not a Match': '#a32d2d'
  };

  const verdictBg = {
    'Strong Match': '#e1f5ee',
    'Good Match': '#e6f1fb',
    'Partial Match': '#faeeda',
    'Not a Match': '#fcebeb'
  };

  const color = verdictColor[data.verdict] ?? '#5f5e5a';
  const bg = verdictBg[data.verdict] ?? '#f1efe8';

  return (
    <div className="job-match-card">
      <div className="match-header">
        <div className="match-score-wrap">
          <svg viewBox="0 0 44 44" className="score-ring">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e5e5" strokeWidth="4" />
            <circle
              cx="22" cy="22" r="18" fill="none"
              stroke={color} strokeWidth="4"
              strokeDasharray={`${(data.matchScore / 100) * 113} 113`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="score-num">{data.matchScore}%</span>
        </div>
        <div className="match-summary-wrap">
          <span className="verdict-badge" style={{ color, background: bg }}>{data.verdict}</span>
          <p className="match-summary">{data.summary}</p>
        </div>
      </div>

      <div className="match-sections">
        <div className="match-section">
          <h4>Matched skills</h4>
          <div className="tags">
            {data.matchedSkills.map(s => (
              <span key={s} className="tag tag-green">{s}</span>
            ))}
          </div>
        </div>

        {data.matchedProjects?.length > 0 && (
          <div className="match-section">
            <h4>Relevant projects</h4>
            {data.matchedProjects.map(p => (
              <div key={p.name} className="project-row">
                <span className="project-name">{p.name}</span>
                <span className="project-relevance">{p.relevance}</span>
              </div>
            ))}
          </div>
        )}

        {data.gaps?.length > 0 && (
          <div className="match-section">
            <h4>Gaps / things to address</h4>
            <div className="tags">
              {data.gaps.map(g => (
                <span key={g} className="tag tag-amber">{g}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
