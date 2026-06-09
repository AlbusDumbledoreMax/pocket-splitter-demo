import React, { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API || "http://localhost:8000";

export function ExpenseCard({ expense, participants, onUpdated }) {
  const [name, setName] = useState(expense.name || expense.description || "");
  const [amount, setAmount] = useState(expense.amount ?? 0);
  const [paidBy, setPaidBy] = useState(expense.paid_by ?? "");
  const [splits, setSplits] = useState(expense.splits || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [proofUrl, setProofUrl] = useState(expense.receipt_url || "");

  useEffect(() => {
    setName(expense.name || expense.description || "");
    setAmount(expense.amount ?? 0);
    setPaidBy(expense.paid_by ?? "");
    setSplits(expense.splits || []);
    setProofUrl(expense.receipt_url || "");
  }, [expense]);

  const handleSplitChange = (index, field, value) => {
    const next = splits.map((s, i) => {
      if (i !== index) return s;
      if (field === "share") {
        return { ...s, share: Number(value) };
      }
      if (field === "user_id") {
        return { ...s, user_id: Number(value) };
      }
      return s;
    });
    setSplits(next);
  };

  const handleAddSplit = () => {
    if (!participants?.length) return;
    const defaultUserId = participants[0].id;
    setSplits([...splits, { user_id: defaultUserId, share: 0 }]);
  };

  const handleRemoveSplit = (index) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const payload = {
        name: name.trim(),
        paid_by: paidBy ? Number(paidBy) : null,
        total_amount: Number(amount),
        splits: splits.map((s) => ({
          user_id: s.user_id,
          share: Number(s.share) / 100, // UI in percent, backend expects 0–1
        })),
      };

      const { data } = await axios.put(
        `${API}/expenses/${expense.id}`,
        payload,
      );

      if (onUpdated) {
        onUpdated(expense.id, data);
      }

      setName(data.name || data.description || "");
      setAmount(data.amount ?? 0);
      setPaidBy(data.paid_by ?? "");
      setProofUrl(data.receipt_url || "");
    } catch (err) {
      console.error(err);
      setError("Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProof = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post(
        `${API}/expenses/${expense.id}/proof`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      setProofUrl(data.receipt_url || "");

      if (onUpdated) {
        onUpdated(expense.id, data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to upload proof");
    }
  };

  return (
    <div className="expense-card">
      <div className="expense-row">
        <input
          type="text"
          placeholder="Expense name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value="">Paid by</option>
          {(participants || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="expense-splits">
        <div className="splits-header">
          <span>Splits</span>
          <button type="button" onClick={handleAddSplit}>
            + Add person
          </button>
        </div>

        {(splits || []).map((s, index) => (
          <div key={index} className="split-row">
            <select
              value={s.user_id ?? ""}
              onChange={(e) =>
                handleSplitChange(index, "user_id", e.target.value)
              }
            >
              {(participants || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={s.share ?? 0}
              onChange={(e) =>
                handleSplitChange(index, "share", e.target.value)
              }
            />
            <span>%</span>

            <button type="button" onClick={() => handleRemoveSplit(index)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="expense-proof">
        <label>
          Attach proof:
          <input type="file" accept="image/*" onChange={handleUploadProof} />
        </label>

        {proofUrl && (
          <div className="proof-preview">
            <span>Attached:</span>
            <span className="proof-path">{proofUrl}</span>
          </div>
        )}
      </div>

      {error && <div className="expense-error">{error}</div>}

      <div className="expense-actions">
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default ExpenseCard;
