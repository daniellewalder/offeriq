import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success('Account created — signing you in…');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Authentication failed';
      if (/already registered|already.*exists/i.test(msg)) {
        toast.error('An account with this email already exists. Try signing in.');
      } else if (/invalid login credentials/i.test(msg)) {
        toast.error('Invalid email or password.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-baseline gap-2 justify-center mb-8 group">
          <span className="heading-display text-2xl text-foreground tracking-tight">OfferIQ</span>
          <span className="w-1 h-1 rounded-full bg-accent group-hover:scale-125 transition-transform" />
        </Link>

        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground font-body mb-2">
              {mode === 'signin' ? 'Welcome back' : 'Get started'}
            </p>
            <h1 className="heading-display text-2xl text-foreground">
              {mode === 'signin' ? 'Sign in to OfferIQ' : 'Create your account'}
            </h1>
            <p className="text-[13px] text-muted-foreground font-body mt-2">
              {mode === 'signin'
                ? 'Access your deals, offers, and seller portals.'
                : 'Start analyzing offers and sharing seller portals in minutes.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] tracking-wide uppercase text-muted-foreground font-body mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-foreground text-[14px] font-body focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                placeholder="you@brokerage.com"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-wide uppercase text-muted-foreground font-body mb-1.5">Password</label>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-foreground text-[14px] font-body focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-foreground text-background text-[13px] font-body font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-[12.5px] text-muted-foreground hover:text-foreground font-body transition"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center font-body mt-6">
          By continuing, you agree to OfferIQ's terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
