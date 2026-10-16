// ============================================
// GRADE X arena
// Application logic
// ============================================

// 1. SUPABASE CONNECTION

const SUPABASE_URL = "https://vkojdzbhautxwcujmjiu.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_tbsTO1TPgn5KDoynYC8szQ_w69EiGJc";

const BUCKET_NAME = "Grade-x";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// PDF.js worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


// ============================================
// 2. ELEMENTS
// ============================================

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");
const authToggle = document.getElementById("authToggle");
const authStatus = document.getElementById("authStatus");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const studentEmail = document.getElementById("studentEmail");
const signOutBtn = document.getElementById("signOutBtn");

const uploadForm = document.getElementById("uploadForm");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

const pdfList = document.getElementById("pdfList");
const searchPDF = document.getElementById("searchPDF");

const pdfReader = document.getElementById("pdfReader");
const readerTitle = document.getElementById("readerTitle");
const readerPages = document.getElementById("readerPages");
const closeReader = document.getElementById("closeReader");


// ============================================
// 3. APPLICATION STATE
// ============================================

let currentUser = null;
let isSigningUp = true;
let documents = [];
let currentPdfUrl = null;


// ============================================
// 4. HELPERS
// ============================================

function showMessage(element, message, isError = false) {
    element.textContent = message;

    element.style.color = isError
        ? "#fb7185"
        : "#4ade80";
}

function safeText(value) {
    return String(value ?? "");
}

function formatFileSize(bytes) {
    if (!bytes) return "PDF document";

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(0) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHTML(value) {
    return safeText(value).replace(/[&<>"']/g, function (char) {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[char];
    });
}


// ============================================
// 5. SIGN UP / SIGN IN
// ============================================

authToggle.addEventListener("click", function () {
    isSigningUp = !isSigningUp;

    authTitle.textContent = isSigningUp
        ? "Join GRADE X"
        : "Welcome Back";

    authMessage.textContent = isSigningUp
        ? "Create your student account to get started."
        : "Sign in to continue learning.";

    authSubmit.textContent = isSigningUp
        ? "Create Account"
        : "Sign In";

    authToggle.textContent = isSigningUp
        ? "Already have an account? Sign in"
        : "New student? Create an account";

    authStatus.textContent = "";
});


authForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    authSubmit.disabled = true;

    showMessage(
        authStatus,
        isSigningUp ? "Creating your account..." : "Signing you in..."
    );

    try {
        if (isSigningUp) {
            const { data, error } = await db.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            if (data.session) {
                showMessage(authStatus, "Account created successfully!");
            } else {
                showMessage(
                    authStatus,
                    "Account created! Check your email for the verification link. Sign in after verification."
                );
            }

        } else {
            const { error } = await db.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            showMessage(authStatus, "Login successful!");
        }

    } catch (error) {
        showMessage(authStatus, error.message, true);

    } finally {
        authSubmit.disabled = false;
    }
});


// ============================================
// 6. AUTHENTICATION STATE
// ============================================

async function updateAppSession(session) {
    currentUser = session?.user || null;

    if (!currentUser) {
        authSection.hidden = false;
        appSection.hidden = true;

        documents = [];
        pdfList.innerHTML = "";

        pdfReader.hidden = true;
        currentPdfUrl = null;

        return;
    }

    authSection.hidden = true;
    appSection.hidden = false;

    studentEmail.textContent =
        currentUser.email || "Student";

    await loadDocuments();
}


db.auth.onAuthStateChange(function (event, session) {
    setTimeout(function () {
        updateAppSession(session);
    }, 0);
});


async function restoreSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error("Session error:", error.message);
        return;
    }

    await updateAppSession(data.session);
}


signOutBtn.addEventListener("click", async function () {
    const { error } = await db.auth.signOut();

    if (error) {
        alert("Could not sign out: " + error.message);
    }
});


// ============================================
// 7. NAVIGATION
// ============================================

const navButtons = document.querySelectorAll(".nav-btn");

const pages = {
    library: document.getElementById("libraryPage"),
    bot: document.getElementById("botPage"),
    arena: document.getElementById("arenaPage"),
    wallet: document.getElementById("walletPage")
};


navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const pageName = button.dataset.page;

        navButtons.forEach(function (item) {
            item.classList.remove("active");
        });

        button.classList.add("active");

        Object.keys(pages).forEach(function (key) {
            pages[key].hidden = key !== pageName;
        });
    });
});


// ============================================
// 8. UPLOAD PDF TO SUPABASE STORAGE
// ============================================

uploadForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
        showMessage(uploadStatus, "Please sign in first.", true);
        return;
    }

    const title = document.getElementById("pdfTitle").value.trim();
    const subject = document.getElementById("pdfSubject").value;
    const description =
        document.getElementById("pdfDescription").value.trim();

    const fileInput = document.getElementById("pdfFile");
    const file = fileInput.files[0];

    if (!file) {
        showMessage(uploadStatus, "Choose a PDF file first.", true);
        return;
    }

    const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
        showMessage(uploadStatus, "Only PDF files are allowed.", true);
        return;
    }

    // Prevent excessively large uploads on mobile.
    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
        showMessage(
            uploadStatus,
            "This file is over 20 MB. Please choose a smaller PDF.",
            true
        );
        return;
    }

    uploadBtn.disabled = true;

    let storagePath = null;
    let uploaded = false;

    showMessage(uploadStatus, "Uploading PDF to the cloud...");

    try {
        // Each student uploads into their own folder.
        const safeFileName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(-100);

        storagePath =
            currentUser.id +
            "/" +
            crypto.randomUUID() +
            "_" +
            safeFileName;

        // Upload the actual PDF file.
        const { error: uploadError } = await db.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) throw uploadError;

        uploaded = true;

        showMessage(
            uploadStatus,
            "File uploaded! Saving document details..."
        );

        // Save its details in the pdf_documents database table.
        const { error: recordError } = await db
            .from("pdf_documents")
            .insert({
                title: title,
                subject: subject,
                description: description,
                storage_path: storagePath,
                original_filename: file.name,
                file_size: file.size,
                uploader_id: currentUser.id,
                is_published: true
            });

        if (recordError) throw recordError;

        uploadForm.reset();

        showMessage(
            uploadStatus,
            "Success! Your PDF is now in the GRADE X Library."
        );

        await loadDocuments();

    } catch (error) {
        console.error("PDF upload error:", error);

        // If metadata saving fails after uploading the file,
        // try removing the unlisted file to avoid leaving an orphan.
        if (uploaded && storagePath) {
            const { error: cleanupError } = await db.storage
                .from(BUCKET_NAME)
                .remove([storagePath]);

            if (cleanupError) {
                console.error(
                    "Cleanup error:",
                    cleanupError.message
                );
            }
        }

        showMessage(
            uploadStatus,
            "Upload failed: " + error.message,
            true
        );

    } finally {
        uploadBtn.disabled = false;
    }
});


// ============================================
// 9. LOAD PDF LIBRARY
// ============================================

