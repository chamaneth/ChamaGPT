import JobMatchCard from './JobMatchCard';

export default function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="bubble bubble-user">{msg.content}</div>
      </div>
    );
  }

  if (msg.type === 'job_match' && msg.data) {
    return (
      <div className="msg msg-bot">
        <div className="avatar">CG</div>
        <div className="bubble bubble-bot">
          <JobMatchCard data={msg.data} />
        </div>
      </div>
    );
  }

  return (
    <div className="msg msg-bot">
      <div className="avatar">CG</div>
      <div className="bubble bubble-bot">{msg.content}</div>
    </div>
  );
}
