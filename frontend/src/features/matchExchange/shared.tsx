import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { journeyLabel, useJourneyCopy } from "./journeyCopy";
import "./match-exchange.css";
export function Back() {
  return (
    <Link className="mx-button mx-back" to="/match-exchange">
      <ArrowLeft size={16} /> Match Exchange
    </Link>
  );
}
export function LoadState({
  error,
  reload,
}: {
  error: string;
  reload: () => void;
}) {
  return error ? (
    <div className="mx-empty">
      <p role="alert">{error}</p>
      <button onClick={reload}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  ) : (
    <p className="mx-empty" role="status">
      Loading…
    </p>
  );
}
export function Status({ value }: { value: string }) {
  const { language } = useJourneyCopy();
  return (
    <span
      className={`mx-status ${["ACCEPTED", "BOOKED", "ARRANGED", "COMPLETED"].includes(value) ? "is-good" : ""}`}
    >
      {journeyLabel(value, language)}
    </span>
  );
}
