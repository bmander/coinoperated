import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { render } from "@testing-library/react";
import CardPaymentFields, { useCardPaymentSelection } from "./CardPaymentFields";
import type { SavedPaymentMethod } from "../api/types";

vi.mock("@stripe/react-stripe-js", () => ({
  CardElement: () => <div data-testid="card-element" />,
}));

const savedMethod: SavedPaymentMethod = {
  id: "pm_1",
  brand: "visa",
  last4: "4242",
  exp_month: 12,
  exp_year: 2027,
};

function TestWrapper({
  savedMethods = [],
  showSaveCheckbox,
  cardTextColor,
}: {
  savedMethods?: SavedPaymentMethod[];
  showSaveCheckbox?: boolean;
  cardTextColor?: string;
}) {
  const [value, onChange] = useCardPaymentSelection(savedMethods);
  return (
    <CardPaymentFields
      savedMethods={savedMethods}
      value={value}
      onChange={onChange}
      showSaveCheckbox={showSaveCheckbox}
      cardTextColor={cardTextColor}
    />
  );
}

describe("CardPaymentFields", () => {
  it("renders CardElement and save checkbox when no saved methods", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.getByLabelText("Save this card for future pledges")).toBeChecked();
    expect(screen.queryByText("Payment method")).not.toBeInTheDocument();
  });

  it("renders radios and hides CardElement when saved methods provided", () => {
    render(<TestWrapper savedMethods={[savedMethod]} />);

    expect(screen.getByText("Payment method")).toBeInTheDocument();
    expect(screen.getByText("Visa", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("…4242")).toBeInTheDocument();
    expect(screen.getByText(/12\/2027/)).toBeInTheDocument();
    expect(screen.getByText("New card")).toBeInTheDocument();
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Save this card for future pledges")).not.toBeInTheDocument();
  });

  it("shows CardElement and checkbox when New card is clicked", async () => {
    render(<TestWrapper savedMethods={[savedMethod]} />);

    await userEvent.click(screen.getByLabelText("New card"));

    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.getByLabelText("Save this card for future pledges")).toBeInTheDocument();
  });

  it("hides checkbox when showSaveCheckbox is false", () => {
    render(<TestWrapper showSaveCheckbox={false} />);

    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.queryByLabelText("Save this card for future pledges")).not.toBeInTheDocument();
  });

  it("calls onChange with correct selection on radio click", async () => {
    const onChange = vi.fn();

    function ControlledWrapper() {
      const [value, setValue] = useCardPaymentSelection([savedMethod]);
      return (
        <CardPaymentFields
          savedMethods={[savedMethod]}
          value={value}
          onChange={(sel) => { setValue(sel); onChange(sel); }}
        />
      );
    }

    render(<ControlledWrapper />);

    await userEvent.click(screen.getByLabelText("New card"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPM: "new", usingSavedCard: false }),
    );
  });

  it("calls onChange with correct selection on checkbox click", async () => {
    const onChange = vi.fn();

    function ControlledWrapper() {
      const [value, setValue] = useCardPaymentSelection([]);
      return (
        <CardPaymentFields
          savedMethods={[]}
          value={value}
          onChange={(sel) => { setValue(sel); onChange(sel); }}
        />
      );
    }

    render(<ControlledWrapper />);

    await userEvent.click(screen.getByLabelText("Save this card for future pledges"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ saveCard: false }),
    );
  });

  it("switching back from New card to saved PM hides CardElement", async () => {
    render(<TestWrapper savedMethods={[savedMethod]} />);

    await userEvent.click(screen.getByLabelText("New card"));
    expect(screen.getByTestId("card-element")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Visa.*4242/));
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Save this card for future pledges")).not.toBeInTheDocument();
  });

  it("showSaveCheckbox={false} hides checkbox even after clicking New card with saved methods", async () => {
    render(<TestWrapper savedMethods={[savedMethod]} showSaveCheckbox={false} />);

    await userEvent.click(screen.getByLabelText("New card"));

    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.queryByLabelText("Save this card for future pledges")).not.toBeInTheDocument();
  });

  it("renders multiple saved methods and selecting second fires correct id", async () => {
    const onChange = vi.fn();
    const methods: SavedPaymentMethod[] = [
      savedMethod,
      { id: "pm_2", brand: "mastercard", last4: "5555", exp_month: 3, exp_year: 2028 },
    ];

    function ControlledWrapper() {
      const [value, setValue] = useCardPaymentSelection(methods);
      return (
        <CardPaymentFields
          savedMethods={methods}
          value={value}
          onChange={(sel) => { setValue(sel); onChange(sel); }}
        />
      );
    }

    render(<ControlledWrapper />);

    expect(screen.getByText("…4242")).toBeInTheDocument();
    expect(screen.getByText("…5555")).toBeInTheDocument();
    // Single-digit month should be zero-padded
    expect(screen.getByText(/03\/2028/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Mastercard.*5555/));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPM: "pm_2", usingSavedCard: true }),
    );
  });
});
