import { createRoot } from 'react-dom/client';
import { store } from './store';
import './styles.css';
import App from './App';
document.documentElement.dataset.theme = store.get('ep_theme') || 'neon'; // set before first paint
createRoot(document.getElementById('root')!).render(<App />);
