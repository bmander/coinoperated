import type { SavedPaymentMethod } from "../api/types";
import { capitalize } from "../utils/formatting";

export default function CardChip({ method }: { method: SavedPaymentMethod }) {
  return (
    <span className="pm-label pm-chip">
      {capitalize(method.brand)}{" "}
      <span className="pm-mono">…{method.last4}</span>
      <span className="pm-expiry">
        {" "}Exp{" "}
        <span className="pm-mono">
          {String(method.exp_month).padStart(2, "0")}/{method.exp_year}
        </span>
      </span>
    </span>
  );
}
