import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Square, Send, ChevronRight, Clock, Brain,
  CheckCircle2, AlertCircle, Loader2, Volume2, X
} from 'lucide-react';
import { InterviewState } from '../hooks/useInterview';
import { Role, InterviewMode } from '../types';

interface InterviewSessionProps {
  state: InterviewState;
  role: Role;
  mode: InterviewMode;
  onSubmitAnswer: (text: string) => Promise<void>;
  onCheckAnswer: (text: string) => Promise<void>;
  onNext: () => Promise<void>;
  onTranscribe: (blob: Blob) => Promise<string>;
  onExit: () => void;
}

function Timer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="flex items-center gap-1.5 text-slate-300 font-mono text-sm">
      <Clock className="w-3.5 h-3.5 text-sky-400" />
      <span>{m}:{s.toString().padStart(2, '0')}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30'
    : score >= 6 ? 'text-sky-400 bg-sky-400/10 border-sky-500/30'
    : score >= 4 ? 'text-amber-400 bg-amber-400/10 border-amber-500/30'
    : 'text-red-400 bg-red-400/10 border-red-500/30';
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-semibold ${color}`}>
      {score.toFixed(1)} / 10
    </div>
  );
}

export default function InterviewSession({
  state, role, mode, onSubmitAnswer, onCheckAnswer, onNext, onTranscribe, onExit
}: InterviewSessionProps) {
  const [textAnswer, setTextAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentQuestion = state.questions[state.currentIndex];
  const currentFeedback = currentQuestion ? state.feedbacks[currentQuestion.id] : null;
  const currentAnswer = currentQuestion ? state.answers[currentQuestion.id] : null;
  const liveFeedback = currentQuestion && state.liveFeedback?.session_id === state.sessionId && state.liveFeedback?.id === `live-${currentQuestion.id}`
    ? state.liveFeedback
    : null;
  const displayFeedback = currentFeedback || liveFeedback;
  const hasSubmitted = !!currentAnswer;

  useEffect(() => {
    setTextAnswer('');
    setShowFeedback(false);
    setTranscribeError('');
  }, [state.currentIndex]);

  useEffect(() => {
    if (currentFeedback) setShowFeedback(true);
  }, [currentFeedback]);

  const speakQuestion = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  async function startRecording() {
    setTranscribeError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const text = await onTranscribe(blob);
          setTextAnswer(prev => prev ? `${prev} ${text}` : text);
        } catch (err: unknown) {
          setTranscribeError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setTranscribeError('Microphone access denied. Please allow microphone access.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleSubmit() {
    if (!textAnswer.trim() || hasSubmitted) return;
    await onSubmitAnswer(textAnswer.trim());
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-semibold">Generating your interview...</p>
          <p className="text-slate-500 text-sm mt-1">Preparing tailored questions for {role}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const progress = ((state.currentIndex + (hasSubmitted ? 1 : 0)) / state.questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-semibold text-sm">{role} Interview</span>
              <span className="text-slate-500 text-xs ml-2">
                Q{state.currentIndex + 1} of {state.questions.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Timer seconds={state.elapsedSeconds} />
            <button
              onClick={onExit}
              className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-3xl mx-auto mt-3">
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Question */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-sky-400 bg-sky-400/10 px-2.5 py-1 rounded-full">
                    Question {state.currentIndex + 1}
                  </span>
                </div>
                <p className="text-white text-lg leading-relaxed font-medium">{currentQuestion.text}</p>
              </div>
              {mode === 'voice' && (
                <button
                  onClick={speaking ? stopSpeaking : () => speakQuestion(currentQuestion.text)}
                  className={`flex-shrink-0 p-2.5 rounded-xl transition ${
                    speaking
                      ? 'bg-sky-500 text-white animate-pulse'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={speaking ? 'Stop' : 'Read aloud'}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Answer input */}
          {!hasSubmitted && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Your Answer</h3>

              <textarea
                ref={textareaRef}
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                placeholder="Type your answer here... Use code blocks with ``` for code examples."
                rows={8}
                disabled={recording || transcribing}
                className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition resize-none leading-relaxed"
              />

              {transcribeError && (
                <div className="flex items-start gap-2 mt-3 text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{transcribeError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                {mode === 'voice' && (
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={transcribing || state.submitting}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      recording
                        ? 'bg-red-500 hover:bg-red-400 text-white animate-pulse'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {recording ? 'Stop Recording' : 'Record Answer'}
                  </button>
                )}

                {transcribing && (
                  <div className="flex items-center gap-2 text-sky-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transcribing...</span>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!textAnswer.trim() || state.submitting || state.evaluating || recording || transcribing}
                  className="ml-auto flex items-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-sky-500/20"
                >
                  {(state.submitting || state.evaluating) ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />
                    {state.evaluating ? 'Evaluating...' : 'Submitting...'}</>
                  ) : (
                    <><Send className="w-4 h-4" />Submit</>
                  )}
                </button>
                <button
                  onClick={async () => {
                    if (!textAnswer.trim()) return;
                    await onCheckAnswer(textAnswer.trim());
                    setShowFeedback(true);
                  }}
                  disabled={!textAnswer.trim() || state.submitting || state.evaluating || recording || transcribing}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-semibold px-5 py-2.5 rounded-xl transition-all"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* Submitted answer display */}
          {hasSubmitted && currentAnswer && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Your Answer</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{currentAnswer.text}</p>
            </div>
          )}

          {/* Feedback */}
          {state.evaluating && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span className="text-sm">AI is evaluating your answer...</span>
              </div>
            </div>
          )}

          {showFeedback && displayFeedback && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">AI Feedback</h3>
                <ScoreBadge score={displayFeedback.score} />
              </div>

              <p className="text-slate-300 text-sm leading-relaxed">{displayFeedback.detailed_feedback}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                {displayFeedback.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths</h4>
                    <ul className="space-y-1.5">
                      {displayFeedback.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayFeedback.improvements.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Improvements</h4>
                    <ul className="space-y-1.5">
                      {displayFeedback.improvements.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={onNext}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20"
              >
                {state.currentIndex + 1 >= state.questions.length ? 'View Results' : 'Next Question'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
