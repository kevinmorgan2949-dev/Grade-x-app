// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyAKbQaiTWkpnjQ5OYNKuHBT_UB7xXhhx_A",
  authDomain: "studio-5048925414-4748e.firebaseapp.com",
  projectId: "studio-5048925414-4748e",
  storageBucket: "studio-5048925414-4748e.firebasestorage.app",
  messagingSenderId: "933916912009",
  appId: "1:933916912009:web:39731845c3824c89af1958"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    const libraryMarketList = document.getElementById('library-market-list');
    const aiLibrarySelect = document.getElementById('ai-library-select');
    const generateBtn = document.getElementById('generate-ai-btn');
    const outputArea = document.getElementById('ai-output-area');

    const publishBtn = document.querySelector('.card-creator .btn-accent') || document.querySelector('button[style*="background"]');
    const courseInput = document.querySelector('.card-creator input[type="text"]');
    const fileInput = document.getElementById('file-upload') || document.querySelector('input[type="file"]');

    // Sync Library Market Items into the AI dropdown
    function syncLibraryMarketToAI() {
        if (!libraryMarketList) return;
        const marketItems = libraryMarketList.querySelectorAll('.market-item');
        
        if (!aiLibrarySelect) return;
        aiLibrarySelect.innerHTML = '<option value="" disabled selected>-- Select from Library Market --</option>';
        
        marketItems.forEach(item => {
            const text = item.textContent.trim();
            if (text !== "No assets listed yet" && !text.includes("Cloud Live") && text.includes("Download")) {
                const exists = Array.from(aiLibrarySelect.options).some(opt => opt.value === text);
                if (!exists) {
                    const option = document.createElement('option');
                    option.value = text;
                    option.textContent = text;
                    aiLibrarySelect.appendChild(option);
                }
            }
        });
    }

    // Handle Publish Asset & Storage Upload
    if (publishBtn) {
        publishBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const courseCode = courseInput ? courseInput.value.trim() : '';
            const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

            if (!courseCode || !file) {
                alert('Oga, please enter a course code or choose a PDF file first!');
                return;
            }

            let filePublicUrl = '';
            let assetTitle = courseCode + ' (' + file.name + ' - Untitled Asset)';

            // Upload fallback or local storage simulation
            try {
                // Asset publishing simulation locally if storage bucket isn't configured yet
                filePublicUrl = URL.createObjectURL(file);
                
                if (libraryMarketList) {
                    if (libraryMarketList.classList.contains('empty-state')) {
                        libraryMarketList.classList.remove('empty-state');
                        libraryMarketList.innerHTML = '';
                    }

                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'market-item';
                    itemDiv.style.cssText = 'background: #0f172a; border: 1px solid var(--border-color); padding: 10px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
                    itemDiv.innerHTML = `
                        <span style="color: var(--text-main); font-size: 0.8rem;">
                            <strong>${assetTitle}</strong><br>
                            <a href="${filePublicUrl}" target="_blank" style="font-size: 0.65rem; color: var(--accent-blue); text-decoration: underline;">Download / Read PDF</a>
                        </span>
                        <span style="color: var(--accent-green); font-size: 0.7rem;">Cloud Live</span>
                    `;
                    libraryMarketList.appendChild(itemDiv);
                    syncLibraryMarketToAI();
                }

                alert('Asset uploaded & published successfully, Oga!');
            } catch (err) {
                console.error('Upload error:', err);
                alert('Could not upload file, but saved locally.');
            }
        });
    }

    // AI Generation Trigger using Firebase / Backend
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const selectedLib = aiLibrarySelect.value;

            if (!selectedLib) {
                outputArea.innerHTML = '<p style="color: #ef4444; font-size: 0.75rem;">Oga, please select a document from the library market first!</p>';
                return;
            }

            outputArea.innerHTML = `
                <div style="background: #0f172a; border: 1px dashed var(--accent-blue); border-radius: 8px; padding: 10px; text-align: center;">
                    <p style="color: var(--accent-blue); font-size: 0.75rem; margin: 0;">⚡ Supabase/Firebase AI is analyzing <strong>${selectedLib}</strong>...</p>
                </div>
            `;

            try {
                // Simulate AI CBT generation response
                setTimeout(() => {
                    outputArea.innerHTML = `
                        <div style="background: #0f172a; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; margin-top: 8px;">
                            <div style="display: flex; justifyContent: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 0.7rem; color: var(--accent-green); font-weight: bold;">⚡ Secure Generation</span>
                                <span style="font-size: 0.65rem; color: var(--text-muted);">Gemini-1.5-flash</span>
                            </div>
                            <p style="font-size: 0.75rem; color: var(--text-main); white-space: pre-line; margin: 6px 0;">Generated 5 practice CBT questions from your document successfully!</p>
                            <button id="launch-cbt-btn" class="btn btn-success btn-sm" style="width: 100%; margin-top: 8px; font-size: 0.75rem;">Launch CBT Exam</button>
                        </div>
                    `;
                }, 1500);
            } catch (error) {
                console.error('AI Error:', error);
                outputArea.innerHTML = `<p style="color: #ef4444; font-size: 0.75rem;">Could not connect to AI backend, Oga!</p>`;
            }
        });
    }
});

