<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'

const route = useRoute()
const router = useRouter()

const sessionId = route.params.id
const token = route.params.token
const expId = route.params.expId

console.log('[ExpenseEdit] params:', { sessionId, token, expId }) 
if (!expId) {
  alert('編集対象が見つかりません')
  router.push({ name: 'session', params: { id: sessionId, token } })
}

// DB
const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: { headers: { 'x-session-token': String(token) } },
    auth: { persistSession: false, autoRefreshToken: false }
  }
)

// 状態
const memo = ref('')
const amount = ref(null)
const payerId = ref(null)
const selected = ref([])
const loading = ref(false)
const members = ref([])


// 名前ヘルパ
function nameOf(id) {
  return members.value.find(m => m.id === id)?.name ?? `#${id}`
}
function initials(full) {
  const s = String(full ?? '').trim()
  if (!s) return '?'
  const ja = s[0]
  const en = s.split(/\s+/).map(w => w[0]).join('').slice(0,2)
  return /[^\x00-\x7F]/.test(s) ? ja : en
}

async function loadMembers() {
  const { data: m } = await db
    .from('members')
    .select('id,name,active')
    .eq('session_id', sessionId)
    .eq('active', true)
    .order('id')
  members.value = m ?? []
}

async function loadExpense() {
  const { data: exp } = await db
    .from('expenses')
    .select('*')
    .eq('id', expId)
    .single()

  if (!exp) {
    alert('データがありません')
    router.back()
    return
  }

  memo.value = exp.memo ?? ''
  amount.value = exp.amount_jpy
  payerId.value = exp.payer_member_id
  selected.value = (exp.beneficiaries ?? []).map(Number)
}

async function updateExpense() {
  loading.value = true
  await db.from('expenses')
    .update({
      memo: memo.value,
      amount_jpy: amount.value,
      payer_member_id: payerId.value,
      beneficiaries: selected.value
    })
    .eq('id', expId)
  loading.value = false
  router.back()
}

async function deleteExpense() {
  if (!confirm('本当に削除しますか？')) return
  await db.from('expenses')
    .delete()
    .eq('id', expId)
  router.back()
}

onMounted(async () => {
  await loadMembers()
  await loadExpense()
})
</script>

<template>
  <main class="container" style="display:flex; flex-direction:column; gap:20px;">

    <div class="card">

      <!-- 入力UI（登録ページと同じデザイン） -->
      <div class="sentence">

        <select v-model.number="payerId" class="in-sent select">
          <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <span class="in-sent">が</span>

        <span class="br"></span>

        <div class="in-sent chip-list tight">
          <label v-for="m in members" :key="m.id" class="chip small">
            <input type="checkbox" :value="m.id" v-model="selected" />
            <span>{{ m.name }}</span>
          </label>
        </div>

        <span class="br"></span>

        <span class="in-sent">の</span>

        <div class="in-sent input-suffix">
          <input v-model="memo" placeholder="夕食" class="in-sent input" />
          <span class="suffix">代</span>
        </div>

        <span class="in-sent">を払って</span>

        <div class="in-sent input-prefix">
          <span class="prefix">¥</span>
          <input type="number" v-model.number="amount"
                 min="1" class="in-sent input num" />
        </div>

        <span class="in-sent">かかった。</span>

      </div>

      <div class="spacer"></div>

      <!-- ボタン3つ -->
      <button class="btn-register"
              @click="updateExpense"
              style="width:100%;">更新する</button>

      <button class="ghost"
              @click="router.back()"
              style="width:100%; margin-top:10px;">
        戻る
      </button>

      <button class="danger"
              @click="deleteExpense"
              style="width:100%; margin-top:10px;">
        削除する
      </button>

    </div>

  </main>
</template>