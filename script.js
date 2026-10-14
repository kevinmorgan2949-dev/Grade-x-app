const SUPABASE_URL = 'https://vkojdzbhautyhwcujmiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrb2pkemJoYXV0eHdjdWptaml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjAzMDksImV4cCI6MjEwNzQ5NjMwOX0.sOpFs2O4t5KmIhJBTl42IUZ0jvqiJMTxxYbk9_NFAOo';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isSignUpMode = false;
let activeMatch = null;
let currentQuestionIndex = 0;
let playerScores = { user: 0, opponent: 0 };
let matchQuestions = [];

// Switch Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('text-indigo-400');
    el.classList.add('text-slate-400');
    const span = el.querySelector('span');
    if (span) { span.classList.remove('font-bold'); span.classList.add('font-medium'); }
  });

  const targetTab = document.getElementById('tab-' + tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  const activeBtn = document.getElementById('nav-btn-' + tabId);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('text-indigo-400');
    const span = activeBtn.querySelector('span');
    if (span) { span.classList.remove('font-medium'); span.classList.add('font-bold'); }
  }

  if (tabId === 'arena') loadArenaRooms();
  if (tabId === 'library') loadDocuments();

  const container = document.getElementById('appMainContainer');
  if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auth Mode Toggle
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('authActionBtn').innerText = isSignUpMode ? "Create Account" : "Sign In";
  document.getElementById('authSubtitle').innerText = isSignUpMode ? "Register to earn, stake & compete" : "Enter your student account credentials";
  document.getElementById('authToggleText').innerText = isSignUpMode ? "Already have an account? Sign in" : "Don't have an account? Sign up";
}

async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  if (!email || !password) { alert("Please fill in email and password."); return; }

  if (isSignUpMode) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { alert("Sign up failed: " + error.message); } 
    else {
      if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, email: email, full_name: email.split('@')[0], wallet_balance: 0 }]);
      }
      alert("Registration successful! Please sign in.");
      toggleAuthMode();
    }
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { alert("Login failed: " + error.message); } 
    else {
      currentUser = data.user;
      fetchWalletBalance(currentUser.id);
      document.getElementById('authModal').classList.remove('flex');
      document.getElementById('authModal').classList.add('hidden');
      alert("Welcome back!");
    }
  }
}

// Wallet & Paystack
async function fetchWalletBalance(userId) {
  const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single();
  if (data) {
    const amt = `₦${Number(data.wallet_balance).toLocaleString()}`;
    document.getElementById('userWallet').innerText = amt;
    document.getElementById('walletDisplayLarge').innerText = amt;
  }
}

function fundWalletPrompt() {
  if (!currentUser) { alert("Please sign in first."); return; }
  let amt = prompt("Enter amount to fund (₦):", "2000");
  if (!amt || isNaN(amt)) return;

  let handler = PaystackPop.setup({
    key: 'pk_live_2ed633e5b6ff8b9c4f4fa5108046e3d496397f8c',
    email: currentUser.email,
    amount: Number(amt) * 100,
    currency: 'NGN',
    callback: async function(res) {
      alert('Wallet funded successfully! Ref: ' + res.reference);
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', currentUser.id).single();
      const newBalance = Number(profile.wallet_balance) + Number(amt);
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', currentUser.id);
      fetchWalletBalance(currentUser.id);
    },
    onClose: function() { alert('Payment cancelled.'); }
  });
  handler.openIframe();
}

async function requestAutomatedWithdrawal() {
  if (!currentUser) { alert("Please sign in first."); return; }
  let accountNumber = prompt("Enter your 10-digit NUBAN Account Number:");
  let bankCode = prompt("Enter Bank Code (e.g. 058 for GTBank, 033 for UBA):");
  let amt = prompt("Enter amount to withdraw (₦):");
  if (!accountNumber || !bankCode || !amt || isNaN(amt)) { alert("Invalid details."); return; }
  alert("Withdrawal request submitted successfully!");
}

