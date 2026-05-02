import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let txHistory = [];
let predictionHistory = [];
let currentSessionId = 0;

// --- BỘ NHẬN DIỆN CẦU (PATTERN RECOGNITION) ---
const detectPattern = (history) => {
    if (history.length < 6) return { name: "Đang tích lũy...", alert: "Chờ dữ liệu" };
    
    const last6 = history.slice(-6).map(h => h.tx).join('');
    const last4 = last6.slice(-4);

    // 1. Nhận diện cầu Bệt
    if (last4 === "TTTT" || last4 === "XXXX") 
        return { name: "CẦU BỆT 🔥", alert: "Đánh tiếp theo bệt, không bẻ cầu!" };

    // 2. Nhận diện cầu 1-1
    if (last4 === "TXTX" || last4 === "XTXT") 
        return { name: "CẦU ĐẢO 1-1 🔄", alert: "Đánh đảo chiều theo nhịp 1-1" };

    // 3. Nhận diện cầu 2-2
    if (last6.endsWith("TTXX") || last6.endsWith("XXTT")) 
        return { name: "CẦU ĐÔI 2-2 ✌️", alert: "Đánh theo nhịp đôi 2-2" };

    // 4. Nhận diện cầu nghiêng
    const tCount = history.slice(-10).filter(h => h.tx === 'T').length;
    if (tCount >= 7) return { name: "NGHIÊNG TÀI 📈", alert: "Ưu tiên bắt Tài" };
    if (tCount <= 3) return { name: "NGHIÊNG XỈU 📉", alert: "Ưu tiên bắt Xỉu" };

    return { name: "Cầu Loạn (Cầu Nhảy)", alert: "Hạn chế vào tiền ván này" };
};

// --- ENGINE DỰ ĐOÁN TỔNG HỢP ---
const analyzeDeep = (history, md5) => {
    const patternInfo = detectPattern(history);
    const last = history[history.length - 1];
    
    let scoreT = 50;
    let scoreX = 50;

    // Phân tích theo Pattern
    if (patternInfo.name.includes("BỆT")) last.tx === 'T' ? scoreT += 30 : scoreX += 30;
    if (patternInfo.name.includes("1-1")) last.tx === 'T' ? scoreX += 30 : scoreT += 30;
    
    // Phân tích MD5 (Lấy mã cuối)
    const lastChar = md5 ? md5.slice(-1) : '0';
    if ("02468ace".includes(lastChar.toLowerCase())) scoreT += 10; else scoreX += 10;

    const finalSide = scoreT > scoreX ? "Tài" : "Xỉu";
    const confidence = Math.min(94.5, Math.max(scoreT, scoreX) + (Math.random() * 5));

    return { side: finalSide, confidence: confidence.toFixed(1), pattern: patternInfo };
};

const app = fastify();
await app.register(cors, { origin: "*" });

async function syncData() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const actualTX = latest.point >= 11 ? "Tài" : "Xỉu";

            // Kiểm chứng ván cũ
            if (predictionHistory.length > 0) {
                const p = predictionHistory[0];
                if (p.status === "WAITING") {
                    p.status = (p.prediction === actualTX) ? "✅ ĐÚNG" : "❌ SAI";
                }
            }

            txHistory = data.map(item => ({ point: item.point, tx: item.point >= 11 ? 'T' : 'X' }));
            currentSessionId = latest.id;

            // Dự đoán ván mới
            const result = analyzeDeep(txHistory, latest.md5);
            predictionHistory.unshift({
                sessionId: latest.id + 1,
                prediction: result.side,
                confidence: result.confidence,
                patternName: result.pattern.name,
                alert: result.pattern.alert,
                status: "WAITING"
            });

            if (predictionHistory.length > 15) predictionHistory.pop();
        }
    } catch (err) { console.log("Lỗi đồng bộ dữ liệu"); }
}

setInterval(syncData, 3000);
syncData();

app.get("/api/taixiumd5/lc79", async () => {
    if (predictionHistory.length === 0) return { status: "Đang quét dữ liệu bàn chơi..." };

    const cur = predictionHistory[0];
    const historyData = predictionHistory.slice(1, 11);
    
    const wins = historyData.filter(h => h.status === "✅ ĐÚNG").length;
    const total = historyData.length || 1;
    const winRate = ((wins / total) * 100).toFixed(0);

    return {
        phien_id: cur.sessionId,
        du_doan: cur.prediction,
        ti_le: cur.confidence + "%",
        // PHẦN CẢNH BÁO VÀ NHẬN DIỆN CẦU
        he_thong_soi_cau: {
            dang_cau: cur.patternName,
            canh_bao: cur.alert,
            phong_do_ai: `Tỉ lệ khớp cầu: ${winRate}% (${wins}/${total})`
        },
        lich_su_doi_soat: historyData.map(h => ({
            phien: h.sessionId - 1,
            du_doan: h.prediction,
            trang_thai: h.status
        })),
        loi_khuyen_tu_ai: winRate < 50 ? "❌ Cầu đang biến động mạnh - HOANGDZ BẢO NÊN DỪNG" : "✅ Cầu đẹp -HOANHDZ BẢO Có thể vào tiền"
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log("AI Pattern Alerts Ready!"));
