/**
 * DỰ ÁN: DIAMOND AI SUPREME v14.0
 * ADMIN: TRẦN NHẬT HOÀNG[span_4](start_span)[span_4](end_span)
 * NÂNG CẤP: REAL WEIGHTED VOTING (KHÔNG RANDOM)[span_5](start_span)[span_5](end_span)[span_6](start_span)[span_6](end_span)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛠️ THUẬT TOÁN HỖ TRỢ ---
const opp = (v) => v === "TAI" ? "XIU" : "TAI";

const get_streak = (res) => {
    if (!res.length) return [0, null];
    let s = 1;
    for (let i = res.length - 2; i >= 0; i--) {
        if (res[i] === res[res.length - 1]) s++; else break;
    }
    return [s, res[res.length - 1]];
};

// --- 🧠 HỆ THỐNG SOI CẦU ĐA TẦNG (CHUYỂN THỂ TỪ PYTHON CỦA HOÀNG)[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span) ---

const detect_cau = (res) => {
    const n = res.length;
    if (n < 4) return ["Hỗn hợp", res[n-1] || "TAI", 50];
    const [streak, cur] = get_streak(res);

    if (streak >= 7) return ["Bệt siêu dài", opp(cur), 82];
    if (streak >= 5) return ["Bệt dài", opp(cur), 74];
    if (streak >= 4) return ["Bệt trung bình", opp(cur), 64];

    // Check Pingpong 1-1
    let isPingPong = true;
    const last6 = res.slice(-6);
    for (let i = 0; i < last6.length - 1; i++) {
        if (last6[i] === last6[i+1]) isPingPong = false;
    }
    if (isPingPong && n >= 4) return ["1-1 Pingpong", opp(cur), 70];

    return ["Hỗn hợp", cur, 52];
};

const analyze_freq = (res) => {
    const r = res.slice(-20);
    const taiCount = r.filter(x => x === "TAI").length;
    const ratio = taiCount / r.length;
    if (ratio >= 0.70) return ["TAI", 63];
    if (ratio <= 0.30) return ["XIU", 63];
    return [res[res.length - 1], 50];
};

const match_pattern = (res) => {
    const n = res.length;
    if (n < 7) return [null, 50];
    const pattern = res.slice(-6).join("");
    let cnt = { "TAI": 0, "XIU": 0 };
    for (let i = 0; i <= n - 7; i++) {
        if (res.slice(i, i + 6).join("") === pattern) cnt[res[i + 6]]++;
    }
    const total = cnt["TAI"] + cnt["XIU"];
    if (total === 0) return [null, 50];
    const best = cnt["TAI"] >= cnt["XIU"] ? "TAI" : "XIU";
    return [best, Math.min(93, 50 + (cnt[best] / total * 43))];
};

// --- 🗳️ HÀM TÍNH TRỌNG SỐ THỰC (WEIGHTED VOTE)[span_9](start_span)[span_9](end_span) ---
const predict_session = (history) => {
    const res = history.map(h => h.point >= 11 ? "TAI" : "XIU");
    const wt = { cau: 1.5, freq: 0.8, pattern: 2.0 };
    let votes = { "TAI": 0.0, "XIU": 0.0 };

    // 1. Phân tích cầu
    const [cType, cPred, cConf] = detect_cau(res);
    votes[cPred] += (cConf * wt.cau);

    // 2. Phân tích tần suất
    const [fPred, fConf] = analyze_freq(res);
    votes[fPred] += (fConf * wt.freq);

    // 3. Khớp mẫu (Pattern)
    const [pPred, pConf] = match_pattern(res);
    if (pPred) votes[pPred] += (pConf * wt.pattern);

    // Tính toán kết quả cuối cùng dựa trên chênh lệch trọng số
    const total = votes["TAI"] + votes["XIU"];
    const final = votes["TAI"] >= votes["XIU"] ? "TAI" : "XIU";
    const confValue = Math.min(95, Math.max(55, Math.round((votes[final] / total) * 100)));

    return { 
        res: final === "TAI" ? "🔴 TÀI" : "⚪ XỈU", 
        conf: confValue, 
        type: cType 
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
                const prev = predictionLogs[0];
                const real = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
                prev.status = (prev.predict === real) ? "✅ WIN" : "❌ LOSE";
                prev.result = real;
            }

            const decision = predict_session(data);
            predictionLogs.unshift({
                id: latest.id + 1,
                predict: decision.res,
                confidence: `${decision.conf}%`,
                pattern: decision.type,
                result: "⏳ ĐỢI",
                status: "🔄 SOI",
                time: new Date().toLocaleTimeString('vi-VN')
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 20) predictionLogs.pop();
        }
    } catch (e) { console.log("System Syncing..."); }
}

app.register(cors);

// --- 🌐 GIAO DIỆN API v14.0 (CRYSTAL DARK MODE)[span_10](start_span)[span_10](end_span) ---
app.get("/api/taixiumd5/v14", async () => {
    if (predictionLogs.length === 0) await sync();
    const cur = predictionLogs[0];

    return {
        "DIAMOND_AI_SUPREME": "v14.0_FINAL",
        "ADMIN": "TRẦN NHẬT HOÀNG",[span_11](start_span)[span_11](end_span)
        "ENGINE": "WEIGHTED_VOTING_NO_RANDOM",[span_12](start_span)[span_12](end_span)
        "CURRENT_SESSION": {
            "PHIÊN": `#${cur.id}`,
            "DỰ_ĐOÁN": cur.predict,
            "TỈ_LỆ_THỰC": cur.confidence,
            "DẠNG_CẦU": cur.pattern,
            "THỜI_GIAN": cur.time
        },
        "HISTORY_LOGS": predictionLogs.slice(1, 11).map(l => ({
            "P": l.id,
            "D": l.predict,
            "K": l.result,
            "S": l.status,
            "T": l.confidence
        })),
        "DEV_BY": "HOANGDZ_VIP_STORE[span_13](start_span)"[span_13](end_span)
    };
});

setInterval(sync, 3000);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log("🚀 v14.0 REAL WEIGHTED ENGINE ONLINE - ADMIN: HOANGDZ");
});
