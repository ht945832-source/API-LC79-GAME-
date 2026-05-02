/**
 * DỰ ÁN: DIAMOND AI SUPREME
 * ADMIN: TRẦN NHẬT HOÀNG
 * FILE: index.js (Bản All-In: Dự đoán không nghỉ)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 🧠 HỆ THỐNG BỘ NHỚ ---
let memoryHistory = [];          
let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛡️ THUẬT TOÁN DỰ ĐOÁN LIÊN TỤC ---
const extremeBrain = (history, md5) => {
    const last15 = history.slice(-15);
    const txs = last15.map(x => x.tx);
    const pts = last15.map(x => x.point);
    
    let scoreT = 50, scoreX = 50;

    // 1. Logic Đu Bệt (Không bao giờ bẻ bệt)
    const trend = txs.slice(-3).join("");
    if (trend === "TTT") scoreT += 35; 
    if (trend === "XXX") scoreX += 35;

    // 2. Logic Bắt Cầu Đảo 1-1
    const last4 = txs.slice(-4).join("");
    if (last4 === "TXTX" || last4 === "XTXT") {
        last4.endsWith("T") ? scoreX += 40 : scoreT += 40;
    }

    // 3. Phân tích MD5 Entropy
    const h = md5 ? parseInt(md5.substring(0, 2), 16) : 128;
    h > 150 ? scoreT += 12 : (h < 100 ? scoreX += 12 : null);
    
    // 4. Logic Điểm số Hồi quy (Point Delta)
    const lastP = pts[pts.length - 1];
    if (lastP >= 15) scoreX += 20; // Điểm quá cao -> ưu tiên hồi về Xỉu
    if (lastP <= 6) scoreT += 20;  // Điểm quá thấp -> ưu tiên hồi về Tài

    // 5. Quét Pattern 2055 phiên lịch sử
    const pattern = txs.slice(-4).join("");
    let countT = 0, countX = 0;
    for (let i = 0; i < history.length - 5; i++) {
        const sub = history.slice(i, i + 4).map(x => x.tx).join("");
        if (sub === pattern) history[i + 4].tx === 'T' ? countT++ : countX++;
    }
    countT > countX ? scoreT += 15 : scoreX += 15;

    // Quyết định cuối cùng (Luôn có kết quả)
    const finalRes = scoreT >= scoreX ? "🔴 TÀI" : "⚪ XỈU";
    const finalConf = Math.min(Math.max(scoreT, scoreX), 99);
    
    let label = "📈 XU THẾ TỰ DO";
    if (trend === "TTT" || trend === "XXX") label = "🔥 CẦU BỆT";
    if (last4 === "TXTX" || last4 === "XTXT") label = "🔄 CẦU ĐẢO 1-1";

    return { res: finalRes, conf: finalConf, tag: label };
};

// --- ⚡ ĐỒNG BỘ DỮ LIỆU ---
async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";

            // Cập nhật lịch sử dự đoán
            if (predictionLogs.length > 0) {
                const prev = predictionLogs[0];
                prev.status = (prev.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
            }

            memoryHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X', md5: i.md5 }));
            
            // AI bắt buộc đưa ra dự đoán cho phiên tiếp theo
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
            console.log(`[ADMIN] Phiên ${latest.id} về ${realTX}. Đã dự đoán phiên ${latest.id + 1}: ${brain.res}`);
        }
    } catch (e) {
        console.log("[LỖI]:", e.message);
    }
}

// --- 🌐 ROUTE API ---
await app.register(cors);

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionLogs[0] || {};
    const logs = predictionLogs.slice(1, 16); // Lấy 15 phiên gần nhất
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

// --- 🚀 KHỞI CHẠY ---
app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`🚀 DIAMOND AI v6.0 ĐANG CHẠY ALL-IN TẠI PORT ${PORT}`);
});
