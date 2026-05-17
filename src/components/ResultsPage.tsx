import { Trophy, CheckCircle2, AlertCircle, RotateCcw, Home, Clock, Star } from 'lucide-react';
import { InterviewState } from '../hooks/useInterview';
import { Role } from '../types';

interface ResultsPageProps {
  state: InterviewState;
  role: Role;
  onRetry: () => void;
  onHome: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = score >= 8 ? '#34d399' : score >= 6 ? '#38bdf8' : score >= 4 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score.toFixed(1)}</span>
        <span className="text-xs text-slate-400">/ 10</span>
      </div>
    </div>
  );
}

export default function ResultsPage({ state, role, onRetry, onHome }: ResultsPageProps) {
  const scores = Object.values(state.feedbacks).map(f => f.score);
  const avgScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const minutes = Math.floor(state.elapsedSeconds / 60);
  const secs = state.elapsedSeconds % 60;

  const performance = avgScore >= 8 ? 'Excellent' : avgScore >= 6 ? 'Good' : avgScore >= 4 ? 'Average' : 'Needs Work';
  const performanceColor = avgScore >= 8 ? 'text-emerald-400' : avgScore >= 6 ? 'text-sky-400' : avgScore >= 4 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <Trophy className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Interview Complete</h1>
          <p className="text-slate-400">Here's how you did on your {role} interview</p>
        </div>

        {/* Score card */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 mb-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={avgScore} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-slate-400 text-sm mb-1">Overall Performance</p>
            <p className={`text-3xl font-bold mb-1 ${performanceColor}`}>{performance}</p>
            <div className="flex items-center gap-4 justify-center sm:justify-start mt-3 text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-sky-400" />
                <span>{scores.length} questions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>{minutes}m {secs}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-4 mb-8">
          {state.questions.map((q, i) => {
            const feedback = state.feedbacks[q.id];
            const answer = state.answers[q.id];
            if (!feedback) return null;

            const qScore = feedback.score;
            const scoreColor = qScore >= 8 ? 'text-emerald-400' : qScore >= 6 ? 'text-sky-400' : qScore >= 4 ? 'text-amber-400' : 'text-red-400';

            return (
              <div key={q.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <span className="text-xs text-slate-500 font-medium">Q{i + 1}</span>
                    <p className="text-white text-sm font-medium mt-0.5">{q.text}</p>
                  </div>
                  <span className={`flex-shrink-0 font-bold text-lg ${scoreColor}`}>{qScore.toFixed(1)}</span>
                </div>

                {answer && (
                  <p className="text-slate-400 text-xs leading-relaxed mb-3 line-clamp-2">{answer.text}</p>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {feedback.strengths.slice(0, 2).map((s, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {s}
                    </div>
                  ))}
                  {feedback.improvements.slice(0, 2).map((s, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onHome}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 rounded-xl transition"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-sky-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
