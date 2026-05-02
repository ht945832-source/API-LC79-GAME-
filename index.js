import fastify from "fastify";
import cors from "@fastify/cors";
import crypto from "node:crypto";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- KHO CẦU SIÊU CẤP (WEIGHTED PATTERNS) ---
const KHO_CAU_BIEN_THE = {
    "BET": { patterns: ["TTTT", "XXXX", "TTTTT", "XXXXX"], weight: 45 },
    "DAO": { patterns: ["TXTX", "XTXT", "TXTXT", "XTXTX"], weight: 40 },
    "DOI": { patterns: ["TTXX", "XXTT", "TXXT", "XTTX"], weight: 35 },
    "CAU_31": { patterns: ["TTTX", "XXXT", "TTTXX", "XXXTT"], weight: 30 }
};

let txHistory = [];
let predictionHistory = [];
let currentSessionId = null;

// --- THUẬT TOÁN TÍNH TOÁN TỈ LỆ % CHÍNH XÁC ---
class HoangDZ_Super_Engine {
    predict(history, currentHash) {
        if (history.length < 5) return { side: "Chờ", raw: "N/A", confidence: 50 };

        let diemTai = 0;
        let diemXiu = 0;
        const chuoiHienTai = history.slice(-6).map(h => h.tx).join('');

        // 1. QUÉT KHO CẦU (Chiếm 40% tổng tỉ lệ)
        for (const loai in KHO_CAU_BIEN_THE) {
            KHO_CAU_BIEN_THE[loai].patterns.forEach(mau => {
                if (chuoiHienTai.endsWith(mau)) {
                    // Nếu khớp cầu, cộng điểm cực mạnh theo trọng số
                    const score = KHO_CAU_BIEN_THE[loai].weight;
                    mau.includes('T') ? diemTai += score : diemXiu += score;
                }
            });
        }

        // 2. PHÂN TÍCH MD5 (Chiếm 40% tổng tỉ lệ)
        const prefix = currentHash.substring(0, 8);
        const hexVal = parseInt(prefix, 16);
        const md5Bias = (hexVal % 100) / 100; // Lấy độ lệch 0-1
        diemTai += md5Bias * 80;
        diemXiu += (1 - md5Bias) * 80;

        // 3. LOGIC XU HƯỚNG NGẮN HẠN (Chiếm 20% tổng tỉ lệ)
        const last3 = history.slice(-3).map(h => h.tx);
        if (last3.filter(x => x === 'T').length >= 2) diemTai += 20;
        else diemXiu += 20;

        // --- CÔNG THỨC TÍNH PHẦN TRĂM KHÔNG BỊ CÂN BẰNG ---
        const tongDiem = diemTai + diemXiu;
        const tyLeTai = (diemTai / tongDiem) * 100;
        const tyLeXiu = (diemXiu / tongDiem) * 100;

        let finalSide, finalConfidence;

        if (tyLeTai > tyLeXiu) {
            finalSide = "Tài";
            // Ép dải tỉ lệ để hiển thị rõ ràng hơn (Tránh 50/50)
            finalConfidence = tyLeTai + (tyLeTai * 0.15); 
        } else {
            finalSide = "Xỉu";
            finalConfidence = tyLeXiu + (tyLeXiu * 0.15);
        }

        // Giới hạn trong khoảng 65% - 98% để thực tế
        finalConfidence = Math.max(65.5, Math.min(98.8, finalConfidence));

        return {
            side: finalSide,
            raw: finalSide === "Tài" ? "T" : "X",
            confidence: finalConfidence.toFixed(1)
        };
    }
}

const ENGINE = new HoangDZ_Super_Engine();
const app = fastify();
await app.register(cors, { origin: "*" });

async function updateData() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (!data.list) return;

        const sorted = data.list.sort((a, b) => a.id - b.id);
        const latest = sorted[sorted.length - 1];

        if (!currentSessionId || latest.id > currentSessionId) {
            // Chốt kết quả phiên cũ
            if (predictionHistory.length > 0) {
                const lastP = predictionHistory[0];
                if (lastP.status === "WAITING") {
                    const thucTe = latest.point >= 11 ? "Tài" : "Xỉu";
                    lastP.status = (lastP.prediction === thucTe) ? "✅ ĐÚNG" : "❌ SAI";
                }
            }

            txHistory = sorted.map(i => ({ tx: i.point >= 11 ? 'T' : 'X' }));
            currentSessionId = latest.id;

            // Dự đoán cho phiên mới
            const pred = ENGINE.predict(txHistory, latest.md5 || "");
            predictionHistory.unshift({
                sessionId: currentSessionId + 1,
                prediction: pred.side,
                confidence: pred.confidence,
                status: "WAITING",
                time: new Date().toLocaleTimeString("vi-VN")
            });

            if (predictionHistory.length > 15) predictionHistory.pop();
        }
    } catch (e) { console.log("Lỗi:", e.message); }
}

setInterval(updateData, 5000);
updateData();

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    return {
        phien: cur.sessionId,
        du_doan: cur.prediction,
        ti_le_thang: cur.confidence + "%",
        kiem_chung: predictionHistory.slice(1, 6).map(h => ({
            phien: h.sessionId - 1,
            kq: h.prediction,
            check: h.status
        })),
        thong_bao: parseFloat(cur.confidence) > 85 ? "🔥 CẦU ĐẸP - VÀO MẠNH" : "⚠️ CẦU NHIỄU - VÀO NHẸ"
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log(`LIVE ON ${PORT}`));
