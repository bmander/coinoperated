import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { API_BASE } from "../api/client";
import { createTask } from "../api/tasks";
import { fetchPaymentMethods } from "../api/patron";
import Spinner from "../components/Spinner";
import { TaskFormFields } from "../components/TaskForm";
import TaskForm from "../components/TaskForm";
import CardPaymentFields, { useCardPaymentSelection } from "../components/CardPaymentFields";
import { useAuth } from "../contexts/AuthContext";
import { MIN_PLEDGE_CENTS, PRESET_AMOUNTS } from "../constants";
import { formatCents } from "../utils/formatting";
import type { SavedPaymentMethod } from "../api/types";

function PledgedTaskForm({ savedMethods }: { savedMethods: SavedPaymentMethod[] }) {
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
  const [paymentSelection, setPaymentSelection] = useCardPaymentSelection(savedMethods);

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
        ...(paymentSelection.usingSavedCard
          ? { payment_method_id: paymentSelection.selectedPM }
          : { save_card: paymentSelection.saveCard }),
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

      <CardPaymentFields
        savedMethods={savedMethods}
        value={paymentSelection}
        onChange={setPaymentSelection}
      />

      {error && <p className="form-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !stripe}
      >
        {submitting ? <><Spinner /> Submitting...</> : "Submit Task"}
      </button>
    </form>
  );
}

export default function SubmitTask() {
  const { patron } = useAuth();
  const isAdmin = patron?.is_admin ?? false;
  const isBanned = patron?.is_banned ?? false;
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);

  useEffect(() => {
    if (isAdmin || isBanned) return;

    Promise.all([
      fetch(`${API_BASE}/config/stripe`).then((r) => r.json()),
      fetchPaymentMethods().catch(() => [] as SavedPaymentMethod[]),
    ]).then(([config, methods]) => {
      if (config.publishable_key) {
        setStripePromise(loadStripe(config.publishable_key));
      }
      setSavedMethods(methods);
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
        <TaskForm
          onSubmit={async (data) => {
            const task = await createTask(data);
            return `/tasks/${task.id}`;
          }}
        />
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
        <PledgedTaskForm savedMethods={savedMethods} />
      </Elements>
    </div>
  );
}
