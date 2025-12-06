import express from "express";
import path from "path";
import fs from "fs/promises";
import { ensureDir, writeFileWithRetry, pad } from "./utils.js";
import { startDeliveryWorker } from "./worker.js";
import { startRekapWorker } from "./workerRekap.js";  // <-- digunakan

const app = express();
app.use(express.json());

const BASE_DB = path.join(process.cwd(), "database");
const CUSTOMER_DIR = path.join(BASE_DB, "customer-order");
const DELIVERED_DIR = path.join(BASE_DB, "delivered-order");
const REKAP_DIR = path.join(BASE_DB, "rekap-order");   // <-- digunakan

const customerLocks: Map<number, Promise<any>> = new Map();

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOrderNumber(customerId: number) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);

    const datePart = `${dd}${mm}${yy}`;

    const files = await fs.readdir(CUSTOMER_DIR);
    const pattern = new RegExp(`^ORDER-${customerId}-${datePart}-(\\d{5})$`);

    let max = 0;

    for (const f of files) {
        const match = f.match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > max) max = num;
        }
    }

    return `ORDER-${customerId}-${datePart}-${pad(max + 1)}`;
}

app.post("/orders", async (req, res) => {
    const body = req.body;

    if (!body || typeof body.customerId !== "number") {
        return res.status(400).json({
            ok: false,
            message: "customerId harus number",
        });
    }

    const customerId = body.customerId;
    const previous = customerLocks.get(customerId);

    const job = (async () => {
        await delay(3000);

        if (previous) await previous;

        const orderNumber = await generateOrderNumber(customerId);

        const orderObj = {
            orderNumber,
            customerId,
            items: body.items || [],
            total: body.total || 0,
            status: "Menunggu diproses",
            createdAt: new Date().toISOString(),
        };

        const filePath = path.join(CUSTOMER_DIR, orderNumber);

        try {
            await writeFileWithRetry(filePath, JSON.stringify(orderObj, null, 2), 3);
            return { ok: true, orderNumber };
        } catch (err) {
            return { ok: false, error: String(err) };
        }
    })();

    customerLocks.set(
        customerId,
        job.finally(() => {
            if (customerLocks.get(customerId) === job) customerLocks.delete(customerId);
        })
    );

    const result = await job;

    if (result.ok) {
        return res.status(201).json({ ok: true, orderNumber: result.orderNumber });
    } else {
        return res.status(500).json({
            ok: false,
            message: "Gagal membuat order",
            error: result.error,
        });
    }
});

async function init() {
    await ensureDir(CUSTOMER_DIR);
    await ensureDir(DELIVERED_DIR);
    await ensureDir(REKAP_DIR);

    console.log("Workers akan mulai...");

    setTimeout(() => {
        console.log("Worker Delivery dimulai.");
        startDeliveryWorker(BASE_DB);
    }, 10000);


    setTimeout(() => {
        console.log("Worker Rekap dimulai.");
        startRekapWorker(BASE_DB);
    }, 15000);
}

const PORT = 3000;

init().then(() => {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
});