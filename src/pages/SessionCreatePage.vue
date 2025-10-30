<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../api/supabase'

const router = useRouter()

// セッション名
const title = ref('')

// メンバーUI
const nameInput = ref('')
const names = ref([]) // ここに追加したメンバーがたまる
const inputEl = ref(null)
const loading = ref(false)

// 入力正規化（空白削除・全角空白対応）
function normalizeName(s) {
  return s.replace(/\s+/g, ' ').replace(/^[\s　]+|[\s　]+$/g, '')
}

// 追加（Enter or ボタン）
function addName() {
  const raw = nameInput.value
  // カンマ / 改行ペーストで一気に複数追加もOK
  if (raw.includes(',') || raw.includes('\n')) {
    const parts = raw.split(/[,|\n]/).map(normalizeName).filter(Boolean)
    for (const p of parts) pushUnique(p)
    nameInput.value = ''
    return focusInput()
  }
  const n = normalizeName(raw)
  if (!n) return
  pushUnique(n)
  nameInput.value = ''
  focusInput()
}

// 重複を入れない
function pushUnique(n) {
  if (names.value.some(x => x === n)) return
  // 20人くらいまでの軽いガード（必要なら調整）
  if (names.value.length >= 50) return alert('メンバーは最大50人まで')
  names.value.push(n)
}

function removeName(idx) {
  names.value.splice(idx, 1)
}

function focusInput() {
  nextTick(() => inputEl.value?.focus())
}

function genToken(bits = 128) {
  const a = new Uint8Array(bits/8); crypto.getRandomValues(a)
  return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')
}

async function createSession() {
  if (!title.value.trim()) return alert('タイトルを入れてください')
  if (names.value.length === 0) return alert('メンバーを1人以上追加してください')

  loading.value = true
  const token = genToken()

  // 1) sessions
  const { data: sess, error: e1 } = await supabase
    .from('sessions')
    .insert([{ title: title.value, token }])
    .select('id')
    .single()
  if (e1 || !sess) {
    loading.value = false
    return alert(e1?.message ?? 'sessions insert 失敗')
  }

  // 2) members
  const rows = names.value.map(n => ({ session_id: sess.id, name: n, active: true }))
  const { error: e2 } = await supabase.from('members').insert(rows)
  if (e2) {
    loading.value = false
    return alert(e2.message)
  }

  loading.value = false

  // // 3) 共有テキストを先にコピー（補間はバッククォート）
  // const newUrl = `${location.origin}/s/${sess.id}/${token}`
  // const msg = `waligaで会計は管理。waligaで会計は管理。waligaで会計は管理。忘れない内に入れましょう\n${newUrl}`

  // try {
  //   await navigator.clipboard.writeText(msg)
  //   alert('リンクコピー完了！忘れやん内にLINEで共有しときや')
  // } catch (err) {
  //   console.warn('clipboard failed:', err)
  //   // フォールバック：URLだけでもアラートに出す
  //   alert('コピーエラー')
  // }

  // 4) 最後に遷移
  router.push(`/s/${sess.id}/${token}`)
}

//　履歴機能の実装
// ＝＝＝＝ 過去イベント検索（苗字） ＝＝＝＝
const querySurname = ref('');
const pastEvents = ref([]);      // 表示用カード配列
const searching = ref(false);

const fmtJPY = (n) =>
  Number(n || 0).toLocaleString('ja-JP', {
    style: 'currency', currency: 'JPY', maximumFractionDigits: 0
  });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ja-JP', { year:'numeric', month:'short', day:'numeric' }) : '';

async function searchBySurname() {
  const key = querySurname.value.trim();
  if (!key) { pastEvents.value = []; return; }

  searching.value = true;

  // 1) 苗字で members を引いて、そのセッション群を得る
  const { data: hits, error } = await supabase
    .from('members')
    .select('session_id, name, sessions!inner(id, title, token, created_at)')
    .ilike('name', `${key}%`);          // 先頭一致（苗字から始まる）
  if (error) { alert(error.message); searching.value = false; return; }
  if (!hits || hits.length === 0) { pastEvents.value = []; searching.value = false; return; }

  // 2) セッションをユニーク化
  const seen = new Set();
  const sessions = [];
  for (const h of hits) {
    const s = h.sessions;
    if (s && !seen.has(s.id)) { seen.add(s.id); sessions.push(s); }
  }

  // 3) 各セッションで members / expenses を取得し、合計と/1人を計算
  const cards = await Promise.all(sessions.map(async (s) => {
    const [{ data: ms }, { data: exps }] = await Promise.all([
      supabase.from('members')
        .select('name, active').eq('session_id', s.id).eq('active', true).order('id'),
      supabase.from('expenses')
        .select('amount_jpy').eq('session_id', s.id)
    ]);
    const namesList = (ms ?? []).map(m => m.name);
    const total = (exps ?? []).reduce((sum, e) => sum + (e?.amount_jpy ?? 0), 0);
    const headcount = (ms ?? []).length || 1;
    const per = Math.floor(total / headcount);

    return {
      id: s.id,
      token: s.token,
      title: s.title,
      created_at: s.created_at,
      members: namesList,
      total,
      per
    };
  }));

  pastEvents.value = cards.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  searching.value = false;
}

