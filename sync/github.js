export let githubConfig = { username: '', repo: 'learning_path_tracker', token: '' };
export let githubShas = {};

// Load config from localStorage on init
export function initGithubConfig() {
    const savedConfig = localStorage.getItem('certflowGithubConfig');
    if (savedConfig) {
        githubConfig = JSON.parse(savedConfig);
    }
}

export function saveGithubConfig(config) {
    githubConfig = { ...githubConfig, ...config };
    localStorage.setItem('certflowGithubConfig', JSON.stringify(githubConfig));
}

export async function fetchFromGitHub(filename) {
    // 1. If we have config and a token, use the GitHub API to bypass cache
    if (githubConfig.username && githubConfig.repo && githubConfig.token) {
        try {
            const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data/${filename}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `token ${githubConfig.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                githubShas[filename] = data.sha;
                const contentStr = decodeURIComponent(escape(atob(data.content)));
                return JSON.parse(contentStr);
            }
        } catch (e) {
            console.warn(`API fetch failed for ${filename}, falling back to relative fetch...`, e);
        }
    }

    // 2. Fallback to relative fetch for public visitors or if API fails
    try {
        const response = await fetch(`data/${filename}?t=${Date.now()}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn(`Relative fetch failed for ${filename}`, e);
    }
    
    return null;
}

export async function commitFile(filename, dataObj) {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) {
        throw new Error("Missing GitHub config/token");
    }
    const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/data/${filename}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataObj, null, 2))));
    
    const body = {
        message: `Update ${filename}`,
        content: content
    };
    if (githubShas[filename]) body.sha = githubShas[filename];
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubConfig.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    if (response.ok) {
        const data = await response.json();
        githubShas[filename] = data.content.sha;
    } else {
        throw new Error(`Failed to commit ${filename}`);
    }
}

export async function fetchCommitHistory() {
    if (!githubConfig.username || !githubConfig.repo) return [];
    
    const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/commits?path=data/`;
    const headers = {};
    if (githubConfig.token) headers['Authorization'] = `token ${githubConfig.token}`;
    
    try {
        const response = await fetch(url, { headers });
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (e) {
        console.error("Failed to fetch commit history:", e);
        return [];
    }
}
