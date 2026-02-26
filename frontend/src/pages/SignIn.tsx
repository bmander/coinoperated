import { useState, FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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

  const urlError = searchParams.get("error");

  if (!loading && patron) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="signin-page">
        <h1>Check your email</h1>
        <p className="signin-message">
          We sent a sign-in link to <strong>{email}</strong>
        </p>
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
        <button type="submit" className="btn btn-primary">
          Send sign-in link
        </button>
      </form>
    </div>
  );
}
