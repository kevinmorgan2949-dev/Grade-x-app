
/* ============================================
   GRADE X ARENA
   Application logic — repaired version
============================================ */

// 1. SUPABASE CONNECTION

const SUPABASE_URL = "https://vkojdzbhautxwcujmjiu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tbsTO1TPgn5KDoynYC8szQ_w69EiGJc";
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
let sessionUpdateInProgress = false;


// ============================================
// 4. HELPERS
// ============================================

function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#fb7185" : "#4ade80";
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

function getElement(id) {
    return document.getElementById(id);
}


// ============================================
// 5. SIGN UP / SIGN IN
// ============================================

if (authToggle) {
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

        if (authStatus) authStatus.textContent = "";
    });
}

if (authForm) {
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
                    password: password,
                    options: {
                        emailRedirectTo:
                            "https://kevinmorgan2949-dev.github.io/Grade-x-app/"
                    }
                });

                if (error) throw error;

                if (data.session) {
                    showMessage(
                        authStatus,
                        "Account created successfully!"
                    );
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
            showMessage(
                authStatus,
                error.message || "Authentication failed. Please try again.",
                true
            );
        } finally {
            authSubmit.disabled = false;
        }
    });
}


// ============================================
// 6. AUTHENTICATION STATE
// ============================================

async function updateAppSession(session) {
    currentUser = session?.user || null;

    if (!currentUser) {
        authSection.hidden = false;
        appSection.hidden = true;

        documents = [];

        if (pdfList) pdfList.innerHTML = "";

        if (pdfReader) pdfReader.hidden = true;

        currentPdfUrl = null;
        return;
    }

    authSection.hidden = true;
    appSection.hidden = false;

    if (studentEmail) {
        studentEmail.textContent = currentUser.email || "Student";
    }

    renderProfile();

    await loadDocuments();
}

db.auth.onAuthStateChange(function (event, session) {
    // Keep Supabase's auth callback from being blocked by other work.
    setTimeout(function () {
        updateAppSession(session).catch(function (error) {
            console.error("GRADE X session update error:", error);
        });
    }, 0);
});

async function restoreSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error("Session error:", error.message);
        showMessage(authStatus, error.message, true);
        return;
    }

    await updateAppSession(data.session);
}

if (signOutBtn) {
    signOutBtn.addEventListener("click", async function () {
        signOutBtn.disabled = true;

        try {
            const { error } = await db.auth.signOut();

            if (error) throw error;
        } catch (error) {
            alert("Could not sign out: " + error.message);
        } finally {
            signOutBtn.disabled = false;
        }
    });
}


// ============================================
// 7. NAVIGATION
// ============================================

const navButtons = document.querySelectorAll(".nav-btn");

const pages = {
    library: getElement("libraryPage"),
    bot: getElement("botPage"),
    arena: getElement("arenaPage"),
    wallet: getElement("walletPage"),
    comingSoon: getElement("comingSoonPage"),
    profile: getElement("profilePage")
};

navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const pageName = button.dataset.page;

        navButtons.forEach(function (item) {
            item.classList.remove("active");
        });

        button.classList.add("active");

        Object.keys(pages).forEach(function (key) {
            if (pages[key]) {
                pages[key].hidden = key !== pageName;
            }
        });
    });
});


// ============================================
// 8. UPLOAD PDF TO SUPABASE STORAGE
// ============================================

if (uploadForm) {
    uploadForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser) {
            showMessage(uploadStatus, "Please sign in first.", true);
            return;
        }

        const title = getElement("pdfTitle").value.trim();
        const subject = getElement("pdfSubject").value;
        const description =
            getElement("pdfDescription").value.trim();

        const fileInput = getElement("pdfFile");
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
            const safeFileName = file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_")
                .slice(-100);

            storagePath =
                currentUser.id +
                "/" +
                crypto.randomUUID() +
                "_" +
                safeFileName;

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
}


// ============================================
// 9. LOAD PDF LIBRARY
// ============================================

