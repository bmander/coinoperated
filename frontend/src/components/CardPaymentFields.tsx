import { CardElement } from "@stripe/react-stripe-js";
import { useState } from "react";
import type { SavedPaymentMethod } from "../api/types";
import CardChip from "./CardChip";

export interface CardPaymentSelection {
  selectedPM: string;
  saveCard: boolean;
  usingSavedCard: boolean;
}

export function useCardPaymentSelection(
  savedMethods: SavedPaymentMethod[],
): [CardPaymentSelection, (sel: CardPaymentSelection) => void] {
  const [state, setState] = useState<CardPaymentSelection>(() => ({
    selectedPM: savedMethods.length > 0 ? savedMethods[0].id : "new",
    saveCard: true,
    usingSavedCard: savedMethods.length > 0,
  }));
  return [state, setState];
}

export default function CardPaymentFields({
  savedMethods,
  value,
  onChange,
  showSaveCheckbox = true,
  cardTextColor = "#e0e0e0",
}: {
  savedMethods: SavedPaymentMethod[];
  value: CardPaymentSelection;
  onChange: (sel: CardPaymentSelection) => void;
  showSaveCheckbox?: boolean;
  cardTextColor?: string;
}) {
  return (
    <>
      {savedMethods.length > 0 && (
        <div className="payment-method-selector">
          <label>Payment method</label>
          {savedMethods.map((pm) => (
            <label key={pm.id} className="payment-method-option">
              <input
                type="radio"
                name="payment-method"
                value={pm.id}
                checked={value.selectedPM === pm.id}
                onChange={() =>
                  onChange({ ...value, selectedPM: pm.id, usingSavedCard: true })
                }
              />
              <CardChip method={pm} />
            </label>
          ))}
          <label className="payment-method-option">
            <input
              type="radio"
              name="payment-method"
              value="new"
              checked={value.selectedPM === "new"}
              onChange={() =>
                onChange({ ...value, selectedPM: "new", usingSavedCard: false })
              }
            />
            <span className="pm-label">New card</span>
          </label>
        </div>
      )}

      {!value.usingSavedCard && (
        <div className="card-element-container">
          <label>Card details</label>
          <CardElement
            options={{
              disableLink: true,
              style: {
                base: {
                  fontSize: "16px",
                  color: cardTextColor,
                  "::placeholder": { color: "#888" },
                },
              },
            }}
          />
        </div>
      )}

      {!value.usingSavedCard && showSaveCheckbox && (
        <label className="save-card-checkbox">
          <input
            type="checkbox"
            checked={value.saveCard}
            onChange={(e) =>
              onChange({ ...value, saveCard: e.target.checked })
            }
          />
          Save this card for future pledges
        </label>
      )}
    </>
  );
}