function openSessionCard(ev) {
  // そのイベントへ移動
  router.push(`/s/${ev.id}/${ev.token}`);
}

function reuseMembers(ev) {
  // 同じメンバーを上に復元（タイトルは絶対に上書きしない）
  names.value = [...ev.members];
  focusInput();   // 入力欄にフォーカス戻す
}

</script>

<template>
  <main class="container">
    <div class="maincard" style="display:flex; flex-direction:column; gap:12px;">

      <!-- <label class="small">タイトル</label> -->
      <input v-model="title" placeholder="イベントタイトル" />

      <!-- メンバー入力欄 -->
      <!-- <label class="small" style="margin-top:4px;">メンバー名</label> -->
      <div class="row" style="gap:8px; align-items:center;">
        <input
          ref="inputEl"
          v-model="nameInput"
          placeholder="メンバー名"
          @keyup.enter.prevent="addName"
          autocomplete="off"
          autocapitalize="none"
          style="flex:1; padding:10px 12px; height:40px;"
        />
        <button class="ghost" @click="addName" style="height:40px; padding:0 14px; white-space:nowrap;">追加</button>
      </div>

      <!-- メンバー一覧 -->
      <div class="row" style="gap:6px; flex-wrap:wrap;">
        <span v-for="(n,i) in names" :key="i"
          style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #eee; border-radius:999px; background:#fff; font-size:13px; font-weight: 600;">
          {{ n }}
          <button class="ghost" style="padding:2px 6px; font-size:14px;" @click="removeName(i)">×</button>
        </span>
      </div>

      <button :disabled="loading" @click="createSession" style="width:100%; margin-top:8px;">
        グループを作成
      </button>
    </div>
  </main>

  <!-- ＝＝＝＝ 過去イベント検索（苗字） ＝＝＝＝ -->
  <div class="container">
    <div class="card card--frameless" style="margin-top:8px;">
      <div class="row" style="gap:8px; align-items:center; ">
        <input
          v-model="querySurname"
          class="input"
          placeholder="みょうじ or 苗字"
          @keyup.enter.prevent="searchBySurname"
          style="font-size:15px; flex:1; border-radius: 10px; padding:10px 12px; height:40px;"
        />
        <button class="ghost-black" @click="searchBySurname" :disabled="searching"
                style="font-size: 13px; border-radius: 10px; height:40px; padding:0 14px; white-space:nowrap;">
          {{ searching ? '検索中…' : '履歴表示' }}
        </button>
      </div>

      <!-- 結果リスト -->
      <div v-if="pastEvents.length" style="margin-top:10px; display:flex; flex-direction:column; gap:12px;">
        <div v-for="ev in pastEvents" :key="ev.id" class="card">
          <div class="section">
            <div class="small">作成日: {{ fmtDate(ev.created_at) }}</div>
            <h3 style="margin:0; white-space:normal; overflow-wrap:break-word;">
              {{ ev.title || 'セッション' }}
            </h3>
            <div class="small">{{ ev.members.join('・') }}</div>
          </div>

          <!-- 合計 / 1人（SessionPageと同じ見た目ルール） -->
          <div class="settle-summary split2 badges" style="margin-top:12px;">
            <div class="col left">
              <span class="badge-circle total">計</span>
              <span class="amount total">{{ fmtJPY(ev.total) }}</span>
            </div>
            <div class="col right">
              <span class="badge-pill per">1人</span>
              <span class="amount per">{{ fmtJPY(ev.per) }}</span>
            </div>
          </div>

          <!-- ボタン2つ（横並び） -->
          <button class="btn-mini orange" style="width:100%; margin-top:10px;" @click="openSessionCard(ev)">イベントを見る</button>
          <button class="btn-mini blue"  style="width:100%; margin-top:10px;" @click="reuseMembers(ev)">同じメンバーを入力</button>
        </div>
      </div>

      <div v-else-if="querySurname && !searching" class="small" style="margin-top:8px;">
        該当イベントはありません
      </div>
    </div>
   </div>
</template>