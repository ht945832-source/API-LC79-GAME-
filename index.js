/**
 * DỰ ÁN: DIAMOND AI SUPREME 
 * ADMIN: TRẦN NHẬT HOÀNG
 * FILE: index.js (Bản Fix Gãy - Phân tích Hex chuyên sâu)
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

// --- 🧠 BỘ NÃO HEX-ENTROPY (FIX GÃY) ---
const analyzeHexBrain = (history, md5) => {
    const last25 = history.slice(-25);
    const txs = last25.map(x => x.tx);
    const pts = last25.map(x => x.point);
    
    let scoreT = 50, scoreX = 50;

    // 1. Phân tích mã HEX từ MD5 (Trọng số cao để chống gãy)
    if (md5) {
        const hexPart = md5.substring(0, 4);
        const hexVal = parseInt(hexPart, 16);
        // Thuật toán Hex-Balance
        if (hexVal % 2 === 0) scoreT += 12; else scoreX += 12;
        if (hexVal > 32768) scoreT += 10; else scoreX += 10;
    }

    // 2. Nhận diện "Cầu Nghiêng" (Skewness)
    const countT = txs.filter(x => x === 'T').length;
    const countX = txs.filter(x => x === 'X').length;
    if (countT > 15) scoreX += 25; // Quá nghiêng Tài -> Bẻ về Xỉu
    if (countX > 15) scoreT += 25; // Quá nghiêng Xỉu -> Bẻ về Tài

    // 3. Logic "Điểm Gãy" (Break Point)
    const lastP = pts[pts.length - 1];
    if (lastP === 10 || lastP === 11) { // Các điểm nhạy cảm dễ đảo cầu
        const trend = txs.slice(-2).join("");
        trend === "TT" ? scoreX += 30 : (trend === "XX" ? scoreT += 30 : null);
    }

    // 4. Soi Pattern 4 phiên (Tăng độ sâu tìm kiếm)
    const currentPattern = txs.slice(-4).join("");
    let matchT = 0, matchX = 0;
    for (let i = 0; i < history.length - 5; i++) {
        const sub = history.slice(i, i + 4).map(x => x.tx).join("");
        if (sub === currentPattern) {
            history[i + 4].tx === 'T' ? matchT++ : matchX++;
        }
    }
    scoreT += (matchT * 5);
    scoreX += (matchX * 5);

    const finalRes = scoreT >= scoreX ? "🔴 TÀI" : "⚪ XỈU";
    const finalConf = Math.min(Math.max(scoreT, scoreX), 99);
    
    // Nhãn nhận diện thông minh
    let label = "📊 PHÂN TÍCH HEX";
    if (Math.abs(countT - countX) > 5) label = "⚖️ CẦU NGHIÊNG";
    if (currentPattern.includes("TXTX")) label = "🔄 CẦU ĐẢO 1-1";

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
            const brain = analyzeHexBrain(memoryHistory, latest.md5);

            predictionLogs.unshift({
                id: latest.id + 1,
                prediction: brain.res,
                confidence: brain.conf,
                pattern: brain.tag,
                status: "⏳ ĐỢI...",
                time: new Date().toLocaleTimeString("vi-VN")
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 20) predictionLogs.pop();
        }
    } catch (e) { console.log("Lỗi Sync:", e.message); }
}

await app.register(cors);

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionLogs[0] || {};
    const logs = predictionLogs.slice(1, 11);
    const wins = logs.filter(l => l.status === "✅ CHUẨN").length;
    const rate = logs.length > 0 ? ((wins / logs.length) * 100).toFixed(0) : 0;

    return {
        SYSTEM: { admin: "TRẦN NHẬT HOÀNG", ver: "6.5-HEX", data: memoryHistory.length },
        PREDICT: { phien: cur.id, ket_qua: cur.prediction, tin_cay: `${cur.confidence}%`, label: cur.tag },
        STATS: { rate: `${rate}%`, detail: `${wins}/${logs.length}` },
        HISTORY: logs.map(l => ({ id: l.id - 1, d: l.prediction, s: l.status }))
    };
});

setInterval(sync, 3500);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`🚀 v6.5 HEX ONLINE - ADMIN: HOÀNG`);
});
