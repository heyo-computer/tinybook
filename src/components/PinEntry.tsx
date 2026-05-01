import { useState } from "react";

type PinEntryProps = {
  onAuthenticated: (sessionId: string) => void;
};

export function PinEntry({ onAuthenticated }: PinEntryProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (res.ok) {
        onAuthenticated(data.sessionId);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pin-overlay">
      <form className="pin-form" onSubmit={handleSubmit}>
        <h2>Enter PIN</h2>
        <p className="pin-subtitle">Enter the 6-digit PIN from the server console</p>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          className="pin-input"
          autoFocus
          disabled={loading}
        />
        {error && <p className="pin-error">{error}</p>}
        <button type="submit" disabled={loading || pin.length !== 6} className="pin-submit">
          {loading ? "Verifying..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}