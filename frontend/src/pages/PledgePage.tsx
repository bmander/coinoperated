import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuth } from "../contexts/AuthContext";
import { getTask } from "../api/tasks";
import { createPledge, getMyPledge, updatePledge, deletePledge } from "../api/pledges";
import { formatCents } from "../utils/formatting";
import { isLivePledge } from "../api/types";
import type { TaskDetailRead, PledgeMyResponse } from "../api/types";

const MIN_PLEDGE_CENTS = 100;
const PRESET_AMOUNTS = [MIN_PLEDGE_CENTS, 500, 2500];

function PledgeForm({
  task,
  existingPledge,
  onDone,
}: {
  task: TaskDetailRead;
  existingPledge: PledgeMyResponse | null;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(existingPledge?.amount ?? MIN_PLEDGE_CENTS);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const isUpdate = isLivePledge(existingPledge);

  async function handleSubmit(e: React.FormEvent) {
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
      const resp = isUpdate
        ? await updatePledge(task.id, finalAmount)
        : await createPledge(task.id, finalAmount);

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

      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    setError("");
    try {
      await deletePledge(task.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel pledge");
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="pledge-confirmed">
        <h2>Pledge confirmed!</h2>
        <p>
          You pledged {formatCents(isCustom ? Math.round(parseFloat(customAmount) * 100) : amount)} on this task. Your card will only be charged if the task is completed.
        </p>
        <Link to={`/tasks/${task.id}`} className="btn btn-primary">
          Back to Task
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pledge-form">
      <h2>{isUpdate ? "Update Your Pledge" : "Make a Pledge"}</h2>

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

      {error && <p className="pledge-error">{error}</p>}

      <div className="pledge-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !stripe}
        >
          {submitting ? "Processing..." : isUpdate ? "Update Pledge" : "Pledge"}
        </button>
        {isUpdate && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel Pledge
          </button>
        )}
      </div>
    </form>
  );
}

export default function PledgePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { patron, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailRead | null>(null);
  const [existingPledge, setExistingPledge] = useState<PledgeMyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!patron) {
      navigate("/signin", { replace: true });
      return;
    }

    async function load() {
      try {
        const [t, pledge, configResp] = await Promise.all([
          getTask(taskId!),
          getMyPledge(taskId!),
          fetch("/api/config/stripe").then((r) => r.json()),
        ]);
        setTask(t);
        setExistingPledge(pledge);
        if (configResp.publishable_key) {
          setStripePromise(loadStripe(configResp.publishable_key));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [taskId, patron, authLoading, navigate]);

  if (authLoading || loading) return <p className="page-message">Loading...</p>;
  if (error) return <p className="page-message page-error">Error: {error}</p>;
  if (!task) return null;

  const canPledge = task.status === "open" || task.status === "accepted";
  if (!canPledge) {
    return (
      <div className="pledge-page">
        <Link to={`/tasks/${task.id}`} className="back-link">&larr; Back to Task</Link>
        <p className="page-message">This task is not currently accepting pledges.</p>
      </div>
    );
  }

  if (!stripePromise) {
    return <p className="page-message">Loading payment form...</p>;
  }

  return (
    <div className="pledge-page">
      <Link to={`/tasks/${task.id}`} className="back-link">&larr; Back to Task</Link>
      <h1>{task.title}</h1>
      <Elements stripe={stripePromise}>
        <PledgeForm
          task={task}
          existingPledge={existingPledge}
          onDone={() => navigate(`/tasks/${task.id}`)}
        />
      </Elements>
    </div>
  );
}
