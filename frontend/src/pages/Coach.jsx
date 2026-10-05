
import { useEffect, useState } from "react";

function Coach() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const API_URL = "http://localhost:8000";

  const loadUsers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_URL}/coach/users`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load users");
      }

      setUsers(data.users || []);
    } catch (error) {
      setMessage(error.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "35px",
        background: "#f4f8ff",
        color: "#172033",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#ffffff",
          padding: "25px",
          borderRadius: "16px",
          marginBottom: "25px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
          borderLeft: "5px solid #2563eb",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            color: "#123b7a",
            fontSize: "30px",
          }}
        >
          👩‍🏫 Wellness Coach
        </h1>

        <p
          style={{
            margin: 0,
            color: "#475569",
            fontSize: "16px",
          }}
        >
          Monitor user wake-up habits, cognitive performance and wellness
          progress.
        </p>
      </div>

      {/* REFRESH BUTTON */}
      <button
        onClick={loadUsers}
        style={{
          padding: "11px 20px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          marginBottom: "25px",
          background: "#2563eb",
          color: "#ffffff",
          fontSize: "15px",
          fontWeight: "600",
        }}
      >
        🔄 Refresh Users
      </button>

      {/* LOADING */}
      {loading && (
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "12px",
            color: "#334155",
          }}
        >
          Loading users...
        </div>
      )}

      {/* ERROR */}
      {message && (
        <div
          style={{
            background: "#fff1f2",
            color: "#b91c1c",
            padding: "15px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          {message}
        </div>
      )}

      {/* USERS */}
      {!loading && !message && (
        <>
          <div
            style={{
              background: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              marginBottom: "20px",
              boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                color: "#123b7a",
              }}
            >
              👥 Registered Users
            </h2>

            <p
              style={{
                margin: 0,
                color: "#475569",
              }}
            >
              Total Users:{" "}
              <strong style={{ color: "#172033" }}>
                {users.length}
              </strong>
            </p>
          </div>

          {users.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                padding: "25px",
                borderRadius: "12px",
                color: "#475569",
              }}
            >
              No users found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "20px",
              }}
            >
              {users.map((user, index) => (
                <div
                  key={user.email || index}
                  style={{
                    padding: "25px",
                    borderRadius: "16px",
                    border: "1px solid #dbe4f0",
                    background: "#ffffff",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.07)",
                  }}
                >
                  {/* USER NAME */}
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "20px",
                      color: "#123b7a",
                      fontSize: "21px",
                    }}
                  >
                    👤 {user.name}
                  </h3>

                  {/* EMAIL */}
                  <p
                    style={{
                      color: "#172033",
                      margin: "10px 0",
                    }}
                  >
                    <strong>Email:</strong>{" "}
                    <span style={{ color: "#334155" }}>
                      {user.email}
                    </span>
                  </p>

                  {/* ROLE */}
                  <p
                    style={{
                      color: "#172033",
                      margin: "10px 0",
                    }}
                  >
                    <strong>Role:</strong>{" "}
                    <span style={{ color: "#2563eb", fontWeight: "600" }}>
                      {user.role}
                    </span>
                  </p>

                  {/* ACCOUNT CREATED */}
                  <p
                    style={{
                      color: "#172033",
                      margin: "10px 0",
                    }}
                  >
                    <strong>Account Created:</strong>{" "}
                    <span style={{ color: "#334155" }}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString()
                        : "N/A"}
                    </span>
                  </p>

                  {/* WELLNESS MONITORING */}
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#eef5ff",
                      border: "1px solid #c9ddff",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#123b7a",
                        fontSize: "17px",
                        marginBottom: "8px",
                      }}
                    >
                      Wellness Monitoring
                    </strong>

                    <p
                      style={{
                        margin: 0,
                        color: "#334155",
                        lineHeight: "1.6",
                      }}
                    >
                      View this user's wake-up, challenge, habit and sleep
                      analytics.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Coach;

