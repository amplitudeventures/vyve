import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const resolveRoot = (path: string) => join(__dirname, '..', path);
export const resolveSrc = (path: string) => join(__dirname, path); 