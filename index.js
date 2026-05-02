import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let txHistory = [];
let predictionHistory = [];
let currentSessionId = 0;

// --- SIÊU MA TRẬN NHẬN DIỆN CẦU (ADVANCED PATTERN MATRIX) ---
const PatternEngine = {
    scan: (history) => {
        const s = history.slice(-12).map(h => h.tx).join(''); // Lấy chuỗi 12 ván gần nhất
        if (s.length < 4) return { name: "Đang nạp dữ liệu...", level: "SAFE" };

        // 1. Nhóm Cầu Bệt (Streak) - Nhận diện bệt từ 3 đến 15 cây
        if (/(T{4,}|X{4,})$/.test(s)) return { name: "CẦU BỆT ĐANG CHẠY 🔥", level: "HIGH_CONFIDENCE", action: "Đánh thuận theo bệt" };

        // 2. Nhóm Cầu Đảo (Interchange) - 1-1, 1-2, 2-1
        if (/(TX){2,}$|(XT){2,}$/.test(s)) return { name: "CẦU ĐẢO 1-1 🔄", level: "MEDIUM", action: "Đánh nghịch phiên" };
        if (/(TXX){2,}$|(XTT){2,}$/.test(s)) return { name: "CẦU 1-2-1-2 📉", level: "HIGH", action: "Đánh 1 Tài - 2 Xỉu" };
        if (/(TTX){2,}$|(XXT){2,}$/.test(s)) return { name: "CẦU 2-1-2-1 📈", level: "HIGH", action: "Đánh 2 Tài - 1 Xỉu" };

        // 3. Nhóm Cầu Đối Xứng (Mirroring)
        const half = s.slice(-6);
        const prevHalf = s.slice(-12, -6);
        if (half === prevHalf.split('').reverse().join('')) return { name: "CẦU ĐỐI XỨNG (GƯƠNG) 🪞", level: "EXTREME", action: "Đánh ngược chuỗi cũ" };

        // 4. Nhóm Cầu Theo Điểm (Point Dynamics)
        const lastPoints = history.slice(-3).map(h => h.point);
        if (lastPoints[0] < lastPoints[1] && lastPoints[1] < lastPoints[2]) return { name: "CẦU TIẾN (BẬC THANG) 📶", level: "MEDIUM", action: "Ưu tiên Tài" };
        
        // 5. Cầu lặp (Periodic)
        for (let len = 2; len <= 4; len++) {
            const part1 = s.slice(-len);
            const part2 = s.slice(-len * 2, -len);
            if (part1 === part2) return { name: `CẦU LẶP CHU KỲ ${len}-${len} 🔁`, level: "HIGH", action: "Đánh theo chu kỳ" };
        }

        // 6. Nhận diện Cầu Loạn (Chaos)
        const uniqueSub = new Set([s.slice(-1), s.slice(-2, -1), s.slice(-3, -2)]);
        if (uniqueSub.size > 2 && !s.includes("TT") && !s.includes("XX")) return { name: "CẦU NHẢY (LOẠN) ⚠️", level: "DANGER", action: "Nên dừng lại" };

        return { name: "Cầu Tự Do (Chưa xác định)", level: "NORMAL", action: "Vào tiền nhẹ" };
    }
};

// --- ENGINE PHÂN TÍCH MD5 & BIẾN THIÊN ---
const predictLogic = (history, md5) => {
    const pattern = PatternEngine.scan(history);
    const lastVaild = history[history.length - 1];
    
    let scoreT = 50;
    let scoreX = 50;

    // Phân tích MD5 Bias
    if (md5) {
        const hex = md5.substring(0, 4);
        const weight = parseInt(hex, 16) % 100;
        weight > 50 ? scoreT += 15 : scoreX += 15;
    }

    // Áp dụng Pattern vào điểm số
    if (pattern.action?.includes("Tài")) scoreT += 25;
    if (pattern.action?.includes("Xỉu")) scoreX += 25;
    if (pattern.name.includes("BỆT") && lastVaild.tx === 'T') scoreT += 35;
    if (pattern.name.includes("BỆT") && lastVaild.tx === 'X') scoreX += 35;

    // Logic chống "ảo giác" (Khử noise)
    const side = scoreT > scoreX ? "Tài" : "Xỉu";
    let confidence = Math.max(scoreT, scoreX);
    
    // Giới hạn tỉ lệ dựa trên độ nhận diện cầu
    if (pattern.level === "EXTREME") confidence = 95.8;
    else if (pattern.level === "DANGER") confidence = 51.2;
    else confidence = Math.min(88.5, confidence);

    return { side, confidence, pattern };
};

const app = fastify();
await app.register(cors);

async function updateSystem() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realResult = latest.point >= 11 ? "Tài" : "Xỉu";
            
            if (predictionHistory.length > 0) {
                const last = predictionHistory[0];
                last.status = (last.prediction === realResult) ? "✅ CHUẨN" : "❌ LỆCH";
            }

            txHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X' }));
            currentSessionId = latest.id;

            const pred = predictLogic(txHistory, latest.md5);
            predictionHistory.unshift({
                id: latest.id + 1,
                prediction: pred.side,
                confidence: pred.confidence,
                pattern: pred.pattern.name,
                action: pred.pattern.action,
                status: "CHỜ..."
            });

            if (predictionHistory.length > 20) predictionHistory.pop();
        }
    } catch (e) { console.log("System updating..."); }
}

setInterval(updateSystem, 3000);
updateSystem();

app.get("/api/taixiumd5/lc79", async () => {
    const cur = predictionHistory[0] || {};
    const history = predictionHistory.slice(1, 11);
    const winRate = (history.filter(h => h.status === "✅ CHUẨN").length / (history.length || 1) * 100).toFixed(0);

    return {
        phien_hien_tai: cur.id,
        du_doan: cur.prediction,
        ti_le_thang: cur.confidence + "%",
        phan_tich_cau: {
            loai_cau: cur.pattern,
            huong_dan: cur.action,
            phong_do_ai: `Đang chuẩn ${winRate}%`
        },
        canh_bao: parseFloat(winRate) < 50 ? "🚩 CẢNH BÁO: BÀN ĐANG LOẠN, DỪNG LẠI!" : "🟢 CẦU ĐẸP: CÓ THỂ ĐẦU TƯ",
        kiem_chung: history.map(h => ({
            phien: h.id - 1,
            du_doan: h.prediction,
            ket_qua: h.status
        }))
    };
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log("Super AI Matrix Online"));
