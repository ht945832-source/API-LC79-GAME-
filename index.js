/**
 * DỰ ÁN: DIAMOND AI SUPREME v12.0
 * ADMIN: TRẦN NHẬT HOÀNG[span_3](start_span)[span_3](end_span)
 * NÂNG CẤP: MULTI-VOTING ALGORITHM (NO RANDOM)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛠 TIỆN ÍCH THUẬT TOÁN ---
const opp = (val) => val === "TAI" ? "XIU" : "TAI";

const get_streak = (res) => {
    if (!res || res.length === 0) return [0, null];
    let s = 1;
    for (let i = res.length - 2; i >= 0; i--) {
        if (res[i] === res[res.length - 1]) s++;
        else break;
    }
    return [s, res[res.length - 1]];
};

// --- 🧠 CÁC HÀM PHÂN TÍCH CHI TIẾT[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span) ---

const detect_cau = (res) => {
    const n = res.length;
    if (n < 4) return ["hỗn_hợp", res[n - 1] || "TAI", 50];
    const [streak, cur] = get_streak(res);

    if (streak >= 7) return ["bệt_siêu_dài", opp(cur), 82];
    if (streak >= 5) return ["bệt_dài", opp(cur), 74];
    if (streak >= 4) return ["bệt_TB", opp(cur), 64];

    // Check Pingpong 1-1
    let isPingPong = true;
    for (let i = Math.max(0, n - 6); i < n - 1; i++) {
        if (res[i] === res[i + 1]) { isPingPong = false; break; }
    }
    if (isPingPong && n >= 4) return ["1-1_pingpong", opp(cur), 70];

    return ["hỗn_hợp", cur, 50];
};

const analyze_freq = (res) => {
    const w = 20;
    const r = res.slice(-w);
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
        if (res.slice(i, i + 6).join("") === pattern) {
            cnt[res[i + 6]]++;
        }
    }
    const total = cnt["TAI"] + cnt["XIU"];
    if (total === 0) return [null, 50];
    const best = cnt["TAI"] >= cnt["XIU"] ? "TAI" : "XIU";
    return [best, Math.min(93, 50 + (cnt[best] / total * 46))];
};

// --- 🗳 HỆ THỐNG BIỂU QUYẾT TRỌNG SỐ (WEIGHTED VOTE) ---
const predict_session = (history) => {
    const res = history.map(h => h.point >= 11 ? "TAI" : "XIU");
    if (res.length < 3) return ["TAI", 50, "chưa_đủ_dữ_liệu"];

    const wt = { cau: 1.2, freq: 0.8, trend: 0.6, pattern: 1.5, brk: 1.0 };
    let votes = [];

    // 1. Vote từ Cầu
    const [cType, cPred, cConf] = detect_cau(res);
    votes.push({ pred: cPred, weight: cConf * wt.cau });

    // 2. Vote từ Tần suất
    const [fPred, fConf] = analyze_freq(res);
    votes.push({ pred: fPred, weight: fConf * wt.freq });

    // 3. Vote từ Pattern Matching (6 phiên)
    const [pPred, pConf] = match_pattern(res);
    if (pPred) votes.push({ pred: pPred, weight: pConf * wt.pattern });

    // Tính tổng kết quả
    let s = { "TAI": 0.0, "XIU": 0.0 };
    votes.forEach(v => { s[v.pred] += v.weight; });

    const totalWeight = s["TAI"] + s["XIU"];
    const final = s["TAI"] >= s["XIU"] ? "TAI" : "XIU";
    const conf = Math.min(95, Math.max(51, Math.round((s[final] / totalWeight) * 100)));

    return { final: final === "TAI" ? "🔴 TÀI" : "⚪ XỈU", conf, cType };
};

// --- ⚡ ĐỒNG BỘ & API ---
async function sync() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            // Đối soát kết quả phiên cũ
            if (predictionLogs.length > 0) {
                const lastPred = predictionLogs[0];
                const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
                lastPred.ket_qua = realTX;
                lastPred.trang_thai = lastPred.du_doan === realTX ? "✅ WIN" : "❌ LOSE";
            }

            // Dự đoán cho phiên mới
            const decision = predict_session(data);
            const newPredict = {
                phien: latest.id + 1,
                du_doan: decision.final,
                ti_le: `${decision.conf}%`,
                cau: decision.cType,
                ket_qua: "⏳ ĐỢI",
                trang_thai: "🔄 SOI",
                time: new Date().toLocaleTimeString('vi-VN')
            };

            predictionLogs.unshift(newPredict);
            currentSessionId = latest.id;
            if (predictionLogs.length > 20) predictionLogs.pop();
        }
    } catch (e) { console.log("Lỗi Sync:", e.message); }
}

app.register(cors);
app.get("/api/taixiumd5/v12", async () => {
    if (predictionLogs.length === 0) await sync();
    return {
        ADMIN: "TRẦN NHẬT HOÀNG",[span_6](start_span)[span_6](end_span)
        SYSTEM: "DIAMOND AI v12.0",
        CURRENT: predictionLogs[0],
        HISTORY: predictionLogs.slice(1, 11)
    };
});

setInterval(sync, 3000);
sync();
app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log("🚀 v12.0 MULTI-LOGIC ONLINE - ADMIN: HOANGDZ");
});