// Payment Gateway Live Public Key
const PAYMENT_PUBLIC_KEY = 'pk_live_2ed63e56fb89c4f4fa510846e3d496397fbc';

document.addEventListener('DOMContentLoaded', () => {
    const balanceH2 = document.getElementById('balance-h2');
    const depositBtn = document.getElementById('deposit-btn');
    const wthBtn = document.getElementById('withdraw-btn');

    function getCurrentBalance() {
        if (!balanceH2) return 100;
        const text = balanceH2.textContent.replace(/[^0-9]/g, '');
        return parseInt(text) || 100;
    }

    function updateBalance(newAmount) {
        if (balanceH2) {
            balanceH2.textContent = `${newAmount}GX`;
        }
    }

    // Deposit Handler via Paystack
    if (depositBtn) {
        depositBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const amountStr = prompt('Enter amount to deposit (Naira):', '1000');
            if (!amountStr) return;
            const amount = parseFloat(amountStr);

            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount!');
                return;
            }

            let handler = PaystackPop.setup({
                key: PAYMENT_PUBLIC_KEY,
                email: 'student@gradexarena.com',
                amount: amount * 100,
                currency: 'NGN',
                callback: function(response) {
                    alert('Deposit successful! Reference: ' + response.reference);
                    const currentBal = getCurrentBalance();
                    const addedGX = Math.floor(amount / 10);
                    updateBalance(currentBal + addedGX);
                },
                onClose: function() {
                    alert('Transaction window closed.');
                }
            });
            handler.openIframe();
        });
    }

    // Withdrawal Handler
    if (wthBtn) {
        wthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const withdrawAmountStr = prompt('Enter amount of GX to withdraw:', '500');
            if (!withdrawAmountStr) return;
            const withdrawAmount = parseInt(withdrawAmountStr);

            let currentBal = getCurrentBalance();

            if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
                alert('Please enter a valid withdrawal amount!');
                return;
            }

            if (withdrawAmount > currentBal) {
                alert(' insufficient balance in your wallet!');
                return;
            }

            const bankAccount = prompt('Enter your 10-digit Bank Account Number:');
            const bankName = prompt('Enter Bank Name (e.g. Access, Gtbank, Opay):');

            if (!bankAccount || !bankName) {
                alert('Bank details are required for withdrawal');
                return;
            }

            updateBalance(currentBal - withdrawAmount);
            alert(`Withdrawal request of ${withdrawAmount} GX to (${bankName} - ${bankAccount}) submitted successfully!`);
        });
    }
});

