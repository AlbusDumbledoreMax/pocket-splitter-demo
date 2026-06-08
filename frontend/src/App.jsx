import "./App.css";
import { useState, useEffect } from "react";
import axios from "axios";

// If you don't have App.css yet, you can comment this out or create the file.
// import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  // invite code string (DEMO123 by default)
  const [groupCode, setGroupCode] = useState("DEMO123");
  // full group object from backend
  const [group, setGroup] = useState(null);
  // numeric group id (from backend)
  const [groupId, setGroupId] = useState(null);

  const [balances, setBalances] = useState([]);

  const [newExpense, setNewExpense] = useState({
    paidBy: "",
    amount: "",
    desc: "",
    splits: [{ user: "", share: "" }],
  });

  const [suggested, setSuggested] = useState([]); // suggested settle-up transactions

  // Ad‑hoc n-people settle state
  const [nPeople, setNPeople] = useState(3);
  const [calcPeople, setCalcPeople] = useState([
    { user_id: 1, name: "Person 1", paid: 0, share: 0 },
    { user_id: 2, name: "Person 2", paid: 0, share: 0 },
    { user_id: 3, name: "Person 3", paid: 0, share: 0 },
  ]);
  const [calcTotal, setCalcTotal] = useState(0);
  const [calcEqualSplit, setCalcEqualSplit] = useState(false);
  const [calcResult, setCalcResult] = useState(null);

  // Keep calcPeople array length in sync with nPeople
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

  const fetchGroup = async () => {
    try {
      console.log("Fetching group for code:", groupCode);
      const { data } = await axios.get(`${API}/group/${groupCode}`);
      console.log("Group loaded:", data);
      setGroup(data);
      setGroupId(data.id); // store numeric id for later
      await fetchBalances(data.id);
      setSuggested([]); // clear old suggestions when group changes
    } catch (e) {
      console.error("Error fetching group:", e);
      alert("Group not found");
      setGroup(null);
      setGroupId(null);
      setBalances([]);
      setSuggested([]);
    }
  };

  const fetchBalances = async (gid) => {
    console.log("Fetching balances for group:", gid);
    const { data } = await axios.get(`${API}/group/${gid}/balances`);
    console.log("Balances:", data);
    setBalances(data);
  };

  const fetchSuggestedSettlements = async () => {
    if (!groupId) {
      alert("Load a group first");
      return;
    }
    console.log("Clicked Show Settle Up Suggestions");
    const { data } = await axios.get(
      `${API}/group/${groupId}/settlements/suggested`,
    );
    console.log("Suggested settlements:", data.transactions);
    setSuggested(data.transactions);
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!group || !groupId) {
      alert("Load group first");
      return;
    }

    const splitsPayload = newExpense.splits
      .filter((s) => s.user && s.share !== "")
      .map((s) => ({
        user_id: parseInt(s.user, 10),
        // UI takes percentage (40,30,30); backend expects fraction (0.4,0.3,0.3)
        share: parseFloat(s.share) / 100,
      }));

    if (splitsPayload.length === 0) {
      alert("Add at least one split row with user and share");
      return;
    }

    const totalShare = splitsPayload.reduce((sum, s) => sum + s.share, 0);
    if (Math.abs(totalShare - 1) > 0.01) {
      alert("Total shares must be ~100%");
      return;
    }

    const payload = {
      paid_by: parseInt(newExpense.paidBy, 10),
      amount: parseFloat(newExpense.amount),
      description: newExpense.desc,
      splits: splitsPayload,
    };

    console.log("Submitting expense payload:", payload);

    try {
      await axios.post(`${API}/group/${groupId}/expense`, payload);
      console.log("Expense created successfully");
      setNewExpense({
        paidBy: "",
        amount: "",
        desc: "",
        splits: [{ user: "", share: "" }],
      });
      await fetchBalances(groupId);
      setSuggested([]); // clear suggestions; they may have changed
    } catch (e) {
      console.error("Error creating expense:", e.response || e);
      alert("Error: " + (e.response?.data?.detail || "Invalid splits"));
    }
  };

  const settleUp = async () => {
    if (!groupId) {
      alert("Load group first");
      return;
    }
    console.log("Clicked Confirm Settle Up");

    if (
      suggested.length === 0 &&
      !window.confirm(
        "No suggested settlements loaded. Do you still want to settle?",
      )
    ) {
      return;
    }

    if (window.confirm("Settle up? This records transactions.")) {
      await axios.post(`${API}/group/${groupId}/settle`);
      console.log("Settle up applied");
      await fetchBalances(groupId);
      setSuggested([]);
    }
  };

  const demoExpenses = [
    {
      paidBy: group?.members?.[0]?.id?.toString() || "",
      amount: 1200,
      desc: "Dinner",
      splits: [
        {
          user: group?.members?.[0]?.id?.toString() || "",
          share: 40,
        },
        {
          user: group?.members?.[1]?.id?.toString() || "",
          share: 30,
        },
        {
          user: group?.members?.[2]?.id?.toString() || "",
          share: 30,
        },
      ],
    },
    {
      paidBy: group?.members?.[1]?.id?.toString() || "",
      amount: 800,
      desc: "Groceries",
      splits: [
        {
          user: group?.members?.[0]?.id?.toString() || "",
          share: 50,
        },
        {
          user: group?.members?.[1]?.id?.toString() || "",
          share: 50,
        },
      ],
    },
  ];

  return (
    <div className="app">
      <div className="hero-title">
        <div className="hero-main">
          <span className="logo-icon">💰</span>
          <span className="hero-text">Fair Shares</span>
        </div>
        <div className="hero-sub">Make Every Split Feel Fair</div>
      </div>

      <div className="group-info">
        <input
          value={groupCode}
          onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
          placeholder="Enter invite code (try DEMO123)"
          className="code-input"
        />
        <button onClick={fetchGroup}>Load Group</button>
      </div>

      {group && (
        <>
          {/* Debug box so you can SEE the group is loaded */}
          <div
            className="debug-box"
            style={{
              background: "#222",
              color: "#0f0",
              padding: "8px",
              marginBottom: "12px",
              fontSize: "12px",
            }}
          >
            <div>Debug: Loaded group</div>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(group, null, 2)}
            </pre>
          </div>

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

            <div className="settle-actions">
              <button
                onClick={fetchSuggestedSettlements}
                className="settle-btn"
              >
                Show Settle Up Suggestions
              </button>
              <button onClick={settleUp} className="settle-btn">
                Confirm Settle Up
              </button>
            </div>

            <div className="suggestions">
              <h3>Suggested Transfers (raw)</h3>
              <pre className="suggestions-pre">
                {JSON.stringify(suggested, null, 2)}
              </pre>
            </div>
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
                      splits[i].share = e.target.value;
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

      {/* Ad‑hoc n-people calculator (works even without loading a group) */}
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

        <table border="1" cellPadding="4" style={{ marginBottom: 8 }}>
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

export default App;
