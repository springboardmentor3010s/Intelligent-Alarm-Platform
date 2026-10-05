import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Alarms from "./pages/Alarms";
import Habits from "./pages/Habits";
import Challenges from "./pages/Challenges";
import Analytics from "./pages/Analytics";
import Coach from "./pages/Coach";

import AlarmTrigger from "./components/AlarmTrigger";

function App() {
  return (
    <BrowserRouter>

      {/* GLOBAL COGNIA ALARM */}
      <AlarmTrigger />

      <Routes>

        {/* Starting page */}
        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        {/* Authentication */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* Main COGNIA pages */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/alarms"
          element={<Alarms />}
        />

        <Route
          path="/habits"
          element={<Habits />}
        />

        <Route
          path="/challenges"
          element={<Challenges />}
        />

        <Route
          path="/analytics"
          element={<Analytics />}
        />
        <Route
  path="/coach"
  element={<Coach />}
/>

        {/* Unknown URL */}
        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;

