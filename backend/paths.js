// backend/paths.js
// Rutas de datos reales (base de datos + imágenes subidas). Configurables vía
// DATA_DIR para que un instalador pueda separar el código (que se reemplaza
// entero en cada actualización) de los datos del negocio (que nunca deben
// tocarse). Sin DATA_DIR (desarrollo local) se mantiene el layout de siempre:
// la BD en backend/db/ y las imágenes en backend/uploads/.
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url)); // backend/

export const DB_PATH = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'don_penolinni.db')
  : join(__dirname, 'db', 'don_penolinni.db');

export const UPLOADS_DIR = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'uploads')
  : join(__dirname, 'uploads');

mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });
