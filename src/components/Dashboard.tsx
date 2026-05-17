import { useState, useEffect } from 'react';
import { Play, Mic, Clock, Star, TrendingUp, Brain, LogOut, ChevronRight, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, Session, Difficulty, InterviewMode } from '../types';

interface DashboardProps {
  profile: Profile;
  onStartInterview: (difficulty: Difficulty, mode: InterviewMode) => void;
  onSignOut: () => void;
  onChangeRole: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ROLE_COLORS: Record<string, string> = {
  SDE: 'text-emerald-400 bg-emerald-400/10',
  Frontend: 'text-blue-400 bg-blue-400/10',
  GenAI: 'text-amber-400 bg-amber-400/10',
};

export default function Dashboard({ profile, onStartInterview, onSignOut, onChangeRole }: DashboardProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setSessions(data || []);
        setLoadingSessions(false);
      });
  }, [profile.id]);

  const completedSessions = sessions.filter(s => s.completed);
  const avgScore = completedSessions.length > 0
    ? (completedSessions.reduce((a, s) => a + (s.score || 0), 0) / completedSessions.length).toFixed(1)
    : null;
  const totalTime = sessions.reduce((a, s) => a + s.duration_seconds, 0);

  const difficultyOptions: { id: Difficulty; label: string; color: string }[] = [
    { id: 'easy', label: 'Easy', color: 'text-emerald-400 border-emerald-500 bg-emerald-500' },
    { id: 'medium', label: 'Medium', color: 'text-amber-400 border-amber-500 bg-amber-500' },
    { id: 'hard', label: 'Hard', color: 'text-red-400 border-red-500 bg-red-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">InterviewAI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-400 text-sm">{profile.full_name || profile.email}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[profile.role || 'SDE'] || 'text-slate-400 bg-slate-800'}`}>
                {profile.role || 'No role'}
              </span>
            </div>
            <button
              onClick={onChangeRole}
              className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              Change Role
            </button>
            <button
              onClick={onSignOut}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Play, label: 'Sessions', value: sessions.length.toString(), sub: 'total' },
            { icon: Star, label: 'Avg Score', value: avgScore ? `${avgScore}/10` : '—', sub: 'completed' },
            { icon: Clock, label: 'Practice Time', value: formatDuration(totalTime), sub: 'total' },
            { icon: Award, label: 'Completed', value: completedSessions.length.toString(), sub: 'interviews' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-sky-400" />
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Start Interview */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-1">Start Interview</h2>
            <p className="text-slate-400 text-sm mb-6">Practice as <span className="text-sky-400 font-medium">{profile.role || 'your role'}</span></p>

            <div className="mb-5">
              <p className="text-sm font-medium text-slate-300 mb-3">Difficulty</p>
              <div className="flex gap-2">
                {difficultyOptions.map(({ id, label, color }) => (
                  <button
                    key={id}
                    onClick={() => setDifficulty(id)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                      difficulty === id
                        ? `${color.split(' ')[2]} border-transparent text-white shadow-sm`
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onStartInterview(difficulty, 'text')}
                className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20"
              >
                <Play className="w-4 h-4" />
                Text Mode
              </button>
              <button
                onClick={() => onStartInterview(difficulty, 'voice')}
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-all"
              >
                <Mic className="w-4 h-4" />
                Voice Mode
              </button>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <h2 className="text-lg font-semibold">Recent Sessions</h2>
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Play className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No sessions yet. Start your first interview!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {sessions.map(session => (
                  <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.completed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{session.role}</span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-slate-400 text-xs capitalize">{session.difficulty}</span>
                        {session.mode === 'voice' && <Mic className="w-3 h-3 text-slate-500" />}
                      </div>
                      <p className="text-slate-500 text-xs">{formatDate(session.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {session.score != null
                        ? <span className="text-sky-400 font-semibold text-sm">{session.score.toFixed(1)}</span>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