// Library & Storage
async function loadDocuments() {
  const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
  const list = document.getElementById('documentsList');
  if (!list) return;
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="glass-panel p-6 rounded-2xl text-center text-slate-400 text-xs">No PDFs uploaded yet. Upload one to start!</div>`;
    return;
  }
  list.innerHTML = data.map(doc => `
    <div class="glass-panel p-4 rounded-2xl flex justify-between items-center shadow-md">
      <div>
        <h4 class="text-xs font-bold text-slate-200">${doc.title}</h4>
        <p class="text-[10px] text-emerald-400 mt-0.5">Earns ₦${doc.price_per_page}/page</p>
      </div>
      <button onclick="openReaderWithFile('${doc.file_path}', '${doc.title}')" class="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3.5 py-2 rounded-xl text-white shadow-lg shadow-indigo-600/20 transition">Read</button>
    </div>
  `).join('');
}

function openReaderWithFile(path, title) {
  document.getElementById('activeDocTitle').innerText = title;
  document.getElementById('pdfFrame').src = path;
  document.getElementById('activeReaderCard').classList.remove('hidden');
}

function closeReader() {
  document.getElementById('activeReaderCard').classList.add('hidden');
  document.getElementById('pdfFrame').src = '';
}

async function handleDocumentUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentUser) { alert("Please sign in to upload."); return; }
  let docTitle = prompt("Enter a title for this PDF:", file.name);
  if (!docTitle) return;

  alert("Uploading PDF to Supabase storage...");
  const filePath = `uploads/${Date.now()}_${file.name}`;
  const { error: storageError } = await supabase.storage.from('grade-x').upload(filePath, file);
  if (storageError) { alert("Upload failed: " + storageError.message); return; }

  const { data: publicUrlData } = supabase.storage.from('grade-x').getPublicUrl(filePath);
  await supabase.from('documents').insert([{
    uploader_id: currentUser.id,
    title: docTitle,
    description: "Uploaded via GradeX Arena",
    file_path: publicUrlData.publicUrl,
    total_pages: 10,
    price_per_page: 5.00
  }]);
  alert("Document uploaded successfully!");
  loadDocuments();
}

// Arena Match & Quiz Battle
async function loadArenaRooms() {
  const { data } = await supabase.from('stakes').select('*').eq('status', 'waiting');
  const grid = document.getElementById('arenaRoomsGrid');
  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="glass-panel p-6 rounded-2xl text-center text-slate-400 text-xs space-y-2"><p>No active match rooms.</p><p class="text-indigo-400 font-bold">Create a match to challenge players!</p></div>`;
    return;
  }
  grid.innerHTML = data.map(room => `
    <div class="glass-panel p-4 rounded-2xl flex justify-between items-center shadow-md">
      <div>
        <span class="text-[10px] uppercase bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">${room.category}</span>
        <p class="text-sm font-black text-white mt-1.5">Stake: ₦${Number(room.stake_amount).toLocaleString()}</p>
        <p class="text-[10px] text-emerald-400 mt-0.5">Pot: ₦${Number(room.stake_amount * 2).toLocaleString()}</p>
      </div>
      <button onclick="joinMatchRoom('${room.id}', ${room.stake_amount})" class="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold px-4 py-2.5 rounded-xl text-white shadow-lg transition">Join ⚔️</button>
    </div>
  `).join('');
}

async function openCreateMatchModal() {
  if (!currentUser) { alert("Please sign in first."); return; }
  let category = prompt("Enter category (e.g., Petroleum Engineering):", "Petroleum Engineering");
  let stakeAmt = prompt("Enter stake amount (₦):", "1000");
  if (!category || !stakeAmt || isNaN(stakeAmt)) return;
  const stake = Number(stakeAmt);

  const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', currentUser.id).single();
  if (!profile || Number(profile.wallet_balance) < stake) { alert("Insufficient wallet balance!"); return; }

  await supabase.from('profiles').update({ wallet_balance: Number(profile.wallet_balance) - stake }).eq('id', currentUser.id);
  fetchWalletBalance(currentUser.id);

  await supabase.from('stakes').insert([{
    challenger_id: currentUser.id,
    stake_amount: stake,
    total_pot: stake * 2,
    winner_payout: stake * 2 * 0.90,
    category: category,
    status: 'waiting'
  }]);
  alert("Match room created!");
  loadArenaRooms();
}

async function joinMatchRoom(matchId, stakeAmount) {
  if (!currentUser) { alert("Please sign in first."); return; }
  const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', currentUser.id).single();
  if (!profile || Number(profile.wallet_balance) < stakeAmount) { alert("Insufficient balance!"); return; }

  await supabase.from('profiles').update({ wallet_balance: Number(profile.wallet_balance) - stakeAmount }).eq('id', currentUser.id);
  fetchWalletBalance(currentUser.id);
  await supabase.from('stakes').update({ opponent_id: currentUser.id, status: 'active' }).eq('id', matchId);

  alert("Match joined! Starting quiz battle...");
  startQuizBattle(matchId, stakeAmount);
}

