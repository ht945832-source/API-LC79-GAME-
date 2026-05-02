/**
 * DỰ ÁN: DIAMOND AI SUPREME
 * ADMIN: TRẦN NHẬT HOÀNG
 * FILE: index.js (Nâng cấp thuật toán phân tích mẫu cầu)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let memoryHistory = [];          
let predictionLogs = [];         
let currentSessionId = 0;

// --- 🧠 THUẬT TOÁN AI V6.2 (CẢI TIẾN TRỌNG SỐ) ---
const extremeBrain = (history, md5) => {
    const last20 = history.slice(-20);
    const txs = last20.map(x => x.tx);
    const pts = last20.map(x => x.point);
    
    let scoreT = 50, scoreX = 50;

    // 1. Phân tích cường độ Bệt (Weight adjustment)
    const last5 = txs.slice(-5).join("");
    if (last5 === "TTTTT") { scoreT += 40; } // Đu mạnh bệt Tài
    else if (last5 === "XXXXX") { scoreX += 40; } // Đu mạnh bệt Xỉu

    // 2. Logic Cầu 1-1, 2-2 (Nhận diện nhịp đảo)
    const pattern22 = txs.slice(-4).join("");
    if (pattern22 === "TTXX" || pattern22 === "XXTT") {
        pattern22.endsWith("T") ? scoreT += 25 : scoreX += 25;
    }

    // 3. Phân tích MD5 & Entropy (Deep check)
    const h = md5 ? parseInt(md5.substring(0, 3), 16) % 256 : 128;
    if (h > 180) scoreT += 15;
    if (h < 70) scoreX += 15;
    
    // 4. Logic Điểm số (Khắc phục gãy phiên điểm trung bình)
    const avgPoint = pts.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (avgPoint > 13) scoreX += 20; 
    if (avgPoint < 8) scoreT += 20;

    // 5. Soi mẫu cầu diện rộng (Nếu data > 100 phiên)
    const currentPattern = txs.slice(-3).join("");
    let simT = 0, simX = 0;
    for (let i = 0; i < history.length - 4; i++) {
        const sub = history.slice(i, i + 3).map(x => x.tx).join("");
        if (sub === currentPattern) {
            history[i + 3].tx === 'T' ? simT++ : simX++;
        }
    }
    if (simT > simX) scoreT += 15; else if (simX > simT) scoreX += 15;

    const finalRes = scoreT >= scoreX ? "🔴 TÀI" : "⚪ XỈU";
    const finalConf = Math.min(Math.max(scoreT, scoreX), 99);
    
    let label = "📈 XU THẾ TỰ DO";
    if (/T{4,}|X{4,}/.test(txs.slice(-5).join(""))) label = "🔥 CẦU BỆT";
    if (txs.slice(-4).join("").includes("TXTX")) label = "🔄 CẦU ĐẢO 1-1";

    return { res: finalRes, conf: finalConf, tag: label };
};

async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";

            if (predictionLogs.length > 0) {
                const prev = predictionLogs[0];
                prev.status = (prev.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
            }

            memoryHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X', md5: i.md5 }));
            const brain = extremeBrain(memoryHistory, latest.md5);

            predictionLogs.unshift({
                id: latest.id + 1,
                prediction: brain.res,
                confidence: brain.conf,
                pattern: brain.tag,
                status: "⏳ ĐANG ĐỢI",
                time: new Date().toLocaleTimeString("vi-VN")
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 30) predictionLogs.pop();
        }
    } catch (e) { console.log("Lỗi:", e.message); }
}

await app.register(cors);

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionLogs[0] || {};
    const logs = predictionLogs.slice(1, 16);
    const wins = logs.filter(l => l.status === "✅ CHUẨN").length;
    const rate = logs.length > 0 ? ((wins / logs.length) * 100).toFixed(0) : 0;

    return {
        THONG_TIN: {
            admin: "TRẦN NHẬT HOÀNG",
            che_do: "DỰ ĐOÁN ALL PHIÊN (KHÔNG NGHỈ)",
            data: `${memoryHistory.length} Phiên`
        },
        PHAI_DU_DOAN: {
            phien: `🆔 ${cur.id}`,
            ket_qua: cur.prediction,
            tin_cay: `${cur.confidence}%`,
            nhan_dinh: cur.pattern
        },
        HIEU_SUAT: {
            ti_le_thang: `${rate}%`,
            chi_tiet: `Thắng ${wins}/${logs.length}`
        },
        LOGS: logs.map(l => ({ p: l.id - 1, d: l.prediction, s: l.status }))
    };
});

setInterval(sync, 3000);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
    if (err) { process.exit(1); }
    console.log(`🚀 DIAMOND AI v6.2 ONLINE - ADMIN: HOÀNG`);
});
