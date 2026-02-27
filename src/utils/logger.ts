import fs from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;
const isDev = process.env.NODE_ENV === 'development';

/**
 * Safely log to a file only if not on Vercel and in development mode
 */
export const safeLogToFile = (filename: string, message: string) => {
    if (isVercel) return;
    if (!isDev) return;

    try {
        fs.appendFileSync(filename, message);
    } catch (error) {
        console.error(`[Logger] Failed to write to ${filename}:`, error);
    }
};
