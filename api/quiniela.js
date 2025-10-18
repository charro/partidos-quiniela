// api/quiniela.js
const express = require('express');
const { chromium } = require('playwright-chromium'); // Usamos Playwright
const app = express();
// IMPORTANTE: Express debe ser envuelto para Serverless Functions de Vercel
const serverless = require('serverless-http');

// ----------------------------------------------------------------------
// Función central para obtener JSON usando Playwright (Evita el 403)
// ----------------------------------------------------------------------
async function fetchDataWithPlaywright(url) {
    let browser;
    try {
        // Playwright.launch inicia un navegador headless
        browser = await chromium.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }); 
        
        const page = await browser.newPage();
        
        // Falsificar cabeceras clave para evitar el bloqueo
        await page.setExtraHTTPHeaders({
            'Referer': 'https://juegos.loteriasyapuestas.es/',
            'Origin': 'https://juegos.loteriasyapuestas.es',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Navegar a la URL de la API y obtener el JSON como texto
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        const content = await response.text();

        await browser.close();

        return JSON.parse(content);

    } catch (error) {
        if (browser) await browser.close();
        throw new Error("Fallo en la simulación del navegador (Playwright).");
    }
}

// ----------------------------------------------------------------------
// Lógica de Negocio (Igual que en Apps Script, pero con Playwright)
// ----------------------------------------------------------------------
async function getPartidosQuiniela() {
    const URL_PROXIMOS = "https://www.loteriasyapuestas.es/servicios/proximosv3?game_id=LAQU";
    const BASE_URL_PARTIDOS = "https://www.loteriasyapuestas.es/servicios/fechav3?game_id=LAQU&fecha_sorteo=";

    const dataProximos = await fetchDataWithPlaywright(URL_PROXIMOS);

    if (!dataProximos || dataProximos.length === 0 || !dataProximos[0].fecha) {
        throw new Error("No se pudo obtener la fecha del próximo sorteo.");
    }

    const fechaCompleta = dataProximos[0].fecha;
    const fechaFormatoAPI = fechaCompleta.substring(0, 10).replace(/-/g, '');
    
    const URL_PARTIDOS = BASE_URL_PARTIDOS + fechaFormatoAPI;
    const dataPartidos = await fetchDataWithPlaywright(URL_PARTIDOS);
    
    if (!dataPartidos || dataPartidos.length === 0 || !dataPartidos[0].partidos) {
        throw new Error("No se pudo obtener la lista de partidos.");
    }

    // Formatear la salida a JSON (más fácil de consumir en el frontend)
    return dataPartidos[0];
}

// ----------------------------------------------------------------------
// ENDPOINT PRINCIPAL (La ruta de tu proxy)
// ----------------------------------------------------------------------
app.get('/quiniela', async (req, res) => {
    // 1. Configuración de CORS
    // Vercel maneja esto automáticamente, pero podemos ser explícitos
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Content-Type', 'application/json');

    try {
        const resultado = await getPartidosQuiniela();
        res.status(200).json(resultado);
    } catch (error) {
        console.error("Error en la función serverless:", error.message);
        res.status(500).json({ error: 'Fallo en la consulta del proxy', details: error.message });
    }
});

// Nota: La ruta de tu API será https://[nombre-proyecto].vercel.app/api/quiniela
module.exports = serverless(app);