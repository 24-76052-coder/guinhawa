import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './styles/admin.css';
import './styles/app.css';
import App from './App.jsx';

// The router must know which path prefix Vite deployed under: `/guinhawa` on
// XAMPP and nothing at all (`/`) on Vercel. Without this, deep links such as
// `/guinhawa/admin/dashboard` do not match any route after a page reload.
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || undefined;

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter basename={routerBasename}>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
);
