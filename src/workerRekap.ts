import fs from "fs/promises";
import path from "path";

export function startRekapWorker(baseDir: string) {
    const deliveredDir = path.join(baseDir, "delivered-order");
    const rekapDir = path.join(baseDir, "rekap-order");

    const processed = new Set<string>();

    async function rekap() {
        try {
            const files = await fs.readdir(deliveredDir);
            const newFiles = files.filter((f) => !processed.has(f));

            if (newFiles.length === 0) {
                return;
            }

            console.log("Worker Rekap memproses file:", newFiles);

            const orders = [];

            for (const filename of newFiles) {
                const filePath = path.join(deliveredDir, filename);
                const content = await fs.readFile(filePath, "utf8");
                const orderObj = JSON.parse(content);

                orders.push(orderObj);
                processed.add(filename);
            }

            const now = new Date();
            const dd = String(now.getDate()).padStart(2, "0");
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const yy = String(now.getFullYear()).slice(-2);

            const rekapName = `REKAP-ORDER-${dd}${mm}${yy}.json`;
            const rekapPath = path.join(rekapDir, rekapName);

            let existing = [];
            try {
                const raw = await fs.readFile(rekapPath, "utf8");
                existing = JSON.parse(raw);
            } catch {}

            const finalData = [...existing, ...orders];

            await fs.writeFile(rekapPath, JSON.stringify(finalData, null, 2), "utf8");

            console.log("Rekap selesai:", rekapName);

        } catch (err) {
            console.error("Worker Rekap error:", err);
        }
    }

    setInterval(rekap, 5000);

    console.log("Worker Rekap dijadwalkan (setiap 5 detik).");
}
