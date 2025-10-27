<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'

const route = useRoute(); const router = useRouter()
const sessionId = route.params.id; const token = route.params.token

const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { headers: { 'x-session-token': String(token) } } }
)

const members = ref([])
const expenses = ref([])
const memo = ref(''); const amount = ref(null)
const payerId = ref(null); const selected = ref([])
const loading = ref(false)

async function loadAll() {
  const { data: s, error: se } = await db.from('sessions')
    .select('id').eq('id', sessionId).eq('token', token).single()
  if (se || !s) { alert('セッションが見つかりません'); router.push('/'); return }

  const { data: m } = await db.from('members')
    .select('id,name,active').eq('session_id', sessionId).eq('active', true).order('id')
  members.value = m ?? []
  if (members.value.length && payerId.value == null) payerId.value = members.value[0].id
  if (selected.value.length === 0) selected.value = members.value.map(x=>x.id)

  const { data: e } = await db.from('expenses')
    .select('payer_member_id,amount_jpy,beneficiaries,memo').eq('session_id', sessionId).order('id')
  expenses.value = e ?? []
}

async function addExpense() {
  if (!amount.value || !payerId.value || selected.value.length === 0) return alert('入力が足りません')
  loading.value = true
  const { error } = await db.from('expenses').insert([{
    session_id: sessionId, payer_member_id: payerId.value,
    amount_jpy: amount.value, beneficiaries: selected.value, memo: memo.value || null
  }])
  loading.value = false
  if (error) return alert(error.message)
  amount.value = null; memo.value = ''
}

function computeBalances(expenses) {
  const b = {}; for (const e of expenses) {
    const share = Math.floor(e.amount_jpy / e.beneficiaries.length)
    b[e.payer_member_id] = (b[e.payer_member_id] ?? 0) + e.amount_jpy
    for (const m of e.beneficiaries) b[m] = (b[m] ?? 0) - share
  } return b
}
function settleGreedy(bal) {
  const P=[],N=[]; for (const [id,v] of Object.entries(bal)) {
    const n=Number(id); if (v>0) P.push({id:n,v}); else if (v<0) N.push({id:n,v:-v})
  } P.sort((a,b)=>b.v-a.v); N.sort((a,b)=>b.v-a.v)
  const edges=[]; let i=0, j=0; while (i<P.length&&j<N.length) {
    const x=Math.min(P[i].v,N[j].v); edges.push({from:N[j].id,to:P[i].id,amount:x})
    if ((P[i].v-=x)===0) i++; if ((N[j].v-=x)===0) j++
  } return edges
}
const balances = computed(()=>computeBalances(expenses.value))
const edges = computed(()=>settleGreedy(balances.value))
function nameOf(id){ return members.value.find(m=>m.id===id)?.name ?? `#${id}` }

function copyLink(){
  navigator.clipboard.writeText(location.href).then(()=>alert('リンクをコピーしました'))
}

onMounted(async () => {
  await loadAll()
  db.channel(`session-${sessionId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'expenses',filter:`session_id=eq.${sessionId}`},()=>loadAll())
    .on('postgres_changes',{event:'*',schema:'public',table:'members',filter:`session_id=eq.${sessionId}`},()=>loadAll())
    .subscribe()
})
</script>

<template>
  <main class="container" style="display:flex; flex-direction:column; gap:14px;">
    <div class="row" style="justify-content:space-between;">
      <span class="badge">waliga</span>
      <div class="row" style="gap:8px;">
        <button class="ghost" @click="$router.push('/')">別の清算記録を作成</button>
        <button class="ghost" @click="copyLink">リンクをコピー</button>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px;">出費を記録</h3>

      <div class="spacer"></div>
      <label class="small">メモ</label>
      <input v-model="memo" placeholder="晩飯代" />

      <label class="small">払った人</label>
      <select v-model.number="payerId">
        <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>

      <div class="spacer"></div>
      <label class="small">払ってもらった人</label>
      <div class="row">
        <label v-for="m in members" :key="m.id" style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" :value="m.id" v-model="selected" /> {{ m.name }}
        </label>
      </div>

      <div class="spacer"></div>
      <label class="small">金額（円）</label>
      <input type="number" v-model.number="amount" min="1" inputmode="numeric" placeholder="3000" />


      <div class="spacer"></div>
      <button :disabled="loading" @click="addExpense" style="width:100%;">追加する</button>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px;">支払い先</h3>
      <div v-if="edges.length===0" class="small">清算は不要です</div>
      <ul v-else class="list">
        <li v-for="(e,i) in edges" :key="i">
          {{ nameOf(e.from) }} → {{ nameOf(e.to) }} : <b>{{ e.amount }}</b> 円
        </li>
      </ul>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px;">出費の履歴</h3>
      <ul class="list">
        <li v-for="(e,i) in expenses" :key="i">
          <span class="label">{{ e.memo ?? '' }}</span>
          は<b>{{ nameOf(e.payer_member_id) }}</b> が
          <span class="badge">{{ e.amount_jpy }} 円</span>
          を {{ e.beneficiaries.map(nameOf).join(' / ') }} の分を払った
          
        </li>
      </ul>
    </div>
  </main>
</template>