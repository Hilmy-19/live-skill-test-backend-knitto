import fs from 'fs/promises';
import path from 'path';

export async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

export function pad(num: number, size = 5) {
    return String(num).padStart(size, '0');
}

export async function writeFileWithRetry(filePath: string, data: string, maxRetries = 3) {
    let attempt = 0;
    while (true) {
    try {
        await fs.writeFile(filePath, data, { encoding: 'utf8' });
        return;
    } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;

      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    }
}

