document.addEventListener('DOMContentLoaded', () => {
  const caseList = document.getElementById('caseList');
  
  // Extract the authorization token securely from local storage
  const token = localStorage.getItem('token');

  async function loadAvailableCases() {
    if (!caseList) return;
    
    caseList.innerHTML = '<p class="text-muted">Loading cases...</p>';

    try {
      // 🔐 SECURED: Absolute endpoint link stripped. Header appended cleanly.
      const res = await fetch('/api/cases/available', {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error(`Server status tracking breakdown: ${res.status}`);
      }

      const cases = await res.json();
      caseList.innerHTML = ''; // clear loading state

      if (cases.length === 0) {
        caseList.innerHTML = '<p class="text-muted">No available cases matching public board records right now.</p>';
        return;
      }

      cases.forEach(c => {
        const card = document.createElement('div');
        card.className = 'case-card';

        // Match status color styles seamlessly with the dashboard context
        const statusColor = {
          open: "success",
          pending: "warning",
          closed: "secondary"
        }[c.status?.toLowerCase()] || "secondary";

        card.innerHTML = `
          <div class="card mb-3 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <h5 class="card-title mb-1">${c.title}</h5>
                ${c.is_emergency ? '<span class="badge bg-danger">Emergency</span>' : ""}
              </div>
              <h6 class="card-subtitle mb-2 text-muted">
                ${c.area} | Status: <span class="badge bg-${statusColor}">${c.status.toUpperCase()}</span>
              </h6>
              <p class="card-text">${c.description || 'No descriptive brief text provided.'}</p>
              <small class="text-muted">Created on: ${new Date(c.created_on).toLocaleDateString()}</small>
            </div>
          </div>
        `;
        caseList.appendChild(card);
      });
    } catch (err) {
      console.error('Error loading cases:', err);
      caseList.innerHTML = '<p class="text-danger">⚠️ Failed to compile active platform case requests.</p>';
    }
  }

  // Kickoff execution if token check passes validation hooks
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  loadAvailableCases();
  
  // Keep standard background intervals synchronized safely
  setInterval(loadAvailableCases, 30000);
});