async function loadDocuments() {
    if (!currentUser || !pdfList) return;

    pdfList.innerHTML =
        '<div class="empty-state"><span>⏳</span><h3>Loading library...</h3></div>';

    try {
        const { data, error } = await db
            .from("published_pdfs_with_authors")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        documents = (data || []).map(function (doc) {
            return {
                ...doc,
                author_name: doc.author_name || "GRADE X Student",
                author_avatar: doc.author_avatar || ""
            };
        });

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

function renderDocuments() {
    // Keep Grade Bot's PDF selector synchronized with the Library.
    if (botPDF) {
        const previousSelection = botPDF.value;

        botPDF.innerHTML =
            '<option value="">General questions (no PDF selected)</option>';

        documents.forEach(function (doc) {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent =
                doc.title + " — " + (doc.subject || "General");

            botPDF.appendChild(option);
        });

        if (documents.some(function (doc) {
            return String(doc.id) === previousSelection;
        })) {
            botPDF.value = previousSelection;
        }
    }

    if (!pdfList) return;

    const searchTerm = searchPDF
        ? searchPDF.value.trim().toLowerCase()
        : "";

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

                <p>📘 ${escapeHTML(doc.subject || "General")}</p>

                <p>${escapeHTML(doc.description || "Study material")}</p>

                <div class="pdf-author">
                    ${
                        doc.author_avatar
                            ? `<img
                                src="${escapeHTML(doc.author_avatar)}"
                                alt=""
                                class="pdf-author-avatar"
                                style="width:32px;height:32px;min-width:32px;max-width:32px;min-height:32px;max-height:32px;object-fit:cover;border-radius:50%;flex-shrink:0;">`
                            : `<span
                                class="pdf-author-avatar-fallback"
                                style="width:32px;height:32px;min-width:32px;max-width:32px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:16px;">👤</span>`
                    }

                    <button
                        type="button"
                        class="pdf-author-name"
                        data-action="view-author"
                        data-author-id="${escapeHTML(doc.uploader_id)}">
                        ${escapeHTML(doc.author_name || "GRADE X Student")}
                    </button>
                </div>

                <p>${formatFileSize(doc.file_size)}</p>

                <div class="pdf-actions">
                    <button
                        type="button"
                        class="secondary-btn"
                        data-action="read"
                        data-id="${escapeHTML(doc.id)}">
                        Read
                    </button>

                    <button
                        type="button"
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

if (searchPDF) {
    searchPDF.addEventListener("input", renderDocuments);
}


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
// 12. READ PDF AND PUBLIC STUDENT PROFILES
// ============================================

if (pdfList) {
    pdfList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;

        if (action === "view-author") {
            const authorId = button.dataset.authorId;

            if (!authorId) {
                alert("Student profile is unavailable.");
                return;
            }

            await openPublicStudentProfile(authorId);
            return;
        }

        const documentId = button.dataset.id;

        const doc = documents.find(function (item) {
            return String(item.id) === String(documentId);
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
}

async function openPublicStudentProfile(studentId) {
    const profilePage = getElement("publicStudentProfilePage");
    const nameElement = getElement("publicStudentName");
    const avatarImage = getElement("publicStudentAvatar");
    const avatarFallback = getElement("publicStudentAvatarFallback");
    const joinedElement = getElement("publicStudentJoined");
    const pdfContainer = getElement("publicStudentPDFs");
    const statusElement = getElement("publicStudentProfileStatus");

    if (!profilePage) {
        alert("Student profile screen could not be found.");
        return;
    }

    if (nameElement) nameElement.textContent = "Loading profile...";
    if (joinedElement) joinedElement.textContent = "";
    if (pdfContainer) pdfContainer.innerHTML = "<p>Loading study materials...</p>";
    if (statusElement) statusElement.textContent = "";

    if (avatarImage) {
        avatarImage.hidden = true;
        avatarImage.removeAttribute("src");
    }

    if (avatarFallback) avatarFallback.hidden = false;

    Object.keys(pages).forEach(function (key) {
        if (pages[key]) pages[key].hidden = true;
    });

    profilePage.hidden = false;
    profilePage.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
        const { data: student, error: profileError } = await db
            .from("student_public_profiles")
            .select("id, full_name, display_name, avatar_url, created_at")
            .eq("id", studentId)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!student) {
            if (nameElement) nameElement.textContent = "GRADE X Student";
            if (pdfContainer) {
                pdfContainer.innerHTML = "<p>Student profile not found.</p>";
            }
            return;
        }

        if (nameElement) {
            nameElement.textContent =
                student.display_name ||
                student.full_name ||
                "GRADE X Student";
        }

        if (student.avatar_url && avatarImage) {
            avatarImage.src = student.avatar_url;
            avatarImage.hidden = false;

            if (avatarFallback) avatarFallback.hidden = true;
        }

        if (student.created_at && joinedElement) {
            joinedElement.textContent =
                "Joined " +
                new Date(student.created_at).toLocaleDateString();
        }

        const { data: studentPDFs, error: pdfError } = await db
            .from("published_pdfs_with_authors")
            .select("id, title, subject, description, file_size, uploader_id, storage_path, original_filename, created_at")
            .eq("uploader_id", studentId)
            .order("created_at", { ascending: false });

        if (pdfError) throw pdfError;

        if (!studentPDFs || studentPDFs.length === 0) {
            if (pdfContainer) {
                pdfContainer.innerHTML =
                    "<p>This student hasn't published any PDFs yet.</p>";
            }
            return;
        }

        if (pdfContainer) {
            pdfContainer.innerHTML = studentPDFs.map(function (doc) {
                return `
                    <article class="pdf-card">
                        <div class="pdf-icon">📕</div>
                        <h3>${escapeHTML(doc.title || "Untitled PDF")}</h3>
                        <p>📘 ${escapeHTML(doc.subject || "General")}</p>
                        <p>${escapeHTML(doc.description || "Study material")}</p>
                        <p>${formatFileSize(doc.file_size || 0)}</p>

                        <div class="pdf-actions">
                            <button type="button"
                                class="secondary-btn"
                                data-action="public-read"
                                data-id="${escapeHTML(doc.id)}">
                                Read
                            </button>

                            <button type="button"
                                class="secondary-btn"
                                data-action="public-download"
                                data-id="${escapeHTML(doc.id)}">
                                Download
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }
    } catch (error) {
        console.error("Public student profile error:", error);

        if (pdfContainer) {
            pdfContainer.innerHTML =
                "<p>Couldn't load this student's study materials. Please try again.</p>";
        }

        if (statusElement) {
            statusElement.textContent =
                error.message || "An error occurred.";
        }
    }
}

const closePublicStudentProfileBtn =
    getElement("closePublicStudentProfileBtn");

if (closePublicStudentProfileBtn) {
    closePublicStudentProfileBtn.addEventListener("click", function () {
        const profilePage = getElement("publicStudentProfilePage");

        if (profilePage) profilePage.hidden = true;

        Object.keys(pages).forEach(function (key) {
            if (pages[key]) pages[key].hidden = key !== "library";
        });

        if (pages.library) {
            pages.library.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}

const publicStudentPDFs = getElement("publicStudentPDFs");

if (publicStudentPDFs) {
    publicStudentPDFs.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const documentId = button.dataset.id;

        // Find the document in the main list first.
        // If it isn't there, fetch it from the public PDF view.
        let doc = documents.find(function (item) {
            return String(item.id) === String(documentId);
        });

        if (!doc) {
            const { data, error } = await db
                .from("published_pdfs_with_authors")
                .select("id, title, subject, description, file_size, uploader_id, storage_path, original_filename")
                .eq("id", documentId)
                .maybeSingle();

            if (error || !data) {
                alert("This PDF could not be found.");
                return;
            }

            doc = data;
        }

        const url = getPublicPdfUrl(doc.storage_path);

        if (action === "public-read") {
            await openPdfReader(doc, url);
            return;
        }

        if (action === "public-download") {
            const link = document.createElement("a");

            link.href = url;
            link.download = doc.original_filename || "document.pdf";
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    });
}


// ============================================
// PDF READER
// ============================================

async function openPdfReader(doc, url) {
    if (!window.pdfjsLib) {
        alert("The PDF reader could not load. Check your internet connection.");
        return;
    }

    currentPdfUrl = url;

    pdfReader.hidden = false;
    readerTitle.textContent = doc.title || "PDF document";

    readerPages.innerHTML = "<p>Loading PDF pages...</p>";

    pdfReader.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        const loadingTask = pdfjsLib.getDocument({ url });
        const pdf = await loadingTask.promise;

        if (currentPdfUrl !== url) return;

        readerPages.innerHTML = "";

        const pagesToRender = Math.min(pdf.numPages, 10);

        for (
            let pageNumber = 1;
            pageNumber <= pagesToRender;
            pageNumber++
        ) {
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

if (closeReader) {
    closeReader.addEventListener("click", function () {
        currentPdfUrl = null;
        pdfReader.hidden = true;
        readerPages.innerHTML = "";
    });
}


// ============================================
// 13. GRADE BOT
// FIX: Extract the selected PDF only once.
// FIX: Catch extraction and connection errors.
// ============================================

const chatForm = getElement("chatForm");
const chatInput = getElement("chatInput");
const chatMessages = getElement("chatMessages");
const botPDF = getElement("botPDF");
const botPDFStatus = getElement("botPDFStatus");

async function extractPdfText(doc) {
    if (!window.pdfjsLib) {
        throw new Error(
            "PDF reader is unavailable. Please refresh the app."
        );
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

if (chatForm && chatInput && chatMessages) {
    chatForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const question = chatInput.value.trim();

        if (!question) return;

        const selectedPdfId = botPDF ? botPDF.value : "";

        const selectedPdf = documents.find(function (doc) {
            return String(doc.id) === String(selectedPdfId);
        });

        // Show the user's question immediately.
        const userMessage = document.createElement("div");
        userMessage.className = "user-message";
        userMessage.textContent = question;
        chatMessages.appendChild(userMessage);

        // Show the bot's working state.
        const botMessage = document.createElement("div");
        botMessage.className = "bot-message";
        botMessage.textContent = "GRADE BOT is thinking... 🤖";
        chatMessages.appendChild(botMessage);

        chatInput.value = "";
        chatInput.disabled = true;

        if (botPDF) botPDF.disabled = true;

        chatMessages.scrollTop = chatMessages.scrollHeight;

        let pdfContext = "";

        try {
            // Extract the PDF only once, and handle failures here.
            if (selectedPdf) {
                showMessage(
                    botPDFStatus,
                    "Extracting text from your PDF..."
                );

                pdfContext = await extractPdfText(selectedPdf);

                showMessage(
                    botPDFStatus,
                    "Studying: " + selectedPdf.title
                );
            } else {
                if (botPDFStatus) {
                    botPDFStatus.textContent =
                        "General questions (no PDF selected)";
                }
            }

            const { data, error } = await db.functions.invoke(
                "dynamic-function",
                {
                    body: {
                        question: question,
                        pdfContext: pdfContext,
                        pdfTitle: selectedPdf ? selectedPdf.title : ""
                    }
                }
            );

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

            botMessage.textContent = data.answer;
        } catch (error) {
            console.error("GRADE BOT error:", error);

            botMessage.textContent =
                error.message ||
                "GRADE BOT couldn't respond. Please try again.";

            if (selectedPdf && botPDFStatus) {
                showMessage(
                    botPDFStatus,
                    "PDF question failed: " + error.message,
                    true
                );
            }
        } finally {
            chatInput.disabled = false;

            if (botPDF) botPDF.disabled = false;

            chatInput.focus();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}


// ============================================
// 14. ARENA — FREE PRACTICE QUIZ
// FIX: Declare quizQuestions with const.
// ============================================

const quizQuestions = [
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

const startQuiz = getElement("startQuiz");
const quizArea = getElement("quizArea");
const quizProgress = getElement("quizProgress");
const quizQuestion = getElement("quizQuestion");
const quizOptions = getElement("quizOptions");
const quizFeedback = getElement("quizFeedback");
const nextQuestion = getElement("nextQuestion");

if (startQuiz) {
    startQuiz.addEventListener("click", function () {
        quizIndex = 0;
        quizScore = 0;
        quizAnswered = false;

        if (quizArea) quizArea.hidden = false;

        startQuiz.hidden = true;
        startQuiz.textContent = "Start Quiz";

        showQuizQuestion();

        if (quizArea) {
            quizArea.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}

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

if (nextQuestion) {
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
}


// ============================================
// 15. EDIT STUDENT PROFILE
// ============================================

const profileNameInput = getElement("profileNameInput");
const profileUsernameInput = getElement("profileUsernameInput");
const profileBioInput = getElement("profileBioInput");
const profileNameDisplay = getElement("profileName");
const profileEmailDisplay = getElement("profileEmail");
const profilePictureInput = getElement("profilePictureInput");
const profileAvatarImage = getElement("profileAvatarImage");
const profileAvatarFallback = getElement("profileAvatarFallback");
const saveProfileBtn = getElement("saveProfileBtn");
const profileStatus = getElement("profileStatus");

let selectedProfilePicture = null;
let profilePreviewUrl = null;


// Load saved profile information.
function renderProfile() {
    if (!currentUser) return;

    const metadata = currentUser.user_metadata || {};
    const displayName = metadata.display_name || "GRADE X Student";
    const avatarUrl = metadata.avatar_url || "";

    if (profileNameDisplay) {
        profileNameDisplay.textContent = displayName;
    }

    if (profileEmailDisplay) {
        profileEmailDisplay.textContent = currentUser.email || "";
    }

    if (profileNameInput) {
        profileNameInput.value = metadata.display_name || "";
    }

    if (profileUsernameInput) {
        profileUsernameInput.value = "";
        profileUsernameInput.dataset.userId = currentUser.id;

        db.from("student_public_profiles")
.select("username, bio")
            .eq("id", currentUser.id)
            .maybeSingle()
            .then(function ({ data, error }) {
                if (error) {
                    console.error("Username load error:", error.message);
                    return;
                }

                // Prevent an old request from changing another user's profile.
                if (
                    currentUser &&
                    currentUser.id === profileUsernameInput.dataset.userId
                ) {
                    profileUsernameInput.value = data?.username || "";
                    if (profileBioInput) {
    profileBioInput.value = data?.bio || "";
}
                }
            })
            .catch(function (error) {
                console.error("Username request error:", error);
            });
    }

    if (profilePreviewUrl) {
        URL.revokeObjectURL(profilePreviewUrl);
        profilePreviewUrl = null;
    }

    selectedProfilePicture = null;

    if (profilePictureInput) {
        profilePictureInput.value = "";
    }

    if (avatarUrl && profileAvatarImage) {
        profileAvatarImage.src = avatarUrl;
        profileAvatarImage.hidden = false;

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = true;
        }
    } else {
        if (profileAvatarImage) {
            profileAvatarImage.removeAttribute("src");
            profileAvatarImage.hidden = true;
        }

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = false;
        }
    }

    if (profileStatus) profileStatus.textContent = "";
}

if (profileAvatarImage) {
    profileAvatarImage.addEventListener("error", function () {
        profileAvatarImage.hidden = true;

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = false;
        }
    });
}


// Preview a selected profile photo.
if (profilePictureInput) {
    profilePictureInput.addEventListener("change", function () {
        const file = profilePictureInput.files[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            showMessage(
                profileStatus,
                "Please select a JPG, PNG, WEBP, or GIF image.",
                true
            );

            profilePictureInput.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage(
                profileStatus,
                "Image must be 5 MB or smaller.",
                true
            );

            profilePictureInput.value = "";
            return;
        }

        selectedProfilePicture = file;

        if (profilePreviewUrl) {
            URL.revokeObjectURL(profilePreviewUrl);
        }

        profilePreviewUrl = URL.createObjectURL(file);

        if (profileAvatarImage) {
            profileAvatarImage.src = profilePreviewUrl;
            profileAvatarImage.hidden = false;
        }

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = true;
        }

        showMessage(
            profileStatus,
            "Photo selected. Tap Save Changes."
        );
    });
}


// Save the display name, username, and optional profile picture.
if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async function () {
        if (!currentUser) {
            showMessage(profileStatus, "Please sign in first.", true);
            return;
        }

        const displayName = profileNameInput
            ? profileNameInput.value.trim()
            : "";

        const usernameInput = profileUsernameInput
            ? profileUsernameInput.value.trim().toLowerCase()
            : "";
            const bioInput = profileBioInput ?
    profileBioInput.value.trim() :
    "";

        if (!displayName) {
            showMessage(
                profileStatus,
                "Please enter your display name.",
                true
            );
            return;
        }

        // Username is optional, but if supplied it must be valid.
        if (
            usernameInput &&
            !/^[a-z0-9_]{3,20}$/.test(usernameInput)
        ) {
            showMessage(
                profileStatus,
                "Username must be 3–20 characters using letters, numbers, or underscores.",
                true
            );
            return;
        }

        saveProfileBtn.disabled = true;

        showMessage(profileStatus, "Saving your profile...");

        try {
            let avatarUrl =
                currentUser.user_metadata?.avatar_url || "";

            if (selectedProfilePicture) {
                const file = selectedProfilePicture;

                const extensions = {
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "image/webp": "webp",
                    "image/gif": "gif"
                };

                const extension = extensions[file.type];

                if (!extension) {
                    throw new Error(
                        "Please use a JPG, PNG, WEBP, or GIF image."
                    );
                }

                const storagePath =
                    currentUser.id +
                    "/profile_" +
                    crypto.randomUUID() +
                    "." +
                    extension;

                const { error: uploadError } = await db.storage
                    .from(BUCKET_NAME)
                    .upload(storagePath, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: publicData } = db.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);

                avatarUrl = publicData.publicUrl;
            }

            // Update the authenticated user's metadata.
            const { data, error } = await db.auth.updateUser({
                data: {
                    display_name: displayName,
                    avatar_url: avatarUrl
                }
            });

            if (error) throw error;

            // Save the private/general profile record.
            const { error: profileError } = await db
                .from("profiles")
                .upsert({
                    id: currentUser.id,
                    full_name: displayName,
                    email: currentUser.email,
                    display_name: displayName,
                    avatar_url: avatarUrl
                }, {
                    onConflict: "id"
                });

            if (profileError) throw profileError;

            // Save the public profile, including username.
            const publicProfile = {
    id: currentUser.id,
    full_name: displayName,
    display_name: displayName,
    avatar_url: avatarUrl,
    username: usernameInput || null,
    bio: bioInput
};

            const { error: publicProfileError } = await db
                .from("student_public_profiles")
                .upsert(publicProfile, {
                    onConflict: "id"
                });

            if (publicProfileError) throw publicProfileError;

            if (data.user) {
                currentUser = data.user;
            }

            renderProfile();

            showMessage(
                profileStatus,
                "Profile saved successfully! ✅"
            );
        } catch (error) {
            console.error("Profile save error:", error);

            showMessage(
                profileStatus,
                "Could not save: " + error.message,
                true
            );
        } finally {
            saveProfileBtn.disabled = false;
        }
    });
}


// ============================================
// 16. START THE APP
// FIX: Handle startup errors instead of silently
// leaving an unhandled rejected promise.
// ============================================

restoreSession().catch(function (error) {
    console.error("GRADE X startup error:", error);

    showMessage(
        authStatus,
        "GRADE X couldn't restore your session. Refresh the app and try again.",
        true
    );
});

console.log("GRADE X application initialized.");


// ============================================
// GRADE X MENU BUTTON
// ============================================

const menuBtn = getElement("menuBtn");

if (menuBtn) {
    menuBtn.addEventListener("click", function () {
        const menu = getElement("menuPanel");

        if (menu) {
            menu.hidden = !menu.hidden;
        } else {
            console.log("GRADE X: Menu panel not found.");
        }
    });
}
