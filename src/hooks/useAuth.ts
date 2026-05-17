import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    setLoading(false);
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.includes('Invalid API key')) {
        throw new Error('Invalid Supabase anon key. Check VITE_SUPABASE_ANON_KEY in .env.');
      }
      throw error;
    }
    if (data.user) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
      });
      if (insertError) {
        console.error('Profile insert error:', insertError);
        throw insertError;
      }
    }
    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.includes('Invalid API key')) {
        throw new Error('Invalid Supabase anon key. Check VITE_SUPABASE_ANON_KEY in .env.');
      }
      throw error;
    }
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function updateRole(role: string) {
    if (!user) return;
    try {
      // First check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      let result;
      if (existing) {
        // Profile exists, update it
        result = await supabase
          .from('profiles')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', user.id)
          .select()
          .maybeSingle();
      } else {
        // Profile doesn't exist, create it
        result = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            role,
            updated_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();
      }

      const { data, error } = result;
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Failed to update role');
      }
      if (data) setProfile(data);
      else console.warn('No data returned from role update');
    } catch (err) {
      console.error('updateRole error:', err);
      throw err;
    }
  }

  return { user, profile, loading, signUp, signIn, signOut, updateRole };
}
