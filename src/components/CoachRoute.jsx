import { Navigate } from "react-router-dom";

function CoachRoute({ children }) {
  const user = JSON.parse(
    localStorage.getItem("user")
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "wellness_coach") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default CoachRoute;
