import fastify from "fastify";
import cors from "@fastify/cors";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";

// --- CẤU HÌNH HOANGDZVIPLC79 ---
const PORT = process.env.PORT || 3000; // Tối ưu cho Render
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// --- GLOBAL STATE ---
let txHistory = []; 
let currentSessionId = null; 
let fetchInterval = null; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- UTILITIES TỐI ƯU ---
function parseLines(data) {
    if (!data || !Array.isArray(data.list)) return [];
    const sortedList = data.list.sort((a, b) => b.id - a.id);
    const arr = sortedList.map(item => ({
        session: item.id,
        dice: item.dices,
        total: item.point,
        result: item.resultTruyenThong,
        tx: item.point >= 11 ? 'T' : 'X'
    }));
    return arr.sort((a, b) => a.session - b.session);
}

function lastN(arr, n) {
    const start = Math.max(0, arr.length - n);
    return arr.slice(start);
}

function majority(obj) {
    let maxK = null, maxV = -Infinity;
    for (const k in obj) {
        if (obj[k] > maxV) {
            maxV = obj[k];
            maxK = k;
        }
    }
    return { key: maxK, val: maxV };
}

function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function avg(nums) { return nums.length ? sum(nums) / nums.length : 0; }

function entropy(arr) {
    if (!arr.length) return 0;
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    let e = 0, n = arr.length;
    for (const k in freq) {
        const p = freq[k] / n;
        e -= p * Math.log2(p);
    }
    return e;
}

function similarity(a, b) {
    if (a.length !== b.length) return 0;
    let m = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) m++;
    }
    return m / a.length;
}

function extractFeatures(history) {
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const freq = {};
    for (const v of tx) freq[v] = (freq[v] || 0) + 1;
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
        if (tx[i] === cur) len++;
        else {
            runs.push({ val: cur, len });
            cur = tx[i];
            len = 1;
        }
    }
    if (tx.length) runs.push({ val: cur, len });
    const meanTotal = avg(totals);
    const variance = avg(totals.map(t => Math.pow(t - meanTotal, 2)));
    const last10Totals = totals.slice(-10);
    const upward = last10Totals.filter((t, i) => i > 0 && t > last10Totals[i-1]).length;
    const downward = last10Totals.filter((t, i) => i > 0 && t < last10Totals[i-1]).length;
    return {
        tx, totals, freq, runs,
        maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0),
        meanTotal,
        stdTotal: Math.sqrt(variance),
        entropy: entropy(tx),
        last3Pattern: tx.slice(-3).join(''),
        last5Pattern: tx.slice(-5).join(''),
        last8Pattern: tx.slice(-8).join(''),
        trends: { upward, downward }
    };
}

// --- ADVANCED PATTERN DETECTION ---
function detectPatternType(runs) {
    if (runs.length < 3) return null;
    const lastRuns = runs.slice(-6);
    const lengths = lastRuns.map(r => r.len);
    const values = lastRuns.map(r => r.val);
    if (lastRuns.length >= 3) {
        if (lengths.every(l => l === 1)) {
            if (values.every((v, i) => i === 0 || v !== values[i-1])) return '1_1_pattern';
        }
        if (lengths.every(l => l === 2)) {
            if (values.every((v, i) => i === 0 || v !== values[i-1])) return '2_2_pattern';
        }
        if (lengths.every(l => l === 3)) {
            if (values.every((v, i) => i === 0 || v !== values[i-1])) return '3_3_pattern';
        }
        if (lengths.length >= 5 && lengths[0] === 2 && lengths[1] === 1 && lengths[2] === 2 && lengths[3] === 1 && lengths[4] === 2) return '2_1_2_pattern';
        if (lengths.length >= 5 && lengths[0] === 1 && lengths[1] === 2 && lengths[2] === 1 && lengths[3] === 2 && lengths[4] === 1) return '1_2_1_pattern';
        if (lengths.length >= 5 && lengths[0] === 3 && lengths[1] === 2 && lengths[2] === 3 && lengths[3] === 2 && lengths[4] === 3) return '3_2_3_pattern';
        if (lengths.length >= 5 && lengths[0] === 4 && lengths[1] === 2 && lengths[2] === 4 && lengths[3] === 2 && lengths[4] === 4) return '4_2_4_pattern';
        if (lengths.length >= 5 && lengths[0] === 2 && lengths[1] === 2 && lengths[2] === 1 && lengths[3] === 2 && lengths[4] === 2) return '2_2_1_pattern';
        if (lengths.length >= 5 && lengths[0] === 1 && lengths[1] === 3 && lengths[2] === 1 && lengths[3] === 3 && lengths[4] === 1) return '1_3_1_pattern';
        if (lengths.length >= 5 && lengths[0] === 3 && lengths[1] === 1 && lengths[2] === 3 && lengths[3] === 1 && lengths[4] === 3) return '3_1_3_pattern';
    }
    const lastRun = lastRuns[lastRuns.length - 1];
    if (lastRun && lastRun.len >= 5) return 'long_run_pattern';
    return 'random_pattern';
}

