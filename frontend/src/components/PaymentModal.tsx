import { useState } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";

function PaymentForm({
  clientSecret,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) return;

    setSubmitting(true);
    setError("");

    const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Card setup failed");
      setSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Payment Information</h3>
        <p className="modal-description">
          Your card will only be charged if the task is completed.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="card-element-container">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#213547",
                    "::placeholder": { color: "#888" },
                  },
                },
              }}
            />
          </div>
          {error && <p className="pledge-error">{error}</p>}
          <div className="modal-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !stripe}
            >
              {submitting ? "Processing..." : "Confirm Pledge"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PaymentModal({
  stripePromise,
  clientSecret,
  onSuccess,
  onCancel,
}: {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
