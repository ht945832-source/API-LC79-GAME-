import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 🛡️ HỆ THỐNG BIẾN SỐ MÃ HÓA (BẢO MẬT LOGIC) ---
const _0x_logic = (h, m) => {
    const _pt = h.slice(-4).map(x => x.point);
    const _tx = h.slice(-4).map(x => x.tx);
    let _sT = 0x32, _sX = 0x32;

    // Phân tích Delta (Biến thiên nhịp)
    const _d = _pt[3] - _pt[2];
    if (Math.abs(_d) > 5) { _d > 0 ? _sX += 0x1E : _sT += 0x1E; }
    
    // Logic MD5 ẩn
    const _h = m ? parseInt(m.substring(0, 2), 16) : 0;
    _h > 128 ? _sT += 0xA : _sX += 0xA;

    // Chống lỳ (Nếu 3 ván trước giống nhau thì ván 4 ưu tiên bẻ)
    if (_tx[1] === _tx[2] && _tx[2] === _tx[3]) {
        _tx[3] === 'T' ? _sX += 0x19 : _sT += 0x19;
    }

    return _sT > _sX ? { s: "🔴 TÀI", c: _sT } : { s: "⚪ XỈU", c: _sX };
};

let brain = { isLearned: false, trend: "🔍 Đang quét...", strength: "🌑 Unknown" };
let txHistory = [];
let predictionHistory = [];
let currentSessionId = 0;

const learnTable = (h) => {
    if (h.length < 10) return;
    const l10 = h.slice(-10);
    let j = 0;
    for (let i = 1; i < l10.length; i++) if (l10[i].tx !== l10[i-1].tx) j++;
    brain.trend = j >= 7 ? "🔄 CẦU ĐẢO (1-1)" : (j <= 3 ? "🔥 CẦU BỆT (STREAK)" : "📊 CẦU XU THẾ");
    brain.strength = j >= 7 || j <= 3 ? "💪 MẠNH" : "🛡️ TRUNG BÌNH";
    brain.isLearned = true;
};

const app = fastify();
await app.register(cors);

async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            txHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X' }));
            learnTable(txHistory);

            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
            if (predictionHistory.length > 0) {
                const p = predictionHistory[0];
                if (p.prediction !== "🧠 LEARNING") {
                    p.status = (p.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
                }
            }

            currentSessionId = latest.id;
            const _p = brain.isLearned ? _0x_logic(txHistory, latest.md5) : { s: "🧠 LEARNING", c: 0 };

            predictionHistory.unshift({
                id: latest.id + 1,
                prediction: _p.s,
                confidence: _p.c,
                status: "⏳ ĐỢI..."
            });

            if (predictionHistory.length > 15) predictionHistory.pop();
        }
    } catch (e) { }
}

setInterval(sync, 3500);
sync();

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    const history = predictionHistory.slice(1, 11).filter(h => h.prediction !== "🧠 LEARNING");
    const wins = history.filter(h => h.status === "✅ CHUẨN").length;
    const total = history.length || 1;
    const rate = ((wins / total) * 100).toFixed(0);

    return {
        SYSTEM_PRO: {
            id: `🆔 ${cur.id}`,
            status: brain.isLearned ? "🟢 ACTIVE" : "🧠 WARMING UP",
            time: `⏰ ${new Date().toLocaleTimeString()}`
        },
        AI_PREDICT: {
            result: cur.prediction,
            confidence: `🎯 ${cur.confidence}%`,
            analysis: `🔍 ${brain.trend}`,
            power: `⚡ ${brain.strength}`
        },
        PERFORMANCE: {
            rate: `${rate >= 60 ? '🚀' : '⚠️'} WIN RATE: ${rate}% (${wins}/${total})`,
            advice: rate < 40 ? "🛑 BÀN LOẠN - NGHỈ NGAY" : "✅ NHỊP ỔN - THEO NHẸ"
        },
        HISTORY: history.map(h => ({
            p: `🔢 ${h.id - 1}`,
            d: h.prediction,
            k: h.status
        }))
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log("Diamond AI Secure Deployed"));