async function loadDocuments() {
    if (!currentUser) return;

    pdfList.innerHTML =
        '<div class="empty-state"><span>⏳</span><h3>Loading library...</h3></div>';

    try {
        const { data, error } = await db
            .from("pdf_documents")
            .select(
                "id, title, subject, description, storage_path, original_filename, file_size, uploader_id, created_at"
            )
            .eq("is_published", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        documents = data || [];

        renderDocuments();

    } catch (error) {
        console.error("Library error:", error);

        pdfList.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <h3>Library could not load</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// ============================================
// 10. DISPLAY DOCUMENTS
// ============================================

function renderDocuments() {    // Keep Grade Bot's PDF selector synced with the Library.
    if (botPDF) {
        const previousSelection = botPDF.value;
        
        botPDF.innerHTML =
            '<option value="">General questions (no PDF selected)</option>';
        
        documents.forEach(function(doc) {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = doc.title + " — " + doc.subject;
            botPDF.appendChild(option);
        });
        
        if (documents.some(function(doc) {
                return doc.id === previousSelection;
            })) {
            botPDF.value = previousSelection;
        }
    }
    const searchTerm = searchPDF.value.trim().toLowerCase();

    const filteredDocuments = documents.filter(function (doc) {
        return (
            safeText(doc.title).toLowerCase().includes(searchTerm) ||
            safeText(doc.subject).toLowerCase().includes(searchTerm) ||
            safeText(doc.description).toLowerCase().includes(searchTerm)
        );
    });

    if (!filteredDocuments.length) {
        pdfList.innerHTML = `
            <div class="empty-state">
                <span>📚</span>
                <h3>No documents found</h3>
                <p>Try another search or upload a learning resource.</p>
            </div>
        `;

        return;
    }

    pdfList.innerHTML = filteredDocuments.map(function (doc) {
        return `
            <article class="pdf-card">
                <div class="pdf-icon">📕</div>

                <h3>${escapeHTML(doc.title)}</h3>

                <p>📘 ${escapeHTML(doc.subject)}</p>

                <p>${escapeHTML(doc.description || "Study material")}</p>

                <p>${formatFileSize(doc.file_size)}</p>

                <div class="pdf-actions">
                    <button
                        class="secondary-btn"
                        data-action="read"
                        data-id="${escapeHTML(doc.id)}">
                        Read
                    </button>

                    <button
                        class="secondary-btn"
                        data-action="download"
                        data-id="${escapeHTML(doc.id)}">
                        Download
                    </button>
                </div>
            </article>
        `;
    }).join("");
}


searchPDF.addEventListener("input", renderDocuments);


// ============================================
// 11. GET A PUBLIC PDF URL
// ============================================

function getPublicPdfUrl(storagePath) {
    const { data } = db.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

    return data.publicUrl;
}


// ============================================
// 12. READ PDF
// ============================================

pdfList.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const documentId = button.dataset.id;
    const action = button.dataset.action;

    const doc = documents.find(function (item) {
        return item.id === documentId;
    });

    if (!doc) return;

    const url = getPublicPdfUrl(doc.storage_path);

    if (action === "download") {
        const link = document.createElement("a");

        link.href = url;
        link.download = doc.original_filename || "document.pdf";
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        document.body.appendChild(link);
        link.click();
        link.remove();

        return;
    }

    if (action === "read") {
        await openPdfReader(doc, url);
    }
});


async function openPdfReader(doc, url) {
    if (!window.pdfjsLib) {
        alert("The PDF reader could not load. Check your internet connection.");
        return;
    }

    currentPdfUrl = url;

    pdfReader.hidden = false;
    readerTitle.textContent = doc.title;

    readerPages.innerHTML =
        "<p>Loading PDF pages...</p>";

    pdfReader.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: url
        });

        const pdf = await loadingTask.promise;

        // Avoid rendering an older document if another was opened.
        if (currentPdfUrl !== url) return;

        readerPages.innerHTML = "";

        // Render the first 10 pages initially to protect mobile memory.
        const pagesToRender = Math.min(pdf.numPages, 10);

        for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber++) {
            if (currentPdfUrl !== url) return;

            const page = await pdf.getPage(pageNumber);

            const viewport = page.getViewport({ scale: 1.2 });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            canvas.setAttribute(
                "aria-label",
                "PDF page " + pageNumber
            );

            readerPages.appendChild(canvas);

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        }

        if (pdf.numPages > pagesToRender) {
            const note = document.createElement("p");

            note.textContent =
                "Showing the first 10 pages. Download the PDF to read the remaining " +
                (pdf.numPages - pagesToRender) +
                " pages.";

            readerPages.appendChild(note);
        }

    } catch (error) {
        console.error("PDF reader error:", error);

        readerPages.innerHTML = `
            <p>Unable to display this PDF inside the app.</p>
            <p>${escapeHTML(error.message)}</p>
            <a href="${escapeHTML(url)}"
               target="_blank"
               rel="noopener noreferrer">
               Open PDF in browser
            </a>
        `;
    }
}


closeReader.addEventListener("click", function () {
    currentPdfUrl = null;
    pdfReader.hidden = true;
    readerPages.innerHTML = "";
});


// ============================================
// 13. GRADE BOT — PLACEHOLDER
// ============================================

