// api/quiniela.js
const express = require('express');
const chromium = require('@sparticuz/chromium');
const { chromium: playwrightChromium } = require('playwright-core');
const serverless = require('serverless-http'); 
const app = express();

// IMPORTANTE: Express debe ser envuelto para Serverless Functions de Vercel
const serverlessHandler = serverless(app);

// ----------------------------------------------------------------------
// Función central para obtener JSON usando Playwright (Evita el 403)
// ----------------------------------------------------------------------
async function fetchDataWithPlaywright(url) {
    let browser;
    try {
        // --- Paso 1: Obtener la ruta del ejecutable ---
        const executablePath = await chromium.executablePath();
        
        console.log('1. Ruta del Ejecutable de Chromium:', executablePath);
        console.log('2. Intentando lanzar el navegador...');

        // --- Lanzamiento del navegador ---
        browser = await playwrightChromium.launch({ 
            // Usamos argumentos de Chromium más limpios y agresivos para evitar detecciones
            args: [...chromium.args, '--disable-features=site-per-process'], 
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true // Añadido para ignorar posibles errores SSL del proxy
        }); 
        
        console.log('3. Navegador lanzado con éxito. Abriendo nueva página...');
        
        const page = await browser.newPage();
        
        // Falsificar cabeceras
        await page.setExtraHTTPHeaders({
            'Referer': 'https://juegos.loteriasyapuestas.es/',
            'Origin': 'https://juegos.loteriasyapuestas.es',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Navegar a la URL de la API
        console.log('4. Navegando a la URL: ' + url);
        // Usamos 'domcontentloaded' para mayor velocidad y aumentamos el timeout
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded', // Esperar solo el DOM para mayor velocidad
            timeout: 60000 // 60 segundos
        });

        // --- Paso 5: DIAGNÓSTICO DEL BLOQUEO ---
        const statusCode = response ? response.status() : 'No Response';
        console.log(`5. Respuesta obtenida. Status Code: ${statusCode}`);
        
        // Si el estado es de bloqueo (403, 503, o 429), lanzamos un error claro.
        if (statusCode >= 400 && statusCode !== 200) {
            throw new Error(`El servidor devolvió el código de bloqueo: ${statusCode}.`);
        }
        
        const content = await response.text();

        await browser.close();
        console.log('6. Navegador cerrado. Devolviendo JSON.');

        return JSON.parse(content);

    } catch (error) {
        if (browser) await browser.close();
        console.error('ERROR CRÍTICO EN PLAYWRIGHT:', error);
        throw new Error("Fallo en la simulación del navegador (Playwright). Error: " + error.message);
    }
}

// ----------------------------------------------------------------------
// Lógica de Negocio (Igual)
// ----------------------------------------------------------------------
async function getPartidosQuiniela() {
    const URL_PROXIMOS = "https://www.loteriasyapuestas.es/servicios/proximosv3?game_id=LAQU";
    const BASE_URL_PARTIDOS = "https://www.loteriasyapuestas.es/servicios/fechav3?game_id=LAQU&fecha_sorteo=";

    // Primer fetch
    const dataProximos = await fetchDataWithPlaywright(URL_PROXIMOS);

    if (!dataProximos || dataProximos.length === 0 || !dataProximos[0].fecha) {
        throw new Error("No se pudo obtener la fecha del próximo sorteo.");
    }

    const fechaCompleta = dataProximos[0].fecha;
    const fechaFormatoAPI = fechaCompleta.substring(0, 10).replace(/-/g, '');
    
    // Segundo fetch
    const URL_PARTIDOS = BASE_URL_PARTIDOS + fechaFormatoAPI;
    const dataPartidos = await fetchDataWithPlaywright(URL_PARTIDOS);
    
    if (!dataPartidos || dataPartidos.length === 0 || !dataPartidos[0].partidos) {
        throw new Error("No se pudo obtener la lista de partidos.");
    }

    return dataPartidos[0];
}

// ----------------------------------------------------------------------
// ENDPOINT PRINCIPAL (Igual)
// ----------------------------------------------------------------------
app.get('/quiniela', async (req, res) => {
    // Configuración de CORS
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

module.exports = serverlessHandler;