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

// Tab Switching Logic
function switchTab(tabId) {
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.style.color = 'var(--text-muted)');

    const targetView = document.getElementById(tabId + '-view');
    if (targetView) targetView.classList.add('active');
}

// Monitor Auth State & Sync Profile / Online Status
auth.onAuthStateChanged(async (user) => {
    const authModal = document.getElementById('auth-modal');
    if (user) {
        if (authModal) authModal.style.display = 'none';
        switchTab('profile');

        const username = user.email.split('@')[0];
        const displayName = username.charAt(0).toUpperCase() + username.slice(1);

        const displayNameEl = document.getElementById('display-name');
        if (displayNameEl) displayNameEl.textContent = displayName;

        const userRef = db.collection('users').doc(user.uid);
        await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        window.addEventListener('beforeunload', () => {
            userRef.update({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
        });

        loadCadetsDirectory(user.uid);
    } else {
        if (authModal) authModal.style.display = 'flex';
    }
});

// Auth Toggle & Execution
let isLoginMode = true;
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('auth-toggle-mode');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            document.getElementById('auth-title').innerHTML = isLoginMode ? '<span style="color: var(--accent-yellow);">🔐</span> Login' : '<span style="color: var(--accent-yellow);">📝</span> Register';
            document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Sign In' : 'Create Account';
            toggleBtn.innerText = isLoginMode ? "Don't have an account? Register" : 'Already have an account? Sign In';
        });
    }

    const actionBtn = document.getElementById('auth-action-btn');
    if (actionBtn) {
        actionBtn.addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            if (!email || !password) {
                alert('Please enter email and password.');
                return;
            }
            try {
                if (isLoginMode) {
                    await auth.signInWithEmailAndPassword(email, password);
                } else {
                    await auth.createUserWithEmailAndPassword(email, password);
                }
                document.getElementById('auth-modal').style.display = 'none';
            } catch (error) {
                alert('Auth failed: ' + error.message);
            }
        });
    }

    loadLibraryMarket();
    loadCommunityFeed();
});

// File Upload & Publish to Firestore (Persists on Refresh)
const fileInput = document.getElementById('file-upload');
const chooseFileLabel = document.querySelector('label[for="file-upload"]');
if (fileInput && chooseFileLabel) {
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            chooseFileLabel.textContent = `Selected: ${fileInput.files[0].name}`;
            chooseFileLabel.style.color = '#22c55e';
        }
    });
}

const publishBtn = document.querySelector('.card-creator .btn-accent');
const courseInput = document.querySelector('.card-creator input[type="text"]');

if (publishBtn) {
    publishBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const courseCode = courseInput ? courseInput.value.trim() : '';
        const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;
        const currentUser = auth.currentUser;

        if (!courseCode || !file) {
            alert('Enter course code and choose a PDF file, Oga!');
            return;
        }

        alert('Publishing asset to Firestore market...');
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function () {
            await db.collection('library_market').add({
                courseCode: courseCode,
                fileName: file.name,
                fileData: reader.result,
                publisherEmail: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Asset published successfully, Oga!');
            courseInput.value = '';
            chooseFileLabel.textContent = 'Choose PDF File';
            chooseFileLabel.style.color = 'var(--text-main)';
        };
    });
}

// Load Library Market
function loadLibraryMarket() {
    const listEl = document.getElementById('library-market-list');
    if (!listEl) return;

    db.collection('library_market').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        listEl.innerHTML = '';
        if (snapshot.empty) {
            listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.75rem;">- No assets listed yet</p>';
            return;
        }
        snapshot.forEach((doc) => {
            const item = doc.data();
            const div = document.createElement('div');
            div.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 10px; margin-bottom: 6px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `
                <span style="font-size: 0.75rem; color: var(--text-main);"><strong>${item.courseCode}</strong> (${item.fileName})<br><span style="font-size: 0.6rem; color: var(--text-muted);">By: ${item.publisherEmail}</span></span>
                <div style="display: flex; gap: 4px;">
                    <button onclick="readBookInApp('${encodeURIComponent(item.fileData)}', '${item.courseCode}')" style="background: var(--accent-purple); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; cursor: pointer;">Read</button>
                    <a href="${item.fileData}" download="${item.fileName}" style="color: #38bdf8; font-size: 0.65rem; align-self: center;">Download</a>
                </div>
            `;
            listEl.appendChild(div);
        });
    });
}

