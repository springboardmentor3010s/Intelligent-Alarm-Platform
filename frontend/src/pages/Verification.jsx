import React from "react";

function Verification() {
  return (
    <div className="page-container">
      <h1>⏰ Wake-Up Verification</h1>

      <p>
        Complete the cognitive challenge to verify that you are awake.
      </p>

      <div className="verification-card">
        <h2>🧠 Cognitive Verification</h2>

        <p>
          Please complete the assigned challenge to dismiss the alarm.
        </p>

        <button
          onClick={() => {
            window.location.href = "/challenges";
          }}
        >
          Start Challenge
        </button>
      </div>
    </div>
  );
}

export default Verification;

