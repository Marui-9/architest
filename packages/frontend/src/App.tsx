import { useAppStore } from './store';
import LandingScreen from './components/LandingScreen';
import GraphCanvas from './components/GraphCanvas';

export default function App() {
  const view = useAppStore((s) => s.view);

  return view === 'canvas' ? <GraphCanvas /> : <LandingScreen />;
}
