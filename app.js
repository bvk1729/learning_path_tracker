import { appState, loadState, saveStateLocally, saveToGitHubAsync, downloadBackup, restoreBackup } from './dataStore.js';
import { githubConfig, initGithubConfig, saveGithubConfig, fetchCommitHistory } from './sync/github.js';

let activeSkillFilter  = 'all';
let selectedSkillIds   = [];   // for the skills picker (add course)
let editingSkillIds    = [];   // for the skills picker (edit course)
let skillsPickerMode   = 'add'; // 'add' | 'edit'

// ====================================================
// BOOT
// ====================================================
document.addEventListener('DOMContentLoaded', async () => {
    initGithubConfig();
    await loadState();
    setupNavigation();
    setupManageTabs();
    setupForms();
    setupInlineUI();
    setupSkillsPicker();
    setupEditModal();
    setupHomeExtras();
    setupSyncUI();
    renderAll();
});

// ====================================================
// STATE UPDATER UTILITY
// ====================================================
function saveState() {
    saveStateLocally();
    renderAll();
    if (githubConfig.token) {
        saveToGitHubAsync(document.getElementById('sync-status-msg'));
    }
}

// ====================================================
// SYNC UI LOGIC
// ====================================================
function setupSyncUI() {
    const form = document.getElementById('sync-form');
    const uInput = document.getElementById('sync-github-username');
    const rInput = document.getElementById('sync-github-repo');
    const tInput = document.getElementById('sync-github-token');
    const statusText = document.getElementById('sync-connection-status');
    const statusMsg = document.getElementById('sync-status-msg');

    if (githubConfig) {
        uInput.value = githubConfig.username || '';
        rInput.value = githubConfig.repo || 'learning_path_tracker';
        tInput.value = githubConfig.token || '';
        updateConnectionStatus();
    }

    function updateConnectionStatus() {
        if (githubConfig.username && githubConfig.repo && githubConfig.token) {
            statusText.innerHTML = `<i class="ph ph-cloud-check" style="color:var(--accent-green)"></i> <span style="color:var(--accent-green)">Connected to ${githubConfig.username}/${githubConfig.repo}</span>`;
        } else {
            statusText.innerHTML = `<i class="ph ph-cloud-slash"></i> Offline (Local Storage only)`;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveGithubConfig({
            username: uInput.value.trim(),
            repo: rInput.value.trim(),
            token: tInput.value.trim()
        });
        statusMsg.innerText = 'Saved!';
        statusMsg.style.color = 'var(--accent-green)';
        updateConnectionStatus();
        setTimeout(() => { statusMsg.innerText = ''; }, 3000);
        
        await loadState();
        renderAll();
    });

    document.getElementById('btn-sync-push')?.addEventListener('click', async () => {
        await saveToGitHubAsync(statusMsg);
    });

    document.getElementById('btn-sync-pull')?.addEventListener('click', async () => {
        statusMsg.innerText = 'Pulling...';
        statusMsg.style.color = 'var(--accent-blue)';
        await loadState();
        renderAll();
        statusMsg.innerText = 'Pulled successfully!';
        statusMsg.style.color = 'var(--accent-green)';
        setTimeout(() => { statusMsg.innerText = ''; }, 3000);
    });

    document.getElementById('btn-sync-backup')?.addEventListener('click', () => {
        downloadBackup();
    });

    document.getElementById('sync-restore-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const success = restoreBackup(evt.target.result);
            if (success) {
                renderAll();
                if (githubConfig.token) await saveToGitHubAsync(statusMsg);
                alert("Backup restored successfully!");
            } else {
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-sync-history')?.addEventListener('click', async () => {
        const panel = document.getElementById('commit-history-panel');
        const list = document.getElementById('commit-history-list');
        panel.style.display = 'block';
        list.innerHTML = 'Loading commits...';
        
        const commits = await fetchCommitHistory();
        if (commits.length === 0) {
            list.innerHTML = 'No commits found or API limit reached.';
            return;
        }
        
        list.innerHTML = commits.map(c => `
            <div style="padding:10px 0; border-bottom:1px solid var(--border-color);">
                <div style="font-weight:600; margin-bottom:4px;">${c.commit.message}</div>
                <div style="color:var(--text-secondary); font-size:12px;">
                    ${new Date(c.commit.author.date).toLocaleString()} by ${c.commit.author.name}
                </div>
            </div>
        `).join('');
    });
}

// ====================================================
// NAVIGATION
// ====================================================
function switchTab(targetId) {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    document.querySelector(`.nav-item[data-target="${targetId}"]`)?.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
    localStorage.setItem('certflowActiveTab', targetId);
}

function setupNavigation() {
    // Restore tab if saved, else default to Home
    const savedTab = localStorage.getItem('certflowActiveTab') || 'home-section';
    switchTab(savedTab);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.getAttribute('data-target')));
    });

    document.querySelectorAll('.section-link[data-target]').forEach(link => {
        link.addEventListener('click', () => switchTab(link.getAttribute('data-target')));
    });
}

