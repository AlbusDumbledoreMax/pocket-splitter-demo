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
    </div>
  );
}

export default SessionPage;