function predictNextFromPattern(patternType, runs, lastTx) {
    if (!patternType) return null;
    const lastRun = runs[runs.length - 1];
    switch (patternType) {
        case '1_1_pattern': return lastTx === 'T' ? 'X' : 'T';
        case '2_2_pattern': return lastRun.len === 2 ? (lastRun.val === 'T' ? 'X' : 'T') : lastRun.val;
        case '3_3_pattern': return lastRun.len === 3 ? (lastRun.val === 'T' ? 'X' : 'T') : lastRun.val;
        case '2_1_2_pattern':
            if (lastRun.val === 'T' && lastRun.len === 2) return 'X';
            if (lastRun.val === 'X' && lastRun.len === 2) return 'T';
            if (lastRun.len === 1) return lastRun.val === 'T' ? 'T' : 'X';
            return null;
        case '1_2_1_pattern':
            if (lastRun.val === 'T' && lastRun.len === 1) return 'X';
            if (lastRun.val === 'X' && lastRun.len === 1) return 'T';
            if (lastRun.len === 2) return lastRun.val;
            return null;
        case '3_2_3_pattern':
            if (lastRun.len === 3) return lastRun.val === 'T' ? 'X' : 'T';
            if (lastRun.len === 2) return lastRun.val === 'T' ? 'T' : 'X';
            return null;
        case '4_2_4_pattern':
            if (lastRun.len === 4) return lastRun.val === 'T' ? 'X' : 'T';
            if (lastRun.len === 2) return lastRun.val === 'T' ? 'T' : 'X';
            return null;
        case 'long_run_pattern':
            if (lastRun.len > 7) return lastRun.val === 'T' ? 'X' : 'T';
            if (lastRun.len >= 4 && lastRun.len <= 7) return lastRun.val;
            return null;
        default: return null;
    }
}

// --- CORE ALGORITHMS (GIỮ NGUYÊN GỐC) ---
function algo5_freqRebalance(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { freq, entropy: e } = features;
    const tCount = freq['T'] || 0;
    const xCount = freq['X'] || 0;
    const diff = Math.abs(tCount - xCount);
    const total = tCount + xCount;
    let threshold = e > 0.9 ? 0.45 : (e < 0.4 ? 0.65 : 0.55);
    const recent = history.slice(-30);
    const recentT = recent.filter(h => h.tx === 'T').length;
    const recentX = recent.filter(h => h.tx === 'X').length;
    const recentDiff = Math.abs(recentT - recentX);
    const recentTotal = recentT + recentX;
    if (total > 0 && recentTotal > 0) {
        const combinedRatio = ((diff / total) * 0.4) + ((recentDiff / recentTotal) * 0.6);
        if (combinedRatio > threshold) {
            if (recentT > recentX + 2) return 'X';
            if (recentX > recentT + 2) return 'T';
        }
    }
    return null;
}

function algoA_markov(history) {
    if (history.length < 15) return null;
    const tx = history.map(h => h.tx);
    let maxOrder = history.length < 30 ? (history.length < 20 ? 2 : 3) : 4;
    let bestPred = null, bestScore = -1;
    for (let order = 2; order <= maxOrder; order++) {
        if (tx.length < order + 8) continue;
        const transitions = {};
        const totalTransitions = tx.length - order;
        const decayFactor = 0.95;
        for (let i = 0; i < totalTransitions; i++) {
            const key = tx.slice(i, i + order).join('');
            const next = tx[i + order];
            const weight = Math.pow(decayFactor, totalTransitions - i - 1);
            if (!transitions[key]) transitions[key] = { T: 0, X: 0 };
            transitions[key][next] += weight;
        }
        const lastKey = tx.slice(-order).join('');
        const counts = transitions[lastKey];
        if (counts && (counts.T + counts.X) > 0.5) {
            const score = (Math.abs(counts.T - counts.X) / (counts.T + counts.X)) * (order / maxOrder) * Math.min(1, (counts.T + counts.X) / 10);
            if (score > bestScore) { bestScore = score; bestPred = counts.T > counts.X ? 'T' : 'X'; }
        }
    }
    return bestPred;
}

