<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { supabase as db } from '../api/supabase'

const route = useRoute()
const sessionId = route.params.id
const token = route.params.token

const members = ref([])
const expenses = ref([])
const memo = ref('')
const amount = ref(null)
const payerId = ref(null)
const selected = ref([])
const loading = ref(false)

async function loadAll() {
  // セッション存在確認（id/token）
  const { data: s, error: se } = await db
    .from('sessions').select('id').eq('id', sessionId).eq('token', token).single()
  if (se || !s) { alert('セッションが見つかりません'); return }

  const { data: m } = await db
    .from('members').select('id,name,active')
    .eq('session_id', sessionId).eq('active', true).order('id')
  members.value = m ?? []
  if (members.value.length && payerId.value == null) payerId.value = members.value[0].id
  if (selected.value.length === 0) selected.value = members.value.map(x => x.id)

  const { data: e } = await db
    .from('expenses').select('payer_member_id,amount_jpy,beneficiaries,memo')
    .eq('session_id', sessionId).order('id')
  expenses.value = e ?? []
}

async function addExpense() {
  if (!amount.value || !payerId.value || selected.value.length === 0) return alert('入力が足りません')
  loading.value = true
  const { error } = await db.from('expenses').insert([{
    session_id: sessionId,
    payer_member_id: payerId.value,
    amount_jpy: amount.value,
    beneficiaries: selected.value,
    memo: memo.value || null
  }])
  loading.value = false
  if (error) return alert(error.message)
  amount.value = null
  memo.value = ''
}

function computeBalances(expenses) {
  const b = {}
  for (const e of expenses) {
    const share = Math.floor(e.amount_jpy / e.beneficiaries.length)
    b[e.payer_member_id] = (b[e.payer_member_id] ?? 0) + e.amount_jpy
    for (const m of e.beneficiaries) b[m] = (b[m] ?? 0) - share
  }
  return b
}
function settleGreedy(bal) {
  const P=[],N=[]
  for (const [id,v] of Object.entries(bal)) {
    const n = Number(id)
    if (v>0) P.push({id:n,v}); else if (v<0) N.push({id:n,v:-v})
  }
  P.sort((a,b)=>b.v-a.v); N.sort((a,b)=>b.v-a.v)
  const edges=[]; let i=0,j=0
  while (i<P.length && j<N.length) {
    const x = Math.min(P[i].v, N[j].v)
    edges.push({ from:N[j].id, to:P[i].id, amount:x })
    if ((P[i].v-=x)===0) i++
    if ((N[j].v-=x)===0) j++
  }
  return edges
}

const balances = computed(() => computeBalances(expenses.value))
const edges = computed(() => settleGreedy(balances.value))
function nameOf(id) { return members.value.find(m => m.id === id)?.name ?? `#${id}` }

onMounted(async () => {
  await loadAll()
  // Realtime購読
  const ch = db.channel(`session-${sessionId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `session_id=eq.${sessionId}` },
      () => loadAll())
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'members', filter: `session_id=eq.${sessionId}` },
      () => loadAll())
    .subscribe()
})
</script>

<template>
  <main style="max-width:840px;margin:24px auto;padding:16px;">
    <h2>セッション</h2>

    <section style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h3>出費追加</h3>
        <div>
          <label>支払者</label>
          <select v-model.number="payerId">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div>
          <label>対象メンバー</label>
          <div>
            <label v-for="m in members" :key="m.id" style="margin-right:12px;">
              <input type="checkbox" :value="m.id" v-model="selected" /> {{ m.name }}
            </label>
          </div>
        </div>
        <div>
          <label>金額（円）</label>
          <input type="number" v-model.number="amount" min="1" />
        </div>
        <div>
          <label>メモ</label>
          <input v-model="memo" placeholder="夕食代など" />
        </div>
        <button :disabled="loading" @click="addExpense">追加</button>
      </div>

      <div>
        <h3>清算案</h3>
        <div v-if="edges.length === 0">清算は不要です</div>
        <ul v-else>
          <li v-for="(e,i) in edges" :key="i">
            {{ nameOf(e.from) }} → {{ nameOf(e.to) }} : {{ e.amount }} 円
          </li>
        </ul>
      </div>
    </section>

    <section style="margin-top:24px;">
      <h3>出費一覧</h3>
      <table border="1" cellpadding="6">
        <thead><tr><th>支払者</th><th>対象</th><th>金額</th><th>メモ</th></tr></thead>
        <tbody>
          <tr v-for="(e,i) in expenses" :key="i">
            <td>{{ nameOf(e.payer_member_id) }}</td>
            <td>{{ e.beneficiaries.map(nameOf).join(', ') }}</td>
            <td>{{ e.amount_jpy }}</td>
            <td>{{ e.memo ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>