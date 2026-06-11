import { Navigate } from "react-router-dom";

// Auth page is disabled — the Apple-style passcode keypad in ProtectedRoute
// is the only gate, and it auto-signs in the owner account.
const Auth = () => <Navigate to="/" replace />;

export default Auth;
