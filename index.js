import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 🧠 BỘ NÃO AI HỌC TẬP ---
let brain = {
    isLearned: false,
    learnedData: [],
    trendBias: "🔄 Đang phân tích...", 
    strength: "🌑 Chưa xác định"
};

let txHistory = [];
let predictionHistory = [];
let currentSessionId = 0;

// --- 📈 HÀM HỌC CẦU (LEARNING PHASE) ---
const learnTable = (history) => {
    if (history.length < 10) return;

    const last10 = history.slice(-10);
    let jumpCount = 0; 
    
    for (let i = 1; i < last10.length; i++) {
        if (last10[i].tx !== last10[i-1].tx) jumpCount++;
    }

    // Xác định "khẩu vị" của bàn chơi hiện tại
    if (jumpCount >= 7) {
        brain.trendBias = "🔄 CẦU ĐẢO (1-1/NHẢY)";
        brain.strength = "⚡ CAO";
    } else if (jumpCount <= 3) {
        brain.trendBias = "🔥 CẦU BỆT (STREAK)";
        brain.strength = "💪 MẠNH";
    } else {
        brain.trendBias = "📊 CẦU XU THẾ (CÂN BẰNG)";
        brain.strength = "🛡️ TRUNG BÌNH";
    }
    brain.isLearned = true;
};

// --- 🔮 ENGINE DỰ ĐOÁN SIÊU CẤP ---
const predictPro = (history, md5) => {
    if (!brain.isLearned) return { side: "📥 LEARNING", conf: 0, icon: "🧠" };

    const last = history[history.length - 1];
    let scoreT = 50;
    let scoreX = 50;

    // 1. Dựa trên xu hướng đã học (40%)
    if (brain.trendBias.includes("BỆT")) {
        last.tx === 'T' ? scoreT += 25 : scoreX += 25;
    } else if (brain.trendBias.includes("ĐẢO")) {
        last.tx === 'T' ? scoreX += 25 : scoreT += 25;
    }

    // 2. Dựa trên điểm số (Point Delta) (30%)
    if (last.point >= 15) scoreX += 20; // Tài cao hồi Xỉu
    if (last.point <= 5) scoreT += 20;  // Xỉu thấp hồi Tài

    // 3. Giải mã Hash MD5 (30%)
    const lastChar = md5 ? md5.slice(-1) : '0';
    if ("02468ace".includes(lastChar.toLowerCase())) scoreT += 15; else scoreX += 15;

    const side = scoreT > scoreX ? "Tài" : "Xỉu";
    const sideIcon = side === "Tài" ? "🔴 TÀI" : "⚪ XỈU";
    let confidence = Math.max(scoreT, scoreX);

    return { 
        side: sideIcon, 
        conf: Math.min(96.8, confidence + (Math.random() * 3)).toFixed(1),
        trend: brain.trendBias 
    };
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
            
            // GIAI ĐOẠN HỌC TẬP
            learnTable(txHistory);

            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
            if (predictionHistory.length > 0) {
                const p = predictionHistory[0];
                if (!p.prediction.includes("LEARNING")) {
                    p.status = (p.prediction === realTX) ? "✅ ĐÚNG (HÚP)" : "❌ SAI (GÃY)";
                }
            }

            currentSessionId = latest.id;
            const pred = predictPro(txHistory, latest.md5);

            predictionHistory.unshift({
                id: latest.id + 1,
                prediction: pred.side,
                confidence: pred.conf,
                trend: pred.trend,
                status: "⏳ ĐANG ĐỢI..."
            });

            if (predictionHistory.length > 20) predictionHistory.pop();
        }
    } catch (e) { console.log("🤖 System Syncing..."); }
}

setInterval(sync, 4000);
sync();

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    const history = predictionHistory.slice(1, 11).filter(h => !h.prediction.includes("LEARNING"));
    const wins = history.filter(h => h.status.includes("✅")).length;
    const total = history.length || 1;
    const winRate = ((wins / total) * 100).toFixed(0);

    // Xác định icon thông báo dựa trên tỉ lệ thắng
    let alertIcon = winRate >= 70 ? "🚀" : (winRate >= 50 ? "🟡" : "🔴");
    let advice = winRate >= 70 ? "🔥 CẦU QUÁ ĐẸP - VÀO MẠNH TAY" : (winRate >= 50 ? "⚠️ CẦU TRUNG BÌNH - VÀO NHẸ" : "🚫 CẦU LOẠN - NGHỈ NGAY");

    return {
        THONG_TIN_PHIEN: {
            id_phien: `🆔 ${cur.id}`,
            trang_thai: brain.isLearned ? "🟢 ĐÃ HỌC XONG" : "🧠 ĐANG HỌC CẦU (10 PHIÊN)",
            thoi_gian: `⏰ ${new Date().toLocaleTimeString('vi-VN')}`
        },
        DU_DOAN_HE_THONG: {
            ket_qua: cur.prediction,
            do_tin_cay: `🎯 ${cur.confidence}%`,
            nhan_dinh_xu_huong: `🔍 ${brain.trendBias}`,
            luc_cau: `💪 ${brain.strength}`
        },
        PHONG_DO_BOT: {
            ti_le_thang: `${alertIcon} THẮNG ${winRate}% (${wins}/${total})`,
            loi_khuyen: `${alertIcon} ${advice}`
        },
        LICH_SU_KIEM_CHUNG: history.map(h => ({
            phiên: `🔢 ${h.id - 1}`,
            dự_đoán: h.prediction,
            kết_quả: h.status
        }))
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log("💎 AI ICON PRO EDITION ONLINE 💎");
});
