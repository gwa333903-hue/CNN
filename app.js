import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, getCountFromServer, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAG4RJ1YV4F2mRUcdxzWI5kVY1ErtGATv4",
  authDomain: "classn-12.firebaseapp.com",
  projectId: "classn-12",
  storageBucket: "classn-12.firebasestorage.app",
  messagingSenderId: "165777497789",
  appId: "1:165777497789:web:2cf437815dc4639bcd21d4",
};

const ADMIN_EMAILS = ["gwa333903@gmail.com", "sarkar@ankitji.in"]; 

// ==========================================
// 2. INITIALIZATION & HELPERS
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null; 

function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 200; 
                let width = img.width; let height = img.height;
                if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; } 
                else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); 
            };
        };
    });
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024; const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function populateCoursesDropdown(selectId, selectedValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const q = query(collection(db, "courses"), orderBy("name"));
        const snapshot = await getDocs(q);
        let html = '<option value="" disabled selected>Select Course</option>';
        snapshot.forEach(docSnap => {
            const name = docSnap.data().name;
            html += `<option value="${name}" ${name === selectedValue ? 'selected' : ''}>${name}</option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        console.error("Error fetching courses", e);
        select.innerHTML = '<option value="" disabled selected>Error loading courses</option>';
    }
}

// ==========================================
// 3. AUTHENTICATION & ROUTING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (user) {
        if (ADMIN_EMAILS.includes(user.email)) {
            if (isIndex || window.location.pathname.includes('student.html')) {
                window.location.href = 'admin.html';
                return;
            }
            if (document.getElementById('admin-page')) {
                document.getElementById('admin-page').classList.remove('hidden');
                initAdminDashboard();
            }
            setupLogout();
            return;
        }

        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            if (isIndex || window.location.pathname.includes('admin.html')) {
                window.location.href = 'student.html';
            } else if (document.getElementById('student-page')) {
                document.getElementById('student-page').classList.remove('hidden');
                initStudentDashboard();
            }
        } else {
            if (!isIndex) { window.location.href = 'index.html'; return; }
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('profile-section').classList.remove('hidden');
            document.getElementById('p-name').value = user.displayName || '';
            populateCoursesDropdown('p-course');
        }
        setupLogout();

    } else {
        if (!isIndex) window.location.href = 'index.html';
    }
});

const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => alert("Login failed: " + err.message));
    });
}

const emailAuthForm = document.getElementById('email-auth-form');
if (emailAuthForm) {
    emailAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                } catch (signupErr) { alert("Sign up failed: " + signupErr.message); }
            } else { alert("Login failed: " + err.message); }
        }
    });
}

const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        try {
            const picFile = document.getElementById('p-pic').files[0];
            let photoBase64 = "";
            if (picFile) photoBase64 = await processImage(picFile);

            await setDoc(doc(db, "users", user.uid), {
                name: document.getElementById('p-name').value,
                email: user.email, 
                dob: document.getElementById('p-dob').value,
                mobile: document.getElementById('p-mobile').value, 
                course: document.getElementById('p-course').value,
                section: document.getElementById('p-section').value,
                rollNumber: document.getElementById('p-roll').value,
                photoURL: photoBase64, 
                favorites: [] 
            });
            window.location.href = 'student.html';
        } catch (error) { alert("Error saving profile: " + error.message); }
    });
}

function setupLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));
}

// ==========================================
// 4. ADMIN DASHBOARD LOGIC (admin.html)
// ==========================================
async function initAdminDashboard() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    let currentEditingFileId = null;

    const renameModal = document.getElementById('rename-file-modal');
    const renameInput = document.getElementById('rename-file-input');
    if(document.getElementById('btn-cancel-rename')) {
        document.getElementById('btn-cancel-rename').addEventListener('click', () => renameModal.classList.add('hidden'));
    }

    const moveModal = document.getElementById('move-file-modal');
    const moveCourseSelect = document.getElementById('move-course-select');
    const moveSubjectSelect = document.getElementById('move-subject-select');
    if(document.getElementById('btn-cancel-move')) {
        document.getElementById('btn-cancel-move').addEventListener('click', () => moveModal.classList.add('hidden'));
    }

    if(moveCourseSelect) {
        moveCourseSelect.addEventListener('change', (e) => loadSubjects(e.target.value, moveSubjectSelect, null));
    }

    if(document.getElementById('btn-confirm-rename')) {
        document.getElementById('btn-confirm-rename').addEventListener('click', async () => {
            const newName = renameInput.value.trim();
            if (newName && currentEditingFileId) {
                await updateDoc(doc(db, "class_notes", currentEditingFileId), { fileName: newName });
                renameModal.classList.add('hidden');
                loadManageFiles(); 
            }
        });
    }

    if(document.getElementById('btn-confirm-move')) {
        document.getElementById('btn-confirm-move').addEventListener('click', async () => {
            const newCourse = moveCourseSelect.value;
            const newSubject = moveSubjectSelect.value;
            if (newCourse && newSubject && currentEditingFileId) {
                await updateDoc(doc(db, "class_notes", currentEditingFileId), { course: newCourse, subject: newSubject });
                moveModal.classList.add('hidden');
                loadManageFiles();
            } else {
                alert("Please select both a valid Course and Subject.");
            }
        });
    }

    try {
        const usersCol = collection(db, "users");
        const snapshot = await getCountFromServer(usersCol);
        if(document.getElementById('total-users')) {
            document.getElementById('total-users').innerText = snapshot.data().count;
        }
    } catch (e) { console.error("Error fetching user count", e); }

    const uploadCourseSelect = document.getElementById('upload-course');
    const uploadSubjectSelect = document.getElementById('upload-subject');
    const subjectCourseFilter = document.getElementById('subject-course-filter');
    const courseListUl = document.getElementById('course-list');
    const subjectListUl = document.getElementById('subject-list');

    async function loadCourses() {
        if(!courseListUl) return;
        try {
            const q = query(collection(db, "courses"), orderBy("name"));
            const snapshot = await getDocs(q);
            
            let optionsHTML = '<option value="" disabled selected>Select Course</option>';
            courseListUl.innerHTML = '';
            
            snapshot.forEach((docSnap) => {
                const courseName = docSnap.data().name;
                optionsHTML += `<option value="${courseName}">${courseName}</option>`;
                
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${courseName}</span>
                    <div>
                        <button class="btn btn-secondary btn-small btn-rename-course" data-id="${docSnap.id}" style="margin-right: 5px;">Rename</button>
                        <button class="btn btn-danger btn-small btn-delete-course" data-id="${docSnap.id}">Delete</button>
                    </div>
                `;
                
                li.querySelector('.btn-rename-course').addEventListener('click', async (e) => {
                    const newName = prompt("Enter new course name:", courseName);
                    if (newName && newName.trim() !== "" && newName !== courseName) {
                        try {
                            await updateDoc(doc(db, "courses", e.target.dataset.id), { name: newName.trim() });
                            loadCourses();
                            alert(`Course renamed to ${newName.trim()}. Existing files under the old name must be moved manually.`);
                        } catch (err) { alert("Error renaming course: " + err.message); }
                    }
                });

                li.querySelector('.btn-delete-course').addEventListener('click', async (e) => {
                    if (confirm(`Delete course ${courseName}?`)) {
                        await deleteDoc(doc(db, "courses", e.target.dataset.id));
                        loadCourses();
                    }
                });
                
                courseListUl.appendChild(li);
            });
            
            if(uploadCourseSelect) uploadCourseSelect.innerHTML = optionsHTML;
            if(subjectCourseFilter) subjectCourseFilter.innerHTML = optionsHTML;
            if(moveCourseSelect) moveCourseSelect.innerHTML = optionsHTML; 
            
        } catch (error) { console.error("Error loading courses:", error); }
    }

    async function loadSubjects(courseName, targetSelect, targetList) {
        if (!courseName) return;
        try {
            const subQuery = query(collection(db, "subjects"), where("course", "==", courseName));
            const subSnap = await getDocs(subQuery);
            
            let optionsHTML = '<option value="" disabled selected>Select Subject</option>';
            if(targetList) targetList.innerHTML = '';
            
            let count = 0;
            subSnap.forEach((docSnap) => {
                count++;
                const subName = docSnap.data().name;
                optionsHTML += `<option value="${subName}">${subName}</option>`;
                
                if (targetList) {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${subName}</span>
                        <div>
                            <button class="btn btn-secondary btn-small btn-rename-subject" data-id="${docSnap.id}" style="margin-right: 5px;">Rename</button>
                            <button class="btn btn-danger btn-small btn-delete-subject" data-id="${docSnap.id}">Delete</button>
                        </div>
                    `;
                    
                    li.querySelector('.btn-rename-subject').addEventListener('click', async (e) => {
                        const newName = prompt("Enter new subject name:", subName);
                        if (newName && newName.trim() !== "" && newName !== subName) {
                            try {
                                await updateDoc(doc(db, "subjects", e.target.dataset.id), { name: newName.trim() });
                                loadSubjects(courseName, targetSelect, targetList);
                            } catch (err) { alert("Error renaming subject: " + err.message); }
                        }
                    });

                    li.querySelector('.btn-delete-subject').addEventListener('click', async (e) => {
                        if (confirm(`Delete subject ${subName}?`)) {
                            await deleteDoc(doc(db, "subjects", e.target.dataset.id));
                            loadSubjects(courseName, targetSelect, targetList);
                        }
                    });
                    
                    targetList.appendChild(li);
                }
            });
            
            if (count === 0 && targetList) targetList.innerHTML = '<li style="color: var(--text-muted);">No subjects found.</li>';
            if (targetSelect) targetSelect.innerHTML = optionsHTML;
            
        } catch (e) { console.error("Error fetching subjects", e); }
    }

    if(uploadCourseSelect) {
        uploadCourseSelect.addEventListener('change', (e) => loadSubjects(e.target.value, uploadSubjectSelect, null));
    }
    if(subjectCourseFilter) {
        subjectCourseFilter.addEventListener('change', (e) => loadSubjects(e.target.value, null, subjectListUl));
    }

    if(document.getElementById('btn-create-course')) {
        document.getElementById('btn-create-course').addEventListener('click', async () => {
            const name = prompt("Enter new course name (e.g., BBA, MCA):");
            if (name && name.trim() !== "") {
                await addDoc(collection(db, "courses"), { name: name.trim(), createdAt: serverTimestamp() });
                loadCourses();
            }
        });
    }

    if(document.getElementById('btn-create-subject')) {
        document.getElementById('btn-create-subject').addEventListener('click', async () => {
            const currentCourse = subjectCourseFilter.value;
            if (!currentCourse) return alert("Please select a course in the filter dropdown first.");
            const name = prompt(`Enter new subject for ${currentCourse}:`);
            if (name && name.trim() !== "") {
                await addDoc(collection(db, "subjects"), { name: name.trim(), course: currentCourse, createdAt: serverTimestamp() });
                loadSubjects(currentCourse, null, subjectListUl);
                if(uploadCourseSelect.value === currentCourse) {
                    loadSubjects(currentCourse, uploadSubjectSelect, null);
                }
            }
        });
    }

    await loadCourses();

    // --- 4.5 File Upload Logic (Direct GitHub Integration) ---
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('file-input');
            const file = fileInput.files[0];
            if (!file) return;

            const customNameInput = document.getElementById('custom-file-name').value.trim();
            const selectedCourse = uploadCourseSelect.value;
            const selectedSubject = uploadSubjectSelect.value;
            const finalFileName = customNameInput !== "" ? customNameInput : file.name;
            const uploadStatus = document.getElementById('upload-status');
            const btnUpload = document.getElementById('btn-upload');
            
            if (!selectedCourse || !selectedSubject) return alert("Please select both a course and a subject.");

            btnUpload.disabled = true;
            uploadStatus.innerText = "Uploading directly to GitHub... please wait.";
            uploadStatus.style.color = "var(--text-main)";

            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onloadend = async () => {
                try {
                    const base64Content = reader.result.split(',')[1];
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                    const filePath = `class_notes/${Date.now()}_${safeFileName}`;
                    
                    // Pulls the injected secret token from the build process window scope, or fallback
                    const GITHUB_TOKEN = window.INJECTED_GITHUB_TOKEN || "";
                    const GITHUB_USERNAME = "gwa333903-hue";
                    const GITHUB_REPO = "class";

                    if (!GITHUB_TOKEN) {
                        throw new Error("GitHub Token is missing. Ensure the workflow injected it properly.");
                    }

                    const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${GITHUB_TOKEN}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.github+json'
                        },
                        body: JSON.stringify({
                            message: `Admin uploaded class note: ${file.name}`,
                            content: base64Content
                        })
                    });

                    const githubData = await githubResponse.json();
                    if (!githubResponse.ok) {
                        throw new Error(githubData.message || 'Failed to upload to GitHub');
                    }

                    await addDoc(collection(db, "class_notes"), {
                        fileName: finalFileName,
                        originalName: file.name,
                        course: selectedCourse, subject: selectedSubject, 
                        size: file.size, 
                        fileUrl: githubData.content.download_url,
                        uploadedAt: serverTimestamp(), 
                        uploaderEmail: auth.currentUser.email
                    });

                    uploadStatus.innerText = "Success! File uploaded.";
                    uploadStatus.style.color = "#34d399";
                    uploadForm.reset();
                    loadManageFiles(); 
                    
                } catch (error) {
                    console.error("Upload Error:", error);
                    uploadStatus.innerText = "Upload failed: " + error.message;
                    uploadStatus.style.color = "#f87171";
                } finally { 
                    btnUpload.disabled = false; 
                }
            };
        });
    }

    async function loadManageFiles() {
        const tbody = document.getElementById('files-table-body');
        if(!tbody) return;
        
        const notesRef = collection(db, "class_notes");
        const q = query(notesRef, orderBy("uploadedAt", "desc"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.fileName} <br><small style="color:var(--text-muted);">${formatBytes(data.size)}</small></td>
                <td><strong>${data.course || 'N/A'}</strong></td>
                <td><span style="background: var(--border); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${data.subject || 'N/A'}</span></td>
                <td>
                    <button class="btn btn-secondary btn-small btn-rename" style="margin-right: 5px;">Rename</button>
                    <button class="btn btn-secondary btn-small btn-move" style="margin-right: 5px;">Move</button>
                    <button class="btn btn-danger btn-small btn-delete">Delete</button>
                </td>
            `;
            
            tr.querySelector('.btn-rename').addEventListener('click', () => {
                currentEditingFileId = docSnap.id;
                document.getElementById('rename-file-input').value = data.fileName;
                document.getElementById('rename-file-modal').classList.remove('hidden');
            });

            tr.querySelector('.btn-move').addEventListener('click', async () => {
                currentEditingFileId = docSnap.id;
                document.getElementById('move-file-name').innerText = `File: ${data.fileName}`;
                
                const mCourseSel = document.getElementById('move-course-select');
                const mSubSel = document.getElementById('move-subject-select');
                
                mCourseSel.value = data.course || '';
                
                if (data.course) {
                    await loadSubjects(data.course, mSubSel, null);
                    mSubSel.value = data.subject || '';
                } else {
                    mSubSel.innerHTML = '<option value="" disabled selected>Select Subject</option>';
                }
                
                document.getElementById('move-file-modal').classList.remove('hidden');
            });

            tr.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to remove "${data.fileName}"?`)) {
                    await deleteDoc(doc(db, "class_notes", docSnap.id));
                    loadManageFiles(); 
                }
            });
            tbody.appendChild(tr);
        });
    }
    loadManageFiles();

    async function loadUsers() {
        const tbody = document.getElementById('users-table-body');
        if(!tbody) return;
        
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        tbody.innerHTML = '';
        
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.name || 'N/A'}</td>
                <td>${user.email}</td>
                <td>${user.course || 'N/A'}</td>
                <td>${user.rollNumber || 'N/A'}</td>
                <td>
                    <button class="btn btn-danger btn-small btn-delete-user">Delete</button>
                </td>
            `;
            
            tr.querySelector('.btn-delete-user').addEventListener('click', async () => {
                if (confirm(`Remove user data for ${user.name}?`)) {
                    await deleteDoc(doc(db, "users", docSnap.id));
                    loadUsers();
                }
            });
            tbody.appendChild(tr);
        });
    }
    loadUsers();

    async function loadLogs() {
        const tbody = document.getElementById('logs-table-body');
        if(!tbody) return;
        
        const logsRef = collection(db, "download_logs");
        const q = query(logsRef, orderBy("downloadedAt", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const timeString = data.downloadedAt ? data.downloadedAt.toDate().toLocaleString() : 'Just now';
            tbody.innerHTML += `
                <tr>
                    <td>${timeString}</td>
                    <td>${data.rollNumber}</td>
                    <td>${data.studentName}</td>
                    <td>${data.fileName}</td>
                </tr>
            `;
        });
    }
    loadLogs();
}

// ==========================================
// 5. STUDENT DASHBOARD LOGIC (student.html)
// ==========================================
async function initStudentDashboard() {
    document.getElementById('student-welcome-text').innerText = `Welcome, ${currentUserData.name} (Roll: ${currentUserData.rollNumber})`;
    const profileImg = document.getElementById('student-profile-img');
    
    if (currentUserData.photoURL) { profileImg.src = currentUserData.photoURL; } 
    else { profileImg.src = "image.png"; }
    profileImg.classList.remove('hidden');

    profileImg.addEventListener('click', () => {
        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) btnEditProfile.click();
    });
    
    const editProfileModal = document.getElementById('edit-profile-modal');
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const editProfileForm = document.getElementById('edit-profile-form');

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', async () => {
            document.getElementById('edit-name').value = currentUserData.name || '';
            document.getElementById('edit-dob').value = currentUserData.dob || ''; 
            document.getElementById('edit-mobile').value = currentUserData.mobile || ''; 
            document.getElementById('edit-section').value = currentUserData.section || '';
            document.getElementById('edit-roll').value = currentUserData.rollNumber || '';
            document.getElementById('edit-pic').value = ""; 
            
            await populateCoursesDropdown('edit-course', currentUserData.course);
            editProfileModal.classList.remove('hidden');
        });
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', () => editProfileModal.classList.add('hidden'));

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = editProfileForm.querySelector('button[type="submit"]');
            btnSubmit.disabled = true; btnSubmit.innerText = "Updating...";

            try {
                const newName = document.getElementById('edit-name').value;
                const newDob = document.getElementById('edit-dob').value;
                const newMobile = document.getElementById('edit-mobile').value; 
                const newCourse = document.getElementById('edit-course').value;
                const picFile = document.getElementById('edit-pic').files[0];
                let finalPhotoURL = currentUserData.photoURL; 
                
                if (picFile) finalPhotoURL = await processImage(picFile);

                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    name: newName, 
                    dob: newDob, 
                    mobile: newMobile,
                    course: newCourse, 
                    photoURL: finalPhotoURL
                });

                currentUserData.name = newName; 
                currentUserData.dob = newDob;
                currentUserData.mobile = newMobile; 
                currentUserData.course = newCourse; 
                currentUserData.photoURL = finalPhotoURL;
                
                document.getElementById('student-welcome-text').innerText = `Welcome, ${currentUserData.name} (Roll: ${currentUserData.rollNumber})`;
                profileImg.src = finalPhotoURL || "image_84edc6.png"; 
                
                alert("Profile updated successfully!");
                editProfileModal.classList.add('hidden');
                location.reload(); 
            } catch (error) { alert("Error updating profile: " + error.message); } 
            finally { btnSubmit.disabled = false; btnSubmit.innerText = "Update Profile"; }
        });
    }

    let allNotes = [];
    let showingFavorites = false;
    if (!currentUserData.favorites) currentUserData.favorites = [];

    const container = document.getElementById('notes-container');
    const searchInput = document.getElementById('search-input');
    const filterSubject = document.getElementById('filter-subject');
    const sortOptions = document.getElementById('sort-options');
    const btnToggleFavs = document.getElementById('btn-toggle-favs');

    async function loadStudentSubjects() {
        if(filterSubject){
            try {
                const subQuery = query(collection(db, "subjects"), where("course", "==", currentUserData.course));
                const subSnap = await getDocs(subQuery);
                let subjects = [];
                subSnap.forEach(docSnap => subjects.push(docSnap.data().name));
                subjects.sort();
                subjects.forEach((subName) => {
                    filterSubject.innerHTML += `<option value="${subName}">${subName}</option>`;
                });
            } catch (e) { console.error("Error fetching subjects for filter", e); }
        }
    }
    loadStudentSubjects();

    function renderNotes() {
        container.innerHTML = '';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedSubject = filterSubject ? filterSubject.value : 'All';
        const sortMode = sortOptions ? sortOptions.value : 'date-desc';

        let filteredNotes = allNotes.filter(note => {
            const matchesCourse = note.course === currentUserData.course; 
            const matchesSearch = note.fileName.toLowerCase().includes(searchTerm);
            const matchesFav = showingFavorites ? currentUserData.favorites.includes(note.id) : true;
            const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;
            return matchesCourse && matchesSearch && matchesFav && matchesSubject;
        });

        filteredNotes.sort((a, b) => {
            const timeA = a.uploadedAt ? a.uploadedAt.toMillis() : 0;
            const timeB = b.uploadedAt ? b.uploadedAt.toMillis() : 0;
            const sizeA = a.size || 0; const sizeB = b.size || 0;
            if (sortMode === 'date-desc') return timeB - timeA;
            if (sortMode === 'date-asc') return timeA - timeB;
            if (sortMode === 'size-desc') return sizeB - sizeA;
            if (sortMode === 'size-asc') return sizeA - sizeB;
            return 0;
        });

        if (filteredNotes.length === 0) {
            container.innerHTML = '<p style="color:white;">No notes match your filters.</p>';
            return;
        }

        filteredNotes.forEach((note) => {
            const dateStr = note.uploadedAt ? note.uploadedAt.toDate().toLocaleDateString() : 'Recently';
            const isFav = currentUserData.favorites.includes(note.id);
            const sizeStr = formatBytes(note.size);
            
            const card = document.createElement('div');
            card.className = 'note-card';
            card.innerHTML = `
                <div class="note-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="note-title" style="font-weight: 600; margin-bottom: 0.5rem; word-break: break-all;">${note.fileName}</div>
                    <button class="star-btn ${isFav ? 'active' : ''}" data-id="${note.id}" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: ${isFav ? '#fbbf24' : '#cbd5e1'};">★</button>
                </div>
                <div style="font-size: 0.8rem; margin-bottom: 0.3rem;">
                    <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">Subject: ${note.subject || 'N/A'}</span>
                </div>
                <div class="note-date" style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 0.2rem;">Uploaded: ${dateStr}</div>
                <div class="note-size" style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 1.5rem;">Size: ${sizeStr}</div>
                <div class="note-actions" style="display: flex; gap: 0.5rem; margin-top: auto;">
                    <button class="btn btn-secondary btn-preview" style="padding: 0.5rem; font-size: 0.9rem;">Preview</button>
                    <button class="btn btn-download" style="padding: 0.5rem; font-size: 0.9rem;">Download</button>
                </div>
            `;

            card.querySelector('.star-btn').addEventListener('click', async () => {
                const noteId = note.id;
                if (currentUserData.favorites.includes(noteId)) {
                    currentUserData.favorites = currentUserData.favorites.filter(id => id !== noteId);
                } else { currentUserData.favorites.push(noteId); }
                try {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), { favorites: currentUserData.favorites });
                    renderNotes(); 
                } catch (err) { alert("Error updating favorite: " + err.message); }
            });

            card.querySelector('.btn-preview').addEventListener('click', () => {
                const fileExtension = note.fileName.split('.').pop().toLowerCase();
                const browserNativeFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'txt'];
                
                if (browserNativeFormats.includes(fileExtension)) {
                    window.open(note.fileUrl, '_blank');
                } else {
                    const encodedUrl = encodeURIComponent(note.fileUrl);
                    const viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}`;
                    window.open(viewerUrl, '_blank');
                }
            });

            card.querySelector('.btn-download').addEventListener('click', async (e) => {
                const btn = e.target; btn.innerText = "Loading..."; btn.disabled = true;
                try {
                    await addDoc(collection(db, "download_logs"), {
                        rollNumber: currentUserData.rollNumber, studentName: currentUserData.name,
                        fileName: note.fileName, downloadedAt: serverTimestamp()
                    });
                    const response = await fetch(note.fileUrl);
                    const blob = await response.blob();
                    const objectUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = objectUrl; a.download = note.fileName;
                    document.body.appendChild(a); a.click();
                    window.URL.revokeObjectURL(objectUrl); a.remove();
                } catch (err) { window.open(note.fileUrl, '_blank'); } 
                finally { btn.innerText = "Download"; btn.disabled = false; }
            });

            container.appendChild(card);
        });
    }

    try {
        const notesRef = collection(db, "class_notes");
        const q = query(notesRef, orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => allNotes.push({ id: docSnap.id, ...docSnap.data() }));
        renderNotes();
    } catch (error) { container.innerHTML = '<p style="color:red">Failed to load notes.</p>'; }

    if (searchInput) searchInput.addEventListener('input', renderNotes);
    if (filterSubject) filterSubject.addEventListener('change', renderNotes);
    if (sortOptions) sortOptions.addEventListener('change', renderNotes);
    if (btnToggleFavs) {
        btnToggleFavs.addEventListener('click', () => {
            showingFavorites = !showingFavorites;
            btnToggleFavs.innerText = showingFavorites ? "🌟 Show All Notes" : "⭐ Show Favorites";
            renderNotes();
        });
    }
}