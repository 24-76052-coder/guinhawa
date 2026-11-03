import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './styles/admin.css';
import './styles/app.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
);