// ====================================================
// MANAGE PAGE TABS
// ====================================================
function setupManageTabs() {
    // Main tabs: Add New / Modify Existing
    document.querySelectorAll('.manage-main-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.manage-main-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const panelId = tab.getAttribute('data-panel');
            document.querySelectorAll('.manage-panel').forEach(p => p.style.display = 'none');
            document.getElementById(panelId).style.display = 'block';
            if (panelId === 'manage-modify-panel') renderModifyTables();
        });
    });

    // Add New type tabs
    document.querySelectorAll('#manage-add-panel .manage-type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#manage-add-panel .manage-type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.add-form-panel').forEach(f => f.style.display = 'none');
            document.getElementById(tab.getAttribute('data-form')).style.display = 'block';
        });
    });

    // Modify Existing type tabs
    document.querySelectorAll('#manage-modify-panel .manage-type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#manage-modify-panel .manage-type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.modify-table-panel').forEach(p => p.style.display = 'none');
            document.getElementById(tab.getAttribute('data-table')).style.display = 'block';
        });
    });
}

// ====================================================
// SKILLS PICKER MODAL
// ====================================================
function setupSkillsPicker() {
    document.getElementById('btn-open-skills-picker').addEventListener('click', () => {
        skillsPickerMode = 'add';
        openSkillsPicker(selectedSkillIds, (ids) => {
            selectedSkillIds = ids;
            renderSelectedSkillsPreview();
        });
    });

    document.getElementById('skills-picker-close').addEventListener('click', closeSkillsPicker);
    document.getElementById('skills-picker-done').addEventListener('click', () => {
        const checked = [...document.querySelectorAll('#skills-picker-body input[type=checkbox]:checked')];
        const ids = checked.map(cb => cb.value);
        if (skillsPickerMode === 'add') {
            selectedSkillIds = ids;
            renderSelectedSkillsPreview();
        } else if (skillsPickerMode === 'edit' && window._pickerCallback) {
            window._pickerCallback(ids);
        }
        closeSkillsPicker();
    });

    document.getElementById('skills-picker-search').addEventListener('input', (e) => {
        renderSkillsPickerBody(e.target.value.toLowerCase());
    });

    document.getElementById('skills-picker-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('skills-picker-modal')) closeSkillsPicker();
    });
}

function openSkillsPicker(preSelectedIds, callback) {
    window._pickerCallback = callback;
    document.getElementById('skills-picker-search').value = '';
    renderSkillsPickerBody('', preSelectedIds);
    document.getElementById('skills-picker-modal').classList.add('active');
}

function closeSkillsPicker() {
    document.getElementById('skills-picker-modal').classList.remove('active');
    updatePickerCount();
}

function renderSkillsPickerBody(query = '', preSelected = null) {
    const body = document.getElementById('skills-picker-body');
    const currentChecked = preSelected !== null ? preSelected
        : [...document.querySelectorAll('#skills-picker-body input:checked')].map(cb => cb.value);

    let html = '';
    appState.categories.forEach(cat => {
        const skills = appState.skills.filter(s => {
            const matchesCat = s.categoryId === cat.id;
            const matchesQ   = !query || s.name.toLowerCase().includes(query);
            return matchesCat && matchesQ;
        });
        if (skills.length === 0) return;
        html += `<div class="picker-group">
            <div class="picker-group-header cat-${cat.color}">
                <span class="cat-dot cat-${cat.color}"></span> ${cat.name}
            </div>
            <div class="picker-skills-grid">`;
        skills.forEach(s => {
            const chk = currentChecked.includes(s.id) ? 'checked' : '';
            html += `<label class="picker-skill-chip ${chk ? 'selected cat-'+getCatColor(s.categoryId) : ''}">
                <input type="checkbox" value="${s.id}" ${chk} style="display:none;" onchange="this.parentElement.classList.toggle('selected');this.parentElement.classList.toggle('cat-${cat.color}',this.checked);updatePickerCount();">
                ${s.name}
            </label>`;
        });
        html += `</div></div>`;
    });

    if (!html) html = `<p style="color:var(--text-secondary);padding:24px;">No skills match your search.</p>`;
    body.innerHTML = html;
    updatePickerCount();
}

function updatePickerCount() {
    const count = document.querySelectorAll('#skills-picker-body input:checked').length;
    document.getElementById('skills-picker-count').textContent =
        count > 0 ? `${count} skill${count > 1 ? 's' : ''} selected` : '';
}

function getCatColor(catId) {
    const cat = appState.categories.find(c => c.id === catId);
    return cat ? cat.color : 'blue';
}

function renderSelectedSkillsPreview() {
    const preview = document.getElementById('selected-skills-preview');
    const label   = document.getElementById('skills-picker-label');
    if (selectedSkillIds.length === 0) {
        preview.innerHTML = '';
        label.textContent = 'Select Skills';
    } else {
        label.textContent = `${selectedSkillIds.length} skill${selectedSkillIds.length > 1 ? 's' : ''} selected`;
        preview.innerHTML = selectedSkillIds.map(id => {
            const s   = appState.skills.find(sk => sk.id === id);
            const col = s ? getCatColor(s.categoryId) : 'blue';
            return s ? `<span class="cat-badge cat-${col}">${s.name}</span>` : '';
        }).join('');
    }
}

// ====================================================
// EDIT MODAL
// ====================================================
function setupEditModal() {
    document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('edit-modal')) closeEditModal();
    });
}

