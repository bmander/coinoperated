import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useAuth } from "../contexts/AuthContext";
import { createPledge, deletePledge, getMyPledge, updatePledge } from "../api/pledges";
import { fetchPaymentMethods } from "../api/patron";
import { formatCents, getErrorMessage } from "../utils/formatting";
import type { TaskStatus, PledgeMyResponse, SavedPaymentMethod } from "../api/types";
import { isLivePledge } from "../api/types";
import ConfirmModal from "./ConfirmModal";
import PaymentModal from "./PaymentModal";
import Spinner from "./Spinner";

const PRESET_AMOUNTS = [500, 1000, 2000]; // $5, $10, $20

export default function PledgeWidget({
  task,
  onPledge,
}: {
  task: { id: string; status: TaskStatus };
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
  const [existingPledge, setExistingPledge] = useState<PledgeMyResponse | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

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

  // Fetch existing pledge on mount
  useEffect(() => {
    if (!patron) return;
    getMyPledge(task.id).then((p) => setExistingPledge(p)).catch(() => {});
    fetchPaymentMethods().then((m) => setSavedMethods(m)).catch(() => {});
  }, [patron, task.id]);

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
      const resp = isLivePledge(existingPledge)
        ? await updatePledge(task.id, finalAmount)
        : await createPledge(task.id, finalAmount, { saveCard: true });
      const sp = loadStripe(resp.publishable_key);

      // Try auto-confirm with saved payment method
      const savedPM = patron?.default_payment_method;
      if (savedPM && resp.client_secret) {
        const stripe = await sp;
        if (stripe) {
          const result = await stripe.confirmCardSetup(resp.client_secret, {
            payment_method: savedPM,
          });
          if (!result.error) {
            setExistingPledge({ id: resp.pledge_id, amount: finalAmount, status: "active", created_at: new Date().toISOString() });
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
      setClientSecret(resp.client_secret ?? "");
      setShowModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleModalSuccess() {
    setExistingPledge({ id: "confirmed", amount: resolveAmount()!, status: "active", created_at: new Date().toISOString() });
    setShowModal(false);
    setExpanded(false);
    onPledge?.();
  }

  function handleModalCancel() {
    deletePledge(task.id).catch(() => {});
    setShowModal(false);
  }

  const canPledge = task.status === "proposed" || task.status === "underway" || task.status === "review";

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
            {isCustom ? (
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
            ) : (
              <button
                type="button"
                className="pledge-amt-btn"
                onClick={() => {
                  setIsCustom(true);
                  setSelectedAmount(null);
                  setError("");
                }}
              >
                ...
              </button>
            )}
            {error && <span className="pledge-widget-error">{error}</span>}
            <button
              type="button"
              className="btn btn-sm pledge-confirm-btn"
              onClick={handleSubmit}
              disabled={submitting || (!selectedAmount && !isCustom)}
              aria-label="Submit pledge"
            >
              {submitting ? <Spinner /> : "✓"}
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
        ) : isLivePledge(existingPledge) ? (
          <span className="pledge-widget-existing">
            <span className="pledge-amount">{formatCents(existingPledge.amount)}</span>
            <button className="btn btn-sm btn-secondary" onClick={handlePledgeClick}>
              Change
            </button>
            {task.status === "review" && (
              <button
                className="btn btn-sm btn-decline"
                onClick={() => setConfirmingRevoke(true)}
              >
                Revoke Pledge
              </button>
            )}
          </span>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={handlePledgeClick}>
            Pledge
          </button>
        )}
      </div>

      {showModal && stripePromise && (
        <PaymentModal
          stripePromise={stripePromise}
          clientSecret={clientSecret}
          savedMethods={savedMethods}
          onSuccess={handleModalSuccess}
          onCancel={handleModalCancel}
        />
      )}

      {confirmingRevoke && (
        <ConfirmModal
          title="Revoke your pledge?"
          description={`Are you sure you want to revoke your ${isLivePledge(existingPledge) ? formatCents(existingPledge.amount) : ""} pledge? This cannot be undone.`}
          confirmLabel="Yes, revoke"
          confirmingLabel="Revoking..."
          onConfirm={async () => {
            await deletePledge(task.id);
            setExistingPledge(null);
            setConfirmingRevoke(false);
            onPledge?.();
          }}
          onCancel={() => setConfirmingRevoke(false)}
        />
      )}
    </>
  );
}