function algoB_ngram(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    const ngramSizes = history.length >= 50 ? [5, 6, 4, 3, 2] : (history.length >= 40 ? [4, 3, 2] : [3, 2]);
    let bestPred = null, bestConfidence = 0;
    for (const n of ngramSizes) {
        if (tx.length < n * 2) continue;
        const target = tx.slice(-n).join('');
        let weights = { T: 0, X: 0 }, totalWeight = 0;
        for (let i = 0; i <= tx.length - n - 1; i++) {
            if (tx.slice(i, i + n).join('') === target) {
                const weight = 1 / ((tx.length - i) * 0.5 + 1);
                weights[tx[i + n]] += weight;
                totalWeight += weight;
            }
        }
        if (totalWeight > 0) {
            const confidence = Math.abs(weights.T - weights.X) / totalWeight;
            if (confidence > bestConfidence) { bestConfidence = confidence; bestPred = weights.T > weights.X ? 'T' : 'X'; }
        }
    }
    return bestConfidence > 0.3 ? bestPred : null;
}

function algoS_NeoPattern(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const patternType = detectPatternType(features.runs);
    if (!patternType || patternType === 'random_pattern') return null;
    const prediction = predictNextFromPattern(patternType, features.runs, features.tx[features.tx.length - 1]);
    if (prediction) {
        const patternConsistency = features.runs.slice(-8).filter(r => patternType.includes('_pattern') || (patternType === 'long_run_pattern' && r.len >= 4)).length / 8;
        if (patternConsistency > 0.6) return prediction;
    }
    return null;
}

function algoF_SuperDeepAnalysis(history) {
    if (history.length < 60) return null;
    const timeframes = [{ l: 10, w: 0.3 }, { l: 30, w: 0.4 }, { l: 60, w: 0.3 }];
    let totalScore = { T: 0, X: 0 }, totalWeight = 0;
    for (const tf of timeframes) {
        if (history.length < tf.l) continue;
        const slice = history.slice(-tf.l);
        const sliceTx = slice.map(h => h.tx);
        const sliceTotals = slice.map(h => h.total);
        const tCount = sliceTx.filter(t => t === 'T').length;
        const xCount = sliceTx.filter(t => t === 'X').length;
        const meanTotal = avg(sliceTotals);
        const volatility = Math.sqrt(avg(sliceTotals.map(t => Math.pow(t - meanTotal, 2))));
        let tS = 0, xS = 0;
        if (meanTotal > 12) xS += 0.4; if (meanTotal < 9) tS += 0.4;
        if (tCount > xCount + 3) xS += 0.3; if (xCount > tCount + 3) tS += 0.3;
        if (volatility > 4) sliceTx.at(-1) === 'T' ? tS += 0.2 : xS += 0.2;
        const trend = sliceTotals.at(-1) - sliceTotals[0];
        if (trend > 3) xS += 0.1; if (trend < -3) tS += 0.1;
        const tfW = tf.w * (sliceTx.length / tf.l);
        totalScore.T += tS * tfW; totalScore.X += xS * tfW; totalWeight += tfW;
    }
    return (totalWeight > 0 && Math.abs(totalScore.T - totalScore.X) > 0.15) ? (totalScore.T > totalScore.X ? 'T' : 'X') : null;
}

function algoE_Transformer(history) {
    if (history.length < 100) return null;
    const tx = history.map(h => h.tx);
    let attentionScores = { T: 0, X: 0 };
    for (const seqLen of [6, 8, 10, 12]) {
        if (tx.length < seqLen * 2) continue;
        const targetSeq = tx.slice(-seqLen).join('');
        let seqMatches = 0;
        for (let i = 0; i <= tx.length - seqLen - 1; i++) {
            const mScore = similarity(tx.slice(i, i + seqLen).join(''), targetSeq);
            if (mScore >= 0.7) {
                const weight = mScore * (1 / (tx.length - i)) * (seqLen / 12);
                attentionScores[tx[i + seqLen]] = (attentionScores[tx[i + seqLen]] || 0) + weight;
                seqMatches++;
            }
        }
        if (seqMatches >= 3) { attentionScores.T *= 1.2; attentionScores.X *= 1.2; }
    }
    const total = attentionScores.T + attentionScores.X;
    return (total > 0.2 && (Math.abs(attentionScores.T - attentionScores.X) / total) > 0.25) ? (attentionScores.T > attentionScores.X ? 'T' : 'X') : null;
}