function openEditModal(title, bodyHtml, onSave) {
    document.getElementById('edit-modal-title').textContent = title;
    document.getElementById('edit-modal-body').innerHTML = bodyHtml;
    document.getElementById('edit-modal').classList.add('active');
    // Wire save button inside modal
    const saveBtn = document.getElementById('edit-modal-save');
    if (saveBtn) saveBtn.onclick = () => { onSave(); closeEditModal(); };
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

// ====================================================
// INLINE UI WIRING
// ====================================================
function setupInlineUI() {
    document.getElementById('course-provider').addEventListener('change', e => {
        document.getElementById('inline-provider-form').style.display =
            e.target.value === 'NEW' ? 'flex' : 'none';
    });
    document.getElementById('skill-category').addEventListener('change', e => {
        document.getElementById('inline-category-form').style.display =
            e.target.value === 'NEW' ? 'flex' : 'none';
    });
}

// ====================================================
// FORMS
// ====================================================
let tempAvatarStr = '';

function setupForms() {
    // Profile
    document.getElementById('profile-avatar-upload').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            tempAvatarStr = ev.target.result;
            document.getElementById('edit-avatar-preview').innerHTML = `<img src="${tempAvatarStr}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('profile-form').addEventListener('submit', e => {
        e.preventDefault();
        appState.profile = {
            name:     document.getElementById('profile-name').value.trim(),
            email:    document.getElementById('profile-email').value.trim(),
            phone:    document.getElementById('profile-phone').value.trim(),
            role:     document.getElementById('profile-role').value.trim(),
            bio:      document.getElementById('profile-bio').value.trim(),
            github:   document.getElementById('profile-github').value.trim(),
            linkedin: document.getElementById('profile-linkedin').value.trim(),
            website:  document.getElementById('profile-website').value.trim(),
            avatar:   tempAvatarStr || appState.profile?.avatar || ''
        };
        saveState(); 
        toggleProfileEdit(false);
        showToast('Profile saved!', 'green');
    });

    // Provider
    document.getElementById('add-provider-form').addEventListener('submit', e => {
        e.preventDefault();
        appState.providers.push({
            id:   Date.now().toString(),
            name: document.getElementById('provider-name').value.trim(),
            url:  document.getElementById('provider-url').value.trim(),
        });
        e.target.reset(); saveState(); showToast('Provider added!', 'blue');
    });

    // Category
    document.getElementById('add-category-form').addEventListener('submit', e => {
        e.preventDefault();
        const name  = document.getElementById('category-name').value.trim();
        const color = document.getElementById('category-color').value;
        if (appState.categories.find(c => c.name.toLowerCase() === name.toLowerCase()))
            { showToast('Category already exists.', 'orange'); return; }
        appState.categories.push({ id: Date.now().toString(), name, color });
        e.target.reset(); saveState(); showToast('Category added!', 'purple');
    });

    // Skill
    document.getElementById('add-skill-form').addEventListener('submit', e => {
        e.preventDefault();
        const skillName  = document.getElementById('skill-name').value.trim();
        let   categoryId = document.getElementById('skill-category').value;
        if (categoryId === 'NEW') {
            const newName  = document.getElementById('inline-category-name').value.trim();
            const newColor = document.getElementById('inline-category-color').value;
            if (!newName) { alert('Enter the new category name.'); return; }
            categoryId = Date.now().toString();
            appState.categories.push({ id: categoryId, name: newName, color: newColor });
            document.getElementById('inline-category-form').style.display = 'none';
        }
        if (!categoryId) { alert('Select a category.'); return; }
        appState.skills.push({ id: Date.now().toString(), name: skillName, categoryId });
        e.target.reset(); saveState(); showToast('Skill added!', 'green');
    });

    // Course
    document.getElementById('add-course-form').addEventListener('submit', e => {
        e.preventDefault();
        const title       = document.getElementById('course-title').value.trim();
        const description = document.getElementById('course-description').value.trim();
        const courseUrl   = document.getElementById('course-url').value.trim();
        let   providerId  = document.getElementById('course-provider').value;

        if (providerId === 'NEW') {
            const newName = document.getElementById('inline-provider-name').value.trim();
            const newUrl  = document.getElementById('inline-provider-url').value.trim();
            if (!newName) { alert("Enter the new provider's name."); return; }
            providerId = Date.now().toString();
            appState.providers.push({ id: providerId, name: newName, url: newUrl });
            document.getElementById('inline-provider-form').style.display = 'none';
        }

        if (!providerId) { alert('Select a provider.'); return; }
        if (selectedSkillIds.length === 0) { alert('Select at least one skill.'); return; }

        appState.courses.push({
            id: Date.now().toString(),
            title, description, courseUrl, providerId,
            skillIds: [...selectedSkillIds],
            status:   document.getElementById('course-status').value,
            progress: parseInt(document.getElementById('course-progress').value) || 0,
        });

        // Reset
        e.target.reset();
        selectedSkillIds = [];
        renderSelectedSkillsPreview();
        saveState(); showToast('Course added!', 'blue');
    });
}

// ====================================================
// RENDER ALL
// ====================================================
function renderAll() {
    renderProfile();
    renderProviderDropdown();
    renderCategoryDropdown();
    renderHomeStats();
    renderHomePage();
    renderGrid('courses-grid',      appState.courses,   renderCourseCard,   'No courses yet. Go to Manage → Add New → Course.');
    renderGrid('home-courses-grid', appState.courses,   renderCourseCard,   'No courses yet. Go to Manage to add some.');
    renderGrid('providers-grid',    appState.providers, renderProviderCard, 'No providers yet. Go to Manage → Add New → Provider.');
    renderSkillsPage();
    renderProgressList();
    renderExistingCategoriesList();
}

// ====================================================
// PROFILE LOGIC
// ====================================================
function renderProfile() {
    const p = appState.profile || {};
    
    // View Mode
    document.getElementById('view-profile-name').textContent = p.name || 'Anonymous Developer';
    document.getElementById('view-profile-role').textContent = p.role || 'Enthusiastic Learner';
    document.querySelector('#view-profile-email span').textContent = p.email || 'No email provided';
    document.querySelector('#view-profile-phone span').textContent = p.phone || 'No phone provided';
    document.getElementById('view-profile-bio').textContent = p.bio || 'No bio provided. Click Edit Profile to add one!';
    
    const avatarImg = p.avatar ? `<img src="${p.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : `<i class="ph ph-user"></i>`;
    document.getElementById('view-avatar-container').innerHTML = avatarImg;
    
    let linksHtml = '';
    if (p.github) linksHtml += `<a href="${p.github}" target="_blank" class="profile-link"><i class="ph ph-github-logo"></i> GitHub</a>`;
    if (p.linkedin) linksHtml += `<a href="${p.linkedin}" target="_blank" class="profile-link"><i class="ph ph-linkedin-logo"></i> LinkedIn</a>`;
    if (p.website) linksHtml += `<a href="${p.website}" target="_blank" class="profile-link"><i class="ph ph-globe"></i> Website</a>`;
    document.getElementById('view-profile-links').innerHTML = linksHtml;

    // Edit Mode (pre-fill)
    document.getElementById('profile-name').value = p.name || '';
    document.getElementById('profile-email').value = p.email || '';
    document.getElementById('profile-phone').value = p.phone || '';
    document.getElementById('profile-role').value = p.role || '';
    document.getElementById('profile-bio').value = p.bio || '';
    document.getElementById('profile-github').value = p.github || '';
    document.getElementById('profile-linkedin').value = p.linkedin || '';
    document.getElementById('profile-website').value = p.website || '';
    
    tempAvatarStr = p.avatar || '';
    document.getElementById('edit-avatar-preview').innerHTML = avatarImg;
}

function toggleProfileEdit(showEdit) {
    document.getElementById('profile-view').style.display = showEdit ? 'none' : 'block';
    document.getElementById('profile-form').style.display = showEdit ? 'block' : 'none';
    if (showEdit) renderProfile(); // Refresh input values
}

// ====================================================
// DROPDOWNS
// ====================================================
function renderProviderDropdown() {
    const sel = document.getElementById('course-provider');
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Select Provider</option><option value="NEW">+ Add New Provider</option>';
    appState.providers.forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
    if (cur) sel.value = cur;
}

function renderCategoryDropdown() {
    const sel = document.getElementById('skill-category');
    const cur = sel.value;
    sel.innerHTML = '<option value="" disabled selected>Select Category</option><option value="NEW">+ Add New Category</option>';
    appState.categories.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    if (cur) sel.value = cur;
}

function renderExistingCategoriesList() {
    const el = document.getElementById('existing-categories-list');
    if (!el || appState.categories.length === 0) { if(el) el.innerHTML = ''; return; }
    el.innerHTML = `
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Existing Categories</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${appState.categories.map(c => `<span class="cat-badge cat-${c.color}">${c.name}</span>`).join('')}
        </div>`;
}

// ====================================================
// HOME STATS
// ====================================================
function renderHomeStats() {
    document.getElementById('stat-total-courses').innerText     = appState.courses.length;
    document.getElementById('stat-completed-courses').innerText = appState.courses.filter(c => c.status === 'Completed').length;
    document.getElementById('stat-in-progress').innerText       = appState.courses.filter(c => c.status === 'In Progress').length;
    document.getElementById('stat-total-skills').innerText      = appState.skills.length;
}

// ====================================================
// HOME PAGE
// ====================================================
function renderHomePage() {
    const spotlight = document.getElementById('home-skills-spotlight');
    if (!spotlight) return;
    const coursedSkillIds = [...new Set(appState.courses.flatMap(c => c.skillIds || []))];
    if (coursedSkillIds.length === 0 && appState.skills.length === 0) {
        spotlight.innerHTML = `<p style="color:var(--text-secondary);font-size:14px;">No skills yet.</p>`; return;
    }
    const showSkills = coursedSkillIds.length > 0
        ? appState.skills.filter(s => coursedSkillIds.includes(s.id))
        : appState.skills.slice(0, 20);
    const usedCatIds = [...new Set(showSkills.map(s => s.categoryId))];
    const usedCats   = appState.categories.filter(c => usedCatIds.includes(c.id));
    let html = '';
    usedCats.forEach(cat => {
        const catSkills = showSkills.filter(s => s.categoryId === cat.id);
        html += `<div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span class="cat-dot cat-${cat.color}"></span>
                <span style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;">${cat.name}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${catSkills.map(s => `<span class="skill-pill cat-pill-${cat.color}">${s.name}</span>`).join('')}
            </div></div>`;
    });
    spotlight.innerHTML = html;
}

// ====================================================
// SKILLS PAGE
// ====================================================
function renderSkillsPage() {
    const tabsEl  = document.getElementById('skills-filter-tabs');
    const content = document.getElementById('skills-content');
    if (appState.skills.length === 0) {
        tabsEl.innerHTML = '';
        content.innerHTML = `<div class="empty-state"><i class="ph ph-folder-dashed"></i><h3>No skills yet</h3><p>Skills are pre-loaded — check Manage if missing.</p></div>`;
        return;
    }
    const usedCatIds = [...new Set(appState.skills.map(s => s.categoryId))];
    const usedCats   = appState.categories.filter(c => usedCatIds.includes(c.id));

    let tabsHtml = `<button class="filter-tab ${activeSkillFilter === 'all' ? 'active' : ''}" data-filter="all">All <span class="tab-count">${appState.skills.length}</span></button>`;
    usedCats.forEach(cat => {
        const cnt = appState.skills.filter(s => s.categoryId === cat.id).length;
        tabsHtml += `<button class="filter-tab ${activeSkillFilter === cat.id ? 'active' : ''} tab-${cat.color}" data-filter="${cat.id}">${cat.name} <span class="tab-count">${cnt}</span></button>`;
    });
    tabsEl.innerHTML = tabsHtml;
    tabsEl.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => { activeSkillFilter = tab.getAttribute('data-filter'); renderSkillsPage(); });
    });

    const filteredCats = activeSkillFilter === 'all' ? usedCats : usedCats.filter(c => c.id === activeSkillFilter);
    let html = '';
    filteredCats.forEach(cat => {
        const catSkills = appState.skills.filter(s => s.categoryId === cat.id);
        html += `<div class="skills-category-group">
            <div class="skills-category-header">
                <span class="cat-dot cat-${cat.color}"></span>
                <h3 class="skills-category-name">${cat.name}</h3>
                <span class="cat-count">${catSkills.length} skill${catSkills.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="cards-grid" style="margin-bottom:0;">
                ${catSkills.map(s => renderSkillCard(s, cat)).join('')}
            </div></div>`;
    });
    content.innerHTML = html;
}

