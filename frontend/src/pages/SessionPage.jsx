import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import ExpenseCard from "../components/ExpenseCard";

const API = import.meta.env.VITE_API || "http://localhost:8000";

function SessionPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- existing session data load ----
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await axios.get(`${API}/groups/${groupId}`);
        // data = { id, name, invite_code, members, expenses }
        setGroup(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load group");
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId]);

  const handleExpenseUpdated = (expenseId, updatedExpense) => {
    setGroup((prev) => {
      if (!prev) return prev;
      const nextExpenses = (prev.expenses || []).map((e) =>
        e.id === expenseId ? { ...e, ...updatedExpense } : e,
      );
      return { ...prev, expenses: nextExpenses };
    });
  };

  // ---- Ad‑hoc n-people settle state (copied from HomePage) ----
  const [nPeople, setNPeople] = useState(3);
  const [calcPeople, setCalcPeople] = useState([
    { user_id: 1, name: "Person 1", paid: 0, share: 0 },
    { user_id: 2, name: "Person 2", paid: 0, share: 0 },
    { user_id: 3, name: "Person 3", paid: 0, share: 0 },
  ]);
  const [calcTotal, setCalcTotal] = useState(0);
  const [calcEqualSplit, setCalcEqualSplit] = useState(false);
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    setCalcPeople((prev) => {
      const copy = [...prev];
      if (nPeople > copy.length) {
        const start = copy.length;
        for (let i = start; i < nPeople; i++) {
          copy.push({
            user_id: i + 1,
            name: `Person ${i + 1}`,
            paid: 0,
            share: 0,
          });
        }
      } else if (nPeople < copy.length) {
        copy.length = nPeople;
      }
      return copy;
    });
  }, [nPeople]);

  const updatePersonField = (index, field, value) => {
    setCalcPeople((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const runCustomSettle = async () => {
    const payload = {
      total_amount: Number(calcTotal),
      equal_split: calcEqualSplit,
      people: calcPeople.map((p) => ({
        user_id: p.user_id,
        name: p.name,
        paid: Number(p.paid),
        share: Number(p.share),
      })),
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/calc/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert("Error running settle calculator");
        return;
      }
      const data = await res.json();
      setCalcResult(data);
    } catch (err) {
      console.error("Error calling /calc/settle", err);
      alert("Network error while running calculator");
    }
  };

  // ---- render ----
  if (loading) return <div>Loading session…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!group) return <div>Group not found</div>;

  const participants = group.members || [];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem" }}>
      <h1>{group.name}</h1>
      <p>Invite code: {group.invite_code}</p>

      <h2>Expenses</h2>
      {(group.expenses || []).length === 0 && (
        <p>No expenses yet. Use your “Add expense” flow to create one.</p>
      )}

      {(group.expenses || []).map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          participants={participants}
          onUpdated={handleExpenseUpdated}
        />
      ))}

      {/* Ad‑hoc n-people calculator (same as HomePage) */}
      <section
        style={{
          border: "1px solid #ccc",
          padding: 16,
          marginTop: 24,
          background: "#fafafa",
        }}
      >
        <h3>Ad‑hoc Group Settle (n people)</h3>

        <div style={{ marginBottom: 8 }}>
          <label>
            Number of people (n):{" "}
            <input
              type="number"
              min={1}
              value={nPeople}
              onChange={(e) => setNPeople(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            Total amount:{" "}
            <input
              type="number"
              value={calcTotal}
              onChange={(e) => setCalcTotal(e.target.value)}
            />
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={calcEqualSplit}
              onChange={(e) => setCalcEqualSplit(e.target.checked)}
            />{" "}
            Equal split (ignore % shares)
          </label>
        </div>

        <table
          border="1"
          cellPadding="4"
          style={{ marginBottom: 8, width: "100%" }}
        >
          <thead>
            <tr>
              <th>#</th>
              <th>Who (name)</th>
              <th>Paid amount</th>
              <th>Share % / weight</th>
            </tr>
          </thead>
          <tbody>
            {calcPeople.map((p, idx) => (
              <tr key={p.user_id}>
                <td>{idx + 1}</td>
                <td>
                  <input
                    value={p.name}
                    onChange={(e) =>
                      updatePersonField(idx, "name", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.paid}
                    onChange={(e) =>
                      updatePersonField(idx, "paid", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.share}
                    onChange={(e) =>
                      updatePersonField(idx, "share", e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={runCustomSettle}>Show Settlement Suggestions</button>

        {calcResult && (
          <div style={{ marginTop: 12 }}>
            <h4>Suggested settlements</h4>
            <ul>
              {calcResult.transactions.map((tx, i) => {
                const from = calcPeople.find((p) => p.user_id === tx.from_user);
                const to = calcPeople.find((p) => p.user_id === tx.to_user);
                return (
                  <li key={i}>
                    {from?.name || tx.from_user} pays {to?.name || tx.to_user} ₹
                    {tx.amount.toFixed(2)}
                  </li>
                );
              })}
            </ul>

            <button
              onClick={() => {
                alert(
                  "Conceptually settled for this ad‑hoc group.\n(No DB records are created here yet.)",
                );
              }}
            >
              Confirm Settle Up
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default SessionPage;
