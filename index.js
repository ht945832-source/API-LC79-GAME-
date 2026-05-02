import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify();
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 🧠 DATABASE & BỘ NHỚ AI ---
let txHistory = [];          
let predictionHistory = [];  
let currentSessionId = 0;
let brain = { 
    isLearned: false, 
    trend: "🔍 Đang phân tích nhịp...", 
    strength: "🌑 Đang tính toán",
    lastWinRate: 0
};

// --- 🛠️ LOGIC PHÂN TÍCH NÂNG CAO (ĐÃ FIX LỖI "NGÁO XỈU") ---

const _0x_diamond_logic = (history, md5) => {
    const last10 = history.slice(-10);
    const txs = last10.map(x => x.tx);
    const pts = last10.map(x => x.point);
    
    let scoreT = 50, scoreX = 50;

    // 1. Phân tích nhịp Delta (Biến thiên điểm số)[span_1](start_span)[span_1](end_span)
    const currentDelta = pts[pts.length - 1] - pts[pts.length - 2];
    if (Math.abs(currentDelta) >= 6) {
        // Nếu biến thiên quá mạnh, thường sẽ có xu hướng hồi lại cửa ngược lại
        currentDelta > 0 ? scoreX += 15 : scoreT += 15;
    }

    // 2. Logic MD5 (Trọng số 20%)[span_2](start_span)[span_2](end_span)
    const hashWeight = md5 ? parseInt(md5.substring(0, 2), 16) : 128;
    hashWeight > 128 ? scoreT += 12 : scoreX += 12;

    // 3. 🔥 FIX: Logic Thuận Thiên (Trend Following)[span_3](start_span)[span_3](end_span)
    // Thay vì cố bẻ bệt (như trong image_7.png), ta sẽ đu theo bệt nếu bệt chưa quá 5 tay
    const last4 = txs.slice(-4);
    const isBetTai = last4.every(v => v === 'T');
    const isBetXiu = last4.every(v => v === 'X');

    if (isBetTai) {
        // Nếu đã bệt 4 tay Tài, xác suất ra tiếp Tài vẫn cao (Đu cầu)
        scoreT += 20; 
    } else if (isBetXiu) {
        scoreX += 20;
    }

    // 4. Logic bẻ cầu khi quá dài (Chỉ bẻ khi bệt > 6 tay)[span_4](start_span)[span_4](end_span)
    const last6 = txs.slice(-6);
    if (last6.every(v => v === 'T')) { scoreX += 40; scoreT -= 20; }
    if (last6.every(v => v === 'X')) { scoreT += 40; scoreX -= 20; }

    // 5. Logic Cầu Đảo (1-1)[span_5](start_span)[span_5](end_span)
    const last3 = txs.slice(-3).join("");
    if (last3 === "TXT" || last3 === "XTX") {
        last3 === "TXT" ? scoreX += 25 : scoreT += 25; // Dự đoán nhịp tiếp theo của 1-1
    }

    return scoreT > scoreX 
        ? { s: "🔴 TÀI", c: Math.min(scoreT, 98) } 
        : { s: "⚪ XỈU", c: Math.min(scoreX, 98) };
};

const getTrendName = (h) => {
    const last8 = h.slice(-8).map(x => x.tx).join("");
    if (last8.includes("TTTT") || last8.includes("XXXX")) return "🔥 CẦU BỆT DÀI";
    if (last8.includes("TXTX")) return "🔄 CẦU ĐẢO 1-1";
    if (last8.includes("TTXX")) return "📊 CẦU KÉP 2-2";
    return "📈 CẦU HỖN HỢP";
};

// --- ⚡ HỆ THỐNG ĐỒNG BỘ & TỰ HỌC ---

async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            txHistory = data.map(i => ({ 
                id: i.id, 
                point: i.point, 
                tx: i.point >= 11 ? 'T' : 'X' 
            }));

            // Kiểm tra và gán nhãn Accuracy cho phiên vừa kết thúc[span_6](start_span)[span_6](end_span)
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
            if (predictionHistory.length > 0) {
                const lastP = predictionHistory[0];
                if (lastP.prediction !== "🧠 LEARNING") {
                    lastP.status = (lastP.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
                }
            }

            brain.trend = getTrendName(txHistory);
            brain.isLearned = txHistory.length > 15;
            
            // Tính toán dự đoán cho phiên mới[span_7](start_span)[span_7](end_span)
            const decision = brain.isLearned ? _0x_diamond_logic(txHistory, latest.md5) : { s: "🧠 LEARNING", c: 0 };

            predictionHistory.unshift({
                id: latest.id + 1,
                prediction: decision.s,
                confidence: decision.c,
                status: "⏳ ĐỢI..."
            });

            currentSessionId = latest.id;
            if (predictionHistory.length > 15) predictionHistory.pop();
        }
    } catch (e) {
        console.log("Sync Error:", e.message);
    }
}

// --- 🛡️ API ENDPOINT ---

await app.register(cors);

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    const history = predictionHistory.slice(1, 11).filter(h => h.prediction !== "🧠 LEARNING");
    const wins = history.filter(h => h.status === "✅ CHUẨN").length;
    const rate = history.length > 0 ? ((wins / history.length) * 100).toFixed(0) : 0;

    return {
        SYSTEM_PRO: {
            session: `🆔 ${cur.id}`,
            status: brain.isLearned ? "🟢 ACTIVE" : "🧠 WARMING UP",
            data_size: `${txHistory.length} Phiên`
        },
        AI_PREDICT: {
            result: cur.prediction,
            confidence: `🎯 ${cur.confidence}%`,
            analysis: `🔍 ${brain.trend}`,
            power: wins >= 7 ? "💪 MẠNH" : "⚠️ YẾU"
        },
        PERFORMANCE: {
            rate: `WIN RATE: ${rate}% (${wins}/${history.length})`,
            advice: rate >= 70 ? "✅ CẦU ĐANG CHUẨN - THEO ĐỀU" : "🛑 NHỊP LOẠN - NÊN QUAN SÁT"
        },
        HISTORY: history.map(h => ({
            id: h.id - 1,
            predict: h.prediction,
            result: h.status
        }))
    };
});

setInterval(sync, 3000);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`
    =========================================
    💎 DIAMOND AI MD5 DEPLOYED SUCCESS 💎
    Port: ${PORT}
    Status: Running...
    =========================================
    `);
});
