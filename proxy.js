// proxy.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3000; // El proxy se ejecutará en http://localhost:3000

// --- Configuración de CORS para el Frontend ---
// Permitimos los orígenes comunes de http-server para evitar 'null' o 'localhost' vs '127.0.0.1'
const allowedOrigins = [
    'http://127.0.0.1:8080',
    'http://localhost:8080'
];

app.use(cors({
    origin: allowedOrigins,
    // Permite que el navegador acceda a las cabeceras de respuesta
    exposedHeaders: ['X-Custom-Header'] 
}));
app.use(express.json());

// --- Cabeceras para Evitar el Bloqueo 403 en la API de Loterías ---
const loteriasHeaders = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9,es-ES;q=0.8,es;q=0.7',
    'Content-Type': 'application/json',
    'Origin': 'https://juegos.loteriasyapuestas.es',
    'Referer': 'https://juegos.loteriasyapuestas.es/',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
};

// --- ENDPOINT 1: Obtener la fecha del sorteo ---
app.get('/api/proximo', async (req, res) => {
    const URL_PROXIMOS = 'https://www.loteriasyapuestas.es/servicios/proximosv3?game_id=LAQU';
    
    try {
        const response = await axios.get(URL_PROXIMOS, { headers: loteriasHeaders });
        
        // **PASO CLAVE:** Eliminar la cabecera CORS restrictiva de la respuesta de Loterías.
        // Esto permite que el middleware 'cors' de Express aplique nuestra cabecera permitida.
        res.removeHeader('Access-Control-Allow-Origin'); 
        
        res.json(response.data);
    } catch (error) {
        console.error('Error en /api/proximo:', error.message);
        res.status(500).json({ error: 'Fallo al obtener la fecha del sorteo de la API de Loterías.', details: error.message });
    }
});

// --- ENDPOINT 2: Obtener los partidos por fecha ---
app.get('/api/partidos/:fecha', async (req, res) => {
    const fecha = req.params.fecha; // Fecha en formato YYYYMMDD
    const URL_PARTIDOS = `https://www.loteriasyapuestas.es/servicios/fechav3?game_id=LAQU&fecha_sorteo=${fecha}`;

    try {
        const response = await axios.get(URL_PARTIDOS, { headers: loteriasHeaders });
        
        // **PASO CLAVE:** Eliminar la cabecera CORS restrictiva.
        res.removeHeader('Access-Control-Allow-Origin'); 
        
        res.json(response.data);
    } catch (error) {
        console.error('Error en /api/partidos:', error.message);
        res.status(500).json({ error: 'Fallo al obtener los partidos de la API de Loterías.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`\n✅ Proxy CORS local iniciado en http://localhost:${port}`);
    console.log(`\n**IMPORTANTE:** Accede a tu HTML en el navegador usando http://127.0.0.1:8080 o http://localhost:8080`);
});