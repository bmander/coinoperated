import { useState } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeCardElement } from "@stripe/stripe-js";
import type { SavedPaymentMethod } from "../api/types";
import CardPaymentFields, { useCardPaymentSelection } from "./CardPaymentFields";

function PaymentForm({
  clientSecret,
  savedMethods,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  savedMethods: SavedPaymentMethod[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentSelection, setPaymentSelection] = useCardPaymentSelection(savedMethods);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    let paymentMethod: string | { card: StripeCardElement };
    if (paymentSelection.usingSavedCard) {
      paymentMethod = paymentSelection.selectedPM;
    } else {
      const card = elements.getElement(CardElement);
      if (!card) return;
      paymentMethod = { card };
    }

    const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: paymentMethod,
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
          <CardPaymentFields
            savedMethods={savedMethods}
            value={paymentSelection}
            onChange={setPaymentSelection}
            cardTextColor="#213547"
          />

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
  savedMethods = [],
  onSuccess,
  onCancel,
}: {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
  savedMethods?: SavedPaymentMethod[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        clientSecret={clientSecret}
        savedMethods={savedMethods}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
