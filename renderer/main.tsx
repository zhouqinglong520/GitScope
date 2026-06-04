import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// @ts-ignore - CSS module
import './styles/index.css';

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('[React] 全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[React] 未处理的 Promise 拒绝:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
