import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            color: "#0f172a",
            background: "#f8fafc",
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#64748b", marginBottom: 16 }}>
            The app hit a runtime error. Check the browser console for details.
          </p>
          <pre
            style={{
              fontSize: 12,
              overflow: "auto",
              padding: 12,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              color: "#b91c1c",
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
