import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, deleteDoc, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7CRs01Za4Na6_b7zcMjaoQhTWiNFQEZM",
    authDomain: "my-gym-log-169f8.firebaseapp.com",
    projectId: "my-gym-log-169f8",
    storageBucket: "my-gym-log-169f8.firebasestorage.app",
    messagingSenderId: "608418671470",
    appId: "1:608418671470:web:b2c886c6e4f85486a0af7f",
    measurementId: "G-LG6Y0FY7MY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const inputDate = document.getElementById('input-date');
const dayDisplay = document.getElementById('day-display');
const inputTime = document.getElementById('input-time');
const gymSelect = document.getElementById('record-gym-select');
const heatmapGymSelect = document.getElementById('heatmap-gym-select');
const saveBtn = document.getElementById('save-btn');
const toggleAllBtn = document.getElementById('toggle-all');
const allDataSection = document.getElementById('all-data');
const heatmapContainer = document.getElementById('heatmap');
const timeLabelsContainer = document.getElementById('time-labels');
const gymAdviceText = document.getElementById('gym-advice-text');
const saunaAdviceText = document.getElementById('sauna-advice-text');

let gymCategories = {};

function getGymAdvice(level) {
    if (level === "--") return "データがありません。";
    const l = parseFloat(level);
    if (l <= 2.0) return "✅ 快適。マシン待ちはなく、スムーズにメニューをこなせる環境です。";
    if (l <= 3.0) return "💡 標準。人気のマシンはタイミング次第で少し待つ可能性があります。";
    if (l <= 4.0) return "⚠️ 混雑。マシン待ちの可能性が高いため、メニューの工夫が必要です。";
    if (l <= 4.5) return "❌ 満員。今は行かない方がいいでしょう。時間をずらすのが賢明です。";
    return "❌ 激混み。トレーニングにならない可能性が高いです。";
}

function getSaunaAdvice(level) {
    if (level === "--") return "記録をお待ちしています。";
    const l = parseFloat(level);
    if (l <= 2.0) return "✅ 快適。サウナ室は余裕があり、シャワーもスムーズに利用できます。";
    if (l <= 3.0) return "💡 標準。利用者が数名います。シャワーはタイミングにより使用中の可能性あり。";
    if (l <= 4.0) return "⚠️ 混雑。シャワー待ちが発生しそうです。サウナ室で調整して入るのが吉。";
    if (l <= 4.5) return "❌ 満席。サウナ室もほぼ埋まっています。今は避けるのが無難です。";
    return "❌ 飽和状態。リラックスして入るのが難しい状況です。";
}

function getLevelColor(level) {
    if (level === "--") return "var(--text-secondary)";
    const l = parseFloat(level);
    if (l <= 2.0) return "#60a5fa"; 
    if (l <= 3.5) return "#d9f99d"; 
    if (l <= 4.5) return "#fb923c"; 
    return "#f87171"; 
}

