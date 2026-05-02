import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";
import fs from "fs";

const app = fastify();
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- 📂 HỆ THỐNG LƯU TRỮ DỮ LIỆU CỐ ĐỊNH ---
const DATA_FILE = "./historical_data.json";

// --- 🧠 LỚP PHÂN TÍCH AI CHUYÊN SÂU ---
class DiamondEngine {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.sessionCount = 0;
        this.loadLocalData();
    }

    loadLocalData() {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE);
            this.history = JSON.parse(raw);
            console.log(`[HỆ THỐNG] Đã nạp ${this.history.length} phiên lịch sử từ bộ nhớ.`);
        }
    }

    saveData() {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.history.slice(-3000)));
    }

    // --- 📊 BỘ NHẬN DIỆN CẦU SIÊU CẤP ---
    identifyPatterns(data) {
        if (data.length < 15) return ["Đang thu thập nhịp"];
        const txs = data.map(x => x.tx).join("");
        const patterns = [];

        // 1. Cầu Bệt (Streak)
        if (txs.includes("TTTTT")) patterns.push("🔥 BỆT TÀI ĐẠI ĐẾ");
        if (txs.includes("XXXXX")) patterns.push("🔥 BỆT XỈU VÔ ĐỐI");

        // 2. Cầu Đảo (1-1)
        if (txs.includes("TXTXTX") || txs.includes("XTXTXT")) patterns.push("🔄 CẦU ĐẢO 1-1");

        // 3. Cầu Kép (2-2, 3-3)
        if (txs.includes("TTXXTT") || txs.includes("XXTTXX")) patterns.push("📊 CẦU KÉP 2-2");
        if (txs.includes("TTTXXX") || txs.includes("XXXTTT")) patterns.push("📈 CẦU KÉP 3-3");

        // 4. Cầu Tiến/Lùi (1-2-3, 3-2-1)
        if (txs.includes("TXXTTT") || txs.includes("XTTXXX")) patterns.push("📐 CẦU TIẾN 1-2-3");
        if (txs.includes("TTTXTT") || txs.includes("XXXTTX")) patterns.push("📐 CẦU LÙI 3-2-1");

        // 5. Cầu Đối Xứng
        const last8 = txs.slice(-8);
        if (last8 === last8.split("").reverse().join("")) patterns.push("💎 CẦU ĐỐI XỨNG HIẾM");

        return patterns.length > 0 ? patterns : ["🌊 NHỊP SÓNG TỰ DO"];
    }

    // --- 🔮 THUẬT TOÁN DỰ ĐOÁN TỐI CAO ---
    calculateSupreme(md5) {
        const last14 = this.history.slice(-14);
        const txs = last14.map(x => x.tx);
        const pts = last14.map(x => x.point);
        
        let scoreT = 50;
        let scoreX = 50;
        let logLogic = [];

        // A. PHÂN TÍCH ĐIỂM SỐ (POINT ANALYSIS)
        const lastPoint = pts[pts.length - 1];
        if (lastPoint >= 15) { scoreX += 15; logLogic.push("Điểm quá cao -> Hồi Xỉu"); }
        if (lastPoint <= 5) { scoreT += 15; logLogic.push("Điểm quá thấp -> Hồi Tài"); }

        // B. PHÂN TÍCH MD5 (MÃ HÓA BẢO MẬT)
        const hash = md5 ? parseInt(md5.substring(0, 2), 16) : 128;
        if (hash > 150) { scoreT += 12; logLogic.push("MD5 High Weight -> Tài"); }
        else if (hash < 100) { scoreX += 12; logLogic.push("MD5 Low Weight -> Xỉu"); }

        // C. PHÂN TÍCH CẦU CHẾT (ANTI-LOSS)
        const recentLosses = this.predictions.slice(0, 3).filter(p => p.status === "❌ GÃY").length;
        if (recentLosses >= 3) {
            return { result: "💤 DỪNG", conf: 0, reason: "Hệ thống đang loạn, bảo trì nhịp" };
        }

        // D. ĐỐI CHIẾU 2055 PHIÊN LỊCH SỬ[span_2](start_span)[span_2](end_span)
        const currentPattern = txs.slice(-4).join("");
        let matchT = 0, matchX = 0;
        for (let i = 0; i < this.history.length - 5; i++) {
            const sub = this.history.slice(i, i + 4).map(x => x.tx).join("");
            if (sub === currentPattern) {
                this.history[i + 4].tx === 'T' ? matchT++ : matchX++;
            }
        }
        if (matchT > matchX) scoreT += 20; else scoreX += 20;

        const finalS = scoreT > scoreX ? "🔴 TÀI" : "⚪ XỈU";
        const finalC = Math.min(Math.max(scoreT, scoreX), 99);

        return { result: finalS, conf: finalC, reason: logLogic.join(" | ") };
    }
}

