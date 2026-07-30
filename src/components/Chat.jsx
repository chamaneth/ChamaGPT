import { useState, useRef, useEffect } from 'react';
import { Linkedin, Github, Mail, ArrowUpRight } from 'lucide-react';
import Message from './Message';

const SUGGESTIONS = [
  "Who are you?",
  "What are your skills?",
  "Tell me about your projects",
  "What motivates you?",
];

const CONTACTS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/chamathka-nethmini-wije/', Icon: Linkedin },
  { label: 'GitHub', href: 'https://github.com/chamaneth', Icon: Github },
  { label: 'Email', href: 'mailto:nethmi.singhe@gmail.com', Icon: Mail },
];

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: "Hi! I'm ChamaGPT 👋 Ask me anything about Chamathka — her skills, projects, background, or paste a job description to see how she matches!",
      type: 'chat'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isJD, setIsJD] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function detectJD(text) {
    const keywords = ['responsibilities','requirements','qualifications','we are looking for',
      'job description','position','candidate','must have','years of experience',
      'bachelor','full-time','remote','hybrid','apply','salary'];
    const hits = keywords.filter(k => text.toLowerCase().includes(k));
    return hits.length >= 3;
  }

  function handleInput(e) {
    setInput(e.target.value);
    setIsJD(detectJD(e.target.value));
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  }

  async function send(text, mode) {
    const q = text ?? input.trim();
    if (!q || loading) return;
    setInput('');
    setIsJD(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, mode: mode ?? (detectJD(q) ? 'job_match' : 'chat') })
      });

      const data = await res.json();

      if (data.type === 'job_match') {
        setMessages(prev => [...prev, { role: 'bot', type: 'job_match', data: data.data }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', type: 'chat', content: data.answer ?? data.error }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', type: 'chat', content: "Oops, something went wrong. Try again!" }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const showSuggestions = messages.length === 1;

  return (
    <div className="app-shell">
      {/* Full-bleed header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <div className="header-avatar">CG</div>
            <div>
              <p className="header-name">ChamaGPT</p>
              <p className="header-sub">Chamathka's AI portfolio assistant</p>
            </div>
          </div>

          <div className="header-right">
            <a
              href="https://chamathka-nethmini.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="chamagoogle-badge"
            >
              <span>ChamaGoogle</span>
              <ArrowUpRight size={14} strokeWidth={2} />
            </a>

            <nav className="header-contacts" aria-label="Contact links">
              {CONTACTS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                  aria-label={label}
                  title={label}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Chat content — full-bleed background, readable inner column */}
      <main className="chat-main">
        <div className="chat-column">
          <div className="messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}

            {showSuggestions && (
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => send(s, 'chat')}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="msg msg-bot">
                <div className="avatar">CG</div>
                <div className="bubble bubble-bot typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="input-area">
            {isJD && (
              <div className="jd-banner">
                <span>📋 Job description detected</span>
                <div className="jd-actions">
                  <button onClick={() => send(undefined, 'job_match')} className="btn-match">Match my skills ✦</button>
                  <button onClick={() => send(undefined, 'chat')} className="btn-chat-instead">Just chat</button>
                </div>
              </div>
            )}
            <div className="input-row">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKey}
                placeholder="Ask anything or paste a job description…"
                className="chat-input"
              />
              <button
                className="send-btn"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Full-bleed footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <span className="footer-name">© {new Date().getFullYear()} Chamathka Nethmini</span>
          <div className="footer-links">
            {CONTACTS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                <Icon size={16} strokeWidth={1.75} />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}