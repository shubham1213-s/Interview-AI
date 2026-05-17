export type Role = 'SDE' | 'Frontend' | 'GenAI';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type InterviewMode = 'text' | 'voice';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  role: Role;
  mode: InterviewMode;
  difficulty: Difficulty;
  duration_seconds: number;
  completed: boolean;
  score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface Question {
  id: string;
  session_id: string;
  order_index: number;
  text: string;
  category: string;
  difficulty: string;
  created_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  session_id: string;
  text: string;
  audio_url: string | null;
  time_taken_seconds: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  answer_id: string;
  session_id: string;
  strengths: string[];
  improvements: string[];
  score: number;
  detailed_feedback: string;
  created_at: string;
}

export interface SessionWithDetails extends Session {
  questions: (Question & { answer?: Answer; feedback?: Feedback })[];
}
