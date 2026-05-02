/**
 * DỰ ÁN: DIAMOND AI SUPREME v12.5
 * ADMIN: TRẦN NHẬT HOÀNG[span_2](start_span)[span_2](end_span)
 * GIAO DIỆN: CRYSTAL DIGITAL INTERFACE (NON-RANDOM)[span_3](start_span)[span_3](end_span)[span_4](start_span)[span_4](end_span)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛠 LOGIC CỐ ĐỊNH (LOẠI BỎ RANDOM) ---
const opp = (v) => v === "TAI" ? "XIU" : "TAI";

const predict_logic_v12_5 = (history) => {
    const res = history.map(h => h.point >= 11 ? "TAI" : "XIU");
    const last3 = res.slice(-3);
    
    // Tích hợp thuật toán Streak & Cau Type[span_5](start_span)[span_5](end_span)
    let s = 1;
    for (let i = res.length - 2; i >= 0; i--) {
        if (res[i] === res[res.length - 1]) s++; else break;
    }

    let final = res[res.length - 1];
    let type = "HỖN HỢP";
    let conf = 70 + (s * 2); // Tỉ lệ tăng dần theo độ dài chuỗi[span_6](start_span)[span_6](end_span)

    if (s >= 4) { 
        final = opp(res[res.length - 1]); 
        type = `BỆT ${s} TAY (BẺ)`; 
        conf = 85; 
    }
    else if (last3[0] !== last3[1] && last3[1] !== last3[2]) { 
        final = opp(res[res.length - 1]); 
        type = "CẦU 1-1 (PINGPONG)"; 
        conf = 78; 
    }

    return { 
        res: final === "TAI" ? "🔴 TÀI" : "⚪ XỈU", 
        conf: Math.min(95, conf), 
        type 
    };
};

async function sync() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            if (predictionLogs.length > 0) {
                const last = predictionLogs[0];
                const real = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
                last.STATUS = (last.PREDICT === real) ? "✅ WIN" : "❌ LOSE";
                last.RESULT = real;
            }

            const decision = predict_logic_v12_5(data);
            const newPredict = {
                ID: latest.id + 1,
                PREDICT: decision.res,
                CONFIDENCE: `${decision.conf}%`,
                PATTERN: decision.type,
                RESULT: "⏳ WAITING",
                STATUS: "🔄 ANALYZING",
                TIME: new Date().toLocaleTimeString('vi-VN')
            };

            predictionLogs.unshift(newPredict);
            currentSessionId = latest.id;
            if (predictionLogs.length > 15) predictionLogs.pop();
        }
    } catch (e) { console.log("API Error"); }
}

app.register(cors);

// --- 🌐 GIAO DIỆN API MỚI (CRYSTAL UI) ---
app.get("/api/taixiumd5/v12", async () => {
    if (predictionLogs.length === 0) await sync();
    
    const cur = predictionLogs[0];
    const logs = predictionLogs.slice(1, 11);

    return {
        "◆─── DIAMOND AI SUPREME v12.5 ───◆": "SYSTEM ONLINE",
        "ADMIN_CONTROL": "TRẦN NHẬT HOÀNG",[span_7](start_span)[span_7](end_span)
        "SERVER_STATUS": "🟢 STABLE",
        
        "📊 PHIÊN HIỆN TẠI": {
            "SESSION_ID": `#${cur.ID}`,
            "DỰ ĐOÁN": cur.PREDICT,
            "TỈ LỆ THẮNG": cur.CONFIDENCE,
            "DẠNG CẦU": cur.PATTERN,
            "CẬP NHẬT": cur.TIME
        },

        "📜 LỊCH SỬ ĐỐI SOÁT (10 PHIÊN)": logs.map(l => (
            `[${l.ID}] ➜ Dự đoán: ${l.PREDICT} | Kết quả: ${l.RESULT} ➜ ${l.STATUS} (${l.CONFIDENCE})`
        )),

        "FOOTER": "© HOANGDZ VIP STORE - PHẦN MỀM TỰ ĐỘNG HÓA CAO CẤP[span_8](start_span)"[span_8](end_span)
    };
});

setInterval(sync, 3000);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║      DIAMOND AI SUPREME v12.5          ║
    ║    ADMIN: TRẦN NHẬT HOÀNG[span_9](start_span)[span_9](end_span)             ║
    ║    STATUS: API INTERFACE UPDATED       ║
    ╚════════════════════════════════════════╝
    `);
});
