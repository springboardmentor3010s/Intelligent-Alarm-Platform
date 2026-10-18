import React from "react";
import Plot from "react-plotly.js";

function BehaviorAnalyticsChart({ habitScore }) {
  if (!habitScore) {
    return <p>Loading behavioral analytics...</p>;
  }

  const labels = ["Accuracy", "Average Time", "Average Attempts"];

  const values = [
    Number(habitScore.accuracy_score) || 0,
    Number(habitScore.average_time_seconds) || 0,
    Number(habitScore.average_attempts) || 0,
  ];

  return (
    <div style={{ marginTop: "40px" }}>
      <Plot
        data={[
          {
            x: labels,
            y: values,
            type: "bar",
            hovertemplate: "%{x}: %{y}<extra></extra>",
          },
        ]}
        layout={{
          title: {
            text: "Behavioral Performance Overview",
          },
          xaxis: {
            title: "Performance Metric",
          },
          yaxis: {
            title: "Value",
            rangemode: "tozero",
          },
          autosize: true,
          margin: {
            l: 60,
            r: 30,
            t: 70,
            b: 60,
          },
        }}
        config={{
          responsive: true,
          displayModeBar: false,
        }}
        style={{
          width: "100%",
          height: "450px",
        }}
      />
    </div>
  );
}

export default BehaviorAnalyticsChart;
