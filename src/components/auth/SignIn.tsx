import React, { useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import {
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  userFacingAuthError,
} from '../../services/firebaseAuthService';

interface SignInProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

const SignIn: React.FC<SignInProps> = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setPassword('');
      setError(null);
      setNotice(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const finishLogin = () => {
    onLogin();
    handleClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithEmail(email.trim(), password);
      finishLogin();
    } catch (authError) {
      setError(userFacingAuthError(authError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithGoogle();
      finishLogin();
    } catch (authError) {
      setError(userFacingAuthError(authError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setNotice('If an account exists for that address, Firebase has sent password-reset instructions.');
    } catch (authError) {
      setError(userFacingAuthError(authError));
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-300 ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${isOpen && !isClosing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <button type="button" onClick={handleClose} aria-label="Close sign in" className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <Icon name="x-mark" className="h-6 w-6" />
        </button>

        <div className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-500 shadow-lg shadow-yellow-500/20"><span className="text-2xl font-bold text-slate-900">L</span></div>
            <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-600">Sign in with your registered Firebase account.</p>
          </div>

          <button type="button" onClick={handleGoogleSignIn} disabled={isBusy} className="mb-5 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-5 w-5" referrerPolicy="no-referrer" />
            Continue with Google
          </button>

          <div className="relative mb-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 font-semibold tracking-wider text-slate-400">Or email</span></div></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="mb-1 block text-xs font-bold text-slate-500">Email address</label>
              <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label htmlFor="signin-password" className="mb-1 block text-xs font-bold text-slate-500">Password</label>
              <input id="signin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500" />
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

            <button type="button" onClick={handleResetPassword} disabled={isBusy} className="text-sm font-medium text-yellow-700 hover:text-yellow-800 disabled:opacity-60">Forgot password?</button>
            <button type="submit" disabled={isBusy} className="w-full rounded-lg bg-yellow-500 py-3 font-bold text-slate-900 transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">{isBusy ? 'Please wait…' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