// ====================================================
// MODIFY EXISTING TABLES
// ====================================================
function renderModifyTables() {
    renderModifyCourses();
    renderModifyProviders();
    renderModifyCategories();
    renderModifySkills();
}

function modifyTableShell(id, emptyMsg, headerRow, rows) {
    const el = document.getElementById(id);
    if (!el) return;
    if (rows.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="ph ph-folder-dashed"></i><h3>Nothing here</h3><p>${emptyMsg}</p></div>`; return;
    }
    el.innerHTML = `
        <div class="modify-table">
            <div class="modify-table-head">${headerRow}</div>
            <div class="modify-table-body" id="${id}-body"></div>
        </div>`;
    document.getElementById(`${id}-body`).innerHTML = rows.join('');
}

function renderModifyCourses() {
    const rows = appState.courses.map(c => {
        const prov = appState.providers.find(p => p.id === c.providerId);
        let sc = c.status === 'Completed' ? 'completed' : c.status === 'In Progress' ? 'in-progress' : 'to-start';
        return `
        <div class="modify-row" id="mrow-${c.id}">
            <div class="modify-cell main-cell">${c.title}</div>
            <div class="modify-cell">${prov ? prov.name : '—'}</div>
            <div class="modify-cell"><span class="status-badge ${sc}">${c.status}</span></div>
            <div class="modify-cell">${c.progress}%</div>
            <div class="modify-cell actions-cell">
                <button class="action-btn edit-btn" onclick="editCourse('${c.id}')"><i class="ph ph-pencil"></i> Edit</button>
                <button class="action-btn delete-btn" onclick="confirmDelete('course','${c.id}','${c.title}')"><i class="ph ph-trash"></i> Delete</button>
            </div>
        </div>`;
    });
    modifyTableShell('modify-courses', 'No courses yet. Add one from Add New → Course.',
        `<div class="modify-row head-row"><div class="modify-cell main-cell">Title</div><div class="modify-cell">Provider</div><div class="modify-cell">Status</div><div class="modify-cell">Progress</div><div class="modify-cell">Actions</div></div>`, rows);
}

function renderModifyProviders() {
    const rows = appState.providers.map(p => `
        <div class="modify-row" id="mrow-${p.id}">
            <div class="modify-cell main-cell">${p.name}</div>
            <div class="modify-cell">${p.url ? `<a href="${p.url}" target="_blank" style="color:var(--accent-blue);font-size:13px;">${p.url}</a>` : '—'}</div>
            <div class="modify-cell actions-cell">
                <button class="action-btn edit-btn" onclick="editProvider('${p.id}')"><i class="ph ph-pencil"></i> Edit</button>
                <button class="action-btn delete-btn" onclick="confirmDelete('provider','${p.id}','${p.name}')"><i class="ph ph-trash"></i> Delete</button>
            </div>
        </div>`);
    modifyTableShell('modify-providers', 'No providers yet.',
        `<div class="modify-row head-row"><div class="modify-cell main-cell">Name</div><div class="modify-cell">Website</div><div class="modify-cell">Actions</div></div>`, rows);
}

function renderModifyCategories() {
    const rows = appState.categories.map(c => {
        const cnt = appState.skills.filter(s => s.categoryId === c.id).length;
        return `
        <div class="modify-row" id="mrow-${c.id}">
            <div class="modify-cell main-cell"><span class="cat-badge cat-${c.color}">${c.name}</span></div>
            <div class="modify-cell">${cnt} skill${cnt !== 1 ? 's' : ''}</div>
            <div class="modify-cell actions-cell">
                <button class="action-btn edit-btn" onclick="editCategory('${c.id}')"><i class="ph ph-pencil"></i> Edit</button>
                <button class="action-btn delete-btn" onclick="confirmDelete('category','${c.id}','${c.name}')"><i class="ph ph-trash"></i> Delete</button>
            </div>
        </div>`;
    });
    modifyTableShell('modify-categories', 'No categories yet.',
        `<div class="modify-row head-row"><div class="modify-cell main-cell">Category</div><div class="modify-cell">Skills</div><div class="modify-cell">Actions</div></div>`, rows);
}

function renderModifySkills() {
    const rows = appState.skills.map(s => {
        const cat = appState.categories.find(c => c.id === s.categoryId);
        return `
        <div class="modify-row" id="mrow-${s.id}">
            <div class="modify-cell main-cell">${s.name}</div>
            <div class="modify-cell">${cat ? `<span class="cat-badge cat-${cat.color}">${cat.name}</span>` : '—'}</div>
            <div class="modify-cell actions-cell">
                <button class="action-btn edit-btn" onclick="editSkill('${s.id}')"><i class="ph ph-pencil"></i> Edit</button>
                <button class="action-btn delete-btn" onclick="confirmDelete('skill','${s.id}','${s.name}')"><i class="ph ph-trash"></i> Delete</button>
            </div>
        </div>`;
    });
    modifyTableShell('modify-skills', 'No skills yet.',
        `<div class="modify-row head-row"><div class="modify-cell main-cell">Skill</div><div class="modify-cell">Category</div><div class="modify-cell">Actions</div></div>`, rows);
}

// ====================================================
// EDIT HANDLERS
// ====================================================
function editCourse(id) {
    const c = appState.courses.find(x => x.id === id);
    if (!c) return;
    const pOpts = appState.providers.map(p =>
        `<option value="${p.id}" ${p.id === c.providerId ? 'selected' : ''}>${p.name}</option>`).join('');

    let editSkillIds = [...(c.skillIds || [])];

    const body = `
        <div class="form-group"><label>Course Title</label><input id="ec-title" class="modal-input" value="${c.title}"></div>
        <div class="form-group"><label>Course URL</label><input id="ec-url" class="modal-input" type="url" value="${c.courseUrl || ''}"></div>
        <div class="form-group"><label>Description</label><textarea id="ec-desc" class="modal-input" rows="2">${c.description || ''}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Provider</label><select id="ec-provider" class="modal-input">${pOpts}</select></div>
            <div class="form-group"><label>Status</label><select id="ec-status" class="modal-input">
                <option ${c.status==='To Start'?'selected':''}>To Start</option>
                <option ${c.status==='In Progress'?'selected':''}>In Progress</option>
                <option ${c.status==='Completed'?'selected':''}>Completed</option>
            </select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Progress (%)</label><input id="ec-progress" class="modal-input" type="number" min="0" max="100" value="${c.progress}"></div>
        </div>
        <div class="form-group">
            <label>Skills</label>
            <button type="button" class="btn secondary skills-picker-btn" id="ec-skills-btn" style="margin-bottom:8px;">
                <i class="ph ph-brain"></i> <span id="ec-skills-label">${editSkillIds.length} skill${editSkillIds.length!==1?'s':''} selected</span>
            </button>
            <div id="ec-skills-preview" class="skill-badges">
                ${editSkillIds.map(sid => { const sk=appState.skills.find(x=>x.id===sid); const col=sk?getCatColor(sk.categoryId):'blue'; return sk?`<span class="cat-badge cat-${col}">${sk.name}</span>`:''; }).join('')}
            </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
            <button class="btn secondary" onclick="closeEditModal()">Cancel</button>
            <button id="edit-modal-save" class="btn primary"><i class="ph ph-floppy-disk"></i> Save Changes</button>
        </div>`;

    openEditModal('Edit Course', body, () => {
        c.title       = document.getElementById('ec-title').value.trim();
        c.courseUrl   = document.getElementById('ec-url').value.trim();
        c.description = document.getElementById('ec-desc').value.trim();
        c.providerId  = document.getElementById('ec-provider').value;
        c.status      = document.getElementById('ec-status').value;
        c.progress    = parseInt(document.getElementById('ec-progress').value) || 0;
        c.skillIds    = editSkillIds;
        saveState(); renderModifyTables(); showToast('Course updated!', 'blue');
    });

    // Wire skills picker button inside modal
    setTimeout(() => {
        document.getElementById('ec-skills-btn').addEventListener('click', () => {
            skillsPickerMode = 'edit';
            openSkillsPicker(editSkillIds, (ids) => {
                editSkillIds = ids;
                document.getElementById('ec-skills-label').textContent = `${ids.length} skill${ids.length!==1?'s':''} selected`;
                document.getElementById('ec-skills-preview').innerHTML = ids.map(sid => {
                    const sk=appState.skills.find(x=>x.id===sid); const col=sk?getCatColor(sk.categoryId):'blue';
                    return sk?`<span class="cat-badge cat-${col}">${sk.name}</span>`:'';
                }).join('');
            });
        });
    }, 50);
}

function editProvider(id) {
    const p = appState.providers.find(x => x.id === id);
    if (!p) return;
    const body = `
        <div class="form-group"><label>Provider Name</label><input id="ep-name" class="modal-input" value="${p.name}"></div>
        <div class="form-group"><label>Website URL</label><input id="ep-url" class="modal-input" type="url" value="${p.url || ''}"></div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
            <button class="btn secondary" onclick="closeEditModal()">Cancel</button>
            <button id="edit-modal-save" class="btn primary"><i class="ph ph-floppy-disk"></i> Save Changes</button>
        </div>`;
    openEditModal('Edit Provider', body, () => {
        p.name = document.getElementById('ep-name').value.trim();
        p.url  = document.getElementById('ep-url').value.trim();
        saveState(); renderModifyTables(); showToast('Provider updated!', 'blue');
    });
}

function editCategory(id) {
    const cat = appState.categories.find(x => x.id === id);
    if (!cat) return;
    const colorOpts = ['blue','green','purple','orange','cyan','yellow','pink','red']
        .map(c => `<option value="${c}" ${c===cat.color?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('');
    const body = `
        <div class="form-group"><label>Category Name</label><input id="ecat-name" class="modal-input" value="${cat.name}"></div>
        <div class="form-group"><label>Colour Theme</label><select id="ecat-color" class="modal-input">${colorOpts}</select></div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
            <button class="btn secondary" onclick="closeEditModal()">Cancel</button>
            <button id="edit-modal-save" class="btn primary"><i class="ph ph-floppy-disk"></i> Save Changes</button>
        </div>`;
    openEditModal('Edit Category', body, () => {
        cat.name  = document.getElementById('ecat-name').value.trim();
        cat.color = document.getElementById('ecat-color').value;
        saveState(); renderModifyTables(); showToast('Category updated!', 'purple');
    });
}

function editSkill(id) {
    const s = appState.skills.find(x => x.id === id);
    if (!s) return;
    const catOpts = appState.categories.map(c =>
        `<option value="${c.id}" ${c.id===s.categoryId?'selected':''}>${c.name}</option>`).join('');
    const body = `
        <div class="form-group"><label>Skill Name</label><input id="es-name" class="modal-input" value="${s.name}"></div>
        <div class="form-group"><label>Category</label><select id="es-cat" class="modal-input">${catOpts}</select></div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
            <button class="btn secondary" onclick="closeEditModal()">Cancel</button>
            <button id="edit-modal-save" class="btn primary"><i class="ph ph-floppy-disk"></i> Save Changes</button>
        </div>`;
    openEditModal('Edit Skill', body, () => {
        s.name       = document.getElementById('es-name').value.trim();
        s.categoryId = document.getElementById('es-cat').value;
        saveState(); renderModifyTables(); showToast('Skill updated!', 'green');
    });
}

// ====================================================
// DELETE WITH INLINE CONFIRM
// ====================================================
function confirmDelete(type, id, label) {
    const row = document.getElementById(`mrow-${id}`);
    if (!row) return;
    // Replace actions cell with confirm UI
    const actionsCell = row.querySelector('.actions-cell');
    actionsCell.innerHTML = `
        <span style="font-size:13px;color:var(--text-secondary);margin-right:8px;">Delete "<strong style="color:#fff">${label}</strong>"?</span>
        <button class="action-btn confirm-btn" onclick="doDelete('${type}','${id}')"><i class="ph ph-check"></i> Yes, Delete</button>
        <button class="action-btn cancel-btn" onclick="renderModifyTables()"><i class="ph ph-x"></i> Cancel</button>`;
}

function doDelete(type, id) {
    if (type === 'course') {
        appState.courses = appState.courses.filter(c => c.id !== id);
        showToast('Course deleted.', 'orange');
    } else if (type === 'provider') {
        appState.providers = appState.providers.filter(p => p.id !== id);
        // Cascade: clear providerId from courses
        appState.courses.forEach(c => { if (c.providerId === id) c.providerId = null; });
        showToast('Provider deleted.', 'orange');
    } else if (type === 'category') {
        appState.categories = appState.categories.filter(c => c.id !== id);
        // Cascade: skills become uncategorised
        appState.skills.forEach(s => { if (s.categoryId === id) s.categoryId = null; });
        showToast('Category deleted.', 'orange');
    } else if (type === 'skill') {
        appState.skills = appState.skills.filter(s => s.id !== id);
        // Cascade: remove from course skillIds
        appState.courses.forEach(c => { c.skillIds = (c.skillIds || []).filter(sid => sid !== id); });
        showToast('Skill deleted.', 'orange');
    }
    saveState(); renderModifyTables();
}

// ====================================================
// GENERIC GRID RENDERER
// ====================================================
function renderGrid(containerId, items, renderFn, emptyMsg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (items.length === 0) {
        el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="ph ph-folder-dashed"></i><h3>It's empty here</h3><p>${emptyMsg}</p></div>`;
        return;
    }
    el.innerHTML = items.map(renderFn).join('');
}

// ====================================================
// CARD RENDERERS
// ====================================================
function renderCourseCard(course) {
    let sc = course.status === 'Completed' ? 'completed' : course.status === 'In Progress' ? 'in-progress' : 'to-start';
    const prov  = appState.providers.find(p => p.id === course.providerId);
    const provName = prov ? prov.name : 'Unknown Provider';
    const badges = (course.skillIds || []).map(id => {
        const s = appState.skills.find(sk => sk.id === id);
        const col = s ? getCatColor(s.categoryId) : 'blue';
        return s ? `<span class="cat-badge cat-${col}">${s.name}</span>` : '';
    }).filter(Boolean).join('');

    return `<div class="card">
        <div class="card-title">${course.title}</div>
        <div class="card-subtitle" style="margin-bottom:8px;">
            ${provName}
            ${course.courseUrl ? `<a href="${course.courseUrl}" target="_blank" style="margin-left:8px;color:var(--accent-blue);font-size:12px;text-decoration:none;"><i class="ph ph-arrow-square-out"></i> Open</a>` : ''}
        </div>
        ${course.description ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5;">${course.description}</p>` : ''}
        <div class="skill-badges" style="margin-bottom:16px;">${badges}</div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${course.progress}%"></div></div>
        <div class="card-footer"><span class="status-badge ${sc}">${course.status}</span><span>${course.progress}%</span></div>
    </div>`;
}

function renderProviderCard(provider) {
    return `<div class="card">
        <div style="font-size:32px;color:var(--accent-blue);margin-bottom:12px;"><i class="ph ph-buildings"></i></div>
        <div class="card-title">${provider.name}</div>
        ${provider.url ? `<a href="${provider.url}" target="_blank" style="color:var(--accent-blue);text-decoration:none;font-size:14px;">Visit Website</a>` : ''}
    </div>`;
}

function renderSkillCard(skill, cat) {
    const color   = cat ? cat.color : 'blue';
    const catName = cat ? cat.name  : 'Uncategorised';
    return `<div class="card skill-card cat-border-${color}">
        <div class="skill-card-top">
            <i class="ph ph-brain skill-card-icon cat-text-${color}"></i>
            <span class="cat-badge cat-${color}">${catName}</span>
        </div>
        <div class="card-title" style="margin-top:12px;">${skill.name}</div>
    </div>`;
}

// ====================================================
// PROGRESS LIST
// ====================================================
function renderProgressList() {
    const el = document.getElementById('progress-list');
    if (!el) return;
    if (appState.courses.length === 0) {
        el.innerHTML = `<p style="color:var(--text-secondary);">Add courses to see your progress here.</p>`; return;
    }
    let html = `<div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border-color);overflow:hidden;">`;
    appState.courses.forEach((c, i) => {
        const prov = appState.providers.find(p => p.id === c.providerId);
        const bb   = i < appState.courses.length - 1 ? 'border-bottom:1px solid var(--border-color);' : '';
        let sc     = c.status === 'Completed' ? 'completed' : c.status === 'In Progress' ? 'in-progress' : 'to-start';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;${bb}">
            <div style="flex:2;font-weight:500;">${c.title}</div>
            <div style="flex:1;color:var(--text-secondary);">${prov ? prov.name : '—'}</div>
            <div style="flex:0 0 auto;margin-right:16px;"><span class="status-badge ${sc}">${c.status}</span></div>
            <div style="flex:1;display:flex;align-items:center;gap:12px;">
                <div class="progress-bar-bg" style="margin-bottom:0;width:100px;"><div class="progress-bar-fill" style="width:${c.progress}%"></div></div>
                <span style="font-size:14px;width:40px;text-align:right;">${c.progress}%</span>
            </div></div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
}

// ====================================================
// TOAST
// ====================================================
function showToast(message, color = 'blue') {
    const ex = document.getElementById('cf-toast');
    if (ex) ex.remove();
    const t = document.createElement('div');
    t.id        = 'cf-toast';
    t.className = `cf-toast toast-${color}`;
    t.innerHTML = `<i class="ph ph-check-circle"></i> ${message}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2500);
}

// ====================================================
// HOME EXTRAS — Quotes, Tips, Date
// ====================================================
const QUOTES = [
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "— B.B. King" },
    { text: "An investment in knowledge pays the best interest.", author: "— Benjamin Franklin" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "— Mahatma Gandhi" },
    { text: "The more that you read, the more things you will know.", author: "— Dr. Seuss" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "— Confucius" },
    { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "— Brian Herbert" },
    { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "— W.B. Yeats" },
    { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "— Benjamin Franklin" },
    { text: "Learning never exhausts the mind.", author: "— Leonardo da Vinci" },
    { text: "The expert in anything was once a beginner.", author: "— Helen Hayes" }
];

const TIPS = [
    "🧠 Use the Pomodoro Technique: 25 minutes of focused study followed by a 5-minute break to stay sharp.",
    "📝 Take notes by hand — writing helps you process and retain information far better than typing.",
    "🔁 Spaced repetition is one of the most effective memory tools. Review material at increasing intervals.",
    "🎯 Set a specific learning goal for each session before you start. Clarity beats ambiguity.",
    "🤝 Teach what you've learned to someone else — the best way to confirm your own understanding.",
    "📵 Eliminate distractions during study time. Put your phone on silent and close unnecessary tabs.",
    "💤 Never underestimate the power of sleep. Memory consolidation happens while you rest.",
    "🔗 Connect new concepts to what you already know. Your brain loves building on existing knowledge.",
    "🌱 Embrace mistakes — they are the fastest path to genuine understanding.",
    "📅 Consistency beats intensity. 30 minutes daily is more effective than 4 hours once a week."
];

let currentTipIndex = 0;

function setupHomeExtras() {
    const now = new Date();
    document.getElementById('home-date').textContent =
        now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const q   = QUOTES[day % QUOTES.length];
    document.getElementById('home-quote').textContent       = `"${q.text}"`;
    document.getElementById('home-quote-author').textContent = q.author;
    currentTipIndex = day % TIPS.length;
    document.getElementById('home-tip').textContent = TIPS[currentTipIndex];
    document.getElementById('btn-next-tip').addEventListener('click', () => {
        currentTipIndex = (currentTipIndex + 1) % TIPS.length;
        const el = document.getElementById('home-tip');
        el.style.opacity = '0';
        setTimeout(() => { el.textContent = TIPS[currentTipIndex]; el.style.transition = 'opacity 0.4s'; el.style.opacity = '1'; }, 200);
    });
}
