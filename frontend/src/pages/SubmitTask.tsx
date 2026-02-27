import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createTask } from "../api/tasks";
import MarkdownField from "../components/MarkdownField";
import { useAuth } from "../contexts/AuthContext";
import { MIN_PLEDGE_CENTS, PRESET_AMOUNTS } from "../constants";
import { formatCents } from "../utils/formatting";

function TaskFormFields({
  title,
  setTitle,
  description,
  setDescription,
  criteria,
  setCriteria,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  criteria: string;
  setCriteria: (v: string) => void;
}) {
  return (
    <>
      <div className="form-field">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short, descriptive title"
          required
          maxLength={500}
        />
      </div>

      <MarkdownField
        id="description"
        label="Description *"
        value={description}
        onChange={setDescription}
        placeholder="Full description of the task (Markdown supported)"
        required
        rows={8}
      />

      <MarkdownField
        id="criteria"
        label="Delivery Criteria"
        value={criteria}
        onChange={setCriteria}
        placeholder='What does "done" look like? (Markdown supported)'
        rows={4}
      />
    </>
  );
}

function PledgedTaskForm() {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [amount, setAmount] = useState(MIN_PLEDGE_CENTS);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const finalAmount = isCustom ? Math.round(parseFloat(customAmount) * 100) : amount;
    const minDollars = (MIN_PLEDGE_CENTS / 100).toFixed(2);
    if (!finalAmount || finalAmount < MIN_PLEDGE_CENTS) {
      setError(`Minimum pledge is $${minDollars}`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const resp = await createTask({
        title: title.trim(),
        description: description.trim(),
        criteria: criteria.trim() || undefined,
        pledge_amount: finalAmount,
      });

      if (resp.client_secret) {
        const card = elements.getElement(CardElement);
        if (!card) {
          setError("Card element not found");
          setSubmitting(false);
          return;
        }

        const { error: stripeError } = await stripe.confirmCardSetup(resp.client_secret, {
          payment_method: { card },
        });

        if (stripeError) {
          setError(stripeError.message ?? "Card setup failed");
          setSubmitting(false);
          return;
        }
      }

      navigate(`/tasks/${resp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit task. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="submit-task-form">
      <TaskFormFields
        title={title} setTitle={setTitle}
        description={description} setDescription={setDescription}
        criteria={criteria} setCriteria={setCriteria}
      />

      <div className="form-field">
        <label>Your Pledge *</label>
        <div className="amount-selector">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`amount-btn ${!isCustom && amount === preset ? "active" : ""}`}
              onClick={() => { setAmount(preset); setIsCustom(false); }}
            >
              {formatCents(preset)}
            </button>
          ))}
          <button
            type="button"
            className={`amount-btn ${isCustom ? "active" : ""}`}
            onClick={() => setIsCustom(true)}
          >
            Custom
          </button>
        </div>

        {isCustom && (
          <div className="custom-amount">
            <label htmlFor="custom-amount">Amount (USD)</label>
            <input
              id="custom-amount"
              type="number"
              min={MIN_PLEDGE_CENTS / 100}
              step="0.01"
              placeholder={(MIN_PLEDGE_CENTS / 100).toFixed(2)}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="card-element-container">
        <label>Card details</label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#e0e0e0",
                "::placeholder": { color: "#888" },
              },
            },
          }}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !stripe}
      >
        {submitting ? "Submitting..." : "Submit Task"}
      </button>
    </form>
  );
}

function AdminTaskForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim(),
        criteria: criteria.trim() || undefined,
      });
      navigate(`/tasks/${task.id}`);
    } catch {
      setError("Failed to submit task. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="submit-task-form">
      <TaskFormFields
        title={title} setTitle={setTitle}
        description={description} setDescription={setDescription}
        criteria={criteria} setCriteria={setCriteria}
      />

      {error && <p className="form-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting}
      >
        {submitting ? "Submitting..." : "Submit Task"}
      </button>
    </form>
  );
}

export default function SubmitTask() {
  const { patron } = useAuth();
  const isAdmin = patron?.is_admin ?? false;
  const isBanned = patron?.is_banned ?? false;
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  useEffect(() => {
    if (isAdmin || isBanned) return;

    fetch("/api/config/stripe")
      .then((r) => r.json())
      .then((config) => {
        if (config.publishable_key) {
          setStripePromise(loadStripe(config.publishable_key));
        }
      });
  }, [isAdmin, isBanned]);

  if (isBanned) {
    return (
      <div className="submit-task-page">
        <h1>Submit a Task</h1>
        <p className="form-error">
          Your account has been suspended and you cannot submit new tasks.
        </p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="submit-task-page">
        <h1>Submit a Task</h1>
        <p className="submit-task-intro">
          Propose a task for Brandon to work on. Describe what you'd like done and
          what "done" looks like.
        </p>
        <AdminTaskForm />
      </div>
    );
  }

  if (!stripePromise) {
    return <p className="page-message">Loading...</p>;
  }

  return (
    <div className="submit-task-page">
      <h1>Submit a Task</h1>
      <p className="submit-task-intro">
        Propose a task for Brandon to work on. Describe what you'd like done and
        what "done" looks like. A pledge is required to submit a task.
      </p>
      <Elements stripe={stripePromise}>
        <PledgedTaskForm />
      </Elements>
    </div>
  );
}
