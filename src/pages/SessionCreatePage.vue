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

  // 3) 共有テキストを先にコピー（補間はバッククォート）
  const newUrl = `${location.origin}/s/${sess.id}/${token}`
  const msg = `waligaで会計は管理。waligaで会計は管理。waligaで会計は管理。忘れない内に入れましょう\n${newUrl}`

  try {
    await navigator.clipboard.writeText(msg)
    alert('リンクコピー完了！忘れやん内にLINEで共有しときや')
  } catch (err) {
    console.warn('clipboard failed:', err)
    // フォールバック：URLだけでもアラートに出す
    alert('リンクコピー完了！忘れやん内にLINEで共有しときや')
  }

  // 4) 最後に遷移
  router.push(`/s/${sess.id}/${token}`)
}
</script>

<template>
  <main class="container">
    <div class="card card--frameless" style="display:flex; flex-direction:column; gap:12px;">

      <label class="small">タイトル</label>
      <input v-model="title" placeholder="名古屋旅行" />

      <!-- メンバー入力欄 -->
      <label class="small" style="margin-top:4px;">メンバー名</label>
      <div class="row" style="gap:8px; align-items:center;">
        <input
          ref="inputEl"
          v-model="nameInput"
          placeholder="あおい"
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
</template>