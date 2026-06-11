import { Navigate } from "react-router-dom";

// /home is merged into the vault at /. Ash chat lives in AshDock,
// which floats over the vault on every screen.
const Home = () => <Navigate to="/" replace />;

export default Home;
