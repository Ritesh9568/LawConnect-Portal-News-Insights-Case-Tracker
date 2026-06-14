document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // Redirect if they aren't authenticated
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch('/api/reader/dashboard', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error(`HTTP network context fault: ${response.status}`);
        
        const data = await response.json();

        if (!data || !data.success) {
            return alert("Failed to download system metrics panel datasets.");
        }

        // ─── 1. Render News Layout ───────────────────────────────────────────
        const newsContainer = document.getElementById('news-feed-container');
        if (newsContainer) {
            const newsItems = data.news || [];
            if (newsItems.length === 0) {
                newsContainer.innerHTML = '<p class="text-muted">No public legal updates currently logged.</p>';
            } else {
                newsContainer.innerHTML = newsItems.map(item => `
                    <div class="news-item">
                        <h4 class="h5 text-primary mb-1">${item.title}</h4>
                        <p class="mb-1">${item.summary || 'No summary available.'}</p>
                        <small class="text-muted">Published: ${new Date(item.published_at).toLocaleDateString()}</small>
                    </div><hr>
                `).join('');
            }
        }

        // ─── 2. Render Active Cases View ─────────────────────────────────────
        const casesTable = document.getElementById('ongoing-cases-table');
        if (casesTable) {
            const caseItems = data.cases || [];
            if (caseItems.length === 0) {
                casesTable.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No active proceedings running.</td></tr>';
            } else {
                casesTable.innerHTML = caseItems.map(c => {
                    // Match standard platform status style classes
                    const badgeColor = {
                        open: "bg-success",
                        pending: "bg-warning text-dark",
                        closed: "bg-secondary"
                    }[c.status?.toLowerCase()] || "bg-secondary";

                    return `
                        <tr>
                            <td>${c.title}</td>
                            <td>${c.area}</td>
                            <td><span class="badge ${badgeColor}">${c.status.toUpperCase()}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // ─── 3. Render Lawyer Performance Rankings ───────────────────────────
        const leaderboardTable = document.getElementById('leaderboard-table');
        if (leaderboardTable) {
            const lawyerItems = data.leaderboard || [];
            if (lawyerItems.length === 0) {
                leaderboardTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No lawyer metrics available yet.</td></tr>';
            } else {
                leaderboardTable.innerHTML = lawyerItems.map(l => `
                    <tr>
                        <td><strong>${l.name || 'Anonymous Advocate'}</strong></td>
                        <td>${l.specialization || 'General Practice'}</td>
                        <td class="text-success fw-bold">${l.cases_won || 0}</td>
                        <td class="text-danger fw-bold">${l.cases_lost || 0}</td>
                    </tr>
                `).join('');
            }
        }

    } catch (err) {
        console.error('Error binding metrics data engine to view:', err);
        
        // Handle visualization fallbacks on network breakdown
        const errorTemplate = '<tr><td colspan="100%" class="text-center text-danger">⚠️ Failed to compile records dashboard.</td></tr>';
        ['ongoing-cases-table', 'leaderboard-table'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = errorTemplate;
        });
    }
});