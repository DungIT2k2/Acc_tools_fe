import { createWorker, PSM, type Worker } from "tesseract.js";

// Captcha chỉ gồm chữ thường (a-z) và số (0-9), không có chữ in hoa.
const CAPTCHA_WHITELIST = "abcdefghijklmnopqrstuvwxyz0123456789";

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
    if (!workerPromise) {
        workerPromise = (async () => {
            const worker = await createWorker("eng");
            await worker.setParameters({
                tessedit_char_whitelist: CAPTCHA_WHITELIST,
                tessedit_pageseg_mode: PSM.SINGLE_LINE,
            });
            return worker;
        })();
        workerPromise.catch(() => {
            workerPromise = null;
        });
    }
    return workerPromise;
}

export const CAPTCHA_LENGTH = 5;

/** Chỉ giữ a-z, 0-9 (chữ hoa nếu có sẽ về chữ thường), tối đa 5 ký tự. */
export function normalizeCaptchaText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, CAPTCHA_LENGTH);
}

export async function recognizeCaptcha(imageUrl: string): Promise<string> {
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(imageUrl);
    return normalizeCaptchaText(text);
}
