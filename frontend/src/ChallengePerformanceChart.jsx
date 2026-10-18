import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

function ChallengePerformanceChart({ analytics }) {
  if (!analytics) {
    return <p>Loading performance data...</p>;
  }

  const difficultyData = analytics.performance_by_difficulty || {};
  const typeData = analytics.performance_by_type || {};

  const difficultyChartData = {
    labels: ["Easy", "Medium", "Hard"],
    datasets: [
      {
        label: "Accuracy (%)",
        data: [
          difficultyData.easy?.accuracy || 0,
          difficultyData.medium?.accuracy || 0,
          difficultyData.hard?.accuracy || 0,
        ],
      },
    ],
  };

  const difficultyOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
      title: {
        display: true,
        text: "Performance by Difficulty",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Accuracy (%)",
        },
      },
    },
  };

  const typeLabels = Object.keys(typeData);

  const typeChartData = {
    labels: typeLabels.map(
      (type) => type.charAt(0).toUpperCase() + type.slice(1),
    ),
    datasets: [
      {
        label: "Accuracy (%)",
        data: typeLabels.map((type) => typeData[type]?.accuracy || 0),
      },
    ],
  };

  const typeOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
      title: {
        display: true,
        text: "Performance by Challenge Type",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Accuracy (%)",
        },
      },
    },
  };

  return (
    <div>
      <Bar data={difficultyChartData} options={difficultyOptions} />

      <div style={{ marginTop: "40px" }}>
        <Bar data={typeChartData} options={typeOptions} />
      </div>
    </div>
  );
}

export default ChallengePerformanceChart;
