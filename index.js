/**
 * DỰ ÁN: DIAMOND AI SUPREME
 * ADMIN: TRẦN NHẬT HOÀNG
 * FILE: index.js
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify();
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 🧠 BỘ NHỚ TẠM THỜI (IN-MEMORY STORAGE) ---
let memoryHistory = [];          // Lưu lịch sử phiên
let predictionLogs = [];         // Lưu lịch sử dự đoán
let currentSessionId = 0;
let lossStreak = 0;              // Chuỗi thua để ngắt cầu chì

// --- 🛠️ THUẬT TOÁN PHÂN TÍCH TỐI CAO ---
const analyzeLogic = (history, md5) => {
    // 1. Cầu chì bảo vệ: Nếu gãy 3 tay liên tiếp thì báo nghỉ[span_3](start_span)[span_3](end_span)
    if (lossStreak >= 3) {
        return { res: "💤 TẠM NGHỈ", conf: 0, tag: "🛑 BẢO TRÌ NHỊP" };
    }

    const last15 = history.slice(-15);
    const txs = last15.map(x => x.tx);
    const pts = last15.map(x => x.point);
    
    let scoreT = 50, scoreX = 50;

    // A. Logic Thuận Thiên (Trend Following): Đu theo bệt[span_4](start_span)[span_4](end_span)
    const trend = txs.slice(-3).join("");
    if (trend === "TTT") scoreT += 25; 
    if (trend === "XXX") scoreX += 25;

    // B. Logic Nhận diện Cầu Nhảy (1-1): Khắc phục lỗi image_8.png[span_5](start_span)[span_5](end_span)
    const last4 = txs.slice(-4).join("");
    if (last4 === "TXTX" || last4 === "XTXT") {
        last4.endsWith("T") ? scoreX += 30 : scoreT += 30;
    }

    // C. Logic MD5 (Trọng số 15%)[span_6](start_span)[span_6](end_span)
    const h = md5 ? parseInt(md5.substring(0, 2), 16) : 128;
    h > 160 ? scoreT += 15 : (h < 90 ? scoreX += 15 : null);

    // D. Đối chiếu lịch sử 2055 phiên (Giả lập quét pattern)[span_7](start_span)[span_7](end_span)
    const pattern = txs.slice(-4).join("");
    let countT = 0, countX = 0;
    for (let i = 0; i < history.length - 5; i++) {
        const sub = history.slice(i, i + 4).map(x => x.tx).join("");
        if (sub === pattern) history[i + 4].tx === 'T' ? countT++ : countX++;
    }
    countT > countX ? scoreT += 15 : scoreX += 15;

    const finalRes = scoreT > scoreX ? "🔴 TÀI" : "⚪ XỈU";
    const finalConf = Math.min(Math.max(scoreT, scoreX), 99);
    
    // Nhãn nhận diện cầu[span_8](start_span)[span_8](end_span)
    let label = "📈 XU THẾ TỰ DO";
    if (trend === "TTT" || trend === "XXX") label = "🔥 CẦU BỆT";
    if (last4 === "TXTX" || last4 === "XTXT") label = "🔄 CẦU ĐẢO 1-1";

    return { res: finalRes, conf: finalConf, tag: label };
};

// --- ⚡ HỆ THỐNG ĐỒNG BỘ DỮ LIỆU ---
async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";

            // Cập nhật kết quả phiên trước[span_9](start_span)[span_9](end_span)
            if (predictionLogs.length > 0) {
                const prev = predictionLogs[0];
                if (prev.prediction !== "💤 TẠM NGHỈ") {
                    prev.status = (prev.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
                    lossStreak = (prev.status === "❌ GÃY") ? lossStreak + 1 : 0;
                }
            }

            // Cập nhật bộ nhớ[span_10](start_span)[span_10](end_span)
            memoryHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X', md5: i.md5 }));
            
            // Dự đoán phiên mới[span_11](start_span)[span_11](end_span)
            const decision = analyzeLogic(memoryHistory, latest.md5);

            predictionLogs.unshift({
                id: latest.id + 1,
                prediction: decision.res,
                confidence: decision.conf,
                pattern: decision.tag,
                status: "⏳ ĐỢI...",
                time: new Date().toLocaleTimeString("vi-VN")
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 20) predictionLogs.pop();
        }
    } catch (e) { console.log("Lỗi:", e.message); }
}

// --- 🌐 API ENDPOINT ---
await app.register(cors);

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionLogs[0] || {};
    const logs = predictionLogs.slice(1, 11);
    const wins = logs.filter(l => l.status === "✅ CHUẨN").length;
    const rate = logs.length > 0 ? ((wins / logs.length) * 100).toFixed(0) : 0;

    return {
        DIAMOND_AI: {
            admin: "TRẦN NHẬT HOÀNG",
            status: lossStreak >= 3 ? "🔴 ĐANG NGHỈ CẮT ĐEN" : "🟢 HOẠT ĐỘNG",
            data: `${memoryHistory.length} Phiên`
        },
        DU_DOAN: {
            phien: `🆔 ${cur.id}`,
            ket_qua: cur.prediction,
            tin_cay: `${cur.confidence}%`,
            nhan_dinh: cur.pattern
        },
        HIEU_SUAT: {
            ti_le: `${rate}%`,
            advice: rate >= 70 ? "💎 CẦU ĐANG CHUẨN" : "🛑 NÊN QUAN SÁT"
        },
        LOGS: logs.map(l => ({ p: l.id - 1, d: l.prediction, s: l.status }))
    };
});

setInterval(sync, 3500);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`🚀 index.js ONLINE - PORT: ${PORT}`);
});
