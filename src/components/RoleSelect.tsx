import { useState } from 'react';
import { Code2, LayoutGrid as Layout, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { Role } from '../types';

interface RoleSelectProps {
  currentRole: Role | null;
  onSelect: (role: Role) => Promise<void>;
}

const ROLES: { id: Role; label: string; icon: typeof Code2; description: string; topics: string[] }[] = [
  {
    id: 'SDE',
    label: 'Software Engineer',
    icon: Code2,
    description: 'Data structures, algorithms, system design, and backend engineering.',
    topics: ['Algorithms', 'System Design', 'OOP', 'Databases'],
  },
  {
    id: 'Frontend',
    label: 'Frontend Engineer',
    icon: Layout,
    description: 'React, JavaScript, CSS, browser internals, and web performance.',
    topics: ['React', 'JavaScript', 'CSS', 'Performance'],
  },
  {
    id: 'GenAI',
    label: 'GenAI Engineer',
    icon: Sparkles,
    description: 'LLMs, prompt engineering, RAG pipelines, and AI system design.',
    topics: ['LLMs', 'Prompt Eng.', 'RAG', 'Embeddings'],
  },
];

export default function RoleSelect({ currentRole, onSelect }: RoleSelectProps) {
  const [selected, setSelected] = useState<Role | null>(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await onSelect(selected);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select role. Please try again.';
      setError(message);
      console.error('Role selection error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-3">Choose Your Role</h2>
          <p className="text-slate-400">Select the engineering track you want to be interviewed for.</p>
        </div>

        <div className="grid gap-4 mb-8">
          {ROLES.map(({ id, label, icon: Icon, description, topics }) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`group relative w-full text-left p-6 rounded-2xl border transition-all duration-200 ${
                selected === id
                  ? 'bg-sky-500/10 border-sky-500 shadow-lg shadow-sky-500/10'
                  : 'bg-[#111827] border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-5">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  selected === id ? 'bg-sky-500' : 'bg-slate-800 group-hover:bg-slate-700'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-semibold text-lg">{label}</h3>
                    {selected === id && (
                      <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full">Selected</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{description}</p>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(t => (
                      <span key={t} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        selected === id
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className={`flex-shrink-0 transition-transform ${selected === id ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}>
                  <ChevronRight className={`w-5 h-5 ${selected === id ? 'text-sky-400' : 'text-slate-500'}`} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}
