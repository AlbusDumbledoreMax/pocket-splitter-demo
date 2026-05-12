import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:8000";

function App() {
  const [groupId, setGroupId] = useState("DEMO123");
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [newExpense, setNewExpense] = useState({
    paidBy: "",
    amount: "",
    desc: "",
    splits: [{ user: "", share: "" }],
  });

  useEffect(() => {
    if (groupId) fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const { data } = await axios.get(`${API}/group/${groupId}`);
      setGroup(data);
      fetchBalances(data.id);
    } catch (e) {
      alert("Group not found");
    }
  };

  const fetchBalances = async (gid) => {
    const { data } = await axios.get(`${API}/group/${gid}/balances`);
    setBalances(data);
  };

  const addExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/group/${group.id.id}/expense`, newExpense);
      setNewExpense({
        paidBy: "",
        amount: "",
        desc: "",
        splits: [{ user: "", share: "" }],
      });
      fetchBalances(group.id.id);
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || "Invalid splits"));
    }
  };

  const settleUp = async () => {
    if (window.confirm("Settle up? This records transactions.")) {
      await axios.post(`${API}/group/${group.id.id}/settle`);
      fetchBalances(group.id.id);
    }
  };

  const demoExpenses = [
    {
      paidBy: group?.members?.[0]?.id,
      amount: 1200,
      desc: "Dinner",
      splits: [
        { user: group?.members?.[0]?.id, share: 0.4 },
        { user: group?.members?.[1]?.id, share: 0.3 },
        { user: group?.members?.[2]?.id, share: 0.3 },
      ],
    },
    {
      paidBy: group?.members?.[1]?.id,
      amount: 800,
      desc: "Groceries",
      splits: [
        { user: group?.members?.[0]?.id, share: 0.5 },
        { user: group?.members?.[1]?.id, share: 0.5 },
      ],
    },
  ];

  return (
    <div className="app">
      <h1>💰 Pocket - Roommate Splitter</h1>

      <div className="group-info">
        <input
          value={groupId}
          onChange={(e) => setGroupId(e.target.value.toUpperCase())}
          placeholder="Enter invite code (try DEMO123)"
          className="code-input"
        />
        <button onClick={fetchGroup}>Load Group</button>
      </div>

      {group && (
        <>
          <div className="balances">
            <h2>Balances</h2>
            <div className="balance-grid">
              {balances.map((b) => (
                <div
                  key={b.user_id}
                  className={`balance ${b.balance > 0 ? "owes" : "owed"}`}
                >
                  <strong>{b.name}</strong>
                  <span>₹{Math.abs(b.balance).toFixed(0)}</span>
                  <small>{b.balance > 0 ? "owes" : "is owed"}</small>
                </div>
              ))}
            </div>
            <button onClick={settleUp} className="settle-btn">
              Settle Up
            </button>
          </div>

          <form onSubmit={addExpense} className="expense-form">
            <h3>Add Expense</h3>

            <div className="row">
              <select
                value={newExpense.paidBy}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, paidBy: e.target.value })
                }
                required
              >
                <option value="">Paid by?</option>
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Amount"
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, amount: e.target.value })
                }
                required
              />
            </div>

            <input
              type="text"
              placeholder="Description"
              value={newExpense.desc}
              onChange={(e) =>
                setNewExpense({ ...newExpense, desc: e.target.value })
              }
              required
            />

            <div className="splits">
              {newExpense.splits.map((s, i) => (
                <div key={i} className="split-row">
                  <select
                    value={s.user}
                    onChange={(e) => {
                      const splits = [...newExpense.splits];
                      splits[i].user = e.target.value;
                      setNewExpense({ ...newExpense, splits });
                    }}
                  >
                    <option value="">Who?</option>
                    {group.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Share %"
                    value={s.share}
                    onChange={(e) => {
                      const splits = [...newExpense.splits];
                      splits[i].share = parseFloat(e.target.value);
                      setNewExpense({ ...newExpense, splits });
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setNewExpense({
                    ...newExpense,
                    splits: [...newExpense.splits, { user: "", share: "" }],
                  })
                }
              >
                + Split
              </button>
            </div>

            <button type="submit">Add Expense</button>
            <button
              type="button"
              onClick={() => setNewExpense(demoExpenses[0])}
              className="demo-btn"
            >
              Demo: Dinner ₹1200 (40/30/30)
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default App;
