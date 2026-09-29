import { tool } from "ai";
import { z } from "zod";

// Open-Meteo (https://open-meteo.com) — API pública, sem chave, sem limite
// de requisições pra uso não-comercial. Dois endpoints: geocoding (nome da
// cidade -> lat/lon) e forecast (lat/lon -> condições atuais). Mesma
// categoria de API livre já usada em lookup-cep.ts/lookup-pokemon.ts.
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// Subconjunto dos WMO Weather interpretation codes que a Open-Meteo usa —
// só os valores que o endpoint "current" realmente pode devolver.
const WEATHER_CODES: Record<number, string> = {
  0: "céu limpo",
  1: "poucas nuvens",
  2: "parcialmente nublado",
  3: "nublado",
  45: "neblina",
  48: "neblina com geada",
  51: "garoa fraca",
  53: "garoa moderada",
  55: "garoa forte",
  61: "chuva fraca",
  63: "chuva moderada",
  65: "chuva forte",
  71: "neve fraca",
  73: "neve moderada",
  75: "neve forte",
  80: "pancadas de chuva fracas",
  81: "pancadas de chuva moderadas",
  82: "pancadas de chuva fortes",
  95: "tempestade",
  96: "tempestade com granizo",
  99: "tempestade forte com granizo",
};

interface GeocodeResponse {
  results?: {
    latitude: number;
    longitude: number;
    name: string;
    admin1?: string;
    country?: string;
  }[];
}

interface ForecastResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

export const getWeatherTool = tool({
  description:
    "Busca a previsão do tempo atual (temperatura, umidade, vento, condição) de uma " +
    "cidade. Use quando o usuário perguntar sobre o clima/tempo de algum lugar.",
  inputSchema: z.object({
    city: z.string().describe('Nome da cidade, ex: "São José dos Campos" ou "Lisboa".'),
  }),
  execute: async ({ city }) => {
    try {
      const geoRes = await fetch(
        `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!geoRes.ok) {
        return { error: `Geocodificação respondeu com status ${geoRes.status}.` };
      }
      const geo = (await geoRes.json()) as GeocodeResponse;
      const place = geo.results?.[0];
      if (!place) {
        return { error: `Cidade "${city}" não encontrada.` };
      }

      const forecastRes = await fetch(
        `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!forecastRes.ok) {
        return { error: `Previsão do tempo respondeu com status ${forecastRes.status}.` };
      }
      const data = (await forecastRes.json()) as ForecastResponse;

      return {
        city: place.name,
        region: place.admin1,
        country: place.country,
        temperatureC: data.current.temperature_2m,
        humidityPercent: data.current.relative_humidity_2m,
        windKmh: data.current.wind_speed_10m,
        condition: WEATHER_CODES[data.current.weather_code] ?? "condição desconhecida",
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut
          ? "Previsão do tempo demorou demais para responder."
          : "Falha ao buscar previsão do tempo.",
      };
    }
  },
});