function algoG_SuperBridgePredictor(history) {
    const { runs } = extractFeatures(history);
    if (runs.length < 4) return null;
    const lastRun = runs.at(-1);
    if (lastRun.len >= 8) return lastRun.val === 'T' ? 'X' : 'T';
    if (lastRun.len >= 5 && lastRun.len <= 7) return lastRun.len > avg(runs.map(r => r.len)) * 1.8 ? (lastRun.val === 'T' ? 'X' : 'T') : lastRun.val;
    if (runs.length >= 5) {
        const lens = runs.slice(-5).map(r => r.len);
        if (lens[0] === 1 && lens[1] === 1 && lens[2] >= 3 && lastRun.len >= 3) return lastRun.val === 'T' ? 'X' : 'T';
    }
    return null;
}

function algoH_AdaptiveMarkov(history) {
    if (history.length < 25) return null;
    const tx = history.map(h => h.tx);
    let votes = { T: 0, X: 0 };
    for (const order of [2, 3, 4]) {
        if (tx.length < order + 5) continue;
        const trans = {};
        for (let i = 0; i <= tx.length - order - 1; i++) {
            const k = tx.slice(i, i + order).join('');
            if (!trans[k]) trans[k] = { T: 0, X: 0 };
            trans[k][tx[i + order]]++;
        }
        const counts = trans[tx.slice(-order).join('')];
        if (counts && counts.T + counts.X >= 2) votes[counts.T > counts.X ? 'T' : 'X'] += (Math.abs(counts.T - counts.X) / (counts.T + counts.X)) * (order / 10);
    }
    return (votes.T + votes.X > 0.3) ? (votes.T > votes.X ? 'T' : 'X') : null;
}

function algoI_PatternMaster(history) {
    if (history.length < 35) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 5) return null;
    let strength = { T: 0, X: 0 };
    const rPattern = runs.slice(-8).map(r => r.len).join('');
    const vPattern = runs.slice(-8).map(r => r.val).join('');
    const lib = [
        { p: '12121', res: vPattern.at(-1) === 'T' ? 'X' : 'T', s: 0.7 },
        { p: '21212', res: vPattern.at(-1), s: 0.7 },
        { p: '13131', res: vPattern.at(-1), s: 0.6 }
    ];
    lib.forEach(l => { if (rPattern.includes(l.p)) strength[l.res] += l.s; });
    const last10 = tx.slice(-10).join('');
    if (last10.includes('TXTXTXTX')) strength['X'] += 0.8;
    if (last10.includes('XTXTXTXT')) strength['T'] += 0.8;
    const total = strength.T + strength.X;
    return (total > 0 && (Math.abs(strength.T - strength.X) / total) > 0.3) ? (strength.T > strength.X ? 'T' : 'X') : null;
}

function algoJ_QuantumEntropy(history) {
    if (history.length < 40) return null;
    const { entropy: e, tx } = extractFeatures(history);
    let preds = { T: 0, X: 0 };
    [10, 20, 30].forEach(w => {
        const wTx = tx.slice(-w), wE = entropy(wTx);
        if (wE < 0.3) preds[wTx.at(-1)] += 0.6;
        else if (wE > 0.9) {
            const tC = wTx.filter(t => t === 'T').length, xC = wTx.filter(t => t === 'X').length;
            preds[tC > xC ? 'X' : 'T'] += 0.5;
        }
    });
    return (preds.T + preds.X > 0.4) ? (preds.T > preds.X ? 'T' : 'X') : null;
}

// --- DANH SÁCH THUẬT TOÁN ---
const ALL_ALGS = [
    { id: 'algo5_freqrebalance', fn: algo5_freqRebalance },
    { id: 'a_markov', fn: algoA_markov },
    { id: 'b_ngram', fn: algoB_ngram },
    { id: 's_neo_pattern', fn: algoS_NeoPattern },
    { id: 'f_super_deep_analysis', fn: algoF_SuperDeepAnalysis },
    { id: 'e_transformer', fn: algoE_Transformer },
    { id: 'g_super_bridge_predictor', fn: algoG_SuperBridgePredictor },
    { id: 'h_adaptive_markov', fn: algoH_AdaptiveMarkov },
    { id: 'i_pattern_master', fn: algoI_PatternMaster },
    { id: 'j_quantum_entropy', fn: algoJ_QuantumEntropy }
];

