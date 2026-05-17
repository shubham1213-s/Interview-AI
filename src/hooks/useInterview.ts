import { useState, useRef, useCallback } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Role, Difficulty, InterviewMode, Question, Answer, Feedback } from '../types';

export interface InterviewState {
  sessionId: string | null;
  role: Role | null;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, Answer>;
  feedbacks: Record<string, Feedback>;
  liveFeedback: Feedback | null;
  loading: boolean;
  submitting: boolean;
  evaluating: boolean;
  completed: boolean;
  elapsedSeconds: number;
}

export function useInterview() {
  const [state, setState] = useState<InterviewState>({
    sessionId: null,
    role: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    feedbacks: {},
    liveFeedback: null,
    loading: false,
    submitting: false,
    evaluating: false,
    completed: false,
    elapsedSeconds: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - state.elapsedSeconds * 1000;
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, elapsedSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
    }, 1000);
  }, [state.elapsedSeconds]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  async function startSession(userId: string, role: Role, difficulty: Difficulty, mode: InterviewMode) {
    setState(s => ({ ...s, loading: true }));
    stopTimer();

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) {
        throw new Error('User session expired or missing. Please sign in again.');
      }

      // Generate questions
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ role, difficulty, count: 5 }),
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Question generation failed: ${res.status} ${res.statusText} - ${errorData}`);
      }

      const { questions: questionTexts } = await res.json();
      if (!Array.isArray(questionTexts) || questionTexts.length === 0) {
        throw new Error('Received invalid question list from the interview generator.');
      }

      // Create session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({ user_id: userId, role, mode, difficulty })
        .select()
        .single();
      if (sessionError) throw sessionError;

      // Insert questions
      const questionRows = (questionTexts as string[]).map((text: string, i: number) => ({
        session_id: sessionData.id,
        order_index: i,
        text,
        difficulty,
      }));
      const { data: savedQuestions, error: qError } = await supabase
        .from('questions')
        .insert(questionRows)
        .select();
      if (qError) throw qError;

      const sorted = [...savedQuestions].sort((a, b) => a.order_index - b.order_index);

      setState({
        sessionId: sessionData.id,
        role,
        questions: sorted,
        currentIndex: 0,
        answers: {},
        feedbacks: {},
        liveFeedback: null,
        loading: false,
        submitting: false,
        evaluating: false,
        completed: false,
        elapsedSeconds: 0,
      });

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, elapsedSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
      }, 1000);

      return sessionData.id;
    } catch (error) {
      setState(s => ({ ...s, loading: false }));
      throw error;
    }
  }

  async function submitAnswer(answerText: string) {
    const { sessionId, questions, currentIndex } = state;
    if (!sessionId) return;
    const question = questions[currentIndex];
    if (!question) return;

    setState(s => ({ ...s, submitting: true }));

    const timeTaken = state.elapsedSeconds;

    // Save answer
    const { data: answerData, error: aError } = await supabase
      .from('answers')
      .insert({
        question_id: question.id,
        session_id: sessionId,
        text: answerText,
        time_taken_seconds: timeTaken,
      })
      .select()
      .single();
    if (aError) throw aError;

    setState(s => ({
      ...s,
      answers: { ...s.answers, [question.id]: answerData },
        liveFeedback: null,

    }));

    // Get AI feedback
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) {
      throw new Error('User session expired or missing. Please sign in again.');
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          question: question.text,
          answer: answerText,
          role: state.role,
          difficulty: question.difficulty,
        }),
      });
      const feedbackData = await res.json();

      const { data: savedFeedback } = await supabase
        .from('feedback')
        .insert({
          answer_id: answerData.id,
          session_id: sessionId,
          strengths: feedbackData.strengths || [],
          improvements: feedbackData.improvements || [],
          score: feedbackData.score || 5,
          detailed_feedback: feedbackData.detailed_feedback || '',
        })
        .select()
        .single();

      setState(s => ({
        ...s,
        feedbacks: { ...s.feedbacks, [question.id]: savedFeedback! },
        liveFeedback: null,
        evaluating: false,
      }));
    } catch {
      setState(s => ({ ...s, evaluating: false }));
    }
  }

  async function checkAnswer(answerText: string) {
    const { sessionId, questions, currentIndex } = state;
    const question = questions[currentIndex];
    if (!sessionId || !question || !answerText.trim()) return;

    setState(s => ({ ...s, evaluating: true }));

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) {
      setState(s => ({ ...s, evaluating: false }));
      throw new Error('User session expired or missing. Please sign in again.');
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          question: question.text,
          answer: answerText.trim(),
          role: state.role,
          difficulty: question.difficulty,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Answer check failed: ${res.status} ${res.statusText} - ${errorText}`);
      }

      const feedbackData = await res.json();
      const liveFeedback: Feedback = {
        id: `live-${question.id}`,
        answer_id: '',
        session_id: sessionId,
        strengths: feedbackData.strengths || [],
        improvements: feedbackData.improvements || [],
        score: feedbackData.score || 5,
        detailed_feedback: feedbackData.detailed_feedback || '',
        created_at: new Date().toISOString(),
      };

      setState(s => ({ ...s, liveFeedback, evaluating: false }));
    } catch (error) {
      setState(s => ({ ...s, evaluating: false }));
      throw error;
    }
  }

  async function nextQuestion() {
    const { currentIndex, questions, sessionId } = state;
    if (currentIndex + 1 >= questions.length) {
      // Complete session
      stopTimer();
      if (sessionId) {
        const scores = Object.values(state.feedbacks).map(f => f.score);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        await supabase.from('sessions').update({
          completed: true,
          duration_seconds: state.elapsedSeconds,
          completed_at: new Date().toISOString(),
          score: avgScore,
        }).eq('id', sessionId);
      }
      setState(s => ({ ...s, completed: true }));
    } else {
      setState(s => ({ ...s, currentIndex: s.currentIndex + 1 }));
    }
  }

  async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) {
      throw new Error('User session expired or missing. Please sign in again.');
    }

    const form = new FormData();
    form.append('audio', audioBlob, 'audio.webm');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Apikey': SUPABASE_ANON_KEY,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      try {
        const err = JSON.parse(errText);
        const message = err.error || 'Transcription failed';
        const details = err.details ? `: ${err.details}` : '';
        throw new Error(`${message}${details}`);
      } catch {
        throw new Error(`Transcription failed: ${errText}`);
      }
    }

    const data = await res.json();
    return data.text;
  }

  function reset() {
    stopTimer();
    setState({
      sessionId: null,
      role: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      feedbacks: {},
      loading: false,
      submitting: false,
      evaluating: false,
      completed: false,
      elapsedSeconds: 0,
    });
  }

  return { state, startSession, submitAnswer, checkAnswer, nextQuestion, transcribeAudio, reset, stopTimer, startTimer };
}
