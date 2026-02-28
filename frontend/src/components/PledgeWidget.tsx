import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useAuth } from "../contexts/AuthContext";
import { createPledge, deletePledge } from "../api/pledges";
import { formatCents } from "../utils/formatting";
import type { TaskRead } from "../api/types";
import PaymentModal from "./PaymentModal";

const PRESET_AMOUNTS = [500, 1000, 2000]; // $5, $10, $20

export default function PledgeWidget({
  task,
  onPledge,
}: {
  task: TaskRead;
  onPledge?: () => void;
}) {
  const { patron } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pledgedAmount, setPledgedAmount] = useState<number | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);

  function resolveAmount(): number | null {
    if (isCustom) {
      const parsed = Math.round(parseFloat(customAmount) * 100);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return selectedAmount;
  }

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setError("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  function handlePledgeClick() {
    if (!patron) {
      navigate("/signin");
      return;
    }
    setExpanded(true);
  }

  async function handleSubmit() {
    const finalAmount = resolveAmount();
    if (!finalAmount || finalAmount < 100) {
      setError("Min $1.00");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const resp = await createPledge(task.id, finalAmount);
      const sp = loadStripe(resp.publishable_key);

      // Try auto-confirm with saved payment method
      if (patron?.default_payment_method) {
        const stripe = await sp;
        if (stripe) {
          const result = await stripe.confirmCardSetup(resp.client_secret, {
            payment_method: patron.default_payment_method,
          });
          if (!result.error) {
            setPledgedAmount(finalAmount);
            setExpanded(false);
            setSubmitting(false);
            onPledge?.();
            return;
          }
        }
        // Saved method failed, fall through to modal
      }

      // Show payment modal
      setStripePromise(sp);
      setClientSecret(resp.client_secret);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleModalSuccess() {
    setPledgedAmount(resolveAmount()!);
    setShowModal(false);
    setExpanded(false);
    onPledge?.();
  }

  function handleModalCancel() {
    deletePledge(task.id).catch(() => {});
    setShowModal(false);
  }

  const canPledge = task.status === "open" || task.status === "accepted";
  if (!canPledge) return null;

  return (
    <>
      <div className="pledge-widget" ref={widgetRef}>
        {expanded ? (
          <div className="pledge-widget-options">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`pledge-amt-btn${selectedAmount === amt && !isCustom ? " active" : ""}`}
                onClick={() => {
                  setSelectedAmount(amt);
                  setIsCustom(false);
                  setError("");
                }}
              >
                {formatCents(amt)}
              </button>
            ))}
            <button
              type="button"
              className={`pledge-amt-btn${isCustom ? " active" : ""}`}
              onClick={() => {
                setIsCustom(true);
                setSelectedAmount(null);
                setError("");
              }}
            >
              ...
            </button>
            {isCustom && (
              <input
                type="number"
                className="pledge-custom-input"
                min="1"
                step="0.01"
                placeholder="$"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                autoFocus
              />
            )}
            {error && <span className="pledge-widget-error">{error}</span>}
            <button
              type="button"
              className="btn btn-sm pledge-confirm-btn"
              onClick={handleSubmit}
              disabled={submitting || (!selectedAmount && !isCustom)}
              aria-label="Submit pledge"
            >
              {submitting ? "..." : "✓"}
            </button>
            <button
              type="button"
              className="btn btn-sm pledge-cancel-btn"
              onClick={() => { setExpanded(false); setError(""); }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className={`btn btn-sm${pledgedAmount ? " btn-secondary" : " btn-primary"}`}
            onClick={pledgedAmount ? undefined : handlePledgeClick}
          >
            {pledgedAmount ? `Pledged ${formatCents(pledgedAmount)}` : "Pledge"}
          </button>
        )}
      </div>

      {showModal && stripePromise && (
        <PaymentModal
          stripePromise={stripePromise}
          clientSecret={clientSecret}
          onSuccess={handleModalSuccess}
          onCancel={handleModalCancel}
        />
      )}
    </>
  );
}