async function updateFixedAdvice(gymId, category) { const level = await getEstimatedLevel(gymId, 0); const color = getLevelColor(level);

const card = (category === "ジム") ? gymAdviceText.parentElement : saunaAdviceText.parentElement;

if (card) {
    if (category === "ジム") gymAdviceText.textContent = getGymAdvice(level);
    else saunaAdviceText.textContent = getSaunaAdvice(level);

    // 外枠全体の色を変更
    card.style.borderColor = color;
    // 念のため影を強制的に消去
    card.style.boxShadow = "none";
}
}
async function refreshGyms() {
    const gymTiles = document.getElementById('gym-tiles-container');
    const adminPanel = document.getElementById('admin-panel');
    if (!gymTiles) return;
    try {
        const querySnapshot = await getDocs(collection(db, "gyms"));
        gymTiles.innerHTML = '';
        gymSelect.innerHTML = '<option value="">店舗を選択</option>';
        heatmapGymSelect.innerHTML = '<option value="">店舗を選択</option>';
        if (adminPanel) adminPanel.innerHTML = '<div class="add-gym-form"><input type="text" id="new-gym-name" placeholder="店舗名を入力"><select id="new-gym-category"><option value="ジム">ジム</option><option value="サウナ">サウナ</option></select><button id="add-gym-btn">新規追加</button></div>';

        querySnapshot.forEach((docSnap) => {
            const gym = docSnap.data();
            const id = docSnap.id;
            gymCategories[id] = gym.category || "ジム";

            // タイルの作成
            const tile = document.createElement('div');
            tile.className = 'gym-tile';
            tile.innerHTML = `
                <span class="gym-name">${gym.name}</span>
                <div>
                    <span class="gym-level" id="level-${id}">--</span>
                    <span class="trend-arrow" id="trend-${id}"></span>
                </div>
                <span class="level-unit">混雑レベル</span>
                <div class="next-info" id="next-${id}">計算中...</div>
            `;
            gymTiles.appendChild(tile);
            gymSelect.appendChild(new Option(gym.name, id));
            heatmapGymSelect.appendChild(new Option(gym.name, id));
            
            // 管理パネル内のリスト（削除・固定ボタン）
            if (adminPanel) {
                const item = document.createElement('div');
                item.style = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);";
                item.innerHTML = `
                    <span style="font-size:0.8rem">${gym.name} ${gym.isFixed ? '★' : ''}</span>
                    <div>
                        <button onclick="setFixedGym('${id}', '${gym.category}')" style="background:var(--accent); color:#000; border:none; padding:2px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; margin-right:5px;">固定</button>
                        <button onclick="deleteGym('${id}')" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:0.7rem;">削除</button>
                    </div>
                `;
                adminPanel.appendChild(item);
            }

            // アドバイスパネルに固定されているかチェック
            if (gym.isFixed) {
                updateFixedAdvice(id, gym.category);
            }

            updateTileLevels(id);
        });

        // ボタンイベントの再割り当て
        document.getElementById('add-gym-btn').onclick = addNewGym;

    } catch (e) { console.error(e); }
}

// 特定の店舗をアドバイスパネルに固定する処理
window.setFixedGym = async (gymId, category) => {
    try {
        const batch = writeBatch(db);
        const querySnapshot = await getDocs(collection(db, "gyms"));
        
        // 同じカテゴリーの他の店舗の固定を解除
        querySnapshot.forEach((docSnap) => {
            if (docSnap.data().category === category) {
                batch.update(doc(db, "gyms", docSnap.id), { isFixed: false });
            }
        });
        
        // 指定した店舗を固定
        batch.update(doc(db, "gyms", gymId), { isFixed: true });
        await batch.commit();
        alert(`${category}のアドバイスパネルを固定しました`);
        refreshGyms();
    } catch (e) { alert("固定に失敗しました"); }
};

window.deleteGym = async (id) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
        await deleteDoc(doc(db, "gyms", id));
        refreshGyms();
    } catch (e) { alert("失敗"); }
};

async function addNewGym() {
    const name = document.getElementById('new-gym-name').value;
    const category = document.getElementById('new-gym-category').value;
    if (!name) return;
    await addDoc(collection(db, "gyms"), { name, category, isFixed: false });
    refreshGyms();
}

async function updateTileLevels(gymId) {
    const prevL = await getEstimatedLevel(gymId, -60);
    const currentL = await getEstimatedLevel(gymId, 0);
    const nextL = await getEstimatedLevel(gymId, 60);
    
    const lSpan = document.getElementById(`level-${gymId}`);
    const nDiv = document.getElementById(`next-${gymId}`);
    const tSpan = document.getElementById(`trend-${gymId}`);
    
    if (lSpan) {
        lSpan.textContent = currentL;
        lSpan.style.color = getLevelColor(currentL);
    }
    
    if (tSpan && currentL !== "--" && prevL !== "--") {
        const diff = parseFloat(currentL) - parseFloat(prevL);
        tSpan.classList.remove("trend-up", "trend-down");
        if (diff > 0.1) { 
            tSpan.textContent = "↑"; 
            tSpan.classList.add("trend-up");
            tSpan.style.color = "#f87171"; 
        }
        else if (diff < -0.1) { 
            tSpan.textContent = "↓"; 
            tSpan.classList.add("trend-down");
            tSpan.style.color = "#60a5fa"; 
        }
        else { 
            tSpan.textContent = "→"; 
            tSpan.style.color = "var(--text-secondary)"; 
        }
    }
    if (nDiv) nDiv.textContent = `1h後予測: ${nextL}`;
}

