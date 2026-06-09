// frontend/src/pages/HomePage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      if (!res.ok) {
        throw new Error("Failed to create group");
      }
      const data = await res.json();
      // data = { group_id, name, invite_url }
      navigate(`/session/${data.group_id}`);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem" }}>
      <h1>FairShares</h1>

      {/* Existing "Load Group" button – hook this up to your current flow */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button
          // onClick={...your existing load logic...}
          style={{ padding: "0.5rem 1rem" }}
        >
          Load Group
        </button>
      </div>

      {/* New create group section */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <input
          type="text"
          placeholder="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          style={{
            flex: 1,
            padding: "0.5rem",
            borderRadius: 4,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={handleCreateGroup}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 4,
            border: "none",
            backgroundColor: "#2563eb",
            color: "white",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Creating…" : "Create group"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: "0.25rem" }}>{error}</p>}

      <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#555" }}>
        Enter a group name and click <strong>Create group</strong> to start a
        new session, invite friends, and add expenses.
      </p>
    </div>
  );
}

export default HomePage;
