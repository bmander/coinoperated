import { useState, useEffect, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Spinner from "../components/Spinner";

const RESEND_COOLDOWN_MS = 30_000;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "This sign-in link is invalid or has already been used.",
  expired_token: "This sign-in link has expired. Please request a new one.",
};

export default function SignIn() {
  const { patron, loading, login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [sending, setSending] = useState(false);
  const [magicToken, setMagicToken] = useState<string | null>(null);

  useEffect(() => {
    if (!cooldown) return;
    const id = setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(id);
  }, [cooldown]);

  const urlError = searchParams.get("error");

  if (!loading && patron) {
    return <Navigate to="/" replace />;
  }

  async function sendLink() {
    setError("");
    setSending(true);
    try {
      const resp = await login(email);
      setMagicToken(resp.magic_token ?? null);
      setSubmitted(true);
      setCooldown(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  if (submitted) {
    return (
      <div className="signin-page">
        <h1>Check your email</h1>
        <p className="signin-message">
          We sent a sign-in link to <strong>{email}</strong>
        </p>
        {magicToken && (
          <p className="signin-message">
            <a href={`${window.location.origin}/api/auth/verify?token=${magicToken}`}>
              Sign in directly (staging only)
            </a>
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={sendLink}
          disabled={cooldown || sending}
        >
          {sending ? <Spinner /> : cooldown ? "Email sent" : "Re-send email"}
        </button>
      </div>
    );
  }

  return (
    <div className="signin-page">
      <h1>Sign In</h1>
      {urlError && ERROR_MESSAGES[urlError] && (
        <p className="form-error">{ERROR_MESSAGES[urlError]}</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit} className="signin-form">
        <div className="form-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? <><Spinner /> Sending...</> : "Send sign-in link"}
        </button>
      </form>
    </div>
  );
}
