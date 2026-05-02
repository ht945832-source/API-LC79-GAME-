/**
 * DỰ ÁN: DIAMOND AI SUPREME v11.0
 * ADMIN: TRẦN NHẬT HOÀNG[span_8](start_span)[span_8](end_span)
 * NÂNG CẤP: DETERMINISTIC LOGIC (XÓA RANDOM)
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

// --- 🧠 CORE AI V11.0 (LOGIC THUẦN TÚY - KHÔNG NGẪU NHIÊN) ---
const analyzeSupremeV11 = (history, latest) => {
    const point = latest.point;
    const md5 = latest.md5 || "";
    
    let scoreT = 50, scoreX = 50;

    // 1. CÔNG THỨC ĐIỂM SUNWIN CỐ ĐỊNH[span_9](start_span)[span_9](end_span)
    if ([3, 5, 10].includes(point)) scoreX += 150; 
    if (point === 4) scoreX += 45;
    if ([7, 8].includes(point)) scoreX += 65;
    if ([15, 18].includes(point)) scoreT += 150; 
    if (point === 16) scoreX += 80; 
    if (point === 17) scoreX += 40;

    // 2. PHÂN TÍCH HEX ENERGY DỰA TRÊN DỮ LIỆU MD5[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span)
    if (md5.length >= 32) {
        // Trích xuất các giá trị cố định từ chuỗi Hex
        const v1 = parseInt(md5.substring(0, 8), 16);
        const v2 = parseInt(md5.substring(24, 32), 16);
        const energyResult = (v1 ^ v2) % 100;
        
        // Cộng dồn score dựa trên kết quả phép toán bitwise cố định
        energyResult % 2 === 0 ? scoreT += 30 : scoreX += 30;
    }

    // 3. TÍNH TOÁN TỈ LỆ TIN CẬY DỰA TRÊN TRỌNG SỐ (DETERMINISTIC)[span_12](start_span)[span_12](end_span)
    const res = scoreT >= scoreX ? "🔴 TÀI" : "⚪ XỈU";
    
    // Tỉ lệ được tính toán dựa trên độ lệch giữa scoreT và scoreX
    // Không sử dụng Math.random()[span_13](start_span)[span_13](end_span)
    const diff = Math.abs(scoreT - scoreX);
    let conf = 75 + (diff % 15); // Cơ chế tính toán dựa trên số dư cố định
    
    // Giới hạn trần tỉ lệ để giữ độ uy tín[span_14](start_span)[span_14](end_span)
    if (conf > 95) conf = 95;

    return { res, conf: Math.round(conf) };
};

// --- ⚡ ĐỒNG BỘ DỮ LIỆU ---
async function syncData() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list || json.list.length === 0) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            const realTX = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";

            if (predictionLogs.length > 0) {
                const prev = predictionLogs[0];
                if (prev.phien === latest.id) {
                    prev.ket_qua = realTX;
                    prev.trang_thai = (prev.du_doan === realTX) ? "✅ WIN" : "❌ LOSE";
                }
            }

            memoryHistory = data.map(i => ({ 
                point: i.point, 
                tx: i.point >= 11 ? 'T' : 'X', 
                md5: i.md5 
            }));

            // Chạy AI dự đoán phiên tiếp theo[span_15](start_span)[span_15](end_span)[span_16](start_span)[span_16](end_span)
            const decision = analyzeSupremeV11(memoryHistory, latest);
            
            const newPredict = {
                phien: latest.id + 1,
                du_doan: decision.res,
                ti_le: `${decision.conf}%`,
                ket_qua: "⏳ CHỜ KẾT QUẢ",
                trang_thai: "🔄 ĐANG PHÂN TÍCH",
                timestamp: new Date().toLocaleTimeString('vi-VN')
            };

            predictionLogs.unshift(newPredict);
            currentSessionId = latest.id;

            if (predictionLogs.length > 30) predictionLogs.pop();
        }
    } catch (error) {
        console.log("Sync Error:", error.message);
    }
}

app.register(cors, { origin: "*" });

// --- 🌐 API OUTPUT v11.0 ---
app.get("/api/taixiumd5/v11", async () => {
    if (predictionLogs.length === 0) await syncData();
    
    const current = predictionLogs[0];
    const history = predictionLogs.slice(1, 11);

    return {
        ADMIN: "TRẦN NHẬT HOÀNG",[span_17](start_span)[span_17](end_span)
        VERSION: "11.0 (NON-RANDOM)",
        LIVE: {
            "Phiên": current.phien,
            "Dự đoán": current.du_doan,
            "Tỉ lệ": current.ti_le,
            "Cập nhật": current.timestamp
        },
        LOGS: history.map(log => ({
            "P": log.phien,
            "D": log.du_doan,
            "K": log.ket_qua,
            "S": log.trang_thai,
            "L": log.ti_le
        }))
    };
});

setInterval(syncData, 3000);
syncData();

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`🚀 DIAMOND AI v11.0 - DETERMINISTIC ENGINE BY HOANGDZ`);
});