const engine = new DiamondEngine();

// --- ⚡ HỆ THỐNG ĐỒNG BỘ DỮ LIỆU ---
async function syncData() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list) return;

        const sortedData = json.list.sort((a, b) => a.id - b.id);
        const latest = sortedData[sortedData.length - 1];

        if (latest.id > engine.sessionCount) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
            
            // 1. Cập nhật kết quả dự đoán trước đó[span_3](start_span)[span_3](end_span)
            if (engine.predictions.length > 0) {
                const lastPred = engine.predictions[0];
                lastPred.status = (lastPred.prediction === realTX) ? "✅ CHUẨN" : "❌ GÃY";
                lastPred.realPoint = latest.point;
            }

            // 2. Ghi đè lịch sử mới[span_4](start_span)[span_4](end_span)
            engine.history = sortedData.map(i => ({
                id: i.id,
                point: i.point,
                tx: i.point >= 11 ? 'T' : 'X',
                md5: i.md5
            }));
            engine.sessionCount = latest.id;
            engine.saveData();

            // 3. Thực hiện dự đoán phiên tiếp theo[span_5](start_span)[span_5](end_span)
            const brainOutput = engine.calculateSupreme(latest.md5);
            const patternsDetected = engine.identifyPatterns(engine.history);

            engine.predictions.unshift({
                id: latest.id + 1,
                prediction: brainOutput.result,
                confidence: brainOutput.conf,
                logic: brainOutput.reason,
                patterns: patternsDetected,
                status: "⏳ ĐANG ĐỢI",
                timestamp: new Date().toLocaleTimeString()
            });

            if (engine.predictions.length > 30) engine.predictions.pop();
            console.log(`[AI] Đã xử lý xong phiên ${latest.id}. Đang đợi phiên ${latest.id + 1}...`);
        }
    } catch (err) {
        console.error("[LỖI] Không thể kết nối API:", err.message);
    }
}

// --- 🛡️ API ENDPOINT PHỤC VỤ GIAO DIỆN ---
await app.register(cors);

app.get("/api/ai/full-stats", async (req, reply) => {
    const cur = engine.predictions[0] || {};
    const logs = engine.predictions.slice(1, 15);
    const winCount = logs.filter(l => l.status === "✅ CHUẨN").length;
    const rate = logs.length > 0 ? ((winCount / logs.length) * 100).toFixed(1) : 0;

    return {
        THONG_TIN_AI: {
            ten: "DIAMOND SUPREME AI",
            phien_ban: "5.0.1 PRO",
            tong_du_lieu: `${engine.history.length} Phiên`,
            trang_thai: rate > 50 ? "🟢 ỔN ĐỊNH" : "🔴 CẢNH BÁO"
        },
        DU_DOAN_HIEN_TAI: {
            phien: `🆔 ${cur.id}`,
            ket_qua: cur.prediction,
            do_tin_cay: `🎯 ${cur.confidence}%`,
            nhan_dinh: cur.patterns,
            logic_ngầm: cur.logic
        },
        HIEU_SUAT: {
            ti_le_thang: `🚀 ${rate}%`,
            thong_ke: `Thắng ${winCount}/${logs.length} phiên gần nhất`,
            loi_khuyen: rate >= 70 ? "💎 CẦU ĐẸP, THEO ĐỀU TAY" : "🛑 CẦU NHẢY, NÊN DỪNG LẠI"
        },
        NHAT_KY_DU_DOAN: logs.map(l => ({
            phien: l.id - 1,
            du_doan: l.prediction,
            thuc_te: l.status,
            diem: l.realPoint
        }))
    };
});

// Chạy vòng lặp đồng bộ mỗi 3 giây
setInterval(syncData, 3000);
syncData();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`
    ██████╗ ██╗ █████╗ ███╗   ███╗ ██████╗ ███╗   ██╗██████╗ 
    ██╔══██╗██║██╔══██╗████╗ ████║██╔═══██╗████╗  ██║██╔══██╗
    ██║  ██║██║███████║██╔████╔██║██║   ██║██╔██╗ ██║██║  ██║
    ██║  ██║██║██╔══██║██║╚██╔╝██║██║   ██║██║╚██╗██║██║  ██║
    ██████╔╝██║██║  ██║██║ ╚═╝ ██║╚██████╔╝██║ ╚████║██████╔╝
    ╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝ 
    >>> HỆ THỐNG AI TỐI CAO ĐÃ SẴN SÀNG TẠI PORT ${PORT} <<<
    `);
});
