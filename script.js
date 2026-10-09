// Supabase Project Credentials
const SUPABASE_URL = 'https://lbolsipvlxuoeorhwmte.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxib2xzaXB2bHh1b2Vvcmh3bXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODk5NzMsImV4cCI6MjEwNjk2NTk3M30.y89bLPoLfPncp82bOcwFhjangVupBB_MpsH6qfWyezA';

document.addEventListener('DOMContentLoaded', () => {
    const libraryMarketList = document.getElementById('library-market-list');
    const aiLibrarySelect = document.getElementById('ai-library-select');
    const generateBtn = document.getElementById('generate-ai-btn');
    const outputArea = document.getElementById('ai-output-area');

    const publishBtn = document.querySelector('.card-creator .btn-accent') || document.querySelector('button[style*="background"]');
    const courseInput = document.querySelector('.card-creator input[type="text"]');
    const fileInput = document.getElementById('file-upload') || document.querySelector('input[type="file"]');

    // Sync Library Market items into the AI dropdown
    function syncLibraryMarketToAI() {
        if (!libraryMarketList || !aiLibrarySelect) return;
        const marketItems = libraryMarketList.querySelectorAll('.market-item, div');
        aiLibrarySelect.innerHTML = `<option value="" disabled selected>-- Select from Library Market --</option>`;
        marketItems.forEach((item) => {
            const text = item.textContent.trim();
            if (text && text !== "No assets listed yet" && text !== "Cloud Live" && !text.includes("Download")) {
                let exists = Array.from(aiLibrarySelect.options).some(opt => opt.value === text);
                if (!exists) {
                    const option = document.createElement('option');
                    option.value = text;
                    option.textContent = text;
                    aiLibrarySelect.appendChild(option);
                }
            }
        });
    }

    syncLibraryMarketToAI();

    // Handle Publish Asset & Storage Upload
    if (publishBtn) {
        publishBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const courseCode = courseInput ? courseInput.value.trim() : '';
            const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

            if (!courseCode && !file) {
                alert('Oga, please enter a course code or choose a PDF file first!');
                return;
            }

            let filePublicUrl = '';
            let assetTitle = courseCode || (file ? file.name : 'Untitled Asset');

            // Uploading file directly to your Supabase bucket: CampusCBT-library
            if (file) {
                const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                
                try {
                    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/CampusCBT-library/${fileName}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': file.type
                        },
                        body: file
                    });

                    if (uploadResponse.ok) {
                        filePublicUrl = `${SUPABASE_URL}/storage/v1/object/public/CampusCBT-library/${fileName}`;
                    } else {
                        console.error('Storage upload failed');
                        alert('Cloud upload failed, but saving locally!');
                    }
                } catch (err) {
                    console.error('Upload error:', err);
                }
            }

            if (libraryMarketList && (libraryMarketList.classList.contains('empty-state') || libraryMarketList.innerText.includes('No assets'))) {
                libraryMarketList.innerHTML = '';
                libraryMarketList.classList.remove('empty-state');
            }

            if (libraryMarketList) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'market-item';
                itemDiv.style.cssText = 'background: #0f172a; border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';
                itemDiv.innerHTML = `
                    <div>
                        <span style="color: var(--text-main); font-size: 0.8rem;">📚 <strong>${assetTitle}</strong></span>
                        ${filePublicUrl ? `<br><a href="${filePublicUrl}" target="_blank" style="font-size: 0.65rem; color: var(--accent-blue); text-decoration: underline;">📥 Download / Read PDF</a>` : ''}
                    </div>
                    <span style="color: var(--accent-green); font-size: 0.65rem;">Cloud Live</span>
                `;
                libraryMarketList.appendChild(itemDiv);
            }

            syncLibraryMarketToAI();

            if (courseInput) courseInput.value = '';
            if (fileInput) fileInput.value = '';

            alert('Asset uploaded to Supabase Storage & published successfully, Oga!');
        });
    }

    // AI Generation Trigger using Supabase Backend (`swift-task`)
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const selectedLib = aiLibrarySelect.value;
            
            if (!selectedLib) {
                outputArea.innerHTML = `<p style="color: #ef4444; font-size: 0.75rem;">Oga, please select a document from the library market first!</p>`;
                return;
            }

            outputArea.innerHTML = `
                <div style="background: #0f172a; border: 1px dashed var(--accent-blue); border-radius: 8px; padding: 10px; text-align: center;">
                    <p style="color: var(--accent-blue); font-size: 0.75rem; margin: 0;">⚡ Supabase AI is analyzing <strong>${selectedLib}</strong>...</p>
                </div>
            `;

            try {
                const response = await fetch('https://lbolsipvlxuoeorhwmte.supabase.co/functions/v1/swift-task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ libTitle: selectedLib })
                });

                const data = await response.json();
                
                const aiResponseText = data.candidates && data.candidates[0].content.parts[0].text 
                    ? data.candidates[0].content.parts[0].text 
                    : "Could not generate questions at this time.";

                outputArea.innerHTML = `
                    <div style="background: #0f172a; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 0.7rem; color: var(--accent-green); font-weight: bold;">✔ Supabase Secure Generation</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">Gemini-1.5-flash</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-main); white-space: pre-line; margin: 6px 0;">
                            ${aiResponseText}
                        </div>
                        <button id="launch-cbt-btn" class="btn btn-success btn-sm" style="width: 100%; margin-top: 8px;">Launch CBT Exam</button>
                    </div>
                `;

            } catch (error) {
                console.error("Supabase Error:", error);
                outputArea.innerHTML = `<p style="color: #ef4444; font-size: 0.75rem;">Could not connect to Supabase backend, Oga!</p>`;
            }
        });
    }
});
// Payment Gateway Live Public Key
const PAYMENT_PUBLIC_KEY = 'pk_live_2ed633e5b6ff8b9c4f4fa5108046e3d496397f8c';

document.addEventListener('DOMContentLoaded', () => {
    const balanceDisplay = document.querySelector('.balance-box h2, .card-wallet h2');

    function getCurrentBalance() {
        if (!balanceDisplay) return 100;
        const text = balanceDisplay.textContent.replace(/[^0-9]/g, '');
        return parseInt(text) || 100;
    }

    function updateBalance(newAmount) {
        if (balanceDisplay) {
            balanceDisplay.innerHTML = `${newAmount} <small>GX</small>`;
        }
    }

    const allButtons = document.querySelectorAll('.card-wallet button');
    const depBtn = Array.from(allButtons).find(el => el.textContent.includes('Deposit')) || document.getElementById('deposit-btn');
    const wthBtn = Array.from(allButtons).find(el => el.textContent.includes('Withdraw')) || document.getElementById('withdraw-btn');

    if (depBtn) {
        depBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const amountStr = prompt('Oga, enter amount to deposit (in Naira):', '1000');
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
                    let currentBal = getCurrentBalance();
                    let addedGX = Math.floor(amount / 10);
                    updateBalance(currentBal + addedGX);
                },
                onClose: function() {
                    alert('Transaction window closed.');
                }
            });
            handler.openIframe();
        });
    }

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
                alert('Oga, insufficient balance in your wallet!');
                return;
            }

            const bankAccount = prompt('Enter your 10-digit Bank Account Number:', '');
            const bankName = prompt('Enter Bank Name (e.g., Access, GTB, Opay):', '');

            if (!bankAccount || !bankName) {
                alert('Bank details are required for withdrawal.');
                return;
            }

            updateBalance(currentBal - withdrawAmount);
            alert(`Withdrawal request of ${withdrawAmount} GX to ${bankName} (${bankAccount}) submitted successfully, Oga!`);
        });
    }
});