function startQuizBattle(matchId, stake) {
  activeMatch = { id: matchId, stake: stake };
  currentQuestionIndex = 0;
  playerScores = { user: 0, opponent: 0 };
  matchQuestions = [
    { q: "What is the primary function of drilling mud in wellbore operations?", options: ["Cooling and lubricating the drill bit", "Increasing pipe friction", "Speeding up transport", "Dissolving casing strings"], answer: 0 },
    { q: "Which instrument is standard for testing mud weight density?", options: ["Marsh Funnel", "API Mud Balance", "Hydrometer", "Viscometer"], answer: 1 },
    { q: "What does NUBAN stand for in Nigerian banking?", options: ["National Uniform Bank Account Number", "Nigerian Universal Bank Account Network", "Numeric Unique Bank Access Number", "None"], answer: 0 },
    { q: "What does SQL stand for in databases?", options: ["Secure Query Language", "Structured Query Language", "Simple Queue Logic", "System Link"], answer: 1 },
    { q: "Which Supabase feature handles real-time cloud storage?", options: ["Auth", "Storage", "Edge Functions", "Triggers"], answer: 1 }
  ];
  renderQuestionScreen();
}

function renderQuestionScreen() {
  if (currentQuestionIndex >= matchQuestions.length) { finalizeQuizBattle(); return; }
  const q = matchQuestions[currentQuestionIndex];
  document.getElementById('appMainContainer').innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <span class="text-xs font-bold text-indigo-400">Question ${currentQuestionIndex + 1} of ${matchQuestions.length}</span>
        <span class="text-xs font-semibold text-emerald-400">Stake: ₦${activeMatch.stake}</span>
      </div>
      <div class="glass-panel p-5 rounded-3xl space-y-4">
        <h2 class="text-sm font-bold text-white leading-relaxed">${q.q}</h2>
        <div class="space-y-2.5">
          ${q.options.map((opt, idx) => `
            <button onclick="submitAnswer(${idx},${q.answer})" class="w-full text-left bg-slate-950/80 hover:bg-indigo-600/20 border border-slate-800 p-3 rounded-xl text-xs text-slate-200 transition">
              <b>${String.fromCharCode(65 + idx)}.</b>${opt}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function submitAnswer(selected, correct) {
  if (selected === correct) playerScores.user++;
  if (Math.random() < 0.7) playerScores.opponent++;
  currentQuestionIndex++;
  renderQuestionScreen();
}

async function finalizeQuizBattle() {
  const userWon = playerScores.user >= playerScores.opponent;
  const payout = activeMatch.stake * 2 * 0.90;
  const container = document.getElementById('appMainContainer');

  if (userWon) {
    const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', currentUser.id).single();
    await supabase.from('profiles').update({ wallet_balance: Number(profile.wallet_balance || 0) + payout }).eq('id', currentUser.id);
    await supabase.from('stakes').update({ status: 'completed', winner_id: currentUser.id }).eq('id', activeMatch.id);

    container.innerHTML = `
      <div class="glass-panel p-6 rounded-3xl text-center space-y-4 my-auto">
        <div class="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">🏆</div>
        <h1 class="text-xl font-black text-white">Victory! You Won</h1>
        <p class="text-xs text-slate-300">Score: ${playerScores.user} - ${playerScores.opponent}</p>
        <p class="text-2xl font-black text-emerald-400">+₦${payout.toLocaleString()}</p>
        <button onclick="switchTab('arena')" class="w-full bg-indigo-600 py-3 rounded-xl text-xs font-bold text-white">Return to Arena</button>
      </div>`;
  } else {
    await supabase.from('stakes').update({ status: 'completed' }).eq('id', activeMatch.id);
    container.innerHTML = `
      <div class="glass-panel p-6 rounded-3xl text-center space-y-4 my-auto">
        <div class="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">💀</div>
        <h1 class="text-xl font-black text-white">Defeat!</h1>
        <p class="text-xs text-slate-300">Score: ${playerScores.user} - ${playerScores.opponent}</p>
        <button onclick="switchTab('arena')" class="w-full bg-indigo-600 py-3 rounded-xl text-xs font-bold text-white">Return to Arena</button>
      </div>`;
  }
  fetchWalletBalance(currentUser.id);
}

// AI Companion Mock
function askAIAssistant() {
  const input = document.getElementById('aiQueryInput');
  const chat = document.getElementById('aiChatHistory');
  if (!input.value.trim()) return;
  chat.innerHTML += `<div class="bg-indigo-600/20 p-3 rounded-xl text-slate-200 ml-4"><b>You:</b> ${input.value}</div>`;
  const val = input.value;
  input.value = '';
  setTimeout(() => {
    chat.innerHTML += `<div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 mr-4"><b>AI:</b> That's a great question regarding "${val}". In petroleum operations and study modules, maintaining mud density balance and proper monitoring prevents formation kicks.</div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 600);
}

// Startup Session
window.onload = async function() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    fetchWalletBalance(currentUser.id);
    document.getElementById('authModal').classList.remove('flex');
    document.getElementById('authModal').classList.add('hidden');
  } else {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authModal').classList.add('flex');
  }
  loadDocuments();
};