async function extractPdfText(doc) {
    if (!window.pdfjsLib) {
        throw new Error("PDF reader is unavailable. Please refresh the app.");
    }

    const url = getPublicPdfUrl(doc.storage_path);

    const loadingTask = pdfjsLib.getDocument({ url });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    const maxPages = Math.min(pdf.numPages, 30);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
            .map(function (item) {
                return item.str || "";
            })
            .join(" ");

        extractedText +=
            "\n[Page " + pageNumber + "]\n" + pageText;

        // Avoid sending excessively large PDFs to the AI.
        if (extractedText.length >= 24000) {
            extractedText = extractedText.slice(0, 24000);
            break;
        }
    }

    if (!extractedText.trim()) {
        throw new Error(
            "No selectable text was found in this PDF. It may be a scanned document."
        );
    }

    return extractedText;
}

async function extractPdfText(doc) {
    if (!window.pdfjsLib) {
        throw new Error("PDF reader is unavailable. Please refresh the app.");
    }

    const url = getPublicPdfUrl(doc.storage_path);

    const loadingTask = pdfjsLib.getDocument({ url });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    const maxPages = Math.min(pdf.numPages, 30);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
            .map(function (item) {
                return item.str || "";
            })
            .join(" ");

        extractedText +=
            "\n[Page " + pageNumber + "]\n" + pageText;

        // Avoid sending excessively large PDFs to the AI.
        if (extractedText.length >= 24000) {
            extractedText = extractedText.slice(0, 24000);
            break;
        }
    }

    if (!extractedText.trim()) {
        throw new Error(
            "No selectable text was found in this PDF. It may be a scanned document."
        );
    }

    return extractedText;
}
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const botPDF = document.getElementById("botPDF");
const botPDFStatus = document.getElementById("botPDFStatus");
chatForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const question = chatInput.value.trim();
    
    if (!question) return;
    
    const selectedPdfId = botPDF ? botPDF.value : "";
    const selectedPdf = documents.find(function (doc) {
        return doc.id === selectedPdfId;
    });

    let pdfContext = "";

    if (selectedPdf) {
        botPDFStatus.textContent = "Reading PDF...";
        botPDFStatus.style.color = "#36e4f5";

        try {
            pdfContext = await extractPdfText(selectedPdf);

            botPDFStatus.textContent =
                "Studying: " + selectedPdf.title;
        } catch (pdfError) {
            botPDFStatus.textContent =
                "Could not read PDF: " + pdfError.message;
            botPDFStatus.style.color = "#fb7185";
            return;
        }
    }

    
    // Display the student's message
    const userMessage = document.createElement("div");
    userMessage.className = "user-message";
    userMessage.textContent = question;
    
    chatMessages.appendChild(userMessage);
    
    // Display a temporary loading message
    const botMessage = document.createElement("div");
    botMessage.className = "bot-message";
    botMessage.textContent = "GRADE BOT is thinking... 🤖";
    
    chatMessages.appendChild(botMessage);
    
    chatInput.value = "";
    chatInput.disabled = true;
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Send the question to your Supabase Edge Function
        
