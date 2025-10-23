import requests
import json
import sys
import os
from dotenv import load_dotenv
from typing import Dict, Any, Optional

# =====================================================================
#                          GIST CONFIGURATION
# =====================================================================

# 1. Your GitHub Personal Access Token (PAT)
# ⚠️ SECURITY NOTE: Load this from an environment variable for production!

load_dotenv()
# Replace 'YOUR_GITHUB_TOKEN_HERE' with your actual token.
TOKEN = os.environ.get("GIST_UPDATE_TOKEN", "")

# 2. The ID of the Gist you want to update
# GIST URL: https://gist.github.com/charro/d6b5be152cf5e3f6ebb02f2daa60f291
GIST_ID = "d6b5be152cf5e3f6ebb02f2daa60f291"

# 3. The filename *within* the Gist to be updated
GIST_FILENAME = "partidos.json"

# =====================================================================
#                          LOTERIAS API CONFIG
# =====================================================================

URL_PROXIMOS = "https://www.loteriasyapuestas.es/servicios/proximosv3?game_id=LAQU"
BASE_URL_PARTIDOS = "https://www.loteriasyapuestas.es/servicios/fechav3?game_id=LAQU&fecha_sorteo="
TIMEOUT_SECONDS = 10

# Cabeceras Stealth (Crucial para esta API)
STEALTH_HEADERS = {
    'Referer': 'https://juegos.loteriasyapuestas.es/',
    'Origin': 'https://juegos.loteriasyapuestas.es',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'priority': 'u=1, i'
    'sec-ch-ua' '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    'sec-fetch-mode': 'cors'
}

# =====================================================================
#                          DATA FETCHING FUNCTIONS
# =====================================================================

def fetch_data_with_requests(url: str) -> Dict[str, Any]:
    """Realiza una petición HTTP simple usando requests con cabeceras stealth."""
    print(f"[LOG] Intentando obtener datos de: {url}")
    try:
        response = requests.get(url, headers=STEALTH_HEADERS, timeout=TIMEOUT_SECONDS)
        print(f"[LOG] Status Code: {response.status_code}")
        response.raise_for_status() # Lanza error si no es 2xx
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Fallo en la petición HTTP para {url}: {e}", file=sys.stderr)
        raise RuntimeError(f"Fallo en la comunicación con la API: {e}")

def get_quiniela_matches() -> Optional[Dict[str, Any]]:
    """Obtiene la fecha del próximo sorteo y luego los partidos."""
    try:
        # 1. Obtener la fecha del próximo sorteo
        data_proximos = fetch_data_with_requests(URL_PROXIMOS)
        if not data_proximos or not data_proximos[0].get('fecha'):
            raise ValueError("No se pudo obtener la fecha del próximo sorteo.")

        # Formato de fecha requerido para la API: YYYYMMDD
        fecha_completa = data_proximos[0]['fecha']
        fecha_api = fecha_completa[:10].replace('-', '')
        print(f"[LOG] Próxima fecha de sorteo obtenida: {fecha_api}")

        # 2. Obtener los partidos usando la fecha
        url_partidos = BASE_URL_PARTIDOS + fecha_api
        data_partidos = fetch_data_with_requests(url_partidos)

        if not data_partidos or not data_partidos[0].get('partidos'):
            raise ValueError("No se pudo obtener la lista de partidos de la Quiniela.")

        # Devolvemos el diccionario que contiene 'partidos', 'fecha', etc.
        return data_partidos[0]

    except Exception as e:
        print(f"\n[ERROR CRÍTICO] La ejecución de obtención de datos falló: {e}", file=sys.stderr)
        return None

# =====================================================================
#                          GIST UPDATE FUNCTION
# =====================================================================

def update_gist(gist_id: str, filename: str, content: Dict[str, Any], token: str) -> bool:
    """
    Actualiza un archivo específico dentro de un Gist de GitHub.
    """
    if "YOUR_GITHUB_TOKEN_HERE" in token:
        print("\n❌ ERROR: Por favor, reemplace 'YOUR_GITHUB_TOKEN_HERE' con su token de GitHub.")
        return False

    print(f"\n[LOG] Preparando actualización para Gist ID: {gist_id} (Archivo: {filename})...")

    # Serializar el diccionario a una cadena JSON.
    # Usamos ensure_ascii=False para que los caracteres especiales (como la ñ) se mantengan.
    content_string = json.dumps(content, indent=2, ensure_ascii=False)

    data_payload = {
        "files": {
            filename: {
                "content": content_string
            }
        }
    }

    gist_api_url = f"https://api.github.com/gists/{gist_id}"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}

    try:
        response = requests.patch(
            gist_api_url,
            headers=headers,
            json=data_payload
        )
        response.raise_for_status() # Lanza error para códigos 4xx/5xx

        print("\n✅ Gist actualizado con éxito!")
        print(f"URL: {response.json()['html_url']}")
        return True

    except requests.exceptions.HTTPError as e:
        print(f"\n❌ Fallo en la actualización del Gist. HTTP Error: {e}", file=sys.stderr)
        print(f"Response Status: {response.status_code}. Verifique GIST_ID y TOKEN.", file=sys.stderr)
        return False
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Error de conexión al intentar actualizar el Gist: {e}", file=sys.stderr)
        return False

# =====================================================================
#                               MAIN EXECUTION
# =====================================================================

if __name__ == "__main__":
    print("Iniciando proceso: Obtención de datos de La Quiniela y actualización de Gist.")

    # Paso 1: Obtener los datos más recientes
    match_data = get_quiniela_matches()

    if not match_data:
        print("\n⛔️ Proceso de actualización cancelado debido a un fallo en la obtención de datos.")
        sys.exit(1)

    # Paso 2: Actualizar el Gist de GitHub
    success = update_gist(
        gist_id=GIST_ID,
        filename=GIST_FILENAME,
        content=match_data,
        token=TOKEN
    )

    if success:
        sys.exit(0)
    else:
        sys.exit(1)