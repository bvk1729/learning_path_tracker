import { DEFAULT_CATEGORIES, DEFAULT_SKILLS } from './config.js';
import { fetchFromGitHub, commitFile, githubConfig } from './sync/github.js';

export let appState = {
    profile:    { name: '', email: '', bio: '' },
    categories: [],
    providers:  [],
    skills:     [],
    courses:    []
};

export async function loadState() {
    let loadedFromGitHub = false;
    
    // Always attempt to fetch
    try {
        const [ghCourses, ghSkills, ghProviders, ghCategories, ghProfile] = await Promise.all([
            fetchFromGitHub('courses.json'),
            fetchFromGitHub('skills.json'),
            fetchFromGitHub('providers.json'),
            fetchFromGitHub('categories.json'),
            fetchFromGitHub('profile.json')
        ]);
        
        if (ghCourses || ghSkills || ghProviders || ghCategories || ghProfile) {
            appState.courses = ghCourses || [];
            appState.skills = ghSkills || [];
            appState.providers = ghProviders || [];
            appState.categories = ghCategories || [];
            appState.profile = ghProfile || {};
            loadedFromGitHub = true;
        }
    } catch (e) {
        console.warn('Failed to load from data directory or GitHub, falling back to local storage', e);
    }

    if (!loadedFromGitHub) {
        const saved = localStorage.getItem('certflowState');
        if (saved) {
            appState = JSON.parse(saved);
        }
    }

    // Default fallbacks and normalization
    if (!appState.categories) appState.categories = [];
    if (!appState.skills) appState.skills = [];
    if (!appState.providers) appState.providers = [];
    if (!appState.courses) appState.courses = [];
    if (!appState.profile) appState.profile = {};

    appState.categories.forEach(c => c.id = String(c.id));
    appState.providers.forEach(p => p.id = String(p.id));
    appState.skills.forEach(s => {
        s.id = String(s.id);
        if (s.categoryId) s.categoryId = String(s.categoryId);
    });
    appState.courses.forEach(c => {
        c.id = String(c.id);
        if (c.providerId) c.providerId = String(c.providerId);
        if (c.skillIds) c.skillIds = c.skillIds.map(String);
    });

    if (!appState.v2Merged) {
        const skillsToAdd = JSON.parse(JSON.stringify(DEFAULT_SKILLS));
        DEFAULT_CATEGORIES.forEach(dc => {
            const existingCat = appState.categories.find(c => c.name.toLowerCase() === dc.name.toLowerCase());
            if (existingCat) {
                skillsToAdd.forEach(ds => {
                    if (ds.categoryId === dc.id) ds.categoryId = existingCat.id;
                });
            } else {
                appState.categories.push(dc);
            }
        });

        skillsToAdd.forEach(ds => {
            if (!appState.skills.find(s => s.name.toLowerCase() === ds.name.toLowerCase())) {
                appState.skills.push(ds);
            }
        });
        appState.v2Merged = true;
        localStorage.setItem('certflowState', JSON.stringify(appState));
        
        if (githubConfig.token) saveToGitHubAsync(null);
    }

    if (!loadedFromGitHub && !localStorage.getItem('certflowState')) {
        appState.categories = [...DEFAULT_CATEGORIES];
        appState.skills     = [...DEFAULT_SKILLS];
        appState.v2Merged   = true;
    }
}

export function saveStateLocally() {
    localStorage.setItem('certflowState', JSON.stringify(appState));
}

export async function saveToGitHubAsync(statusMsgEl) {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) return;
    
    if (statusMsgEl) {
        statusMsgEl.innerText = 'Syncing...';
        statusMsgEl.style.color = 'var(--accent-orange)';
    }

    try {
        await commitFile('courses.json', appState.courses);
        await commitFile('skills.json', appState.skills);
        await commitFile('providers.json', appState.providers);
        await commitFile('categories.json', appState.categories);
        await commitFile('profile.json', appState.profile);
        
        if (statusMsgEl) {
            statusMsgEl.innerText = 'All synced!';
            statusMsgEl.style.color = 'var(--accent-green)';
            setTimeout(() => statusMsgEl.innerText = '', 3000);
        }
    } catch (e) {
        console.error('Error syncing to GitHub:', e);
        if (statusMsgEl) {
            statusMsgEl.innerText = 'Sync failed.';
            statusMsgEl.style.color = 'var(--accent-red)';
            setTimeout(() => statusMsgEl.innerText = '', 3000);
        }
    }
}

export function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `certflow_backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
}

export function restoreBackup(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        if (parsed.categories && parsed.skills) {
            appState = parsed;
            saveStateLocally();
            return true;
        }
        return false;
    } catch(e) {
        console.error("Failed to parse JSON backup", e);
        return false;
    }
}
