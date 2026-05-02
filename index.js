/**
 * DỰ ÁN: DIAMOND AI SUPREME 
 * ADMIN: TRẦN NHẬT HOÀNG
 * FILE: index.js (Định dạng API chuẩn theo yêu cầu)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let memoryHistory = [];          
let predictionLogs = [];         
let currentSessionId = 0;

// --- 🧠 THUẬT TOÁN HEX-ADAPTIVE ---
const getDecision = (history, md5) => {
    const last15 = history.slice(-15);
    const txs = last15.map(x => x.tx);
    let scoreT = 50, scoreX = 50;

    // Phân tích mã HEX sâu hơn
    if (md5) {
        const hexVal = parseInt(md5.substring(0, 4), 16);
        hexVal % 2 === 0 ? scoreT += 20 : scoreX += 20;
    }

    // Nhận diện nhịp cầu
    const pattern = txs.slice(-3).join("");
    if (pattern === "TTT") scoreT += 25;
    if (pattern === "XXX") scoreX += 25;
    if (pattern === "TXT" || pattern === "XTX") {
        pattern.endsWith("T") ? scoreX += 30 : scoreT += 30;
    }

    const res = scoreT >= scoreX ? "🔴 TÀI" : "⚪ XỈU";
    const conf = Math.min(Math.max(scoreT, scoreX), 99);
    return { res, conf };
};

// --- ⚡ ĐỒNG BỘ DỮ LIỆU & LƯU LỊCH SỬ ĐỐI SOÁT ---
async function sync() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId || currentSessionId === 0) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";

            // Cập nhật kết quả cho phiên vừa diễn ra
            if (predictionLogs.length > 0 && latest.id > currentSessionId) {
                const prev = predictionLogs[0];
                prev.ket_qua = realTX;
                prev.trang_thai = (prev.du_doan === realTX) ? "✅ ĐÚNG" : "❌ SAI";
            }

            memoryHistory = data.map(i => ({ point: i.point, tx: i.point >= 11 ? 'T' : 'X', md5: i.md5 }));
            const decision = getDecision(memoryHistory, latest.md5);
            
            // Tạo đối tượng dự đoán theo định dạng yêu cầu
            const newPredict = {
                phien: latest.id + 1,
                du_doan: decision.res,
                ti_le: `${decision.conf}%`,
                ket_qua: "⏳ ĐỢI...",
                trang_thai: "🔄 ĐANG SOI"
            };

            if (latest.id > currentSessionId) {
                predictionLogs.unshift(newPredict);
            } else if (predictionLogs.length === 0) {
                predictionLogs.push(newPredict);
            }

            currentSessionId = latest.id;
            if (predictionLogs.length > 25) predictionLogs.pop();
        }
    } catch (e) { console.log("Lỗi Sync:", e.message); }
}

await app.register(cors);

// --- 🌐 API OUTPUT ĐÚNG ĐỊNH DẠNG ---
app.get("/api/taixiumd5/lc79", async () => {
    if (predictionLogs.length === 0) await sync();
    
    const cur = predictionLogs[0];
    const logs = predictionLogs.slice(1, 11);

    return {
        ADMIN: "TRẦN NHẬT HOÀNG",
        THONG_TIN_PHIEN: {
            "Phiên": cur.phien,
            "Dự đoán": cur.du_doan,
            "Tỉ lệ": cur.ti_le
        },
        LICH_SU_DOI_SOAT: logs.map(l => ({
            "Chi tiết": `Phiên ${l.phien} -> Dự đoán: ${l.du_doan} -> Tỉ lệ: ${l.ti_le} -> Kết quả: ${l.ket_qua} -> Trạng thái: ${l.trang_thai}`
        }))
    };
});

setInterval(sync, 3000);
sync();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`🚀 DIAMOND AI v8.5 ONLINE - ADMIN: HOÀNG`);
});
