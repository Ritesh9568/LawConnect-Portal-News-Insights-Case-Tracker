// Track rendered case IDs to avoid duplicates from socket + polling overlap
const renderedIds = new Set();
const userRole = localStorage.getItem('role'); 
const token = localStorage.getItem('token');
let socket;

// ─── Card Builder ────────────────────────────────────────────────────────────
function buildCardHTML(c) {
    const statusColor = { open: "success", pending: "warning", closed: "secondary" }[c.status?.toLowerCase()] || "secondary";
    
    let actionButton = '';
    if (userRole === 'lawyer') {
        if (c.status === 'open') {
            actionButton = `<button class="btn btn-sm btn-primary mt-2" onclick="acceptCase(${c.id})">⚖️ Accept Case</button>`;
        } else if (c.status === 'pending') {
            actionButton = `
                <div class="mt-2">
                    <input type="text" id="judgment-${c.id}" class="form-control form-control-sm mb-1" placeholder="Enter formal case judgment...">
                    <button class="btn btn-sm btn-danger" onclick="closeCase(${c.id})">❌ Close Case</button>
                </div>`;
        }
    }

    const contactHTML = (c.contact_info && userRole !== 'reader') ? `<p class="card-text mb-1"><small><strong>Client Contact:</strong> ${c.contact_info}</small></p>` : '';
    const judgmentHTML = c.judgment ? `<div class="alert alert-light p-2 mt-2 border"><strong>Resolution:</strong> ${c.judgment}</div>` : '';

    return `
        <div class="card mb-3 shadow-sm" data-case-id="${c.id}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <h5 class="card-title mb-1">${c.title}</h5>
                    ${c.is_emergency ? '<span class="badge bg-danger">Emergency</span>' : ""}
                </div>
                <h6 class="card-subtitle mb-2 text-muted">${c.area} | <span class="badge bg-${statusColor}">${c.status.toUpperCase()}</span></h6>
                <p class="card-text mb-1">${c.description || "No description provided."}</p>
                ${contactHTML}
                ${judgmentHTML}
                ${actionButton}
                <div class="mt-2"><small class="text-muted">Created: ${new Date(c.created_on).toLocaleDateString()}</small></div>
            </div>
        </div>`;
}

// ─── Renderers ───────────────────────────────────────────────────────────────
function renderCase(c, prepend = false) {
    const caseList = document.getElementById("caseList");
    if (!caseList) return;
    const existing = document.querySelector(`[data-case-id="${c.id}"]`);
    if (existing) { existing.outerHTML = buildCardHTML(c); return; }
    
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildCardHTML(c);
    prepend ? caseList.prepend(wrapper.firstElementChild) : caseList.appendChild(wrapper.firstElementChild);
}

// ─── Fetch Dashboard (Cases + News) ──────────────────────────────────────────
async function fetchDashboard() {
    const caseList = document.getElementById("caseList");
    const newsList = document.getElementById("newsList");
    if (!caseList) return;

    try {
        const res = await fetch('/api/reader/dashboard', {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        const data = await res.json();

        // Render Cases
        caseList.innerHTML = data.cases.length ? "" : "<p>No cases found.</p>";
        data.cases.forEach(c => renderCase(c));

        // Render News
        if (newsList) {
            newsList.innerHTML = data.news.map(n => `
                <div class="list-group-item">
                    <h6 class="mb-1">${n.title}</h6>
                    <p class="mb-1 small text-muted">${n.summary || ''}</p>
                    <a href="${n.url}" target="_blank" class="btn btn-link btn-sm p-0">Read More</a>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function acceptCase(id) {
    const res = await fetch(`/api/cases/${id}/accept`, { method: "PUT", headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) fetchDashboard();
}

async function closeCase(id) {
    const judgment = document.getElementById(`judgment-${id}`).value;
    const res = await fetch(`/api/cases/${id}/close`, { 
        method: "PUT", 
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ judgment })
    });
    if (res.ok) fetchDashboard();
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    if (!token) { window.location.href = "login.html"; return; }
    
    fetchDashboard();

    socket = io();
    socket.on("case_update", (updatedCase) => {
        renderCase(updatedCase, true);
    });
});