// --- ENSEMBLE CLASSIFIER (HOANGDZVIPLC79) ---
class SEIUEnsemble {
    constructor(algorithms, opts = {}) { 
        this.algs = algorithms;
        this.weights = {};
        this.emaAlpha = opts.emaAlpha ?? 0.06;
        this.performanceHistory = {};
        this.patternMemory = {};
        for (const a of algorithms) { this.weights[a.id] = 1.0; this.performanceHistory[a.id] = []; }
    }
    
    fitInitial(history) {
        if (history.length < 30) return;
        this.algs.forEach(a => {
            let correct = 0;
            for (let i = 15; i < history.length; i++) {
                if (a.fn(history.slice(0, i)) === history[i].tx) correct++;
            }
            this.weights[a.id] = 0.3 + ((correct / (history.length - 15)) * 0.7);
        });
    }

    updateWithOutcome(prefix, actual) {
        const patternType = detectPatternType(extractFeatures(prefix).runs);
        this.algs.forEach(a => {
            try {
                const correct = a.fn(prefix) === actual ? 1 : 0;
                this.performanceHistory[a.id].push(correct);
                if (this.performanceHistory[a.id].length > 60) this.performanceHistory[a.id].shift();
                const acc = avg(this.performanceHistory[a.id].slice(-25));
                this.weights[a.id] = (this.emaAlpha * acc) + ((1 - this.emaAlpha) * this.weights[a.id]);
                if (patternType && correct) {
                    const k = `${a.id}_${patternType}`;
                    this.patternMemory[k] = (this.patternMemory[k] || 0) + 1;
                }
            } catch (e) { this.weights[a.id] *= 0.92; }
        });
    }

    predict(history) {
        if (history.length < 12) return { prediction: 'tài', confidence: 0.5, rawPrediction: 'T' };
        const patternType = detectPatternType(extractFeatures(history).runs);
        const votes = { T: 0, X: 0 };
        this.algs.forEach(a => {
            const pred = a.fn(history);
            if (pred) {
                let w = this.weights[a.id] || 0.1;
                if (patternType && this.patternMemory[`${a.id}_${patternType}`] > 2) w *= 1.2;
                votes[pred] += w;
            }
        });
        const { key: best, val: bestVal } = majority(votes);
        const total = votes.T + votes.X;
        return { prediction: best === 'T' ? 'tài' : 'xỉu', confidence: Math.min(0.96, (bestVal / total) + 0.1), rawPrediction: best };
    }
}

class SEIUManager {
    constructor() {
        this.history = [];
        this.ensemble = new SEIUEnsemble(ALL_ALGS);
        this.currentPrediction = null;
    }
    loadInitial(lines) {
        this.history = lines;
        this.ensemble.fitInitial(this.history);
        this.currentPrediction = this.ensemble.predict(this.history);
    }
    pushRecord(record) {
        const prefix = [...this.history];
        this.history.push(record);
        if (this.history.length > 500) this.history = this.history.slice(-450);
        this.ensemble.updateWithOutcome(prefix, record.tx);
        this.currentPrediction = this.ensemble.predict(this.history);
    }
}

const seiuManager = new SEIUManager();
const app = fastify();
await app.register(cors, { origin: "*" });

async function fetchAndProcessHistory() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        const newHistory = parseLines(data);
        if (newHistory.length === 0) return;
        const last = newHistory.at(-1);
        if (!currentSessionId) {
            seiuManager.loadInitial(newHistory);
            txHistory = newHistory;
            currentSessionId = last.session;
        } else if (last.session > currentSessionId) {
            const newRecords = newHistory.filter(r => r.session > currentSessionId);
            newRecords.forEach(r => { seiuManager.pushRecord(r); txHistory.push(r); });
            txHistory = txHistory.slice(-300);
            currentSessionId = last.session;
        }
    } catch (e) { console.error("Lỗi:", e.message); }
}

setInterval(fetchAndProcessHistory, 5000);
fetchAndProcessHistory();

app.get("/api/taixiumd5/lc79", async () => {
    const last = txHistory.at(-1);
    const pred = seiuManager.currentPrediction;
    return {
        id: "HOANGDZVIPLC79",
        phien_truoc: last?.session,
        xuc_xac: last?.dice,
        tong: last?.total,
        ket_qua: last?.result.toLowerCase(),
        phien_hien_tai: (last?.session || 0) + 1,
        du_doan: pred?.prediction,
        do_tin_cay: `${(pred?.confidence * 100).toFixed(0)}%`
    };
});

app.get("/", async () => ({ status: "ok", msg: "HOANGDZVIPLC79 AI Live" }));

app.listen({ port: PORT, host: "0.0.0.0" }, () => console.log(`🚀 HOANGDZVIPLC79 Live on ${PORT}`));