// In-App Reader Modal
function readBookInApp(base64Data, title) {
    let modal = document.getElementById('in-app-reader-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'in-app-reader-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 30000; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="color: white; font-size: 0.85rem; margin: 0;">📖 ${title}</h3>
            <button onclick="document.getElementById('in-app-reader-modal').style.display='none'" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; cursor: pointer;">Close</button>
        </div>
        <div style="flex: 1; background: white; border-radius: 6px; overflow: hidden;">
            <iframe src="${decodeURIComponent(base64Data)}" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
    `;
    modal.style.display = 'flex';
}

// GradeBot AI Chat
async function sendGradeBotMessage() {
    const input = document.getElementById('gradebot-input');
    const container = document.getElementById('gradebot-chat-container');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;

    const userBubble = document.createElement('div');
    userBubble.style.cssText = 'background: var(--accent-purple); color: white; padding: 8px; border-radius: 6px; max-width: 85%; align-self: flex-end; font-size: 0.75rem;';
    userBubble.textContent = msg;
    container.appendChild(userBubble);
    input.value = '';
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch('https://ibolpsixuxoeorhwmhte.supabase.co/functions/v1/swift-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg })
        });
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't answer that right now, Cadet.";

        const botBubble = document.createElement('div');
        botBubble.style.cssText = 'background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px; border-radius: 6px; max-width: 85%; align-self: flex-start; font-size: 0.75rem;';
        botBubble.textContent = reply;
        container.appendChild(botBubble);
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        alert('AI connection error.');
    }
}

// Community Feed
async function publishCommunityPost() {
    const input = document.getElementById('community-post-input');
    const content = input ? input.value.trim() : '';
    const user = auth.currentUser;
    if (!content || !user) {
        alert('Write something and ensure you are logged in, Oga!');
        return;
    }
    await db.collection('community_posts').add({
        author: user.email.split('@')[0],
        content: content,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    alert('Posted successfully!');
}

function loadCommunityFeed() {
    const feed = document.getElementById('community-feed-list');
    if (!feed) return;
    db.collection('community_posts').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        feed.innerHTML = '';
        if (snapshot.empty) {
            feed.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">No community posts yet.</p>';
            return;
        }
        snapshot.forEach((doc) => {
            const p = doc.data();
            const div = document.createElement('div');
            div.style.cssText = 'background: var(--card-bg); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px;';
            div.innerHTML = `<strong style="font-size: 0.75rem; color: var(--accent-purple);">${p.author}</strong><p style="font-size: 0.75rem; color: var(--text-main); margin: 4px 0 0 0;">${p.content}</p>`;
            feed.appendChild(div);
        });
    });
}

// Cadets Directory
function loadCadetsDirectory(currentUserId) {
    const list = document.getElementById('cadets-list');
    if (!list) return;
    db.collection('users').onSnapshot((snapshot) => {
        list.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            if (user.uid === currentUserId) return;
            const div = document.createElement('div');
            div.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `<span style="font-size: 0.75rem;">${user.displayName} <br><span style="font-size: 0.6rem; color: ${user.online ? '#22c55e' : '#64748b'};">● ${user.online ? 'Online' : 'Offline'}</span></span><button onclick="alert('Friend request sent!')" style="font-size: 0.65rem; padding: 4px 8px;">Add</button>`;
            list.appendChild(div);
        });
    });
}

// Profile & Signout Helpers
function toggleEditProfile() {
    const name = prompt('Enter new display name:');
    if (name) document.getElementById('display-name').textContent = name;
}

async function signOutUser() {
    await auth.signOut();
    location.reload();
}
// Toggle Slide-Out Sidebar Drawer
function toggleSidebar() {
    const drawer = document.getElementById('sidebar-drawer');
    if (drawer) {
        drawer.style.left = drawer.style.left === '0px' ? '-280px' : '0px';
    }
}
