// frontend/src/App.jsx
import "./App.css";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import ExpenseCard from "./components/ExpenseCard";

const API = "http://127.0.0.1:8000";

// ---------------- HomePage: existing logic + new "Create group" ----------------

function HomePage() {
  const [groupCode, setGroupCode] = useState("DEMO123");
  const [group, setGroup] = useState(null);
  const [groupId, setGroupId] = useState(null);

  const [balances, setBalances] = useState([]);

  const [newExpense, setNewExpense] = useState({
    paidBy: "",
    amount: "",
    desc: "",
    splits: [{ user: "", share: "" }],
  });

  const [suggested, setSuggested] = useState([]);

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

  // NEW: state for "Create group"
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState("");
  const navigate = useNavigate();

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
      const { data } = await axios.get(`${API}/group/${groupCode}`);
      setGroup(data);
      setGroupId(data.id);
      await fetchBalances(data.id);
      setSuggested([]);
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
    const { data } = await axios.get(`${API}/group/${gid}/balances`);
    setBalances(data);
  };

  const fetchSuggestedSettlements = async () => {
    if (!groupId) {
      alert("Load a group first");
      return;
    }
    const { data } = await axios.get(
      `${API}/group/${groupId}/settlements/suggested`,
    );
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

    try {
      await axios.post(`${API}/group/${groupId}/expense`, payload);
      setNewExpense({
        paidBy: "",
        amount: "",
        desc: "",
        splits: [{ user: "", share: "" }],
      });
      await fetchBalances(groupId);
      setSuggested([]);
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setCreateError("Please enter a group name");
      return;
    }
    setCreateError("");
    setCreatingGroup(true);
    try {
      const res = await fetch(`${API}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (!res.ok) {
        throw new Error("Failed to create group");
      }
      const data = await res.json();
      navigate(`/session/${data.group_id}`);
    } catch (e) {
      console.error(e);
      setCreateError(e.message || "Something went wrong");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleExpenseUpdated = (expenseId, updatedExpense) => {
    setGroup((prev) => {
      if (!prev) return prev;
      const nextExpenses = (prev.expenses || []).map((e) =>
        e.id === expenseId ? { ...e, ...updatedExpense } : e,
      );
      return { ...prev, expenses: nextExpenses };
    });
  };

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

      <div className="group-info" style={{ marginTop: "0.75rem" }}>
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="New group name (e.g. Goa Trip)"
          className="code-input"
        />
        <button onClick={handleCreateGroup} disabled={creatingGroup}>
          {creatingGroup ? "Creating..." : "Create group"}
        </button>
      </div>
      {createError && (
        <div style={{ color: "red", marginTop: "0.25rem" }}>{createError}</div>
      )}

      {group && (
        <>
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

      {/* Ad‑hoc n-people calculator (local demo on Home) */}
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

// ---------------- SessionPage: /session/:groupId ----------------

function SessionPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [participantId, setParticipantId] = useState(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [blocks, setBlocks] = useState([]);

  // load group once
  useEffect(() => {
    const fetchGroup = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(`${API}/groups/${groupId}`);
        setGroup(data);
      } catch (e) {
        console.error(e);
        setError("Could not load group");
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId]);

  // restore participant from localStorage
  useEffect(() => {
    const key = `fairshares-participant-${groupId}`;
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setParticipantId(parsed.id);
          setJoinName(parsed.name || "");
          setJoinEmail(parsed.email || "");
          return;
        }
      } catch (e) {
        console.warn("Could not parse stored participant", e);
      }
    }
    setShowJoinDialog(true);
  }, [groupId]);

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!joinName.trim()) {
      setJoinError("Please enter your name");
      return;
    }
    setJoinError("");
    setJoining(true);
    try {
      const payload = {
        name: joinName.trim(),
        email: joinEmail.trim() || null,
      };
      const { data } = await axios.post(
        `${API}/groups/${groupId}/participants`,
        payload,
      );
      setParticipantId(data.id);
      const key = `fairshares-participant-${groupId}`;
      window.localStorage.setItem(
        key,
        JSON.stringify({
          id: data.id,
          name: data.name,
          email: data.email,
        }),
      );
      setShowJoinDialog(false);
    } catch (e) {
      console.error(e);
      setJoinError("Could not join this session");
    } finally {
      setJoining(false);
    }
  };

  // ---- load shared ad‑hoc blocks with polling ----
  useEffect(() => {
    let cancelled = false;
    const fetchBlocks = async () => {
      try {
        const { data } = await axios.get(
          `${API}/groups/${groupId}/adhoc-blocks`,
        );
        if (!cancelled) setBlocks(data);
      } catch (e) {
        console.error("Error loading adhoc blocks", e);
      }
    };
    fetchBlocks();
    const id = setInterval(fetchBlocks, 2000); // poll every 2s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [groupId]);

  const addBlock = async () => {
    if (!participantId) {
      alert("Join the session first");
      return;
    }
    try {
      const { data } = await axios.post(
        `${API}/groups/${groupId}/adhoc-blocks`,
      );
      // optimistic update
      setBlocks((prev) => [...prev, data]);
    } catch (e) {
      console.error(e);
      alert("Error creating ad‑hoc block");
    }
  };

  const updateBlockLocally = (blockId, updater) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? updater(b) : b)));
  };

  const syncBlockToServer = async (block) => {
    const payload = {
      n_people: block.n_people,
      people: block.people,
      total_amount: Number(block.total_amount || 0),
      equal_split: !!block.equal_split,
      result: block.result || null,
    };
    try {
      await axios.put(
        `${API}/groups/${groupId}/adhoc-blocks/${block.id}`,
        payload,
      );
    } catch (e) {
      console.error("Error syncing block", block.id, e);
    }
  };

  const handleNPeopleChange = (blockId, newN) => {
    updateBlockLocally(blockId, (b) => {
      const n_people = newN < 1 ? 1 : newN;
      let people = [...b.people];
      if (n_people > people.length) {
        const start = people.length;
        for (let i = start; i < n_people; i++) {
          people.push({
            user_id: i + 1,
            name: `Person ${i + 1}`,
            paid: 0,
            share: 0,
          });
        }
      } else if (n_people < people.length) {
        people.length = n_people;
      }
      const updated = { ...b, n_people, people };
      syncBlockToServer(updated);
      return updated;
    });
  };

  const updatePersonField = (blockId, index, field, value) => {
    updateBlockLocally(blockId, (b) => {
      const people = [...b.people];
      people[index] = { ...people[index], [field]: value };
      const updated = { ...b, people };
      syncBlockToServer(updated);
      return updated;
    });
  };

  const updateBlockField = (blockId, field, value) => {
    updateBlockLocally(blockId, (b) => {
      const updated = { ...b, [field]: value };
      syncBlockToServer(updated);
      return updated;
    });
  };

  const runCustomSettle = async (blockId) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const payload = {
      total_amount: Number(block.total_amount || 0),
      equal_split: !!block.equal_split,
      people: block.people.map((p) => ({
        user_id: p.user_id,
        name: p.name,
        paid: Number(p.paid || 0),
        share: Number(p.share || 0),
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
      updateBlockLocally(blockId, (b) => {
        const updated = { ...b, result: data };
        syncBlockToServer(updated);
        return updated;
      });
    } catch (err) {
      console.error("Error calling /calc/settle", err);
      alert("Network error while running calculator");
    }
  };

  // ---- render ----
  if (loading) {
    return <div className="app">Loading session...</div>;
  }

  if (error || !group) {
    return <div className="app">Error: {error || "Group not found"}</div>;
  }

  const shareLink = window.location.href;

  return (
    <div className="app">
      <div className="hero-title">
        <div className="hero-main">
          <span className="logo-icon">💰</span>
          <span className="hero-text">Fair Shares</span>
        </div>
        <div className="hero-sub">Session for {group.name}</div>
      </div>

      {showJoinDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleJoinSession}
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: 8,
              minWidth: 320,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <h3>Join this session</h3>
            <p>
              Enter your name (and email if you like) so others know who you
              are.
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="email"
                placeholder="Your email (optional)"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                }}
              />
            </div>

            {joinError && (
              <div style={{ color: "red", marginBottom: "0.5rem" }}>
                {joinError}
              </div>
            )}

            <button type="submit" disabled={joining}>
              {joining ? "Joining..." : "Join session"}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <p>Share this link with friends:</p>
        <input
          value={shareLink}
          readOnly
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: 4,
            border: "1px solid #ccc",
          }}
        />
      </div>

      {participantId && (
        <div style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          You are joined as <strong>{joinName || "Guest"}</strong>.
        </div>
      )}

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <button
          onClick={addBlock}
          disabled={!participantId}
          title={!participantId ? "Join the session first" : ""}
        >
          + Add more expense
        </button>
      </div>

      {blocks.map((block) => (
        <section
          key={block.id}
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
                value={block.n_people}
                onChange={(e) =>
                  handleNPeopleChange(block.id, Number(e.target.value) || 1)
                }
              />
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              Total amount:{" "}
              <input
                type="number"
                value={block.total_amount}
                onChange={(e) =>
                  updateBlockField(block.id, "total_amount", e.target.value)
                }
              />
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              <input
                type="checkbox"
                checked={block.equal_split}
                onChange={(e) =>
                  updateBlockField(block.id, "equal_split", e.target.checked)
                }
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
              {block.people.map((p, idx) => (
                <tr key={p.user_id}>
                  <td>{idx + 1}</td>
                  <td>
                    <input
                      value={p.name}
                      onChange={(e) =>
                        updatePersonField(block.id, idx, "name", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={p.paid}
                      onChange={(e) =>
                        updatePersonField(block.id, idx, "paid", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={p.share}
                      onChange={(e) =>
                        updatePersonField(
                          block.id,
                          idx,
                          "share",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={() => runCustomSettle(block.id)}>
            Show Settlement Suggestions
          </button>

          {block.result && (
            <div style={{ marginTop: 12 }}>
              <h4>Suggested settlements</h4>
              <ul>
                {block.result.transactions.map((tx, i) => {
                  const from = block.people.find(
                    (p) => p.user_id === tx.from_user,
                  );
                  const to = block.people.find((p) => p.user_id === tx.to_user);
                  return (
                    <li key={i}>
                      {from?.name || tx.from_user} pays {to?.name || tx.to_user}{" "}
                      ₹{tx.amount.toFixed(2)}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------- App: router ----------------

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:groupId" element={<SessionPage />} />
    </Routes>
  );
}

export default App;
