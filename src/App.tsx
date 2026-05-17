import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useInterview } from './hooks/useInterview';
import AuthPage from './components/AuthPage';
import RoleSelect from './components/RoleSelect';
import Dashboard from './components/Dashboard';
import InterviewSession from './components/InterviewSession';
import ResultsPage from './components/ResultsPage';
import { Role, Difficulty, InterviewMode } from './types';

type AppView = 'auth' | 'role-select' | 'dashboard' | 'interview' | 'results';

export default function App() {
  const { user, profile, loading, signIn, signUp, signOut, updateRole } = useAuth();
  const interview = useInterview();
  const [view, setView] = useState<AppView>('auth');
  const [interviewConfig, setInterviewConfig] = useState<{ difficulty: Difficulty; mode: InterviewMode } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onSignIn={async (email, password) => {
          await signIn(email, password);
          setView('dashboard');
        }}
        onSignUp={async (email, password, fullName) => {
          await signUp(email, password, fullName);
          setView('role-select');
        }}
      />
    );
  }

  if (!profile?.role && view !== 'role-select') {
    return (
      <RoleSelect
        currentRole={null}
        onSelect={async (role: Role) => {
          await updateRole(role);
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'role-select') {
    return (
      <RoleSelect
        currentRole={profile?.role ?? null}
        onSelect={async (role: Role) => {
          await updateRole(role);
          setView('dashboard');
        }}
      />
    );
  }

  if (view === 'interview' && interviewConfig) {
    if (interview.state.completed) {
      return (
        <ResultsPage
          state={interview.state}
          role={profile!.role!}
          onRetry={() => {
            interview.reset();
            setView('interview');
            setTimeout(async () => {
              if (user && profile?.role) {
                await interview.startSession(user.id, profile.role, interviewConfig.difficulty, interviewConfig.mode);
              }
            }, 0);
          }}
          onHome={() => {
            interview.reset();
            setView('dashboard');
          }}
        />
      );
    }

    return (
      <InterviewSession
        state={interview.state}
        role={profile!.role!}
        mode={interviewConfig.mode}
        onSubmitAnswer={interview.submitAnswer}
        onCheckAnswer={interview.checkAnswer}
        onNext={interview.nextQuestion}
        onTranscribe={interview.transcribeAudio}
        onExit={() => {
          interview.reset();
          setView('dashboard');
        }}
      />
    );
  }

  return (
    <Dashboard
      profile={profile!}
      onStartInterview={async (difficulty: Difficulty, mode: InterviewMode) => {
        if (!user || !profile?.role) return;
        setInterviewConfig({ difficulty, mode });
        setView('interview');
        try {
          await interview.startSession(user.id, profile.role, difficulty, mode);
        } catch (err) {
          console.error('Interview start failed:', err);
          setView('dashboard');
          alert(err instanceof Error ? err.message : 'Failed to start interview. Please try again.');
        }
      }}
      onSignOut={async () => {
        await signOut();
        interview.reset();
        setView('auth');
      }}
      onChangeRole={() => setView('role-select')}
    />
  );
}
