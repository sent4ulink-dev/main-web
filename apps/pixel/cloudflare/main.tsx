import { createRoot } from 'react-dom/client';
import { ShareShell } from '@/components/share/ShareShell';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(<ShareShell />);