async function getEstimatedLevel(gymId, offsetMin) {
    try {
        const target = new Date(new Date().getTime() + offsetMin * 60000);
        const days = ["日", "月", "火", "水", "木", "金", "土"];
        const tDay = days[target.getDay()];
        const tH = target.getHours();
        if (tH < 9 || tH > 19) return "--";
        const tTime = `${tH}:${target.getMinutes() < 30 ? "00" : "30"}`;
        const q = query(collection(db, "gym_logs"), where("gymId", "==", gymId), where("day", "==", tDay), where("time", "==", tTime));
        const snap = await getDocs(q);
        if (snap.empty) return "--";
        let sum = 0; snap.forEach(d => sum += d.data().level);
        return Math.round(sum / snap.size * 10) / 10;
    } catch (e) { return "--"; }
}

async function buildHeatmap() {
    const id = heatmapGymSelect.value;
    if (!id) return;
    const days = ["月", "火", "水", "木", "金", "土", "日"];
    const times = [];
    for (let h = 9; h <= 19; h++) { times.push(`${h}:00`, `${h}:30`); }

    const q = query(collection(db, "gym_logs"), where("gymId", "==", id));
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => d.data());
    
    heatmapContainer.innerHTML = ''; 
    timeLabelsContainer.innerHTML = '<div class="day-header" style="background:none"></div>';
    
    times.forEach(t => {
        const div = document.createElement('div');
        div.className = 'time-label-cell';
        div.textContent = t;
        timeLabelsContainer.appendChild(div);
    });

    days.forEach(day => {
        const col = document.createElement('div');
        col.className = 'day-column';
        col.innerHTML = `<div class="day-header">${day}</div>`;
        times.forEach(time => {
            const cellLogs = logs.filter(l => l.day === day && l.time === time);
            const count = cellLogs.length;
            const avg = count > 0 ? cellLogs.reduce((s, v) => s + v.level, 0) / count : 0;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            if (count > 0) {
                let color = "";
                if (avg <= 2.0) color = "#60a5fa";
                else if (avg <= 3.5) color = "#22c55e";
                else if (avg <= 4.5) color = "#fb923c";
                else color = "#f87171";

                cell.style.backgroundColor = color;
                cell.style.color = "white";
                cell.style.fontWeight = "800";
                cell.innerHTML = `${Math.round(avg*10)/10}${count <= 3 ? '<div class="low-data-alert">!</div>' : ''}`;
            } else { cell.textContent = '-'; cell.style.color = '#e2e8f0'; }
            col.appendChild(cell);
        });
        heatmapContainer.appendChild(col);
    });
}

// 店舗選択（LOG DATA用）: ここを変えてもアドバイスは動かない
gymSelect.onchange = () => {
    heatmapGymSelect.value = gymSelect.value;
    if (!allDataSection.classList.contains('hidden')) buildHeatmap();
};

heatmapGymSelect.onchange = () => {
    gymSelect.value = heatmapGymSelect.value;
    buildHeatmap();
};

saveBtn.onclick = async () => {
    const gymId = gymSelect.value;
    if (!gymId) return alert("店舗を選択してください");
    const level = document.querySelector('input[name="level"]:checked').value;
    saveBtn.disabled = true;
    try {
        await addDoc(collection(db, "gym_logs"), { 
            gymId, date: inputDate.value, 
            day: dayDisplay.textContent.replace(/[()]/g, ""), 
            time: inputTime.value, level: Number(level), 
            timestamp: serverTimestamp() 
        });
        alert("✅ 保存しました");
        refreshGyms();
    } catch (e) { alert("エラー"); }
    saveBtn.disabled = false;
};

toggleAllBtn.onclick = () => {
    allDataSection.classList.toggle('hidden');
    if (!allDataSection.classList.contains('hidden')) buildHeatmap();
};

document.getElementById('toggle-admin').onclick = () => document.getElementById('admin-panel').classList.toggle('hidden');

function initForm() {
    if (inputTime) {
        inputTime.innerHTML = "";
        for (let h = 9; h <= 19; h++) {
            for (let m of ['00', '30']) {
                const t = `${h}:${m}`;
                inputTime.appendChild(new Option(t, t));
            }
        }
    }
    if (inputDate) {
        inputDate.valueAsDate = new Date();
        const updateDay = () => {
            const days = ["(日)", "(月)", "(火)", "(水)", "(木)", "(金)", "(土)"];
            const d = new Date(inputDate.value);
            if (!isNaN(d.getTime())) dayDisplay.textContent = days[d.getDay()];
        };
        inputDate.onchange = updateDay;
        updateDay();
    }
}

// 5分ごとに自動更新
setInterval(refreshGyms, 300000);

initForm();
refreshGyms();