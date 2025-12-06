import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";

export function startDeliveryWorker(baseDir: string) {
    const customerDir = path.join(baseDir, "customer-order");
    const deliveredDir = path.join(baseDir, "delivered-order");

    const limit = pLimit(10);

    async function processFile(filename: string) {
        const src = path.join(customerDir, filename);
        const dst = path.join(deliveredDir, filename);

        let attempt = 0;

        while (attempt < 3) {
            try {
                const content = await fs.readFile(src, "utf8");
                const obj = JSON.parse(content);

                obj.status = "Dikirim ke customer";
                obj.updatedAt = new Date().toISOString();

                await fs.writeFile(dst, JSON.stringify(obj, null, 2), "utf8");

                await fs.unlink(src);

                console.log(`Order ${filename} diproses worker`);
                return;
            } catch (err) {
                attempt++;
                console.log(`Retry ${attempt} gagal untuk file ${filename}`);
                if (attempt >= 3) throw err;
            }
        }
    }

    setInterval(async () => {
        try {
            const files = await fs.readdir(customerDir);

            if (files.length === 0) {
                console.log("Tidak ada order untuk diproses worker.");
                return;
            }

            console.log("Worker memproses batch:", files);

            await Promise.all(files.map((f) => limit(() => processFile(f))));
        } catch (err) {
            console.error("Worker error:", err);
        }
    }, 10000);

    console.log("Worker sudah dijadwalkan (menunggu 10 detik pertama)...");
}