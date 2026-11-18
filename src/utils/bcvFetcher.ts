export interface BCVRateResponse {
  rate: number;
  date: string;
  source: string;
}

const REQUEST_TIMEOUT_MS = 6000;

async function fetchRateFromEndpoints(
  endpoints: string[],
  sourceLabel: string,
  errorLabel: string
): Promise<BCVRateResponse> {
  let lastError: unknown = null;

  for (const url of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        // Format 1: ve.dolarapi.com
        if (typeof data?.promedio === 'number' && Number.isFinite(data.promedio) && data.promedio > 0) {
          return {
            rate: Number(data.promedio.toFixed(2)),
            date: data.fechaActualizacion || new Date().toISOString(),
            source: sourceLabel
          };
        }
        // Format 2: pydolarvenezuela
        const pyPrice = data?.monitors?.bcv?.price;
        if (typeof pyPrice === 'number' && Number.isFinite(pyPrice) && pyPrice > 0) {
          return {
            rate: Number(pyPrice.toFixed(2)),
            date: data.datetime?.date || new Date().toISOString(),
            source: sourceLabel
          };
        }
      }
    } catch (e) {
      lastError = e;
      if (import.meta.env.DEV) {
        console.warn(`[BCVFetcher] Error fetching ${errorLabel} from ${url}:`, e);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `No se pudo consultar la tasa oficial ${errorLabel} del BCV en este momento.` +
      (lastError instanceof Error && lastError.name === 'AbortError' ? ' (Tiempo de espera agotado)' : '')
  );
}

export async function fetchLiveBCVRate(): Promise<BCVRateResponse> {
  return fetchRateFromEndpoints(
    [
      'https://ve.dolarapi.com/v1/dolares/oficial',
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv'
    ],
    'Banco Central de Venezuela (BCV)',
    'Dólar ($)'
  );
}

export async function fetchLiveBCVEuroRate(): Promise<BCVRateResponse> {
  return fetchRateFromEndpoints(
    [
      'https://ve.dolarapi.com/v1/euros/oficial',
      'https://pydolarvenezuela-api.vercel.app/api/v1/euro?page=bcv'
    ],
    'Banco Central de Venezuela - Euro Oficial (BCV)',
    'Euro (€)'
  );
}
