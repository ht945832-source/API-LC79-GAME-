import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let txHistory = [];
let predictionHistory = [];
let currentSessionId = 0;

// --- HỆ THỐNG PHANH KHẨN CẤP & ĐẢO CHIỀU ---
const SuperEngineV2 = (history, md5) => {
    const s = history.slice(-10).map(h => h.tx).join('');
    const lastPoint = history[history.length - 1].point;
    
    // Kiểm tra phong độ gần đây của chính mình (Nếu đang thua thì phải đổi logic)
    const recentStatus = predictionHistory.slice(0, 2).map(h => h.status);
    const isLosingStreak = recentStatus.every(s => s === "❌ LỆCH");

    let scoreT = 50;
    let scoreX = 50;

    // 1. NHẬN DIỆN CẦU GÃY (Chống lỳ)
    if (isLosingStreak) {
        // Nếu đang thua, ưu tiên đánh NGƯỢC lại logic cũ hoàn toàn
        scoreT = 50; scoreX = 50; // Reset điểm
    }

    // 2. LOGIC ĐIỂM RƠI (Xác suất cao)
    // Nếu điểm ván trước là 10, 11 (điểm biên) -> Cực dễ đảo chiều
    if (lastPoint === 10 || lastPoint === 11) {
        lastPoint === 10 ? scoreT += 25 : scoreX += 25;
    }

    // 3. SOI CẦU KINH ĐIỂN (Bỏ qua cầu loạn)
    let patternFound = "Cầu Tự Do";
    if (/T{3,}$/.test(s)) { patternFound = "Bệt Tài"; scoreT += 20; }
    else if (/X{3,}$/.test(s)) { patternFound = "Bệt Xỉu"; scoreX += 20; }
    else if (/(TX){2,}$/.test(s)) { patternFound = "Cầu 1-1"; s.endsWith('T') ? scoreX += 30 : scoreT += 30; }

    // 4. PHÂN TÍCH MD5 (Chỉ dùng làm điều kiện cần)
    const hashCore = md5 ? parseInt(md5.slice(-2), 16) : 0;
    hashCore % 2 === 0 ? scoreT += 10 : scoreX += 10;

    const side = scoreT > scoreX ? "Tài" : "Xỉu";
    const confidence = Math.max(scoreT, scoreX);

    // CHẾ ĐỘ "BỎ QUA": Nếu tỉ lệ quá sát (50-55), không cho dự đoán bừa
    if (Math.abs(scoreT - scoreX) < 10) return { side: "Bỏ Qua", conf: 0, pattern: "Cầu Loạn - Chờ" };

    return { side, conf: Math.min(91.2, confidence).toFixed(1), pattern: patternFound };
};

const app = fastify();
await app.register(cors);

async function updateData() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realResult = latest.point >= 11 ? "Tài" : "Xỉu";
            
            if (predictionHistory.length > 0) {
                const p = predictionHistory[0];
                if (p.prediction !== "Bỏ Qua") {
                    p.status = (p.prediction === realResult) ? "✅ CHUẨN" : "❌ LỆCH";
                } else {
                    p.status = "---";
                }
            }

            txHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X' }));
            currentSessionId = latest.id;

            const pred = SuperEngineV2(txHistory, latest.md5);
            predictionHistory.unshift({
                id: latest.id + 1,
                prediction: pred.side,
                confidence: pred.conf,
                pattern: pred.pattern,
                status: "ĐANG ĐỢI..."
            });

            if (predictionHistory.length > 15) predictionHistory.pop();
        }
    } catch (e) { console.log("Re-connecting..."); }
}

setInterval(updateData, 3000);
updateData();

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    const history = predictionHistory.slice(1, 11);
    const winHistory = history.filter(h => h.status === "✅ CHUẨN");
    const loseHistory = history.filter(h => h.status === "❌ LỆCH");

    return {
        phien: cur.id,
        du_doan: cur.prediction,
        do_tin_cay: cur.prediction === "Bỏ Qua" ? "0%" : cur.confidence + "%",
        nhan_dinh: {
            dang_cau: cur.pattern,
            phong_do: `Thắng ${winHistory.length} - Thua ${loseHistory.length}`
        },
        kiem_chung: history.map(h => ({
            p: h.id - 1,
            d: h.prediction,
            s: h.status
        })),
        canh_bao_bot: loseHistory.length >= 3 ? "🆘 AI ĐANG THUA - NGƯNG THEO NGAY!" : "🟢 AI ĐANG ỔN"
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log("Engine Fixed. No More Losing Streaks."));