const { data, error } = await db.functions.invoke("dynamic-function", {
    body: {
        question: question,
        pdfContext: pdfContext,
        pdfTitle: selectedPdf ? selectedPdf.title : ""
    }
});

        if (error) {
            console.error("GRADE BOT connection error:", error);
            throw new Error(
                "Couldn't connect to GRADE BOT. Please try again."
            );
        }
        
        if (!data || !data.answer) {
            throw new Error(
                data?.error || "GRADE BOT returned no answer."
            );
        }
        
        // Display the real AI answer
        botMessage.textContent = data.answer;
        
    } catch (error) {
        console.error("GRADE BOT error:", error);
        
        botMessage.textContent =
            error.message ||
            "GRADE BOT couldn't respond. Please try again.";
    } finally {
        chatInput.disabled = false;
        chatInput.focus();
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// ============================================
// 14. ARENA — FREE PRACTICE QUIZ
// ============================================

 quizQuestions = [
    {
        question: "What is the chemical symbol for water?",
        options: ["CO2", "H2O", "O2", "NaCl"],
        answer: 1
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Jupiter", "Mars", "Saturn"],
        answer: 2
    },
    {
        question: "What is 12 × 8?",
        options: ["86", "96", "108", "92"],
        answer: 1
    },
    {
        question: "Which gas do plants absorb during photosynthesis?",
        options: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"],
        answer: 3
    },
    {
        question: "What is the SI unit of force?",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        answer: 1
    },
    {
        question: "How many sides does a hexagon have?",
        options: ["Five", "Seven", "Six", "Eight"],
        answer: 2
    },
    {
        question: "What is the largest ocean on Earth?",
        options: [
            "Atlantic Ocean",
            "Indian Ocean",
            "Arctic Ocean",
            "Pacific Ocean"
        ],
        answer: 3
    },
    {
        question: "Which organ pumps blood around the human body?",
        options: ["Liver", "Heart", "Lungs", "Kidneys"],
        answer: 1
    },
    {
        question: "What is the approximate speed of light in a vacuum?",
        options: [
            "300,000 km/s",
            "30,000 km/s",
            "3,000 km/s",
            "150,000 km/s"
        ],
        answer: 0
    },
    {
        question: "What is the main natural source of energy for Earth?",
        options: ["The Moon", "The Sun", "Wind", "Coal"],
        answer: 1
    }
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const startQuiz = document.getElementById("startQuiz");
const quizArea = document.getElementById("quizArea");
const quizProgress = document.getElementById("quizProgress");
const quizconstion = document.getElementById("quizQuestion");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const nextQuestion = document.getElementById("nextQuestion");


startQuiz.addEventListener("click", function () {
    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;

    quizArea.hidden = false;
    startQuiz.hidden = true;

    showQuizQuestion();

    quizArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


function showQuizQuestion() {
    quizAnswered = false;

    const question = quizQuestions[quizIndex];

    quizProgress.textContent =
        "QUESTION " + (quizIndex + 1) +
        " OF " + quizQuestions.length;

    quizQuestion.textContent = question.question;

    quizOptions.innerHTML = "";

    quizFeedback.textContent = "";
    nextQuestion.hidden = true;

    question.options.forEach(function (option, index) {
        const button = document.createElement("button");

        button.className = "quiz-option";
        button.textContent = option;

        button.addEventListener("click", function () {
            answerQuizQuestion(index);
        });

        quizOptions.appendChild(button);
    });
}


function answerQuizQuestion(selectedIndex) {
    if (quizAnswered) return;

    quizAnswered = true;

    const question = quizQuestions[quizIndex];

    const buttons = quizOptions.querySelectorAll("button");

    buttons.forEach(function (button, index) {
        button.disabled = true;

        if (index === question.answer) {
            button.classList.add("correct");
        }
    });

    if (selectedIndex === question.answer) {
        quizScore++;

        quizFeedback.textContent = "Correct! Great job. 🎉";
        quizFeedback.style.color = "#4ade80";

    } else {
        buttons[selectedIndex].classList.add("incorrect");

        quizFeedback.textContent =
            "Not quite! The correct answer is: " +
            question.options[question.answer];

        quizFeedback.style.color = "#fb7185";
    }

    nextQuestion.hidden = false;

    nextQuestion.textContent =
        quizIndex === quizQuestions.length - 1
            ? "View Results"
            : "Next Question";
}


nextQuestion.addEventListener("click", function () {
    if (!quizAnswered) return;

    quizIndex++;

    if (quizIndex < quizQuestions.length) {
        showQuizQuestion();
        return;
    }

    quizProgress.textContent = "CHALLENGE COMPLETED";

    quizQuestion.textContent =
        "You scored " + quizScore +
        " out of " + quizQuestions.length + "!";

    quizOptions.innerHTML = "";

    quizFeedback.textContent =
        quizScore >= 8
            ? "Excellent work! 🏆"
            : quizScore >= 5
                ? "Good effort! Keep practising. 💪"
                : "Keep learning and try again! 📚";

    quizFeedback.style.color = "#36e4f5";

    nextQuestion.hidden = true;
    startQuiz.hidden = false;
    startQuiz.textContent = "Play Again";
});


// ============================================
// 15. START THE APP
// ============================================

restoreSession();

console.log("GRADE X application initialized.");