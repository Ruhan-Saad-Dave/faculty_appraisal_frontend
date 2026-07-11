import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global Storage Wrapper to isolate session data and prevent collisions with other systems on the same domain
const STORAGE_PREFIX = "faculty_";

const wrapStorageInstance = (storage) => {
  if (!storage) return;
  const originalGet = storage.getItem.bind(storage);
  const originalSet = storage.setItem.bind(storage);
  const originalRemove = storage.removeItem.bind(storage);

  storage.getItem = (key) => originalGet(STORAGE_PREFIX + key);
  storage.setItem = (key, value) => originalSet(STORAGE_PREFIX + key, value);
  storage.removeItem = (key) => originalRemove(STORAGE_PREFIX + key);
  
  storage.clear = () => {
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => originalRemove(key));
  };
};

try {
  wrapStorageInstance(window.sessionStorage);
  wrapStorageInstance(window.localStorage);
} catch (e) {
  console.error("Storage wrapper injection failed", e);
}


document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === 'U') ||
    (e.ctrlKey && e.key.toUpperCase() === 'S')
  ) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