// Tab Switching Logic for 5 Views
function switchTab(tabId) {
    const views = document.querySelectorAll('.app-view');
    views.forEach(view => view.classList.remove('active'));

    const targetView = document.getElementById(tabId + '-view');
    if (targetView) {
        targetView.classList.add('active');
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
}

// Authentication & Session Logic with Firebase Auth
let isLoginMode = true;

document.addEventListener('DOMContentLoaded', () => {
    // Monitor Firebase Auth State
    auth.onAuthStateChanged((user) => {
        const authModal = document.getElementById('auth-modal');
        if (user) {
            if (authModal) authModal.style.display = 'none';
            switchTab('profile');
        } else {
            if (authModal) authModal.style.display = 'flex';
        }
    });

    // Toggle between Login and Registration modes
    const toggleBtn = document.getElementById('auth-toggle-mode');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            const authTitle = document.getElementById('auth-title');
            const authSubtitle = document.getElementById('auth-subtitle');
            const authActionBtn = document.getElementById('auth-action-btn');

            if (isLoginMode) {
                authTitle.innerHTML = '<span style="color: var(--accent-yellow);">🔐</span> login';
                authSubtitle.innerText = 'Sign in or create your account to sync your stats and wallet.';
                authActionBtn.innerText = 'Sign In';
                toggleBtn.innerText = "Don't have an account? Register";
            } else {
                authTitle.innerHTML = '<span style="color: var(--accent-yellow);">📝</span> Create Cadet Account';
                authSubtitle.innerText = 'Register to start staking, dueling, and publishing notes.';
                authActionBtn.innerText = 'Create Account & Send Verification';
                toggleBtn.innerText = 'Already have an account? Sign In';
            }
        });
    }

    // Handle Sign In / Registration Execution
    const actionBtn = document.getElementById('auth-action-btn');
    if (actionBtn) {
        actionBtn.addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value.trim();

            if (!email || !password) {
                alert('Please enter both email and password.');
                return;
            }

            if (isLoginMode) {
                // Login Logic using Firebase
                try {
                    await auth.signInWithEmailAndPassword(email, password);
                    alert('Welcome back, Cadet!');
                    document.getElementById('auth-modal').style.display = 'none';
                    switchTab('profile');
                } catch (error) {
                    alert('Login failed: ' + error.message);
                }
            } else {
                // Registration Logic using Firebase
                try {
                    await auth.createUserWithEmailAndPassword(email, password);
                    alert('Account created successfully!');
                    document.getElementById('auth-modal').style.display = 'none';
                } catch (error) {
                    alert('Registration failed: ' + error.message);
                }
            }
        });
    }
});
// Dynamic Profile Updater & Sign Out Handler
// Monitor Firebase Auth State & Sync Profile / Online Status
auth.onAuthStateChanged(async (user) => {
    const authModal = document.getElementById('auth-modal');
    if (user) {
        if (authModal) authModal.style.display = 'none';
        switchTab('profile');

        const username = user.email.split('@')[0];
        const displayName = username.charAt(0).toUpperCase() + username.slice(1);

        // Set dynamic cadet name and avatar
        const displayNameEl = document.getElementById('display-name');
        const avatarEl = document.getElementById('avatar-initials');
        if (displayNameEl) displayNameEl.textContent = displayName;
        if (avatarEl) avatarEl.textContent = username.substring(0, 2).toUpperCase();

        // Save/Update user profile and set online to true in Firestore
        const userRef = db.collection('users').doc(user.uid);
        await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Set offline status when user leaves or closes window
        window.addEventListener('beforeunload', () => {
            userRef.update({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
        });

        loadCadetsDirectory(user.uid);
    } else {
        if (authModal) authModal.style.display = 'flex';
    }
});

// Edit Profile Functionality
function toggleEditProfile() {
    const nameEl = document.getElementById('display-name');
    const avatarEl = document.getElementById('avatar-initials');
    const currentName = nameEl ? nameEl.textContent : 'Cadet';
    
    const newName = prompt('Enter your new display name:', currentName);
    if (newName && newName.trim() !== '') {
        nameEl.textContent = newName.trim();
        
        // Update initials dynamically
        const parts = newName.trim().split(' ');
        if (parts.length > 1 && avatarEl) {
            avatarEl.textContent = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (avatarEl) {
            avatarEl.textContent = newName.trim().substring(0, 2).toUpperCase();
        }
        alert('Profile updated successfully, Oga!');
    }
}

// Sign Out Functionality
async function signOutUser() {
    try {
        await auth.signOut();
        alert('Signed out successfully.');
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'flex';
    } catch (error) {
        alert('Error signing out: ' + error.message);
    }
}
// Load Cadets Directory
function loadCadetsDirectory(currentUserId) {
    const cadetsListEl = document.getElementById('cadets-list');
    if (!cadetsListEl) return;

    db.collection('users').onSnapshot((snapshot) => {
        cadetsListEl.innerHTML = '';
        
        if (snapshot.empty) {
            cadetsListEl.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-muted);">No other cadets found.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const cadet = doc.data();
            if (cadet.uid === currentUserId) return;

            const isOnline = cadet.online;
            const statusColor = isOnline ? '#22c55e' : '#64748b';
            const statusText = isOnline ? 'Online' : 'Offline';

            const cadetCard = document.createElement('div');
            cadetCard.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
            cadetCard.innerHTML = `
                <div>
                    <strong style="font-size: 0.8rem; color: var(--text-main);">${cadet.displayName}</strong><br>
                    <span style="font-size: 0.65rem; color: ${statusColor};">● ${statusText}</span>
                </div>
                <button onclick="addFriend('${cadet.uid}', '${cadet.displayName}')" class="btn btn-outline" style="font-size: 0.7rem; padding: 4px 8px;">Add Friend</button>
            `;
            cadetsListEl.appendChild(cadetCard);
        });
    });
}

// Add Friend Action
function addFriend(friendUid, friendName) {
    alert(`Friend request sent to ${friendName}, Oga!`);
}
